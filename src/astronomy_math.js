// ============================================
// astronomy_math.js - Browser Compatible Format
// 可透過 <script src="astronomy_math.js"></script> 調用
// ============================================

// ============================================
// MathUtils - 數學工具函數庫
// ============================================
var MathUtils = (function() {
  'use strict';

  var arccot = function(x) {
    return Math.PI / 2 - Math.atan(x);
  };

  var degreesToRadians = function(degrees) {
    return degrees * (Math.PI / 180);
  };

  var radiansToDegrees = function(radians) {
    return radians * (180 / Math.PI);
  };

  var sinFromDegrees = function(degrees) {
    return Math.sin(degreesToRadians(degrees));
  };

  var cosFromDegrees = function(degrees) {
    return Math.cos(degreesToRadians(degrees));
  };

  var tanFromDegrees = function(degrees) {
    return Math.tan(degreesToRadians(degrees));
  };

  var modulo = function(number, mod) {
    return (number % mod + mod) % mod;
  };

  var hourTimeToDecimal = function(params) {
    params = params || {};
    var hour   = params.hour   || 0;
    var minute = params.minute || 0;
    return hour + (minute / 60);
  };

  var decimalTimeToHour = function(params) {
    params = params || {};
    var decimal = params.decimal || 0;
    var hours   = Math.floor(decimal);
    var minutes = Math.round((decimal - hours) * 60);
    return {
      hours: hours,
      minutes: minutes,
      asHours:   function() { return decimal; },
      asMinutes: function() { return decimal * 60; }
    };
  };

  var decimalDegreesToDMS = function(decimalDegrees) {
    var degrees  = Math.floor(decimalDegrees);
    var minfloat = (decimalDegrees - degrees) * 60;
    var minutes  = Math.floor(minfloat);
    var secfloat = (minfloat - minutes) * 60;
    var seconds  = Math.round(secfloat);

    if (seconds === 60) { minutes++; seconds = 0; }
    if (minutes === 60) { degrees++; minutes = 0; }

    return { degrees: degrees, minutes: minutes, seconds: seconds };
  };

  var isDegreeWithinCircleArc = function(arcLow, arcHigh, degree, edges) {
    edges = edges || '[)';
    var operators = {
      '[': function(a, b) { return a >= b; },
      '(': function(a, b) { return a > b; },
      ']': function(a, b) { return a <= b; },
      ')': function(a, b) { return a < b; }
    };
    var lowComparison  = operators[edges.split('')[0]];
    var highComparison = operators[edges.split('')[1]];
    if (arcLow > arcHigh) {
      arcHigh += 360;
      if (degree < arcLow) { degree += 360; }
    }
    return lowComparison(degree, arcLow) && highComparison(degree, arcHigh);
  };

  var getModuloDifference = function(point1, point2) {
    var high = Math.max(point1, point2);
    var low  = Math.min(point1, point2);
    return Math.min(high - low, 360 + low - high);
  };

  return {
    arccot: arccot,
    degreesToRadians: degreesToRadians,
    radiansToDegrees: radiansToDegrees,
    sinFromDegrees: sinFromDegrees,
    cosFromDegrees: cosFromDegrees,
    tanFromDegrees: tanFromDegrees,
    modulo: modulo,
    hourTimeToDecimal: hourTimeToDecimal,
    decimalTimeToHour: decimalTimeToHour,
    decimalDegreesToDMS: decimalDegreesToDMS,
    isDegreeWithinCircleArc: isDegreeWithinCircleArc,
    getModuloDifference: getModuloDifference
  };
})();


