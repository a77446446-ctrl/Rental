const dataStore = require('../../services/dataStore.service');

const STORES = {
  settings: ['settings', 'settings.json', { checkInTime: '16:00', checkOutTime: '14:00' }],
  amenities: ['amenities', 'amenities.json', {}],
  mainpage: ['mainpage', 'mainpage.json', {}],
  tags: ['tags', 'tags.json', []],
  cabinTags: ['cabin_tags', 'cabin_tags.json', {}],
};

async function read(store) {
  return dataStore.get(store[0], store[1], store[2]);
}

async function write(store, value) {
  return dataStore.set(store[0], store[1], value);
}

exports.getSettings = async (_req, res) => {
  try {
    res.json({ success: true, data: await read(STORES.settings) });
  } catch (err) {
    console.error('[settings.controller] GET /settings error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки настроек' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const current = await read(STORES.settings);
    const next = { ...current, ...req.body };
    await write(STORES.settings, next);
    res.json({ success: true, data: next });
  } catch (err) {
    console.error('[settings.controller] POST /settings error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения настроек' });
  }
};

exports.getAmenities = async (_req, res) => {
  try {
    res.json({ success: true, data: await read(STORES.amenities) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения' });
  }
};

exports.updateAmenities = async (req, res) => {
  try {
    const { cabinId, selectedAmenities } = req.body;
    if (!cabinId || !Array.isArray(selectedAmenities)) {
      return res.status(400).json({ success: false, error: 'Некорректные данные наполнения' });
    }
    const next = await dataStore.update(...STORES.amenities, (current) => {
      current[cabinId] = selectedAmenities.map(String).slice(0, 100);
      return current;
    });
    res.json({ success: true, data: next[cabinId] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения наполнения' });
  }
};

exports.getMainpage = async (_req, res) => {
  try {
    res.json({ success: true, data: await read(STORES.mainpage) });
  } catch (err) {
    console.error('[settings.controller] GET /mainpage error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки главной страницы' });
  }
};

exports.updateMainpage = async (req, res) => {
  try {
    const previous = await read(STORES.mainpage);
    const next = {
      ...previous,
      ...req.body,
      contacts: { ...(previous.contacts || {}), ...(req.body.contacts || {}) },
      features_meta: req.body.features_meta || previous.features_meta || { label: '', title: '' },
      reviews_meta: req.body.reviews_meta || previous.reviews_meta || { label: '', title: '' },
    };
    await write(STORES.mainpage, next);
    res.json({ success: true, data: next });
  } catch (err) {
    console.error('[settings.controller] POST /mainpage error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения главной страницы' });
  }
};

exports.getTags = async (_req, res) => {
  try {
    res.json({ success: true, data: await read(STORES.tags) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов' });
  }
};

exports.updateTags = async (req, res) => {
  try {
    if (!Array.isArray(req.body.tags)) {
      return res.status(400).json({ success: false, error: 'Ожидается массив тегов' });
    }
    const tags = req.body.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 100);
    await write(STORES.tags, tags);
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения тегов' });
  }
};

exports.getCabinTags = async (_req, res) => {
  try {
    res.json({ success: true, data: await read(STORES.cabinTags) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов домиков' });
  }
};

exports.updateCabinTags = async (req, res) => {
  try {
    const { cabinId, selectedTags } = req.body;
    if (!cabinId || !Array.isArray(selectedTags)) {
      return res.status(400).json({ success: false, error: 'Некорректные данные тегов' });
    }
    const next = await dataStore.update(...STORES.cabinTags, (current) => {
      current[cabinId] = selectedTags.map(String).slice(0, 100);
      return current;
    });
    res.json({ success: true, data: next[cabinId] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения тегов домика' });
  }
};
