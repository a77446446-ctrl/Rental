const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205', 'PGRST116']);

function isExternalCalendarSchemaMissing(error) {
  if (!error) return false;
  return TABLE_MISSING_CODES.has(error.code) ||
    String(error.message || '').includes('external_calendar_sources') ||
    String(error.message || '').includes('external_bookings');
}

function normalizeSourceName(value) {
  const name = String(value || '').trim();
  return name || 'Внешний источник';
}

function normalizeCalendarUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';

  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Ссылка календаря должна начинаться с http:// или https://');
  }

  const host = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) {
    throw new Error('Нельзя использовать локальную ссылку календаря');
  }

  return parsed.toString();
}

function addDays(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIcsDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function unfoldIcs(icsText) {
  return String(icsText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');
}

function parseContentLine(line) {
  const index = line.indexOf(':');
  if (index === -1) return null;

  const left = line.slice(0, index);
  const value = line.slice(index + 1);
  const parts = left.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};

  parts.forEach((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });

  return { name, params, value };
}

function decodeIcsText(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseIcsEvents(icsText) {
  const text = unfoldIcs(icsText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const events = [];
  let current = null;

  lines.forEach((line) => {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      return;
    }

    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      return;
    }

    if (!current) return;

    const parsed = parseContentLine(line);
    if (!parsed) return;

    if (parsed.name === 'UID') current.uid = decodeIcsText(parsed.value);
    if (parsed.name === 'SUMMARY') current.summary = decodeIcsText(parsed.value);
    if (parsed.name === 'STATUS') current.status = String(parsed.value || '').toUpperCase();
    if (parsed.name === 'DTSTART') current.dtstart = parsed.value;
    if (parsed.name === 'DTEND') current.dtend = parsed.value;
  });

  return events
    .filter((event) => event.status !== 'CANCELLED')
    .map((event) => {
      const checkIn = parseIcsDate(event.dtstart);
      let checkOut = parseIcsDate(event.dtend);
      if (checkIn && !checkOut) checkOut = addDays(checkIn, 1);

      const fallbackUid = crypto
        .createHash('sha1')
        .update([event.summary || '', checkIn || '', checkOut || ''].join('|'))
        .digest('hex');

      return {
        uid: event.uid || fallbackUid,
        summary: event.summary || '',
        check_in: checkIn,
        check_out: checkOut,
        raw_event: event,
      };
    })
    .filter((event) => event.uid && event.check_in && event.check_out && event.check_out > event.check_in);
}

async function getSources(cabinId) {
  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .select('id, cabin_id, source_name, ical_url, is_active, last_synced_at, last_sync_status, last_sync_error')
    .eq('cabin_id', cabinId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isExternalCalendarSchemaMissing(error)) return [];
    throw error;
  }

  return data || [];
}

async function getSourcesForCabins(cabinIds) {
  if (!cabinIds || cabinIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .select('id, cabin_id, source_name, ical_url, is_active, last_synced_at, last_sync_status, last_sync_error')
    .in('cabin_id', cabinIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (isExternalCalendarSchemaMissing(error)) return {};
    throw error;
  }

  return (data || []).reduce((acc, source) => {
    if (!acc[source.cabin_id]) acc[source.cabin_id] = [];
    acc[source.cabin_id].push(source);
    return acc;
  }, {});
}

async function saveSources(cabinId, sources) {
  const normalized = (Array.isArray(sources) ? sources : [])
    .map((source) => ({
      id: source.id || null,
      cabin_id: cabinId,
      source_name: normalizeSourceName(source.source_name || source.name),
      ical_url: normalizeCalendarUrl(source.ical_url || source.url),
      is_active: source.is_active !== false,
    }))
    .filter((source) => source.ical_url);

  const existing = await getSources(cabinId);
  const keepIds = normalized.map((source) => source.id).filter(Boolean);
  const removeIds = existing
    .filter((source) => !keepIds.includes(source.id))
    .map((source) => source.id);

  if (removeIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('external_calendar_sources')
      .delete()
      .in('id', removeIds);
    if (error) throw error;
  }

  for (const source of normalized) {
    if (source.id) {
      const { error } = await supabaseAdmin
        .from('external_calendar_sources')
        .update({
          source_name: source.source_name,
          ical_url: source.ical_url,
          is_active: source.is_active,
        })
        .eq('id', source.id)
        .eq('cabin_id', cabinId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('external_calendar_sources')
        .insert([source]);
      if (error) throw error;
    }
  }

  return getSources(cabinId);
}

async function markSyncError(sourceId, message) {
  await supabaseAdmin
    .from('external_calendar_sources')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: String(message || 'Ошибка синхронизации').slice(0, 500),
    })
    .eq('id', sourceId);
}

