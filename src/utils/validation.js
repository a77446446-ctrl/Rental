const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value, { field = 'Поле', required = false, max = 255 } = {}) {
  const text = String(value == null ? '' : value).trim();
  if (required && !text) throw new Error(`${field}: значение обязательно`);
  if (text.length > max) throw new Error(`${field}: не более ${max} символов`);
  return text;
}

function parseDate(value, field) {
  const text = String(value || '');
  if (!DATE_RE.test(text)) throw new Error(`${field}: неверный формат даты`);
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field}: несуществующая дата`);
  }
  return date;
}

function validateStay(checkIn, checkOut) {
  const start = parseDate(checkIn, 'Дата заезда');
  const end = parseDate(checkOut, 'Дата выезда');
  const nights = Math.round((end - start) / 86400000);
  if (nights < 1) throw new Error('Дата выезда должна быть позже даты заезда');
  if (nights > 365) throw new Error('Бронирование не может быть длиннее 365 ночей');
  return { start, end, nights };
}

function validateUuid(value, field = 'Идентификатор') {
  const text = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${field}: неверный формат`);
  }
  return text;
}

module.exports = { cleanText, parseDate, validateStay, validateUuid };
