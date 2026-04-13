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
 *     - #asc-b         上升點 ASC 黃道度數
 *     - #mc-b          天頂   MC  黃道度數
 */
(function () {
  'use strict';

  /* ★ 行星標準順序（中文 key，與表格一致） */
  var PLANET_ORDER = [
    '太陽','月亮','水星','金星','火星',
    '木星','土星','天王星','海王星','冥王星',
    '北交點','南交點','凱龍','莉莉絲',
    'ASC','MC'          // ★ 新增：角點排在最後
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

  /* ── 從表格與角點元素收集所有天體度數 ── */
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

    /* 3. ★ 上升點 ASC（黃道度數來自 #asc-b） */
    var ascEl = document.getElementById('asc-b');
    if (ascEl) {
      var ascDeg = parseFloat(ascEl.textContent.trim());
      if (!isNaN(ascDeg)) { planets['ASC'] = ascDeg; }
    }

    /* 4. ★ 天頂 MC（黃道度數來自 #mc-b） */
    var mcEl = document.getElementById('mc-b');
    if (mcEl) {
      var mcDeg = parseFloat(mcEl.textContent.trim());
      if (!isNaN(mcDeg)) { planets['MC'] = mcDeg; }
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

    /*
     * ★ 漢堡學派核心計算
     *
     * 軸1 = (A + B) / 2  mod 360
     * 只檢查行星/角點 C 是否落在軸1的容許度內
     * 只保留 Conjunction(0°) → 天體確實落在軸1上
     *
     * 參與計算的天體：行星 + 北交點等天體點 + ASC + MC
     *
     * planetGroupMap[triggerPlanet] = [
     *   { key, midDeg, midSignEn, orbVal, others[] }, ...
     * ]
     */
    var planetGroupMap = {};

    for (var i = 0; i < plKeys.length; i++) {
      for (var j = i + 1; j < plKeys.length; j++) {
        var pA  = plKeys[i];
        var pB  = plKeys[j];
        var key = pA + '/' + pB;

        /* 計算中點軸1 = (A + B) / 2 */
        var mpResult = Midpoint.calcMidpoint(planets[pA], planets[pB]);
        var midDeg   = mpResult.degree;

        var allTriggers = [];

        for (var k = 0; k < plKeys.length; k++) {
          var pC = plKeys[k];
          if (pC === pA || pC === pB) { continue; }

          /* ★ 只檢查軸1，不檢查對衝軸（+180°） */
          var aspects = Midpoint.checkAspects(midDeg, planets[pC], orb);

          /* 只取 Conjunction（天體落在軸1上） */
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

        /* 依天體標準順序排列 */
        allTriggers.sort(function (a, b) {
          return getPlanetIndex(a.planet) - getPlanetIndex(b.planet);
        });

        /* 每個觸發天體各自建立群組記錄 */
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

    /* ★ 依天體標準順序排列群組 */
    groupPlanets.sort(function (a, b) {
      return getPlanetIndex(a) - getPlanetIndex(b);
    });

    /* ── 渲染 ── */
    for (var g = 0; g < groupPlanets.length; g++) {
      var gPlanet  = groupPlanets[g];
      var gEntries = planetGroupMap[gPlanet];

      /* 群組內依 orb 由小到大 */
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

        /* td0：中點組合 */
        var td0 = document.createElement('td');
        td0.innerHTML = '<span class="mp-pair">' + entry.key + '</span>';
        tr.appendChild(td0);

        /* td1：中點黃道度數 */
        var td1 = document.createElement('td');
        td1.innerHTML = '<span class="mp-deg">' + entry.midDeg.toFixed(2) + '°</span>';
        tr.appendChild(td1);

        /* td2：星座 */
        var td2 = document.createElement('td');
        td2.innerHTML = '<span class="mp-sign">' + localizeSign(entry.midSignEn) + '</span>';
        tr.appendChild(td2);

        /* td3：容許度 */
        var td3 = document.createElement('td');
        td3.innerHTML = '<span class="mp-trigger-orb">' + entry.orbVal.toFixed(2) + '°</span>';
        tr.appendChild(td3);

        /* td4：同軸其他天體 */
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

  /* ── 初始化 ── */
  function init() {
    var form      = document.getElementById('form');
    var recalcBtn = document.getElementById('mp-recalc-btn');

    if (form) {
      form.addEventListener('submit', function () {
        setTimeout(renderMidpoints, 500);
      });
    }
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