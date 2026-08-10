const fs = require('fs');
const path = require('path');

const { pbAdmin } = require('../config/pocketbase');

const dataDir = path.join(__dirname, '../data');
const warnedFallbackKeys = new Set();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function filePath(fileName) {
  return path.join(dataDir, fileName);
}

function readFallback(fileName, fallbackValue) {
  const target = filePath(fileName);
  if (!fs.existsSync(target)) return clone(fallbackValue);
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    console.error(`[dataStore] Не удалось прочитать ${fileName}:`, err.message);
    return clone(fallbackValue);
  }
}

function writeFallbackAtomic(fileName, value) {
  const target = filePath(fileName);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, target);
}

function isMissingTable(error) {
  return error && error.status === 404;
}

function warnFallback(key, error) {
  if (warnedFallbackKeys.has(key)) return;
  warnedFallbackKeys.add(key);
  console.warn(
    `[dataStore] Для «${key}» используется локальный JSON. ` +
    (error && error.message ? ` Причина: ${error.message}` : '')
  );
}

async function get(key, fileName, fallbackValue) {
  if (!pbAdmin) {
    warnFallback(key);
    return readFallback(fileName, fallbackValue);
  }

  try {
    const record = await pbAdmin.collection('app_config').getFirstListItem(`key="${key}"`);
    if (record && record.value !== undefined && record.value !== null) return record.value;
  } catch (error) {
    if (error.status !== 404) {
      console.error(`[dataStore] Ошибка чтения «${key}» из PocketBase:`, error.message);
      warnFallback(key, error);
      return readFallback(fileName, fallbackValue);
    }
  }

  const initialValue = readFallback(fileName, fallbackValue);
  try {
    try {
      const existing = await pbAdmin.collection('app_config').getFirstListItem(`key="${key}"`);
      await pbAdmin.collection('app_config').update(existing.id, { value: initialValue });
    } catch (e) {
      await pbAdmin.collection('app_config').create({ key, value: initialValue });
    }
  } catch (seedError) {
    console.error(`[dataStore] Не удалось импортировать «${key}» в PocketBase:`, seedError.message);
  }
  return initialValue;
}

async function set(key, _fileName, value) {
  if (!pbAdmin) throw new Error('Public Base is unavailable; changes were not saved');
  try {
    const existing = await pbAdmin.collection('app_config').getFirstListItem(`key="${key}"`);
    await pbAdmin.collection('app_config').update(existing.id, { value });
  } catch (error) {
    if (error.status === 404) {
      await pbAdmin.collection('app_config').create({ key, value });
    } else {
      throw error;
    }
  }
  return clone(value);
}

async function update(key, fileName, fallbackValue, updater) {
  const current = await get(key, fileName, fallbackValue);
  const next = await updater(clone(current));
  return set(key, fileName, next);
}

module.exports = {
  get,
  set,
  update,
  readFallback,
  isMissingTable,
};
