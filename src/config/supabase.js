/**
 * Клиент Supabase для серверного использования.
 * Создаёт два клиента:
 * - supabaseAdmin: для привилегированных операций (Service Role Key)
 * - supabasePublic: для операций с правами анонимного пользователя (Anon Key)
 *
 * ВАЖНО: supabaseAdmin НИКОГДА не используется на фронтенде.
 * Все операции с ним выполняются исключительно через Express API.
 */

const { createClient } = require('@supabase/supabase-js');
const { config } = require('./env');

/**
 * Привилегированный клиент Supabase (Service Role).
 * Используется для операций, требующих полного доступа к базе:
 * управление бронированиями, загрузка файлов, администрирование.
 * Этот клиент обходит Row Level Security (RLS).
 */
let supabaseAdmin = null;

if (config.supabaseUrl && config.supabaseServiceRoleKey) {
  supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    '\x1b[33m[supabase] Предупреждение: supabaseAdmin не инициализирован — ' +
    'не заданы SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.\x1b[0m'
  );
}

/**
 * Публичный клиент Supabase (Anon Key).
 * Используется для операций с ограниченными правами,
 * которые подчиняются Row Level Security (RLS).
 */
let supabasePublic = null;

if (config.supabaseUrl && config.supabaseAnonKey) {
  supabasePublic = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    '\x1b[33m[supabase] Предупреждение: supabasePublic не инициализирован — ' +
    'не заданы SUPABASE_URL или SUPABASE_ANON_KEY.\x1b[0m'
  );
}

module.exports = { supabaseAdmin, supabasePublic };
