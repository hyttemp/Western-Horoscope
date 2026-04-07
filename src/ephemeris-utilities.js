/**
 * ephemeris-utilities.js
 * 從 ephemeris-1.2.1.bundle.js 提取的工具函式（不含行星角度計算）
 * 傳統格式（ES5 / plain JS）
 */

var EphemerisUtils = (function () {

  // ─── 常數 ───────────────────────────────────────────────────────────────────
  var JULIAN_DATE_J2000      = 2451545;        // J2000.0 儒略日
  var JULIAN_DATE_B1950      = 2433282.423;    // B1950.0 儒略日
  var JULIAN_DATE_1900       = 2415020;        // 1900.0  儒略日
  var RAD_TO_HOUR            = 12 / Math.PI;   // 弧度 → 小時
  var DEG_TO_RAD             = 0.017453292519943295;
  var RAD_TO_DEG             = 57.29577951308232;
  var ARC_SECONDS_PER_RADIAN = 206264.80624709636;
  var TWO_PI                 = 2 * Math.PI;

  // ─── 時間工具 ────────────────────────────────────────────────────────────────

  /**
   * 將時:分轉換為十進位小時
   * @param {number} hour
   * @param {number} minute
   * @returns {number}
   */
  function hourTimeToDecimal(hour, minute) {
    hour   = hour   || 0;
    minute = minute || 0;
    return hour + minute / 60;
  }

  /**
   * 將儒略日轉換為儒略世紀（相對 J2000.0）
   * @param {number} julianDate
   * @returns {number}
   */
  function timeInJulianCenturies(julianDate) {
    return (julianDate - JULIAN_DATE_J2000) / 36525;
  }

  /**
   * 複製一個 UTC Date 物件
   * @param {Date} date
   * @returns {Date}
   */
  function cloneUTCDate(date) {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    ));
  }

  // ─── 角度取模工具 ─────────────────────────────────────────────────────────────

  /**
   * 通用取模（結果恆為正）
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function mod(a, b) {
    return (a % b + b) % b;
  }

  /**
   * 對 1296000（360° × 3600 弧秒）取模
   * @param {number} x
   * @returns {number}
   */
  function mods3600(x) {
    return x - 1296000 * Math.floor(x / 1296000);
  }

  /**
   * 對 2π 取模（弧度，結果 0 ~ 2π）
   * @param {number} x
   * @returns {number}
   */
  function modtp(x) {
    var result = x - Math.floor(x / TWO_PI) * TWO_PI;
    while (result < 0)       result += TWO_PI;
    while (result >= TWO_PI) result -= TWO_PI;
    return result;
  }

  /**
   * 對 360° 取模（結果 0 ~ 360）
   * @param {number} x
   * @returns {number}
   */
  function mod360(x) {
    var result = x - 360 * Math.floor(x / 360);
    while (result < 0)   result += 360;
    while (result > 360) result -= 360;
    return result;
  }

  /**
   * 對 30° 取模（星座內度數，結果 0 ~ 30）
   * @param {number} x
   * @returns {number}
   */
  function mod30(x) {
    var result = x - 30 * Math.floor(x / 30);
    while (result < 0)  result += 30;
    while (result > 30) result -= 30;
    return result;
  }

  // ─── 三角函式補充 ─────────────────────────────────────────────────────────────

  /**
   * 雙曲正弦
   * @param {number} x
   * @returns {number}
   */
  function sinh(x) {
    return (Math.exp(x) - Math.exp(-x)) / 2;
  }

  /**
   * 雙曲餘弦
   * @param {number} x
   * @returns {number}
   */
  function cosh(x) {
    return (Math.exp(x) + Math.exp(-x)) / 2;
  }

  /**
   * 雙曲正切
   * @param {number} x
   * @returns {number}
   */
  function tanh(x) {
    return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
  }

  /**
   * 四象限反正切（atan2 的替代實作）
   * @param {number} x
   * @param {number} y
   * @returns {number} 弧度
   */
  function zatan2(x, y) {
    var quadrant, result;
    quadrant = 0;
    if (x < 0) quadrant = 2;
    if (y < 0) quadrant |= 1;

    if (x === 0) {
      return (quadrant & 1) ? 1.5 * Math.PI : (y === 0 ? 0 : 0.5 * Math.PI);
    }
    if (y === 0) {
      return (quadrant & 2) ? Math.PI : 0;
    }

    switch (quadrant) {
      default:
      case 0: result = 0;            break;
      case 1: result = 2 * Math.PI;  break;
      case 2:
      case 3: result = Math.PI;      break;
    }
    return result + Math.atan(y / x);
  }

  // ─── 格式化工具 ───────────────────────────────────────────────────────────────

  /**
   * 弧度 → 時分秒物件
   * @param {number} radians
   * @returns {{ hours, minutes, seconds, milliseconds }}
   */
  function hms(radians) {
    var total, hours, minutes, seconds, ms, result = {};
    total = radians * RAD_TO_HOUR;
    if (total < 0) total += 24;
    total  -= hours   = Math.floor(total);
    total  *= 60;
    total  -= minutes = Math.floor(total);
    total  *= 60;
    ms = Math.floor(1000 * total + 0.5);
    if (ms >= 60000) {
      ms -= 60000;
      minutes += 1;
      if (minutes >= 60) { minutes -= 60; hours += 1; }
    }
    seconds = Math.floor(ms / 1000);
    ms -= Math.floor(1000 * seconds);
    result.hours        = hours;
    result.minutes      = minutes;
    result.seconds      = seconds;
    result.milliseconds = ms;
    return result;
  }

  /**
   * 度數 → 度分秒物件
   * @param {number} degrees
   * @returns {{ degree, minutes, seconds }}
   */
  function dms(degrees) {
    var total, degree, minutes, seconds, result = {};
    total = degrees * RAD_TO_DEG;
    if (total < 0) total = -total;
    total   -= degree  = Math.floor(total);
    total   *= 60;
    total   -= minutes = Math.floor(total);
    total   *= 60;
    seconds  = total;
    result.degree  = degree;
    result.minutes = minutes;
    result.seconds = seconds;
    return result;
  }

  /**
   * 十進位度數 → "D°M''S"" 字串
   * @param {number} decimalDegrees
   * @returns {string}
   */
  function decimalDegreesToDMSString(decimalDegrees) {
    var d = Math.floor(decimalDegrees);
    var mTotal = 60 * (decimalDegrees - d);
    var m = Math.floor(mTotal);
    var sTotal = 60 * (mTotal - m);
    var s = Math.round(sTotal);
    if (s === 60) { m++; s = 0; }
    if (m === 60) { d++; m = 0; }
    return d + "°" + m + "''" + Math.floor(s) + '"';
  }

  /**
   * 附加視黃經資訊到天體物件
   * @param {object} body        - 天體物件
   * @param {number} longitude   - 視黃經（十進位度）
   * @returns {object}
   */
  function attachApparentLongitudes(body, longitude) {
    body.apparentLongitude        = longitude;
    body.apparentLongitudeString  = decimalDegreesToDMSString(longitude);
    body.apparentLongitude30String = decimalDegreesToDMSString(mod(longitude, 30));
    return body;
  }

  // ─── 向量 / 球面工具 ──────────────────────────────────────────────────────────

  /**
   * 直角座標向量 → 赤道座標（RA / Dec）
   * @param {number[]} vec   - 3D 向量 [x, y, z]
   * @param {number[]} out   - 輸出陣列 [ra, dec, r]
   * @param {object}   [ext] - 附加輸出物件
   * @returns {object}
   */
  function showrd(vec, out, ext) {
    var i, sum = 0, ra, dec, r;
    for (i = 0; i < 3; i++) { sum += vec[i] * vec[i]; }
    r   = Math.sqrt(sum);
    ra  = zatan2(vec[0], vec[1]);
    dec = Math.asin(vec[2] / r);
    out[0] = ra;
    out[1] = dec;
    out[2] = r;
    ext = ext || {};
    ext.dRA  = ra;
    ext.dDec = dec;
    ext.ra   = hms(ra);
    ext.dec  = dms(dec);
    return ext;
  }

  /**
   * 計算兩向量間的角度差（RA / Dec 差）
   * @param {number[]} v1
   * @param {number[]} v2
   * @param {object}   [out]
   * @returns {object} { dr: RA差(弧度), dd: Dec差(弧度) }
   */
  function deltap(v1, v2, out) {
    var i, r1, r2, diff = [], sumDiff = 0;
    var s1, s2, c1, c2, r;
    out = out || {};
    r1 = 0; r2 = 0;
    for (i = 0; i < 3; i++) {
      r1 += v1[i] * v1[i];
      r2 += v2[i] * v2[i];
      c2  = v2[i] - v1[i];
      diff[i] = c2;
      sumDiff += c2 * c2;
    }
    r1 = Math.sqrt(r1);
    r2 = Math.sqrt(r2);

    if (r1 < 1e-7 || r2 < 1e-7 || sumDiff / (r1 * r1 + r2 * r2) > 5e-7) {
      r1 = zatan2(v1[0], v1[1]);
      r2 = zatan2(v2[0], v2[1]);
      r2 -= r1;
      while (r2 < -Math.PI) r2 += 2 * Math.PI;
      while (r2 >  Math.PI) r2 -= 2 * Math.PI;
      out.dr = r2;
      r1 = Math.asin(v1[2] / Math.sqrt(v1[0]*v1[0]+v1[1]*v1[1]+v1[2]*v1[2]));
      r2 = Math.asin(v2[2] / Math.sqrt(v2[0]*v2[0]+v2[1]*v2[1]+v2[2]*v2[2]));
      out.dd = r2 - r1;
      return out;
    }

    s1 = v1[0]; s2 = v1[1];
    if (s1 === 0) {
      out.dr = 1e38;
    } else {
      r = s2 / s1;
      out.dr = (diff[1] - diff[0] * s2 / s1) / (s1 * (1 + r * r));
    }
    s1 = v1[2] / r1;
    c1 = Math.sqrt(1 - s1 * s1);
    out.dd = (v2[2] / r2 - s1) / c1;
    return out;
  }

  /**
   * 計算三向量兩兩夾角（用於太陽/地球/天體角度）
   * @param {number[]} E  - 地球向量
   * @param {number[]} S  - 太陽向量
   * @param {number[]} O  - 天體向量
   * @param {object}   state - 含 locals 的狀態物件
   * @returns {object}
   */
  function angles(E, S, O, state) {
    var i, a, o, r;
    state.locals.EO = 0;
    state.locals.SE = 0;
    state.locals.SO = 0;
    state.locals.pq = 0;
    state.locals.ep = 0;
    state.locals.qe = 0;

    for (i = 0; i < 3; i++) {
      a = O[i]; o = S[i]; r = E[i];
      state.locals.EO += r * r;
      state.locals.SE += a * a;
      state.locals.SO += o * o;
      state.locals.pq += r * o;
      state.locals.ep += a * r;
      state.locals.qe += o * a;
    }
    state.locals.EO = Math.sqrt(state.locals.EO);
    state.locals.SO = Math.sqrt(state.locals.SO);
    state.locals.SE = Math.sqrt(state.locals.SE);
    if (state.locals.SO > 1e-12) {
      state.locals.pq /= state.locals.EO * state.locals.SO;
      state.locals.qe /= state.locals.SO * state.locals.SE;
    }
    state.locals.ep /= state.locals.SE * state.locals.EO;
    return state;
  }

  /**
   * 修正視差（RA / Dec 修正量）
   * @param {number[]} base  - 基準向量
   * @param {number[]} delta - 修正向量
   * @param {object}   [out]
   * @returns {object} { dRA, dDec }
   */
  function showcor(base, delta, out) {
    var i, corrected = [];
    for (i = 0; i < 3; i++) corrected[i] = base[i] + delta[i];
    var diff = deltap(base, corrected);
    out = out || {};
    out.dRA  = ARC_SECONDS_PER_RADIAN * diff.dr / 15;
    out.dDec = ARC_SECONDS_PER_RADIAN * diff.dd;
    return out;
  }

  // ─── 範圍判斷工具 ─────────────────────────────────────────────────────────────

  /**
   * 判斷數值是否在環形集合的指定範圍內
   * @param {number} setPoint       - 中心點
   * @param {number} halfRangeLength - 半徑
   * @param {number} setMin         - 最小值
   * @param {number} setMax         - 最大值（模數）
   * @param {number} number         - 待判斷數值
   * @returns {boolean}
   */
  function isInModSetRange(setPoint, halfRangeLength, setMin, setMax, number) {
    setPoint       = setPoint       || 0;
    halfRangeLength = halfRangeLength || 0;
    setMin         = setMin         || 0;
    setMax         = setMax         !== undefined ? setMax : 1;
    number         = number         || 0;

    var lo = setPoint - halfRangeLength;
    var hi = setPoint + halfRangeLength - setMax;
    if (lo < setMin) {
      setPoint -= lo;
      number    = (number - lo) % setMax;
    } else if (hi > setMin) {
      setPoint -= hi;
      number    = (setMax + number - hi) % setMax;
    }
    return number >= setPoint - halfRangeLength && number < setPoint + halfRangeLength;
  }

  /**
   * 取得兩個環形數值的最短距離
   * @param {number} a
   * @param {number} b
   * @param {number} modulus - 環的大小（如 360）
   * @returns {number}
   */
  function getModuloDifference(a, b, modulus) {
    var half = modulus / 2;
    return half - Math.abs(Math.abs(a - b) - half);
  }

  /**
   * 修正環形取模後的正負號
   * @param {number} value
   * @param {number} modResult
   * @param {number} modulus
   * @param {number} offset
   * @returns {number}
   */
  function correctRealModuloNumber(value, modResult, modulus, offset) {
    return (modResult >= modulus || modResult + offset - modulus === value)
      ? value
      : -value;
  }

  // ─── 公開介面 ─────────────────────────────────────────────────────────────────
  return {
    // 常數
    JULIAN_DATE_J2000      : JULIAN_DATE_J2000,
    JULIAN_DATE_B1950      : JULIAN_DATE_B1950,
    JULIAN_DATE_1900       : JULIAN_DATE_1900,
    RAD_TO_HOUR            : RAD_TO_HOUR,
    DEG_TO_RAD             : DEG_TO_RAD,
    RAD_TO_DEG             : RAD_TO_DEG,
    ARC_SECONDS_PER_RADIAN : ARC_SECONDS_PER_RADIAN,
    TWO_PI                 : TWO_PI,

    // 時間
    hourTimeToDecimal      : hourTimeToDecimal,
    timeInJulianCenturies  : timeInJulianCenturies,
    cloneUTCDate           : cloneUTCDate,

    // 角度取模
    mod                    : mod,
    mods3600               : mods3600,
    modtp                  : modtp,
    mod360                 : mod360,
    mod30                  : mod30,

    // 三角
    sinh                   : sinh,
    cosh                   : cosh,
    tanh                   : tanh,
    zatan2                 : zatan2,

    // 格式化
    hms                    : hms,
    dms                    : dms,
    decimalDegreesToDMSString    : decimalDegreesToDMSString,
    attachApparentLongitudes     : attachApparentLongitudes,

    // 向量 / 球面
    showrd                 : showrd,
    deltap                 : deltap,
    angles                 : angles,
    showcor                : showcor,

    // 範圍判斷
    isInModSetRange        : isInModSetRange,
    getModuloDifference    : getModuloDifference,
    correctRealModuloNumber: correctRealModuloNumber
  };

})();