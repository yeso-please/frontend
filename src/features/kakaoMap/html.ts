import type { MapMessage, MapRenderPayload } from "./types";

// 카카오맵 JS SDK를 띄우는 작은 웹 페이지. 원격 스크립트는 카카오 SDK 하나뿐이고,
// RN에서 받은 이름·번호는 모두 textContent로만 그려 HTML로 해석되지 않게 합니다.

/** 카카오 JavaScript 키는 영숫자뿐입니다. 다른 글자가 섞이면 빈 값으로 보고 지도를 띄우지 않습니다. */
export function sanitizeAppKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  return /^[A-Za-z0-9]{8,64}$/.test(k) ? k : "";
}

/** 문자열을 injectJavaScript 안에 넣을 JS 문자열 리터럴로 바꿉니다 (</script>·줄 구분자까지 이스케이프). */
export function toJsStringLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** 웹뷰에서 지도를 다시 그리는 스크립트 (마지막 true는 Android injectJavaScript 경고 방지) */
export function toRenderScript(payload: MapRenderPayload): string {
  return `window.__tripinRender && window.__tripinRender(${toJsStringLiteral(JSON.stringify(payload))});true;`;
}

/** 웹뷰가 보낸 문자열을 MapMessage로. 모르는 모양이면 null */
export function parseMapMessage(raw: string): MapMessage | null {
  try {
    const m = JSON.parse(raw) as Partial<MapMessage> & Record<string, unknown>;
    if (m.type === "ready") return { type: "ready" };
    if (m.type === "markerPress" && typeof m.id === "string") return { type: "markerPress", id: m.id };
    if (m.type === "bounds") {
      const nums = [m.minLat, m.minLng, m.maxLat, m.maxLng, m.level];
      if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
      const [minLat, minLng, maxLat, maxLng, level] = nums as number[];
      return { type: "bounds", minLat, minLng, maxLat, maxLng, level };
    }
    if (m.type === "error" && (m.reason === "sdk" || m.reason === "timeout" || m.reason === "render" || m.reason === "init")) return { type: "error", reason: m.reason };
    return null;
  } catch {
    return null;
  }
}

// 피그마 토큰 색 (src/theme/colors.ts와 같은 값)
const CSS = `
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#F5F8F5;}
*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
.mk{display:flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;
font:700 12px/1 -apple-system,Roboto,"Noto Sans KR",sans-serif;box-shadow:0 2px 6px rgba(20,41,28,.22);transition:transform .18s ease;}
.mk-candidate{background:#FFFFFF;border:2px solid #246BEB;color:#246BEB;}
.mk-candidate.sel{background:#246BEB;color:#FFFFFF;transform:scale(1.22);}
.mk-course{background:#19B86A;border:2px solid #FFFFFF;color:#FFFFFF;}
.mk-course.sel{transform:scale(1.22);}
.mk-meal{background:#DDF5E8;border:2px solid #0B6C40;color:#0B6C40;}
.mk-meal.sel{background:#0B6C40;color:#FFFFFF;transform:scale(1.22);}
.mk-origin{min-width:14px;width:14px;height:14px;padding:0;background:#0B6C40;border:3px solid #FFFFFF;}
.mk-current{min-width:30px;width:30px;height:30px;padding:0;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
background:#19B86A;border:2px solid #FFFFFF;}
.mk-current span{width:10px;height:10px;border-radius:5px;background:#FFFFFF;transform:rotate(45deg);font-size:0;}
.mk-place{min-width:20px;width:20px;height:20px;padding:0;background:#FFFFFF;border:2px solid #246BEB;}
.mk-place.sel{background:#246BEB;transform:scale(1.3);}
.mk-placeOff{min-width:16px;width:16px;height:16px;padding:0;background:#E8EDE9;border:2px solid #FFFFFF;opacity:.85;}
.mk-placeOff.sel{background:#768078;transform:scale(1.3);}
`;

