import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('v5.3 onboarding is first and can reselect a region without deleting stops',async()=>{
 const [html,ui,app,css]=await Promise.all(['public/index.html','public/static/design-v51.js','public/static/app.js','public/static/design-v53.css'].map(read));
 assert.match(html,/<body data-mobile-view="edit" data-trip-step="1" class="region-ready">/);
 assert.match(css,/body\.region-needs-choice #trip-workspace/);
 assert.match(ui,/function rechoose\(\)/);
 assert.match(ui,/function accept\(value\)/);
 assert.match(app,/for\(const d of state\.days\)d\.region=region/);
});

test('v5.3 only user-picked origin and destination are accepted for route calculation',async()=>{
 const js=await read('public/static/app.js');
 assert.match(js,/origin:p\('출발지 미설정'/);
 assert.match(js,/destination:p\('도착지 미설정'/);
 assert.match(js,/\/미설정\/\.test\(d\.origin\.name\)/);
 assert.match(js,/\/미설정\/\.test\(d\.destination\.name\)/);
});

test('v5.3 removes date, departure-time, bag mode and manual order UX',async()=>{
 const [html,app,css]=await Promise.all(['public/index.html','public/static/app.js','public/static/design-v53.css'].map(read));
 assert.doesNotMatch(html,/id="stop-view-switch"/);
 assert.match(css,/\.trip-date-field,\.time-field/);
 assert.match(css,/\.stop-num,\.stop-order-controls/);
 assert.doesNotMatch(app,/data-bag-apply|data-bag-search|data-cycle-category|data-stop-pin/);
 assert.match(html,/id="btn-route"/);
});

test('v5.3 map search has map, toggleable large list, visible pin and continuous add',async()=>{
 const [html,js,quick]=await Promise.all(['public/index.html','public/static/search-screen.js','public/static/quick-add.js'].map(read));
 for(const id of ['search-naver-map','search-map-stage','search-screen-results-mount','search-list-toggle','search-picked','search-picked-add'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const token of ['new maps.Map','YeoPins?.marker','function onResults(next)','function preview(item)','function showMode(next)','function addSuccess(message)'])
  assert.ok(js.includes(token),token);
 assert.match(quick,/window\.YeoSearch\?\.onResults\?\.\(next\)/);
 assert.match(quick,/if\(duplicate\)\{feedback/);
});

test('v5.3 fullscreen dialog blocks background scroll and restores its state',async()=>{
 const [js,css]=await Promise.all(['public/static/search-screen.js','public/static/design-v53.css'].map(read));
 assert.match(js,/document\.body\.style\.position='fixed'/);
 assert.match(js,/document\.body\.style\.position=''/);
 assert.match(js,/window\.scrollTo\(0,previousScroll\)/);
 assert.match(js,/window\.visualViewport\?\.addEventListener\('resize',updateSize\)/);
 assert.match(css,/overscroll-behavior:contain/);
});

test('v5.3 route numbers and durations are only shown after calculation, no live transit claims',async()=>{
 const [app,html,css]=await Promise.all(['public/static/app.js','public/index.html','public/static/design-v53.css'].map(read));
 assert.match(app,/const routeNumber=i=>/);
 assert.match(app,/const stopNumber=d\.result\?\.entries\?\.findIndex/);
 assert.match(app,/readableMinutes\(leg\.durationMinutes\)/);
 assert.doesNotMatch(app,/data-navigate-index/);
 assert.match(html,/대중교통 · 지원 준비 중/);
 assert.match(css,/\.timeline-nav\{display:none!important/);
});

test('v5.3 result can add places and recalculate while maintaining dirty indication',async()=>{
 const [html,app]=await Promise.all(['public/index.html','public/static/app.js'].map(read));
 assert.match(html,/id="btn-result-add"/);
 assert.match(html,/id="btn-result-recalc"/);
 assert.match(app,/state\.dirtyDayIds\.add\(d\.id\)/);
 assert.match(app,/if\(calculationSucceeded&&day\(\)\.result&&day\(\)\.id===dayId\)/);
 assert.match(app,/\$\('btn-result-recalc'\)/);
});

test('v5.3 all browser entrypoint scripts parse without syntax errors',async()=>{
 for(const path of ['public/static/app.js','public/static/search-screen.js','public/static/design-v51.js']){
  const source=await read(path);assert.doesNotThrow(()=>new Function(source),path);
 }
 const quick=await read('public/static/quick-add.js');
 assert.doesNotThrow(()=>new Function(quick.replace(/^import .*;\s*$/gm,'')));
});
