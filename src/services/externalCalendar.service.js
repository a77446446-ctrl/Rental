const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { supabaseAdmin } = require('../config/supabase');

const calendarsFile = path.join(__dirname, '../data/external_calendars.json');
const bookingsFile = path.join(__dirname, '../data/external_bookings.json');

function readData(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isExternalCalendarSchemaMissing(error) {
  const message = String(error && (error.message || error.details || '') || '');
  return Boolean(error && (
    error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' ||
    message.includes('external_calendar') && message.toLowerCase().includes('not')
  ));
}

function isMissingRpc(error, name) {
  const message = String(error && (error.message || error.details || '') || '').toLowerCase();
  return Boolean(error && (error.code === 'PGRST202' || error.code === '42883' || message.includes(name.toLowerCase()) || message.includes('uuid_generate_v4')));
}

function normalizeSourceName(value) {
  const name = String(value || '').trim();
  return name || 'Внешний источник';
}

function normalizeCalendarUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';

  if (url.startsWith('webcal://')) {
    url = 'https://' + url.slice(9);
  }

  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Ссылка календаря должна начинаться с http://, https:// или webcal://');
  }

  const host = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.local')) {
    throw new Error('Нельзя использовать локальную ссылку календаря');
  }

  return parsed.toString();
}

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

async function assertSafeCalendarTarget(url) {
  const hostname = new URL(url).hostname;
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((row) => isPrivateAddress(row.address))) {
    throw new Error('Ссылка календаря ведет во внутреннюю сеть и запрещена');
  }
}

async function fetchCalendarText(initialUrl, redirects = 0) {
  if (redirects > 3) throw new Error('Слишком много перенаправлений календаря');
  const url = normalizeCalendarUrl(initialUrl);
  await assertSafeCalendarTarget(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'EcoGorniy calendar sync' },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Календарь вернул перенаправление без адреса');
      return fetchCalendarText(new URL(location, url).toString(), redirects + 1);
    }
    if (!response.ok) throw new Error(`Календарь вернул HTTP ${response.status}`);

    const maxBytes = 5 * 1024 * 1024;
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > maxBytes) throw new Error('Файл календаря превышает лимит 5 МБ');

    const reader = response.body && response.body.getReader();
    if (!reader) return response.text();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Файл календаря превышает лимит 5 МБ');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('Календарь не ответил за 15 секунд');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

function fallbackSources(cabinId) {
  return readData(calendarsFile).filter((source) => String(source.cabin_id) === String(cabinId));
}

async function importFallbackSources(rows) {
  if (!supabaseAdmin || !rows.length) return rows;
  const normalized = rows.map((source) => ({
    id: source.id || crypto.randomUUID(),
    cabin_id: source.cabin_id,
    source_name: normalizeSourceName(source.source_name),
    ical_url: normalizeCalendarUrl(source.ical_url),
    is_active: source.is_active !== false,
    last_synced_at: source.last_synced_at || null,
    last_sync_status: source.last_sync_status || 'pending',
    last_sync_error: source.last_sync_error || null,
  }));
  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .upsert(normalized, { onConflict: 'id' })
    .select();
  if (error) throw error;
  return data || normalized;
}

async function getSources(cabinId) {
  if (!supabaseAdmin) return fallbackSources(cabinId);
  const { data, error } = await supabaseAdmin
    .from('external_calendar_sources')
    .select('*')
    .eq('cabin_id', cabinId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isExternalCalendarSchemaMissing(error)) return fallbackSources(cabinId);
    throw error;
  }
  if (data && data.length) return data;
  const fallback = fallbackSources(cabinId);
  return fallback.length ? importFallbackSources(fallback) : [];
}

