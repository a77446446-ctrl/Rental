const dataStore = require('./dataStore.service');

const DEFAULT_BRAND_NAME = 'Платформа для аренды';

async function getSiteBrand() {
  const mainpage = await dataStore.get('mainpage', 'mainpage.json', {});
  return {
    name: String(mainpage?.logo?.text || '').trim() || DEFAULT_BRAND_NAME,
    logoUrl: String(mainpage?.logo?.url || ''),
    description: String(mainpage?.hero?.desc || '').trim(),
  };
}

module.exports = { DEFAULT_BRAND_NAME, getSiteBrand };
