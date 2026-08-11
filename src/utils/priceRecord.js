'use strict';

const { toDateOnly } = require('./bookingRecord');

function normalizePriceRecord(record) {
  if (!record || typeof record !== 'object') return record;

  return {
    ...record,
    date: toDateOnly(record.date),
  };
}

module.exports = { normalizePriceRecord };
