/**
 * moon_voc.js — v27
 * ═══════════════════════════════════════════════════════════
 * [OPT-v27] 效能優化
 *
 * 優化項目：
 * 1. planetLon / moonLon 加 LRU 快取（精度 1e-7 JD ≈ 8ms）
 * 2. scanStep 從 0.005 → 0.02（月亮每天 ~13°，0.02天 = 0.26°，不會漏相位）
 * 3. 慢速行星（木土天海冥）用粗網格插值，快速行星正常計算
 * 4. calcAllVoc 每次空亡結束後清快取，避免記憶體膨脹
 *
 * 跟https://mooncalendar.astro-seek.com/void-of-course-moon-astrology-online-calendar比對數據
 * ═══════════════════════════════════════════════════════════
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.MoonVOC = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SE_SUN=0,SE_MOON=1,SE_MERCURY=2,SE_VENUS=3,SE_MARS=4,
      SE_JUPITER=5,SE_SATURN=6,SE_URANUS=7,SE_NEPTUNE=8,SE_PLUTO=9;

  var SIGN_NAMES=['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  var SIGN_NAMES_ZH=['牡羊','金牛','雙子','巨蟹','獅子','處女',
                     '天秤','天蠍','射手','摩羯','水瓶','雙魚'];
  var PLANET_NAMES=['Sun','Moon','Mercury','Venus','Mars',
                    'Jupiter','Saturn','Uranus','Neptune','Pluto'];
  var ASP_NAMES={1:'Conjunction(0°)',2:'Opposition(180°)',3:'Square(90°)',
                 4:'Trine(120°)',5:'Sextile(60°)',0:'None'};

  var CONV_THRESHOLD_INGR=1e-6, MAX_ITER=60, toR=Math.PI/180;
  var BOUNDARY_ORB=1.0, BOUNDARY_EXTEND=0.15;
  var VOC_END_EPSILON = 1.0 / 1440.0;

  var IPL_TO_BODYKEY=[
    'sun','moon','mercury','venus','mars',
    'jupiter','saturn','uranus','neptune','pluto'
  ];

  // ══════════════════════════════════════════════
  // ★ [OPT-v27] LRU 快取
  // ══════════════════════════════════════════════
  var CACHE_SIZE = 2048;
  var _moonCache = Object.create(null);
  var _moonCacheKeys = [];
  var _planetCache = Object.create(null); // key = ipl+'_'+jdKey
  var _planetCacheKeys = [];

  function jdCacheKey(jd){ return Math.round(jd * 1e7); }

  function moonLon_cached(jd){
    var k = jdCacheKey(jd);
    if(_moonCache[k] !== undefined) return _moonCache[k];
    var v = moonLon_raw(jd);
    _moonCache[k] = v;
    _moonCacheKeys.push(k);
    if(_moonCacheKeys.length > CACHE_SIZE){
      delete _moonCache[_moonCacheKeys.shift()];
    }
    return v;
  }

  function planetLon_cached(jd, ipl){
    var k = ipl + '_' + jdCacheKey(jd);
    if(_planetCache[k] !== undefined) return _planetCache[k];
    var v = planetLon_raw(jd, ipl);
    _planetCache[k] = v;
    _planetCacheKeys.push(k);
    if(_planetCacheKeys.length > CACHE_SIZE * 4){
      delete _planetCache[_planetCacheKeys.shift()];
    }
    return v;
  }

  function clearCache(){
    _moonCache = Object.create(null);
    _moonCacheKeys = [];
    _planetCache = Object.create(null);
    _planetCacheKeys = [];
  }

  // ══════════════════════════════════════════════
  // ★ [OPT-v27] 慢速行星插值快取
  // 木土天海冥每 0.5天 算一次，中間線性插值
  // ══════════════════════════════════════════════
  var SLOW_PLANETS = [SE_JUPITER, SE_SATURN, SE_URANUS, SE_NEPTUNE, SE_PLUTO];
  var SLOW_STEP = 0.5; // 天
  var _slowCache = Object.create(null); // key = ipl+'_'+gridIdx

  function isSlowPlanet(ipl){ return SLOW_PLANETS.indexOf(ipl) >= 0; }

  function planetLon_slow_interp(jd, ipl){
    var idx = Math.floor(jd / SLOW_STEP);
    var t0 = idx * SLOW_STEP;
    var t1 = t0 + SLOW_STEP;
    var k0 = ipl + '_' + idx;
    var k1 = ipl + '_' + (idx + 1);
    if(_slowCache[k0] === undefined) _slowCache[k0] = planetLon_raw(t0, ipl);
    if(_slowCache[k1] === undefined) _slowCache[k1] = planetLon_raw(t1, ipl);
    var lon0 = _slowCache[k0], lon1 = _slowCache[k1];
    // 處理跨 0/360 邊界
    var diff = lon1 - lon0;
    if(diff > 180) diff -= 360;
    if(diff < -180) diff += 360;
    var frac = (jd - t0) / SLOW_STEP;
    return degnorm(lon0 + diff * frac);
  }

  function clearSlowCache(){
    _slowCache = Object.create(null);
  }

  // ══════════════════════════════════════════════
  // 月亮位置（原始計算）
  // ══════════════════════════════════════════════
  function moonLon_raw(jd){
    if(typeof Astronomy!=='undefined'){
      try{
        var at=Astronomy.MakeTime(jdToDate(jd));
        var gv=Astronomy.GeoVector(Astronomy.Body.Moon,at,true);
        var lon=degnorm(Astronomy.Ecliptic(gv).elon);
        if(!isNaN(lon))return lon;
      }catch(e){}
    }
    return moonLon_approx(jd);
  }

  function moonLon_approx(jd){
    var T=julianCentury(jd),T2=T*T,T3=T2*T,T4=T3*T;
    var L0=degnorm(218.3164477+481267.88123421*T-0.0015786*T2+T3/538841-T4/65194000);
    var Mm=degnorm(134.9633964+477198.8675055*T+0.0087414*T2+T3/69699-T4/14712000);
    var Ms=degnorm(357.5291092+35999.0502909*T-0.0001536*T2+T3/24490000);
    var F=degnorm(93.2720950+483202.0175233*T-0.0036539*T2-T3/3526000+T4/863310000);
    var D=degnorm(297.8501921+445267.1114034*T-0.0018819*T2+T3/545868-T4/113065000);
    return degnorm(L0
      +6.288774*Math.sin(Mm*toR)+1.274027*Math.sin((2*D-Mm)*toR)
      +0.658314*Math.sin(2*D*toR)+0.213618*Math.sin(2*Mm*toR)
      -0.185116*Math.sin(Ms*toR)-0.114332*Math.sin(2*F*toR)
      +0.058793*Math.sin((2*D-2*Mm)*toR)+0.057066*Math.sin((2*D-Ms-Mm)*toR)
      +0.053322*Math.sin((2*D+Mm)*toR)+0.045758*Math.sin((2*D-Ms)*toR)
      -0.040923*Math.sin((Ms-Mm)*toR)-0.034720*Math.sin(D*toR)
      -0.030383*Math.sin((Ms+Mm)*toR)+0.015327*Math.sin((2*D-2*F)*toR)
      -0.012528*Math.sin((Mm+2*F)*toR)+0.010980*Math.sin((Mm-2*F)*toR)
      +0.010675*Math.sin((4*D-Mm)*toR)+0.010034*Math.sin(3*Mm*toR)
      +0.008548*Math.sin((4*D-2*Mm)*toR)-0.007888*Math.sin((2*D+Ms-Mm)*toR)
      -0.006766*Math.sin((2*D+Ms)*toR)-0.005163*Math.sin((Mm-D)*toR)
      +0.004987*Math.sin((Ms+D)*toR)+0.004036*Math.sin((2*D-Ms+Mm)*toR)
      +0.003994*Math.sin((2*Mm+2*D)*toR)+0.003861*Math.sin(4*D*toR)
      +0.003665*Math.sin((2*D-3*Mm)*toR)-0.002689*Math.sin((Ms-2*Mm)*toR)
      -0.002602*Math.sin((Mm-2*F+2*D)*toR)+0.002390*Math.sin((2*D-Ms-2*Mm)*toR)
      -0.002348*Math.sin((Mm+D)*toR)+0.002236*Math.sin((2*D-2*Ms)*toR)
      -0.002120*Math.sin((Ms+2*Mm)*toR)-0.002069*Math.sin(2*Ms*toR)
      +0.002048*Math.sin((2*D-2*Ms-Mm)*toR)-0.001773*Math.sin((Mm+2*D-2*F)*toR)
      -0.001595*Math.sin((2*F+2*D)*toR)+0.001215*Math.sin((4*D-Ms-Mm)*toR)
      -0.001110*Math.sin((2*Mm+2*F)*toR)-0.000892*Math.sin((3*D-Mm)*toR)
      -0.000810*Math.sin((Ms+Mm+2*D)*toR)+0.000759*Math.sin((4*D-Ms-2*Mm)*toR)
      -0.000713*Math.sin((2*Ms-Mm)*toR)-0.000700*Math.sin((2*D+2*Ms-Mm)*toR)
      +0.000691*Math.sin((2*D+Ms-2*Mm)*toR)+0.000596*Math.sin((2*D-Ms-2*F)*toR)
      +0.000549*Math.sin((4*D+Mm)*toR)+0.000537*Math.sin(4*Mm*toR)
      +0.000520*Math.sin((4*D-Ms)*toR)-0.000487*Math.sin((Mm-2*D)*toR));
  }

  function moonPosition(jd){
    var lon=moonLon_cached(jd),dt=0.001;
    var spd=(moonLon_cached(jd+dt)-lon)/dt;
    if(spd<-300)spd+=360/dt;if(spd>300)spd-=360/dt;
    return{lon:lon,speed:spd};
  }

  // ══════════════════════════════════════════════
  // 行星位置（原始計算）
  // ══════════════════════════════════════════════
  function getAstroTime(jd){
    if(typeof Astronomy==='undefined')return null;
    try{return Astronomy.MakeTime(jdToDate(jd));}catch(e){return null;}
  }

  function planetLon_raw(jd,ipl){
    if(ipl===SE_MOON)return moonLon_raw(jd);
    var bk=IPL_TO_BODYKEY[ipl];
    if(typeof AstroUtil!=='undefined'&&AstroUtil.getBodyTropicalLon){
      try{
        var at=getAstroTime(jd);
        if(at){var l=AstroUtil.getBodyTropicalLon(bk,at);if(typeof l==='number'&&!isNaN(l))return degnorm(l);}
      }catch(e){}
    }
    if(typeof Astronomy!=='undefined'){
      try{
        var at2=getAstroTime(jd);if(at2){
          var l2=null;
          if(ipl===SE_SUN){l2=Astronomy.SunPosition(at2).elon;}
          else{
            var bn=bk.charAt(0).toUpperCase()+bk.slice(1);
            var gv=Astronomy.GeoVector(Astronomy.Body[bn],at2,true);
            l2=Astronomy.Ecliptic(gv).elon;
          }
          if(l2!==null&&!isNaN(l2))return degnorm(l2);
        }
      }catch(e){}
    }
    return planetLon_fallback(jd,ipl);
  }

  // 公開的 planetLon（加快取 + 慢速行星插值）
  function planetLon(jd,ipl){
    if(ipl===SE_MOON) return moonLon_cached(jd);
    if(isSlowPlanet(ipl)) return planetLon_slow_interp(jd, ipl);
    return planetLon_cached(jd, ipl);
  }

  // 公開的 moonLon
  function moonLon(jd){ return moonLon_cached(jd); }

  function planetLon_fallback(jd,ipl){
    var T=julianCentury(jd),T2=T*T;
    switch(ipl){
      case SE_SUN:{var L0=degnorm(280.46646+36000.76983*T+0.0003032*T2),Ms=degnorm(357.52911+35999.05029*T-0.0001537*T2);return degnorm(L0+(1.914602-0.004817*T-0.000014*T2)*Math.sin(Ms*toR)+(0.019993-0.000101*T)*Math.sin(2*Ms*toR)+0.000289*Math.sin(3*Ms*toR));}
      case SE_MERCURY:{var L=degnorm(252.2509+149474.0715*T),M=degnorm(174.7948+149472.5153*T);return degnorm(L+23.44*Math.sin(M*toR)+2.9818*Math.sin(2*M*toR)+0.5255*Math.sin(3*M*toR)+0.1058*Math.sin(4*M*toR)+0.0219*Math.sin(5*M*toR)+0.0046*Math.sin(6*M*toR));}
      case SE_VENUS:{var L=degnorm(181.9798+58519.2125*T),M=degnorm(212.2606+58517.8039*T);return degnorm(L+0.7758*Math.sin(M*toR)+0.0033*Math.sin(2*M*toR)+0.0007*Math.sin(3*M*toR));}
      case SE_MARS:{var L=degnorm(355.4333+19141.6962*T),M=degnorm(19.373+19140.3023*T);return degnorm(L+10.6912*Math.sin(M*toR)+0.6228*Math.sin(2*M*toR)+0.0503*Math.sin(3*M*toR)+0.0046*Math.sin(4*M*toR)+0.0005*Math.sin(5*M*toR));}
      case SE_JUPITER:{var L=degnorm(34.3515+3036.3026*T-0.00008501*T2),Mj=degnorm(20.9366+3034.9057*T),Msat=degnorm(317.0207+1222.1138*T);return degnorm(L+5.5549*Math.sin(Mj*toR)+0.1683*Math.sin(2*Mj*toR)+0.0071*Math.sin(3*Mj*toR)+0.0003*Math.sin(4*Mj*toR)-0.03*Math.sin((2*Mj-5*Msat-67.6)*toR)+0.0082*Math.sin((2*Mj-2*Msat)*toR)-0.0045*Math.sin((3*Mj-5*Msat)*toR)+0.002*Math.sin((2*Mj-6*Msat-33.4)*toR)-0.0019*Math.sin((2*Mj-4*Msat-119.9)*toR)+0.0014*Math.sin((2*Mj-6*Msat-3.2)*toR)+0.0014*Math.sin((3*Mj-4*Msat)*toR)-0.0013*Math.sin((2*Mj-5*Msat+31.2)*toR)-0.001*Math.sin((3*Mj-4*Msat+6.1)*toR)+0.001*Math.sin((2*Mj-2*Msat+2)*toR));}
      case SE_SATURN:{var L=degnorm(50.0775+1223.5107*T+0.00021004*T2),Msat=degnorm(317.0207+1222.1138*T),Mj=degnorm(20.9366+3034.9057*T);return degnorm(L+6.3585*Math.sin(Msat*toR)+0.2204*Math.sin(2*Msat*toR)+0.0106*Math.sin(3*Msat*toR)+0.0006*Math.sin(4*Msat*toR)+0.0317*Math.sin((2*Mj-2*Msat-83.1)*toR)+0.0117*Math.sin((2*Mj-4*Msat-117.2)*toR)-0.0049*Math.sin((2*Mj-6*Msat-33.4)*toR)+0.0024*Math.sin((2*Mj-2*Msat+2)*toR)-0.0019*Math.sin((2*Mj-4*Msat-119.9)*toR)+0.0018*Math.sin((2*Mj-6*Msat-3.2)*toR));}
      case SE_URANUS:{var L=degnorm(314.055+429.8581*T+0.0003039*T2),Mu=degnorm(142.5905+428.4612*T),Ms2=degnorm(317.0207+1222.1138*T),Mj2=degnorm(20.9366+3034.9057*T);return degnorm(L+5.3042*Math.sin(Mu*toR)+0.1534*Math.sin(2*Mu*toR)+0.0062*Math.sin(3*Mu*toR)+0.5904*Math.sin((Ms2-Mu+185.845)*toR)+0.128*Math.sin((2*Ms2-2*Mu+52.9)*toR)+0.029*Math.sin((Mj2-Mu)*toR)-0.0484*Math.sin((Ms2-2*Mu)*toR)+0.046*Math.sin((2*Ms2-3*Mu+188)*toR)-0.02*Math.sin((Ms2-3*Mu)*toR));}
      case SE_NEPTUNE:{var L=degnorm(304.3487+219.8831*T+0.00030882*T2),Mn=degnorm(267.7649+218.4862*T),Mu2=degnorm(142.5905+428.4612*T);return degnorm(L+1.0169*Math.sin(Mn*toR)+0.0139*Math.sin(2*Mn*toR)+0.3722*Math.sin((Mu2-Mn+2.1)*toR)+0.0466*Math.sin((2*Mu2-2*Mn+57.7)*toR)+0.0172*Math.sin((3*Mu2-3*Mn+58.8)*toR)-0.01*Math.sin((Mu2-2*Mn)*toR));}
      case SE_PLUTO:{var P=degnorm(238.96+144.96*T),S=degnorm(50.08+1222.1138*T);return degnorm(238.9508+144.96*T-19.799*Math.sin(P*toR)+19.848*Math.cos(P*toR)+0.897*Math.sin(2*P*toR)-4.956*Math.cos(2*P*toR)+0.61*Math.sin(3*P*toR)+1.211*Math.cos(3*P*toR)-0.341*Math.sin(4*P*toR)-0.19*Math.cos(4*P*toR)+0.128*Math.sin(5*P*toR)-0.034*Math.cos(5*P*toR)-0.038*Math.sin(6*P*toR)+0.031*Math.cos(6*P*toR)+0.02*Math.sin((S-P)*toR)-0.01*Math.cos((S-P)*toR));}
      default:return 0;
    }
  }

  function planetPosition(jd,ipl){
    if(ipl===SE_MOON)return moonPosition(jd);
    var lon=planetLon(jd,ipl),dt=0.01,lon2=planetLon(jd+dt,ipl),spd=(lon2-lon)/dt;
    if(spd<-180/dt)spd+=360/dt;if(spd>180/dt)spd-=360/dt;
    return{lon:lon,speed:spd};
  }

  function getCasp(d){
    if(d===0)return 1;if(d===180)return 2;
    if(d===90)return 3;if(d===120)return 4;if(d===60)return 5;return 0;
  }
  function dateToJD(date){
    var Y=date.getUTCFullYear(),M=date.getUTCMonth()+1;
    var D=date.getUTCDate()+date.getUTCHours()/24+date.getUTCMinutes()/1440
          +date.getUTCSeconds()/86400+date.getUTCMilliseconds()/86400000;
    if(M<=2){Y--;M+=12;}
    var A=Math.floor(Y/100),B=2-A+Math.floor(A/4);
    return Math.floor(365.25*(Y+4716))+Math.floor(30.6001*(M+1))+D+B-1524.5;
  }
  function jdToDate(jd){
    var z=Math.floor(jd+0.5),f=(jd+0.5)-z,A;
    if(z<2299161){A=z;}else{var al=Math.floor((z-1867216.25)/36524.25);A=z+1+al-Math.floor(al/4);}
    var B=A+1524,C=Math.floor((B-122.1)/365.25),D=Math.floor(365.25*C),E=Math.floor((B-D)/30.6001);
    var day=B-D-Math.floor(30.6001*E),month=(E<14)?E-1:E-13,year=(month>2)?C-4716:C-4715;
    var hrs=f*24,h=Math.floor(hrs),mi=Math.floor((hrs-h)*60),
        s=Math.floor(((hrs-h)*60-mi)*60),ms=Math.round((((hrs-h)*60-mi)*60-s)*1000);
    return new Date(Date.UTC(year,month-1,day,h,mi,s,ms));
  }
  function jdToComponents(jd){
    var d=jdToDate(jd);
    return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),
           hour:d.getUTCHours(),min:d.getUTCMinutes(),sec:d.getUTCSeconds()};
  }
  function julianCentury(jd){return(jd-2451545.0)/36525.0;}
  function degnorm(d){d=d%360;if(d<0)d+=360;return d;}
  function difdeg2n(a,b){var d=degnorm(a-b);if(d>180)d-=360;return d;}

  var MAJOR_ASPS=[0,60,90,120,180];

  // ══════════════════════════════════════════════
  // isValidMoonSign（v25）
  // ══════════════════════════════════════════════
  function isValidMoonSign(moonLonVal, ingressSign){
    var moonSign = Math.floor(moonLonVal / 30.0);
    var prevSign = (ingressSign + 11) % 12;
    return (moonSign === prevSign);
  }

  // ══════════════════════════════════════════════
  // 動態相位計算
  // ★ [OPT-v27] scanStep 依行星速度自動調整
  // ══════════════════════════════════════════════
  function getScanStep(ipl){
    // 月亮每天 ~13°，相位間距最小 60°，最多 4.6天
    // 掃描步長 = 最小相位間距 / 4，確保不漏
    switch(ipl){
      case SE_SUN:     return 0.03;  // 太陽慢，月亮相對快
      case SE_MERCURY: return 0.02;
      case SE_VENUS:   return 0.02;
      case SE_MARS:    return 0.02;
      default:         return 0.04;  // 慢速行星，月亮相對速度更穩定
    }
  }

  function getSignedTargets(aspAngle){
    if(aspAngle===0)   return [0];
    if(aspAngle===180) return [180];
    return [aspAngle, -aspAngle];
  }

  function aspResidualSigned(t,ipl,signedTarget){
    return difdeg2n(moonLon(t),planetLon(t,ipl))-signedTarget;
  }

  function aspResidual180(t,ipl){
    var diff=difdeg2n(moonLon(t),planetLon(t,ipl));
    return diff>=0?diff-180:diff+180;
  }

  function calcAspectTime_dynamic(ipl,aspAngle,tLow,tHigh,ingressSign){
    var results=[];
    var scanStep = getScanStep(ipl);
    var signedTargets=getSignedTargets(aspAngle);

    for(var si=0;si<signedTargets.length;si++){
      var st=signedTargets[si];
      var tCurr=tLow;
      var fCurr=(aspAngle===180)?aspResidual180(tCurr,ipl):aspResidualSigned(tCurr,ipl,st);

      while(tCurr<tHigh){
        var tNext=Math.min(tCurr+scanStep,tHigh);
        var fNext=(aspAngle===180)?aspResidual180(tNext,ipl):aspResidualSigned(tNext,ipl,st);

        if(fCurr*fNext<0){
          var ta=tCurr,tb=tNext,fa=fCurr;
          for(var i=0;i<MAX_ITER;i++){
            var tc=(ta+tb)/2;
            var fc=(aspAngle===180)?aspResidual180(tc,ipl):aspResidualSigned(tc,ipl,st);
            if(fa*fc<=0){tb=tc;}else{ta=tc;fa=fc;}
            if(tb-ta<1e-8)break;
          }
          var tFound=(ta+tb)/2;

          var diffCheck=difdeg2n(moonLon(tFound),planetLon(tFound,ipl));
          var isValid=false;
          if(aspAngle===0)        isValid=Math.abs(diffCheck)<0.05;
          else if(aspAngle===180) isValid=Math.abs(Math.abs(diffCheck)-180)<0.05;
          else                    isValid=Math.abs(diffCheck-st)<0.05;

          if(isValid){
            var pass=true;
            if(typeof ingressSign==='number'){
              pass=isValidMoonSign(moonLon(tFound),ingressSign);
            }
            if(pass)results.push(tFound);
          }
        }
        tCurr=tNext;fCurr=fNext;
      }
    }

    results.sort(function(a,b){return a-b;});
    var deduped=[];
    for(var k=0;k<results.length;k++){
      if(deduped.length===0||results[k]-deduped[deduped.length-1]>0.001)
        deduped.push(results[k]);
    }
    return deduped;
  }

  // ══════════════════════════════════════════════
  // checkBoundaryAtIngress（v26 修正保留）
  // ══════════════════════════════════════════════
  function checkBoundaryAtIngress(tvoc_end, ipl, ingressSign){
    var mlon=moonLon(tvoc_end),plon=planetLon(tvoc_end,ipl);

    if(typeof ingressSign==='number'){
      var moonSignAtIngr = Math.floor(mlon / 30.0);
      if(moonSignAtIngr === ingressSign) return null;
    }

    var diff=difdeg2n(mlon,plon);
    var bestAsp=0,bestRes=999;
    for(var ai=0;ai<MAJOR_ASPS.length;ai++){
      var asp=MAJOR_ASPS[ai],res;
      if(asp===0)        res=Math.abs(diff);
      else if(asp===180) res=Math.abs(Math.abs(diff)-180);
      else               res=Math.min(Math.abs(diff-asp),Math.abs(diff+asp));
      if(res<bestRes){bestRes=res;bestAsp=asp;}
    }
    if(bestRes>BOUNDARY_ORB)return null;

    var tSearch=0.2;
    var times=calcAspectTime_dynamic(ipl,bestAsp,tvoc_end-tSearch,tvoc_end+BOUNDARY_EXTEND,ingressSign);
    if(times.length===0)return null;
    var tExact=times[0];
    for(var k=1;k<times.length;k++)
      if(Math.abs(times[k]-tvoc_end)<Math.abs(tExact-tvoc_end))tExact=times[k];
    if(tExact>tvoc_end+1e-6)tExact=tvoc_end;
    return{tret:tExact,dasp:Math.round(bestAsp),
           isign:Math.floor(moonLon(tExact)/30.0),isBoundary:true};
  }

  // ══════════════════════════════════════════════
  // getPrevLunasp
  // ══════════════════════════════════════════════
  function getPrevLunasp(tvoc_end,ipl,tPrevIngr,ingressSign){
    if(typeof ingressSign==='undefined'||ingressSign===null){
      ingressSign=Math.floor(moonLon(tvoc_end+0.001)/30.0);
    }

    var tSearchHigh = tvoc_end - VOC_END_EPSILON;

    var bestT=-1,bestAsp=0;
    for(var ai=0;ai<MAJOR_ASPS.length;ai++){
      var aspAngle=MAJOR_ASPS[ai];
      var times=calcAspectTime_dynamic(ipl,aspAngle,tPrevIngr,tSearchHigh,ingressSign);
      for(var k=0;k<times.length;k++){
        var t=times[k];
        if(t<tPrevIngr||t>tSearchHigh)continue;
        if(t>bestT){bestT=t;bestAsp=aspAngle;}
      }
    }

    if(bestT>0){
      return{tret:bestT,dasp:Math.round(bestAsp),
             isign:Math.floor(moonLon(bestT)/30.0),isBoundary:false};
    }

    var boundaryResult=checkBoundaryAtIngress(tvoc_end,ipl,ingressSign);
    if(boundaryResult)return boundaryResult;
    return{tret:-1,dasp:0,isign:-1,isBoundary:false};
  }

  // ══════════════════════════════════════════════
  // getSignIngressDirectBody
  // ══════════════════════════════════════════════
  function getSignIngressDirectBody(tet0,ipl,backward){
    var xx=planetPosition(tet0,ipl),isign=Math.floor(xx.lon/30.0);
    if(!backward){
      isign=(isign+1)%12;
      var xingr=isign*30.0,dx=difdeg2n(xingr,xx.lon),t=tet0,mspeed=xx.speed,iter=0;
      if(ipl===SE_MOON&&Math.abs(mspeed)<0.1)mspeed=13.0;
      if(Math.abs(mspeed)<0.001)mspeed=1.0;
      while(Math.abs(dx)>CONV_THRESHOLD_INGR&&iter<MAX_ITER){
        t+=dx/mspeed;
        var xx2=planetPosition(t,ipl);dx=difdeg2n(xingr,xx2.lon);mspeed=xx2.speed;
        if(ipl===SE_MOON&&Math.abs(mspeed)<0.1)mspeed=13.0;
        if(Math.abs(mspeed)<0.001)mspeed=1.0;iter++;
      }
      return{tret:t,isign:isign};
    }else{
      var xingr=isign*30.0,deg_in_sign=degnorm(xx.lon-xingr),mspeed0=xx.speed,iter=0,dx=1;
      if(ipl===SE_MOON&&Math.abs(mspeed0)<0.1)mspeed0=13.0;
      if(Math.abs(mspeed0)<0.001)mspeed0=1.0;
      var t=tet0-Math.max(deg_in_sign/mspeed0,0.05)-0.02;
      while(Math.abs(dx)>CONV_THRESHOLD_INGR&&iter<MAX_ITER){
        var xx3=planetPosition(t,ipl);dx=difdeg2n(xingr,xx3.lon);var sp=xx3.speed;
        if(ipl===SE_MOON&&Math.abs(sp)<0.1)sp=13.0;
        if(Math.abs(sp)<0.001)sp=1.0;
        var dt_step=dx/sp;
        if(t+dt_step>=tet0)dt_step=-(tet0-t)*0.5;
        t+=dt_step;iter++;
      }
      if(t>=tet0){
        t=tet0-0.05;var step=0.1,prev_lon=planetLon(t,ipl),found=false;
        for(var i=0;i<400&&!found;i++){
          t-=step;var curr_lon=planetLon(t,ipl);
          var d1=difdeg2n(xingr,prev_lon),d2=difdeg2n(xingr,curr_lon);
          if(d1<=0&&d2>0){
            var ta=t,tb=t+step;
            for(var j=0;j<MAX_ITER;j++){
              var tc=(ta+tb)/2,dc=difdeg2n(xingr,planetLon(tc,ipl));
              if(dc>0)tb=tc;else ta=tc;if(tb-ta<1e-8)break;
            }
            t=(ta+tb)/2;found=true;
          }
          prev_lon=curr_lon;
        }
      }
      return{tret:t,isign:isign};
    }
  }

  // ══════════════════════════════════════════════
  // getNextVoc
  // ══════════════════════════════════════════════
  function getNextVoc(tet0,vocmethod,tPrevIngrOverride){
    if(!vocmethod||vocmethod===0)vocmethod=3;
    var ingr1=getSignIngressDirectBody(tet0,SE_MOON,false);
    var isign_save=ingr1.isign,tingr_save=ingr1.tret;
    var tvoc_end=ingr1.tret,tret1=ingr1.tret,isign_ingr=ingr1.isign;
    var tPrevIngr;
    if(typeof tPrevIngrOverride==='number'&&tPrevIngrOverride>0){
      tPrevIngr=tPrevIngrOverride;
    }else{
      tPrevIngr=getSignIngressDirectBody(tet0,SE_MOON,true).tret;
    }
    if(tPrevIngr>=tvoc_end)tPrevIngr=tvoc_end-2.5;
    if(tPrevIngr<tvoc_end-30)tPrevIngr=tvoc_end-30;

    var ingressSign=isign_ingr;

    var tret0=0.0,dasp=0.0,ipllast=SE_SUN,isign_last=0,
        isBoundaryResult=false,repeat=true;
    while(repeat){
      repeat=false;tret0=0.0;isBoundaryResult=false;
      for(var ipl=SE_SUN;ipl<=SE_PLUTO;ipl++){
        if(ipl===SE_MOON)continue;
        var lunasp=getPrevLunasp(tvoc_end,ipl,tPrevIngr,ingressSign);
        if(lunasp.tret<0)continue;
        if(vocmethod===1&&lunasp.tret>tret1){
          tvoc_end=tret1;isign_ingr--;if(isign_ingr<0)isign_ingr=11;
          ingressSign=isign_ingr;
          repeat=true;break;
        }
        if(lunasp.tret>tret0){
          tret0=lunasp.tret;dasp=lunasp.dasp;ipllast=ipl;
          isign_last=lunasp.isign;isBoundaryResult=lunasp.isBoundary||false;
        }
      }
    }
    if(tret0===0.0){
      tret0=tPrevIngr;dasp=0;ipllast=SE_SUN;
      isign_last=(ingressSign+11)%12;isBoundaryResult=false;
    }
    if(tret0>tvoc_end)tret0=tvoc_end;
    if(vocmethod===3&&tret0<tPrevIngr)tret0=tPrevIngr;
    var result={tvoc:tret0,tingr:tvoc_end,tingr0:0,casp:getCasp(dasp),
                cpl:ipllast,isign_voc:isign_last,isign_ingr:isign_ingr,
                isign_ingr0:0,isBoundary:isBoundaryResult};
    if(isign_save===isign_ingr){result.tingr0=0;result.isign_ingr0=0;}
    else{result.tingr0=tingr_save;result.isign_ingr0=isign_save;}
    return result;
  }

  // ══════════════════════════════════════════════
  // calcAllVoc
  // ★ [OPT-v27] 每次空亡後清快取，避免記憶體膨脹
  // ══════════════════════════════════════════════
  function calcAllVoc(startDate,days,vocmethod){
    days=days||30;vocmethod=vocmethod||3;
    var te=dateToJD(startDate),tend=te+days;
    var curPrevIngr=getSignIngressDirectBody(te,SE_MOON,true);
    var t=curPrevIngr.tret+0.001;
    var results=[],safety=0;
    clearCache();
    clearSlowCache();
    while(t<tend&&safety<500){
      safety++;
      var curPI=getSignIngressDirectBody(t,SE_MOON,true);
      var dvoc=getNextVoc(t,vocmethod,curPI.tret);
      if(dvoc.tingr<=t+1e-6){t+=0.02;continue;}
      if(dvoc.tvoc<=dvoc.tingr+1e-6){
        var dup=false;
        for(var k=0;k<results.length;k++){
          if(Math.abs(results[k].tingr-dvoc.tingr)<0.001){dup=true;break;}
        }
        if(!dup)results.push(dvoc);
      }
      if(dvoc.tvoc>tend)break;
      t=dvoc.tingr+0.02;
      // 每筆空亡後清快取（保留慢速行星插值）
      clearCache();
    }
    return results;
  }

  function formatVoc(dvoc,lang){
    var zh=(lang==='zh'),signs=zh?SIGN_NAMES_ZH:SIGN_NAMES;
    function p2(n){return n<10?'0'+n:''+n;}
    function fmtJD(jd){
      var c=jdToComponents(jd);
      return c.year+'/'+p2(c.month)+'/'+p2(c.day)+' '+p2(c.hour)+':'+p2(c.min)+' UT';
    }
    var aspName=ASP_NAMES[dvoc.casp]||'Unknown';
    var plName=PLANET_NAMES[dvoc.cpl]||('Planet'+dvoc.cpl);
    var signVoc=signs[dvoc.isign_voc]||('Sign'+dvoc.isign_voc);
    var signIngr=signs[dvoc.isign_ingr]||('Sign'+dvoc.isign_ingr);
    var lines=[];
    if(zh){
      lines.push('【空亡開始】'+fmtJD(dvoc.tvoc)+'  星座：'+signVoc+'  觸發：'+plName+' '+aspName);
      lines.push('【空亡結束】'+fmtJD(dvoc.tingr)+'  入座：'+signIngr);
      if(dvoc.tingr0){var s0=signs[dvoc.isign_ingr0]||'';lines.push('【中途入座】'+fmtJD(dvoc.tingr0)+'  入座：'+s0);}
    }else{
      lines.push('VOC BEGIN: '+fmtJD(dvoc.tvoc)+'  sign='+signVoc+'  trigger='+plName+' '+aspName);
      lines.push('VOC END:   '+fmtJD(dvoc.tingr)+'  ingress='+signIngr);
      if(dvoc.tingr0){var s0=signs[dvoc.isign_ingr0]||'';lines.push('           (interim: '+fmtJD(dvoc.tingr0)+'  sign='+s0+')');}
    }
    return lines.join('\n');
  }

  function checkDependencies(){
    var lines=[];
    if(typeof Astronomy==='undefined'){lines.push('❌ Astronomy Engine 未載入');}
    else{
      try{
        var t=Astronomy.MakeTime(new Date(Date.UTC(2026,3,2,9,0,0)));
        var gv=Astronomy.GeoVector(Astronomy.Body.Jupiter,t,true);
        lines.push('✅ Astronomy Engine 正常  木星: '+degnorm(Astronomy.Ecliptic(gv).elon).toFixed(4)+'°');
      }catch(e){lines.push('❌ Astronomy Engine 失敗: '+e.message);}
    }
    return lines.join('\n');
  }

  return{
    calcAllVoc,getNextVoc,getPrevLunasp,getSignIngressDirectBody,
    getCasp,planetPosition,planetLon,moonPosition,moonLon,
    dateToJD,jdToDate,jdToComponents,degnorm,difdeg2n,
    formatVoc,checkDependencies,isValidMoonSign,clearCache,clearSlowCache,
    SIGN_NAMES,SIGN_NAMES_ZH,PLANET_NAMES,ASP_NAMES,
    SE_SUN,SE_MOON,SE_MERCURY,SE_VENUS,SE_MARS,
    SE_JUPITER,SE_SATURN,SE_URANUS,SE_NEPTUNE,SE_PLUTO
  };
}));