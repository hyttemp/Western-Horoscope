// ================================================================
// utility1.js  ─  西洋占星星盤  頁面互動邏輯
// 傳統瀏覽器格式（無 ES Module），依賴 window.AstroUtil
// 載入順序：須在所有依賴庫之後，放在 </body> 前
// ================================================================
(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 頂層共用工具
  // ─────────────────────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, '0'); }

  // ─────────────────────────────────────────────────────────────
  // 靜態常數
  // ─────────────────────────────────────────────────────────────
  var BODY_KEYS  = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  var POINT_KEYS = ['northNode','southNode','lilith'];

  var CARRY_CHAIN = {
    'time-minute': { parentId: 'time-hour',  min: 0, max: 23   },
    'time-hour':   { parentId: 'date-day',   min: 1, max: null  },
    'date-day':    { parentId: 'date-month', min: 1, max: 12   },
    'date-month':  { parentId: 'date-year',  min: 1, max: 9999 }
  };

  var DATETIME_IDS = ['date-year','date-month','date-day','time-hour','time-minute'];

  // VOC 顯示用常數
  var ASP_SYM = {
    'Conjunction(0°)' : '☌', 'Opposition(180°)': '☍',
    'Square(90°)'     : '□', 'Trine(120°)'     : '△',
    'Sextile(60°)'    : '⚹', 'None'            : '—'
  };
  var SIGN_ZH = {
    Aries:'牡羊', Taurus:'金牛', Gemini:'雙子',   Cancer:'巨蟹',
    Leo:'獅子',   Virgo:'處女',  Libra:'天秤',    Scorpio:'天蠍',
    Sagittarius:'射手', Capricorn:'摩羯', Aquarius:'水瓶', Pisces:'雙魚'
  };
  var PLANET_ZH = {
    Sun:'太陽', Moon:'月亮', Mercury:'水星', Venus:'金星',
    Mars:'火星', Jupiter:'木星', Saturn:'土星',
    Uranus:'天王星', Neptune:'海王星', Pluto:'冥王星'
  };

  // ─────────────────────────────────────────────────────────────
  // DOM 元素快取（init() 時填入）
  // ─────────────────────────────────────────────────────────────
  var EL = {};

  function cacheElements() {
    function get(id) {
      var el = document.getElementById(id);
      if (!el) { console.warn('[utility1] cacheElements: 找不到 #' + id); }
      return el;
    }
    EL.latitude         = get('latitude');
    EL.longitude        = get('longitude');
    EL.dateYear         = get('date-year');
    EL.dateMonth        = get('date-month');
    EL.dateDay          = get('date-day');
    EL.timeHour         = get('time-hour');
    EL.timeMinute       = get('time-minute');
    EL.languageSelect   = get('language-select');
    EL.zodiacSystem     = get('zodiacSystem');
    EL.houseSystem      = get('houseSystem');
    EL.aspectMajor      = get('aspect-major');
    EL.aspectMinor      = get('aspect-minor');
    EL.chartSize        = get('chart-size');
    EL.lineOpposition   = get('line-opposition');
    EL.lineTrine        = get('line-trine');
    EL.lineSquare       = get('line-square');
    EL.lineSextile      = get('line-sextile');
    EL.sunsign          = get('sunsign');
    EL.sunsignCard      = get('sunsign-card');
    EL.ascQuick         = get('asc-quick');
    EL.housesTbody      = get('houses-tbody');
    EL.bodiesTbody      = get('bodies-tbody');
    EL.pointsTbody      = get('points-tbody');
    EL.aspectsTbody     = get('aspects-tbody');
    EL.aspectMatrixCard = get('aspect-matrix-card');
    EL.outputArea       = get('output-area');
    // [新增] range 滑桿與顯示值
    EL.planetSize       = get('planet-size');
    EL.planetSizeVal    = get('planet-size-val');
    EL.aspectStroke     = get('aspect-stroke');
    EL.aspectStrokeVal  = get('aspect-stroke-val');
  }

  // ─────────────────────────────────────────────────────────────
  // 內部工具
  // ─────────────────────────────────────────────────────────────
  function getDateStr() {
    var y = parseInt(EL.dateYear.value)  || 0;
    var m = parseInt(EL.dateMonth.value) || 0;
    var d = parseInt(EL.dateDay.value)   || 0;
    if (!y || !m || !d) return '';
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function getTimeStr() {
    var h   = EL.timeHour.value;
    var min = EL.timeMinute.value;
    if (h === '' || min === '') return '';
    return pad(parseInt(h)) + ':' + pad(parseInt(min));
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getCurrentYM() {
    return {
      y: parseInt(EL.dateYear.value)  || 2000,
      m: parseInt(EL.dateMonth.value) || 1
    };
  }

  function clampDayToMonth() {
    var ym  = getCurrentYM();
    var d   = parseInt(EL.dateDay.value) || 1;
    var max = getDaysInMonth(ym.y, ym.m);
    if (d > max) { EL.dateDay.value = max; }
  }

  // ─────────────────────────────────────────────────────────────
  // 核心繪製函式
  // ─────────────────────────────────────────────────────────────
  function runChart() {
    var dateStr = getDateStr();
    var timeStr = getTimeStr();
    if (!dateStr || !timeStr) { return; }

    var lat         = parseFloat(EL.latitude.value);
    var geoLon      = parseFloat(EL.longitude.value);
    var lang        = EL.languageSelect.value;
    var zodiac      = EL.zodiacSystem.value;
    var houseSystem = EL.houseSystem.value;
    var inclMajor   = EL.aspectMajor.checked;
    var inclMinor   = EL.aspectMinor.checked;
    var chartSize   = EL.chartSize.value;
    var planetMode  = document.querySelector('input[name="planet-mode"]:checked').value;

    var lineOpp     = EL.lineOpposition.checked;
    var lineTrine   = EL.lineTrine.checked;
    var lineSquare  = EL.lineSquare.checked;
    var lineSextile = EL.lineSextile.checked;

    var dashOpp     = AstroUtil.getDashArray('opposition');
    var dashTrine   = AstroUtil.getDashArray('trine');
    var dashSquare  = AstroUtil.getDashArray('square');
    var dashSextile = AstroUtil.getDashArray('sextile');

    var orbOpp     = AstroUtil.getOrbValue('orb-opposition');
    var orbTrine   = AstroUtil.getOrbValue('orb-trine');
    var orbSquare  = AstroUtil.getOrbValue('orb-square');
    var orbSextile = AstroUtil.getOrbValue('orb-sextile');

    var orbOverrides = {
      opposition: orbOpp,
      trine:      orbTrine,
      square:     orbSquare,
      sextile:    orbSextile
    };

    var utcDate   = AstroUtil.localToUtcDate(dateStr, timeStr, geoLon);
    var astroTime = new Astronomy.AstroTime(utcDate);
    global._lastAstroTime = astroTime;

    var ayanamsa   = zodiac === 'sidereal'
      ? AstroUtil.calcDynamicAyanamsa(dateStr, timeStr, geoLon) : 0;
    var ang        = AstroUtil.calcAngles(dateStr, timeStr, lat, geoLon);
    var ascDisplay = AstroUtil.toDisplayLon(ang.ascTropical, zodiac, ayanamsa);
    var mcDisplay  = AstroUtil.toDisplayLon(ang.mcTropical,  zodiac, ayanamsa);
    var cusps      = AstroUtil.calcHouseCusps(ang, lat, houseSystem, zodiac, ayanamsa);

    var allLons = {};
    BODY_KEYS.forEach(function(key) {
      allLons[key] = AstroUtil.toDisplayLon(
        AstroUtil.getBodyTropicalLon(key, astroTime), zodiac, ayanamsa);
    });
    POINT_KEYS.forEach(function(key) {
      allLons[key] = AstroUtil.toDisplayLon(
        AstroUtil.getBodyTropicalLon(key, astroTime), zodiac, ayanamsa);
    });
    allLons['asc'] = ascDisplay;
    allLons['mc']  = mcDisplay;

    var aspects = AstroUtil.calcAspects(allLons, inclMajor, inclMinor, orbOverrides);

    // ── 太陽星座 & 上升快覽 ──
    EL.sunsign.textContent  =
      AstroUtil.getSignLabel(allLons['sun'], lang) + '  ' +
      AstroUtil.ddToSignDMS(allLons['sun'], lang);
    EL.ascQuick.textContent = '上升 ' + AstroUtil.ddToSignDMS(ascDisplay, lang);
    if (EL.sunsignCard) { EL.sunsignCard.style.display = 'flex'; }

    // ── 宮位表 ──
    EL.housesTbody.innerHTML = '';
    var houseRulers = [];
    try {
      houseRulers = AstroHouses.getAllHouseRulers(cusps, {
        rulerMode: 'modern',
        zodiac:    zodiac,
        ayanamsa:  ayanamsa || null
      });
    } catch(err) { console.warn('getAllHouseRulers 失敗：', err); }

    for (var i = 0; i < 12; i++) {
      var hRow = EL.housesTbody.insertRow();
      hRow.insertCell().textContent = AstroUtil.t('house' + (i + 1), lang);
      hRow.insertCell().textContent = cusps[i].toFixed(4);
      hRow.insertCell().textContent = cusps[(i + 1) % 12].toFixed(4);
      hRow.insertCell().textContent =
        AstroUtil.getSignLabel(cusps[i], lang) + ' ' +
        AstroUtil.getSignIngress(cusps[i]);

      var rulerCell = hRow.insertCell();
      rulerCell.className   = 'ruler-cell';
      rulerCell.textContent = houseRulers[i]
        ? (AstroUtil.RULER_DISPLAY[houseRulers[i].rulerKey] || houseRulers[i].rulerKey)
        : '—';

      var dignityCell = hRow.insertCell();
      if (houseRulers[i]) {
        var rulerPlanet = houseRulers[i].rulerKey;
        var rulerLon    = allLons[rulerPlanet];
        if (rulerLon !== null && rulerLon !== undefined) {
          var rulerSign = AstroHouses.getZodiacSign({
            decimalDegrees: rulerLon,
            zodiac:         zodiac,
            ayanamsa:       zodiac === 'sidereal' ? ayanamsa : null
          });
          var rulerHouseNum = AstroUtil.getHouseNumber(rulerLon, cusps);
          var dignityResult = AstroHouses.getPlanetDignity(rulerPlanet, rulerSign.key, lang);
          var houseLabel    = lang === 'zh'
            ? '第' + rulerHouseNum + '宮' : 'House ' + rulerHouseNum;
          var dKey = dignityResult.dignityKey;
          dignityCell.textContent = (dKey === 'peregrine')
            ? ''
            : dignityResult.dignityLabel + ' ( ' + dignityResult.sign + ' · ' + houseLabel + ' ) ';
          if      (dKey === 'domicile')   dignityCell.className = 'dignity-domicile';
          else if (dKey === 'exaltation') dignityCell.className = 'dignity-exaltation';
          else if (dKey === 'detriment')  dignityCell.className = 'dignity-detriment';
          else if (dKey === 'fall')       dignityCell.className = 'dignity-fall';
          else                            dignityCell.className = 'dignity-peregrine';
        } else {
          dignityCell.textContent = '—';
        }
      } else {
        dignityCell.textContent = '—';
      }
    }

    // ── 行星表 ──
    EL.bodiesTbody.innerHTML = '';

    var ascRow = EL.bodiesTbody.insertRow();
    ascRow.insertCell().textContent = '上升 Asc';
    ascRow.insertCell().textContent = ascDisplay.toFixed(4);
    ascRow.insertCell().textContent = AstroUtil.ddToSignDMS(ascDisplay, lang);
    ascRow.insertCell().textContent = '—';
    ascRow.insertCell().textContent = '—';

    var mcRow = EL.bodiesTbody.insertRow();
    mcRow.insertCell().textContent = '天頂 MC';
    mcRow.insertCell().textContent = mcDisplay.toFixed(4);
    mcRow.insertCell().textContent = AstroUtil.ddToSignDMS(mcDisplay, lang);
    mcRow.insertCell().textContent = '—';
    mcRow.insertCell().textContent = '—';

    BODY_KEYS.forEach(function(key) {
      var lon   = allLons[key];
      var bRow  = EL.bodiesTbody.insertRow();
      var retro = AstroUtil.isRetrograde(key, astroTime);
      bRow.insertCell().textContent = AstroUtil.t(key, lang);
      bRow.insertCell().textContent = lon.toFixed(4);
      bRow.insertCell().textContent = AstroUtil.ddToSignDMS(lon, lang);
      bRow.insertCell().textContent =
        AstroUtil.t('house' + AstroUtil.getHouseNumber(lon, cusps), lang);
      var retroCell = bRow.insertCell();
      retroCell.textContent = retro ? '逆 R' : '順 D';
      retroCell.className   = retro ? 'retro' : 'direct';
    });

    // ── 天體點表 ──
    EL.pointsTbody.innerHTML = '';
    POINT_KEYS.forEach(function(key) {
      var lon  = allLons[key];
      var pRow = EL.pointsTbody.insertRow();
      pRow.insertCell().textContent = AstroUtil.t(key, lang);
      pRow.insertCell().textContent = lon.toFixed(4);
      pRow.insertCell().textContent = AstroUtil.ddToSignDMS(lon, lang);
      pRow.insertCell().textContent =
        AstroUtil.t('house' + AstroUtil.getHouseNumber(lon, cusps), lang);
    });

    // ── 相位表 ──
    EL.aspectsTbody.innerHTML = '';
    aspects.forEach(function(asp) {
      var aRow    = EL.aspectsTbody.insertRow();
      aRow.insertCell().textContent = AstroUtil.t(asp.body1, lang);
      var aspCell = aRow.insertCell();
      aspCell.textContent = asp.symbol + ' ' + AstroUtil.t(asp.aspect, lang);
      aspCell.className   = 'aspect-' + asp.level;
      aRow.insertCell().textContent = AstroUtil.t(asp.body2, lang);
      aRow.insertCell().textContent = asp.orb + '°';
      aRow.insertCell().textContent =
        AstroUtil.applyingText(asp, allLons, global._lastAstroTime);
      aRow.insertCell().textContent = asp.level === 'major' ? '主要' : '次要';
    });

    // ── 星盤圖形偵測 ──
    var patterns = AstroUtil.detectChartPatterns(allLons, orbOverrides);
    AstroUtil.renderChartPatterns(patterns);

    // ── 繪製星盤 & 矩陣 ──
    AstroUtil.drawAstroChart(
      cusps, allLons, chartSize, inclMajor, inclMinor,
      planetMode, lineOpp, lineTrine, lineSquare, lineSextile,
      dashOpp, dashTrine, dashSquare, dashSextile,
      orbOpp, orbTrine, orbSquare, orbSextile
    );

    AstroUtil.buildAspectMatrix(allLons, inclMajor, inclMinor, orbOverrides);
    EL.aspectMatrixCard.style.display = 'block';
    EL.outputArea.style.display       = 'block';
  }

  // ─────────────────────────────────────────────────────────────
  // 初始化日期時間
  // ─────────────────────────────────────────────────────────────
  function initDateTime() {
    if (!EL.dateYear || !EL.dateMonth || !EL.dateDay ||
        !EL.timeHour || !EL.timeMinute) {
      console.error('[utility1] initDateTime: 日期時間欄位未找到');
      return;
    }
    var now = new Date();
    EL.dateYear.value   = now.getFullYear();
    EL.dateMonth.value  = now.getMonth() + 1;
    EL.dateDay.value    = now.getDate();
    EL.timeHour.value   = now.getHours();
    EL.timeMinute.value = now.getMinutes();
  }

  // ─────────────────────────────────────────────────────────────
  // 步進按鈕
  // ─────────────────────────────────────────────────────────────
  function initSpinButtons() {
    document.querySelectorAll('.spin-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetId = this.dataset.target;
        var step     = parseFloat(this.dataset.step) || 1;
        var input    = document.getElementById(targetId);
        if (!input) { return; }
        var val    = parseFloat(input.value) || 0;
        var newVal = val + step;

        if (targetId === 'date-day') {
          var ym      = getCurrentYM();
          var daysMax = getDaysInMonth(ym.y, ym.m);
          if (newVal > daysMax) {
            input.value = 1;
            carryUp('date-day', +1);
          } else if (newVal < 1) {
            carryUp('date-day', -1);
            var ym2 = getCurrentYM();
            input.value = getDaysInMonth(ym2.y, ym2.m);
          } else {
            input.value = newVal;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }

        var minVal = this.dataset.min !== undefined ? parseFloat(this.dataset.min) : -Infinity;
        var maxVal = this.dataset.max !== undefined ? parseFloat(this.dataset.max) :  Infinity;

        if (newVal > maxVal) {
          newVal = minVal;
          carryUp(targetId, +1);
        } else if (newVal < minVal) {
          newVal = maxVal;
          carryUp(targetId, -1);
        }

        input.value = newVal;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  function carryUp(childId, direction) {
    var link = CARRY_CHAIN[childId];
    if (!link) { return; }

    var parentInput = document.getElementById(link.parentId);
    if (!parentInput) { return; }

    var parentVal = parseInt(parentInput.value) || 0;
    var parentMin = link.min;
    var parentMax = link.max;

    if (link.parentId === 'date-day') {
      var ym    = getCurrentYM();
      parentMax = getDaysInMonth(ym.y, ym.m);
    }

    var newParentVal = parentVal + direction;

    if (parentMax !== null && newParentVal > parentMax) {
      parentInput.value = parentMin;
      carryUp(link.parentId, +1);
    } else if (newParentVal < parentMin) {
      parentInput.value = parentMax !== null ? parentMax : parentVal;
      carryUp(link.parentId, -1);
    } else {
      parentInput.value = newParentVal;
    }

    if (link.parentId === 'date-day') { clampDayToMonth(); }
    parentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────────────
  // 表單事件綁定
  // ─────────────────────────────────────────────────────────────
  function initFormEvents() {
    var form = document.getElementById('form');
    if (!form) { console.error('[utility1] 找不到 #form'); return; }

    // 提交
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      runChart();
    });

    // 日期時間欄位即時更新
    DATETIME_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) { return; }
      el.addEventListener('input', function() {
        if (getDateStr() && getTimeStr()) { runChart(); }
      });
    });

    // [修正3] planet-size 滑桿 → 更新顯示值（原 oninput 內聯）
    if (EL.planetSize && EL.planetSizeVal) {
      EL.planetSize.addEventListener('input', function() {
        EL.planetSizeVal.textContent = this.value;
      });
    }

    // [修正3] aspect-stroke 滑桿 → 更新顯示值（原 oninput 內聯）
    if (EL.aspectStroke && EL.aspectStrokeVal) {
      EL.aspectStroke.addEventListener('input', function() {
        EL.aspectStrokeVal.textContent = this.value;
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VOC 月亮空亡邏輯
  // ─────────────────────────────────────────────────────────────
  function getTzOffset() {
    var lon = parseFloat(EL.longitude ? EL.longitude.value : 0);
    return isNaN(lon) ? 0 : Math.round(lon / 15);
  }

  function fmtTzLabel(offsetH) {
    if (offsetH === 0) { return 'UTC'; }
    return 'UTC' + (offsetH > 0 ? '+' : '') + offsetH;
  }

  function fmtWithTz(d, offsetH) {
    if (!d || isNaN(d)) { return '—'; }
    var shifted = new Date(d.getTime() + offsetH * 3600000);
    return shifted.getUTCFullYear() + '/'
         + pad(shifted.getUTCMonth() + 1) + '/'
         + pad(shifted.getUTCDate())
         + ' ' + pad(shifted.getUTCHours()) + ':' + pad(shifted.getUTCMinutes());
  }

  function fmtDur(a, b) {
    if (!a || !b || isNaN(a) || isNaN(b) || b <= a) { return '—'; }
    var m = Math.round((b - a) / 60000);
    var h = Math.floor(m / 60);
    return (h ? h + 'h ' : '') + (m % 60) + 'm';
  }

  function mkTd(tr, text, cls) {
    var td = document.createElement('td');
    td.textContent = (text === null || text === undefined) ? '—' : String(text);
    if (cls) { td.className = cls; }
    tr.appendChild(td);
    return td;
  }

  function getUtcEquiv() {
    var y   = parseInt(EL.dateYear.value,   10);
    var mo  = parseInt(EL.dateMonth.value,  10);
    var d   = parseInt(EL.dateDay.value,    10);
    var h   = parseInt(EL.timeHour.value,   10);
    var min = parseInt(EL.timeMinute.value, 10);
    if (!y || !mo || !d || isNaN(h) || isNaN(min)) { return null; }
    var offsetH    = getTzOffset();
    var localAsUtc = new Date(Date.UTC(y, mo - 1, d, h, min, 0, 0));
    return new Date(localAsUtc.getTime() - offsetH * 3600000);
  }

  function fmtInputLocal() {
    var y   = parseInt(EL.dateYear.value,   10);
    var mo  = parseInt(EL.dateMonth.value,  10);
    var d   = parseInt(EL.dateDay.value,    10);
    var h   = parseInt(EL.timeHour.value,   10);
    var min = parseInt(EL.timeMinute.value, 10);
    if (!y || !mo || !d || isNaN(h) || isNaN(min)) { return '—'; }
    return y + '/' + pad(mo) + '/' + pad(d) + ' ' + pad(h) + ':' + pad(min);
  }

  function isVocReady() {
    return !!(
      EL.dateYear   && EL.dateYear.value   &&
      EL.dateMonth  && EL.dateMonth.value  &&
      EL.dateDay    && EL.dateDay.value    &&
      EL.timeHour   && EL.timeHour.value   !== '' &&
      EL.timeMinute && EL.timeMinute.value !== ''
    );
  }

  function convertVocList(rawList, inputUtcDate) {
    if (!rawList || !rawList.length) { return []; }
    var teInput = MoonVOC.dateToJD(inputUtcDate);
    return rawList.map(function(v) {
      return {
        vocStart       : MoonVOC.jdToDate(v.tvoc),
        vocEnd         : MoonVOC.jdToDate(v.tingr),
        ingressSign    : MoonVOC.SIGN_NAMES[v.isign_ingr] || null,
        lastAspect     : {
          aspName   : MoonVOC.ASP_NAMES[v.casp]   || 'None',
          planetName: MoonVOC.PLANET_NAMES[v.cpl] || null
        },
        isActiveAtInput: (v.tvoc <= teInput && teInput <= v.tingr)
      };
    });
  }

  function showVocLoading() {
    var sec = document.getElementById('voc-section');
    var ld  = document.getElementById('voc-loading');
    var em  = document.getElementById('voc-empty');
    var tw  = document.getElementById('voc-table-wrap');
    if (sec) { sec.style.display = 'block'; }
    if (ld)  { ld.style.display  = 'block'; }
    if (em)  { em.style.display  = 'none';  }
    if (tw)  { tw.style.display  = 'none';  }
  }

  function renderVoc(vocList, offsetH) {
    var elLoading = document.getElementById('voc-loading');
    var elEmpty   = document.getElementById('voc-empty');
    var elWrap    = document.getElementById('voc-table-wrap');
    var elTbody   = document.getElementById('voc-tbody');
    var elBadge   = document.getElementById('voc-range-badge');
    var elTzBadge = document.getElementById('voc-tz-badge');
    var thStart   = document.getElementById('th-voc-start');
    var thEnd     = document.getElementById('th-voc-end');

    if (elLoading) { elLoading.style.display = 'none'; }

    var tzLabel = fmtTzLabel(offsetH);
    if (elTzBadge) { elTzBadge.textContent = tzLabel; }
    if (thStart)   { thStart.textContent   = '空亡開始（' + tzLabel + '）'; }
    if (thEnd)     { thEnd.textContent     = '空亡結束（' + tzLabel + '）'; }
    if (elBadge)   { elBadge.textContent   = fmtInputLocal() + ' 起 3 天'; }

    if (!vocList || vocList.length === 0) {
      if (elEmpty) { elEmpty.style.display = 'block'; }
      if (elWrap)  { elWrap.style.display  = 'none';  }
      return;
    }

    if (elEmpty) { elEmpty.style.display = 'none';  }
    if (elWrap)  { elWrap.style.display  = 'block'; }
    if (!elTbody) { return; }
    elTbody.innerHTML = '';

    vocList.forEach(function(v, idx) {
      var tr = document.createElement('tr');
      if (v.isActiveAtInput) { tr.classList.add('voc-row-active'); }

      mkTd(tr, idx + 1);
      mkTd(tr, fmtWithTz(v.vocStart, offsetH), 'voc-time');

      var aspName = (v.lastAspect && v.lastAspect.aspName) ? v.lastAspect.aspName : 'None';
      var tdA = document.createElement('td');
      tdA.innerHTML = '<span class="voc-asp-sym">' + (ASP_SYM[aspName] || '?') + '</span>'
                    + '<span style="font-size:0.78rem;color:var(--color-muted);">' + aspName + '</span>';
      tr.appendChild(tdA);

      var tdP = document.createElement('td');
      if (v.lastAspect && v.lastAspect.planetName) {
        var pn = v.lastAspect.planetName;
        tdP.innerHTML = '<span class="voc-moon">月亮</span> ↔ '
                      + '<span class="voc-planet">' + (PLANET_ZH[pn] || pn) + '</span>';
      } else { tdP.textContent = '—'; }
      tr.appendChild(tdP);

      mkTd(tr, fmtWithTz(v.vocEnd, offsetH), 'voc-time');

      var tdSg = document.createElement('td');
      tdSg.className   = 'voc-sign';
      tdSg.textContent = v.ingressSign
        ? (SIGN_ZH[v.ingressSign] || v.ingressSign) + ' (' + v.ingressSign + ')'
        : '—';
      tr.appendChild(tdSg);

      mkTd(tr, fmtDur(v.vocStart, v.vocEnd), 'voc-dur');

      var tdSt = document.createElement('td');
      tdSt.innerHTML = v.isActiveAtInput
        ? '<span class="voc-active">🔴 空亡中</span>'
        : '<span class="voc-ended">✅ 已結束</span>';
      tr.appendChild(tdSt);

      elTbody.appendChild(tr);
    });
  }

  function calcAndRenderVoc() {
    if (typeof MoonVOC === 'undefined' || typeof MoonVOC.calcAllVoc !== 'function') {
      console.warn('[VOC] moon_voc.js 未載入');
      return;
    }
    var utcEquiv = getUtcEquiv();
    if (!utcEquiv) { return; }

    var offsetH = getTzOffset();
    showVocLoading();

    setTimeout(function() {
      try {
        var rawList = MoonVOC.calcAllVoc(utcEquiv, 3);
        var vocList = convertVocList(rawList, utcEquiv);
        renderVoc(vocList, offsetH);
      } catch(err) {
        console.error('[VOC] 計算失敗：', err);
        var elLoading = document.getElementById('voc-loading');
        var elEmpty   = document.getElementById('voc-empty');
        if (elLoading) { elLoading.style.display = 'none'; }
        if (elEmpty)   {
          elEmpty.style.display = 'block';
          elEmpty.textContent   = '⚠️ 計算失敗：' + err.message;
        }
      }
    }, 60);
  }

  var _vocTimer = null;
  function debouncedVoc() {
    clearTimeout(_vocTimer);
    _vocTimer = setTimeout(calcAndRenderVoc, 300);
  }

  function initVoc() {
    var form = document.getElementById('form');
    if (form) {
      form.addEventListener('submit', function() { calcAndRenderVoc(); });
    }
    var vocIds = ['date-year','date-month','date-day','time-hour','time-minute','longitude'];
    vocIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) { return; }
      el.addEventListener('input', function() {
        if (isVocReady()) { debouncedVoc(); }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // DOMContentLoaded 統一入口
  // ─────────────────────────────────────────────────────────────
  function init() {
    cacheElements();
    initDateTime();
    initSpinButtons();
    initFormEvents();
    initVoc();
    if (global.AstroUtil && global.AstroUtil.patchAstroChartSignSymbols) {
      AstroUtil.patchAstroChartSignSymbols();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));