/**
 * astro-houses.js  v2.1.0
 * ========================
 * v2.1.0 新增：
 *   [新增] SIGN_RULERS：星座守護星對應表（現代 + 傳統雙模式）
 *   [新增] getHouseRuler(houseIndex, cusps, opts)：查詢指定宮位的宮主星
 *   [新增] getAllHouseRulers(cusps, opts)：取得全部 12 宮的宮主星陣列
 *
 * v2.0.1 修正：
 *   [修正] calculateCampanusHouseCusps：
 *          回傳陣列元素統一為 parseFloat(number)，
 *          與其他宮制一致，避免 HTML 層呼叫 .toFixed() 時報錯。
 *
 * v2.0.0 修正（維持）：
 *   [修正] calculatePlacidianHouseCusps：
 *          semiArcRatio 還原正確比例（c2/c11=2/3, c3/c12=1/3）
 *          算法還原為原始 forum 三角簡化公式 + 固定 +180°
 *   [修正] buildQuadrantCusps：還原為原始 shouldMod180 邏輯
 *   [修正] calculateCampanusHouseCusps：oa11/oa12 還原為 ramc + atan
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.AstroHouses = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ============================================================
  // 1. 數學工具函數
  // ============================================================

  function arccot(x)              { return Math.PI / 2 - Math.atan(x); }
  function degreesToRadians(d)    { return d * (Math.PI / 180); }
  function radiansToDegrees(r)    { return r * (180 / Math.PI); }
  function sinFromDegrees(d)      { return Math.sin(degreesToRadians(d)); }
  function cosFromDegrees(d)      { return Math.cos(degreesToRadians(d)); }
  function tanFromDegrees(d)      { return Math.tan(degreesToRadians(d)); }

  function modulo(number, mod) {
    return (number % mod + mod) % mod;
  }

  function atan2Degrees(y, x) {
    return modulo(radiansToDegrees(Math.atan2(y, x)), 360);
  }

  function decimalDegreesToDMS(dd) {
    dd = modulo(parseFloat(dd), 360);
    var deg = Math.floor(dd);
    var mf  = (dd - deg) * 60;
    var min = Math.floor(mf);
    var sec = Math.round((mf - min) * 60);
    if (sec === 60) { min++; sec = 0; }
    if (min === 60) { deg++; min = 0; }
    if (deg === 360) { deg = 0; }
    return { degrees: deg, minutes: min, seconds: sec };
  }

  function dmsString(dms) {
    return dms.degrees + '\u00b0' + dms.minutes + '\'' + dms.seconds + '"';
  }

  function isDegreeWithinCircleArc(arcLow, arcHigh, degree, edges) {
    edges = edges || '[)';
    var ops = {
      '[': function(a,b){ return a >= b; },
      '(': function(a,b){ return a >  b; },
      ']': function(a,b){ return a <= b; },
      ')': function(a,b){ return a <  b; }
    };
    if (arcLow > arcHigh) {
      arcHigh += 360;
      if (degree < arcLow) degree += 360;
    }
    return ops[edges[0]](degree, arcLow) && ops[edges[1]](degree, arcHigh);
  }

  // ============================================================
  // 2. 黃道星座資料
  // ============================================================

  var SIGNS_DATA = [
    { key: 'aries',       zodiacStart:   0, zodiacEnd:  30 },
    { key: 'taurus',      zodiacStart:  30, zodiacEnd:  60 },
    { key: 'gemini',      zodiacStart:  60, zodiacEnd:  90 },
    { key: 'cancer',      zodiacStart:  90, zodiacEnd: 120 },
    { key: 'leo',         zodiacStart: 120, zodiacEnd: 150 },
    { key: 'virgo',       zodiacStart: 150, zodiacEnd: 180 },
    { key: 'libra',       zodiacStart: 180, zodiacEnd: 210 },
    { key: 'scorpio',     zodiacStart: 210, zodiacEnd: 240 },
    { key: 'sagittarius', zodiacStart: 240, zodiacEnd: 270 },
    { key: 'capricorn',   zodiacStart: 270, zodiacEnd: 300 },
    { key: 'aquarius',    zodiacStart: 300, zodiacEnd: 330 },
    { key: 'pisces',      zodiacStart: 330, zodiacEnd: 360 }
  ];

  var SIDEREAL_OFFSET = 24.1;

  function signZodiacStart(sign, zodiac, ayanamsa) {
    if (zodiac === 'sidereal') {
      var offset = (ayanamsa != null) ? ayanamsa : SIDEREAL_OFFSET;
      return parseFloat(modulo(sign.zodiacStart + offset, 360).toFixed(4));
    }
    return parseFloat(modulo(sign.zodiacStart, 360).toFixed(4));
  }

  function signZodiacEnd(sign, zodiac, ayanamsa) {
    if (zodiac === 'sidereal') {
      var offset = (ayanamsa != null) ? ayanamsa : SIDEREAL_OFFSET;
      return parseFloat(modulo(sign.zodiacEnd + offset, 360).toFixed(4));
    }
    return parseFloat(modulo(sign.zodiacEnd, 360).toFixed(4));
  }

  // ============================================================
  // 3. 儒略日與動態 Ayanamsa
  // ============================================================

  function dateToJDE(year, month, day, hour) {
    hour = (hour != null) ? hour : 12.0;
    if (month <= 2) { year -= 1; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25  * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + day + (hour / 24.0) + B - 1524.5;
  }

  function calcAyanamsa(jde, ayanamsaType) {
    ayanamsaType = (ayanamsaType || 'lahiri').toLowerCase();
    var J2000 = 2451545.0;
    var T     = (jde - J2000) / 36525.0;
    var base  = {
      'lahiri':        23.85,
      'fagan-bradley': 24.04,
      'raman':         22.46,
      'krishnamurti':  23.86
    }[ayanamsaType];
    if (base == null) { base = 23.85; }
    return parseFloat((base + T * (50.2388475 / 3600 * 100)).toFixed(6));
  }

  function getSiderealOffset(opts) {
    opts = opts || {};
    if (opts.ayanamsa != null) return parseFloat(opts.ayanamsa);
    if (opts.jde != null)      return calcAyanamsa(opts.jde, opts.ayanamsaType);
    if (opts.year != null && opts.month != null && opts.day != null) {
      return calcAyanamsa(
        dateToJDE(opts.year, opts.month, opts.day, opts.hour),
        opts.ayanamsaType
      );
    }
    return SIDEREAL_OFFSET;
  }

  // ============================================================
  // 4. 黃道帶判斷
  // ============================================================

  function applyZodiacOffsetCounter(longitude, zodiac, ayanamsa) {
    longitude = parseFloat(longitude);
    if (zodiac === 'sidereal' || zodiac === 'astronomical') {
      return modulo(longitude - ((ayanamsa != null) ? ayanamsa : SIDEREAL_OFFSET), 360);
    }
    return modulo(longitude, 360);
  }

  function applyZodiacOffsetClockwise(longitude, zodiac, ayanamsa) {
    longitude = parseFloat(longitude);
    if (zodiac === 'sidereal' || zodiac === 'astronomical') {
      return modulo(longitude + ((ayanamsa != null) ? ayanamsa : SIDEREAL_OFFSET), 360);
    }
    return modulo(longitude, 360);
  }

  function getZodiacSign(opts) {
    var dd       = (opts && opts.decimalDegrees != null) ? parseFloat(opts.decimalDegrees) : 0;
    var zodiac   = (opts && opts.zodiac)          ? opts.zodiac   : 'tropical';
    var ayanamsa = (opts && opts.ayanamsa != null) ? opts.ayanamsa : null;
    var normDD   = dd;

    if (zodiac === 'sidereal') {
      var offset = (ayanamsa != null) ? ayanamsa : SIDEREAL_OFFSET;
      normDD = modulo(dd - offset, 360);
    }

    var idx   = Math.floor(modulo(normDD, 360) / 30);
    var found = SIGNS_DATA[idx] || SIGNS_DATA[0];

    return {
      key:         found.key,
      zodiacStart: signZodiacStart(found, zodiac, ayanamsa),
      zodiacEnd:   signZodiacEnd(found, zodiac, ayanamsa),
      _raw:        found
    };
  }

  // ============================================================
  // 5. ChartPosition
  // ============================================================

  function ChartPosition(horizonDegrees, eclipticDegrees) {
    horizonDegrees  = parseFloat(modulo(horizonDegrees,  360).toFixed(4));
    eclipticDegrees = parseFloat(modulo(eclipticDegrees, 360).toFixed(4));
    var hDMS = decimalDegreesToDMS(horizonDegrees);
    var eDMS = decimalDegreesToDMS(eclipticDegrees);
    this.Horizon = {
      DecimalDegrees:        horizonDegrees,
      ArcDegrees:            hDMS,
      ArcDegreesFormatted:   dmsString(hDMS),
      ArcDegreesFormatted30: dmsString(decimalDegreesToDMS(modulo(horizonDegrees, 30)))
    };
    this.Ecliptic = {
      DecimalDegrees:        eclipticDegrees,
      ArcDegrees:            eDMS,
      ArcDegreesFormatted:   dmsString(eDMS),
      ArcDegreesFormatted30: dmsString(decimalDegreesToDMS(modulo(eclipticDegrees, 30)))
    };
  }

  // ============================================================
  // 6. House
  // ============================================================

  var HOUSE_KEYS = [
    'house1','house2','house3','house4','house5','house6',
    'house7','house8','house9','house10','house11','house12'
  ];

  function zodiacPositionToHorizon(ascendantZodiacDegrees, zodiacDegrees) {
    return parseFloat(modulo(ascendantZodiacDegrees - zodiacDegrees, 360));
  }

  function House(opts) {
    opts = opts || {};
    var asc      = (opts.ascendantDegrees != null) ? opts.ascendantDegrees : 0;
    var eclStart = parseFloat(modulo(opts.eclipticDegreesStart || 0, 360).toFixed(4));
    var eclEnd   = parseFloat(modulo(opts.eclipticDegreesEnd   || 0, 360).toFixed(4));
    var id       = opts.id     || 1;
    var zodiac   = opts.zodiac || 'tropical';
    var ayanamsa = (opts.ayanamsa != null) ? opts.ayanamsa : null;

    this.id    = id;
    this.label = HOUSE_KEYS[id - 1] || ('house' + id);
    this.Sign  = getZodiacSign({ decimalDegrees: eclStart, zodiac: zodiac, ayanamsa: ayanamsa });
    this.ChartPosition = {
      StartPosition: new ChartPosition(zodiacPositionToHorizon(asc, eclStart), eclStart),
      EndPosition:   new ChartPosition(zodiacPositionToHorizon(asc, eclEnd),   eclEnd)
    };
  }

  // ============================================================
  // 7. 宮位輔助
  // ============================================================

  function constructHouses(cuspsArray, ascendantDegrees, zodiac, ayanamsa) {
    zodiac   = zodiac   || 'tropical';
    ayanamsa = (ayanamsa != null) ? ayanamsa : null;
    return cuspsArray.map(function(cuspDegree, index) {
      return new House({
        ascendantDegrees:     ascendantDegrees,
        eclipticDegreesStart: parseFloat(cuspDegree),
        eclipticDegreesEnd:   parseFloat(cuspsArray[modulo(index + 1, cuspsArray.length)]),
        id:                   index + 1,
        zodiac:               zodiac,
        ayanamsa:             ayanamsa
      });
    });
  }

  function getHouseFromDD(houses, decimalDegrees) {
    decimalDegrees = modulo(decimalDegrees, 360);
    return houses.find(function(house) {
      return isDegreeWithinCircleArc(
        house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees,
        house.ChartPosition.EndPosition.Ecliptic.DecimalDegrees,
        decimalDegrees
      );
    });
  }

  // ============================================================
  // 8. 宮制核心
  // ============================================================

  function shouldMod180(prevCusp, currentCusp) {
    if (currentCusp < prevCusp) {
      if (Math.abs(currentCusp - prevCusp) >= 180) return false;
      return true;
    }
    if (prevCusp < currentCusp) {
      if (currentCusp - prevCusp < 180) return false;
      return true;
    }
    return false;
  }

  function buildQuadrantCusps(asc, mc, c2r, c3r, c11r, c12r) {
    var c1  = asc;
    var c2  = modulo(c2r,  360);
    var c3  = modulo(c3r,  360);
    var c4  = modulo(mc + 180, 360);
    var c10 = mc;
    var c11 = c11r;
    var c12 = c12r;
    var c5  = modulo(c11 + 180, 360);
    var c6  = modulo(c12 + 180, 360);
    var c7  = modulo(asc + 180, 360);
    var c8  = modulo(c2  + 180, 360);
    var c9  = modulo(c3  + 180, 360);

    return [
      c1,
      shouldMod180(c1,  c2)  ? modulo(c2  + 180, 360) : c2,
      shouldMod180(c1,  c3)  ? modulo(c3  + 180, 360) : c3,
      c4,
      shouldMod180(c4,  c5)  ? modulo(c5  + 180, 360) : c5,
      shouldMod180(c4,  c6)  ? modulo(c6  + 180, 360) : c6,
      c7,
      shouldMod180(c7,  c8)  ? modulo(c8  + 180, 360) : c8,
      shouldMod180(c7,  c9)  ? modulo(c9  + 180, 360) : c9,
      c10,
      shouldMod180(c10, c11) ? modulo(c11 + 180, 360) : c11,
      shouldMod180(c10, c12) ? modulo(c12 + 180, 360) : c12
    ].map(function(v) { return parseFloat(parseFloat(v).toFixed(4)); });
  }

  // ── Placidus ─────────────────────────────────────────────────

  function calculatePlacidianHouseCusps(opts) {
    opts = opts || {};
    var ramc = opts.rightAscensionMC  || 0;
    var mc   = opts.midheaven         || 0;
    var asc  = opts.ascendant         || 0;
    var lat  = opts.latitude          || 0;
    var obl  = opts.obliquityEcliptic != null ? opts.obliquityEcliptic : 23.4367;

    function cuspInterval(h) {
      switch (h) {
        case 2:  return ramc + 120;
        case 3:  return ramc + 150;
        case 11: return ramc + 30;
        case 12: return ramc + 60;
      }
    }

    function semiArcRatio(h) {
      switch (h) {
        case 2:  return 2 / 3;
        case 3:  return 1 / 3;
        case 11: return 1 / 3;
        case 12: return 2 / 3;
      }
    }

    function calculatedCusp(h) {
      var interval = cuspInterval(h);
      var saRatio  = semiArcRatio(h);

      var cuspValue     = Math.asin(sinFromDegrees(obl) * sinFromDegrees(interval));
      var prevCuspValue = 0;

      var MAX = 1000;
      for (var i = 0; i < MAX; i++) {
        var m = Math.atan(saRatio * (tanFromDegrees(lat) / cosFromDegrees(interval)));
        var r = Math.atan(
          (tanFromDegrees(interval) * Math.cos(m)) /
          Math.cos(m + degreesToRadians(obl))
        );
        prevCuspValue = cuspValue;
        cuspValue     = r;
        if (Math.abs(cuspValue - prevCuspValue) <= 0.0001) break;
      }

      return radiansToDegrees(cuspValue) + 180;
    }

    return buildQuadrantCusps(
      asc, mc,
      calculatedCusp(2), calculatedCusp(3),
      calculatedCusp(11), calculatedCusp(12)
    );
  }

  // ── Koch ─────────────────────────────────────────────────────

  function calculateKochHouseCusps(opts) {
    opts = opts || {};
    var ramc = opts.rightAscensionMC  || 0;
    var mc   = opts.midheaven         || 0;
    var asc  = opts.ascendant         || 0;
    var lat  = opts.latitude          || 0;
    var obl  = opts.obliquityEcliptic != null ? opts.obliquityEcliptic : 23.4367;

    var decMC = Math.asin(sinFromDegrees(mc) * sinFromDegrees(obl));
    var adMC  = Math.asin(Math.tan(decMC) * tanFromDegrees(lat));
    var oaMC  = degreesToRadians(ramc) - adMC;
    var disp  = modulo(((ramc + 90) - radiansToDegrees(oaMC)) / 3, 360);

    function pos(h) {
      if (h===11) return radiansToDegrees(oaMC) + disp - 90;
      if (h===12) return pos(11) + disp;
      if (h===1)  return pos(12) + disp;
      if (h===2)  return pos(1)  + disp;
      if (h===3)  return pos(2)  + disp;
      throw new Error('calculateKochHouseCusps: unexpected h=' + h);
    }

    function cusp(h) {
      var p     = pos(h);
      var numer = -((tanFromDegrees(lat) * sinFromDegrees(obl)) +
                    (sinFromDegrees(p)   * cosFromDegrees(obl)));
      var denom = cosFromDegrees(p);
      var raw   = radiansToDegrees(arccot(numer / denom));
      return cosFromDegrees(p) < 0 ? modulo(raw + 180, 360) : raw;
    }

    return buildQuadrantCusps(
      modulo(cusp(1), 360), mc,
      modulo(cusp(2), 360), modulo(cusp(3), 360),
      cusp(11), cusp(12)
    );
  }

  // ── Regiomontanus ────────────────────────────────────────────

  function calculateRegiomontanusHouseCusps(opts) {
    opts = opts || {};
    var ramc = opts.rightAscensionMC  || 0;
    var mc   = opts.midheaven         || 0;
    var asc  = opts.ascendant         || 0;
    var lat  = opts.latitude          || 0;
    var obl  = opts.obliquityEcliptic != null ? opts.obliquityEcliptic : 23.4367;

    function ci(h) { return h===2 ? 120 : h===3 ? 150 : h===11 ? 30 : 60; }

    function pole(h) {
      return Math.atan(tanFromDegrees(lat) * sinFromDegrees(ci(h)));
    }

    function cusp(h) {
      var eq = ramc + ci(h);
      var m  = Math.atan(Math.tan(pole(h)) / cosFromDegrees(eq));
      var r  = Math.atan(
        (tanFromDegrees(eq) * Math.cos(m)) /
        Math.cos(m + degreesToRadians(obl))
      );
      return radiansToDegrees(r);
    }

    return buildQuadrantCusps(asc, mc, cusp(2), cusp(3), cusp(11), cusp(12));
  }

  // ── Topocentric ──────────────────────────────────────────────

  function calculateTopocentricHouseCusps(opts) {
    opts = opts || {};
    var ramc = opts.rightAscensionMC  || 0;
    var mc   = opts.midheaven         || 0;
    var asc  = opts.ascendant         || 0;
    var lat  = opts.latitude          || 0;
    var obl  = opts.obliquityEcliptic != null ? opts.obliquityEcliptic : 23.4367;

    function iv(h) {
      return h===2 ? ramc+120 : h===3 ? ramc+150 : h===11 ? ramc+30 : ramc+60;
    }

    function sa(h) {
      return (h===2 || h===12)
        ? Math.atan(2 * (tanFromDegrees(lat) / 3))
        : Math.atan(tanFromDegrees(lat) / 3);
    }

    function cusp(h) {
      var m = Math.atan(Math.tan(sa(h)) / cosFromDegrees(iv(h)));
      var r = Math.atan(
        (tanFromDegrees(iv(h)) * Math.cos(m)) /
        Math.cos(m + degreesToRadians(obl))
      );
      return radiansToDegrees(r);
    }

    return buildQuadrantCusps(asc, mc, cusp(2), cusp(3), cusp(11), cusp(12));
  }

  // ── Equal House ──────────────────────────────────────────────

  function calculateEqualHouseCusps(opts) {
    opts = opts || {};
    var asc = opts.ascendant || 0;
    return new Array(12).fill(0).map(function(_, i) {
      return parseFloat(modulo(i * 30 + asc, 360).toFixed(4));
    });
  }

  // ── Whole Sign ───────────────────────────────────────────────

  function calculateWholeSignHouseCusps(opts) {
    opts = opts || {};
    var asc      = opts.ascendant || 0;
    var zodiac   = opts.zodiac    || 'tropical';
    var ayanamsa = (opts.ayanamsa != null) ? opts.ayanamsa : null;
    var ascSign  = getZodiacSign({ decimalDegrees: asc, zodiac: zodiac, ayanamsa: ayanamsa });
    var startIdx = SIGNS_DATA.findIndex(function(s) { return s.key === ascSign._raw.key; });
    if (startIdx < 0) startIdx = 0;
    return new Array(12).fill(0).map(function(_, i) {
      return parseFloat(modulo(SIGNS_DATA[modulo(startIdx + i, 12)].zodiacStart, 360).toFixed(4));
    });
  }

  // ── Campanus ─────────────────────────────────────────────────

  function calculateCampanusHouseCusps(opts) {
    opts = opts || {};
    var ramc = opts.rightAscensionMC  || 0;
    var mc   = opts.midheaven         || 0;
    var asc  = opts.ascendant         || 0;
    var lat  = opts.latitude          || 0;
    var obl  = opts.obliquityEcliptic != null ? opts.obliquityEcliptic : 23.4367;

    var f    = degreesToRadians(lat);
    var e    = degreesToRadians(obl);
    var raic = modulo(ramc + 180, 360);

    var a30  = degreesToRadians(30);
    var a60  = degreesToRadians(60);
    var a90  = degreesToRadians(90);
    var a180 = degreesToRadians(180);
    var a270 = degreesToRadians(270);
    var a360 = degreesToRadians(360);

    var isNorthernCircumpolar = lat >  (90 - obl);
    var isNorthernHemisphere  = lat >= 0 && !isNorthernCircumpolar;
    var isSouthernCircumpolar = lat < -(90 - obl);
    var isSouthernHemisphere  = lat <  0 && !isSouthernCircumpolar;
    var useNorthernHemisphere = false;
    var useSouthernHemisphere = false;

    if (isNorthernCircumpolar) {
      var pced1 = a180 + Math.asin(Math.tan(a90 - f) / Math.tan(e));
      var pced2 = a360 - Math.asin(Math.tan(a90 - f) / Math.tan(e));
      if (degreesToRadians(ramc) < pced1 && degreesToRadians(ramc) > pced2) {
        useNorthernHemisphere = true;
      }
    } else if (isSouthernCircumpolar) {
      var pced1s = Math.asin(Math.tan(a90 - f) / Math.tan(e));
      var pced2s = a180 - Math.asin(Math.tan(a90 - f) / Math.tan(e));
      if (degreesToRadians(ramc) < pced1s && degreesToRadians(ramc) > pced2s) {
        useSouthernHemisphere = true;
      }
    }

    function nE(o, q) {
      var dg = radiansToDegrees(o);
      var f1 = Math.cos(e)*Math.sin(q);
      var f2 = Math.sin(e)*Math.cos(q)*Math.cos(o);
      var f3 = -Math.cos(e)*Math.sin(q);
      var a, c, co, g;
      if (dg === 360 || dg < 90) {
        a  = Math.acos(f1 + f2);
        co = Math.acos(Math.tan(e) * Math.tan(q));
        g  = Math.asin((Math.cos(q) * Math.sin(o)) / Math.sin(a));
        c  = o < co ? g : (o === co ? a90 : a180 - g);
      } else if (dg < 180) {
        a = Math.acos(f3 - f2);
        c = a90 + Math.acos((Math.cos(q) * Math.cos(o - a90)) / Math.sin(a));
      } else if (dg < 270) {
        a = Math.acos(f3 - f2);
        c = a180 + Math.asin((Math.cos(q) * Math.sin(o - a180)) / Math.sin(a));
      } else {
        a  = Math.acos(f1 + f2);
        co = a360 - Math.acos(Math.tan(e) * Math.tan(q));
        g  = Math.acos((Math.cos(q) * Math.cos(o - a270)) / Math.sin(a));
        c  = o < co ? a270 - g : (o === co ? a270 : a270 + g);
      }
      return c;
    }

    function sE(o, q) {
      var dg = radiansToDegrees(o);
      var f1 = Math.cos(e)*Math.sin(q);
      var f2 = Math.sin(e)*Math.cos(q)*Math.cos(o);
      var f3 = -Math.cos(e)*Math.sin(q);
      var a, c, co, g;
      if (dg === 360 || dg < 90) {
        a = Math.acos(f3 + f2);
        c = Math.asin((Math.cos(q) * Math.sin(o)) / Math.sin(a));
      } else if (dg < 180) {
        a  = Math.acos(f1 - f2);
        co = Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.acos((Math.cos(q) * Math.cos(o - a90)) / Math.sin(a));
        c  = o < co ? a90 - g : (o === co ? a90 : a90 + g);
      } else if (dg < 270) {
        a  = Math.acos(f1 - f2);
        co = a360 - Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.asin((Math.cos(q) * Math.sin(o - a180)) / Math.sin(a));
        c  = o < co ? a180 + g : (o === co ? a270 : a360 - g);
      } else {
        a = Math.acos(f3 + f2);
        c = a270 + Math.acos((Math.cos(q) * Math.cos(o - a270)) / Math.sin(a));
      }
      return c;
    }

    function nCE(o, q) {
      var dg = radiansToDegrees(o);
      var f1 = Math.cos(e)*Math.sin(q);
      var f2 = Math.sin(e)*Math.cos(q)*Math.cos(o);
      var f3 = -Math.cos(e)*Math.sin(q);
      var a, c, co, g;
      if (dg === 360 || dg < 90) {
        a = Math.acos(f3 + f2);
        g = Math.asin((Math.cos(q) * Math.sin(o)) / Math.sin(a));
        c = g;
      } else if (dg < 180) {
        a  = Math.acos(f1 - f2);
        co = Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.acos((Math.cos(q) * Math.cos(o - a90)) / Math.sin(a));
        c  = o < co ? a90 - g : (o === co ? a90 : a90 + g);
      } else if (dg < 270) {
        a  = Math.acos(f1 - f2);
        co = a360 - Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.asin((Math.cos(q) * Math.sin(o - a180)) / Math.sin(a));
        c  = o < co ? a180 + g : (o === co ? a270 : a360 - g);
      } else {
        a = Math.acos(f3 + f2);
        c = a270 + Math.acos((Math.cos(q) * Math.cos(o - a270)) / Math.sin(a));
      }
      return c;
    }

    function sCE(o, q) {
      var dg = radiansToDegrees(o);
      var f1 = Math.cos(e)*Math.sin(q);
      var f2 = Math.sin(e)*Math.cos(q)*Math.cos(o);
      var f3 = -Math.cos(e)*Math.sin(q);
      var a, c, co, g;
      if (dg === 360 || dg < 90) {
        a = Math.acos(f3 + f2);
        g = Math.asin((Math.cos(q) * Math.sin(o)) / Math.sin(a));
        c = g;
      } else if (dg < 180) {
        a  = Math.acos(f1 - f2);
        co = Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.acos((Math.cos(q) * Math.cos(o - a90)) / Math.sin(a));
        c  = o < co ? a90 - g : (o === co ? a90 : a90 + g);
      } else if (dg < 270) {
        a  = Math.acos(f1 - f2);
        co = a360 - Math.acos(-Math.tan(e) * Math.tan(q));
        g  = Math.asin((Math.cos(q) * Math.sin(o - a180)) / Math.sin(a));
        c  = o < co ? a180 + g : (o === co ? a270 : a360 - g);
      } else {
        a = Math.acos(f3 + f2);
        c = a270 + Math.acos((Math.cos(q) * Math.cos(o - a270)) / Math.sin(a));
      }
      return c;
    }

    var oa2, oa3, oa11, oa12;

    if (isNorthernHemisphere || useNorthernHemisphere || isSouthernHemisphere || useSouthernHemisphere) {
      oa2  = Math.abs(degreesToRadians(raic) - Math.atan(Math.cos(f) * Math.tan(a60)));
      oa3  = Math.abs(degreesToRadians(raic) - Math.atan(Math.cos(f) * Math.tan(a30)));
      oa11 = Math.abs(degreesToRadians(ramc) + Math.atan(Math.cos(f) * Math.tan(a30)));
      oa12 = Math.abs(degreesToRadians(ramc) + Math.atan(Math.cos(f) * Math.tan(a60)));
    } else {
      oa2  = Math.abs(degreesToRadians(raic) + Math.atan(Math.cos(f) * Math.tan(a60)));
      oa3  = Math.abs(degreesToRadians(raic) + Math.atan(Math.cos(f) * Math.tan(a30)));
      oa11 = Math.abs(degreesToRadians(ramc) - Math.atan(Math.cos(f) * Math.tan(a30)));
      oa12 = Math.abs(degreesToRadians(ramc) - Math.atan(Math.cos(f) * Math.tan(a60)));
    }

    var q2  = Math.abs(Math.asin(Math.sin(f) * Math.sin(a60)));
    var q3  = Math.abs(Math.asin(Math.sin(f) * Math.sin(a30)));
    var q11 = q3;
    var q12 = q2;

    var c2, c3, c11, c12;

    if (isNorthernCircumpolar && !useNorthernHemisphere) {
      c2  = radiansToDegrees(nCE(oa2,  q2));
      c3  = radiansToDegrees(nCE(oa3,  q3));
      c11 = radiansToDegrees(nCE(oa11, q11));
      c12 = radiansToDegrees(nCE(oa12, q12));
    } else if (isNorthernHemisphere || useNorthernHemisphere) {
      c2  = radiansToDegrees(nE(oa2,  q2));
      c3  = radiansToDegrees(nE(oa3,  q3));
      c11 = radiansToDegrees(nE(oa11, q11));
      c12 = radiansToDegrees(nE(oa12, q12));
    } else if (isSouthernHemisphere || useSouthernHemisphere) {
      c2  = radiansToDegrees(sE(oa2,  q2));
      c3  = radiansToDegrees(sE(oa3,  q3));
      c11 = radiansToDegrees(sE(oa11, q11));
      c12 = radiansToDegrees(sE(oa12, q12));
    } else if (isSouthernCircumpolar && !useSouthernHemisphere) {
      c2  = radiansToDegrees(sCE(oa2,  q2));
      c3  = radiansToDegrees(sCE(oa3,  q3));
      c11 = radiansToDegrees(sCE(oa11, q11));
      c12 = radiansToDegrees(sCE(oa12, q12));
    }

    return [
      modulo(asc, 360), modulo(c2, 360), modulo(c3, 360),
      modulo(mc + 180, 360),
      modulo(c11 + 180, 360),
      modulo(c12 + 180, 360),
      modulo(asc + 180, 360),
      modulo(c2  + 180, 360),
      modulo(c3  + 180, 360),
      modulo(mc, 360), modulo(c11, 360), modulo(c12, 360)
    ].map(function(v) { return parseFloat(parseFloat(v).toFixed(4)); });
  }

  // ============================================================
  // 9. 統一入口
  // ============================================================

  function calculateHouseCusps(houseSystem, opts) {
    switch ((houseSystem || '').toLowerCase()) {
      case 'placidus':      return calculatePlacidianHouseCusps(opts);
      case 'koch':          return calculateKochHouseCusps(opts);
      case 'regiomontanus': return calculateRegiomontanusHouseCusps(opts);
      case 'topocentric':   return calculateTopocentricHouseCusps(opts);
      case 'campanus':      return calculateCampanusHouseCusps(opts);
      case 'equal-house':   return calculateEqualHouseCusps(opts);
      case 'whole-sign':    return calculateWholeSignHouseCusps(opts);
      default:
        console.warn('AstroHouses: 未知宮制 "' + houseSystem + '"，fallback to placidus');
        return calculatePlacidianHouseCusps(opts);
    }
  }

  // ============================================================
  // 10. 黃道分宮點
  // ============================================================

  function calcZodiacCusps(ascendantDegrees, zodiac, ayanamsa) {
    zodiac   = zodiac   || 'tropical';
    ayanamsa = (ayanamsa != null) ? ayanamsa : null;

    var offset = 0;
    if (zodiac === 'sidereal') {
      if (ayanamsa == null) {
        console.warn('AstroHouses.calcZodiacCusps: sidereal 未傳 ayanamsa，使用後備值 ' + SIDEREAL_OFFSET + '°');
        offset = SIDEREAL_OFFSET;
      } else {
        offset = ayanamsa;
      }
    }

    return SIGNS_DATA.map(function(sign) {
      var ecliptic = parseFloat(modulo(sign.zodiacStart + offset, 360).toFixed(4));
      var horizon  = parseFloat(zodiacPositionToHorizon(ascendantDegrees, ecliptic).toFixed(4));
      return { key: sign.key, ecliptic: ecliptic, horizon: horizon, zodiac: zodiac, ayanamsa: offset };
    });
  }

  // ============================================================
  // 11. 守護星資料與宮主星查詢  ← v2.1.0 新增
  // ============================================================

  /**
   * 星座守護星對應表
   *
   * modern  : 現代守護星（含天王星/海王星/冥王星）
   * traditional : 傳統守護星（七星制，無外行星）
   *
   * 行星 key 與 HTML 層 ASTROCHART_PLANET_MAP / language.js 一致：
   *   sun, moon, mercury, venus, mars, jupiter, saturn,
   *   uranus, neptune, pluto
   */
  var SIGN_RULERS = {
    aries:       { modern: 'mars',    traditional: 'mars'    },
    taurus:      { modern: 'venus',   traditional: 'venus'   },
    gemini:      { modern: 'mercury', traditional: 'mercury' },
    cancer:      { modern: 'moon',    traditional: 'moon'    },
    leo:         { modern: 'sun',     traditional: 'sun'     },
    virgo:       { modern: 'mercury', traditional: 'mercury' },
    libra:       { modern: 'venus',   traditional: 'venus'   },
    scorpio:     { modern: 'pluto',   traditional: 'mars'    },
    sagittarius: { modern: 'jupiter', traditional: 'jupiter' },
    capricorn:   { modern: 'saturn',  traditional: 'saturn'  },
    aquarius:    { modern: 'uranus',  traditional: 'saturn'  },
    pisces:      { modern: 'neptune', traditional: 'jupiter' }
  };

  /**
   * 取得單一宮位的宮主星
   *
   * @param {number} houseIndex  宮位編號，1–12
   * @param {number[]} cusps     12 宮起始黃道度數陣列（由 calculateHouseCusps 回傳）
   * @param {object} [opts]
   *   @param {string} [opts.rulerMode='modern']  'modern' | 'traditional'
   *   @param {string} [opts.zodiac='tropical']   'tropical' | 'sidereal'
   *   @param {number} [opts.ayanamsa]             恆星黃道偏移量
   * @returns {object}
   *   {
   *     house      : number,   // 宮位編號
   *     cuspDegree : number,   // 宮頭黃道度數
   *     signKey    : string,   // 星座 key（英文小寫）
   *     rulerKey   : string,   // 守護星 key（英文小寫）
   *     rulerMode  : string    // 使用的守護星模式
   *   }
   */
  function getHouseRuler(houseIndex, cusps, opts) {
    opts = opts || {};
    var mode     = (opts.rulerMode === 'traditional') ? 'traditional' : 'modern';
    var zodiac   = opts.zodiac   || 'tropical';
    var ayanamsa = (opts.ayanamsa != null) ? opts.ayanamsa : null;

    if (!cusps || cusps.length < 12) {
      throw new Error('getHouseRuler: cusps 陣列需包含 12 個元素');
    }
    if (houseIndex < 1 || houseIndex > 12) {
      throw new Error('getHouseRuler: houseIndex 需介於 1–12，收到 ' + houseIndex);
    }

    var cuspDegree = parseFloat(cusps[houseIndex - 1]);
    var sign       = getZodiacSign({ decimalDegrees: cuspDegree, zodiac: zodiac, ayanamsa: ayanamsa });
    var signKey    = sign.key;
    var rulerData  = SIGN_RULERS[signKey];

    if (!rulerData) {
      throw new Error('getHouseRuler: 找不到星座 "' + signKey + '" 的守護星資料');
    }

    return {
      house:      houseIndex,
      cuspDegree: cuspDegree,
      signKey:    signKey,
      rulerKey:   rulerData[mode],
      rulerMode:  mode
    };
  }

  /**
   * 取得全部 12 宮的宮主星陣列
   *
   * @param {number[]} cusps   12 宮起始黃道度數陣列
   * @param {object} [opts]    同 getHouseRuler 的 opts
   * @returns {object[]}       長度 12 的陣列，每元素同 getHouseRuler 回傳格式
   */
  function getAllHouseRulers(cusps, opts) {
    var result = [];
    for (var i = 1; i <= 12; i++) {
      result.push(getHouseRuler(i, cusps, opts));
    }
    return result;
  }

  // ============================================================
  // 廟旺陷弱（Dignities）
  // ============================================================

  var DIGNITY_LABELS = {
    en: {
      domicile:   'Domicile',
      exaltation: 'Exaltation',
      detriment:  'Detriment',
      fall:       'Fall',
      peregrine:  'Peregrine'
    },
    zh: {
      domicile:   '入廟',
      exaltation: '旺（曜升）',
      detriment:  '陷（失勢）',
      fall:       '弱（落弱）',
      peregrine:  '無特殊尊貴'
    }
  };

  var PLANET_LABELS_DIGNITY = {
    en: { sun:'Sun', moon:'Moon', mercury:'Mercury', venus:'Venus', mars:'Mars', jupiter:'Jupiter', saturn:'Saturn', uranus:'Uranus', neptune:'Neptune', pluto:'Pluto' },
    zh: { sun:'太陽', moon:'月亮', mercury:'水星', venus:'金星', mars:'火星', jupiter:'木星', saturn:'土星', uranus:'天王星', neptune:'海王星', pluto:'冥王星' }
  };

  var SIGN_LABELS_DIGNITY = {
    en: { aries:'Aries', taurus:'Taurus', gemini:'Gemini', cancer:'Cancer', leo:'Leo', virgo:'Virgo', libra:'Libra', scorpio:'Scorpio', sagittarius:'Sagittarius', capricorn:'Capricorn', aquarius:'Aquarius', pisces:'Pisces' },
    zh: { aries:'白羊座', taurus:'金牛座', gemini:'雙子座', cancer:'巨蟹座', leo:'獅子座', virgo:'處女座', libra:'天秤座', scorpio:'天蠍座', sagittarius:'射手座', capricorn:'摩羯座', aquarius:'水瓶座', pisces:'雙魚座' }
  };

  var DIGNITIES = {
    sun:     { domicile:['leo'],                   exaltation:['aries'],       detriment:['aquarius'],             fall:['libra'] },
    moon:    { domicile:['cancer'],                exaltation:['taurus'],      detriment:['capricorn'],            fall:['scorpio'] },
    mercury: { domicile:['gemini','virgo'],         exaltation:['virgo'],       detriment:['sagittarius','pisces'], fall:['pisces'] },
    venus:   { domicile:['taurus','libra'],         exaltation:['pisces'],      detriment:['aries','scorpio'],      fall:['virgo'] },
    mars:    { domicile:['aries','scorpio'],        exaltation:['capricorn'],   detriment:['taurus','libra'],       fall:['cancer'] },
    jupiter: { domicile:['sagittarius','pisces'],   exaltation:['cancer'],      detriment:['gemini','virgo'],       fall:['capricorn'] },
    saturn:  { domicile:['capricorn','aquarius'],   exaltation:['libra'],       detriment:['cancer','leo'],         fall:['aries'] },
    uranus:  { domicile:['aquarius'],               exaltation:[],              detriment:['leo'],                  fall:[] },
    neptune: { domicile:['pisces'],                 exaltation:[],              detriment:['virgo'],                fall:[] },
    pluto:   { domicile:['scorpio'],                exaltation:[],              detriment:['taurus'],               fall:[] }
  };

  function getPlanetDignity(planet, signKey, lang) {
    lang = (lang === 'en') ? 'en' : 'zh';
    var d = DIGNITIES[planet];
    if (!d) { return { planet: planet, sign: signKey, dignityKey: null, dignityLabel: '未知行星' }; }
    var dignityKey = 'peregrine';
    if (d.domicile.indexOf(signKey) !== -1)         { dignityKey = 'domicile'; }
    else if (d.exaltation.indexOf(signKey) !== -1)  { dignityKey = 'exaltation'; }
    else if (d.detriment.indexOf(signKey) !== -1)   { dignityKey = 'detriment'; }
    else if (d.fall.indexOf(signKey) !== -1)        { dignityKey = 'fall'; }
    return {
      planet:       (PLANET_LABELS_DIGNITY[lang][planet] || planet),
      sign:         (SIGN_LABELS_DIGNITY[lang][signKey]  || signKey),
      dignityKey:   dignityKey,
      dignityLabel: DIGNITY_LABELS[lang][dignityKey]
    };
  }

  // ============================================================
  // 對外 API
  // ============================================================

  var SIGN_KEYS = SIGNS_DATA.map(function(s) { return s.key; });

  return {
    calculatePlacidianHouseCusps:     calculatePlacidianHouseCusps,
    calculateKochHouseCusps:          calculateKochHouseCusps,
    calculateRegiomontanusHouseCusps: calculateRegiomontanusHouseCusps,
    calculateTopocentricHouseCusps:   calculateTopocentricHouseCusps,
    calculateCampanusHouseCusps:      calculateCampanusHouseCusps,
    calculateEqualHouseCusps:         calculateEqualHouseCusps,
    calculateWholeSignHouseCusps:     calculateWholeSignHouseCusps,
    calculateHouseCusps:              calculateHouseCusps,
    constructHouses:                  constructHouses,
    getHouseFromDD:                   getHouseFromDD,
    getZodiacSign:                    getZodiacSign,
    calcZodiacCusps:                  calcZodiacCusps,
    applyZodiacOffsetCounter:         applyZodiacOffsetCounter,
    applyZodiacOffsetClockwise:       applyZodiacOffsetClockwise,
    dateToJDE:                        dateToJDE,
    calcAyanamsa:                     calcAyanamsa,
    getSiderealOffset:                getSiderealOffset,
    decimalDegreesToDMS:              decimalDegreesToDMS,
    zodiacPositionToHorizon:          zodiacPositionToHorizon,
    modulo:                           modulo,
    SIGNS_DATA:                       SIGNS_DATA,
    SIGN_KEYS:                        SIGN_KEYS,
    SIGN_RULERS:                      SIGN_RULERS,
    SIDEREAL_OFFSET:                  SIDEREAL_OFFSET,
    HOUSE_SYSTEMS:    ['placidus','koch','regiomontanus','topocentric','campanus','equal-house','whole-sign'],
    AYANAMSA_SYSTEMS: ['lahiri','fagan-bradley','raman','krishnamurti'],
    // v2.1.0 新增
    getHouseRuler:                    getHouseRuler,
    getAllHouseRulers:                 getAllHouseRulers,
    // 廟旺陷弱
    DIGNITIES:                        DIGNITIES,
    getPlanetDignity:                 getPlanetDignity
  };

}));