async function getSourcesForCabins(cabinIds) {
  if (!cabinIds || cabinIds.length === 0) return {};
  let rows;
  if (!supabaseAdmin) {
    rows = readData(calendarsFile);
  } else {
    const result = await supabaseAdmin.from('external_calendar_sources').select('*').in('cabin_id', cabinIds);
    if (result.error) {
      if (!isExternalCalendarSchemaMissing(result.error)) throw result.error;
      rows = readData(calendarsFile);
    } else {
      rows = result.data || [];
      const fallback = readData(calendarsFile).filter((source) => cabinIds.map(String).includes(String(source.cabin_id)));
      const missing = fallback.filter((source) => !rows.some((row) => row.id === source.id));
      if (missing.length) rows = rows.concat(await importFallbackSources(missing));
    }
  }
  const mapped = {};
  rows.forEach((source) => {
    if (!cabinIds.map(String).includes(String(source.cabin_id))) return;
    if (!mapped[source.cabin_id]) mapped[source.cabin_id] = [];
    mapped[source.cabin_id].push(source);
  });
  return mapped;
}

async function saveSources(cabinId, sources) {
  const existing = await getSources(cabinId);
  const normalized = (Array.isArray(sources) ? sources : []).map((source) => {
    const previous = existing.find((row) => row.id === source.id) || {};
    return {
      id: source.id || crypto.randomUUID(),
      cabin_id: String(cabinId),
      source_name: normalizeSourceName(source.source_name || source.name),
      ical_url: normalizeCalendarUrl(source.ical_url || source.url),
      is_active: source.is_active !== false,
      last_synced_at: previous.last_synced_at || null,
      last_sync_status: previous.last_sync_status || 'pending',
      last_sync_error: previous.last_sync_error || null,
    };
  }).filter((source) => source.ical_url);

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.rpc('save_external_calendar_sources', {
      p_cabin_id: cabinId,
      p_sources: normalized,
    });
    if (!error) return data || [];
    if (isMissingRpc(error, 'save_external_calendar_sources')) {
      const upsert = normalized.length
        ? await supabaseAdmin.from('external_calendar_sources').upsert(normalized, { onConflict: 'id' }).select()
        : { data: [], error: null };
      if (!upsert.error) {
        const keepIds = new Set(normalized.map((source) => source.id));
        const removedIds = existing.filter((source) => !keepIds.has(source.id)).map((source) => source.id);
        if (removedIds.length) {
          const removed = await supabaseAdmin.from('external_calendar_sources').delete().in('id', removedIds);
          if (removed.error) throw removed.error;
        }
        return upsert.data || normalized;
      }
      if (!isExternalCalendarSchemaMissing(upsert.error)) throw upsert.error;
    } else if (!isExternalCalendarSchemaMissing(error)) {
      throw error;
    }
  }

  let all = readData(calendarsFile).filter((source) => String(source.cabin_id) !== String(cabinId));
  all.push(...normalized);
  writeData(calendarsFile, all);
  return normalized;
}

async function markSyncError(sourceId, message) {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('external_calendar_sources').update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: String(message || 'Ошибка синхронизации').slice(0, 500),
    }).eq('id', sourceId);
    if (!error) return;
    if (!isExternalCalendarSchemaMissing(error)) throw error;
  }
  const all = readData(calendarsFile);
  const source = all.find((row) => row.id === sourceId);
  if (!source) return;
  source.last_synced_at = new Date().toISOString();
  source.last_sync_status = 'error';
  source.last_sync_error = String(message || 'Ошибка синхронизации').slice(0, 500);
  writeData(calendarsFile, all);
}

