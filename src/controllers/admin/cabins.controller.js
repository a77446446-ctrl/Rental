const { pbAdmin } = require('../../config/pocketbase');
const externalCalendarService = require('../../services/externalCalendar.service');
const storageService = require('../../services/storage.service');

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
  return Array.isArray(row?.images) ? row.images : [];
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
    const data = await pbAdmin.collection('cabins').getFullList({
      sort: 'created'
    });

    const sourcesByCabin = await externalCalendarService.getSourcesForCabins((data || []).map(c => c.id));
    
    const mappedData = data.map(c => {
      const imagesArray = Array.isArray(c.images) ? c.images : [];
      return {
        ...c,
        image_url: imagesArray.length > 0 ? imagesArray[0].url : '',
        images: imagesArray,
        status: c.is_active ? 'active' : 'hidden',
        external_calendars: sourcesByCabin[c.id] || []
      };
    });
    
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
      try {
        const previous = await pbAdmin.collection('cabins').getOne(cabinId);
        previousImages = parseStoredImages(previous);
      } catch (err) {
        return res.status(404).json({ success: false, error: 'Домик не найден' });
      }
    }

    const row = {
      name: String(body.name || '').trim(),
      description: String(body.description || ''),
      base_price: Number.parseInt(body.base_price, 10) || 0,
      capacity: Number.parseInt(body.capacity, 10) || 1,
      is_active: body.status === 'active',
      images: normalizedImages,
      amenities: selectedAmenities,
      tags: selectedTags
    };

    let saved;
    if (cabinId) {
      saved = await pbAdmin.collection('cabins').update(cabinId, row);
    } else {
      const ru = 'а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я'.split(' ');
      const en = 'a b v g d e e zh z i y k l m n o p r s t u f h ts ch sh shch  y  e yu ya'.split(' ');
      let slugStr = (row.name || 'house').toLowerCase();
      for (let i = 0; i < ru.length; i++) {
        slugStr = slugStr.split(ru[i]).join(en[i]);
      }
      row.slug = slugStr.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
      saved = await pbAdmin.collection('cabins').create(row);
    }

    await externalCalendarService.saveSources(saved.id, sources);

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

    let imagesData = [];
    if (images && Array.isArray(images)) {
      imagesData = normalizeImages(images);
    } else if (image_url) {
      imagesData = normalizeImages([{ url: image_url, category: 'main' }]);
    }
    const is_active = (status === 'active');

    const data = await pbAdmin.collection('cabins').create({
      name, slug, description, base_price, capacity, is_active, images: imagesData
    });

    data.images = Array.isArray(data.images) ? data.images : [];
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

    let previousCabin;
    try {
      previousCabin = await pbAdmin.collection('cabins').getOne(id);
    } catch (err) {
      return res.status(404).json({ success: false, error: 'Домик не найден' });
    }

    let normalizedImages = [];
    if (images && Array.isArray(images)) {
      normalizedImages = normalizeImages(images);
    } else if (image_url) {
      normalizedImages = normalizeImages([{ url: image_url, category: 'main' }]);
    }
    const is_active = (status === 'active');

    const data = await pbAdmin.collection('cabins').update(id, {
      name, description, base_price, capacity, is_active, images: normalizedImages
    });

    await cleanupRemovedImages(parseStoredImages(previousCabin), normalizedImages);
    
    data.images = Array.isArray(data.images) ? data.images : [];
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
    let previousCabin;
    try {
      previousCabin = await pbAdmin.collection('cabins').getOne(id);
    } catch (err) {
      return res.status(404).json({ success: false, error: 'Домик не найден' });
    }
    
    await pbAdmin.collection('cabins').delete(id);
    
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
