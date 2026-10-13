/**
 * 🌲 Автоматический установщик схемы и начальных данных в PocketBase
 * 
 * Использование:
 * node scripts/setup-pocketbase.js
 * 
 * Скрипт:
 * 1. Проверяет авторизацию администратора PocketBase
 * 2. Автоматически создает/обновляет все 9 коллекций:
 *    - cabins (домики)
 *    - prices (сезонные/индивидуальные цены и блокировки дат)
 *    - guests (база гостей CRM)
 *    - bookings (бронирования)
 *    - media (хранилище загружаемых фото/видео)
 *    - chat_logs (история онлайн-чата с гостями)
 *    - app_config (настройки сайта, главная страница, доп. услуги)
 *    - external_calendar_sources (источники iCal для синхронизации)
 *    - external_bookings (брони, импортированные из iCal)
 * 3. Импортирует начальные настройки сайта из src/data/*.json в PocketBase
 * 4. Создает 4 демонстрационных домика, если коллекция домиков пуста
 */

const PocketBase = require('pocketbase/cjs');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const pbEmail = process.env.POCKETBASE_ADMIN_EMAIL;
const pbPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!pbEmail || !pbPassword) {
  console.error('\x1b[31m[Ошибка] Не заданы POCKETBASE_ADMIN_EMAIL или POCKETBASE_ADMIN_PASSWORD в .env\x1b[0m');
  console.log('Пожалуйста, заполните их в .env файле и перезапустите скрипт.');
  process.exit(1);
}

const pb = new PocketBase(pbUrl);

async function ensureCollection(name, schemaFields, options = {}) {
  try {
    const existing = await pb.collections.getOne(name);
    console.log(`  ✓ Коллекция «${name}» уже существует. Проверка полей...`);
    
    // Проверяем, есть ли все поля
    const currentSchema = existing.schema || [];
    let updated = false;

    for (const field of schemaFields) {
      const found = currentSchema.find((f) => f.name === field.name);
      if (!found) {
        currentSchema.push(field);
        updated = true;
        console.log(`    + Добавлено недостающее поле «${field.name}» (${field.type})`);
      }
    }

    if (updated) {
      await pb.collections.update(name, { schema: currentSchema });
      console.log(`    ✓ Схема коллекции «${name}» обновлена.`);
    }
    return existing;
  } catch (err) {
    if (err.status === 404) {
      console.log(`  + Создание коллекции «${name}»...`);
      const created = await pb.collections.create({
        name,
        type: 'base',
        schema: schemaFields,
        listRule: options.listRule !== undefined ? options.listRule : null,
        viewRule: options.viewRule !== undefined ? options.viewRule : null,
        createRule: options.createRule !== undefined ? options.createRule : null,
        updateRule: options.updateRule !== undefined ? options.updateRule : null,
        deleteRule: options.deleteRule !== undefined ? options.deleteRule : null,
        ...options
      });
      console.log(`  ✓ Коллекция «${name}» успешно создана!`);
      return created;
    }
    throw err;
  }
}

