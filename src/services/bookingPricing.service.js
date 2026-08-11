const { pbAdmin } = require('../config/pocketbase');
const dataStore = require('./dataStore.service');
const { validateStay, validateUuid } = require('../utils/validation');
const { normalizePriceRecord } = require('../utils/priceRecord');

function dateStrings(checkIn, nights) {
  const result = [];
  const current = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < nights; i += 1) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

async function calculateBookingTotal({ cabinId, checkIn, checkOut, guestsCount, extraIds = [] }) {
  if (!pbAdmin) throw new Error('Сервис базы данных временно недоступен');
  validateUuid(cabinId, 'Домик');
  const { nights } = validateStay(checkIn, checkOut);

  let cabin;
  try {
    cabin = await pbAdmin.collection('cabins').getOne(cabinId);
  } catch (cabinError) {
    throw new Error('Домик не найден или временно недоступен');
  }

  if (!cabin.is_active) throw new Error('Домик временно недоступен');

  const normalizedGuests = Math.max(1, Number.parseInt(guestsCount, 10) || 1);
  if (normalizedGuests > Number(cabin.capacity || 1)) {
    throw new Error(`В домике «${cabin.name}» максимум ${cabin.capacity} гостей`);
  }

  let prices = [];
  try {
    const result = await pbAdmin.collection('prices').getFullList({
      filter: `cabin_id="${cabinId}" && date>="${checkIn} 00:00:00.000Z" && date<"${checkOut} 00:00:00.000Z"`
    });
    prices = result.map(normalizePriceRecord);
  } catch (pricesError) {
    throw new Error('Не удалось проверить актуальные цены');
  }
  const priceMap = new Map((prices || []).map((row) => [row.date, row]));

  let rentPrice = 0;
  for (const date of dateStrings(checkIn, nights)) {
    const special = priceMap.get(date);
    if (special && special.promo_description === 'CLOSED') {
      throw new Error(`Дата ${date} закрыта для бронирования`);
    }
    rentPrice += Number(special ? special.custom_price : cabin.base_price);
  }

  const allServices = await dataStore.get('extra_services', 'extra_services.json', []);
  const uniqueIds = [...new Set((Array.isArray(extraIds) ? extraIds : []).map(String))];
  const extrasSnapshot = [];

  for (const id of uniqueIds) {
    const service = allServices.find((item) => String(item.id) === id && item.is_active !== false);
    if (!service) throw new Error('Одна из выбранных услуг больше недоступна. Обновите страницу.');
    const price = Math.max(0, Math.round(Number(service.price) || 0));
    // Сохраняем исторически действующее поведение интерфейса: каждая выбранная
    // услуга добавляется один раз. price_type фиксируется для будущего перехода.
    extrasSnapshot.push({
      id: String(service.id),
      name: String(service.name || ''),
      price,
      price_type: service.price_type || 'per_booking',
    });
  }

  const extrasPrice = extrasSnapshot.reduce((sum, item) => sum + item.price, 0);
  return {
    cabin,
    nights,
    guestsCount: normalizedGuests,
    rentPrice,
    extrasPrice,
    totalPrice: rentPrice + extrasPrice,
    extrasSnapshot,
  };
}

module.exports = { calculateBookingTotal, dateStrings };
