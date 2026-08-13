const dataStore = require('./dataStore.service');

const AMENITIES_STORE = ['amenities', 'amenities.json', {}];
const CABIN_TAGS_STORE = ['cabin_tags', 'cabin_tags.json', {}];

function normalizeSelections(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 100);
}

async function updateCabinMap(store, cabinId, values) {
  const id = String(cabinId || '').trim();
  if (!id) throw new Error('Не указан объект для сохранения характеристик');
  const normalized = normalizeSelections(values);
  await dataStore.update(...store, (current) => {
    current[id] = normalized;
    return current;
  });
  return normalized;
}

async function saveCabinSelections(cabinId, amenities, tags) {
  const [savedAmenities, savedTags] = await Promise.all([
    updateCabinMap(AMENITIES_STORE, cabinId, amenities),
    updateCabinMap(CABIN_TAGS_STORE, cabinId, tags),
  ]);
  return { amenities: savedAmenities, tags: savedTags };
}

async function removeCabinSelections(cabinId) {
  const id = String(cabinId || '').trim();
  if (!id) return;
  await Promise.all([AMENITIES_STORE, CABIN_TAGS_STORE].map((store) =>
    dataStore.update(...store, (current) => {
      delete current[id];
      return current;
    })
  ));
}

module.exports = {
  normalizeSelections,
  saveCabinSelections,
  removeCabinSelections,
};