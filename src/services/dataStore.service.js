const fs = require('fs');
const path = require('path');

const { supabaseAdmin } = require('../config/supabase');

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
  const message = String(error && (error.message || error.details || error.hint) || '');
  return error && (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('app_config') && message.toLowerCase().includes('not')
  );
}

function warnFallback(key, error) {
  if (warnedFallbackKeys.has(key)) return;
  warnedFallbackKeys.add(key);
  console.warn(
    `[dataStore] Для «${key}» используется локальный JSON. ` +
    'Примените миграцию 006_stability_hardening.sql, чтобы данные сохранялись между деплоями.' +
    (error && error.message ? ` Причина: ${error.message}` : '')
  );
}

async function get(key, fileName, fallbackValue) {
  if (!supabaseAdmin) {
    warnFallback(key);
    return readFallback(fileName, fallbackValue);
  }

  const { data, error } = await supabaseAdmin
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    if (!isMissingTable(error)) {
      console.error(`[dataStore] Ошибка чтения «${key}» из Supabase:`, error.message);
    }
    warnFallback(key, error);
    return readFallback(fileName, fallbackValue);
  }

  if (data && data.value !== undefined && data.value !== null) return data.value;

  const initialValue = readFallback(fileName, fallbackValue);
  const { error: seedError } = await supabaseAdmin
    .from('app_config')
    .upsert({ key, value: initialValue }, { onConflict: 'key' });

  if (seedError) {
    console.error(`[dataStore] Не удалось импортировать «${key}» в Supabase:`, seedError.message);
  }
  return initialValue;
}

async function set(key, fileName, value) {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('app_config')
      .upsert({ key, value }, { onConflict: 'key' });

    if (!error) return clone(value);
    if (!isMissingTable(error)) {
      throw new Error(`Не удалось сохранить «${key}» в постоянное хранилище: ${error.message}`);
    }
    warnFallback(key, error);
  }

  // Совместимость до применения миграции. Запись атомарная, но Railway-файл
  // не считается постоянным хранилищем и используется только как аварийный режим.
  writeFallbackAtomic(fileName, value);
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
