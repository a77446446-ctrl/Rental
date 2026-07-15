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

async function uploadImage(fileBuffer, _originalName, mimeType) {
  if (!supabaseAdmin) throw new Error('Хранилище временно недоступно');
  const extension = assertImageMime(mimeType);
  const storagePath = `cabins/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
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

async function uploadChatAttachment(fileBuffer, originalName, mimeType) {
  const allowed = ['image/', 'video/', 'audio/'];
  if (!allowed.some((prefix) => mimeType && mimeType.startsWith(prefix))) {
    throw new Error('Можно загрузить только изображение, видео или аудио');
  }
  const safeExt = (originalName.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'bin';
  const storagePath = `chat/${crypto.randomUUID()}.${safeExt}`;
  const { error } = await supabaseAdmin.storage.from(config.supabaseStorageBucket).upload(storagePath, fileBuffer, {
    contentType: mimeType, cacheControl: '31536000', upsert: false,
  });
  if (error) throw new Error(`Не удалось загрузить вложение: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(config.supabaseStorageBucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

module.exports = {
  uploadImage,
  uploadChatAttachment,
  deleteImages,
  extractStoragePath,
  isCabinPath,
  assertImageMime,
};
