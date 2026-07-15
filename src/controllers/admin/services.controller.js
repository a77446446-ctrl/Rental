const crypto = require('crypto');
const dataStore = require('../../services/dataStore.service');

const EXTRA = ['extra_services', 'extra_services.json', []];
const ITEMS = ['house_items', 'house_items.json', []];

function sortRows(rows) {
  return rows.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}

function servicePayload(body, previous = {}) {
  const name = String(body.name == null ? previous.name || '' : body.name).trim();
  if (!name) throw new Error('Название обязательно');
  const price = Number(body.price == null ? previous.price || 0 : body.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Некорректная цена');
  return {
    ...previous,
    name: name.slice(0, 255),
    description: String(body.description == null ? previous.description || '' : body.description).trim().slice(0, 2000),
    price: Math.round(price),
    price_type: ['per_booking', 'per_day', 'per_person'].includes(body.price_type)
      ? body.price_type
      : previous.price_type || 'per_booking',
    is_active: body.is_active !== false,
    sort_order: Number(body.sort_order) || previous.sort_order || 0,
  };
}

exports.getExtraServices = async (_req, res) => {
  try {
    res.json({ success: true, data: sortRows(await dataStore.get(...EXTRA)) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки услуг' });
  }
};

exports.createExtraService = async (req, res) => {
  try {
    const created = servicePayload(req.body);
    created.id = crypto.randomUUID();
    await dataStore.update(...EXTRA, (rows) => {
      rows.push(created);
      return rows;
    });
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Ошибка создания услуги' });
  }
};

exports.updateExtraService = async (req, res) => {
  try {
    let updated;
    await dataStore.update(...EXTRA, (rows) => {
      const index = rows.findIndex((row) => String(row.id) === String(req.params.id));
      if (index === -1) throw new Error('Услуга не найдена');
      updated = servicePayload(req.body, rows[index]);
      rows[index] = updated;
      return rows;
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.message === 'Услуга не найдена' ? 404 : 400).json({ success: false, error: err.message });
  }
};

exports.removeExtraService = async (req, res) => {
  try {
    await dataStore.update(...EXTRA, (rows) => rows.filter((row) => String(row.id) !== String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка удаления услуги' });
  }
};

exports.getHouseItems = async (_req, res) => {
  try {
    res.json({ success: true, data: sortRows(await dataStore.get(...ITEMS)) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения домика' });
  }
};

function itemPayload(body, previous = {}, fallbackOrder = 0) {
  const name = String(body.name == null ? previous.name || '' : body.name).trim();
  if (!name) throw new Error('Название обязательно');
  return {
    ...previous,
    name: name.slice(0, 255),
    is_active: body.is_active !== false,
    sort_order: Number(body.sort_order) || previous.sort_order || fallbackOrder,
    icon: String(body.icon || previous.icon || 'check').replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'check',
  };
}

exports.createHouseItem = async (req, res) => {
  try {
    let created;
    await dataStore.update(...ITEMS, (rows) => {
      created = itemPayload(req.body, {}, rows.length + 1);
      created.id = crypto.randomUUID();
      rows.push(created);
      return rows;
    });
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Ошибка создания пункта' });
  }
};

exports.updateHouseItem = async (req, res) => {
  try {
    let updated;
    await dataStore.update(...ITEMS, (rows) => {
      const index = rows.findIndex((row) => String(row.id) === String(req.params.id));
      if (index === -1) throw new Error('Пункт не найден');
      updated = itemPayload(req.body, rows[index]);
      rows[index] = updated;
      return rows;
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.message === 'Пункт не найден' ? 404 : 400).json({ success: false, error: err.message });
  }
};

exports.removeHouseItem = async (req, res) => {
  try {
    await dataStore.update(...ITEMS, (rows) => rows.filter((row) => String(row.id) !== String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка удаления пункта наполнения' });
  }
};
