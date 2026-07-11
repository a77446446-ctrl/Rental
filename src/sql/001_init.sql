/*
 * 001_init.sql
 * Инициализация базы данных eco-gorniy.ru
 * Все таблицы, индексы, ограничения и защита от двойного бронирования.
 *
 * Запускать в Supabase SQL Editor от имени суперпользователя.
 */

/* ─────────────────────────────────────────────
   Расширения
   ───────────────────────────────────────────── */

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

/* ─────────────────────────────────────────────
   1. Домики (cabins)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS cabins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  base_price    INTEGER NOT NULL CHECK (base_price >= 0),
  capacity      INTEGER NOT NULL CHECK (capacity >= 1),
  images_urls   TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cabins_slug ON cabins (slug);
CREATE INDEX IF NOT EXISTS idx_cabins_active ON cabins (is_active) WHERE is_active = true;

COMMENT ON TABLE cabins IS 'Домики для аренды (ровно 4 штуки)';
COMMENT ON COLUMN cabins.base_price IS 'Базовая цена за сутки в рублях';
COMMENT ON COLUMN cabins.images_urls IS 'Массив URL фотографий из Supabase Storage';
COMMENT ON COLUMN cabins.sort_order IS 'Порядок сортировки на сайте';

/* ─────────────────────────────────────────────
   2. Календарь цен (prices)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS prices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabin_id          UUID NOT NULL REFERENCES cabins(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  custom_price      INTEGER NOT NULL CHECK (custom_price >= 0),
  is_promo          BOOLEAN NOT NULL DEFAULT false,
  promo_description TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_prices_cabin_date UNIQUE (cabin_id, date)
);

CREATE INDEX IF NOT EXISTS idx_prices_cabin_date ON prices (cabin_id, date);
CREATE INDEX IF NOT EXISTS idx_prices_date_range ON prices (date);

COMMENT ON TABLE prices IS 'Индивидуальные цены на конкретные даты (перезаписывают base_price)';
COMMENT ON COLUMN prices.custom_price IS 'Цена за сутки в рублях на конкретную дату';
COMMENT ON COLUMN prices.is_promo IS 'Флаг акционной цены';

/* ─────────────────────────────────────────────
   3. Дополнительные услуги (extra_services)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS extra_services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL CHECK (price >= 0),
  price_type  VARCHAR(20) NOT NULL CHECK (price_type IN ('per_booking', 'per_day', 'per_person')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extra_services_active ON extra_services (is_active) WHERE is_active = true;

COMMENT ON TABLE extra_services IS 'Дополнительные услуги к бронированию';
COMMENT ON COLUMN extra_services.price IS 'Цена услуги в рублях';
COMMENT ON COLUMN extra_services.price_type IS 'Тип тарификации: per_booking (за бронь), per_day (за сутки), per_person (за человека)';

/* ─────────────────────────────────────────────
   4. Гости (guests)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS guests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   VARCHAR(255) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  telegram    VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests (phone);

COMMENT ON TABLE guests IS 'Гости, оформляющие бронирование';

/* ─────────────────────────────────────────────
   5. Бронирования (bookings)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabin_id        UUID NOT NULL REFERENCES cabins(id) ON DELETE RESTRICT,
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  guests_count    INTEGER NOT NULL DEFAULT 1 CHECK (guests_count >= 1),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  total_price     INTEGER NOT NULL CHECK (total_price >= 0),
  comment         TEXT,
  admin_comment   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_dates_order CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_bookings_cabin ON bookings (cabin_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings (guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings (check_in, check_out);

COMMENT ON TABLE bookings IS 'Бронирования домиков';
COMMENT ON COLUMN bookings.check_in IS 'Дата заезда (включительно), формат YYYY-MM-DD';
COMMENT ON COLUMN bookings.check_out IS 'Дата выезда (исключительно), формат YYYY-MM-DD';
COMMENT ON COLUMN bookings.total_price IS 'Итоговая стоимость в рублях (рассчитывается ТОЛЬКО на бэкенде)';

/* ─────────────────────────────────────────────
   5.1 Защита от двойного бронирования
   Триггер проверяет пересечение дат для активных
   (pending / confirmed) броней одного домика.
   ───────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION fn_check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  /* Проверяем только активные статусы */
  IF NEW.status IN ('pending', 'confirmed') THEN
    IF EXISTS (
      SELECT 1
      FROM bookings
      WHERE cabin_id  = NEW.cabin_id
        AND id        != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status    IN ('pending', 'confirmed')
        AND daterange(check_in, check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
    ) THEN
      RAISE EXCEPTION 'Даты бронирования пересекаются с существующей активной бронью для домика %', NEW.cabin_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_booking_overlap ON bookings;

CREATE TRIGGER trg_check_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_booking_overlap();

/* ─────────────────────────────────────────────
   5.2 Автообновление updated_at при изменении
   ───────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_cabins_updated_at ON cabins;

CREATE TRIGGER trg_cabins_updated_at
  BEFORE UPDATE ON cabins
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

/* ─────────────────────────────────────────────
   6. Доп. услуги в бронировании (booking_extra_services)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS booking_extra_services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id        UUID NOT NULL REFERENCES extra_services(id) ON DELETE RESTRICT,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  price_at_booking  INTEGER NOT NULL CHECK (price_at_booking >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bes_booking ON booking_extra_services (booking_id);
CREATE INDEX IF NOT EXISTS idx_bes_service ON booking_extra_services (service_id);

COMMENT ON TABLE booking_extra_services IS 'Дополнительные услуги, привязанные к конкретной брони';
COMMENT ON COLUMN booking_extra_services.price_at_booking IS 'Цена услуги в рублях, зафиксированная на момент бронирования';

/* ─────────────────────────────────────────────
   7. Чат-логи (chat_logs)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS chat_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_type   VARCHAR(10) NOT NULL CHECK (sender_type IN ('guest', 'admin')),
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_booking ON chat_logs (booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_logs (booking_id, is_read) WHERE is_read = false;

COMMENT ON TABLE chat_logs IS 'Сообщения чата между гостем и администратором (Supabase Realtime)';

/* ─────────────────────────────────────────────
   8. Заметки о гостях (guest_notes)
   ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS guest_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id    UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_notes_guest ON guest_notes (guest_id);

COMMENT ON TABLE guest_notes IS 'Внутренние заметки администратора о гостях';
