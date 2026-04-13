// ================================================================
// Utility.js  ─  西洋占星星盤  共用工具函式庫
// 傳統瀏覽器格式（無 ES Module），掛載於全域 window.AstroUtil
// ================================================================
(function (global) {
  'use strict';

  // ── 常數 ────────────────────────────────────────────────────────

  var SIGN_DATA = [
    {key:'aries',       symbol:'♈',start:0},  {key:'taurus',      symbol:'♉',start:30},
    {key:'gemini',      symbol:'♊',start:60}, {key:'cancer',      symbol:'♋',start:90},
    {key:'leo',         symbol:'♌',start:120},{key:'virgo',       symbol:'♍',start:150},
    {key:'libra',       symbol:'♎',start:180},{key:'scorpio',     symbol:'♏',start:210},
    {key:'sagittarius', symbol:'♐',start:240},{key:'capricorn',   symbol:'♑',start:270},
    {key:'aquarius',    symbol:'♒',start:300},{key:'pisces',      symbol:'♓',start:330}
  ];

  var ASPECTS_DEF = [
    {key:'conjunction', angle:0,   orb:8, level:'major', symbol:'☌'},
    {key:'opposition',  angle:180, orb:8, level:'major', symbol:'☍'},
    {key:'trine',       angle:120, orb:8, level:'major', symbol:'△'},
    {key:'square',      angle:90,  orb:8, level:'major', symbol:'□'},
    {key:'sextile',     angle:60,  orb:6, level:'major', symbol:'⚹'},
    {key:'quincunx',    angle:150, orb:5, level:'minor', symbol:'⚻'},
    {key:'semisextile', angle:30,  orb:3, level:'minor', symbol:'⚺'},
    {key:'semisquare',  angle:45,  orb:3, level:'minor', symbol:'∠'},
    {key:'sesquisquare',angle:135, orb:3, level:'minor', symbol:'⚼'},
    {key:'quintile',    angle:72,  orb:2, level:'minor', symbol:'Q'},
    {key:'biquintile',  angle:144, orb:2, level:'minor', symbol:'bQ'}
  ];

  var ASTROCHART_PLANET_MAP = {
    sun:'Sun', moon:'Moon', mercury:'Mercury', venus:'Venus', mars:'Mars',
    jupiter:'Jupiter', saturn:'Saturn', uranus:'Uranus', neptune:'Neptune', pluto:'Pluto',
    northNode:'NNode', lilith:'Lilith',
    asc:'Asc', mc:'Mc'
  };

  var PLANET_CHINESE = {
    'Sun':'日', 'Moon':'月', 'Mercury':'水', 'Venus':'金', 'Mars':'火',
    'Jupiter':'木', 'Saturn':'土', 'Uranus':'天', 'Neptune':'海',
    'Pluto':'冥', 'NNode':'北', 'Lilith':'莉',
    'Asc':'升', 'Mc':'頂'
  };

  var RULER_DISPLAY = {
    sun:     '☉ 太陽',
    moon:    '☽ 月亮',
    mercury: '☿ 水星',
    venus:   '♀ 金星',
    mars:    '♂ 火星',
    jupiter: '♃ 木星',
    saturn:  '♄ 土星',
    uranus:  '♅ 天王星',
    neptune: '♆ 海王星',
    pluto:   '♇ 冥王星'
  };

  var ANGLES_I18N = {
    zh: {
      sectionTitle: '天文角點 Angles',
      thAsc:        '上升 Asc',
      thMc:         '天頂 MC',
      thHd:         '地平度數',
      thEd:         '黃道度數',
      thDms:        '星座度分秒'
    },
    en: {
      sectionTitle: 'Angles',
      thAsc:        'Ascendant',
      thMc:         'Midheaven (MC)',
      thHd:         'Horizon Degrees',
      thEd:         'Ecliptic Degrees',
      thDms:        'Sign D° M\' S"'
    },
    es: {
      sectionTitle: 'Ángulos',
      thAsc:        'Ascendente',
      thMc:         'Medio Cielo (MC)',
      thHd:         'Grados Horizonte',
      thEd:         'Grados Eclíptica',
      thDms:        'Signo G° M\' S"'
    }
  };

  var ASP_ZH = {
    conjunction:  '合',
    opposition:   '對',
    trine:        '三',
    square:       '刑',
    sextile:      '六',
    quincunx:     '補',
    semisextile:  '半',
    semisquare:   '刑',
    sesquisquare: '倍',
    quintile:     '五',
    biquintile:   '雙'
  };

  var MATRIX_KEYS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','lilith','asc','mc'];

  var MATRIX_ABBR = {
    sun:'日', moon:'月', mercury:'水', venus:'金', mars:'火',
    jupiter:'木', saturn:'土', uranus:'天', neptune:'海',
    pluto:'冥', northNode:'北', lilith:'莉',
    asc:'升', mc:'頂'
  };

  var ASPECT_ANGLE_MAP = {
    conjunction:0, sextile:60, square:90, trine:120, opposition:180,
    quincunx:150, semisextile:30, semisquare:45, sesquisquare:135,
    quintile:72, biquintile:144
  };

  var AVG_MOTION = {
    sun:       0.9856,
    moon:     13.1760,
    mercury:   1.3833,
    venus:     1.2000,
    mars:      0.5240,
    jupiter:   0.0831,
    saturn:    0.0335,
    uranus:    0.0117,
    neptune:   0.0060,
    pluto:     0.0040,
    northNode:-0.0529,
    southNode: 0.0529,
    lilith:    0.1108,
    asc:       0,
    mc:        0
  };

  // ── 基礎工具 ─────────────────────────────────────────────────────

  function mod360(v) {
    return EphemerisUtils.mod360(v);
  }

  function localToUtcDate(dateStr, timeStr, geoLon) {
    var dp = dateStr.split('-');
    var tp = timeStr.split(':');
    var year   = parseInt(dp[0]);
    var month  = parseInt(dp[1]) - 1;
    var day    = parseInt(dp[2]);
    var hour   = parseInt(tp[0]);
    var minute = parseInt(tp[1]);
    var tzOffsetHours = Math.round(geoLon / 15);
    var localMs = Date.UTC(year, month, day, hour, minute, 0);
    var utcMs   = localMs - tzOffsetHours * 3600000;
    return new Date(utcMs);
  }

  function t(key, lang) {
    var L = (typeof LANGUAGE !== 'undefined') ? (LANGUAGE[lang] || LANGUAGE['en']) : {};
    if (key === 'asc') return '上升 Asc';
    if (key === 'mc')  return '天頂 MC';
    return L[key] || key;
  }

  function getSignForDD(dd) {
    dd = mod360(dd);
    return SIGN_DATA[Math.floor(dd / 30)] || SIGN_DATA[0];
  }

  function ddToSignDMS(dd, lang) {
    var sign   = getSignForDD(dd);
    var within = mod360(dd) - sign.start;
    var d = Math.floor(within);
    var m = Math.floor((within - d) * 60);
    var s = Math.round(((within - d) * 60 - m) * 60);
    if (s===60){s=0;m++;} if (m===60){m=0;d++;}
    return sign.symbol + ' ' + t(sign.key, lang) + ' ' + d + '° ' + m + "' " + s + '"';
  }

  function getSignLabel(dd, lang) {
    var sign = getSignForDD(dd);
    return sign.symbol + ' ' + t(sign.key, lang);
  }

  function getSignIngress(dd) {
    var sign   = getSignForDD(dd);
    var within = mod360(dd) - sign.start;
    var d = Math.floor(within);
    var m = Math.floor((within - d) * 60);
    var s = Math.round(((within - d) * 60 - m) * 60);
    if (s===60){s=0;m++;} if (m===60){m=0;d++;}
    return d + '° ' + m + "' " + s + '"';
  }

  // ── 天文計算 ─────────────────────────────────────────────────────

  function calcDynamicAyanamsa(dateStr, timeStr, geoLon) {
    var utcDate = localToUtcDate(dateStr, timeStr, geoLon);
    var utcHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;
    var jde = AstroHouses.dateToJDE(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth() + 1,
      utcDate.getUTCDate(),
      utcHour
    );
    return AstroHouses.calcAyanamsa(jde, 'lahiri');
  }

  function toDisplayLon(tropicalLon, zodiac, ayanamsa) {
    return zodiac === 'sidereal'
      ? mod360(tropicalLon - ayanamsa)
      : mod360(tropicalLon);
  }

  function calcAngles(dateStr, timeStr, lat, geoLon) {
    var utcDate = localToUtcDate(dateStr, timeStr, geoLon);
    var result = AstroAngles.calcAngles({
      year:           utcDate.getUTCFullYear(),
      month:          utcDate.getUTCMonth() + 1,
      date:           utcDate.getUTCDate(),
      hour:           utcDate.getUTCHours(),
      minute:         utcDate.getUTCMinutes(),
      second:         utcDate.getUTCSeconds(),
      latitude:       lat,
      longitude:      geoLon,
      utcOffsetHours: 0
    });
    return {
      ascTropical: result.ascendant,
      mcTropical:  result.midheaven,
      ramc:        result.lst,
      obliquity:   AstronomyUtils.getObliquityEcliptic(result.julianDate)
    };
  }

  function calcHouseCusps(ang, lat, houseSystem, zodiac, ayanamsa) {
    var cusps = AstroHouses.calculateHouseCusps(houseSystem, {
      rightAscensionMC:  ang.ramc,
      midheaven:         ang.mcTropical,
      ascendant:         ang.ascTropical,
      latitude:          lat,
      obliquityEcliptic: ang.obliquity,
      zodiac:            zodiac,
      ayanamsa:          zodiac === 'sidereal' ? ayanamsa : null
    });
    if (zodiac==='sidereal' && houseSystem!=='whole-sign' && houseSystem!=='equal-house') {
      cusps = cusps.map(function(c){ return mod360(c - ayanamsa); });
    }
    return cusps;
  }

  function getHouseNumber(lon, cusps) {
    lon = mod360(lon);
    for (var i=0; i<12; i++) {
      var s = mod360(cusps[i]), e = mod360(cusps[(i+1)%12]);
      var inside = (Math.abs(s-e)<0.0001) ? false
                 : (s<e) ? (lon>=s && lon<e)
                 : (lon>=s || lon<e);
      if (inside) return i+1;
    }
    var best=0, bestD=360;
    for (var j=0;j<12;j++){var d=mod360(lon-mod360(cusps[j]));if(d<bestD){bestD=d;best=j;}}
    return best+1;
  }

  function getBodyTropicalLon(bodyKey, astroTime) {
    if (bodyKey==='sun')  return mod360(Astronomy.SunPosition(astroTime).elon);
    if (bodyKey==='moon') return mod360(Astronomy.EclipticGeoMoon(astroTime).lon);
    if (bodyKey==='northNode'||bodyKey==='southNode') {
      var T=astroTime.tt/36525, omega=mod360(125.04452-1934.136261*T);
      return bodyKey==='northNode' ? omega : mod360(omega+180);
    }
    if (bodyKey==='lilith') {
      var T2 = astroTime.tt / 36525.0;
      var perigee = mod360(
        83.3532465
        + 4069.0137287 * T2
        - 0.0103200  * T2 * T2
        - T2 * T2 * T2 / 80053.0
        + T2 * T2 * T2 * T2 / 18999000.0
      );
      return mod360(perigee + 180);
    }
    var m={mercury:'Mercury',venus:'Venus',mars:'Mars',jupiter:'Jupiter',
           saturn:'Saturn',uranus:'Uranus',neptune:'Neptune',pluto:'Pluto'};
    if (m[bodyKey]) return mod360(Astronomy.Ecliptic(Astronomy.GeoVector(m[bodyKey],astroTime,true)).elon);
    return 0;
  }

  function isRetrograde(bodyKey, astroTime) {
    if ({sun:1,moon:1,northNode:1,southNode:1,lilith:1}[bodyKey]) return false;
    var dt=0.1;
    var l1=getBodyTropicalLon(bodyKey, new Astronomy.AstroTime(astroTime.ut-dt));
    var l2=getBodyTropicalLon(bodyKey, new Astronomy.AstroTime(astroTime.ut+dt));
    var diff=l2-l1;
    if(diff>180) diff-=360; if(diff<-180) diff+=360;
    return diff<0;
  }

  function calcAspects(bodyLons, includeMajor, includeMinor, orbOverrides) {
    var results=[], keys=Object.keys(bodyLons);
    for(var i=0;i<keys.length;i++){
      for(var j=i+1;j<keys.length;j++){
        if ((keys[i]==='asc'&&keys[j]==='mc')||(keys[i]==='mc'&&keys[j]==='asc')) continue;
        var diff=Math.abs(bodyLons[keys[i]]-bodyLons[keys[j]]);
        if(diff>180) diff=360-diff;
        ASPECTS_DEF.forEach(function(asp){
          if(asp.level==='major'&&!includeMajor) return;
          if(asp.level==='minor'&&!includeMinor) return;
          var effectiveOrb = (orbOverrides && orbOverrides[asp.key] != null)
            ? orbOverrides[asp.key]
            : asp.orb;
          var orb=Math.abs(diff-asp.angle);
          if(orb<=effectiveOrb) results.push({
            body1:keys[i], body2:keys[j],
            aspect:asp.key, symbol:asp.symbol,
            orb:orb.toFixed(2), level:asp.level
          });
        });
      }
    }
    return results;
  }

  function dailyMotion(bodyKey, astroTime) {
    var base = AVG_MOTION[bodyKey];
    if (base === undefined) return 0;
    var _noRetro = {sun:1,moon:1,northNode:1,southNode:1,lilith:1,asc:1,mc:1};
    if (base !== 0 && !_noRetro[bodyKey] && astroTime) {
      try {
        if (isRetrograde(bodyKey, astroTime)) {
          base = -Math.abs(base);
        }
      } catch(e) {}
    }
    return base;
  }

  // ── UI 輔助 ──────────────────────────────────────────────────────

  function updateAnglesI18n(lang) {
    var labels = ANGLES_I18N[lang] || ANGLES_I18N['zh'];
    document.getElementById('h-angles').textContent = labels.sectionTitle;
    document.getElementById('th-asc').textContent   = labels.thAsc;
    document.getElementById('th-mc').textContent    = labels.thMc;
    document.getElementById('th-hd').textContent    = labels.thHd;
    document.getElementById('th-ed').textContent    = labels.thEd;
    document.getElementById('th-dms').textContent   = labels.thDms;
  }

  function getDashArray(name) {
    var val = document.querySelector('input[name="dash-' + name + '"]:checked');
    return (val && val.value === 'dash') ? '6,4' : 'none';
  }

  function getOrbValue(id) {
    var el = document.getElementById(id);
    var v = el ? parseFloat(el.value) : NaN;
    return isNaN(v) ? 6 : v;
  }

  // ── 相位矩陣 ─────────────────────────────────────────────────────

  function buildAspectMatrix(allLons, inclMajor, inclMinor, orbOverrides) {
    var table = document.getElementById('aspect-matrix-table');
    if (!table) return;
    table.innerHTML = '';

    var keys = MATRIX_KEYS.filter(function(k){ return allLons[k] != null; });

    var aspMap = {};
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        if ((keys[i]==='asc'&&keys[j]==='mc')||(keys[i]==='mc'&&keys[j]==='asc')) continue;
        var diff = Math.abs(allLons[keys[i]] - allLons[keys[j]]);
        if (diff > 180) diff = 360 - diff;
        var best = null, bestOrb = 999;
        ASPECTS_DEF.forEach(function(asp) {
          if (asp.level === 'major' && !inclMajor) return;
          if (asp.level === 'minor' && !inclMinor) return;
          var effectiveOrb = (orbOverrides && orbOverrides[asp.key] != null)
            ? orbOverrides[asp.key] : asp.orb;
          var orb = Math.abs(diff - asp.angle);
          if (orb <= effectiveOrb && orb < bestOrb) {
            bestOrb = orb;
            best = asp;
          }
        });
        if (best) {
          aspMap[keys[i] + '||' + keys[j]] = best;
          aspMap[keys[j] + '||' + keys[i]] = best;
        }
      }
    }

    var tbody = document.createElement('tbody');
    keys.forEach(function(rowKey, ri) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.textContent = MATRIX_ABBR[rowKey] || rowKey;
      tr.appendChild(th);

      keys.forEach(function(colKey, ci) {
        var td = document.createElement('td');
        if (ci > ri) {
          td.className = 'asp-empty';
          td.textContent = '';
          td.style.border = 'none';
        } else if (ci === ri) {
          td.className = 'asp-self';
          td.textContent = MATRIX_ABBR[rowKey] || rowKey;
        } else {
          var asp = aspMap[rowKey + '||' + colKey];
          if (asp) {
            td.textContent = ASP_ZH[asp.key] || asp.symbol;
            td.className = 'asp-' + asp.key;
            td.title = ASP_ZH[asp.key] || asp.key;
          } else {
            td.className = 'asp-empty';
            td.textContent = '';
          }
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  // ── 相位連線繪製 ─────────────────────────────────────────────────

  function drawAspectLines(allLons, cuspsArr, chartSize, aspectStroke,
                           lineOpp, lineTrine, lineSquare, lineSextile,
                           dashOpp, dashTrine, dashSquare, dashSextile,
                           orbOpp, orbTrine, orbSquare, orbSextile) {
    var svgEl = document.querySelector('#paper svg');
    if (!svgEl) return;

    var sz      = parseInt(chartSize) || 620;
    var cx      = sz / 2;
    var cy      = sz / 2;
    var margin  = 50;
    var outerR  = sz / 2 - margin;
    var innerR  = outerR / 2;
    var shift   = (360 - cuspsArr[0]) % 360;

    function lonToXY(lon) {
      var angleRad = (180 - lon - shift) * Math.PI / 180;
      return {
        x: cx + innerR * Math.cos(angleRad),
        y: cy + innerR * Math.sin(angleRad)
      };
    }

    var aspSpecs = [];
    if (lineOpp)     aspSpecs.push({ angle: 180, orb: orbOpp,     color: '#A020F0', dash: dashOpp });
    if (lineTrine)   aspSpecs.push({ angle: 120, orb: orbTrine,   color: '#7ec98f', dash: dashTrine });
    if (lineSquare)  aspSpecs.push({ angle: 90,  orb: orbSquare,  color: '#ff6b6b', dash: dashSquare });
    if (lineSextile) aspSpecs.push({ angle: 60,  orb: orbSextile, color: '#4169E1', dash: dashSextile });

    if (aspSpecs.length === 0) return;

    var strokeW = Math.max(0.5, aspectStroke);
    var lonsForLines = {};
    Object.keys(allLons).forEach(function(k) {
      if (k !== 'southNode') { lonsForLines[k] = allLons[k]; }
    });

    var keys = Object.keys(lonsForLines);
    var lines = [], seen = {};

    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        if ((keys[i]==='asc'&&keys[j]==='mc')||(keys[i]==='mc'&&keys[j]==='asc')) continue;
        var diff = Math.abs(lonsForLines[keys[i]] - lonsForLines[keys[j]]);
        if (diff > 180) diff = 360 - diff;
        aspSpecs.forEach(function(spec) {
          if (Math.abs(diff - spec.angle) <= spec.orb) {
            var key = spec.angle + '_' + keys[i] + '_' + keys[j];
            if (!seen[key]) {
              seen[key] = true;
              lines.push({ a: keys[i], b: keys[j], color: spec.color, dash: spec.dash });
            }
          }
        });
      }
    }

    if (lines.length === 0) return;

    var layerId = 'fallback-aspect-lines-layer';
    var old = svgEl.querySelector('#' + layerId);
    if (old) old.parentNode.removeChild(old);

    var layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('id', layerId);
    svgEl.insertBefore(layer, svgEl.firstChild);

    lines.forEach(function(item) {
      var p1 = lonToXY(lonsForLines[item.a]);
      var p2 = lonToXY(lonsForLines[item.b]);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x.toFixed(2));
      line.setAttribute('y1', p1.y.toFixed(2));
      line.setAttribute('x2', p2.x.toFixed(2));
      line.setAttribute('y2', p2.y.toFixed(2));
      line.setAttribute('stroke',         item.color);
      line.setAttribute('stroke-width',   strokeW);
      line.setAttribute('stroke-opacity', '0.85');
      line.setAttribute('stroke-linecap', 'round');
      if (item.dash && item.dash !== 'none') {
        line.setAttribute('stroke-dasharray', item.dash);
      }
      layer.appendChild(line);
    });
  }

  // ── 行星符號替換 ─────────────────────────────────────────────────

  function replacePlanetSymbolsWithChinese(planetNamesOrdered, symbolScale, pointsColor) {
    var svgEl = document.querySelector('#paper svg');
    if (!svgEl) return;

    planetNamesOrdered.forEach(function(name) {
      var zh = PLANET_CHINESE[name];
      if (!zh) return;

      var gEl = svgEl.querySelector('#paper-planets-' + name);
      if (!gEl) { gEl = svgEl.querySelector('[id$="-planets-' + name + '"]'); }
      if (!gEl) return;

      var cx2, cy2;
      try {
        var bbox = gEl.getBBox();
        cx2 = bbox.x + bbox.width  / 2;
        cy2 = bbox.y + bbox.height / 2;
      } catch(e) {
        var tf = gEl.getAttribute('transform') || '';
        var m  = tf.match(/translate\(\s*([\d.\-]+)[,\s]+([\d.\-]+)/);
        cx2 = m ? parseFloat(m[1]) : 0;
        cy2 = m ? parseFloat(m[2]) : 0;
      }

      while (gEl.firstChild) { gEl.removeChild(gEl.firstChild); }

      var fontSize = Math.max(8, Math.round(13 * symbolScale));
      var textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', cx2);
      textEl.setAttribute('y', cy2);
      textEl.setAttribute('text-anchor',       'middle');
      textEl.setAttribute('dominant-baseline', 'central');
      textEl.setAttribute('font-size',         fontSize + 'px');
      textEl.setAttribute('font-weight',       '700');
      textEl.setAttribute('font-family',       "'Noto Sans TC','Microsoft JhengHei',sans-serif");
      textEl.setAttribute('fill',              pointsColor || '#f9d56e');
      textEl.setAttribute('stroke',            'none');
      textEl.setAttribute('pointer-events',    'none');
      textEl.textContent = zh;
      gEl.appendChild(textEl);
    });
  }

  // ── 入/出相判斷 ──────────────────────────────────────────────────

  function applyingText(asp, allLons, astroTime) {
    if (typeof AspectDirection === 'undefined') return '';
    var angle = ASPECT_ANGLE_MAP[asp.aspect];
    if (angle === undefined) return '';
    if (allLons[asp.body1] == null) return '';
    if (allLons[asp.body2] == null) return '';

    try {
      var isAscMc1 = (asp.body1 === 'asc' || asp.body1 === 'mc');
      var isAscMc2 = (asp.body2 === 'asc' || asp.body2 === 'mc');

      if (isAscMc1 || isAscMc2) {
        var ascmcLon  = isAscMc2 ? allLons[asp.body2] : allLons[asp.body1];
        var planetLon = isAscMc2 ? allLons[asp.body1] : allLons[asp.body2];
        var t1 = planetLon - angle;
        var t2 = planetLon + angle;
        var arc1 = (((t1 - ascmcLon) % 360) + 360) % 360; if (arc1 > 180) arc1 -= 360;
        var arc2 = (((t2 - ascmcLon) % 360) + 360) % 360; if (arc2 > 180) arc2 -= 360;
        var nearestArc = (Math.abs(arc1) <= Math.abs(arc2)) ? arc1 : arc2;
        return nearestArc > 0 ? '入相' : '出相';
      } else {
        var dm1 = dailyMotion(asp.body1, astroTime);
        var dm2 = dailyMotion(asp.body2, astroTime);
        var res = AspectDirection.calculate(
          { longitude: allLons[asp.body1], dailyMotion: dm1 },
          { longitude: allLons[asp.body2], dailyMotion: dm2 },
          angle, { orbLimit: 12 }
        );
        return res ? (res.directionZH || '') : '';
      }
    } catch(e) { return ''; }
  }

  // ── 圖形偵測 ─────────────────────────────────────────────────────
  // 偵測：T-square（三刑會沖）、Grand Trine（大三角）、
  //       Grand Sextile（六芒星60°三角）、Kite（風箏）
  // 回傳陣列，每個元素 { type, label, symbol, bodies, description, color }

  function detectChartPatterns(allLons, orbOverrides) {
    var defaultOrbs = { opposition: 8, square: 8, trine: 8, sextile: 6 };
    var orbs = {
      opposition: (orbOverrides && orbOverrides.opposition != null) ? orbOverrides.opposition : defaultOrbs.opposition,
      square:     (orbOverrides && orbOverrides.square     != null) ? orbOverrides.square     : defaultOrbs.square,
      trine:      (orbOverrides && orbOverrides.trine      != null) ? orbOverrides.trine      : defaultOrbs.trine,
      sextile:    (orbOverrides && orbOverrides.sextile    != null) ? orbOverrides.sextile    : defaultOrbs.sextile
    };

    // 取得有效行星（排除 southNode）
    var keys = Object.keys(allLons).filter(function(k) {
      return k !== 'southNode' && allLons[k] != null;
    });

    var ABBR = MATRIX_ABBR;

    // 輔助：計算兩點角距
    function angDiff(a, b) {
      var d = Math.abs(allLons[a] - allLons[b]);
      if (d > 180) d = 360 - d;
      return d;
    }

    // 輔助：是否符合某相位角度（含容忍度）
    function isAsp(a, b, angle, orb) {
      return Math.abs(angDiff(a, b) - angle) <= orb;
    }

    // 輔助：排除 Asc/MC 互相配對
    function notAscMc(a, b) {
      return !((a === 'asc' && b === 'mc') || (a === 'mc' && b === 'asc'));
    }

    // 輔助：行星顯示名稱
    function label(k) { return ABBR[k] || k; }

    var found = [];
    var usedSets = []; // 避免完全重複的組合

    function setKey(arr) { return arr.slice().sort().join(','); }
    function alreadyFound(arr) {
      var k = setKey(arr);
      for (var i = 0; i < usedSets.length; i++) { if (usedSets[i] === k) return true; }
      return false;
    }
    function markFound(arr) { usedSets.push(setKey(arr)); }

    // ── 1. T-square（三刑會沖）──────────────────────────────────
    // 兩顆行星互對分(180°)，第三顆與兩者各呈四分(90°)
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        if (!notAscMc(keys[i], keys[j])) continue;
        if (!isAsp(keys[i], keys[j], 180, orbs.opposition)) continue;
        // 找頂點
        for (var k = 0; k < keys.length; k++) {
          if (k === i || k === j) continue;
          if (!notAscMc(keys[i], keys[k])) continue;
          if (!notAscMc(keys[j], keys[k])) continue;
          if (isAsp(keys[i], keys[k], 90, orbs.square) &&
              isAsp(keys[j], keys[k], 90, orbs.square)) {
            var bodies = [keys[i], keys[j], keys[k]];
            if (!alreadyFound(bodies)) {
              markFound(bodies);
              found.push({
                type:        'tsquare',
                label:       '三刑會沖 T-Square',
                symbol:      '⊤',
                bodies:      bodies,
                description: label(keys[i]) + ' ☍ ' + label(keys[j]) + '，頂點：' + label(keys[k]),
                color:       '#ff8a8a'
              });
            }
          }
        }
      }
    }

    // ── 2. Grand Trine（大三角）────────────────────────────────
    // 三顆行星互呈三分(120°)
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        if (!notAscMc(keys[i], keys[j])) continue;
        if (!isAsp(keys[i], keys[j], 120, orbs.trine)) continue;
        for (var k = j + 1; k < keys.length; k++) {
          if (!notAscMc(keys[i], keys[k])) continue;
          if (!notAscMc(keys[j], keys[k])) continue;
          if (isAsp(keys[i], keys[k], 120, orbs.trine) &&
              isAsp(keys[j], keys[k], 120, orbs.trine)) {
            var bodies = [keys[i], keys[j], keys[k]];
            if (!alreadyFound(bodies)) {
              markFound(bodies);
              found.push({
                type:        'grandtrine',
                label:       '大三角 Grand Trine',
                symbol:      '△',
                bodies:      bodies,
                description: bodies.map(label).join(' △ '),
                color:       '#7ec98f'
              });
            }
          }
        }
      }
    }

    // ── 3. Kite（風箏）─────────────────────────────────────────
    // 大三角基礎上，第四顆行星與大三角其中一顆對分(180°)，
    // 並與另外兩顆各呈六分(60°)
    for (var fi = 0; fi < found.length; fi++) {
      if (found[fi].type !== 'grandtrine') continue;
      var gt = found[fi].bodies;
      for (var m = 0; m < keys.length; m++) {
        if (gt.indexOf(keys[m]) !== -1) continue;
        for (var n = 0; n < gt.length; n++) {
          var apex   = gt[n];
          var other1 = gt[(n + 1) % 3];
          var other2 = gt[(n + 2) % 3];
          if (!notAscMc(keys[m], apex)) continue;
          if (isAsp(keys[m], apex,   180, orbs.opposition) &&
              isAsp(keys[m], other1,  60, orbs.sextile)    &&
              isAsp(keys[m], other2,  60, orbs.sextile)) {
            var bodies = gt.concat([keys[m]]);
            if (!alreadyFound(bodies)) {
              markFound(bodies);
              found.push({
                type:        'kite',
                label:       '風箏 Kite',
                symbol:      '🪁',
                bodies:      bodies,
                description: '大三角（' + gt.map(label).join('·') + '）+ 頂點 ' + label(keys[m]),
                color:       '#67e8f9'
              });
            }
          }
        }
      }
    }

	// ── 插入位置：在「// ── 4. Grand Sextile」區塊之前 ──────────────
	// 在 detectChartPatterns 函式內，Grand Trine 偵測之後加入此段

	// ── 3b. Minor Grand Trine（小三角形）────────────────────────────
	// 結構：一對三分相(120°) + 兩對六分相(60°)
	// 三顆行星 A、B、C，其中 A△C（三分），A⚹B（六分），B⚹C（六分）
	// B 位於 A 與 C 之間（六分相頂點，朝向星盤中心方向）
	for (var i = 0; i < keys.length; i++) {
	  for (var j = i + 1; j < keys.length; j++) {
		if (!notAscMc(keys[i], keys[j])) continue;
		// keys[i] 與 keys[j] 互呈三分相 → 作為底邊
		if (!isAsp(keys[i], keys[j], 120, orbs.trine)) continue;
		// 找頂點 keys[k]：與兩端各呈六分相
		for (var k = 0; k < keys.length; k++) {
		  if (k === i || k === j) continue;
		  if (!notAscMc(keys[i], keys[k])) continue;
		  if (!notAscMc(keys[j], keys[k])) continue;
		  if (isAsp(keys[i], keys[k], 60, orbs.sextile) &&
			  isAsp(keys[j], keys[k], 60, orbs.sextile)) {
			var bodies = [keys[i], keys[j], keys[k]];
			if (!alreadyFound(bodies)) {
			  markFound(bodies);
			  found.push({
				type:        'minorgrandtrine',
				label:       '小三角形 Minor Grand Trine',
				symbol:      '▽',
				bodies:      bodies,
				description: label(keys[i]) + ' △ ' + label(keys[j])
							 + '，頂點：' + label(keys[k])
							 + '（' + label(keys[i]) + ' ⚹ ' + label(keys[k])
							 + '，' + label(keys[j]) + ' ⚹ ' + label(keys[k]) + '）',
				color:       '#87CEEB'
			  });
			}
		  }
		}
	  }
	}
    

    return found;
  }

  // ── 圖形偵測結果渲染 ─────────────────────────────────────────────

  function renderChartPatterns(patterns) {
    var container = document.getElementById('chart-patterns-container');
    if (!container) return;

    if (!patterns || patterns.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    var list = document.getElementById('chart-patterns-list');
    if (!list) return;
    list.innerHTML = '';

    patterns.forEach(function(p) {
      var item = document.createElement('div');
      item.className = 'pattern-item';
      item.style.borderLeftColor = p.color;

      var header = document.createElement('div');
      header.className = 'pattern-header';

      var sym = document.createElement('span');
      sym.className = 'pattern-symbol';
      sym.style.color = p.color;
      sym.textContent = p.symbol;

      var lbl = document.createElement('span');
      lbl.className = 'pattern-label';
      lbl.style.color = p.color;
      lbl.textContent = p.label;

      header.appendChild(sym);
      header.appendChild(lbl);

      var desc = document.createElement('div');
      desc.className = 'pattern-desc';
      desc.textContent = p.description;

      item.appendChild(header);
      item.appendChild(desc);
      list.appendChild(item);
    });
  }

  // ── 星盤繪製 ─────────────────────────────────────────────────────

  function drawAstroChart(cuspsArr, allLons, chartSize, inclMajor, inclMinor,
                          planetMode, lineOpp, lineTrine, lineSquare, lineSextile,
                          dashOpp, dashTrine, dashSquare, dashSextile,
                          orbOpp, orbTrine, orbSquare, orbSextile) {
    var sz           = parseInt(chartSize) || 620;
    var _ps          = document.getElementById('planet-size');
    var _as          = document.getElementById('aspect-stroke');
    var symbolScale  = _ps ? parseFloat(_ps.value) || 1.0 : 1.0;
    var aspectStroke = _as ? parseFloat(_as.value) || 1.0 : 1.0;

    var wrapper = document.getElementById('chart-wrapper');
    wrapper.innerHTML = '<div id="paper" style="width:' + sz + 'px;height:' + sz + 'px;margin:0 auto;"></div>';

    var planetNamesOrdered = [];
    var planets = {};
    var bodyKeys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','lilith'];

    bodyKeys.forEach(function(key){
      var name = ASTROCHART_PLANET_MAP[key];
      if (name && allLons[key] != null) {
        var speed = 1;
        if (global._lastAstroTime && !{northNode:1,lilith:1}[key]) {
          try {
            var dt = 0.1;
            var l1 = getBodyTropicalLon(key, new Astronomy.AstroTime(global._lastAstroTime.ut - dt));
            var l2 = getBodyTropicalLon(key, new Astronomy.AstroTime(global._lastAstroTime.ut + dt));
            var dv = l2 - l1;
            if (dv > 180) dv -= 360;
            if (dv < -180) dv += 360;
            speed = dv < 0 ? -1 : 1;
          } catch(ex){}
        }
        planets[name] = [allLons[key], speed];
        planetNamesOrdered.push(name);
      }
    });

    if (allLons['asc'] != null) { planets['Asc'] = [allLons['asc'], 1]; planetNamesOrdered.push('Asc'); }
    if (allLons['mc']  != null) { planets['Mc']  = [allLons['mc'],  1]; planetNamesOrdered.push('Mc');  }

    var data = { planets: planets, cusps: cuspsArr };

    var aspectsConfig = {};
    if (inclMajor) {
      aspectsConfig['conjunction'] = { degree: 0, orbit: 8, color: 'rgba(200,200,200,0.55)' };
    }
    if (inclMinor) {
      aspectsConfig['quincunx']     = { degree: 150, orbit: 5, color: '#c084fc' };
      aspectsConfig['semisextile']  = { degree: 30,  orbit: 3, color: '#94a3b8' };
      aspectsConfig['semisquare']   = { degree: 45,  orbit: 3, color: '#fb923c' };
      aspectsConfig['sesquisquare'] = { degree: 135, orbit: 3, color: '#fb923c' };
      aspectsConfig['quintile']     = { degree: 72,  orbit: 2, color: '#67e8f9' };
      aspectsConfig['biquintile']   = { degree: 144, orbit: 2, color: '#67e8f9' };
    }

    var pointsColor   = '#f9d56e';
    var _allLons      = allLons;
    var _cuspsArr     = cuspsArr;
    var _chartSize    = chartSize;
    var _aspectStroke = aspectStroke;

    setTimeout(function() {
      try {
        if (typeof astrology === 'undefined' || !astrology.Chart) {
          throw new Error('astrology.Chart 未定義，請確認 ./src/astrochart.js 路徑正確');
        }

        var settings = {
          SYMBOL_SCALE:           symbolScale,
          POINTS_STROKE:          aspectStroke * 1.8,
          SIGNS_STROKE:           aspectStroke * 1.5,
          CIRCLE_STRONG:          aspectStroke * 2,
          CUSPS_STROKE:           aspectStroke,
          SYMBOL_AXIS_STROKE:     aspectStroke * 1.6,
          COLOR_BACKGROUND:       '#16213e',
          POINTS_COLOR:           pointsColor,
          SIGNS_COLOR:            '#aad4f5',
          CIRCLE_COLOR:           '#aad4f5',
          LINE_COLOR:             '#aad4f5',
          CUSPS_FONT_COLOR:       '#e8e8f0',
          SYMBOL_AXIS_FONT_COLOR: '#f9d56e',
          ASPECTS:                aspectsConfig
        };

        var chart = new astrology.Chart('paper', sz, sz, settings);
        var radix = chart.radix(data);
        radix.aspects();

        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            drawAspectLines(_allLons, _cuspsArr, _chartSize, _aspectStroke,
                            lineOpp, lineTrine, lineSquare, lineSextile,
                            dashOpp, dashTrine, dashSquare, dashSextile,
                            orbOpp, orbTrine, orbSquare, orbSextile);
            if (planetMode === 'chinese') {
              replacePlanetSymbolsWithChinese(planetNamesOrdered, symbolScale, pointsColor);
            }
          });
        });

      } catch(e) {
        document.getElementById('chart-wrapper').innerHTML =
          '<div class="placeholder">⚠️ 繪圖失敗：' + e.message + '</div>';
        console.error(e);
      }
    }, 50);
  }

  // ── 星座符號覆寫（astrochart SVG） ───────────────────────────────

  function patchAstroChartSignSymbols() {
    var SIGN_ZH = {
      "Aries":"牡羊", "Taurus":"金牛", "Gemini":"雙子",
      "Cancer":"巨蟹", "Leo":"獅子", "Virgo":"處女",
      "Libra":"天秤", "Scorpio":"天蠍", "Sagittarius":"射手",
      "Capricorn":"摩羯", "Aquarius":"水瓶", "Pisces":"雙魚"
    };
    var SIGNS = {};
    Object.keys(SIGN_ZH).forEach(function(k){ SIGNS[k] = true; });
    var _orig = astrology.SVG.prototype.getSymbol;

    astrology.SVG.prototype.getSymbol = function(name, x, y) {
      if (SIGNS[name]) {
        var ns  = "http://www.w3.org/2000/svg";
        var g   = document.createElementNS(ns, "g");
        var txt = document.createElementNS(ns, "text");
        var scale = astrology.SYMBOL_SCALE || 1;
        txt.setAttribute("x", x);
        txt.setAttribute("y", y);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "central");
        txt.setAttribute("font-size", 12 * scale);
        txt.setAttribute("fill", "#FFD700");
        txt.setAttribute("font-family", "'Noto Sans TC', 'Segoe UI', sans-serif");
        txt.setAttribute("font-weight", "bold");
        txt.textContent = SIGN_ZH[name];
        g.appendChild(txt);
        return g;
      }
      return _orig.call(this, name, x, y);
    };
  }

  // ── 公開 API ─────────────────────────────────────────────────────

  global.AstroUtil = {
    // 常數
    SIGN_DATA:             SIGN_DATA,
    ASPECTS_DEF:           ASPECTS_DEF,
    ASTROCHART_PLANET_MAP: ASTROCHART_PLANET_MAP,
    PLANET_CHINESE:        PLANET_CHINESE,
    RULER_DISPLAY:         RULER_DISPLAY,
    ANGLES_I18N:           ANGLES_I18N,
    ASP_ZH:                ASP_ZH,
    MATRIX_KEYS:           MATRIX_KEYS,
    MATRIX_ABBR:           MATRIX_ABBR,
    ASPECT_ANGLE_MAP:      ASPECT_ANGLE_MAP,
    AVG_MOTION:            AVG_MOTION,
    // 函式
    mod360:                        mod360,
    localToUtcDate:                localToUtcDate,
    t:                             t,
    getSignForDD:                  getSignForDD,
    ddToSignDMS:                   ddToSignDMS,
    getSignLabel:                  getSignLabel,
    getSignIngress:                getSignIngress,
    calcDynamicAyanamsa:           calcDynamicAyanamsa,
    toDisplayLon:                  toDisplayLon,
    calcAngles:                    calcAngles,
    calcHouseCusps:                calcHouseCusps,
    getHouseNumber:                getHouseNumber,
    getBodyTropicalLon:            getBodyTropicalLon,
    isRetrograde:                  isRetrograde,
    calcAspects:                   calcAspects,
    dailyMotion:                   dailyMotion,
    updateAnglesI18n:              updateAnglesI18n,
    getDashArray:                  getDashArray,
    getOrbValue:                   getOrbValue,
    buildAspectMatrix:             buildAspectMatrix,
    drawAspectLines:               drawAspectLines,
    replacePlanetSymbolsWithChinese: replacePlanetSymbolsWithChinese,
    applyingText:                  applyingText,
    detectChartPatterns:           detectChartPatterns,
    renderChartPatterns:           renderChartPatterns,
    drawAstroChart:                drawAstroChart,
    patchAstroChartSignSymbols:    patchAstroChartSignSymbols
  };

}(window));