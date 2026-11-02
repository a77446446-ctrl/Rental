/**
 * Автоматический менеджер PocketBase для локального запуска (без Docker).
 * 
 * Если PocketBase не запущен, но в корне проекта присутствует бинарный файл
 * (pocketbase.exe на Windows или pocketbase на Linux/macOS):
 * 1. Автоматически создает/обновляет суперпользователя базы данных под реквизиты из .env
 * 2. Запускает сервер PocketBase на указанном порту (по умолчанию 8090)
 * 3. Если база чистая (коллекция cabins отсутствует), автоматически выполняет начальную инициализацию
 * 4. При остановке Node.js (Ctrl+C или завершение процесса) аккуратно закрывает PocketBase.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/env');

let spawnedPocketBase = null;

async function isHealthy(baseUrl) {
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
    const res = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBinary() {
  const rootDir = path.resolve(__dirname, '../../');
  const winBin = path.join(rootDir, 'pocketbase.exe');
  const nixBin = path.join(rootDir, 'pocketbase');

  if (process.platform === 'win32') {
    if (fs.existsSync(winBin)) return winBin;
  } else {
    if (fs.existsSync(nixBin)) return nixBin;
  }
  if (fs.existsSync(winBin)) return winBin;
  if (fs.existsSync(nixBin)) return nixBin;
  return null;
}

async function ensureLocalPocketbase() {
  const targetUrl = config.pocketbaseUrl || 'http://127.0.0.1:8090';
  const isLocal = targetUrl.includes('127.0.0.1') || targetUrl.includes('localhost');

  if (!isLocal) {
    // Внешний PocketBase (удаленный сервер) — управляем только подключением
    return;
  }

  // 1. Проверяем, запущен ли PocketBase уже (например, через Docker или в соседней консоли)
  if (await isHealthy(targetUrl)) {
    console.log('[PocketBase] База данных уже активна на ' + targetUrl);
    return;
  }

  // 2. Ищем бинарный файл pocketbase
  const binaryPath = findBinary();
  if (!binaryPath) {
    console.warn('\x1b[33m[PocketBase] Внимание: сервер PocketBase не запущен на ' + targetUrl + ', и файл pocketbase.exe не найден в корне проекта.\x1b[0m');
    console.warn('[PocketBase] Запустите PocketBase вручную или через Docker Compose: docker compose up -d');
    return;
  }

  const binaryDir = path.dirname(binaryPath);
  let parsedPort = '8090';
  try {
    const parsed = new URL(targetUrl);
    if (parsed.port) parsedPort = parsed.port;
  } catch (e) {}

  // 3. Создаем/обновляем суперпользователя перед запуском
  if (config.pocketbaseAdminEmail && config.pocketbaseAdminPassword) {
    try {
      execSync(`"${binaryPath}" superuser upsert "${config.pocketbaseAdminEmail}" "${config.pocketbaseAdminPassword}"`, {
        cwd: binaryDir,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (_e) {
      // Игнорируем, если версия CLI отличается
    }
  }

  // 4. Запускаем PocketBase в фоновом процессе
  console.log('[PocketBase] Автоматический запуск базы данных...');
  const child = spawn(binaryPath, ['serve', `--http=127.0.0.1:${parsedPort}`], {
    cwd: binaryDir,
    stdio: 'ignore',
    windowsHide: true,
  });

  spawnedPocketBase = child;

  // 5. Ожидаем готовности (до 6 секунд)
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    if (await isHealthy(targetUrl)) {
      ready = true;
      break;
    }
  }

  if (ready) {
    console.log(`[PocketBase] ✓ База данных запущена (PID: ${child.pid}) на 127.0.0.1:${parsedPort}`);

    // 6. Проверяем, нужно ли инициализировать схему и демо-домики
    try {
      const checkRes = await fetch(`${targetUrl.replace(/\/$/, '')}/api/collections/cabins/records?perPage=1`).catch(() => null);
      if (!checkRes || checkRes.status === 404) {
        console.log('[PocketBase] Выполняется автоматическая инициализация схемы данных и демонстрационных домиков...');
        const { runSetup } = require('../../scripts/setup-pocketbase');
        if (typeof runSetup === 'function') {
          await runSetup();
        }
      }
    } catch (_setupErr) {
      // Инициализация опциональна
    }
  } else {
    console.warn('\x1b[31m[PocketBase] Не удалось дождаться ответа от базы данных.\x1b[0m');
  }

  // 7. Корректная остановка дочернего процесса при завершении Node.js
  const stopChild = () => {
    if (spawnedPocketBase && !spawnedPocketBase.killed) {
      try {
        process.kill(spawnedPocketBase.pid);
      } catch (_e) {}
      spawnedPocketBase = null;
    }
  };

  process.once('exit', stopChild);
  process.once('SIGINT', stopChild);
  process.once('SIGTERM', stopChild);
}

module.exports = { ensureLocalPocketbase };
