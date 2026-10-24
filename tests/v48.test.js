import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('검색/일정 편집과 동선 결과 화면은 모바일 두 탭으로 분리',async()=>{
 const [h,css,ux]=await Promise.all(['public/index.html','public/static/tabs-v48.css','public/static/mobile-ux.js'].map(read));
 assert.match(h,/data-view="edit"/);assert.match(h,/data-view="map"/);
 assert.match(css,/body\[data-mobile-view="edit"\] \.workspace \.result-section\{display:none!important\}/);
 assert.match(css,/body\[data-mobile-view="map"\] \.workspace \.editor\{display:none!important\}/);
 assert.match(ux,/document\.body\.dataset\.mobileView=activeView/);
 assert.match(ux,/app\.refreshMap\?\.\(\)/);
});
test('한 개 지도 인스턴스를 유지하며 편집 지도에는 계산 폴리라인을 숨김',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/routePanelVisible/);assert.match(app,/if\(!collecting&&routePanelVisible&&r\?\.entries\)/);
 assert.match(app,/refreshMap:renderMap/);
 assert.match(app,/if\(map\|\|!sdkReady/);assert.match(app,/mapCreateCount\+\+/);
 assert.match(app,/if\(previewSelected\)previewPlace\(previewSelected\)/);
});
test('방문지 검색은 하단 고정, 결과는 세로로 여러 개, 위치 자동 미리보기',async()=>{
 const [h,css,q]=await Promise.all(['public/index.html','public/static/tabs-v48.css','public/static/quick-add.js'].map(read));
 assert.ok(h.indexOf('id="mobile-bottom-actions"')<h.indexOf('id="quick-form"'));
 assert.equal((h.match(/id="quick-results"/g)||[]).length,1);
 assert.match(css,/\.mobile-bottom-actions\{display:flex!important/);
 assert.match(css,/\.quick-result-row\{display:flex!important;flex-direction:row!important/);
 assert.match(css,/height:51px!important/);assert.match(css,/bottom:calc\(100%/);
 assert.match(q,/app\.previewPlace\(next\[0\]\)/);
 assert.match(q,/app\.previewPlace\(item\)/);
});
test('마커 여백 축소와 저배율 축소',async()=>{
 const [a,c]=await Promise.all(['public/static/app.js','public/static/tabs-v48.css'].map(read));
 assert.match(a,/anchor:new naver\.maps\.Point\(10,10\)/);
 assert.match(c,/width:20px!important/);assert.match(c,/width:15px!important/);
 assert.match(c,/padding:0!important/);assert.match(c,/box-shadow:none!important/);
});
test('네이버 길안내는 도착지 카드가 아니라 장소 사이의 이동 구간에 제공',async()=>{
 const [a,ux,css]=await Promise.all(['public/static/app.js','public/static/mobile-ux.js','public/static/tabs-v48.css'].map(read));
 assert.match(a,/trip-leg-divider/);assert.doesNotMatch(a,/data-navigate-index/);
 assert.match(ux,/function navigateTimeline/);
 assert.doesNotMatch(ux,/function navigateStop/);
 assert.match(css,/\.trip-leg-divider \.timeline-nav/);
 assert.match(css,/min-height:30px!important/);assert.match(css,/min-height:36px!important/);
});
