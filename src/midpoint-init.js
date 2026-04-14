/**
 * midpoint-init.js
 * 依賴：midpoint.js（需先載入）
 *
 * 漢堡學派中點理論：
 *   軸1 = (A + B) / 2  mod 360
 *   只檢查行星/角點是否落在軸1的容許度內（不檢查對衝軸 +180°）
 *
 *   參與中點計算的天體：
 *     - #bodies-tbody  行星（太陽～冥王星）
 *     - #points-tbody  北交點、南交點、凱龍、莉莉絲…
 *     - #houses-tbody  第1宮起始度 → ASC、第10宮起始度 → MC
 *
 *  修正紀錄：
 *    [Fix 1] setTimeout(500) → 改監聽 'chartReady' 自訂事件，確保 DOM 已填入
 *    [Fix 2] #asc-b / #mc-b 不存在 → 改從 #houses-tbody 讀取 ASC(宮1) / MC(宮10)
 *    [Fix 3] 加入 fallback：若 'chartReady' 未在 2000ms 內觸發，自動嘗試一次
 */
(function () {
  'use strict';

  /* ★ 行星標準順序（中文 key，與表格一致） */
  var PLANET_ORDER = [
    '太陽','月亮','水星','金星','火星',
    '木星','土星','天王星','海王星','冥王星',
    '北交點','南交點','凱龍','莉莉絲',
    'ASC','MC'
  ];

  function getPlanetIndex(name) {
    var idx = PLANET_ORDER.indexOf(name);
    return idx === -1 ? 99 : idx;
  }

  var SIGNS = [
    'Aries','Taurus','Gemini','Cancer',
    'Leo','Virgo','Libra','Scorpio',
    'Sagittarius','Capricorn','Aquarius','Pisces'
  ];

  var SIGN_ZH = {
    'Aries'       : '牡羊座',
    'Taurus'      : '金牛座',
    'Gemini'      : '雙子座',
    'Cancer'      : '巨蟹座',
    'Leo'         : '獅子座',
    'Virgo'       : '處女座',
    'Libra'       : '天秤座',
    'Scorpio'     : '天蠍座',
    'Sagittarius' : '射手座',
    'Capricorn'   : '摩羯座',
    'Aquarius'    : '水瓶座',
    'Pisces'      : '雙魚座'
  };

  var SIGN_ES = {
    'Aries'       : 'Aries',
    'Taurus'      : 'Tauro',
    'Gemini'      : 'Géminis',
    'Cancer'      : 'Cáncer',
    'Leo'         : 'Leo',
    'Virgo'       : 'Virgo',
    'Libra'       : 'Libra',
    'Scorpio'     : 'Escorpio',
    'Sagittarius' : 'Sagitario',
    'Capricorn'   : 'Capricornio',
    'Aquarius'    : 'Acuario',
    'Pisces'      : 'Piscis'
  };

  function getSign(deg) {
    deg = ((deg % 360) + 360) % 360;
    return SIGNS[Math.floor(deg / 30)];
  }

  function localizeSign(signEn) {
    var langEl = document.getElementById('language-select');
    var lang   = langEl ? langEl.value : 'zh';
    if (lang === 'zh') { return SIGN_ZH[signEn] || signEn; }
    if (lang === 'es') { return SIGN_ES[signEn] || signEn; }
    return signEn;
  }

  /* ── [Fix 2] 從表格與宮位讀取所有天體度數 ── */
  function collectPlanets() {
    var planets = {};

    /* 1. 行星位置表 #bodies-tbody */
    var rows = document.querySelectorAll('#bodies-tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll('td');
      if (cells.length < 2) { continue; }
      var name = cells[0].textContent.trim();
      var deg  = parseFloat(cells[1].textContent.trim());
      if (name && !isNaN(deg)) { planets[name] = deg; }
    }

    /* 2. 天體點表 #points-tbody（北交點、南交點、凱龍、莉莉絲…） */
    var prows = document.querySelectorAll('#points-tbody tr');
    for (var j = 0; j < prows.length; j++) {
      var pcells = prows[j].querySelectorAll('td');
      if (pcells.length < 2) { continue; }
      var pname = pcells[0].textContent.trim();
      var pdeg  = parseFloat(pcells[1].textContent.trim());
      if (pname && !isNaN(pdeg)) { planets[pname] = pdeg; }
    }

    /*
     * 3. [Fix 2] ASC / MC：從 #houses-tbody 讀取
     *    宮位表欄位：宮 | 起始黃道° | 終止黃道° | 星座 | 宮主星 | 尊貴
     *    第1宮起始度 → ASC
     *    第10宮起始度 → MC
     *
     *    原本讀取 #asc-b / #mc-b，但這兩個 id 在 HTML 中不存在，
     *    改為從宮位表格直接解析。
     */
    var hrows = document.querySelectorAll('#houses-tbody tr');
    for (var h = 0; h < hrows.length; h++) {
      var hcells = hrows[h].querySelectorAll('td');
      if (hcells.length < 2) { continue; }
      var houseNum = parseInt(hcells[0].textContent.trim(), 10);
      var houseDeg = parseFloat(hcells[1].textContent.trim());
      if (isNaN(houseDeg)) { continue; }
      if (houseNum === 1)  { planets['ASC'] = houseDeg; }
      if (houseNum === 10) { planets['MC']  = houseDeg; }
    }

    return planets;
  }

  /* ── 主渲染函式 ── */
  function renderMidpoints() {
    var orbEl = document.getElementById('mp-orb-input');
    var orb   = orbEl ? parseFloat(orbEl.value) : 1.5;
    if (isNaN(orb) || orb <= 0) { orb = 1.5; }

    var planets   = collectPlanets();
    var plKeys    = Object.keys(planets);
    var elSection = document.getElementById('midpoint-section');
    var elEmpty   = document.getElementById('midpoint-empty');
    var elWrap    = document.getElementById('midpoint-table-wrap');
    var elTbody   = document.getElementById('midpoint-tbody');

    if (!elSection || !elEmpty || !elWrap || !elTbody) { return; }

    if (plKeys.length === 0) {
      elSection.style.display = 'none';
      return;
    }
    elSection.style.display = 'block';

    /* ★ 確認 midpoint.js 已載入 */
    if (typeof Midpoint === 'undefined') {
      elEmpty.textContent   = '⚠️ midpoint.js 未載入';
      elEmpty.style.display = 'block';
      elWrap.style.display  = 'none';
      return;
    }

    var planetGroupMap = {};

    for (var i = 0; i < plKeys.length; i++) {
      for (var j = i + 1; j < plKeys.length; j++) {
        var pA  = plKeys[i];
        var pB  = plKeys[j];
        var key = pA + '/' + pB;

        var mpResult = Midpoint.calcMidpoint(planets[pA], planets[pB]);
        var midDeg   = mpResult.degree;

        var allTriggers = [];

        for (var k = 0; k < plKeys.length; k++) {
          var pC = plKeys[k];
          if (pC === pA || pC === pB) { continue; }

          var aspects = Midpoint.checkAspects(midDeg, planets[pC], orb);

          for (var a = 0; a < aspects.length; a++) {
            if (aspects[a].name === 'Conjunction') {
              allTriggers.push({
                planet: pC,
                orbVal: aspects[a].orb,
                orb:    aspects[a].orb
              });
              break;
            }
          }
        }

        if (allTriggers.length === 0) { continue; }

        allTriggers.sort(function (a, b) {
          return getPlanetIndex(a.planet) - getPlanetIndex(b.planet);
        });

        for (var t = 0; t < allTriggers.length; t++) {
          var trigPlanet = allTriggers[t].planet;
          var trigOrb    = allTriggers[t].orbVal;

          var others = [];
          for (var ot = 0; ot < allTriggers.length; ot++) {
            if (ot !== t) { others.push(allTriggers[ot]); }
          }

          if (!planetGroupMap[trigPlanet]) {
            planetGroupMap[trigPlanet] = [];
          }
          planetGroupMap[trigPlanet].push({
            key:       key,
            midDeg:    midDeg,
            midSignEn: getSign(midDeg),
            orbVal:    trigOrb,
            others:    others
          });
        }
      }
    }

    elTbody.innerHTML = '';

    var groupPlanets = Object.keys(planetGroupMap);
    if (groupPlanets.length === 0) {
      elEmpty.textContent   = '此星盤無符合容許度的中點相位';
      elEmpty.style.display = 'block';
      elWrap.style.display  = 'none';
      return;
    }

    elEmpty.style.display = 'none';
    elWrap.style.display  = 'block';

    groupPlanets.sort(function (a, b) {
      return getPlanetIndex(a) - getPlanetIndex(b);
    });

    for (var g = 0; g < groupPlanets.length; g++) {
      var gPlanet  = groupPlanets[g];
      var gEntries = planetGroupMap[gPlanet];

      gEntries.sort(function (a, b) {
        return a.orbVal - b.orbVal;
      });

      /* 天體分群 header */
      var trHead = document.createElement('tr');
      trHead.className = 'mp-sign-group-header';
      var thCell = document.createElement('td');
      thCell.setAttribute('colspan', '5');
      thCell.innerHTML =
        '<span class="mp-sign-group-label" style="color:var(--color-gold);">'
        + '◈ ' + gPlanet
        + '</span>';
      trHead.appendChild(thCell);
      elTbody.appendChild(trHead);

      for (var e = 0; e < gEntries.length; e++) {
        var entry = gEntries[e];
        var tr    = document.createElement('tr');

        var td0 = document.createElement('td');
        td0.innerHTML = '<span class="mp-pair">' + entry.key + '</span>';
        tr.appendChild(td0);

        var td1 = document.createElement('td');
        td1.innerHTML = '<span class="mp-deg">' + entry.midDeg.toFixed(2) + '°</span>';
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        td2.innerHTML = '<span class="mp-sign">' + localizeSign(entry.midSignEn) + '</span>';
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        td3.innerHTML = '<span class="mp-trigger-orb">' + entry.orbVal.toFixed(2) + '°</span>';
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.style.cssText = 'padding:4px 8px;';
        if (entry.others.length > 0) {
          var otherHtml = '<div class="mp-trigger-wrap">';
          for (var oi = 0; oi < entry.others.length; oi++) {
            var oth = entry.others[oi];
            otherHtml += '<span class="mp-trigger-tag" style="opacity:0.65;">'
                       + '<span class="mp-trigger-planet">' + oth.planet + '</span>'
                       + '<span class="mp-trigger-orb">' + oth.orb.toFixed(2) + '°</span>'
                       + '</span>';
          }
          otherHtml += '</div>';
          td4.innerHTML = otherHtml;
        }
        tr.appendChild(td4);

        elTbody.appendChild(tr);
      }
    }
  }

  /* 對外暴露，讓 utility.js 可直接呼叫 */
  window.renderMidpoints = renderMidpoints;

  /* ── [Fix 1] 改用 chartReady 事件 + fallback ── */
  function init() {
    var recalcBtn = document.getElementById('mp-recalc-btn');

    /*
     * [Fix 1] 主要觸發：監聽 utility.js 繪製完成後發出的 'chartReady' 事件
     * utility.js 需在星盤渲染完成後加入：
     *   document.dispatchEvent(new CustomEvent('chartReady'));
     */
    document.addEventListener('chartReady', function () {
      renderMidpoints();
    });

    /*
     * [Fix 3] Fallback：若 utility.js 沒有發出 chartReady，
     * 在 form submit 後等待 1500ms 自動嘗試一次
     */
    var form = document.getElementById('form');
    if (form) {
      form.addEventListener('submit', function () {
        setTimeout(function () {
          /* 若 midpoint-section 仍是 none，代表 chartReady 未觸發，手動執行 */
          var sec = document.getElementById('midpoint-section');
          if (!sec || sec.style.display === 'none' || sec.style.display === '') {
            renderMidpoints();
          }
        }, 1500);
      });
    }

    /* 重新計算按鈕 */
    if (recalcBtn) {
      recalcBtn.addEventListener('click', renderMidpoints);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());