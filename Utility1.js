// ================================================================
// utility1.js  ─  西洋占星星盤  頁面互動邏輯
// 傳統瀏覽器格式（無 ES Module），依賴 window.AstroUtil
// 載入順序：須在 Utility.js 之後載入
// ================================================================
(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 內部工具：從分拆欄位組合 dateStr / timeStr
  // ─────────────────────────────────────────────────────────────
  function getDateStr() {
    var y = parseInt(document.getElementById('date-year').value)  || 0;
    var m = parseInt(document.getElementById('date-month').value) || 0;
    var d = parseInt(document.getElementById('date-day').value)   || 0;
    if (!y || !m || !d) return '';
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function getTimeStr() {
    var h   = document.getElementById('time-hour').value;
    var min = document.getElementById('time-minute').value;
    if (h === '' || min === '') return '';
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return pad(parseInt(h)) + ':' + pad(parseInt(min));
  }

  // ─────────────────────────────────────────────────────────────
  // 取得指定年月的最大天數
  // ─────────────────────────────────────────────────────────────
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // ─────────────────────────────────────────────────────────────
  // 修正日欄位：若目前日期超出當月天數上限，自動夾到合法值
  // 在任何可能改變年/月的操作後呼叫
  // ─────────────────────────────────────────────────────────────
  function clampDayToMonth() {
    var y   = parseInt(document.getElementById('date-year').value)  || 2000;
    var m   = parseInt(document.getElementById('date-month').value) || 1;
    var d   = parseInt(document.getElementById('date-day').value)   || 1;
    var max = getDaysInMonth(y, m);
    if (d > max) {
      document.getElementById('date-day').value = max;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 核心繪製函式
  // ─────────────────────────────────────────────────────────────
  function runChart() {
    var lat         = parseFloat(document.getElementById('latitude').value);
    var geoLon      = parseFloat(document.getElementById('longitude').value);
    var dateStr     = getDateStr();
    var timeStr     = getTimeStr();
    var lang        = document.getElementById('language-select').value;
    var zodiac      = document.getElementById('zodiacSystem').value;
    var houseSystem = document.getElementById('houseSystem').value;
    var inclMajor   = document.getElementById('aspect-major').checked;
    var inclMinor   = document.getElementById('aspect-minor').checked;
    var chartSize   = document.getElementById('chart-size').value;
    var planetMode  = document.querySelector('input[name="planet-mode"]:checked').value;

    var lineOpp     = document.getElementById('line-opposition').checked;
    var lineTrine   = document.getElementById('line-trine').checked;
    var lineSquare  = document.getElementById('line-square').checked;
    var lineSextile = document.getElementById('line-sextile').checked;

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

    if (!dateStr || !timeStr) { return; }

    AstroUtil.updateAnglesI18n(lang);

    var utcDate   = AstroUtil.localToUtcDate(dateStr, timeStr, geoLon);
    var astroTime = new Astronomy.AstroTime(utcDate);
    global._lastAstroTime = astroTime;

    var ayanamsa   = zodiac === 'sidereal'
      ? AstroUtil.calcDynamicAyanamsa(dateStr, timeStr, geoLon) : 0;
    var ang        = AstroUtil.calcAngles(dateStr, timeStr, lat, geoLon);
    var ascDisplay = AstroUtil.toDisplayLon(ang.ascTropical, zodiac, ayanamsa);
    var mcDisplay  = AstroUtil.toDisplayLon(ang.mcTropical,  zodiac, ayanamsa);
    var cusps      = AstroUtil.calcHouseCusps(ang, lat, houseSystem, zodiac, ayanamsa);

    var bodyKeys  = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
    var pointKeys = ['northNode','southNode','lilith'];
    var allLons   = {};

    bodyKeys.forEach(function(key) {
      allLons[key] = AstroUtil.toDisplayLon(
        AstroUtil.getBodyTropicalLon(key, astroTime), zodiac, ayanamsa);
    });
    pointKeys.forEach(function(key) {
      allLons[key] = AstroUtil.toDisplayLon(
        AstroUtil.getBodyTropicalLon(key, astroTime), zodiac, ayanamsa);
    });
    allLons['asc'] = ascDisplay;
    allLons['mc']  = mcDisplay;

    var aspects = AstroUtil.calcAspects(allLons, inclMajor, inclMinor, orbOverrides);

    // ── 太陽星座 & 上升快覽 ──
    document.getElementById('sunsign').textContent =
      AstroUtil.getSignLabel(allLons['sun'], lang) + '  ' +
      AstroUtil.ddToSignDMS(allLons['sun'], lang);
    document.getElementById('asc-quick').textContent =
      '上升 ' + AstroUtil.ddToSignDMS(ascDisplay, lang);

    // ── 角點表 ──
    document.getElementById('asc-a').textContent = ascDisplay.toFixed(2) + '°';
    document.getElementById('mc-a').textContent  = mcDisplay.toFixed(2)  + '°';
    document.getElementById('asc-b').textContent = ascDisplay.toFixed(4);
    document.getElementById('mc-b').textContent  = mcDisplay.toFixed(4);
    document.getElementById('asc-c').textContent = AstroUtil.ddToSignDMS(ascDisplay, lang);
    document.getElementById('mc-c').textContent  = AstroUtil.ddToSignDMS(mcDisplay,  lang);

    // ── 宮位表 ──
    var hTbody = document.getElementById('houses-tbody');
    hTbody.innerHTML = '';
    var houseRulers = [];
    try {
      houseRulers = AstroHouses.getAllHouseRulers(cusps, {
        rulerMode: 'modern',
        zodiac:    zodiac,
        ayanamsa:  ayanamsa || null
      });
    } catch(err) { console.warn('getAllHouseRulers 失敗：', err); }

    for (var i = 0; i < 12; i++) {
      var row = hTbody.insertRow();
      row.insertCell().textContent = AstroUtil.t('house' + (i + 1), lang);
      row.insertCell().textContent = cusps[i].toFixed(4);
      row.insertCell().textContent = cusps[(i + 1) % 12].toFixed(4);
      row.insertCell().textContent =
        AstroUtil.getSignLabel(cusps[i], lang) + ' ' +
        AstroUtil.getSignIngress(cusps[i]);

      var rulerCell = row.insertCell();
      rulerCell.className = 'ruler-cell';
      if (houseRulers[i]) {
        rulerCell.textContent =
          AstroUtil.RULER_DISPLAY[houseRulers[i].rulerKey] || houseRulers[i].rulerKey;
      } else {
        rulerCell.textContent = '—';
      }

      var dignityCell = row.insertCell();
      if (houseRulers[i]) {
        var rulerPlanet = houseRulers[i].rulerKey;
        var rulerLon    = allLons[rulerPlanet];
        if (rulerLon !== null && rulerLon !== undefined) {
          var rulerSign = AstroHouses.getZodiacSign({
            decimalDegrees: rulerLon,
            zodiac:         zodiac,
            ayanamsa:       zodiac === 'sidereal' ? ayanamsa : null
          });
          var rulerSignKey  = rulerSign.key;
          var rulerHouseNum = AstroUtil.getHouseNumber(rulerLon, cusps);
          var dignityResult = AstroHouses.getPlanetDignity(rulerPlanet, rulerSignKey, lang);
          var houseLabel    = lang === 'zh'
            ? '第' + rulerHouseNum + '宮' : 'House ' + rulerHouseNum;
          var dignityText   = (dignityResult.dignityKey === 'peregrine')
            ? '' : dignityResult.dignityLabel +
                   ' ( ' + dignityResult.sign + ' · ' + houseLabel + ' ) ';
          dignityCell.textContent = dignityText;
          var dKey = dignityResult.dignityKey;
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
    var bTbody = document.getElementById('bodies-tbody');
    bTbody.innerHTML = '';
    bodyKeys.forEach(function(key) {
      var lon   = allLons[key];
      var row   = bTbody.insertRow();
      var retro = AstroUtil.isRetrograde(key, astroTime);
      row.insertCell().textContent = AstroUtil.t(key, lang);
      row.insertCell().textContent = lon.toFixed(4);
      row.insertCell().textContent = AstroUtil.getSignLabel(lon, lang);
      row.insertCell().textContent = AstroUtil.ddToSignDMS(lon, lang);
      row.insertCell().textContent =
        AstroUtil.t('house' + AstroUtil.getHouseNumber(lon, cusps), lang);
      var retroCell = row.insertCell();
      retroCell.textContent = retro ? '逆 R' : '順 D';
      retroCell.className   = retro ? 'retro' : 'direct';
    });

    // ── 天體點表 ──
    var pTbody = document.getElementById('points-tbody');
    pTbody.innerHTML = '';
    pointKeys.forEach(function(key) {
      var lon = allLons[key];
      var row = pTbody.insertRow();
      row.insertCell().textContent = AstroUtil.t(key, lang);
      row.insertCell().textContent = lon.toFixed(4);
      row.insertCell().textContent = AstroUtil.getSignLabel(lon, lang);
      row.insertCell().textContent = AstroUtil.ddToSignDMS(lon, lang);
      row.insertCell().textContent =
        AstroUtil.t('house' + AstroUtil.getHouseNumber(lon, cusps), lang);
    });

    // ── 相位表 ──
    var aTbody = document.getElementById('aspects-tbody');
    aTbody.innerHTML = '';
    aspects.forEach(function(asp) {
      var row     = aTbody.insertRow();
      row.insertCell().textContent = AstroUtil.t(asp.body1, lang);
      var aspCell = row.insertCell();
      aspCell.textContent = asp.symbol + ' ' + AstroUtil.t(asp.aspect, lang);
      aspCell.className   = 'aspect-' + asp.level;
      row.insertCell().textContent = AstroUtil.t(asp.body2, lang);
      row.insertCell().textContent = asp.orb + '°';
      row.insertCell().textContent =
        AstroUtil.applyingText(asp, allLons, global._lastAstroTime);
      row.insertCell().textContent = asp.level === 'major' ? '主要' : '次要';
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
    document.getElementById('aspect-matrix-card').style.display = 'block';
    document.getElementById('output-area').style.display = 'block';
  }

  // ─────────────────────────────────────────────────────────────
  // 頁面初始化：自動填入當前日期與時間
  // ─────────────────────────────────────────────────────────────
  function initDateTime() {
    var now = new Date();
    document.getElementById('date-year').value  = now.getFullYear();
    document.getElementById('date-month').value = now.getMonth() + 1;
    document.getElementById('date-day').value   = now.getDate();
    document.getElementById('time-hour').value   = now.getHours();
    document.getElementById('time-minute').value = now.getMinutes();
  }

  // ─────────────────────────────────────────────────────────────
  // 步進按鈕通用邏輯（含跨欄位進位 / 借位）
  // ─────────────────────────────────────────────────────────────
  function initSpinButtons() {
    document.querySelectorAll('.spin-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetId = this.dataset.target;
        var step     = parseFloat(this.dataset.step) || 1;
        var input    = document.getElementById(targetId);
        var val      = parseFloat(input.value) || 0;
        var newVal   = val + step;

        // ── date-day 特殊處理（上限依當月天數動態決定）──
        // 此區塊處理完後直接 return，避免下方通用邏輯重複觸發 carryUp
        if (targetId === 'date-day') {
          var y       = parseInt(document.getElementById('date-year').value)  || 2000;
          var m       = parseInt(document.getElementById('date-month').value) || 1;
          var daysMax = getDaysInMonth(y, m);
          if (newVal > daysMax) {
            input.value = 1;
            carryUp('date-day', +1);
          } else if (newVal < 1) {
            // 先借位（月份會先被更新）
            carryUp('date-day', -1);
            // 借位後重新讀取更新後的年月，計算上個月天數
            var newY    = parseInt(document.getElementById('date-year').value)  || 2000;
            var newM    = parseInt(document.getElementById('date-month').value) || 1;
            input.value = getDaysInMonth(newY, newM);
          } else {
            input.value = newVal;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return; // ← 提前結束，不再執行下方通用邏輯
        }

        // ── 其他欄位通用進位 / 借位處理 ──
        var minVal = this.dataset.min !== undefined
          ? parseFloat(this.dataset.min) : -Infinity;
        var maxVal = this.dataset.max !== undefined
          ? parseFloat(this.dataset.max) :  Infinity;

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

  /**
   * carryUp — 向上層欄位進位（+1）或借位（-1）
   * 借位到 date-day 時，寫入值後立即以 clampDayToMonth() 修正合法上限
   * @param {string} childId   - 觸發進位的子欄位 id
   * @param {number} direction - +1 進位 / -1 借位
   */
  function carryUp(childId, direction) {
    var chain = {
      'time-minute': { parentId: 'time-hour',  min: 0,  max: 23   },
      'time-hour':   { parentId: 'date-day',   min: 1,  max: null  }, // 動態
      'date-day':    { parentId: 'date-month', min: 1,  max: 12   },
      'date-month':  { parentId: 'date-year',  min: 1,  max: 9999 }
    };

    var link = chain[childId];
    if (!link) return; // date-year 無父欄位，到頂停止

    var parentInput = document.getElementById(link.parentId);
    var parentVal   = parseInt(parentInput.value) || 0;
    var parentMin   = link.min;
    var parentMax   = link.max;

    // time-hour 進位到 date-day 時，上限動態計算
    if (link.parentId === 'date-day') {
      var y = parseInt(document.getElementById('date-year').value)  || 2000;
      var m = parseInt(document.getElementById('date-month').value) || 1;
      parentMax = getDaysInMonth(y, m);
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

    // ── 關鍵修正：若父欄位是 date-day，在月份可能已被更新後
    //    重新夾住日期，避免出現「2月31日」等非法值 ──
    if (link.parentId === 'date-day') {
      clampDayToMonth();
    }

    parentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────────────
  // 表單事件綁定
  // ─────────────────────────────────────────────────────────────
  function initFormEvents() {
    document.getElementById('form').addEventListener('submit', function(e) {
      e.preventDefault();
      runChart();
    });

    var dateTimeIds = [
      'date-year','date-month','date-day','time-hour','time-minute'
    ];
    dateTimeIds.forEach(function(id) {
      document.getElementById(id).addEventListener('input', function() {
        if (getDateStr() && getTimeStr()) { runChart(); }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 星座符號覆寫初始化
  // ─────────────────────────────────────────────────────────────
  function initSignPatch() {
    if (global.AstroUtil && global.AstroUtil.patchAstroChartSignSymbols) {
      AstroUtil.patchAstroChartSignSymbols();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DOMContentLoaded 統一入口
  // ─────────────────────────────────────────────────────────────
  function init() {
    initDateTime();
    initSpinButtons();
    initFormEvents();
    initSignPatch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));