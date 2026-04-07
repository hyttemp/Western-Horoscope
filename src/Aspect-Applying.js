/**
 * aspect-applying-separating.js
 * 出相／入相計算模組（傳統瀏覽器格式）
 * 供 HTML 以 <script src="..."> 方式調用
 *
 * 使用方式：
 *   var result = AspectDirection.calculate(planet1, planet2, aspectAngle);
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────
  // 內部工具函式
  // ─────────────────────────────────────────

  /**
   * 將角度標準化至 0 ~ 360
   */
  function normalizeDeg(deg) {
    return ((deg % 360) + 360) % 360;
  }

  /**
   * 計算兩星之間的最短角距（考慮正負方向）
   * 回傳 -180 ~ +180
   */
  function shortestArc(fromDeg, toDeg) {
    var diff = normalizeDeg(toDeg - fromDeg);
    if (diff > 180) diff -= 360;
    return diff;
  }

  /**
   * 計算兩星與某相位角的 orb（容許度）
   * @param {number} lon1  - 行星1黃道經度
   * @param {number} lon2  - 行星2黃道經度
   * @param {number} aspectAngle - 相位角度（0, 60, 90, 120, 180...）
   * @returns {number} orb（正值）
   */
  function calcOrb(lon1, lon2, aspectAngle) {
    var diff = Math.abs(shortestArc(lon1, lon2));
    var orb  = Math.abs(diff - aspectAngle);
    // 處理 360 對稱
    if (orb > 180) orb = 360 - orb;
    return orb;
  }

  // ─────────────────────────────────────────
  // 主要計算函式
  // ─────────────────────────────────────────

  /**
   * 計算出相／入相
   *
   * @param {Object} planet1
   *   @param {number} planet1.longitude    - 當前黃道經度（度）
   *   @param {number} planet1.dailyMotion  - 每日速度（度/日，逆行為負值）
   *
   * @param {Object} planet2
   *   @param {number} planet2.longitude
   *   @param {number} planet2.dailyMotion
   *
   * @param {number} aspectAngle - 相位角度（例：0, 60, 90, 120, 180）
   *
   * @param {Object} [options]
   *   @param {number} [options.orbLimit=10]   - 最大容許度（超過視為無相位）
   *   @param {number} [options.step=0.01]     - 模擬步進（日），預設 0.01日≈15分鐘
   *
   * @returns {Object|null}
   *   {
   *     direction:   'applying' | 'separating',
   *     directionZH: '入相' | '出相',
   *     orb:          number,   // 當前 orb（度）
   *     orbFormatted: string,   // 例："2°34'"
   *     planet1Retro: boolean,  // 行星1是否逆行
   *     planet2Retro: boolean,  // 行星2是否逆行
   *     exactInDays:  number|null // 預估幾日後精確（僅入相時有值）
   *   }
   *   若無相位（超出 orbLimit）則回傳 null
   */
  function calculate(planet1, planet2, aspectAngle, options) {
    var opts      = options || {};
    var orbLimit  = (opts.orbLimit !== undefined) ? opts.orbLimit : 10;
    var step      = (opts.step    !== undefined) ? opts.step     : 0.01;

    // 當前 orb
    var currentOrb = calcOrb(planet1.longitude, planet2.longitude, aspectAngle);

    // 超出容許度 → 無相位
    if (currentOrb > orbLimit) return null;

    // 模擬下一步的位置
    var nextLon1 = planet1.longitude + planet1.dailyMotion * step;
    var nextLon2 = planet2.longitude + planet2.dailyMotion * step;
    var nextOrb  = calcOrb(nextLon1, nextLon2, aspectAngle);

    // 判斷方向
    var isApplying = nextOrb < currentOrb;
    var direction  = isApplying ? 'applying' : 'separating';

    // 預估精確日（僅入相）
    var exactInDays = null;
    if (isApplying) {
      var orbChangePerDay = (currentOrb - nextOrb) / step;
      if (orbChangePerDay > 0) {
        exactInDays = currentOrb / orbChangePerDay;
      }
    }

    // 格式化 orb 為「度°分'」
    var orbDeg = Math.floor(currentOrb);
    var orbMin = Math.round((currentOrb - orbDeg) * 60);
    if (orbMin === 60) { orbDeg += 1; orbMin = 0; }
    var orbFormatted = orbDeg + '\u00b0' + orbMin + "'";

    return {
      direction:    direction,
      directionZH:  isApplying ? '入相' : '出相',
      orb:          currentOrb,
      orbFormatted: orbFormatted,
      planet1Retro: planet1.dailyMotion < 0,
      planet2Retro: planet2.dailyMotion < 0,
      exactInDays:  exactInDays !== null ? Math.round(exactInDays * 10) / 10 : null
    };
  }

  // ─────────────────────────────────────────
  // 批次計算（多組相位一次處理）
  // ─────────────────────────────────────────

  /**
   * 批次計算多顆行星之間所有相位的出相／入相
   *
   * @param {Array}  planets      - 行星陣列，每個元素需有 name, longitude, dailyMotion
   * @param {Array}  aspectAngles - 相位角度陣列，例：[0, 60, 90, 120, 180]
   * @param {Object} [options]    - 同 calculate() 的 options
   *
   * @returns {Array} 結果陣列，每個元素：
   *   {
   *     planet1:     string,
   *     planet2:     string,
   *     aspectAngle: number,
   *     ...calculate() 的回傳值
   *   }
   */
  function calculateAll(planets, aspectAngles, options) {
    var results = [];
    for (var i = 0; i < planets.length; i++) {
      for (var j = i + 1; j < planets.length; j++) {
        for (var k = 0; k < aspectAngles.length; k++) {
          var res = calculate(planets[i], planets[j], aspectAngles[k], options);
          if (res) {
            results.push({
              planet1:     planets[i].name || ('P' + i),
              planet2:     planets[j].name || ('P' + j),
              aspectAngle: aspectAngles[k],
              direction:    res.direction,
              directionZH:  res.directionZH,
              orb:          res.orb,
              orbFormatted: res.orbFormatted,
              planet1Retro: res.planet1Retro,
              planet2Retro: res.planet2Retro,
              exactInDays:  res.exactInDays
            });
          }
        }
      }
    }
    return results;
  }

  // ─────────────────────────────────────────
  // 對外暴露
  // ─────────────────────────────────────────

  global.AspectDirection = {
    calculate:    calculate,
    calculateAll: calculateAll,
    calcOrb:      calcOrb,
    normalizeDeg: normalizeDeg
  };

})(typeof window !== 'undefined' ? window : this);