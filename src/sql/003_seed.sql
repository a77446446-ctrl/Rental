/*
 * 003_seed.sql
 * Начальные данные для eco-gorniy.ru
 * 4 домика, дополнительные услуги, примеры календарных цен.
 *
 * Запускать в Supabase SQL Editor после 001_init.sql и 002_rls.sql.
 */

/* ─────────────────────────────────────────────
   1. Домики
   ───────────────────────────────────────────── */

INSERT INTO cabins (slug, name, description, base_price, capacity, images_urls, is_active, sort_order)
VALUES
  (
    'kedrovyy',
    'Кедровый',
    'Уютный домик в окружении вековых кедров. Панорамные окна с видом на озеро, дровяной камин, открытая терраса с мангальной зоной. Идеально для романтического уикенда или тихого семейного отдыха.',
    8500,
    4,
    '{}',
    true,
    1
  ),
  (
    'sosnovyy',
    'Сосновый',
    'Просторный дом среди сосен с двумя спальнями и гостиной. Собственная баня на берегу, причал для рыбалки. Большая крытая веранда с гамаком и видом на закат.',
    12000,
    6,
    '{}',
    true,
    2
  ),
  (
    'berёzovyy',
    'Берёзовый',
    'Светлый домик в берёзовой роще с французскими окнами. Финская сауна, купель на улице. Детская площадка рядом — отличный выбор для семьи с детьми.',
    10000,
    5,
    '{}',
    true,
    3
  ),
  (
    'ozernyy',
    'Озёрный',
    'Премиальный дом на первой линии озера. Собственный пирс, панорамное остекление, тёплый пол, дизайнерский интерьер. Открытый горячий чан с видом на воду и горы.',
    15000,
    8,
    '{}',
    true,
    4
  )
ON CONFLICT (slug) DO NOTHING;

/* ─────────────────────────────────────────────
   2. Дополнительные услуги
   ───────────────────────────────────────────── */

INSERT INTO extra_services (slug, name, description, price, price_type, is_active, sort_order)
VALUES
  (
    'banya',
    'Русская баня',
    'Классическая русская баня на дровах с берёзовыми вениками. Парная, помывочная, комната отдыха.',
    3500,
    'per_booking',
    true,
    1
  ),
  (
    'chan',
    'Горячий чан',
    'Купание в открытом горячем чане с видом на озеро. Дрова, растопка, полотенца включены.',
    4000,
    'per_booking',
    true,
    2
  ),
  (
    'kvadrocikl',
    'Квадроцикл',
    'Прокат квадроцикла для прогулки по горным тропам. Инструктаж и шлем включены. 1 час.',
    3000,
    'per_person',
    true,
    3
  ),
  (
    'sup-board',
    'SUP-борд',
    'Аренда SUP-борда для прогулки по озеру. Жилет и весло включены. На весь день.',
    1500,
    'per_person',
    true,
    4
  ),
  (
    'mangal',
    'Мангальный набор',
    'Мангал, решётка, шампуры, уголь, розжиг — полный комплект для шашлыка.',
    800,
    'per_booking',
    true,
    5
  ),
  (
    'zavtrak',
    'Завтрак',
    'Домашний завтрак с доставкой в домик: каша, яйца, свежий хлеб, джем, чай или кофе.',
    600,
    'per_person',
    true,
    6
  ),
  (
    'rybalka',
    'Набор для рыбалки',
    'Удочка, снасти, наживка, стульчик. Прокат на весь день.',
    1200,
    'per_booking',
    true,
    7
  ),
  (
    'transfer',
    'Трансфер',
    'Встреча и доставка от ближайшей ж/д станции или автовокзала до базы и обратно.',
    2500,
    'per_booking',
    true,
    8
  )
ON CONFLICT (slug) DO NOTHING;

/* ─────────────────────────────────────────────
   3. Примеры календарных цен (выходные и праздники дороже)
   Генерируем цены на ближайшие 2 месяца.
   Суббота и воскресенье — наценка 30%.
   ───────────────────────────────────────────── */

DO $$
DECLARE
  v_cabin   RECORD;
  v_date    DATE;
  v_price   INTEGER;
BEGIN
  FOR v_cabin IN SELECT id, base_price FROM cabins LOOP
    v_date := CURRENT_DATE;

    WHILE v_date < CURRENT_DATE + INTERVAL '60 days' LOOP
      /* Суббота (6) и воскресенье (0) — наценка 30% */
      IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
        v_price := ROUND(v_cabin.base_price * 1.3);
      ELSE
        v_price := v_cabin.base_price;
      END IF;

      INSERT INTO prices (cabin_id, date, custom_price, is_promo, promo_description)
      VALUES (v_cabin.id, v_date, v_price, false, NULL)
      ON CONFLICT (cabin_id, date) DO NOTHING;

      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END $$;

/* ─────────────────────────────────────────────
   3.1 Промо-цена на ближайший понедельник-среду для «Кедрового»
   ───────────────────────────────────────────── */

DO $$
DECLARE
  v_cabin_id UUID;
  v_date     DATE;
BEGIN
  SELECT id INTO v_cabin_id FROM cabins WHERE slug = 'kedrovyy';

  IF v_cabin_id IS NOT NULL THEN
    /* Находим ближайший понедельник */
    v_date := CURRENT_DATE + (8 - EXTRACT(DOW FROM CURRENT_DATE)::integer) % 7;

    /* Понедельник, вторник, среда — скидка */
    FOR i IN 0..2 LOOP
      UPDATE prices
      SET custom_price     = 5900,
          is_promo         = true,
          promo_description = 'Будни у озера — скидка 30%'
      WHERE cabin_id = v_cabin_id
        AND date     = v_date + i;
    END LOOP;
  END IF;
END $$;
