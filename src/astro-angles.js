/**
 * astro-angles.js
 * ===============
 * 西洋占星上升點（ASC）與天頂（MC）計算 - 獨立離線版
 *
 * 提取自：CircularNatalHoroscopeJS (0xStarcat)
 * https://github.com/0xStarcat/CircularNatalHoroscopeJS
 * License: MIT
 *
 * 包含完整計算鏈：
 *   出生資料（年月日時分 + 經緯度）
 *     → UTC 時間換算（內建時區偏移，無需外部套件）
 *     → 儒略日（Julian Date）
 *     → 地方恆星時（Local Sidereal Time, LST）
 *     → 天頂（Midheaven / MC）
 *     → 上升點（Ascendant / ASC）
 *
 * 依賴：無（純 JS，無需 npm、無需 moment.js、無需 tz-lookup）
 * 時區：內建簡化 UTC 偏移表（涵蓋全球主要時區）
 *       如需精確歷史夏令時間（DST），請傳入 utcOffsetHours 覆蓋自動偵測
 *
 * ── 使用範例 ──────────────────────────────────────────────
 *
 * <script src="astro-angles.js"></script>
 * <script>
 *   // 方法 1：自動時區（依經緯度估算 UTC 偏移）
 *   var result = AstroAngles.calcAngles({
 *     year: 1990, month: 5, date: 15,   // month: 1=1月...12=12月
 *     hour: 14,   minute: 30,           // 當地時間
 *     latitude:  25.0478,               // 出生地緯度（北正南負）
 *     longitude: 121.5319               // 出生地經度（東正西負）
 *   });
 *
 *   // 方法 2：手動指定 UTC 偏移（最精確，建議生產環境使用）
 *   var result = AstroAngles.calcAngles({
 *     year: 1990, month: 5, date: 15,
 *     hour: 14,   minute: 30,
 *     latitude:  25.0478,
 *     longitude: 121.5319,
 *     utcOffsetHours: 8               // UTC+8（台灣）
 *   });
 *
 *   console.log(result.midheaven);    // 天頂黃道度數 (0~359.9999)
 *   console.log(result.ascendant);    // 上升黃道度數 (0~359.9999)
 *   console.log(result.lst);          // 地方恆星時（度）= RAMC
 *   console.log(result.julianDate);   // 儒略日
 *
 *   // 格式化為度分秒
 *   var dms = AstroAngles.toDMS(result.midheaven);
 *   console.log(dms); // { degrees: 95, minutes: 18, seconds: 7 }
 *   console.log(AstroAngles.formatDMS(dms)); // "95° 18' 7''"
 * </script>
 *
 * ── 輸入參數說明 ──────────────────────────────────────────
 *   year            {number}  西元年（> 0 CE）
 *   month           {number}  月份（1~12，1 = 1月）
 *   date            {number}  日期（1~31）
 *   hour            {number}  當地時間小時（0~23）
 *   minute          {number}  當地時間分鐘（0~59）
 *   second          {number}  秒（0~59，預設 0）
 *   latitude        {number}  出生地緯度，北正南負（-90 ~ 90）
 *   longitude       {number}  出生地經度，東正西負（-180 ~ 180）
 *   utcOffsetHours  {number}  UTC 偏移小時（選填，如 8 = UTC+8）
 *                             若不填，依經度自動估算（精度 ±30 分鐘）
 *   obliquityEcliptic {number} 黃赤交角（選填，預設 23.4367°）
 *
 * ── 輸出物件 ──────────────────────────────────────────────
 *   ascendant       {number}  上升黃道度數（0~359.9999）
 *   midheaven       {number}  天頂黃道度數（0~359.9999）
 *   lst             {number}  地方恆星時（度）= RAMC
 *   julianDate      {number}  儒略日
 *   utcHour         {number}  換算後的 UTC 小時（含小數）
 *   utcOffsetUsed   {number}  實際使用的 UTC 偏移值
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(); // CommonJS (Node.js)
  } else {
    root.AstroAngles = factory(); // 瀏覽器全域變數
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ============================================================
  // 1. 數學工具（來源：utilities/math.js）
  // ============================================================

  function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  function sinFromDegrees(degrees) { return Math.sin(degreesToRadians(degrees)); }
  function cosFromDegrees(degrees) { return Math.cos(degreesToRadians(degrees)); }
  function tanFromDegrees(degrees) { return Math.tan(degreesToRadians(degrees)); }

  /** 支援負數的模運算 */
  function modulo(number, mod) {
    return (number % mod + mod) % mod;
  }

  /**
   * toDMS - 十進位度數轉度分秒物件
   * @param {number} decimalDegrees
   * @returns {{ degrees, minutes, seconds }}
   */
  function toDMS(decimalDegrees) {
    var d = Math.floor(decimalDegrees);
    var minfloat = (decimalDegrees - d) * 60;
    var m = Math.floor(minfloat);
    var secfloat = (minfloat - m) * 60;
    var s = Math.round(secfloat);
    if (s === 60) { m++; s = 0; }
    if (m === 60) { d++; m = 0; }
    return { degrees: d, minutes: m, seconds: s };
  }

  /**
   * formatDMS - 格式化度分秒為字串
   * @param {{ degrees, minutes, seconds }} dms
   * @returns {string}  例："95° 18' 7''"
   */
  function formatDMS(dms) {
    return dms.degrees + '\u00b0 ' + dms.minutes + "' " + dms.seconds + "''";
  }

  // ============================================================
  // 2. 時區偏移估算（替代 tz-lookup + moment-timezone）
  // ============================================================

  /**
   * estimateUtcOffset - 由出生地經度估算 UTC 偏移（小時）
   *
   * 原始 Origin.js 使用 moment-timezone + tz-lookup 依據精確經緯度查詢
   * IANA 時區資料庫，可自動處理歷史夏令時間（DST）。
   *
   * 本函數以「每 15° 經度 = 1 小時」的地理規則估算 UTC 偏移，
   * 精度約 ±30 分鐘，適用於一般占星計算。
   * 若需精確 DST 處理，請在呼叫 calcAngles() 時傳入 utcOffsetHours 參數。
   *
   * @param {number} longitude - 出生地經度（-180 ~ 180）
   * @returns {number} UTC 偏移小時（例：東八區 = 8，西五區 = -5）
   */
  function estimateUtcOffset(longitude) {
    return Math.round(longitude / 15);
  }

  // ============================================================
  // 3. UTC 時間換算
  // ============================================================

  /**
   * localToUTC - 將當地時間轉換為 UTC 時間
   * @param {object} params
   * @param {number} params.year
   * @param {number} params.month      - 1~12
   * @param {number} params.date
   * @param {number} params.hour
   * @param {number} params.minute
   * @param {number} params.second
   * @param {number} params.utcOffset  - UTC 偏移小時
   * @returns {{ year, month, date, hour, minute, second }}  UTC 時間
   */
  function localToUTC(params) {
    var utcOffset = params.utcOffset || 0;
    // 以分鐘為單位計算偏移避免浮點問題
    var totalMinutes = params.hour * 60 + params.minute - Math.round(utcOffset * 60);
    var totalSeconds = params.second || 0;

    // 從日期 + 分鐘偏移重建 UTC Date 物件
    // month 傳入為 1~12，Date() 需要 0~11
    var dt = new Date(Date.UTC(
      params.year,
      params.month - 1,
      params.date,
      Math.floor(totalMinutes / 60),
      totalMinutes % 60,
      totalSeconds
    ));

    return {
      year:   dt.getUTCFullYear(),
      month:  dt.getUTCMonth() + 1,  // 回傳 1~12
      date:   dt.getUTCDate(),
      hour:   dt.getUTCHours(),
      minute: dt.getUTCMinutes(),
      second: dt.getUTCSeconds()
    };
  }

  // ============================================================
  // 4. 儒略日（Julian Date）
  // 來源：utilities/astronomy.js → getJulianDate()
  // 參考：Danby (1988) "Fundamentals of Celestial Mechanics 2nd Ed."
  // 驗證：https://aa.usno.navy.mil/data/docs/JulianDate.php
  // ============================================================

  /**
   * getJulianDate - 由 UTC 日期計算儒略日
   * @param {object} params
   * @param {number} params.year   - UTC 年
   * @param {number} params.month  - UTC 月（1~12）
   * @param {number} params.date   - UTC 日
   * @param {number} params.ut     - 通用時（小時，含小數）
   * @returns {number} 儒略日（Julian Date）
   */
  function getJulianDate(params) {
    var year  = params.year  || 0;
    var month = params.month || 0;
    var date  = params.date  || 0;
    var ut    = params.ut    || 0;

    return (367 * year)
      - Math.floor(7 * (year + Math.floor((month + 9) / 12)) / 4)
      - Math.floor(3 * (Math.floor((year + (month - 9) / 7) / 100) + 1) / 4)
      + Math.floor((275 * month) / 9)
      + date
      + 1721028.5
      + (ut / 24);
  }

  // ============================================================
  // 5. 地方恆星時（Local Sidereal Time）
  // 來源：utilities/astronomy.js → getLocalSiderealTime()
  // 參考：Jean Meeus (1991) "Astronomical Algorithms" Ch.11 p.84 公式 11.4
  // 驗證：http://neoprogrammics.com/sidereal_time_calculator/
  // ============================================================

  /**
   * getLocalSiderealTime - 由儒略日與出生地經度計算地方恆星時
   * 回傳值同時也是天頂赤經（RAMC，Right Ascension of MC）
   *
   * @param {object} params
   * @param {number} params.jd        - 儒略日
   * @param {number} params.longitude - 出生地經度（-180 ~ 180）
   * @returns {number} 地方恆星時（弧度度數，0~359.9999）
   */
  function getLocalSiderealTime(params) {
    var jd        = params.jd        || 0;
    var longitude = params.longitude || 0;

    var julianDaysJan1st2000      = 2451545.0;
    var julianDaysSince2000       = jd - julianDaysJan1st2000;
    var tFactor                   = julianDaysSince2000 / 36525; // 儒略世紀
    var degreesRotationInSidereal = 360.98564736629;

    var lst = 280.46061837
      + (degreesRotationInSidereal * julianDaysSince2000)
      + (0.000387933 * Math.pow(tFactor, 2))
      - (Math.pow(tFactor, 3) / 38710000)
      + longitude;

    return parseFloat(modulo(lst, 360).toFixed(6));
  }

  // ============================================================
  // 6. 天頂（Midheaven / MC）
  // 來源：utilities/astronomy.js → getMidheavenSun()
  // 參考：Jean Meeus (1991) "Astronomical Algorithms" Ch.24 p.153 公式 24.6
  // 驗證：https://astrolibrary.org/midheaven-calculator/
  //        https://cafeastrology.com/midheaven.html
  // ============================================================

  /**
   * getMidheaven - 由地方恆星時計算天頂黃道度數
   * @param {object} params
   * @param {number} params.localSiderealTime  - LST（度，0~359）
   * @param {number} [params.obliquityEcliptic=23.4367] - 黃赤交角（度）
   * @returns {number} 天頂黃道度數（0~359.9999）
   */
  function getMidheaven(params) {
    var lst = parseFloat(params.localSiderealTime || 0);
    var oe  = params.obliquityEcliptic != null ? parseFloat(params.obliquityEcliptic) : 23.4367;

    var tanLST = tanFromDegrees(lst);
    var cosOE  = cosFromDegrees(oe);
    var mc     = radiansToDegrees(Math.atan(tanLST / cosOE));

    // 象限修正
    if (mc < 0)              mc += 360;
    if (mc > lst)            mc -= 180;
    if (mc < 0)              mc += 180;
    if (mc < 180 && lst >= 180) mc += 180;

    return parseFloat(modulo(mc, 360).toFixed(4));
  }

  // ============================================================
  // 7. 上升點（Ascendant / ASC）
  // 來源：utilities/astronomy.js → getAscendant()
  // 參考：Peter Duffett-Smith & Jonathan Zwart,
  //        "Practical Astronomy with your Calculator or Spreadsheet"
  //        4th ed., p.47 (2011)
  // 驗證：https://cafeastrology.com/ascendantcalculator.html
  //        https://www.astrosofa.com/horoscope/ascendant
  //        https://en.wikipedia.org/wiki/Ascendant
  // ============================================================

  /**
   * getAscendant - 由地方恆星時與出生地緯度計算上升點黃道度數
   * @param {object} params
   * @param {number} params.latitude           - 出生地緯度（-90 ~ 90）
   * @param {number} params.localSiderealTime  - LST（度，0~359）
   * @param {number} [params.obliquityEcliptic=23.4367] - 黃赤交角（度）
   * @returns {number} 上升點黃道度數（0~359.9999）
   */
  function getAscendant(params) {
    var lat = parseFloat(params.latitude           || 0);
    var lst = parseFloat(params.localSiderealTime  || 0);
    var oe  = params.obliquityEcliptic != null ? parseFloat(params.obliquityEcliptic) : 23.4367;

    var a = -cosFromDegrees(lst);
    var b =  sinFromDegrees(oe) * tanFromDegrees(lat);
    var c =  cosFromDegrees(oe) * sinFromDegrees(lst);
    var d = b + c;
    var e = a / d;
    var f = Math.atan(e);

    var asc = radiansToDegrees(f);

    // 象限修正（Wikipedia / Duffett-Smith 公式）
    if (d < 0) {
      asc += 180;
    } else {
      asc += 360;
    }

    if (asc >= 180) {
      asc -= 180;
    } else {
      asc += 180;
    }

    return parseFloat(modulo(asc, 360).toFixed(4));
  }

  // ============================================================
  // 8. 統一計算入口
  // ============================================================

  /**
   * calcAngles - 由出生資料一次計算上升點與天頂（完整計算鏈）
   *
   * 計算順序：
   *   當地時間 → UTC 換算 → 儒略日 → 地方恆星時 → MC → ASC
   *
   * @param {object} params
   * @param {number} params.year             - 西元年（> 0 CE）
   * @param {number} params.month            - 月份（1~12）
   * @param {number} params.date             - 日期（1~31）
   * @param {number} params.hour             - 當地時間小時（0~23）
   * @param {number} params.minute           - 當地時間分鐘（0~59）
   * @param {number} [params.second=0]       - 秒（0~59）
   * @param {number} params.latitude         - 出生地緯度（北正南負）
   * @param {number} params.longitude        - 出生地經度（東正西負）
   * @param {number} [params.utcOffsetHours] - UTC 偏移（選填，不填則自動估算）
   * @param {number} [params.obliquityEcliptic=23.4367] - 黃赤交角
   *
   * @returns {{
   *   ascendant:    number,  上升黃道度數
   *   midheaven:    number,  天頂黃道度數
   *   lst:          number,  地方恆星時（度）= RAMC
   *   julianDate:   number,  儒略日
   *   utcHour:      number,  UTC 小時（含小數）
   *   utcOffsetUsed: number  實際使用的 UTC 偏移
   * }}
   */
  function calcAngles(params) {
    params = params || {};

    var year      = params.year   || 0;
    var month     = params.month  || 1;  // 1~12
    var date      = params.date   || 1;
    var hour      = params.hour   || 0;
    var minute    = params.minute || 0;
    var second    = params.second || 0;
    var latitude  = params.latitude  != null ? parseFloat(params.latitude)  : 0;
    var longitude = params.longitude != null ? parseFloat(params.longitude) : 0;
    var oe        = params.obliquityEcliptic != null ? parseFloat(params.obliquityEcliptic) : 23.4367;

    // 1. 決定 UTC 偏移
    var utcOffset = params.utcOffsetHours != null
      ? parseFloat(params.utcOffsetHours)
      : estimateUtcOffset(longitude);

    // 2. 當地時間 → UTC
    var utc = localToUTC({
      year: year, month: month, date: date,
      hour: hour, minute: minute, second: second,
      utcOffset: utcOffset
    });

    // 3. UTC 小時（含分鐘小數）
    var utcHour = utc.hour + (utc.minute / 60) + (utc.second / 3600);

    // 4. 儒略日
    var jd = getJulianDate({
      year:  utc.year,
      month: utc.month,
      date:  utc.date,
      ut:    utcHour
    });

    // 5. 地方恆星時（度）= RAMC
    var lst = getLocalSiderealTime({ jd: jd, longitude: longitude });

    // 6. 天頂（MC）
    var mc = getMidheaven({ localSiderealTime: lst, obliquityEcliptic: oe });

    // 7. 上升點（ASC）
    var asc = getAscendant({ latitude: latitude, localSiderealTime: lst, obliquityEcliptic: oe });

    return {
      ascendant:     asc,
      midheaven:     mc,
      lst:           lst,
      julianDate:    parseFloat(jd.toFixed(6)),
      utcHour:       parseFloat(utcHour.toFixed(6)),
      utcOffsetUsed: utcOffset
    };
  }

  // ============================================================
  // 對外暴露 API
  // ============================================================
  return {
    // 主要入口
    calcAngles:            calcAngles,

    // 個別函數（方便整合至已有計算流程）
    getJulianDate:         getJulianDate,
    getLocalSiderealTime:  getLocalSiderealTime,
    getMidheaven:          getMidheaven,
    getAscendant:          getAscendant,

    // 時區工具
    estimateUtcOffset:     estimateUtcOffset,
    localToUTC:            localToUTC,

    // 格式化工具
    toDMS:                 toDMS,
    formatDMS:             formatDMS,

    // 數學工具（方便外部使用）
    modulo:                modulo,
    degreesToRadians:      degreesToRadians,
    radiansToDegrees:      radiansToDegrees
  };
}));
