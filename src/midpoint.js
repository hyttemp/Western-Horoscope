/**
 * ============================================================
 *  midpoint.js  —  占星中點計算函式庫
 *  漢堡學派（Hamburg School / Uranian Astrology）
 *
 *  中點公式：軸1 = (A + B) / 2 mod 360
 *  只檢查行星是否會合軸1，不檢查對衝軸（軸1+180°）
 *
 *  傳統瀏覽器格式（ES5 相容，無需 import/export）
 *  所有函式掛載於全域物件 Midpoint
 * ============================================================
 */

(function (global) {
  "use strict";

  // ─────────────────────────────────────────────
  //  常數定義
  // ─────────────────────────────────────────────

  var SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];

  var ASPECTS = [
    { name: "Conjunction",    degree: 0   },
    { name: "Semi-Sextile",   degree: 30  },
    { name: "Semi-Square",    degree: 45  },
    { name: "Sextile",        degree: 60  },
    { name: "Quintile",       degree: 72  },
    { name: "Square",         degree: 90  },
    { name: "Trine",          degree: 120 },
    { name: "Sesquiquadrate", degree: 135 },
    { name: "BiQuintile",     degree: 144 },
    { name: "Quincunx",       degree: 150 },
    { name: "Opposite",       degree: 180 }
  ];

  // ─────────────────────────────────────────────
  //  工具函式
  // ─────────────────────────────────────────────

  function convertDegree(degree) {
    degree = ((degree % 360) + 360) % 360;
    for (var i = 0; i < 12; i++) {
      if (degree >= i * 30 && degree < (i + 1) * 30) {
        return { deg: degree - i * 30, sign: SIGNS[i] };
      }
    }
    return { deg: 0, sign: SIGNS[0] };
  }

  function reverseConvertDegree(degree, sign) {
    var idx = SIGNS.indexOf(sign);
    if (idx === -1) throw new Error("Unknown sign: " + sign);
    return degree + 30 * idx;
  }

  function ddToDms(dd) {
    dd = Math.abs(dd);
    var degree = Math.floor(dd);
    var minuteFloat = (dd - degree) * 60;
    var minute = Math.floor(minuteFloat);
    var second = Math.round((minuteFloat - minute) * 60);
    return degree + "\u00b0 " + minute + "' " + second + "\"";
  }

  function dmsToDd(dms) {
    var cleaned = dms
      .replace(/\u00b0/g, " ")
      .replace(/'/g, " ")
      .replace(/"/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var parts = cleaned.split(" ");
    var degree = parseFloat(parts[0]) || 0;
    var minute = parseFloat(parts[1]) / 60 || 0;
    var second = parseFloat(parts[2]) / 3600 || 0;
    return degree + minute + second;
  }

  function angularDistance(deg1, deg2) {
    var diff = Math.abs(deg1 - deg2) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  // ─────────────────────────────────────────────
  //  中點核心計算
  // ─────────────────────────────────────────────

  /**
   * 漢堡學派中點公式
   *   軸1 = (A + B) / 2  mod 360
   *
   * @param  {number} deg1  行星 A 黃道總度數（0~360）
   * @param  {number} deg2  行星 B 黃道總度數（0~360）
   * @returns {Object} { degree, sign, signDeg }
   */
  function calcMidpoint(deg1, deg2) {
    deg1 = ((deg1 % 360) + 360) % 360;
    deg2 = ((deg2 % 360) + 360) % 360;

    var midDeg = ((deg1 + deg2) / 2 + 360) % 360;

    var info = convertDegree(midDeg);
    return {
      degree:  midDeg,
      sign:    info.sign,
      signDeg: info.deg
    };
  }

  /**
   * 計算所有行星兩兩組合的中點
   * @param  {Object} planets  { "Sun": 10.5, "Moon": 45.0, ... }
   * @returns {Object} 鍵為 "A/B"，值為 calcMidpoint 回傳值
   */
  function calcAllMidpoints(planets) {
    var keys = Object.keys(planets);
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        var key = keys[i] + "/" + keys[j];
        result[key] = calcMidpoint(planets[keys[i]], planets[keys[j]]);
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────
  //  相位計算
  // ─────────────────────────────────────────────

  /**
   * 檢查中點（軸1）與行星是否形成相位
   *
   * ★ 只檢查軸1 = (A+B)/2
   *   不再檢查對衝軸（軸1+180°）
   *
   * @param  {number} midpointDeg  軸1 黃道總度數
   * @param  {number} planetDeg    行星黃道總度數
   * @param  {number} orb          容許度（度）
   * @returns {Array} [{ name, degree, orb }, ...]
   */
  function checkAspects(midpointDeg, planetDeg, orb) {
    orb = orb || 1.0;
    var found = [];

    var mp = ((midpointDeg % 360) + 360) % 360;  // ★ 只用軸1
    var pl = ((planetDeg   % 360) + 360) % 360;

    var dist = angularDistance(mp, pl);  // ★ 只算一次角距

    for (var i = 0; i < ASPECTS.length; i++) {
      var asp = ASPECTS[i];
      var diff = Math.abs(dist - asp.degree);

      if (diff <= orb) {
        found.push({
          name:   asp.name,
          degree: asp.degree,
          orb:    Math.round(diff * 10000) / 10000
        });
      }
    }
    return found;
  }

  /**
   * 計算所有中點與所有行星之間的相位
   * @param  {Object} midpoints  calcAllMidpoints() 的回傳值
   * @param  {Object} planets    行星位置物件
   * @param  {number} orb        容許度
   * @returns {Array}
   */
  function midpointAspects(midpoints, planets, orb) {
    orb = orb || 1.0;
    var results = [];
    var mpKeys = Object.keys(midpoints);
    var plKeys = Object.keys(planets);

    for (var i = 0; i < mpKeys.length; i++) {
      var mpKey = mpKeys[i];
      var mpDeg = midpoints[mpKey].degree;

      for (var j = 0; j < plKeys.length; j++) {
        var plKey = plKeys[j];
        var plDeg = planets[plKey];
        var found = checkAspects(mpDeg, plDeg, orb);

        if (found.length > 0) {
          results.push({
            midpoint:   mpKey,
            midDeg:     mpDeg,
            midSign:    midpoints[mpKey].sign,
            midSignDeg: midpoints[mpKey].signDeg,
            planet:     plKey,
            planetDeg:  plDeg,
            aspects:    found
          });
        }
      }
    }
    return results;
  }

  // ─────────────────────────────────────────────
  //  格式化輸出
  // ─────────────────────────────────────────────

  function formatMidpoint(midpointResult) {
    return ddToDms(midpointResult.signDeg) + " " + midpointResult.sign;
  }

  function formatAspects(aspectResults) {
    if (!aspectResults || aspectResults.length === 0) return "No aspects";
    return aspectResults.map(function (a) {
      return a.name + " (" + a.degree + "\u00b0), orb: " + ddToDms(a.orb);
    }).join("\n");
  }

  function printMidpoints(midpoints) {
    var keys = Object.keys(midpoints);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var m = midpoints[k];
      console.log(
        k + ": " + ddToDms(m.signDeg) + " " + m.sign +
        "  (total: " + m.degree.toFixed(4) + "\u00b0)"
      );
    }
  }

  // ─────────────────────────────────────────────
  //  公開 API
  // ─────────────────────────────────────────────

  global.Midpoint = {
    SIGNS:   SIGNS,
    ASPECTS: ASPECTS,

    convertDegree:        convertDegree,
    reverseConvertDegree: reverseConvertDegree,
    ddToDms:              ddToDms,
    dmsToDd:              dmsToDd,
    angularDistance:      angularDistance,

    calcMidpoint:         calcMidpoint,
    calcAllMidpoints:     calcAllMidpoints,

    checkAspects:         checkAspects,
    midpointAspects:      midpointAspects,

    formatMidpoint:       formatMidpoint,
    formatAspects:        formatAspects,
    printMidpoints:       printMidpoints
  };

}(typeof window !== "undefined" ? window : this));