// ============================================
// AstronomyUtils - 天文計算函數庫
// ============================================
var AstronomyUtils = (function() {
  'use strict';

  var degreesToRadians    = MathUtils.degreesToRadians;
  var radiansToDegrees    = MathUtils.radiansToDegrees;
  var modulo              = MathUtils.modulo;
  var arccot              = MathUtils.arccot;
  var sinFromDegrees      = MathUtils.sinFromDegrees;
  var cosFromDegrees      = MathUtils.cosFromDegrees;
  var tanFromDegrees      = MathUtils.tanFromDegrees;
  var decimalDegreesToDMS = MathUtils.decimalDegreesToDMS;

  // 🥈 修正：Meeus "Astronomical Algorithms" Ch.22 四項多項式
  // 原版僅用一次項 (23.4393 - 0.0130*T)，誤差可達數角分
  var getObliquityEcliptic = function(jd) {
    var T = (jd - 2451545.0) / 36525;
    return 23.439291111
      - 0.013004167 * T
      - 0.000000164 * T * T
      + 0.000000504 * T * T * T;
  };

  // 🥉 修正：改用 Meeus 標準公式，與 astro-houses.js 的 dateToJDE 一致
  // 原版使用 Danby 近似公式，兩套並存可能造成 JD 不一致
  var getJulianDate = function(params) {
    params = params || {};
    var year  = params.year  || 0;
    var month = params.month || 0;
    var date  = params.date  || 0;
    var ut    = params.ut    || 0;

    var y = year;
    var m = month;
    if (m <= 2) { y -= 1; m += 12; }

    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);

    return Math.floor(365.25  * (y + 4716))
         + Math.floor(30.6001 * (m + 1))
         + date + (ut / 24) + B - 1524.5;
  };

  var getLocalSiderealTime = function(params) {
    params = params || {};
    var jd        = params.jd        || 0;
    var longitude = params.longitude || 0;

    var julianDaysJan1st2000         = 2451545.0;
    var julianDaysSince2000          = jd - julianDaysJan1st2000;
    var tFactor                      = julianDaysSince2000 / 36525;
    var degreesRotationInSiderealDay = 360.98564736629;

    var lst = 280.46061837
      + (degreesRotationInSiderealDay * julianDaysSince2000)
      + 0.000387933 * Math.pow(tFactor, 2)
      - (Math.pow(tFactor, 3) / 38710000)
      + longitude;

    return modulo(parseFloat(lst), 360);
  };

  var getMidheavenSun = function(params) {
    params = params || {};
    var localSiderealTime = params.localSiderealTime || 0.00;
    var obliquityEcliptic = params.obliquityEcliptic || 23.4367;

    var tanLST    = tanFromDegrees(localSiderealTime);
    var cosOE     = cosFromDegrees(obliquityEcliptic);
    var midheaven = radiansToDegrees(Math.atan(tanLST / cosOE));

    if (midheaven < 0)                              { midheaven += 360; }
    if (midheaven > localSiderealTime)              { midheaven -= 180; }
    if (midheaven < 0)                              { midheaven += 180; }
    if (midheaven < 180 && localSiderealTime >= 180){ midheaven += 180; }

    return modulo(midheaven, 360);
  };

  var getAscendant = function(params) {
    params = params || {};
    var latitude          = parseFloat(params.latitude          || 0.00);
    var obliquityEcliptic = parseFloat(params.obliquityEcliptic || 23.4367);
    var localSiderealTime = parseFloat(params.localSiderealTime || 0.00);

    var a = -cosFromDegrees(localSiderealTime);
    var b =  sinFromDegrees(obliquityEcliptic) * tanFromDegrees(latitude);
    var c =  cosFromDegrees(obliquityEcliptic) * sinFromDegrees(localSiderealTime);
    var d = b + c;
    var ascendant = radiansToDegrees(Math.atan(a / d));

    if (d < 0) { ascendant += 180; } else { ascendant += 360; }
    if (ascendant >= 180) { ascendant -= 180; } else { ascendant += 180; }

    return modulo(ascendant, 360);
  };

  return {
    getObliquityEcliptic: getObliquityEcliptic,
    getJulianDate: getJulianDate,
    getLocalSiderealTime: getLocalSiderealTime,
    getMidheavenSun: getMidheavenSun,
    getAscendant: getAscendant
  };
})();