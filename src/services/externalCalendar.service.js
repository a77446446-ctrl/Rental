const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { pbAdmin } = require('../config/pocketbase');

const calendarsFile = path.join(__dirname, '../data/external_calendars.json');
const bookingsFile = path.join(__dirname, '../data/external_bookings.json');

function normalizeSourceName(value) {
  return String(value || '').trim() || 'Внешний источник';
}

function normalizeCalendarUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('webcal://')) url = 'https://' + url.slice(9);
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Ссылка должна начинаться с http/https/webcal');
  const host = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.local')) throw new Error('Локальная ссылка запрещена');
  return parsed.toString();
}

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168);
  }
  return false;
}

async function assertSafeCalendarTarget(url) {
  const hostname = new URL(url).hostname;
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((row) => isPrivateAddress(row.address))) {
    throw new Error('Ссылка ведет во внутреннюю сеть');
  }
}

async function fetchCalendarText(initialUrl, redirects = 0) {
  if (redirects > 3) throw new Error('Слишком много перенаправлений');
  const url = normalizeCalendarUrl(initialUrl);
  await assertSafeCalendarTarget(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'EcoGorniy calendar sync' }, redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      return fetchCalendarText(new URL(location, url).toString(), redirects + 1);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) throw new Error('Файл превышает 5 МБ');
    return text;
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function parseIcsDate(value) {
  const match = String(value || '').trim().match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function addDays(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIcsEvents(icsText) {
  const events = [];
  let current = null;
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  
  lines.forEach((line) => {
    if (line.startsWith('BEGIN:VEVENT')) current = {};
    else if (line.startsWith('END:VEVENT')) {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const left = line.slice(0, idx).split(';')[0].toUpperCase();
      const right = line.slice(idx + 1).replace(/\\,/g, ',').replace(/\\n/g, '\n');
      if (left === 'UID') current.uid = right;
      if (left === 'SUMMARY') current.summary = right;
      if (left === 'STATUS') current.status = right.toUpperCase();
      if (left === 'DTSTART') current.dtstart = right;
      if (left === 'DTEND') current.dtend = right;
    }
  });

  return events.filter(e => e.status !== 'CANCELLED').map(e => {
    const checkIn = parseIcsDate(e.dtstart);
    let checkOut = parseIcsDate(e.dtend);
    if (checkIn && !checkOut) checkOut = addDays(checkIn, 1);
    const uid = e.uid || crypto.createHash('sha1').update(`${e.summary}|${checkIn}|${checkOut}`).digest('hex');
    return { uid, summary: e.summary || '', check_in: checkIn, check_out: checkOut };
  }).filter(e => e.uid && e.check_in && e.check_out && e.check_out > e.check_in);
}

async function getSources(cabinId) {
  if (!pbAdmin) return [];
  try {
    const records = await pbAdmin.collection('external_calendar_sources').getFullList({ filter: `cabin_id="${cabinId}"` });
    return records;
  } catch (e) {
    return [];
  }
}

async function getSourcesForCabins(cabinIds) {
  if (!cabinIds || !cabinIds.length || !pbAdmin) return {};
  try {
    const filterStr = cabinIds.map(id => `cabin_id="${id}"`).join(' || ');
    const records = await pbAdmin.collection('external_calendar_sources').getFullList({ filter: filterStr });
    const mapped = {};
    records.forEach(r => {
      if (!mapped[r.cabin_id]) mapped[r.cabin_id] = [];
      mapped[r.cabin_id].push(r);
    });
    return mapped;
  } catch (e) {
    return {};
  }
}

async function saveSources(cabinId, sources) {
  if (!pbAdmin) return [];
  const existing = await getSources(cabinId);
  const normalized = (Array.isArray(sources) ? sources : []).filter(s => s.ical_url || s.url).map(s => ({
    id: s.id || crypto.randomUUID().replace(/-/g, '').substring(0, 15),
    cabin_id: String(cabinId),
    name: normalizeSourceName(s.name || s.source_name),
    url: normalizeCalendarUrl(s.url || s.ical_url),
    is_active: s.is_active !== false
  }));

  const keepIds = new Set(normalized.map(s => s.id));
  const toDelete = existing.filter(e => !keepIds.has(e.id));

  for (const del of toDelete) {
    try { await pbAdmin.collection('external_calendar_sources').delete(del.id); } catch(e) {}
  }

  const results = [];
  for (const src of normalized) {
    try {
      const exists = existing.find(e => e.id === src.id);
      if (exists) {
        results.push(await pbAdmin.collection('external_calendar_sources').update(src.id, src));
      } else {
        results.push(await pbAdmin.collection('external_calendar_sources').create(src));
      }
    } catch (e) {
      console.error(e);
    }
  }
  return results;
}

async function syncSource(source) {
  if (!source || !source.is_active || !pbAdmin) return { source_id: source.id, imported: 0, skipped: true };
  try {
    const icsText = await fetchCalendarText(source.url || source.ical_url);
    const events = parseIcsEvents(icsText);

    // Удалить старые бронирования
    const old = await pbAdmin.collection('external_bookings').getFullList({ filter: `source_id="${source.id}"` });
    const seenUids = new Set(events.map(e => e.uid));
    const toDelete = old.filter(o => !seenUids.has(o.external_uid));
    
    for (const o of toDelete) {
      try { await pbAdmin.collection('external_bookings').delete(o.id); } catch(e) {}
    }

    for (const e of events) {
      const existing = old.find(o => o.external_uid === e.uid);
      const data = {
        source_id: source.id,
        external_uid: e.uid,
        check_in_date: e.check_in + " 00:00:00.000Z",
        check_out_date: e.check_out + " 00:00:00.000Z"
      };
      if (existing) {
        try { await pbAdmin.collection('external_bookings').update(existing.id, data); } catch(ex) {}
      } else {
        try { await pbAdmin.collection('external_bookings').create(data); } catch(ex) {}
      }
    }
    return { source_id: source.id, imported: events.length, skipped: false };
  } catch (err) {
    throw err;
  }
}

async function syncAllActiveSources() {
  if (!pbAdmin) return { synced: 0, failed: 0, results: [] };
  const records = await pbAdmin.collection('external_calendar_sources').getFullList({ filter: 'is_active=true' });
  let failed = 0;
  const results = [];
  for (const src of records) {
    try {
      results.push(await syncSource(src));
    } catch (e) {
      failed++;
    }
  }
  return { synced: results.length - failed, failed, results };
}

async function getExternalBookingsForRange(cabinId, from, to) {
  if (!pbAdmin) return [];
  try {
    const sources = await getSources(cabinId);
    if (!sources.length) return [];
    const sourceIds = sources.map(s => `source_id="${s.id}"`).join(' || ');
    const records = await pbAdmin.collection('external_bookings').getFullList({
      filter: `(${sourceIds}) && check_in_date<"${to} 00:00:00.000Z" && check_out_date>"${from} 00:00:00.000Z"`,
      expand: 'source_id'
    });
    return records.map(r => ({ ...r, source_name: r.expand?.source_id?.name || 'Внешний календарь' }));
  } catch (e) {
    return [];
  }
}

async function assertNoExternalOverlap(cabinId, checkIn, checkOut) {
  const ext = await getExternalBookingsForRange(cabinId, checkIn, checkOut);
  if (ext.length > 0) throw new Error(`Даты заняты в календаре: ${ext[0].source_name}`);
}

function startExternalCalendarSync(intervalMinutes = 30) {
  const ms = Math.max(intervalMinutes, 5) * 60000;
  const timer = setInterval(() => syncAllActiveSources().catch(console.error), ms);
  return { stop: () => clearInterval(timer) };
}

module.exports = { parseIcsEvents, getSources, getSourcesForCabins, saveSources, syncAllActiveSources, assertNoExternalOverlap, startExternalCalendarSync };
