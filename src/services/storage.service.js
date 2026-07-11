const { supabaseAdmin } = require('../config/supabase');
const { config } = require('../config/env');
const crypto = require('crypto');

/**
 * Загружает изображение в Supabase Storage
 * @param {Buffer} fileBuffer Буфер файла
 * @param {string} originalName Исходное имя файла
 * @param {string} mimeType MIME-тип файла (например, image/jpeg)
 * @returns {Promise<string>} Публичный URL загруженного изображения
 */
async function uploadImage(fileBuffer, originalName, mimeType) {
  // Генерируем случайное имя файла для предотвращения конфликтов
  const ext = originalName.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;

  // Загружаем в бакет
  const { data, error } = await supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('[storage.service] Ошибка загрузки:', error.message);
    throw new Error('Не удалось загрузить изображение в хранилище');
  }

  // Получаем публичный URL
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}


/**
 * Загружает вложение чата в Supabase Storage.
 * Поддерживаются изображения, видео и аудио.
 */
async function uploadChatAttachment(fileBuffer, originalName, mimeType) {
  const allowed = ['image/', 'video/', 'audio/'];
  if (!allowed.some(prefix => mimeType && mimeType.startsWith(prefix))) {
    throw new Error('Можно загрузить только изображение, видео или аудио');
  }

  const safeExt = (originalName.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'bin';
  const fileName = 'chat/' + crypto.randomUUID() + '.' + safeExt;

  const { error } = await supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('[storage.service] Ошибка загрузки вложения чата:', error.message);
    throw new Error('Не удалось загрузить вложение');
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

module.exports = {
  uploadImage,
  uploadChatAttachment
};