async function syncSource(source) {
  if (!source || !source.is_active) {
    return { source_id: source ? source.id : null, imported: 0, skipped: true };
  }

  try {
    const icsText = await fetchCalendarText(source.ical_url);
    const events = parseIcsEvents(icsText);
    let storedInDatabase = false;
    if (supabaseAdmin) {
      const result = await supabaseAdmin.rpc('replace_external_bookings', {
        p_source_id: source.id,
        p_events: events,
      });
      if (!result.error) storedInDatabase = true;
      else if (isMissingRpc(result.error, 'replace_external_bookings')) {
        const current = await supabaseAdmin.from('external_bookings').select('id, external_uid').eq('source_id', source.id);
        if (!current.error) {
          const rows = events.map((event) => ({
            source_id: source.id,
            cabin_id: source.cabin_id,
            external_uid: event.uid,
            source_name: source.source_name,
            summary: event.summary || null,
            check_in: event.check_in,
            check_out: event.check_out,
            raw_event: event.raw_event || {},
            last_seen_at: new Date().toISOString(),
          }));
          const upsert = rows.length
            ? await supabaseAdmin.from('external_bookings').upsert(rows, { onConflict: 'source_id,external_uid' })
            : { error: null };
          if (upsert.error) throw upsert.error;
          const seen = new Set(events.map((event) => event.uid));
          const staleIds = (current.data || []).filter((row) => !seen.has(row.external_uid)).map((row) => row.id);
          if (staleIds.length) {
            const removed = await supabaseAdmin.from('external_bookings').delete().in('id', staleIds);
            if (removed.error) throw removed.error;
          }
          const marked = await supabaseAdmin.from('external_calendar_sources').update({
            last_synced_at: new Date().toISOString(), last_sync_status: 'success', last_sync_error: null,
          }).eq('id', source.id);
          if (marked.error) throw marked.error;
          storedInDatabase = true;
        } else if (!isExternalCalendarSchemaMissing(current.error)) {
          throw current.error;
        }
      } else if (!isExternalCalendarSchemaMissing(result.error)) throw result.error;
    }

    if (!storedInDatabase) {
      const seenSet = new Set(events.map((event) => event.uid));
      let allBookings = readData(bookingsFile).filter((row) => row.source_id !== source.id || seenSet.has(row.external_uid));
      events.forEach((event) => {
        const index = allBookings.findIndex((row) => row.source_id === source.id && row.external_uid === event.uid);
        const row = {
          id: index >= 0 ? allBookings[index].id : crypto.randomUUID(),
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
        if (index >= 0) allBookings[index] = row;
        else allBookings.push(row);
      });
      writeData(bookingsFile, allBookings);
      const allSources = readData(calendarsFile);
      const index = allSources.findIndex((row) => row.id === source.id);
      if (index >= 0) {
        Object.assign(allSources[index], { last_synced_at: new Date().toISOString(), last_sync_status: 'success', last_sync_error: null });
        writeData(calendarsFile, allSources);
      }
    }

    return { source_id: source.id, imported: events.length, skipped: false };
  } catch (err) {
    await markSyncError(source.id, err.message);
    throw err;
  }
}

async function syncSourceById(sourceId) {
  let source;
  if (supabaseAdmin) {
    const result = await supabaseAdmin.from('external_calendar_sources').select('*').eq('id', sourceId).maybeSingle();
    if (!result.error) source = result.data;
    else if (!isExternalCalendarSchemaMissing(result.error)) throw result.error;
  }
  if (!source) source = readData(calendarsFile).find((row) => row.id === sourceId);
  if (!source) throw new Error('Source not found');
  return syncSource(source);
}

async function syncAllActiveSources() {
  let active;
  if (supabaseAdmin) {
    const result = await supabaseAdmin.from('external_calendar_sources').select('*').eq('is_active', true);
    if (!result.error) {
      active = result.data || [];
      if (!active.length) {
        const fallback = readData(calendarsFile).filter((source) => source.is_active);
        if (fallback.length) active = await importFallbackSources(fallback);
      }
    }
    else if (!isExternalCalendarSchemaMissing(result.error)) throw result.error;
  }
  if (!active) active = readData(calendarsFile).filter((source) => source.is_active);
  
  const results = [];
  let failed = 0;

  for (const source of active) {
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
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from('external_bookings').select('*')
      .eq('cabin_id', cabinId).lt('check_in', to).gt('check_out', from);
    if (!error && data && data.length) return data;
    if (!error) {
      return readData(bookingsFile).filter((row) => String(row.cabin_id) === String(cabinId) && row.check_in < to && row.check_out > from);
    }
    if (!isExternalCalendarSchemaMissing(error)) throw error;
  }
  return readData(bookingsFile).filter((row) => String(row.cabin_id) === String(cabinId) && row.check_in < to && row.check_out > from);
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

  const initialTimer = setTimeout(() => {
    syncAllActiveSources().catch((err) => {
      console.error('[externalCalendar.service] Ошибка фоновой синхронизации:', err.message);
    });
  }, 15 * 1000);

  const intervalTimer = setInterval(() => {
    syncAllActiveSources().catch((err) => {
      console.error('[externalCalendar.service] Ошибка фоновой синхронизации:', err.message);
    });
  }, intervalMs);

  return {
    stop() {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    },
  };
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
  isPrivateAddress,
};