const SCRIPT = `
(function(){
  var RN = window.ReactNativeWebView;
  function post(m){ try { if (RN) RN.postMessage(JSON.stringify(m)); } catch (e) {} }
  var map = null, ready = false, failed = false, pending = null, overlays = {}, lines = [];
  var COLORS = { green: '#19B86A', blue: '#246BEB', muted: '#768078' };
  function fail(reason){ if (ready || failed) return; failed = true; post({ type: 'error', reason: reason }); }
  window.__tripinFail = fail;
  var timer = setTimeout(function(){ fail('timeout'); }, 10000);

  function markerEl(m){
    var d = document.createElement('div');
    d.className = 'mk mk-' + m.kind + (m.selected ? ' sel' : '');
    var t = document.createElement('span');
    t.textContent = m.number != null ? String(m.number) : (m.label || '');
    d.appendChild(t);
    d.addEventListener('click', function(ev){ ev.stopPropagation(); post({ type: 'markerPress', id: m.id }); });
    return d;
  }
  function clear(){
    Object.keys(overlays).forEach(function(k){ overlays[k].setMap(null); });
    lines.forEach(function(l){ l.setMap(null); });
    overlays = {}; lines = [];
  }
  function render(p){
    if (!ready) { pending = p; return; }
    clear();
    var bounds = new kakao.maps.LatLngBounds(), count = 0;
    (p.polylines || []).forEach(function(pl){
      var path = (pl.path || []).map(function(pt){ var ll = new kakao.maps.LatLng(pt[0], pt[1]); bounds.extend(ll); count++; return ll; });
      if (path.length < 2) return;
      var line = new kakao.maps.Polyline({ path: path, strokeWeight: 5, strokeColor: COLORS[pl.color] || COLORS.green,
        strokeOpacity: pl.dashed ? 0.7 : 0.9, strokeStyle: pl.dashed ? 'shortdash' : 'solid' });
      line.setMap(map); lines.push(line);
    });
    var focus = null;
    (p.markers || []).forEach(function(m){
      var ll = new kakao.maps.LatLng(m.lat, m.lng);
      bounds.extend(ll); count++;
      var o = new kakao.maps.CustomOverlay({ position: ll, content: markerEl(m), xAnchor: m.kind === 'current' ? 0.15 : 0.5,
        yAnchor: m.kind === 'current' ? 1.05 : 0.5, zIndex: m.selected ? 10 : (m.kind === 'current' ? 6 : 2), clickable: true });
      o.setMap(map); overlays[m.id] = o;
      if (p.focusId && m.id === p.focusId) focus = ll;
    });
    if (p.fit && count > 0) {
      if (count === 1) { map.setLevel(5); map.setCenter(bounds.getSouthWest()); }
      else map.setBounds(bounds, 56, 40, 56, 40);
    } else if (focus) {
      map.panTo(focus);
    }
  }
  window.__tripinRender = function(json){ try { render(JSON.parse(json)); } catch (e) { post({ type: 'error', reason: 'render' }); } };
  window.__tripinInit = function(){
    if (!window.kakao || !kakao.maps) { fail('sdk'); return; }
    kakao.maps.load(function(){
      try {
        map = new kakao.maps.Map(document.getElementById('map'), { center: new kakao.maps.LatLng(36.4, 127.9), level: 12 });
        ready = true; clearTimeout(timer); post({ type: 'ready' });
        // 지도를 움직이고 멈추면 보이는 범위를 알립니다 (관광지 핀을 그 범위만 불러옵니다)
        kakao.maps.event.addListener(map, 'idle', function(){
          var b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
          post({ type: 'bounds', minLat: sw.getLat(), minLng: sw.getLng(), maxLat: ne.getLat(), maxLng: ne.getLng(), level: map.getLevel() });
        });
        if (pending) { var p = pending; pending = null; render(p); }
      } catch (e) { fail('init'); }
    });
  };
})();
`;

/** 지도 페이지 HTML. appKey가 비면 SDK를 부르지 않고 바로 실패를 알립니다. */
export function buildMapHtml(appKey: string): string {
  const key = sanitizeAppKey(appKey);
  const sdk = key
    ? `<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false" onload="__tripinInit()" onerror="__tripinFail('sdk')"></script>`
    : `<script>__tripinFail('sdk')</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>${CSS}</style></head><body><div id="map"></div><script>${SCRIPT}</script>${sdk}</body></html>`;
}
