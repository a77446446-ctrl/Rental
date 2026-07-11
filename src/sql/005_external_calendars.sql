/*
 * 005_external_calendars.sql
 * Внешние iCal-календари и блокировки дат от Avito, Суточно, Островок,
 * Яндекс.Путешествий и других агрегаторов.
 */

CREATE TABLE IF NOT EXISTS external_calendar_sources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabin_id         UUID NOT NULL REFERENCES cabins(id) ON DELETE CASCADE,
  source_name      VARCHAR(80) NOT NULL,
  ical_url         TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_synced_at   TIMESTAMPTZ,
  last_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (last_sync_status IN ('pending', 'success', 'error')),
  last_sync_error  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_calendar_sources_cabin
  ON external_calendar_sources (cabin_id);

CREATE INDEX IF NOT EXISTS idx_external_calendar_sources_active
  ON external_calendar_sources (is_active)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS external_bookings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id      UUID NOT NULL REFERENCES external_calendar_sources(id) ON DELETE CASCADE,
  cabin_id       UUID NOT NULL REFERENCES cabins(id) ON DELETE CASCADE,
  external_uid   TEXT NOT NULL,
  source_name    VARCHAR(80) NOT NULL,
  summary        TEXT,
  check_in       DATE NOT NULL,
  check_out      DATE NOT NULL,
  raw_event      JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_external_booking_dates CHECK (check_out > check_in),
  CONSTRAINT uq_external_bookings_source_uid UNIQUE (source_id, external_uid)
);

CREATE INDEX IF NOT EXISTS idx_external_bookings_cabin_dates
  ON external_bookings (cabin_id, check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_external_bookings_source
  ON external_bookings (source_id);

DROP TRIGGER IF EXISTS trg_external_calendar_sources_updated_at ON external_calendar_sources;
CREATE TRIGGER trg_external_calendar_sources_updated_at
  BEFORE UPDATE ON external_calendar_sources
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_external_bookings_updated_at ON external_bookings;
CREATE TRIGGER trg_external_bookings_updated_at
  BEFORE UPDATE ON external_bookings
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

COMMENT ON TABLE external_calendar_sources IS 'iCal-источники занятости по домикам: Avito, Суточно, Островок, Яндекс.Путешествия и др.';
COMMENT ON TABLE external_bookings IS 'Внешние занятые даты, импортированные из iCal-календарей';
COMMENT ON COLUMN external_bookings.check_in IS 'Дата заезда/начала занятости включительно';
COMMENT ON COLUMN external_bookings.check_out IS 'Дата выезда/окончания занятости исключительно';
