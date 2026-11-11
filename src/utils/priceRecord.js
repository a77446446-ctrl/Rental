'use strict';

const { toDateOnly } = require('./bookingRecord');

function normalizePriceRecord(record) {
  if (!record || typeof record !== 'object') return record;

  const isPromo = record.is_promo === true || record.is_promo === 1 || record.is_promo === 'true';

  return {
    ...record,
    date: toDateOnly(record.date),
    is_promo: isPromo,
    promo_description: record.promo_description != null ? String(record.promo_description) : '',
    custom_price: record.custom_price != null ? Number(record.custom_price) : 0,
  };
}

module.exports = { normalizePriceRecord };
