/**
 * Same-origin proxy for public PocketBase Storage media.
 *
 * The browser requests /media/pocketbase/... from eco-gorniy.ru, while
 * the VPS fetches the file from the configured PocketBase server.
 */

const express = require('express');
const { Readable, pipeline } = require('stream');
const { config } = require('../config/env');

const router = express.Router();
const PB_STORAGE_PREFIX = '/api/files/';

function buildPocketbaseMediaUrl(relativePath) {
  if (!config.pocketbaseUrl) return null;

  const normalized = String(relativePath || '').replace(/^\/+/, '');
  const segments = normalized.split('/');
  
  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'))
  ) {
    return null;
  }

  const upstream = new URL(config.pocketbaseUrl);
  upstream.pathname = PB_STORAGE_PREFIX + segments
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  upstream.search = '';
  upstream.hash = '';
  return upstream;
}

function toSameOriginMediaPath(value) {
  const raw = String(value || '').trim();
  if (!raw || !config.pocketbaseUrl) return raw;

  try {
    const source = new URL(raw);
    const configuredPb = new URL(config.pocketbaseUrl);
    if (source.origin !== configuredPb.origin || !source.pathname.startsWith(PB_STORAGE_PREFIX)) {
      return raw;
    }

    const relativePath = source.pathname.slice(PB_STORAGE_PREFIX.length);
    if (!buildPocketbaseMediaUrl(relativePath)) return raw;
    return '/media/pocketbase/' + relativePath.split('/').map((segment) => encodeURIComponent(decodeURIComponent(segment))).join('/');
  } catch {
    return raw;
  }
}

router.get('/pocketbase/*', async (req, res) => {
  const upstreamUrl = buildPocketbaseMediaUrl(req.params[0]);
  if (!upstreamUrl) {
    return res.status(400).json({ success: false, error: 'Некорректный адрес медиафайла' });
  }

  const requestHeaders = {};
  ['range', 'if-none-match', 'if-modified-since'].forEach((name) => {
    if (req.headers[name]) requestHeaders[name] = req.headers[name];
  });

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: requestHeaders,
      redirect: 'follow',
    });

    res.status(upstream.status);
    [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ].forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    });
    if ([200, 206, 304].includes(upstream.status)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    if (req.method === 'HEAD' || !upstream.body) {
      return res.end();
    }

    pipeline(Readable.fromWeb(upstream.body), res, (err) => {
      if (!err) return;
      console.error('[media-proxy] Ошибка передачи файла:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: 'Не удалось загрузить медиафайл' });
      }
    });
  } catch (err) {
    console.error('[media-proxy] Ошибка PocketBase Storage:', err.message);
    if (!res.headersSent) {
      return res.status(502).json({ success: false, error: 'Медиафайл временно недоступен' });
    }
    return res.end();
  }
});

module.exports = { router, buildPocketbaseMediaUrl, toSameOriginMediaPath };
