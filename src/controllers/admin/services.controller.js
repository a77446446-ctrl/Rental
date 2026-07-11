const fs = require('fs');
const path = require('path');
const extraServicesPath = path.join(__dirname, '../../data/extra_services.json');
const houseItemsPath = path.join(__dirname, '../../data/house_items.json');

exports.getExtraServices = async (req, res) => {
  try {
    let services = [];
    if (fs.existsSync(extraServicesPath)) {
      services = JSON.parse(fs.readFileSync(extraServicesPath, 'utf8'));
    }
    services.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: services });
  } catch (err) {
    console.error('[services.controller] GET /extra-services error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения' });
  }
};

exports.createExtraService = async (req, res) => {
  try {
    const { name, description, price, price_type, is_active, sort_order } = req.body;
    let services = [];
    if (fs.existsSync(extraServicesPath)) {
      services = JSON.parse(fs.readFileSync(extraServicesPath, 'utf8'));
    }
    const newService = {
      id: Date.now().toString(),
      name, description, price, price_type, is_active, sort_order: sort_order || 0
    };
    services.push(newService);
    fs.writeFileSync(extraServicesPath, JSON.stringify(services, null, 2));
    res.json({ success: true, data: newService });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка создания услуги' });
  }
};

exports.updateExtraService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, price_type, is_active, sort_order } = req.body;
    let services = [];
    if (fs.existsSync(extraServicesPath)) {
      services = JSON.parse(fs.readFileSync(extraServicesPath, 'utf8'));
    }
    const idx = services.findIndex(s => s.id == id);
    if (idx === -1) throw new Error('Услуга не найдена');
    
    services[idx] = { ...services[idx], name, description, price, price_type, is_active, sort_order };
    fs.writeFileSync(extraServicesPath, JSON.stringify(services, null, 2));
    res.json({ success: true, data: services[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка обновления услуги' });
  }
};

exports.removeExtraService = async (req, res) => {
  try {
    const { id } = req.params;
    let services = [];
    if (fs.existsSync(extraServicesPath)) {
      services = JSON.parse(fs.readFileSync(extraServicesPath, 'utf8'));
    }
    services = services.filter(s => s.id != id);
    fs.writeFileSync(extraServicesPath, JSON.stringify(services, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка удаления услуги' });
  }
};

exports.getHouseItems = async (req, res) => {
  try {
    let items = [];
    if (fs.existsSync(houseItemsPath)) {
      items = JSON.parse(fs.readFileSync(houseItemsPath, 'utf8'));
    }
    items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения домика' });
  }
};

exports.createHouseItem = async (req, res) => {
  try {
    const { name, is_active, sort_order } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Название обязательно' });
    }

    let items = [];
    if (fs.existsSync(houseItemsPath)) {
      items = JSON.parse(fs.readFileSync(houseItemsPath, 'utf8'));
    }

    const newItem = {
      id: Date.now().toString(),
      name: String(name).trim(),
      is_active: is_active !== false,
      sort_order: Number(sort_order) || items.length + 1
    };

    items.push(newItem);
    fs.writeFileSync(houseItemsPath, JSON.stringify(items, null, 2));
    res.json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка создания пункта наполнения' });
  }
};

exports.updateHouseItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active, sort_order } = req.body;
    let items = [];
    if (fs.existsSync(houseItemsPath)) {
      items = JSON.parse(fs.readFileSync(houseItemsPath, 'utf8'));
    }

    const idx = items.findIndex(item => item.id == id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Пункт не найден' });
    }

    items[idx] = {
      ...items[idx],
      name: String(name || items[idx].name).trim(),
      is_active: is_active !== false,
      sort_order: Number(sort_order) || items[idx].sort_order || 0
    };

    fs.writeFileSync(houseItemsPath, JSON.stringify(items, null, 2));
    res.json({ success: true, data: items[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка обновления пункта наполнения' });
  }
};

exports.removeHouseItem = async (req, res) => {
  try {
    const { id } = req.params;
    let items = [];
    if (fs.existsSync(houseItemsPath)) {
      items = JSON.parse(fs.readFileSync(houseItemsPath, 'utf8'));
    }
    items = items.filter(item => item.id != id);
    fs.writeFileSync(houseItemsPath, JSON.stringify(items, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка удаления пункта наполнения' });
  }
};
