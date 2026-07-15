const { supabaseAdmin } = require('../../config/supabase');
const externalCalendarService = require('../../services/externalCalendar.service');
const storageService = require('../../services/storage.service');
const dataStore = require('../../services/dataStore.service');

const IMAGE_CATEGORIES = new Set(['main', 'interior', 'exterior']);

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.slice(0, 20).map((image) => {
    const url = String(image && image.url || '').trim();
    if (!url || url.length > 2000) throw new Error('Некорректная ссылка фотографии');
    const category = IMAGE_CATEGORIES.has(image.category) ? image.category : 'interior';
    const storagePath = storageService.extractStoragePath(image.storage_path || url);
    return {
      url,
      category,
      ...(storagePath && storageService.isCabinPath(storagePath) ? { storage_path: storagePath } : {}),
    };
  });
}

function parseStoredImages(row) {
  return (row && row.images_urls || []).map((value) => {
    try { return JSON.parse(value); } catch (_err) { return { url: value, category: 'main' }; }
  });
}

async function cleanupRemovedImages(previous, next) {
  const nextPaths = new Set(next.map((image) => storageService.extractStoragePath(image.storage_path || image.url)).filter(Boolean));
  const removed = previous
    .map((image) => storageService.extractStoragePath(image.storage_path || image.url))
    .filter((storagePath) => storagePath && !nextPaths.has(storagePath));
  if (!removed.length) return;
  try { await storageService.deleteImages(removed); }
  catch (err) { console.error('[cabins.controller] Не удалось очистить удаленные фото:', err.message); }
}

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

exports.saveFull = async (req, res) => {
  try {
    const body = req.body || {};
    const cabinId = body.id && body.id !== 'new' ? body.id : null;
    const normalizedImages = normalizeImages(body.images || []);
    const selectedAmenities = Array.isArray(body.selectedAmenities) ? body.selectedAmenities.map(String) : [];
    const selectedTags = Array.isArray(body.selectedTags) ? body.selectedTags.map(String) : [];
    const sources = Array.isArray(body.externalCalendars) ? body.externalCalendars : [];
    let previousImages = [];

    if (cabinId) {
      const previous = await supabaseAdmin.from('cabins').select('images_urls').eq('id', cabinId).single();
      if (previous.error || !previous.data) return res.status(404).json({ success: false, error: 'Домик не найден' });
      previousImages = parseStoredImages(previous.data);
    }

    const params = {
      p_cabin_id: cabinId,
      p_name: String(body.name || '').trim(),
      p_description: String(body.description || ''),
      p_base_price: Number.parseInt(body.base_price, 10),
      p_capacity: Number.parseInt(body.capacity, 10),
      p_is_active: body.status === 'active',
      p_images: normalizedImages,
      p_amenities: selectedAmenities,
      p_tags: selectedTags,
      p_sources: sources,
    };

    let saved;
    const rpc = await supabaseAdmin.rpc('save_cabin_full', params);
    if (!rpc.error) {
      saved = rpc.data;
    } else if (rpc.error.code === 'PGRST202' || rpc.error.code === '42883' || String(rpc.error.message).includes('save_cabin_full') || String(rpc.error.message).includes('uuid_generate_v4')) {
      console.warn('[cabins.controller] Миграция 006 не применена; используется совместимый режим сохранения.');
      const row = {
        name: params.p_name,
        description: params.p_description,
        base_price: params.p_base_price,
        capacity: params.p_capacity,
        is_active: params.p_is_active,
        images_urls: normalizedImages.map((image) => JSON.stringify(image)),
      };
      let result;
      if (cabinId) {
        result = await supabaseAdmin.from('cabins').update(row).eq('id', cabinId).select().single();
      } else {
        row.slug = `house-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        result = await supabaseAdmin.from('cabins').insert([row]).select().single();
      }
      if (result.error) throw result.error;
      saved = result.data;
      const savedId = saved.id;
      await dataStore.update('amenities', 'amenities.json', {}, (current) => ({ ...current, [savedId]: selectedAmenities }));
      await dataStore.update('cabin_tags', 'cabin_tags.json', {}, (current) => ({ ...current, [savedId]: selectedTags }));
      await externalCalendarService.saveSources(savedId, sources);
    } else {
      throw rpc.error;
    }

    await cleanupRemovedImages(previousImages, normalizedImages);
    saved.images = normalizedImages;
    saved.image_url = normalizedImages[0] ? normalizedImages[0].url : '';
    saved.status = saved.is_active ? 'active' : 'hidden';
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[cabins.controller] POST /cabins/save-full error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка сохранения домика' });
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
      images_urls = normalizeImages(images).map(img => JSON.stringify(img));
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

    const { data: previousCabin, error: previousError } = await supabaseAdmin
      .from('cabins').select('images_urls').eq('id', id).single();
    if (previousError || !previousCabin) return res.status(404).json({ success: false, error: 'Домик не найден' });

    let normalizedImages = [];
    let images_urls = [];
    if (images && Array.isArray(images)) {
      normalizedImages = normalizeImages(images);
      images_urls = normalizedImages.map(img => JSON.stringify(img));
    } else if (image_url) {
      normalizedImages = normalizeImages([{ url: image_url, category: 'main' }]);
      images_urls = normalizedImages.map(img => JSON.stringify(img));
    }
    const is_active = (status === 'active');

    const { data, error } = await supabaseAdmin
      .from('cabins')
      .update({ name, description, base_price, capacity, is_active, images_urls })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await cleanupRemovedImages(parseStoredImages(previousCabin), normalizedImages);
    
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
    const { data: previousCabin, error: findError } = await supabaseAdmin
      .from('cabins').select('images_urls').eq('id', id).single();
    if (findError || !previousCabin) return res.status(404).json({ success: false, error: 'Домик не найден' });
    const { error } = await supabaseAdmin
      .from('cabins')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await cleanupRemovedImages(parseStoredImages(previousCabin), []);
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

    const uploaded = await storageService.uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({ success: true, url: uploaded.url, path: uploaded.path });
  } catch (err) {
    console.error('[cabins.controller] POST /upload error:', err);
    res.status(500).json({ success: false, error: 'Ошибка при загрузке файла' });
  }
};

exports.removeUploadedImage = async (req, res) => {
  try {
    const storagePath = String(req.body && req.body.path || '');
    if (!storageService.isCabinPath(storagePath)) {
      return res.status(400).json({ success: false, error: 'Некорректный путь файла' });
    }
    await storageService.deleteImages([storagePath]);
    res.json({ success: true });
  } catch (err) {
    console.error('[cabins.controller] DELETE /uploads/images error:', err);
    res.status(500).json({ success: false, error: 'Не удалось удалить файл' });
  }
};
