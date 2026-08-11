'use strict';

function toDateOnly(value) {
  if (!value) return '';
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function normalizeBookingRecord(record) {
  if (!record || typeof record !== 'object') return record;

  return {
    ...record,
    check_in: toDateOnly(record.check_in || record.check_in_date),
    check_out: toDateOnly(record.check_out || record.check_out_date),
  };
}

function toPocketBaseDate(value) {
  const date = toDateOnly(value);
  return date ? date + ' 00:00:00.000Z' : '';
}

module.exports = {
  normalizeBookingRecord,
  toDateOnly,
  toPocketBaseDate,
};
