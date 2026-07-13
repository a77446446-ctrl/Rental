const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  return false;
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
  const all = readData(calendarsFile);
  return all.filter(s => String(s.cabin_id) === String(cabinId));
}

async function getSourcesForCabins(cabinIds) {
  if (!cabinIds || cabinIds.length === 0) return {};
  const all = readData(calendarsFile);
  const result = {};
  all.forEach(s => {
    if (cabinIds.includes(String(s.cabin_id))) {
      if (!result[s.cabin_id]) result[s.cabin_id] = [];
      result[s.cabin_id].push(s);
    }
  });
  return result;
}

async function saveSources(cabinId, sources) {
  let all = readData(calendarsFile);
  
  const normalized = (Array.isArray(sources) ? sources : [])
    .map((source) => {
      const existing = all.find(s => s.id === source.id) || {};
      return {
        id: source.id || crypto.randomUUID(),
        cabin_id: String(cabinId),
        source_name: normalizeSourceName(source.source_name || source.name),
        ical_url: normalizeCalendarUrl(source.ical_url || source.url),
        is_active: source.is_active !== false,
        last_synced_at: existing.last_synced_at || null,
        last_sync_status: existing.last_sync_status || null,
        last_sync_error: existing.last_sync_error || null
      };
    })
    .filter((source) => source.ical_url);

  all = all.filter(s => String(s.cabin_id) !== String(cabinId));
  all.push(...normalized);
  writeData(calendarsFile, all);
  return getSources(cabinId);
}

async function markSyncError(sourceId, message) {
  const all = readData(calendarsFile);
  const source = all.find(s => s.id === sourceId);
  if (source) {
    source.last_synced_at = new Date().toISOString();
    source.last_sync_status = 'error';
    source.last_sync_error = String(message || 'Ошибка синхронизации').slice(0, 500);
    writeData(calendarsFile, all);
  }
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
    
    let allBookings = readData(bookingsFile);

    for (const event of events) {
      seenUids.push(event.uid);
      const idx = allBookings.findIndex(b => b.source_id === source.id && b.external_uid === event.uid);
      const row = {
        id: idx >= 0 ? allBookings[idx].id : crypto.randomUUID(),
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
      
      if (idx >= 0) {
        allBookings[idx] = row;
      } else {
        allBookings.push(row);
      }
    }

    // Remove old events no longer present
    const seenSet = new Set(seenUids);
    allBookings = allBookings.filter(b => b.source_id !== source.id || seenSet.has(b.external_uid));
    writeData(bookingsFile, allBookings);

    // Update source status
    const allSources = readData(calendarsFile);
    const sIdx = allSources.findIndex(s => s.id === source.id);
    if (sIdx >= 0) {
      allSources[sIdx].last_synced_at = new Date().toISOString();
      allSources[sIdx].last_sync_status = 'success';
      allSources[sIdx].last_sync_error = null;
      writeData(calendarsFile, allSources);
    }

    return { source_id: source.id, imported: events.length, skipped: false };
  } catch (err) {
    await markSyncError(source.id, err.message);
    throw err;
  }
}

async function syncSourceById(sourceId) {
  const all = readData(calendarsFile);
  const source = all.find(s => s.id === sourceId);
  if (!source) throw new Error('Source not found');
  return syncSource(source);
}

async function syncAllActiveSources() {
  const all = readData(calendarsFile);
  const active = all.filter(s => s.is_active);
  
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
  const all = readData(bookingsFile);
  return all.filter(b => 
    String(b.cabin_id) === String(cabinId) &&
    b.check_in < to &&
    b.check_out > from
  );
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
