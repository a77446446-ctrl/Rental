const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { pbAdmin } = require('../config/pocketbase');
const { validateRecordId } = require('../utils/validation');

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
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('::ffff:')) {
      return isPrivateAddress(normalized.slice('::ffff:'.length));
    }
    const firstGroup = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return (firstGroup >= 0xfc00 && firstGroup <= 0xfdff)
      || (firstGroup >= 0xfe80 && firstGroup <= 0xfebf)
      || firstGroup >= 0xff00;
  }
  return true;
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
      if (!location) throw new Error('Сервер календаря вернул перенаправление без адреса');
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

const SOURCE_FIELD_CONTRACT = {
  fields: new Set(['cabin_id', 'name', 'url', 'is_active']),
  name: 'name',
  url: 'url',
};
const BOOKING_FIELD_CONTRACT = {
  fields: new Set(['source_id', 'external_uid', 'check_in_date', 'check_out_date']),
  checkIn: 'check_in_date',
  checkOut: 'check_out_date',
};

function markMissingSchema(error) {
  if (Number(error?.status || error?.response?.status) === 404) {
    error.externalCalendarSchemaMissing = true;
  }
  return error;
}

function isExternalCalendarSchemaMissing(error) {
  return Boolean(error && error.externalCalendarSchemaMissing);
}

async function getSourceFieldContract() {
  return SOURCE_FIELD_CONTRACT;
}

async function getBookingFieldContract() {
  return BOOKING_FIELD_CONTRACT;
}

function toSourceView(record) {
  const sourceName = normalizeSourceName(record?.source_name || record?.name);
  const icalUrl = String(record?.ical_url || record?.url || '').trim();
  return {
    ...record,
    source_name: sourceName,
    ical_url: icalUrl,
    name: sourceName,
    url: icalUrl,
  };
}

function createSourceId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 15);
}

async function getSources(cabinId) {
  if (!pbAdmin) return [];
  const validCabinId = validateRecordId(cabinId, 'Объект');
  try {
    const records = await pbAdmin.collection('external_calendar_sources').getFullList({
      filter: `cabin_id="${validCabinId}"`,
      sort: 'created',
    });
    return records.map(toSourceView);
  } catch (error) {
    throw markMissingSchema(error);
  }
}

async function getSourcesForCabins(cabinIds) {
  if (!Array.isArray(cabinIds) || cabinIds.length === 0 || !pbAdmin) return {};
  const validIds = cabinIds.map((id) => validateRecordId(id, 'Объект'));
  try {
    const filter = validIds.map((id) => `cabin_id="${id}"`).join(' || ');
    const records = await pbAdmin.collection('external_calendar_sources').getFullList({ filter });
    return records.reduce((result, record) => {
      const source = toSourceView(record);
      if (!result[source.cabin_id]) result[source.cabin_id] = [];
      result[source.cabin_id].push(source);
      return result;
    }, {});
  } catch (error) {
    if (Number(error?.status || error?.response?.status) === 404) return {};
    throw error;
  }
}

async function saveSources(cabinId, sources) {
  if (!pbAdmin) throw new Error('Хранилище календарей временно недоступно');
  const validCabinId = validateRecordId(cabinId, 'Объект');
  const inputSources = Array.isArray(sources) ? sources : [];
  if (inputSources.length > 10) throw new Error('Можно подключить не более 10 внешних календарей');

  const contract = await getSourceFieldContract();
  const existing = await getSources(validCabinId);
  const existingById = new Map(existing.map((source) => [source.id, source]));
  const seenUrls = new Set();
  const normalized = inputSources
    .filter((source) => source && (source.ical_url || source.url))
    .map((source) => {
      const url = normalizeCalendarUrl(source.ical_url || source.url);
      if (seenUrls.has(url)) throw new Error('Один и тот же iCal-календарь добавлен дважды');
      seenUrls.add(url);

      const id = source.id
        ? validateRecordId(source.id, 'Источник календаря')
        : createSourceId();
      if (source.id && !existingById.has(id)) {
        throw new Error('Источник календаря не принадлежит выбранному объекту');
      }
      return {
        id,
        cabin_id: validCabinId,
        source_name: normalizeSourceName(source.source_name || source.name).slice(0, 80),
        ical_url: url,
        is_active: source.is_active !== false,
      };
    });

  const results = [];
  for (const source of normalized) {
    const payload = {
      cabin_id: source.cabin_id,
      [contract.name]: source.source_name,
      [contract.url]: source.ical_url,
      is_active: source.is_active,
    };
    const saved = existingById.has(source.id)
      ? await pbAdmin.collection('external_calendar_sources').update(source.id, payload)
      : await pbAdmin.collection('external_calendar_sources').create({ id: source.id, ...payload });
    results.push(toSourceView(saved));
  }

  const keepIds = new Set(normalized.map((source) => source.id));
  for (const source of existing) {
    if (!keepIds.has(source.id)) {
      await pbAdmin.collection('external_calendar_sources').delete(source.id);
    }
  }
  return results;
}

