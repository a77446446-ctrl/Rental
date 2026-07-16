const { supabaseAdmin } = require('../config/supabase');
const { config } = require('../config/env');
const crypto = require('crypto');

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

function assertImageMime(mimeType) {
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) throw new Error('Допустимы только JPG, PNG, WEBP, AVIF или GIF');
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
  if (ascii.slice(4, 8) === 'ftyp' && /^(avif|avis|mif1|msf1)$/.test(ascii.slice(8, 12))) {
    return { mimeType: 'image/avif', extension: 'avif', mediaType: 'image' };
  }
  if (hex.startsWith('1a45dfa3')) {
    const mediaType = String(declaredMime).startsWith('audio/') ? 'audio' : 'video';
    return { mimeType: `${mediaType}/webm`, extension: 'webm', mediaType };
  }
  if (ascii.slice(4, 8) === 'ftyp') {
    const mediaType = String(declaredMime).startsWith('audio/') ? 'audio' : 'video';
    return {
      mimeType: mediaType === 'audio' ? 'audio/mp4' : 'video/mp4',
      extension: mediaType === 'audio' ? 'm4a' : 'mp4',
      mediaType,
    };
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

async function uploadImage(fileBuffer, _originalName, mimeType) {
  if (!supabaseAdmin) throw new Error('Хранилище временно недоступно');
  assertImageMime(mimeType);
  const detected = detectMediaFile(fileBuffer, mimeType);
  if (detected.mediaType !== 'image') throw mediaValidationError('Файл не является изображением');
  const extension = detected.extension;
  const storagePath = `cabins/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .upload(storagePath, fileBuffer, {
      contentType: detected.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw new Error(`Не удалось загрузить изображение: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(config.supabaseStorageBucket).getPublicUrl(storagePath);
  return { url: data.publicUrl, path: storagePath };
}

function extractStoragePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!raw.includes('://')) return raw;
  try {
    const pathname = new URL(raw).pathname;
    const marker = `/storage/v1/object/public/${config.supabaseStorageBucket}/`;
    const index = pathname.indexOf(marker);
    return index === -1 ? null : decodeURIComponent(pathname.slice(index + marker.length));
  } catch (_err) {
    return null;
  }
}

function isCabinPath(value) {
  const storagePath = extractStoragePath(value);
  if (!storagePath || storagePath.includes('..') || storagePath.startsWith('chat/')) return false;
  return storagePath.startsWith('cabins/') || /^[0-9a-f-]{30,}\.[a-z0-9]{2,12}$/i.test(storagePath);
}

async function deleteImages(values) {
  if (!supabaseAdmin) throw new Error('Хранилище временно недоступно');
  const paths = [...new Set((Array.isArray(values) ? values : [values])
    .map(extractStoragePath)
    .filter((value) => value && isCabinPath(value)))];
  if (!paths.length) return 0;
  const { error } = await supabaseAdmin.storage.from(config.supabaseStorageBucket).remove(paths);
  if (error) throw new Error(`Не удалось удалить изображение: ${error.message}`);
  return paths.length;
}

async function uploadChatAttachment(fileBuffer, _originalName, mimeType) {
  const allowed = ['image/', 'video/', 'audio/'];
  if (!allowed.some((prefix) => mimeType && mimeType.startsWith(prefix))) {
    throw new Error('Можно загрузить только изображение, видео или аудио');
  }
  const detected = detectMediaFile(fileBuffer, mimeType);
  const declaredCategory = String(mimeType).split('/')[0];
  if (declaredCategory !== detected.mediaType) {
    throw mediaValidationError('Тип содержимого файла не соответствует заявленному');
  }
  const storagePath = `chat/${crypto.randomUUID()}.${detected.extension}`;
  const { error } = await supabaseAdmin.storage.from(config.supabaseStorageBucket).upload(storagePath, fileBuffer, {
    contentType: detected.mimeType, cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(`Не удалось загрузить вложение: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(config.supabaseStorageBucket).getPublicUrl(storagePath);
  return { url: data.publicUrl, mimeType: detected.mimeType, mediaType: detected.mediaType };
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
