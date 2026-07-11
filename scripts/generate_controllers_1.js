const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../src/controllers/admin');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const files = {
  'auth.controller.js': `const { config } = require('../../config/env');

exports.login = (req, res) => {
  const { username, password } = req.body;
  if (username === config.adminUsername && password === config.adminPassword) {
    res.cookie('eco_admin_session', 'authenticated', {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      signed: true,
      maxAge: config.sessionTtlHours * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    return res.json({ success: true });
  }
  return res.status(401).json({
    success: false,
    error: 'Неверный логин или пароль',
  });
};

exports.logout = (req, res) => {
  res.clearCookie('eco_admin_session', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    signed: true,
    sameSite: 'lax',
  });
  res.json({ success: true });
};

exports.me = (req, res) => {
  res.json({ success: true, user: config.adminUsername });
};
`,
  'cabins.controller.js': `const { supabaseAdmin } = require('../../config/supabase');
const externalCalendarService = require('../../services/externalCalendar.service');
const storageService = require('../../services/storage.service');

exports.getAll = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cabins')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    const sourcesByCabin = await externalCalendarService.getSourcesForCabins((data || []).map(c => c.id));
    
    const mappedData = data.map(c => ({
      ...c,
      image_url: c.images_urls && c.images_urls.length > 0 ? (() => {
        try { const p = JSON.parse(c.images_urls[0]); return p.url || c.images_urls[0]; }
        catch(e) { return c.images_urls[0]; }
      })() : '',
      images: (c.images_urls || []).map(str => {
        try { return JSON.parse(str); }
        catch(e) { return { url: str, category: 'main' }; }
      }),
      status: c.is_active ? 'active' : 'hidden',
      external_calendars: sourcesByCabin[c.id] || []
    }));
    
    res.json({ success: true, data: mappedData });
  } catch (err) {
    console.error('[cabins.controller] GET /cabins error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, base_price, capacity, status, images, image_url } = req.body;
    
    const ru = 'а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я'.split(' ');
    const en = 'a b v g d e e zh z i y k l m n o p r s t u f h ts ch sh shch  y  e yu ya'.split(' ');
    let slugStr = (name || 'house').toLowerCase();
    for (let i = 0; i < ru.length; i++) {
      slugStr = slugStr.split(ru[i]).join(en[i]);
    }
    const slug = slugStr.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    let images_urls = [];
    if (images && Array.isArray(images)) {
      images_urls = images.map(img => JSON.stringify(img));
    } else if (image_url) {
      images_urls = [JSON.stringify({ url: image_url, category: 'main' })];
    }
    const is_active = (status === 'active');

    const { data, error } = await supabaseAdmin
      .from('cabins')
      .insert([{ name, slug, description, base_price, capacity, is_active, images_urls }])
      .select()
      .single();

    if (error) throw error;
    
    data.images = (data.images_urls || []).map(str => { try { return JSON.parse(str) } catch(e) { return {url: str, category: 'main'}; } });
    data.image_url = data.images.length > 0 ? data.images[0].url : '';
    data.status = data.is_active ? 'active' : 'hidden';
    res.json({ success: true, data });
  } catch (err) {
    console.error('[cabins.controller] POST /cabins error:', err);
    res.status(500).json({ success: false, error: 'Ошибка при создании домика: ' + (err.message || err) });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, capacity, status, images, image_url } = req.body;

    let images_urls = [];
    if (images && Array.isArray(images)) {
      images_urls = images.map(img => JSON.stringify(img));
    } else if (image_url) {
      images_urls = [JSON.stringify({ url: image_url, category: 'main' })];
    }
    const is_active = (status === 'active');

    const { data, error } = await supabaseAdmin
      .from('cabins')
      .update({ name, description, base_price, capacity, is_active, images_urls })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    data.images = (data.images_urls || []).map(str => { try { return JSON.parse(str) } catch(e) { return {url: str, category: 'main'}; } });
    data.image_url = data.images.length > 0 ? data.images[0].url : '';
    data.status = data.is_active ? 'active' : 'hidden';
    res.json({ success: true, data });
  } catch (err) {
    console.error('[cabins.controller] PATCH /cabins error:', err);
    res.status(500).json({ success: false, error: 'Ошибка при обновлении домика' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('cabins')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[cabins.controller] DELETE /cabins error:', err);
    res.status(500).json({ success: false, error: 'Ошибка при удалении домика' });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не передан' });
    }

    const publicUrl = await storageService.uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('[cabins.controller] POST /upload error:', err);
    res.status(500).json({ success: false, error: 'Ошибка при загрузке файла' });
  }
};
`,
  'calendars.controller.js': `const externalCalendarService = require('../../services/externalCalendar.service');

exports.getSources = async (req, res) => {
  try {
    const sources = await externalCalendarService.getSources(req.params.id);
    res.json({ success: true, data: sources });
  } catch (err) {
    console.error('[calendars.controller] GET /cabins external calendars error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: 'Ошибка загрузки внешних календарей' });
  }
};

exports.saveSources = async (req, res) => {
  try {
    const sources = await externalCalendarService.saveSources(req.params.id, req.body.sources || []);
    res.json({ success: true, data: sources });
  } catch (err) {
    console.error('[calendars.controller] POST /cabins external calendars error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: err.message || 'Ошибка сохранения внешних календарей' });
  }
};

exports.syncSource = async (req, res) => {
  try {
    const result = await externalCalendarService.syncSourceById(req.params.sourceId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[calendars.controller] POST /external-calendars sync error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: err.message || 'Ошибка синхронизации календаря' });
  }
};

exports.syncAll = async (req, res) => {
  try {
    const result = await externalCalendarService.syncAllActiveSources();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[calendars.controller] POST /external-calendars sync-all error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: 'Ошибка синхронизации календарей' });
  }
};
`,
  'services.controller.js': `const fs = require('fs');
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
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, filename), content);
}
console.log('Created first batch of controllers.');
