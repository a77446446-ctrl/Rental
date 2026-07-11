const { supabaseAdmin } = require('../../config/supabase');
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
