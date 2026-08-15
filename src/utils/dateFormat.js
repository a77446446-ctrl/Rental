'use strict';

/**
 * Форматирует календарную дату без преобразования часового пояса.
 * Принимает значения YYYY-MM-DD и даты PocketBase с тем же префиксом.
 */
function formatDateRu(value, fallback = '—') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : fallback;
}

module.exports = { formatDateRu };
