// Список иконок для глэмпинга с русскими названиями
const GLAMPING_ICONS_DATA = [
  // Жильё и комнаты
  { id: "bed", label: "Кровать" },
  { id: "bed-double", label: "Двуспальная кровать" },
  { id: "bed-single", label: "Односпальная кровать" },
  { id: "sofa", label: "Диван" },
  { id: "home", label: "Дом" },
  { id: "tent", label: "Палатка" },
  { id: "key", label: "Ключ" },
  { id: "door-open", label: "Открытая дверь" },

  // Ванная и вода
  { id: "bath", label: "Ванна" },
  { id: "shower-head", label: "Душ" },
  { id: "droplets", label: "Бассейн" },
  { id: "waves", label: "Река / Озеро" },
  { id: "glass-water", label: "Питьевая вода" },

  // Отопление и климат
  { id: "flame", label: "Огонь / Камин" },
  { id: "flame-kindling", label: "Кострище / Мангал" },
  { id: "thermometer", label: "Отопление" },
  { id: "snowflake", label: "Кондиционер" },
  { id: "fan", label: "Вентилятор" },
  { id: "wind", label: "Свежий воздух" },
  { id: "sun", label: "Солнце" },
  { id: "moon", label: "Ночное освещение" },

  // Природа и территория
  { id: "trees", label: "Лес" },
  { id: "tree-pine", label: "Хвойный лес" },
  { id: "mountain", label: "Горы" },
  { id: "mountain-snow", label: "Снежные горы" },
  { id: "fish", label: "Рыбалка" },
  { id: "compass", label: "Ориентирование" },
  { id: "map", label: "Карта" },
  { id: "map-pin", label: "Местоположение" },
  { id: "footprints", label: "Пешие прогулки" },
  { id: "bike", label: "Велосипед" },

  // Кухня и еда
  { id: "utensils", label: "Столовые приборы" },
  { id: "utensils-crossed", label: "Ресторан" },
  { id: "coffee", label: "Кофе / Чай" },
  { id: "refrigerator", label: "Холодильник" },
  { id: "microwave", label: "Микроволновка" },
  { id: "wine", label: "Вино" },
  { id: "beer", label: "Бар" },
  { id: "cup-soda", label: "Напитки" },
  { id: "cookie", label: "Угощения" },

  // Развлечения и техника
  { id: "wifi", label: "Wi-Fi" },
  { id: "tv", label: "Телевизор" },
  { id: "monitor", label: "Монитор" },
  { id: "speaker", label: "Колонка" },
  { id: "music", label: "Музыка" },
  { id: "radio", label: "Радио" },
  { id: "camera", label: "Фотозона" },
  { id: "image", label: "Виды" },
  { id: "video", label: "Видео" },
  { id: "book", label: "Книги" },
  { id: "book-open", label: "Библиотека" },
  { id: "gamepad-2", label: "Игровая зона" },
  { id: "puzzle", label: "Настольные игры" },

  // Транспорт и парковка
  { id: "car", label: "Парковка авто" },
  { id: "parking-circle", label: "Парковка" },
  { id: "parking-square", label: "Паркинг" },
  { id: "bus", label: "Автобус / Трансфер" },
  { id: "train", label: "Поезд" },
  { id: "plane", label: "Аэропорт рядом" },

  // Дети и питомцы
  { id: "baby", label: "Для детей" },
  { id: "paw-print", label: "С питомцами" },
  { id: "dog", label: "Собаки разрешены" },
  { id: "rocking-chair", label: "Зона отдыха" },

  // Безопасность и сервис
  { id: "shield-check", label: "Безопасность" },
  { id: "check-circle", label: "Включено" },
  { id: "heart", label: "Избранное" },
  { id: "star", label: "Премиум" },
  { id: "cigarette-off", label: "Не курить" },
  { id: "shopping-bag", label: "Магазин рядом" },
  { id: "shopping-cart", label: "Покупки" },

  // Сауна и баня (кастомные через близкие иконки)
  { id: "flame", label: "Сауна / Баня" },
  { id: "sunrise", label: "Рассвет / Терраса" },
  { id: "sunset", label: "Закат / Веранда" },
  { id: "cloudy", label: "Облачно" },
  { id: "umbrella", label: "Зонт / Навес" }
];

// Массив только id для обратной совместимости
const GLAMPING_ICONS = GLAMPING_ICONS_DATA.map(item => item.id);

// Словарь id -> русское название
const GLAMPING_ICONS_LABELS = {};
GLAMPING_ICONS_DATA.forEach(item => {
  GLAMPING_ICONS_LABELS[item.id] = item.label;
});

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GLAMPING_ICONS;
  module.exports.GLAMPING_ICONS_DATA = GLAMPING_ICONS_DATA;
  module.exports.GLAMPING_ICONS_LABELS = GLAMPING_ICONS_LABELS;
}
if (typeof window !== 'undefined') {
  window.GLAMPING_ICONS = GLAMPING_ICONS;
  window.GLAMPING_ICONS_DATA = GLAMPING_ICONS_DATA;
  window.GLAMPING_ICONS_LABELS = GLAMPING_ICONS_LABELS;
}
