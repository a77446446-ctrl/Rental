migrate((app) => {
  const db = app.db();
  for (const name of ['cabins', 'bookings', 'chat_logs']) {
    const collection = app.findCollectionByNameOrId(name);
    let changed = false;
    if (!collection.fields.getByName('created')) {
      collection.fields.add(new AutodateField({ name: 'created', onCreate: true }));
      changed = true;
    }
    if (name === 'bookings' && !collection.fields.getByName('updated')) {
      collection.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
      changed = true;
    }
    if (changed) app.save(collection);
  }

  // SQLite проверяет пересечения внутри той же операции записи, включая разные процессы Node.js.
  for (const [operation, event] of [
    ['insert', 'INSERT'],
    ['update', 'UPDATE OF cabin_id, check_in_date, check_out_date, status'],
  ]) {
    const changed = operation === 'update'
      ? `AND (OLD.cabin_id <> NEW.cabin_id OR OLD.check_in_date <> NEW.check_in_date
              OR OLD.check_out_date <> NEW.check_out_date OR OLD.status <> NEW.status)`
      : '';
    db.newQuery(`
      CREATE TRIGGER IF NOT EXISTS eco_bookings_guard_${operation}
      BEFORE ${event} ON bookings
      WHEN NEW.status IN ('pending', 'confirmed') ${changed}
      BEGIN
        SELECT RAISE(ABORT, 'eco_invalid_booking_dates')
        WHERE NEW.check_out_date <= NEW.check_in_date;

        SELECT RAISE(ABORT, 'eco_booking_dates_occupied')
        WHERE EXISTS (
          SELECT 1 FROM bookings AS booking
          WHERE booking.cabin_id = NEW.cabin_id
            AND booking.id <> NEW.id
            AND booking.status IN ('pending', 'confirmed')
            AND booking.check_in_date < NEW.check_out_date
            AND booking.check_out_date > NEW.check_in_date
        ) OR EXISTS (
          SELECT 1 FROM external_bookings AS booking
          JOIN external_calendar_sources AS source ON source.id = booking.source_id
          WHERE source.cabin_id = NEW.cabin_id AND source.is_active = TRUE
            AND booking.check_in_date < NEW.check_out_date
            AND booking.check_out_date > NEW.check_in_date
        ) OR EXISTS (
          SELECT 1 FROM prices
          WHERE prices.cabin_id = NEW.cabin_id AND prices.promo_description = 'CLOSED'
            AND prices.date >= NEW.check_in_date AND prices.date < NEW.check_out_date
        );
      END
    `).execute();
  }
  db.newQuery(`
    INSERT INTO app_config (id, key, value)
    SELECT 'ecobookguardv01', 'booking_protection_v1', 'true'
    WHERE NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'booking_protection_v1')
  `).execute();
}, (app) => {
  app.db().newQuery('DROP TRIGGER IF EXISTS eco_bookings_guard_insert').execute();
  app.db().newQuery('DROP TRIGGER IF EXISTS eco_bookings_guard_update').execute();
  app.db().newQuery("DELETE FROM app_config WHERE key = 'booking_protection_v1'").execute();
});
