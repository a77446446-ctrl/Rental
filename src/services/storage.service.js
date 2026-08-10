const { pbAdmin, pb } = require('../config/pocketbase');
const crypto = require('crypto');

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

function assertImageMime(mimeType) {
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) throw new Error('Допустимы только JPG, PNG, WEBP, AVIF, GIF, MP4 или WEBM');
  return extension;
}

function mediaValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function detectMediaFile(fileBuffer, declaredMime = '') {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 12) {
    throw mediaValidationError('Файл повреждён или имеет неизвестный формат');
  }
  const hex = fileBuffer.subarray(0, 16).toString('hex');
  const ascii = fileBuffer.subarray(0, 16).toString('ascii');
  if (hex.startsWith('ffd8ff')) return { mimeType: 'image/jpeg', extension: 'jpg', mediaType: 'image' };
  if (hex.startsWith('89504e470d0a1a0a')) return { mimeType: 'image/png', extension: 'png', mediaType: 'image' };
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return { mimeType: 'image/gif', extension: 'gif', mediaType: 'image' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mimeType: 'image/webp', extension: 'webp', mediaType: 'image' };
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12).replace(/\0/g, '').trim().toLowerCase();
    // AVIF
    if (/^(avif|avis|mif1|msf1)$/.test(brand)) {
      return { mimeType: 'image/avif', extension: 'avif', mediaType: 'image' };
    }
    // HEIC / HEIF (iPhone photos)
    if (/^(heic|heix|heim|heis|hevc|hevx|hevm|hevs|mif1|msf1)$/.test(brand)) {
      return { mimeType: 'image/heic', extension: 'heic', mediaType: 'image' };
    }
    // If browser/phone declared this as an image, trust it (handles edge-case ftyp brands)
    if (String(declaredMime).startsWith('image/')) {
      const ext = String(declaredMime).split('/')[1] || 'heic';
      return { mimeType: declaredMime, extension: ext.replace('+', ''), mediaType: 'image' };
    }
    // Audio in MP4/M4A container
    const mediaType = String(declaredMime).startsWith('audio/') ? 'audio' : 'video';
    return {
      mimeType: mediaType === 'audio' ? 'audio/mp4' : 'video/mp4',
      extension: mediaType === 'audio' ? 'm4a' : 'mp4',
      mediaType,
    };
  }
  if (hex.startsWith('1a45dfa3')) {
    const mediaType = String(declaredMime).startsWith('audio/') ? 'audio' : 'video';
    return { mimeType: `${mediaType}/webm`, extension: 'webm', mediaType };
  }
  if (ascii.startsWith('OggS')) {
    const mediaType = String(declaredMime).startsWith('video/') ? 'video' : 'audio';
    return { mimeType: `${mediaType}/ogg`, extension: 'ogg', mediaType };
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') {
    return { mimeType: 'audio/wav', extension: 'wav', mediaType: 'audio' };
  }
  if (ascii.startsWith('ID3') || (fileBuffer[0] === 0xff && (fileBuffer[1] & 0xe0) === 0xe0)) {
    return { mimeType: 'audio/mpeg', extension: 'mp3', mediaType: 'audio' };
  }
  throw mediaValidationError('Фактический формат файла не поддерживается');
}

// Автоматическое создание коллекции media при первом запуске, если её нет
async function ensureMediaCollection() {
  if (!pbAdmin) return;
  try {
    await pbAdmin.collections.getOne('media');
  } catch (err) {
    if (err.status === 404) {
      await pbAdmin.collections.create({
        name: 'media',
        type: 'base',
        schema: [
          {
            name: 'file',
            type: 'file',
            maxSelect: 1,
            maxSize: 524288000,
          }
        ]
      });
      console.log('[storage] Коллекция media успешно создана в PocketBase');
    }
  }
}

let mediaCollectionEnsured = false;

async function uploadFileToPB(fileBuffer, mimeType, extension) {
  if (!mediaCollectionEnsured) {
    await ensureMediaCollection();
    mediaCollectionEnsured = true;
  }
  
  const formData = new FormData();
  // В Node.js 18+ FormData и Blob встроены.
  const blob = new Blob([fileBuffer], { type: mimeType });
  const filename = `${crypto.randomUUID()}.${extension}`;
  formData.append('file', blob, filename);

  const record = await pbAdmin.collection('media').create(formData);
  return {
    url: pbAdmin.files.getUrl(record, record.file),
    path: record.id // В PocketBase храним ID записи как путь
  };
}

async function uploadImage(fileBuffer, _originalName, mimeType) {
  if (!pbAdmin) throw new Error('Хранилище временно недоступно');
  assertImageMime(mimeType);
  const detected = detectMediaFile(fileBuffer, mimeType);
  if (detected.mediaType !== 'image' && detected.mediaType !== 'video') throw mediaValidationError('Файл не является изображением или видео');
  
  const result = await uploadFileToPB(fileBuffer, detected.mimeType, detected.extension);
  return result;
}

function extractStoragePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  
  // Для PocketBase ссылки выглядят так: /api/files/media/{record_id}/{filename}
  const match = raw.match(/\/api\/files\/media\/([^\/]+)\//);
  if (match && match[1]) {
    return match[1]; // Возвращаем ID записи
  }
  
  // Легаси Supabase
  const marker = '/storage/v1/object/public/';
  const index = raw.indexOf(marker);
  if (index !== -1) return null; // Старые пути не поддерживаются для удаления
  
  return null;
}

function isCabinPath(value) {
  return extractStoragePath(value) !== null;
}

async function deleteImages(values) {
  if (!pbAdmin) throw new Error('Хранилище временно недоступно');
  const paths = [...new Set((Array.isArray(values) ? values : [values])
    .map(extractStoragePath)
    .filter((id) => id !== null))];
    
  if (!paths.length) return 0;
  
  let deletedCount = 0;
  for (const id of paths) {
    try {
      await pbAdmin.collection('media').delete(id);
      deletedCount++;
    } catch (e) {
      console.warn(`[storage] Не удалось удалить запись ${id}:`, e.message);
    }
  }
  return deletedCount;
}

async function uploadChatAttachment(fileBuffer, originalName, mimeType) {
  const allowed = ['image/', 'video/', 'audio/'];
  let isAllowed = allowed.some((prefix) => mimeType && mimeType.startsWith(prefix));
  if (!isAllowed && originalName) {
    const ext = String(originalName).split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'webm', 'ogg', 'mp3', 'm4a', 'wav', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
      isAllowed = true;
    }
  }
  if (!isAllowed) {
    throw new Error('Можно загрузить только изображение, видео или аудио');
  }
  const detected = detectMediaFile(fileBuffer, mimeType);
  
  const result = await uploadFileToPB(fileBuffer, detected.mimeType, detected.extension);
  return { url: result.url, mimeType: detected.mimeType, mediaType: detected.mediaType };
}

module.exports = {
  uploadImage,
  uploadChatAttachment,
  deleteImages,
  extractStoragePath,
  isCabinPath,
  assertImageMime,
  detectMediaFile,
};
