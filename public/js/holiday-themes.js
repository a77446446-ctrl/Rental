/**
 * Модуль праздничных и сезонных подтем (EcoHolidayThemes)
 * Добавляет анимированный векторный декор на баннер, карточки, углы экрана и логотип
 * поверх любой выбранной цветовой темы сайта.
 */
(function () {
  'use strict';

  var SUBTHEMES = ['none', 'new-year', 'feb23', 'mar8', 'spring', 'may1', 'sep1', 'nov4'];

  var META = {
    'none': {
      label: 'Выключено',
      description: 'Стандартный вид сайта без сезонного декора'
    },
    'new-year': {
      label: 'Новый год и Рождество',
      description: 'Дед Мороз, шевелящаяся ёлочка, еловые ветки с игрушками, снежные шапки и снегопад'
    },
    'feb23': {
      label: '23 Февраля',
      description: 'День защитника Отечества: звёзды, хвоя с лавровыми ветвями, триколор и огни салюта'
    },
    'mar8': {
      label: '8 Марта',
      description: 'Веточки пушистой мимозы, распускающиеся тюльпаны, бабочки и лепестки'
    },
    'spring': {
      label: 'Весна',
      description: 'Берёзовые ветки с почками и свисающими серёжками, распускающиеся цветы и птичка'
    },
    'may1': {
      label: '1 Мая (Первомай)',
      description: 'Цветущая яблоня, праздничные майские ленты и связка воздушных шаров'
    },
    'sep1': {
      label: '1 Сентября / Золотая осень',
      description: 'Кленовые листья, гроздья рябины, колокольчик, осенний ёжик и листопад'
    },
    'nov4': {
      label: 'Ноябрьские праздники (4 ноября)',
      description: 'День народного единства: гроздья рябины, золотые листья дуба и лента триколора'
    }
  };

  var currentState = {
    subtheme: 'none',
    particles: true
  };

  var observer = null;
  var syncScheduled = false;

  function normalizeSubtheme(value) {
    var v = String(value || 'none').trim();
    return SUBTHEMES.indexOf(v) !== -1 ? v : 'none';
  }

  function normalizeParticles(value) {
    return value !== false && value !== 'false';
  }

  function clearBodySubthemeClasses(target) {
    if (!target || !target.classList) return;
    SUBTHEMES.forEach(function (name) {
      target.classList.remove('subtheme-' + name);
    });
    target.classList.remove('subtheme-particles-on');
  }

  /* ========================================================================
     SVG-библиотека праздничных элементов
     ======================================================================== */

  function getCornerBranchLeftSvg(subtheme, isCompact) {
    switch (subtheme) {
      case 'new-year':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M-8 6 C42 22, 98 20, 178 4" stroke="#1b4328" stroke-width="11" stroke-linecap="round"/>' +
          '<path d="M8 22 C48 48, 92 64, 146 66" stroke="#1d4d2c" stroke-width="8" stroke-linecap="round"/>' +
          '<path d="M4 8 C35 16, 70 14, 108 6 M22 14 C46 28, 72 34, 104 30 M58 16 C82 32, 108 38, 138 30 M96 14 C120 26, 145 26, 172 12 M18 28 C32 52, 52 72, 82 82 M46 44 C66 64, 92 78, 128 76" stroke="#2d6a3e" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M12 12 L24 24 M30 14 L42 26 M48 16 L60 28 M70 16 L84 28 M92 14 L106 24 M118 12 L134 22 M144 8 L160 16 M34 36 L44 52 M56 48 L66 64 M80 58 L90 74" stroke="#458b56" stroke-width="2.2" stroke-linecap="round"/>' +
          /* Шишка */
          '<ellipse cx="42" cy="36" rx="9" ry="13" transform="rotate(-24 42 36)" fill="#6d4528"/>' +
          '<path d="M36 30 L48 34 M35 36 L47 40 M37 42 L45 45" stroke="#a67249" stroke-width="1.6" stroke-linecap="round"/>' +
          /* Свисающие игрушки */
          '<g class="h-swing">' +
            '<line x1="74" y1="30" x2="74" y2="72" stroke="#ebd197" stroke-width="1.6"/>' +
            '<rect x="70" y="70" width="8" height="5" rx="1.5" fill="#e0b85b"/>' +
            '<circle cx="74" cy="89" r="15" fill="#c92a2a"/>' +
            '<circle cx="69" cy="83" r="4.5" fill="#ff8787" opacity="0.65"/>' +
            '<path d="M61 91 Q74 98 87 91" stroke="#ffd873" stroke-width="2" fill="none"/>' +
          '</g>' +
          (isCompact ? '' :
          '<g class="h-swing-slow">' +
            '<line x1="138" y1="22" x2="138" y2="58" stroke="#ebd197" stroke-width="1.5"/>' +
            '<rect x="135" y="56" width="6" height="4" rx="1" fill="#e0b85b"/>' +
            '<circle cx="138" cy="72" r="12" fill="#e0a938"/>' +
            '<circle cx="134" cy="67" r="3.5" fill="#fff3bf" opacity="0.75"/>' +
          '</g>' +
          '<g class="h-swing">' +
            '<line x1="176" y1="8" x2="176" y2="42" stroke="#ebd197" stroke-width="1.4"/>' +
            '<polygon points="176,42 185,57 176,70 167,57" fill="#3b82f6"/>' +
            '<polygon points="176,45 181,56 176,65 171,56" fill="#93c5fd" opacity="0.5"/>' +
          '</g>') +
          /* Огоньки */
          '<circle class="h-twinkle" cx="28" cy="20" r="3.5" fill="#ffd43b"/>' +
          '<circle class="h-twinkle-2" cx="98" cy="22" r="3.5" fill="#ff6b6b"/>' +
          '<circle class="h-twinkle-3" cx="152" cy="14" r="3.5" fill="#74c0fc"/>' +
          '<circle class="h-twinkle" cx="54" cy="54" r="3" fill="#69db7c"/>' +
        '</svg>';

      case 'feb23':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Хвоя и лавр */
          '<path d="M-4 8 Q72 44 170 12" stroke="#1e462a" stroke-width="7" stroke-linecap="round"/>' +
          '<path d="M10 18 Q48 64 114 78" stroke="#285936" stroke-width="5" stroke-linecap="round"/>' +
          '<ellipse cx="38" cy="28" rx="11" ry="5" transform="rotate(-25 38 28)" fill="#3b7a4a"/>' +
          '<ellipse cx="64" cy="34" rx="11" ry="5" transform="rotate(15 64 34)" fill="#4b8f5b"/>' +
          '<ellipse cx="92" cy="32" rx="11" ry="5" transform="rotate(-18 92 32)" fill="#3b7a4a"/>' +
          '<ellipse cx="122" cy="24" rx="10" ry="4.5" transform="rotate(12 122 24)" fill="#4b8f5b"/>' +
          '<ellipse cx="44" cy="56" rx="10" ry="4.5" transform="rotate(30 44 56)" fill="#4b8f5b"/>' +
          '<ellipse cx="74" cy="68" rx="10" ry="4.5" transform="rotate(-12 74 68)" fill="#3b7a4a"/>' +
          /* Гвардейско-праздничная лента */
          '<path d="M0 10 C55 24, 90 12, 148 26 L144 38 C88 24, 54 36, 0 22 Z" fill="#d97706"/>' +
          '<path d="M0 13 C55 27, 90 15, 147 29" stroke="#1a1a1a" stroke-width="3.2"/>' +
          '<path d="M0 18 C55 32, 90 20, 146 34" stroke="#1a1a1a" stroke-width="3.2"/>' +
          /* Звезда на ниточке */
          '<g class="h-swing">' +
            '<line x1="78" y1="30" x2="78" y2="56" stroke="#f5d061" stroke-width="1.5"/>' +
            '<polygon points="78,54 84,67 98,68 87,77 90,91 78,83 66,91 69,77 58,68 72,67" fill="#d63031" stroke="#f5d061" stroke-width="2"/>' +
            '<polygon points="78,58 81,68 91,69 83,75 85,84 78,79 71,84 73,75 65,69 75,68" fill="#ff7675" opacity="0.45"/>' +
          '</g>' +
          '<circle class="h-twinkle" cx="145" cy="18" r="3" fill="#ffd43b"/>' +
          '<circle class="h-twinkle-2" cx="118" cy="52" r="2.5" fill="#ffd43b"/>' +
        '</svg>';

      case 'mar8':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M-4 10 Q66 48 164 22" stroke="#3f7d45" stroke-width="4" stroke-linecap="round"/>' +
          '<path d="M14 16 Q48 70 108 86" stroke="#4d8f53" stroke-width="3" stroke-linecap="round"/>' +
          /* Веточка мимозы */
          '<circle cx="48" cy="24" r="6" fill="#ffd43b"/><circle cx="60" cy="18" r="5.5" fill="#fcc419"/>' +
          '<circle cx="72" cy="28" r="6" fill="#ffd43b"/><circle cx="85" cy="20" r="5" fill="#ffe066"/>' +
          '<circle cx="96" cy="30" r="6" fill="#fcc419"/><circle cx="112" cy="24" r="5.5" fill="#ffd43b"/>' +
          '<circle cx="128" cy="30" r="5" fill="#ffe066"/><circle cx="144" cy="22" r="5" fill="#ffd43b"/>' +
          '<circle cx="38" cy="48" r="5.5" fill="#ffd43b"/><circle cx="52" cy="58" r="6" fill="#fcc419"/>' +
          '<circle cx="66" cy="68" r="5" fill="#ffe066"/>' +
          /* Тюльпан 1 */
          '<g class="h-swing">' +
            '<path d="M84 32 Q84 56 80 72" stroke="#4d8f53" stroke-width="3" stroke-linecap="round"/>' +
            '<path d="M68 72 C68 92, 92 92, 92 72 C88 62, 82 68, 80 60 C78 68, 72 62, 68 72 Z" fill="#f06595"/>' +
            '<path d="M74 72 C74 87, 86 87, 86 72 C84 65, 80 68, 80 63 C80 68, 76 65, 74 72 Z" fill="#ff85b3"/>' +
          '</g>' +
          (isCompact ? '' :
          /* Порхающая бабочка */
          '<g class="h-float">' +
            '<ellipse cx="148" cy="56" rx="8" ry="6" transform="rotate(-25 148 56)" fill="#f783ac"/>' +
            '<ellipse cx="158" cy="58" rx="8" ry="6" transform="rotate(25 158 58)" fill="#faa2c1"/>' +
            '<line x1="153" y1="51" x2="153" y2="66" stroke="#5f3dc4" stroke-width="2" stroke-linecap="round"/>' +
          '</g>') +
        '</svg>';

      case 'spring':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Берёзовая ветка */
          '<path d="M-6 8 C54 28, 114 28, 178 14" stroke="#6c584c" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M18 16 C48 48, 76 64, 122 68" stroke="#7f6759" stroke-width="3" stroke-linecap="round"/>' +
          /* Набухшие почки и молодые зелёные листочки */
          '<path d="M28 16 Q38 4 48 14 Q38 22 28 16 Z" fill="#74c69d"/>' +
          '<path d="M66 24 Q78 8 92 20 Q78 30 66 24 Z" fill="#52b788"/>' +
          '<path d="M114 26 Q126 10 138 22 Q126 32 114 26 Z" fill="#74c69d"/>' +
          '<path d="M154 20 Q168 6 178 18 Q166 28 154 20 Z" fill="#95d5b2"/>' +
          '<ellipse cx="44" cy="36" rx="5" ry="3.5" transform="rotate(28 44 36)" fill="#a98467"/>' +
          '<ellipse cx="86" cy="56" rx="5" ry="3.5" transform="rotate(18 86 56)" fill="#a98467"/>' +
          /* Свисающие берёзовые серёжки */
          '<g class="h-swing">' +
            '<line x1="56" y1="24" x2="54" y2="56" stroke="#7f6759" stroke-width="1.4"/>' +
            '<ellipse cx="54" cy="60" rx="4.2" ry="15" transform="rotate(4 54 60)" fill="#b5c952"/>' +
            '<path d="M51 52 L57 54 M51 58 L57 60 M51 64 L57 66 M51 70 L56 71" stroke="#7f8f29" stroke-width="1.3"/>' +
            '<line x1="62" y1="25" x2="64" y2="49" stroke="#7f6759" stroke-width="1.2"/>' +
            '<ellipse cx="64" cy="54" rx="3.8" ry="12" transform="rotate(-6 64 54)" fill="#c9d966"/>' +
          '</g>' +
          (isCompact ? '' :
          '<g class="h-swing-slow">' +
            '<line x1="126" y1="26" x2="126" y2="58" stroke="#7f6759" stroke-width="1.4"/>' +
            '<ellipse cx="126" cy="64" rx="4.2" ry="15" fill="#b5c952"/>' +
            '<path d="M123 56 L129 58 M123 62 L129 64 M123 68 L129 70" stroke="#7f8f29" stroke-width="1.3"/>' +
            '<line x1="134" y1="25" x2="136" y2="50" stroke="#7f6759" stroke-width="1.2"/>' +
            '<ellipse cx="136" cy="55" rx="3.6" ry="11" transform="rotate(-8 136 55)" fill="#c9d966"/>' +
          '</g>') +
          /* Распускающийся цветок на ветке */
          '<g class="h-bloom">' +
            '<circle cx="96" cy="66" r="5" fill="#fff"/><circle cx="104" cy="62" r="5" fill="#fff"/>' +
            '<circle cx="104" cy="71" r="5" fill="#fff"/><circle cx="95" cy="73" r="5" fill="#fff"/>' +
            '<circle cx="100" cy="67" r="4" fill="#ffd43b"/>' +
          '</g>' +
        '</svg>';

      case 'may1':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Цветущая ветка яблони */
          '<path d="M-6 12 C56 32, 118 28, 184 12" stroke="#5e4638" stroke-width="5" stroke-linecap="round"/>' +
          '<path d="M18 20 C52 54, 88 70, 134 72" stroke="#6f5343" stroke-width="3.2" stroke-linecap="round"/>' +
          /* Зелёные листья */
          '<path d="M26 16 Q38 4 50 18 Q36 24 26 16 Z" fill="#52b788"/>' +
          '<path d="M98 24 Q112 8 124 24 Q110 30 98 24 Z" fill="#40916c"/>' +
          '<path d="M148 16 Q162 4 174 16 Q160 24 148 16 Z" fill="#52b788"/>' +
          /* Цветы яблони */
          '<g class="h-bloom">' +
            '<circle cx="52" cy="30" r="7" fill="#ffd6e0"/><circle cx="62" cy="26" r="7" fill="#ffe5ec"/>' +
            '<circle cx="65" cy="36" r="7" fill="#ffd6e0"/><circle cx="54" cy="40" r="7" fill="#ffe5ec"/>' +
            '<circle cx="47" cy="35" r="7" fill="#fff0f3"/><circle cx="57" cy="33" r="4.5" fill="#ffd43b"/>' +
          '</g>' +
          '<g class="h-bloom">' +
            '<circle cx="114" cy="36" r="6" fill="#ffe5ec"/><circle cx="123" cy="32" r="6" fill="#ffd6e0"/>' +
            '<circle cx="125" cy="42" r="6" fill="#fff0f3"/><circle cx="115" cy="45" r="6" fill="#ffd6e0"/>' +
            '<circle cx="119" cy="39" r="3.8" fill="#fcc419"/>' +
          '</g>' +
          /* Свисающие первомайские ленты */
          '<g class="h-swing">' +
            '<path d="M84 30 Q78 58 84 82" stroke="#e63946" stroke-width="5" stroke-linecap="round"/>' +
            '<path d="M92 31 Q98 56 90 76" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>' +
          '</g>' +
          (isCompact ? '' :
          '<g class="h-swing-slow">' +
            '<polygon points="154,20 168,20 161,44" fill="#ef4444"/>' +
            '<polygon points="170,16 184,16 177,40" fill="#fbbf24"/>' +
          '</g>') +
        '</svg>';

      case 'sep1':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Осенняя ветвь */
          '<path d="M-4 8 C54 30, 114 26, 176 12" stroke="#5c3d2e" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M16 18 C52 54, 86 68, 128 70" stroke="#6f4a37" stroke-width="3" stroke-linecap="round"/>' +
          /* Резные кленовые листья */
          '<path d="M48 16 L54 8 L58 18 L68 15 L62 24 L70 30 L58 31 L56 42 L51 31 L39 30 L47 24 L40 16 Z" fill="#e8590c"/>' +
          '<path d="M116 14 L122 5 L126 15 L136 12 L130 22 L138 28 L126 29 L124 40 L118 29 L106 28 L115 21 L108 13 Z" fill="#f59f00"/>' +
          '<path d="M26 42 L34 36 L36 46 L46 46 L38 54 L43 62 L32 60 L28 70 L25 59 L15 60 L22 52 L17 44 Z" fill="#d9480f"/>' +
          /* Гроздь рябины */
          '<g class="h-swing">' +
            '<line x1="84" y1="28" x2="84" y2="52" stroke="#5c3d2e" stroke-width="1.6"/>' +
            '<circle cx="78" cy="56" r="5" fill="#e03131"/><circle cx="88" cy="56" r="5" fill="#c92a2a"/>' +
            '<circle cx="83" cy="63" r="5" fill="#fa5252"/><circle cx="76" cy="65" r="4.5" fill="#c92a2a"/>' +
            '<circle cx="90" cy="65" r="4.5" fill="#e03131"/><circle cx="83" cy="71" r="4.8" fill="#c92a2a"/>' +
          '</g>' +
          (isCompact ? '' :
          /* Золотой колокольчик 1 сентября */
          '<g class="h-swing-slow">' +
            '<line x1="152" y1="18" x2="152" y2="42" stroke="#f59f00" stroke-width="1.5"/>' +
            '<path d="M142 58 Q142 42 152 42 Q162 42 162 58 L166 63 L138 63 Z" fill="#fcc419"/>' +
            '<circle cx="152" cy="65" r="3" fill="#d97706"/>' +
          '</g>') +
        '</svg>';

      case 'nov4':
        return '<svg viewBox="0 0 220 155" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Ветка с дубовыми листьями */
          '<path d="M-4 8 C56 30, 118 28, 178 14" stroke="#5c3d2e" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M24 20 C36 6, 56 8, 62 22 C54 32, 34 32, 24 20 Z" fill="#d97706"/>' +
          '<path d="M112 20 C124 6, 146 8, 152 22 C144 32, 122 32, 112 20 Z" fill="#b45309"/>' +
          /* Развевающаяся лента триколор */
          '<g class="h-ribbon-wave">' +
            '<path d="M0 10 C48 26, 98 10, 168 24 L165 30 C98 16, 48 32, 0 16 Z" fill="#ffffff"/>' +
            '<path d="M0 16 C48 32, 98 16, 165 30 L163 36 C98 22, 48 38, 0 22 Z" fill="#1d4ed8"/>' +
            '<path d="M0 22 C48 38, 98 22, 163 36 L160 42 C98 28, 48 44, 0 28 Z" fill="#dc2626"/>' +
          '</g>' +
          /* Гроздь рябины */
          '<g class="h-swing">' +
            '<line x1="82" y1="30" x2="82" y2="54" stroke="#5c3d2e" stroke-width="1.6"/>' +
            '<circle cx="76" cy="58" r="5" fill="#dc2626"/><circle cx="87" cy="58" r="5" fill="#b91c1c"/>' +
            '<circle cx="82" cy="65" r="5" fill="#ef4444"/><circle cx="76" cy="68" r="4.5" fill="#b91c1c"/>' +
            '<circle cx="88" cy="68" r="4.5" fill="#dc2626"/><circle cx="82" cy="74" r="4.5" fill="#b91c1c"/>' +
          '</g>' +
        '</svg>';

      default:
        return '';
    }
  }

  function getCornerBranchRightSvg(subtheme, isCompact) {
    var leftSvg = getCornerBranchLeftSvg(subtheme, isCompact);
    if (!leftSvg) return '';
    return '<div style="width:100%;height:100%;transform:scaleX(-1);">' + leftSvg + '</div>';
  }

  function getBannerGarlandSvg(subtheme) {
    if (subtheme === 'new-year') {
      return '<svg viewBox="0 0 900 72" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M0 8 Q225 46 450 14 Q675 46 900 8" stroke="#1b4328" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M0 10 Q225 48 450 16 Q675 48 900 10" stroke="#2d6a3e" stroke-width="3" stroke-dasharray="10 6" stroke-linecap="round"/>' +
        '<circle class="h-twinkle" cx="140" cy="24" r="4.5" fill="#ffd43b"/>' +
        '<circle class="h-twinkle-2" cx="230" cy="30" r="4.5" fill="#ff6b6b"/>' +
        '<circle class="h-twinkle-3" cx="320" cy="25" r="4.5" fill="#74c0fc"/>' +
        '<circle class="h-twinkle" cx="450" cy="18" r="5" fill="#ffd43b"/>' +
        '<circle class="h-twinkle-2" cx="580" cy="25" r="4.5" fill="#69db7c"/>' +
        '<circle class="h-twinkle-3" cx="670" cy="30" r="4.5" fill="#ff6b6b"/>' +
        '<circle class="h-twinkle" cx="760" cy="24" r="4.5" fill="#74c0fc"/>' +
      '</svg>';
    }
    if (subtheme === 'may1') {
      return '<svg viewBox="0 0 900 58" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M0 6 Q225 36 450 10 Q675 36 900 6" stroke="#c08457" stroke-width="2"/>' +
        '<polygon points="180,18 202,21 190,42" fill="#ef4444"/>' +
        '<polygon points="270,22 292,22 281,44" fill="#fbbf24"/>' +
        '<polygon points="360,16 382,13 372,36" fill="#38bdf8"/>' +
        '<polygon points="520,13 542,16 530,36" fill="#f472b6"/>' +
        '<polygon points="610,22 632,22 621,44" fill="#34d399"/>' +
        '<polygon points="700,21 722,18 712,42" fill="#ef4444"/>' +
      '</svg>';
    }
    if (subtheme === 'nov4') {
      return '<svg viewBox="0 0 900 42" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M0 3 Q225 26 450 6 Q675 26 900 3" stroke="#ffffff" stroke-width="3" opacity="0.85"/>' +
        '<path d="M0 6 Q225 29 450 9 Q675 29 900 6" stroke="#1d4ed8" stroke-width="3" opacity="0.9"/>' +
        '<path d="M0 9 Q225 32 450 12 Q675 32 900 9" stroke="#dc2626" stroke-width="3" opacity="0.9"/>' +
      '</svg>';
    }
    return '';
  }

  function getSnowCapSvg() {
    return '<svg viewBox="0 0 360 18" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M0 0 H360 V6 C340 12, 315 3, 290 9 C265 15, 240 4, 212 10 C184 16, 160 5, 130 11 C100 16, 75 4, 48 10 C25 14, 10 6, 0 8 Z" fill="#f1f8ff" opacity="0.9"/>' +
    '</svg>';
  }

  function getCardBottomLeftSvg(subtheme) {
    switch (subtheme) {
      case 'spring':
        return '<svg viewBox="0 0 90 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M18 58 Q18 34 30 22" stroke="#40916c" stroke-width="2.5" stroke-linecap="round"/>' +
          '<path d="M24 58 Q36 32 52 24" stroke="#52b788" stroke-width="2.5" stroke-linecap="round"/>' +
          '<path d="M14 58 Q8 42 14 32 Q20 44 18 58 Z" fill="#74c69d"/>' +
          /* Подснежники */
          '<path d="M30 22 C24 28, 24 37, 30 39 C35 37, 36 28, 30 22 Z" fill="#ffffff"/>' +
          '<path d="M52 24 C47 30, 48 39, 54 40 C58 38, 58 29, 52 24 Z" fill="#e9f5ff"/>' +
          /* Крокус */
          '<g class="h-bloom">' +
            '<circle cx="68" cy="44" r="5" fill="#9775fa"/><circle cx="76" cy="40" r="5" fill="#b197fc"/>' +
            '<circle cx="76" cy="49" r="5" fill="#9775fa"/><circle cx="72" cy="44" r="3" fill="#ffd43b"/>' +
          '</g>' +
        '</svg>';
      case 'mar8':
        return '<svg viewBox="0 0 90 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M22 58 L22 30 M44 58 L40 26" stroke="#40916c" stroke-width="2.5" stroke-linecap="round"/>' +
          '<path d="M14 30 C14 14, 30 14, 30 30 C26 35, 18 35, 14 30 Z" fill="#f06595"/>' +
          '<path d="M32 26 C32 10, 48 10, 48 26 C44 31, 36 31, 32 26 Z" fill="#fcc419"/>' +
          '<circle cx="58" cy="40" r="4" fill="#ffd43b"/><circle cx="66" cy="36" r="4" fill="#fcc419"/>' +
        '</svg>';
      case 'may1':
        return '<svg viewBox="0 0 90 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M14 58 Q30 40 50 46" stroke="#52b788" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="28" cy="40" r="5.5" fill="#ffd6e0"/><circle cx="36" cy="37" r="5.5" fill="#ffe5ec"/>' +
          '<circle cx="37" cy="46" r="5.5" fill="#ffd6e0"/><circle cx="29" cy="47" r="5.5" fill="#fff0f3"/>' +
          '<circle cx="33" cy="42" r="3.2" fill="#ffd43b"/>' +
          '<circle cx="56" cy="44" r="4.5" fill="#ffe5ec"/><circle cx="63" cy="42" r="4.5" fill="#ffd6e0"/>' +
          '<circle cx="59" cy="47" r="2.8" fill="#fcc419"/>' +
        '</svg>';
      case 'sep1':
        return '<svg viewBox="0 0 90 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M18 54 L22 40 L30 48 L36 36 L42 49 L52 44 L44 56 Z" fill="#e8590c"/>' +
          '<path d="M48 56 L55 44 L62 52 L70 46 L68 58 Z" fill="#f59f00"/>' +
          '<circle cx="24" cy="52" r="3.5" fill="#e03131"/><circle cx="30" cy="54" r="3.5" fill="#c92a2a"/>' +
        '</svg>';
      default:
        return '';
    }
  }

  function getCornerMascotSvg(subtheme) {
    switch (subtheme) {
      case 'new-year':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Шевелящаяся нарядная ёлочка справа */
          '<g class="h-tree-wiggle">' +
            '<rect x="98" y="122" width="12" height="18" rx="2" fill="#6b3f24"/>' +
            '<polygon points="104,24 72,72 136,72" fill="#1b5e36"/>' +
            '<polygon points="104,48 64,98 144,98" fill="#217042"/>' +
            '<polygon points="104,74 56,126 150,126" fill="#27824d"/>' +
            /* Звезда на ёлочке */
            '<polygon points="104,10 107,18 115,18 109,23 111,31 104,26 97,31 99,23 93,18 101,18" fill="#ffd43b"/>' +
            /* Игрушки и огоньки */
            '<circle cx="96" cy="60" r="4.5" fill="#fa5252"/>' +
            '<circle cx="114" cy="64" r="4.5" fill="#74c0fc"/>' +
            '<circle cx="88" cy="88" r="5" fill="#ffd43b"/>' +
            '<circle cx="118" cy="90" r="5" fill="#fa5252"/>' +
            '<circle cx="80" cy="114" r="5.5" fill="#74c0fc"/>' +
            '<circle cx="105" cy="110" r="5" fill="#ffd43b"/>' +
            '<circle cx="128" cy="116" r="5" fill="#ff8787"/>' +
            '<circle class="h-twinkle" cx="104" cy="46" r="3" fill="#fff3bf"/>' +
            '<circle class="h-twinkle-2" cx="98" cy="78" r="3" fill="#fff3bf"/>' +
            '<circle class="h-twinkle-3" cx="112" cy="100" r="3" fill="#fff3bf"/>' +
          '</g>' +
          /* Выглядывающий Дед Мороз слева */
          '<g class="h-santa-peek">' +
            /* Машущая рука */
            '<g class="h-santa-arm">' +
              '<path d="M26 98 Q12 80 18 66" stroke="#c92a2a" stroke-width="11" stroke-linecap="round"/>' +
              '<circle cx="18" cy="64" r="6.5" fill="#ffffff"/>' +
            '</g>' +
            /* Шуба */
            '<path d="M22 142 C22 100, 74 100, 74 142 Z" fill="#c92a2a"/>' +
            '<rect x="44" y="108" width="8" height="34" fill="#ffffff" rx="3"/>' +
            /* Голова */
            '<circle cx="48" cy="88" r="18" fill="#ffd8b8"/>' +
            /* Глаза и нос */
            '<circle cx="42" cy="84" r="2.2" fill="#2b2d42"/>' +
            '<circle cx="54" cy="84" r="2.2" fill="#2b2d42"/>' +
            '<circle cx="48" cy="89" r="3.4" fill="#ff6b6b"/>' +
            /* Пышная белая борода и усы */
            '<path d="M30 90 C28 114, 48 126, 48 126 C48 126, 68 114, 66 90 C60 95, 36 95, 30 90 Z" fill="#ffffff"/>' +
            '<path d="M38 92 Q48 96 58 92" stroke="#f1f3f5" stroke-width="4" stroke-linecap="round"/>' +
            /* Шапка Деда Мороза */
            '<path d="M28 77 C30 56, 60 52, 68 74 Z" fill="#c92a2a"/>' +
            '<path d="M58 58 Q72 60 72 72" stroke="#c92a2a" stroke-width="8" stroke-linecap="round"/>' +
            '<circle cx="72" cy="73" r="6" fill="#ffffff"/>' +
            '<rect x="26" y="72" width="44" height="9" rx="4.5" fill="#ffffff"/>' +
          '</g>' +
        '</svg>';

      case 'feb23':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<g class="h-tree-wiggle">' +
            '<path d="M75 134 C44 128, 26 102, 28 66" stroke="#2d6a3e" stroke-width="5" stroke-linecap="round"/>' +
            '<path d="M75 134 C106 128, 124 102, 122 66" stroke="#2d6a3e" stroke-width="5" stroke-linecap="round"/>' +
            '<ellipse cx="34" cy="108" rx="10" ry="4.5" transform="rotate(-35 34 108)" fill="#40916c"/>' +
            '<ellipse cx="28" cy="84" rx="10" ry="4.5" transform="rotate(-15 28 84)" fill="#52b788"/>' +
            '<ellipse cx="116" cy="108" rx="10" ry="4.5" transform="rotate(35 116 108)" fill="#40916c"/>' +
            '<ellipse cx="122" cy="84" rx="10" ry="4.5" transform="rotate(15 122 84)" fill="#52b788"/>' +
            /* Триколор лента снизу */
            '<path d="M40 124 Q75 138 110 124 L108 130 Q75 144 42 130 Z" fill="#ffffff"/>' +
            '<path d="M42 130 Q75 144 108 130 L106 135 Q75 149 44 135 Z" fill="#1d4ed8"/>' +
            '<path d="M44 135 Q75 149 106 135 L104 140 Q75 154 46 140 Z" fill="#dc2626"/>' +
          '</g>' +
          '<g class="h-bloom">' +
            '<polygon points="75,34 86,62 116,64 92,82 100,111 75,94 50,111 58,82 34,64 64,62" fill="#d63031" stroke="#ffd43b" stroke-width="3"/>' +
            '<polygon points="75,44 82,64 102,66 86,78 92,98 75,86 58,98 64,78 48,66 68,64" fill="#ff7675" opacity="0.45"/>' +
          '</g>' +
          '<circle class="h-twinkle" cx="38" cy="36" r="4" fill="#ffd43b"/>' +
          '<circle class="h-twinkle-2" cx="116" cy="38" r="4.5" fill="#ff8787"/>' +
          '<circle class="h-twinkle-3" cx="75" cy="18" r="3.5" fill="#74c0fc"/>' +
        '</svg>';

      case 'mar8':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<g class="h-tree-wiggle">' +
            '<path d="M75 138 L52 68 M75 138 L75 56 M75 138 L98 68" stroke="#2d6a4f" stroke-width="4" stroke-linecap="round"/>' +
            '<path d="M62 104 Q38 86 44 68 Q62 84 62 104 Z" fill="#40916c"/>' +
            '<path d="M88 104 Q112 86 106 68 Q88 84 88 104 Z" fill="#52b788"/>' +
            /* Тюльпаны */
            '<path d="M38 66 C38 86, 62 86, 62 66 C58 52, 52 60, 50 48 C48 60, 42 52, 38 66 Z" fill="#f06595"/>' +
            '<path d="M62 56 C62 78, 88 78, 88 56 C84 40, 78 48, 75 36 C72 48, 66 40, 62 56 Z" fill="#e64980"/>' +
            '<path d="M88 68 C88 88, 112 88, 112 68 C108 54, 102 62, 100 50 C98 62, 92 54, 88 68 Z" fill="#f783ac"/>' +
            /* Мимоза */
            '<circle cx="44" cy="96" r="5" fill="#ffd43b"/><circle cx="54" cy="90" r="5" fill="#fcc419"/>' +
            '<circle cx="96" cy="94" r="5" fill="#ffd43b"/><circle cx="106" cy="88" r="5" fill="#ffe066"/>' +
            /* Бантик */
            '<ellipse cx="66" cy="116" rx="10" ry="6" fill="#ff85b3"/>' +
            '<ellipse cx="84" cy="116" rx="10" ry="6" fill="#ff85b3"/>' +
            '<circle cx="75" cy="116" r="4.5" fill="#d6336c"/>' +
          '</g>' +
          '<g class="h-float">' +
            '<ellipse cx="114" cy="40" rx="8" ry="6" transform="rotate(-25 114 40)" fill="#ffd43b"/>' +
            '<ellipse cx="124" cy="42" rx="8" ry="6" transform="rotate(25 124 42)" fill="#ffe066"/>' +
          '</g>' +
        '</svg>';

      case 'spring':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Веточка с серёжками и почки */
          '<path d="M18 68 Q68 58 134 72" stroke="#6c584c" stroke-width="4" stroke-linecap="round"/>' +
          '<g class="h-swing">' +
            '<line x1="48" y1="64" x2="46" y2="86" stroke="#7f6759" stroke-width="1.3"/>' +
            '<ellipse cx="46" cy="92" rx="4" ry="11" fill="#b5c952"/>' +
            '<line x1="112" y1="67" x2="112" y2="88" stroke="#7f6759" stroke-width="1.3"/>' +
            '<ellipse cx="112" cy="94" rx="4" ry="11" fill="#c9d966"/>' +
          '</g>' +
          /* Весенняя птичка на ветке */
          '<g class="h-tree-wiggle">' +
            '<ellipse cx="80" cy="54" rx="16" ry="12" fill="#ffd43b"/>' +
            '<circle cx="92" cy="44" r="9" fill="#3b82f6"/>' +
            '<ellipse cx="75" cy="52" rx="11" ry="7" fill="#52b788"/>' +
            '<polygon points="100,44 108,46 100,49" fill="#495057"/>' +
            '<circle cx="94" cy="42" r="2" fill="#ffffff"/>' +
            '<circle cx="94.5" cy="42" r="1" fill="#000000"/>' +
          '</g>' +
          /* Распускающиеся подснежники внизу */
          '<g class="h-bloom">' +
            '<path d="M56 140 Q56 114 68 104" stroke="#40916c" stroke-width="2.5" stroke-linecap="round"/>' +
            '<path d="M68 104 C62 112, 62 122, 68 124 C74 122, 74 112, 68 104 Z" fill="#ffffff"/>' +
            '<path d="M84 140 Q88 112 100 106" stroke="#52b788" stroke-width="2.5" stroke-linecap="round"/>' +
            '<path d="M100 106 C94 114, 95 123, 101 125 C106 123, 106 114, 100 106 Z" fill="#f1f9ff"/>' +
          '</g>' +
        '</svg>';

      case 'may1':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Воздушные шары */
          '<g class="h-float">' +
            '<line x1="56" y1="88" x2="72" y2="128" stroke="#e9ecef" stroke-width="1.3"/>' +
            '<line x1="78" y1="74" x2="74" y2="128" stroke="#e9ecef" stroke-width="1.3"/>' +
            '<line x1="100" y1="88" x2="76" y2="128" stroke="#e9ecef" stroke-width="1.3"/>' +
            '<ellipse cx="52" cy="64" rx="16" ry="20" fill="#ef4444"/>' +
            '<ellipse cx="47" cy="56" rx="4" ry="7" fill="#fca5a5" opacity="0.6"/>' +
            '<ellipse cx="78" cy="48" rx="17" ry="22" fill="#38bdf8"/>' +
            '<ellipse cx="72" cy="40" rx="4" ry="8" fill="#bae6fd" opacity="0.6"/>' +
            '<ellipse cx="102" cy="64" rx="16" ry="20" fill="#fbbf24"/>' +
            '<ellipse cx="97" cy="56" rx="4" ry="7" fill="#fef08a" opacity="0.7"/>' +
          '</g>' +
          /* Ветка цветущей яблони снизу */
          '<path d="M22 132 Q75 118 128 134" stroke="#5e4638" stroke-width="4" stroke-linecap="round"/>' +
          '<g class="h-bloom">' +
            '<circle cx="48" cy="122" r="6" fill="#ffd6e0"/><circle cx="56" cy="118" r="6" fill="#ffe5ec"/>' +
            '<circle cx="56" cy="127" r="6" fill="#ffd6e0"/><circle cx="52" cy="122" r="3.5" fill="#ffd43b"/>' +
            '<circle cx="94" cy="122" r="6" fill="#ffe5ec"/><circle cx="102" cy="118" r="6" fill="#ffd6e0"/>' +
            '<circle cx="102" cy="127" r="6" fill="#fff0f3"/><circle cx="98" cy="122" r="3.5" fill="#fcc419"/>' +
          '</g>' +
        '</svg>';

      case 'sep1':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Осенние кленовые листья на фоне */
          '<g class="h-tree-wiggle">' +
            '<path d="M104 42 L112 24 L118 40 L134 34 L124 50 L136 60 L118 62 L114 78 L108 62 L90 60 L102 50 L92 34 Z" fill="#e8590c"/>' +
            '<path d="M36 52 L42 38 L47 50 L58 46 L52 58 L60 66 L47 68 L44 80 L40 68 L27 66 L36 58 L29 46 Z" fill="#f59f00"/>' +
          '</g>' +
          /* Уютный осенний ёжик с яблочком и грибочком */
          '<g class="h-santa-peek">' +
            /* Иголки */
            '<ellipse cx="64" cy="112" rx="34" ry="24" fill="#6d4c3d"/>' +
            '<path d="M34 102 L26 94 M42 94 L38 82 M56 90 L56 76 M72 90 L76 78 M86 96 L96 86" stroke="#5c3d2e" stroke-width="4" stroke-linecap="round"/>' +
            /* Яблочко на спине */
            '<circle cx="52" cy="86" r="10" fill="#e03131"/>' +
            '<path d="M52 76 Q56 70 60 72" stroke="#52b788" stroke-width="3" stroke-linecap="round"/>' +
            /* Мордочка ёжика */
            '<path d="M80 102 Q108 104 114 118 Q104 134 78 134 Z" fill="#e6ccb2"/>' +
            '<circle cx="114" cy="118" r="4" fill="#2b2d42"/>' +
            '<circle cx="96" cy="112" r="2.5" fill="#2b2d42"/>' +
            '<ellipse cx="52" cy="134" rx="7" ry="4" fill="#b08968"/>' +
            '<ellipse cx="86" cy="134" rx="7" ry="4" fill="#b08968"/>' +
          '</g>' +
          /* Колокольчик 1 сентября */
          '<g class="h-swing">' +
            '<path d="M114 112 Q114 96 124 96 Q134 96 134 112 L138 118 L110 118 Z" fill="#fcc419"/>' +
            '<circle cx="124" cy="120" r="3" fill="#d97706"/>' +
          '</g>' +
        '</svg>';

      case 'nov4':
        return '<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          /* Развевающийся российский триколор */
          '<g class="h-ribbon-wave">' +
            '<path d="M24 54 Q58 38 88 54 Q114 68 136 52 L136 68 Q114 84 88 70 Q58 54 24 70 Z" fill="#ffffff"/>' +
            '<path d="M24 70 Q58 54 88 70 Q114 84 136 68 L136 84 Q114 100 88 86 Q58 70 24 86 Z" fill="#1d4ed8"/>' +
            '<path d="M24 86 Q58 70 88 86 Q114 100 136 84 L136 100 Q114 116 88 102 Q58 86 24 102 Z" fill="#dc2626"/>' +
          '</g>' +
          /* Ветка рябины и золотого дуба */
          '<g class="h-tree-wiggle">' +
            '<path d="M26 116 Q75 104 126 122" stroke="#5c3d2e" stroke-width="4" stroke-linecap="round"/>' +
            '<path d="M88 112 C102 96, 124 98, 130 114 C122 126, 98 126, 88 112 Z" fill="#d97706"/>' +
            '<circle cx="52" cy="116" r="5" fill="#dc2626"/><circle cx="62" cy="114" r="5" fill="#b91c1c"/>' +
            '<circle cx="57" cy="123" r="5" fill="#ef4444"/><circle cx="67" cy="122" r="4.5" fill="#dc2626"/>' +
            '<circle cx="60" cy="130" r="4.5" fill="#b91c1c"/>' +
          '</g>' +
        '</svg>';

      default:
        return '';
    }
  }

  function getLogoBadgeSvg(subtheme) {
    switch (subtheme) {
      case 'new-year':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M6 22 C8 8, 22 4, 27 16 L24 22 Z" fill="#c92a2a"/>' +
          '<circle cx="27" cy="17" r="3.5" fill="#ffffff"/>' +
          '<rect x="4" y="20" width="22" height="5" rx="2.5" fill="#ffffff"/>' +
        '</svg>';
      case 'feb23':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<polygon points="16,3 20,12 29,13 22,19 24,28 16,23 8,28 10,19 3,13 12,12" fill="#d63031" stroke="#ffd43b" stroke-width="1.5"/>' +
        '</svg>';
      case 'mar8':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M16 28 L16 14" stroke="#40916c" stroke-width="2.5"/>' +
          '<path d="M9 14 C9 23, 23 23, 23 14 C20 8, 18 11, 16 6 C14 11, 12 8, 9 14 Z" fill="#f06595"/>' +
        '</svg>';
      case 'spring':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M16 28 Q16 16 24 10" stroke="#52b788" stroke-width="2.5" stroke-linecap="round"/>' +
          '<circle cx="13" cy="14" r="4" fill="#fff"/><circle cx="19" cy="11" r="4" fill="#fff"/>' +
          '<circle cx="21" cy="17" r="4" fill="#fff"/><circle cx="15" cy="19" r="4" fill="#fff"/>' +
          '<circle cx="17" cy="15" r="3" fill="#ffd43b"/>' +
        '</svg>';
      case 'may1':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="12" cy="13" r="5" fill="#ffd6e0"/><circle cx="20" cy="13" r="5" fill="#ffe5ec"/>' +
          '<circle cx="20" cy="21" r="5" fill="#ffd6e0"/><circle cx="12" cy="21" r="5" fill="#fff0f3"/>' +
          '<circle cx="16" cy="17" r="3.5" fill="#ffd43b"/>' +
        '</svg>';
      case 'sep1':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M16 4 L19 11 L26 9 L21 15 L26 20 L18 21 L16 28 L14 21 L6 20 L11 15 L6 9 L13 11 Z" fill="#e8590c"/>' +
        '</svg>';
      case 'nov4':
        return '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<rect x="5" y="7" width="22" height="6" rx="1" fill="#ffffff"/>' +
          '<rect x="5" y="13" width="22" height="6" rx="1" fill="#1d4ed8"/>' +
          '<rect x="5" y="19" width="22" height="6" rx="1" fill="#dc2626"/>' +
        '</svg>';
      default:
        return '';
    }
  }

  function getParticleSvg(subtheme, idx) {
    switch (subtheme) {
      case 'new-year':
        return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';
      case 'feb23':
        var febColor = idx % 2 === 0 ? '#ffd43b' : '#ff6b6b';
        return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="12,2 14.8,9 22,9.5 16.5,14.2 18.2,21.5 12,17.5 5.8,21.5 7.5,14.2 2,9.5 9.2,9" fill="' + febColor + '"/></svg>';
      case 'mar8':
        return idx % 3 === 0
          ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" fill="#ffd43b"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 C18 7, 18 17, 12 21 C6 17, 6 7, 12 3 Z" fill="#f783ac"/></svg>';
      case 'spring':
        return idx % 2 === 0
          ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 C17 8, 17 16, 12 21 C7 16, 7 8, 12 3 Z" fill="#ffffff" opacity="0.9"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 16 Q12 4 20 8 Q16 20 4 16 Z" fill="#8ce99a"/></svg>';
      case 'may1':
        var mayColors = ['#ffd6e0', '#ffb3c6', '#ffe5ec', '#fbbf24'];
        return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4 C17 8, 17 16, 12 20 C7 16, 7 8, 12 4 Z" fill="' + mayColors[idx % mayColors.length] + '"/></svg>';
      case 'sep1':
        var autumnColors = ['#e8590c', '#f59f00', '#d9480f', '#c92a2a'];
        return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L15 8 L21 7 L17 13 L21 17 L14 18 L12 23 L10 18 L3 17 L7 13 L3 7 L9 8 Z" fill="' + autumnColors[idx % autumnColors.length] + '"/></svg>';
      case 'nov4':
        var novColors = ['#d97706', '#dc2626', '#f59f00', '#3b82f6'];
        return idx % 3 === 0
          ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="#dc2626"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 C18 7, 18 17, 12 21 C6 17, 6 7, 12 3 Z" fill="' + novColors[idx % novColors.length] + '"/></svg>';
      default:
        return '';
    }
  }

  /* ========================================================================
     Монтирование и обновление декоративных слоёв в DOM
     ======================================================================== */

  function removeAllDecorations() {
    var existing = document.querySelectorAll(
      '.holiday-particles-layer, .holiday-screen-corners, .holiday-banner-decor, ' +
      '.holiday-card-decor, .holiday-corner-mascot, .holiday-logo-badge, .holiday-corner-mascot-inline'
    );
    existing.forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('[data-holiday-subtheme]').forEach(function (el) {
      el.removeAttribute('data-holiday-subtheme');
    });
  }

  function renderParticles(subtheme) {
    if (!document.body || subtheme === 'none' || !currentState.particles) return;
    if (document.querySelector('.holiday-particles-layer')) return;

    var layer = document.createElement('div');
    layer.className = 'holiday-particles-layer';
    layer.setAttribute('aria-hidden', 'true');

    var count = 20;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'holiday-particle';
      var leftPct = ((i * 37 + 11) % 96) + 2;
      var sizePx = 11 + ((i * 5) % 10);
      var durSec = 8.5 + ((i * 3) % 7);
      var delaySec = -((i * 1.7) % 10);
      var swaySec = 2.8 + (i % 4) * 0.7;
      var driftPx = ((i % 2 === 0 ? 1 : -1) * (25 + (i % 5) * 14));
      var opacityVal = 0.55 + ((i % 4) * 0.1);

      p.style.setProperty('--p-left', leftPct + '%');
      p.style.setProperty('--p-size', sizePx + 'px');
      p.style.setProperty('--p-dur', durSec.toFixed(1) + 's');
      p.style.setProperty('--p-delay', delaySec.toFixed(1) + 's');
      p.style.setProperty('--p-sway-dur', swaySec.toFixed(1) + 's');
      p.style.setProperty('--p-drift', driftPx + 'px');
      p.style.setProperty('--p-opacity', opacityVal.toFixed(2));
      p.innerHTML = getParticleSvg(subtheme, i);
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
  }

  function renderScreenCorners(subtheme) {
    if (!document.body || subtheme === 'none') return;
    if (document.querySelector('.holiday-screen-corners')) return;

    var container = document.createElement('div');
    container.className = 'holiday-screen-corners';
    container.setAttribute('aria-hidden', 'true');

    var left = document.createElement('div');
    left.className = 'holiday-corner-branch holiday-corner-branch--left';
    left.innerHTML = getCornerBranchLeftSvg(subtheme, false);

    var right = document.createElement('div');
    right.className = 'holiday-corner-branch holiday-corner-branch--right';
    right.innerHTML = getCornerBranchRightSvg(subtheme, false);

    container.appendChild(left);
    container.appendChild(right);
    document.body.appendChild(container);
  }

  function renderCornerMascot(subtheme) {
    if (!document.body || subtheme === 'none') return;
    var svg = getCornerMascotSvg(subtheme);
    if (!svg) return;

    if (!document.querySelector('.holiday-corner-mascot')) {
      var mascot = document.createElement('div');
      mascot.className = 'holiday-corner-mascot';
      mascot.setAttribute('aria-hidden', 'true');
      mascot.innerHTML = svg;
      document.body.appendChild(mascot);
    }

    var previewArea = document.getElementById('previewArea');
    if (previewArea && !previewArea.querySelector('.holiday-corner-mascot-inline')) {
      var inlineMascot = document.createElement('div');
      inlineMascot.className = 'holiday-corner-mascot-inline';
      inlineMascot.setAttribute('aria-hidden', 'true');
      inlineMascot.innerHTML = svg;
      previewArea.appendChild(inlineMascot);
    }
  }

  function decorateBanner(container, subtheme) {
    if (!container || subtheme === 'none') return;
    if (container.getAttribute('data-holiday-subtheme') === subtheme) return;

    var old = container.querySelector('.holiday-banner-decor');
    if (old) old.remove();

    var decor = document.createElement('div');
    decor.className = 'holiday-banner-decor';
    decor.setAttribute('aria-hidden', 'true');

    var garland = getBannerGarlandSvg(subtheme);
    if (garland) {
      var gWrap = document.createElement('div');
      gWrap.className = 'holiday-banner-garland';
      gWrap.innerHTML = garland;
      decor.appendChild(gWrap);
    }

    var left = document.createElement('div');
    left.className = 'holiday-banner-left';
    left.innerHTML = getCornerBranchLeftSvg(subtheme, false);
    decor.appendChild(left);

    var right = document.createElement('div');
    right.className = 'holiday-banner-right';
    right.innerHTML = getCornerBranchRightSvg(subtheme, false);
    decor.appendChild(right);

    container.setAttribute('data-holiday-subtheme', subtheme);
    container.appendChild(decor);
  }

  function decorateCard(card, subtheme, includeRightBranch) {
    if (!card || subtheme === 'none') return;
    if (card.getAttribute('data-holiday-subtheme') === subtheme) return;

    var old = card.querySelector('.holiday-card-decor');
    if (old) old.remove();

    var decor = document.createElement('div');
    decor.className = 'holiday-card-decor';
    decor.setAttribute('aria-hidden', 'true');

    if (subtheme === 'new-year') {
      var cap = document.createElement('div');
      cap.className = 'holiday-snow-cap';
      cap.innerHTML = getSnowCapSvg();
      decor.appendChild(cap);
    }

    var topLeft = document.createElement('div');
    topLeft.className = 'holiday-card-top-left';
    topLeft.innerHTML = getCornerBranchLeftSvg(subtheme, true);
    decor.appendChild(topLeft);

    if (includeRightBranch) {
      var topRight = document.createElement('div');
      topRight.className = 'holiday-card-top-right';
      topRight.innerHTML = getCornerBranchRightSvg(subtheme, true);
      decor.appendChild(topRight);
    }

    var bottomSvg = getCardBottomLeftSvg(subtheme);
    if (bottomSvg) {
      var bottomLeft = document.createElement('div');
      bottomLeft.className = 'holiday-card-bottom-left';
      bottomLeft.innerHTML = bottomSvg;
      decor.appendChild(bottomLeft);
    }

    card.setAttribute('data-holiday-subtheme', subtheme);
    card.appendChild(decor);
  }

  function decorateLogos(subtheme) {
    if (subtheme === 'none') return;
    var badgeSvg = getLogoBadgeSvg(subtheme);
    if (!badgeSvg) return;

    var targets = document.querySelectorAll('#main-logo-link, #cabinBrandLink, .admin-brand');
    targets.forEach(function (logo) {
      if (logo.getAttribute('data-holiday-subtheme') === subtheme) return;
      var old = logo.querySelector('.holiday-logo-badge');
      if (old) old.remove();
      var badge = document.createElement('span');
      badge.className = 'holiday-logo-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = badgeSvg;
      logo.setAttribute('data-holiday-subtheme', subtheme);
      logo.appendChild(badge);
    });
  }

  function syncDomDecorations() {
    var subtheme = currentState.subtheme;
    if (!document.body || subtheme === 'none') return;

    renderParticles(subtheme);
    renderScreenCorners(subtheme);
    renderCornerMascot(subtheme);
    decorateLogos(subtheme);

    document.querySelectorAll('.hero-stage, #previewArea').forEach(function (el) {
      decorateBanner(el, subtheme);
    });

    document.querySelectorAll('.house-card, .hero-booking, .calendar-card, .checkout-card, .cta-card, .feature-panel, .cabin-hero-card').forEach(function (card) {
      var withRight = card.classList.contains('cta-card') || card.classList.contains('calendar-card') || card.classList.contains('checkout-card') || card.classList.contains('cabin-hero-card');
      decorateCard(card, subtheme, withRight);
    });
  }

  function scheduleSync() {
    if (syncScheduled || currentState.subtheme === 'none') return;
    syncScheduled = true;
    requestAnimationFrame(function () {
      syncScheduled = false;
      syncDomDecorations();
    });
  }

  function ensureObserver() {
    if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
    observer = new MutationObserver(function (mutations) {
      if (currentState.subtheme === 'none') return;
      var hasNewElements = mutations.some(function (m) {
        return m.addedNodes && m.addedNodes.length > 0;
      });
      if (hasNewElements) {
        scheduleSync();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function apply(subtheme, particlesEnabled) {
    var nextSubtheme = normalizeSubtheme(subtheme);
    var nextParticles = particlesEnabled === undefined ? currentState.particles : normalizeParticles(particlesEnabled);

    var changedSubtheme = nextSubtheme !== currentState.subtheme;
    currentState.subtheme = nextSubtheme;
    currentState.particles = nextParticles;

    clearBodySubthemeClasses(document.documentElement);
    clearBodySubthemeClasses(document.body);

    if (nextSubtheme !== 'none') {
      if (document.documentElement) {
        document.documentElement.classList.add('subtheme-' + nextSubtheme);
      }
      if (document.body) {
        document.body.classList.add('subtheme-' + nextSubtheme);
        if (nextParticles) {
          document.body.classList.add('subtheme-particles-on');
        }
      }
    }

    try {
      localStorage.setItem('siteSubtheme', nextSubtheme);
      localStorage.setItem('siteSubthemeParticles', nextParticles ? '1' : '0');
    } catch (e) {}

    if (!document.body) return;

    if (changedSubtheme || nextSubtheme === 'none') {
      removeAllDecorations();
    } else {
      var pLayer = document.querySelector('.holiday-particles-layer');
      if (!nextParticles && pLayer && pLayer.parentNode) {
        pLayer.parentNode.removeChild(pLayer);
      }
    }

    if (nextSubtheme !== 'none') {
      syncDomDecorations();
      ensureObserver();
    }
  }

  function initFromCache() {
    try {
      var cached = localStorage.getItem('siteSubtheme');
      var cachedParticles = localStorage.getItem('siteSubthemeParticles');
      if (cached && cached !== 'none') {
        apply(cached, cachedParticles !== '0');
      }
    } catch (e) {}
  }

  window.EcoHolidayThemes = {
    SUBTHEMES: SUBTHEMES,
    META: META,
    apply: apply,
    getState: function () {
      return { subtheme: currentState.subtheme, particles: currentState.particles };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFromCache);
  } else {
    initFromCache();
  }
})();
