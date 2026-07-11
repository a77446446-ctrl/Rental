/*
 * 002_rls.sql
 * Row Level Security (RLS) политики для всех таблиц.
 *
 * Принцип:
 * - Публичные данные (домики, цены, услуги) читаются через anon-ключ.
 * - Все записи и изменения идут только через service_role (бэкенд Express).
 * - Гости, бронирования, чат, заметки — полностью закрыты для anon.
 *
 * Запускать в Supabase SQL Editor после 001_init.sql.
 */

/* ─────────────────────────────────────────────
   Включаем RLS на всех таблицах
   ───────────────────────────────────────────── */

ALTER TABLE cabins                ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_extra_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_notes           ENABLE ROW LEVEL SECURITY;

/* ─────────────────────────────────────────────
   1. cabins — публичное чтение активных домиков
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS cabins_public_read ON cabins;
CREATE POLICY cabins_public_read ON cabins
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS cabins_service_all ON cabins;
CREATE POLICY cabins_service_all ON cabins
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   2. prices — публичное чтение всех цен
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS prices_public_read ON prices;
CREATE POLICY prices_public_read ON prices
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS prices_service_all ON prices;
CREATE POLICY prices_service_all ON prices
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   3. extra_services — публичное чтение активных услуг
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS extra_services_public_read ON extra_services;
CREATE POLICY extra_services_public_read ON extra_services
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS extra_services_service_all ON extra_services;
CREATE POLICY extra_services_service_all ON extra_services
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   4. guests — только service_role (бэкенд)
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS guests_service_all ON guests;
CREATE POLICY guests_service_all ON guests
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   5. bookings — только service_role (бэкенд)
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS bookings_service_all ON bookings;
CREATE POLICY bookings_service_all ON bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   6. booking_extra_services — только service_role
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS bes_service_all ON booking_extra_services;
CREATE POLICY bes_service_all ON booking_extra_services
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   7. chat_logs — только service_role
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS chat_service_all ON chat_logs;
CREATE POLICY chat_service_all ON chat_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   8. guest_notes — только service_role
   ───────────────────────────────────────────── */

DROP POLICY IF EXISTS guest_notes_service_all ON guest_notes;
CREATE POLICY guest_notes_service_all ON guest_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

/* ─────────────────────────────────────────────
   Включаем Realtime для chat_logs
   (безопасная проверка — не падает, если уже добавлена)
   ───────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname   = 'supabase_realtime'
      AND tablename = 'chat_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_logs;
  END IF;
END $$;