async function updateSourceSyncState(sourceId, status, errorMessage = '') {
  const contract = await getSourceFieldContract();
  const payload = {};
  if (contract.fields.has('last_synced_at')) payload.last_synced_at = new Date().toISOString();
  if (contract.fields.has('last_sync_status')) payload.last_sync_status = status;
  if (contract.fields.has('last_sync_error')) payload.last_sync_error = errorMessage || '';
  if (Object.keys(payload).length) {
    await pbAdmin.collection('external_calendar_sources').update(sourceId, payload);
  }
}

async function syncSource(sourceRecord) {
  const source = toSourceView(sourceRecord);
  if (!source.is_active || !pbAdmin) {
    return { source_id: source.id, imported: 0, skipped: true };
  }

  try {
    const icsText = await fetchCalendarText(source.ical_url);
    if (!/^\s*BEGIN:VCALENDAR\b/m.test(icsText)) {
      throw new Error('По ссылке получен не iCal-календарь');
    }
    const events = parseIcsEvents(icsText);
    const contract = await getBookingFieldContract();
    const old = await pbAdmin.collection('external_bookings').getFullList({
      filter: `source_id="${source.id}"`,
    });
    const oldByUid = new Map(old.map((booking) => [booking.external_uid, booking]));

    for (const event of events) {
      const payload = {
        source_id: source.id,
        external_uid: event.uid,
        [contract.checkIn]: `${event.check_in} 00:00:00.000Z`,
        [contract.checkOut]: `${event.check_out} 00:00:00.000Z`,
      };
      if (contract.fields.has('cabin_id')) payload.cabin_id = source.cabin_id;
      if (contract.fields.has('source_name')) payload.source_name = source.source_name;
      if (contract.fields.has('summary')) payload.summary = event.summary;
      if (contract.fields.has('raw_event')) payload.raw_event = event;
      if (contract.fields.has('last_seen_at')) payload.last_seen_at = new Date().toISOString();

      const existing = oldByUid.get(event.uid);
      if (existing) {
        await pbAdmin.collection('external_bookings').update(existing.id, payload);
      } else {
        await pbAdmin.collection('external_bookings').create(payload);
      }
    }

    const seenUids = new Set(events.map((event) => event.uid));
    for (const booking of old) {
      if (!seenUids.has(booking.external_uid)) {
        await pbAdmin.collection('external_bookings').delete(booking.id);
      }
    }

    await updateSourceSyncState(source.id, 'success');
    return { source_id: source.id, imported: events.length, skipped: false };
  } catch (error) {
    await updateSourceSyncState(source.id, 'error', error.message).catch(() => {});
    error.message = `Не удалось синхронизировать «${source.source_name}»: ${error.message}`;
    throw error;
  }
}

async function syncSourceById(sourceId) {
  const validSourceId = validateRecordId(sourceId, 'Источник календаря');
  const source = await pbAdmin.collection('external_calendar_sources').getOne(validSourceId);
  return syncSource(source);
}

async function syncAllActiveSources() {
  if (!pbAdmin) return { synced: 0, failed: 0, results: [] };
  const records = await pbAdmin.collection('external_calendar_sources').getFullList({ filter: 'is_active=true' });
  let failed = 0;
  const results = [];
  for (const record of records) {
    try {
      results.push(await syncSource(record));
    } catch (_error) {
      failed += 1;
    }
  }
  return { synced: results.length, failed, results };
}
async function getExternalBookingsForRange(cabinId, from, to) {
  if (!pbAdmin) return [];
  try {
    const sources = (await getSources(cabinId)).filter((source) => source.is_active !== false);
    if (!sources.length) return [];

    const contract = await getBookingFieldContract();
    const sourceIds = sources.map((source) => `source_id="${source.id}"`).join(' || ');
    const records = await pbAdmin.collection('external_bookings').getFullList({
      filter: `(${sourceIds}) && ${contract.checkIn}<"${to} 00:00:00.000Z" && ${contract.checkOut}>"${from} 00:00:00.000Z"`,
      expand: 'source_id',
    });
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    return records.map((record) => ({
      ...record,
      check_in: String(record[contract.checkIn] || '').slice(0, 10),
      check_out: String(record[contract.checkOut] || '').slice(0, 10),
      source_name: sourcesById.get(record.source_id)?.source_name || 'Внешний календарь',
    }));
  } catch (error) {
    if (isExternalCalendarSchemaMissing(error)) return [];
    throw error;
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

module.exports = {
  parseIcsEvents,
  isPrivateAddress,
  getSources,
  getSourcesForCabins,
  saveSources,
  syncSourceById,
  syncAllActiveSources,
  isExternalCalendarSchemaMissing,
  getExternalBookingsForRange,
  assertNoExternalOverlap,
  startExternalCalendarSync,
};