async function run() {
  console.log('================================================================');
  console.log('🌲 Инициализация базы данных PocketBase для EcoGorniy Rental');
  console.log('================================================================');
  console.log(`Подключение к: ${pbUrl}`);

  try {
    await pb.admins.authWithPassword(pbEmail, pbPassword);
    console.log('✓ Авторизация супер-администратора успешна!\n');
  } catch (err) {
    console.error('\x1b[31m[Ошибка авторизации] Не удалось войти в PocketBase:\x1b[0m', err.message);
    console.log('Убедитесь, что:');
    console.log('1. PocketBase запущен на ' + pbUrl);
    console.log('2. Учетная запись супер-админа создана и пароль верен.');
    process.exit(1);
  }

  // 1. Коллекция cabins
  await ensureCollection('cabins', [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true },
    { name: 'description', type: 'text' },
    { name: 'base_price', type: 'number', required: true },
    { name: 'capacity', type: 'number', required: true },
    { name: 'base_guests', type: 'number' },
    { name: 'extra_guest_price', type: 'number' },
    { name: 'is_active', type: 'bool' },
    { name: 'allow_pets', type: 'bool' },
    { name: 'allowed_pet_types', type: 'json' },
    { name: 'pet_price', type: 'number' },
    { name: 'pet_price_type', type: 'text' },
    { name: 'images', type: 'json' },
    { name: 'amenities', type: 'json' },
    { name: 'tags', type: 'json' },
    { name: 'sort_order', type: 'number' },
  ]);

  // 2. Коллекция prices
  await ensureCollection('prices', [
    { name: 'cabin_id', type: 'text', required: true },
    { name: 'date', type: 'date', required: true },
    { name: 'custom_price', type: 'number' },
    { name: 'is_promo', type: 'bool' },
    { name: 'promo_description', type: 'text' },
  ]);

  // 3. Коллекция guests
  await ensureCollection('guests', [
    { name: 'full_name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'telegram', type: 'text' },
  ]);

  // 4. Коллекция bookings
  await ensureCollection('bookings', [
    { name: 'cabin_id', type: 'text', required: true },
    { name: 'guest_id', type: 'text' },
    { name: 'check_in_date', type: 'date', required: true },
    { name: 'check_out_date', type: 'date', required: true },
    { name: 'guests_count', type: 'number', required: true },
    { name: 'with_pets', type: 'bool' },
    { name: 'comment', type: 'text' },
    { name: 'total_price', type: 'number', required: true },
    { name: 'status', type: 'text', required: true }, // pending, confirmed, cancelled
  ]);

  // 5. Коллекция media (хранилище файлов)
  await ensureCollection('media', [
    { name: 'file', type: 'file', maxSelect: 1, maxSize: 524288000 },
  ], {
    // Разрешаем публичный просмотр загруженных файлов через URL
    viewRule: '',
    listRule: '',
  });

  // 6. Коллекция chat_logs
  await ensureCollection('chat_logs', [
    { name: 'guest_id', type: 'text' },
    { name: 'sender_type', type: 'text' }, // guest, admin
    { name: 'message', type: 'text' },
    { name: 'attachment', type: 'json' },
    { name: 'is_read', type: 'bool' },
  ]);

  // 7. Коллекция app_config
  await ensureCollection('app_config', [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'value', type: 'json' },
  ]);

  // 8. Коллекция external_calendar_sources
  await ensureCollection('external_calendar_sources', [
    { name: 'cabin_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'is_active', type: 'bool' },
    { name: 'last_synced_at', type: 'date' },
    { name: 'last_error', type: 'text' },
  ]);

  // 9. Коллекция external_bookings
  await ensureCollection('external_bookings', [
    { name: 'cabin_id', type: 'text', required: true },
    { name: 'source_id', type: 'text' },
    { name: 'external_uid', type: 'text' },
    { name: 'check_in_date', type: 'date', required: true },
    { name: 'check_out_date', type: 'date', required: true },
    { name: 'summary', type: 'text' },
  ]);

  console.log('\n--- Проверка и наполнение начальных настроек (app_config) ---');
  const dataDir = path.resolve(__dirname, '../src/data');
  const configFiles = [
    { key: 'settings', file: 'settings.json' },
    { key: 'mainpage', file: 'mainpage.json' },
    { key: 'amenities', file: 'amenities.json' },
    { key: 'extra_services', file: 'extra_services.json' },
    { key: 'tags', file: 'tags.json' },
    { key: 'cabin_tags', file: 'cabin_tags.json' },
  ];

  for (const item of configFiles) {
    const fullPath = path.join(dataDir, item.file);
    if (!fs.existsSync(fullPath)) continue;

    try {
      let existingRecord = null;
      try {
        existingRecord = await pb.collection('app_config').getFirstListItem(`key="${item.key}"`);
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      if (!existingRecord) {
        const fileContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        await pb.collection('app_config').create({
          key: item.key,
          value: fileContent,
        });
        console.log(`  ✓ Конфигурация «${item.key}» успешно импортирована из ${item.file}`);
      } else {
        console.log(`  • Конфигурация «${item.key}» уже заполнена в базе.`);
      }
    } catch (cfgErr) {
      console.warn(`  ! Предупреждение для «${item.key}»:`, cfgErr.message);
    }
  }

  console.log('\n--- Проверка демонстрационных домиков (cabins) ---');
  const cabinsCount = await pb.collection('cabins').getList(1, 1);
  if (cabinsCount.totalItems === 0) {
    console.log('  Создание 4 демонстрационных домиков...');
    const demoCabins = [
      {
        name: 'Домик 1 — Лесной Уют',
        slug: 'lesnoy-uyut',
        description: 'Уютный деревянный домик с панорамными окнами на сосновый бор. Идеален для романтического отдыха пары.',
        base_price: 7000,
        capacity: 2,
        base_guests: 2,
        extra_guest_price: 1500,
        is_active: true,
        allow_pets: true,
        allowed_pet_types: ['Собака', 'Кошка'],
        pet_price: 1000,
        pet_price_type: 'per_stay',
        images: [{ url: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1200&q=80', category: 'main' }],
        amenities: ['Двуспальная кровать', 'WiFi', 'Душевая', 'Фен', 'Посуда', 'Терраса'],
        tags: ['В лесу'],
        sort_order: 1,
      },
      {
        name: 'Домик 2 — Озерный Бриз',
        slug: 'ozerniy-briz',
        description: 'Просторный коттедж прямо на берегу озера. Собственный пирс, терраса с шезлонгами и сауна.',
        base_price: 9500,
        capacity: 4,
        base_guests: 2,
        extra_guest_price: 1500,
        is_active: true,
        allow_pets: true,
        allowed_pet_types: ['Собака'],
        pet_price: 1000,
        pet_price_type: 'per_stay',
        images: [{ url: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80', category: 'main' }],
        amenities: ['Двуспальная кровать', 'Двухспальный диван', 'Сауна', 'WiFi', 'Кухня', 'Терраса'],
        tags: ['У озера'],
        sort_order: 2,
      },
      {
        name: 'Домик 3 — Горная Панорама',
        slug: 'gornaya-panorama',
        description: 'Видовой шале на возвышенности с потрясающим обзором горных хребтов и вечерних закатов.',
        base_price: 8500,
        capacity: 3,
        base_guests: 2,
        extra_guest_price: 1500,
        is_active: true,
        allow_pets: false,
        images: [{ url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80', category: 'main' }],
        amenities: ['Двуспальная кровать', 'WiFi', 'Душевая', 'Кухня', 'Посуда'],
        tags: ['В лесу'],
        sort_order: 3,
      },
      {
        name: 'Домик 4 — Семейный Шале',
        slug: 'semeyniy-shale',
        description: 'Большой двухэтажный дом для семейного отдыха или дружной компании. Оборудованная кухня и мангальная зона.',
        base_price: 12000,
        capacity: 6,
        base_guests: 4,
        extra_guest_price: 1500,
        is_active: true,
        allow_pets: true,
        allowed_pet_types: ['Собака', 'Кошка'],
        pet_price: 1500,
        pet_price_type: 'per_stay',
        images: [{ url: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=80', category: 'main' }],
        amenities: ['Двуспальная кровать', 'Двухспальный диван', 'Сауна', 'WiFi', 'Кухня', 'Терраса', 'Посуда'],
        tags: ['У озера', 'С шатром'],
        sort_order: 4,
      },
    ];

    for (const cabin of demoCabins) {
      await pb.collection('cabins').create(cabin);
      console.log(`  ✓ Добавлен: ${cabin.name}`);
    }
  } else {
    console.log(`  • В базе уже есть домиков: ${cabinsCount.totalItems} шт.`);
  }

  console.log('\n================================================================');
  console.log('🎉 ГОТОВО! База данных PocketBase полностью настроена!');
  console.log('Теперь вы можете запустить приложение: npm start');
  console.log('Панель управления доступна по адресу: /admin/login');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\n\x1b[31m[Критическая ошибка]:\x1b[0m', err);
  process.exit(1);
});
