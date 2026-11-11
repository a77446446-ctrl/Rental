'use strict';

const { toDateOnly } = require('./bookingRecord');

function normalizePriceRecord(record) {
  if (!record || typeof record !== 'object') return record;

  const desc = record.promo_description != null ? String(record.promo_description).trim() : '';
  const isPromo = Boolean(
    record.is_promo === true ||
    record.is_promo === 1 ||
    record.is_promo === 'true' ||
    (desc && desc !== 'CLOSED')
  );

  return {
    ...record,
    date: toDateOnly(record.date),
    is_promo: isPromo,
    promo_description: desc,
    custom_price: record.custom_price != null ? Number(record.custom_price) : 0,
  };
}

module.exports = { normalizePriceRecord };