async function syncSource(source) {
  if (!source || !source.is_active) {
    return { source_id: source ? source.id : null, imported: 0, skipped: true };
  }

  try {
    const response = await fetch(source.ical_url, {
      headers: { 'User-Agent': 'EcoGorniy calendar sync' },
    });

    if (!response.ok) {
      throw new Error(`Календарь вернул HTTP ${response.status}`);
    }

    const icsText = await response.text();
    const events = parseIcsEvents(icsText);
    const seenUids = [];

    for (const event of events) {
      seenUids.push(event.uid);
      const row = {
        source_id: source.id,
        cabin_id: source.cabin_id,
        external_uid: event.uid,
        source_name: source.source_name,
        summary: event.summary || null,
        check_in: event.check_in,
        check_out: event.check_out,
        raw_event: event.raw_event || {},
        last_seen_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('external_bookings')
        .upsert(row, { onConflict: 'source_id,external_uid' });
      if (error) throw error;
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('external_bookings')
      .select('id, external_uid')
      .eq('source_id', source.id);
    if (existingError) throw existingError;

    const seenSet = new Set(seenUids);
    const removeIds = (existingRows || [])
      .filter((row) => !seenSet.has(row.external_uid))
      .map((row) => row.id);

    if (removeIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('external_bookings')
        .delete()
        .in('id', removeIds);
      if (deleteError) throw deleteError;
    }

    const { error: statusError } = await supabaseAdmin
      .from('external_calendar_sources')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
      })
      .eq('id', source.id);
    if (statusError) throw statusError;

    return { source_id: source.id, imported: events.length, skipped: false };
  } catch (err) {
    await markSyncError(source.id, err.message);
    throw err;
  }
}

async function syncSourceById(sourceId) {
  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error) throw error;
  return syncSource(data);
}

async function syncAllActiveSources() {
  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .select('*')
    .eq('is_active', true);

  if (error) {
    if (isExternalCalendarSchemaMissing(error)) return { synced: 0, failed: 0, results: [] };
    throw error;
  }

  const results = [];
  let failed = 0;

  for (const source of data || []) {
    try {
      results.push(await syncSource(source));
    } catch (err) {
      failed += 1;
      results.push({ source_id: source.id, imported: 0, error: err.message });
    }
  }

  return { synced: results.length - failed, failed, results };
}

async function getExternalBookingsForRange(cabinId, from, to) {
  const { data, error } = await supabaseAdmin
    .from('external_bookings')
    .select('id, source_id, source_name, summary, check_in, check_out')
    .eq('cabin_id', cabinId)
    .lt('check_in', to)
    .gt('check_out', from);

  if (error) {
    if (isExternalCalendarSchemaMissing(error)) return [];
    throw error;
  }

  return data || [];
}

async function assertNoExternalOverlap(cabinId, checkIn, checkOut) {
  const externalBookings = await getExternalBookingsForRange(cabinId, checkIn, checkOut);
  if (externalBookings.length > 0) {
    const source = externalBookings[0].source_name || 'внешнем календаре';
    throw new Error(`Даты уже заняты во внешнем календаре: ${source}`);
  }
}

function startExternalCalendarSync(intervalMinutes = 30) {
  const minutes = Number(intervalMinutes) || 30;
  const intervalMs = Math.max(minutes, 5) * 60 * 1000;

  setTimeout(() => {
    syncAllActiveSources().catch((err) => {
      console.error('[externalCalendar.service] Ошибка фоновой синхронизации:', err.message);
    });
  }, 15 * 1000);

  setInterval(() => {
    syncAllActiveSources().catch((err) => {
      console.error('[externalCalendar.service] Ошибка фоновой синхронизации:', err.message);
    });
  }, intervalMs);
}

module.exports = {
  parseIcsEvents,
  getSources,
  getSourcesForCabins,
  saveSources,
  syncSourceById,
  syncAllActiveSources,
  getExternalBookingsForRange,
  assertNoExternalOverlap,
  startExternalCalendarSync,
  isExternalCalendarSchemaMissing,
};
