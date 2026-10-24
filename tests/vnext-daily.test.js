import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('STEP 1 only shows date range and duration, no day list or endpoints',async()=>{
 const html=await read('public/index.html'),css=await read('public/static/vnext.css'),js=await read('public/static/vnext.js');
 assert.match(html,/id="yg-start-date"/);assert.match(html,/id="yg-end-date"/);
 assert.doesNotMatch(html,/id="yg-day-cards"/);assert.match(js,/function renderDates\(/);
 const markup=html.split('id="yg-step-one"')[1].split('class="region-onboarding"')[0];
 assert.doesNotMatch(markup,/data-endpoint-day|data-endpoint-kind|id="yg-origin-pick"/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/-webkit-appearance:none/);
});
test('STEP 2 puts location search before map and endpoints below map',async()=>{
 const html=await read('public/index.html'),js=await read('public/static/vnext.js'),css=await read('public/static/vnext.css');
 for(const id of ['yg-active-date','yg-origin-pick','yg-dest-pick','yg-add-visit','yg-day-inherit'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/app\.setActive\(Number\(e\.target\.value\)\)/);
 assert.match(js,/app\.setDayOriginMode\(app\.getActive\(\),radio\.value\)/);
 assert.match(css,/#yg-active-date\{appearance:none/);
 assert.match(css,/max-width:160px/);
 assert.doesNotMatch(html,/<script defer src="\/static\/design-v51\.js/);
});
test('list sheet edits the active day and uses click controls, not touch drag reordering',async()=>{
 const js=await read('public/static/vnext.js'),html=await read('public/index.html'),app=await read('public/static/app.js');
 for(const part of ['data-stop-up','data-stop-down','data-remove-place','yg-place-order'])
  assert.ok(js.includes(part));
 assert.match(js,/const list=days\(\),items=app\.allStops\(\),pending=app\.unassignedStops\(\)/);
 assert.match(js,/app\.reorderStop\(up\.dataset\.stopUp,-1\)/);
 assert.match(app,/if\(owner\)owner\.mode='manual'/);
 assert.match(html,/id="yg-open-stops"/);
 assert.match(js,/document\.body\.classList\.add\('yg-sheet-open'\)/);
 assert.doesNotMatch(js,/dragstart|draggable/);
});
test('daily route requests are scoped per day and preserve configured auto/manual modes',async()=>{
 const js=await read('public/static/vnext.js'),app=await read('public/static/app.js');
 assert.match(js,/fetch\('\/api\/route'/);
 assert.match(js,/fetch\('\/api\/multi-route'/);
 assert.match(js,/mode:d\.mode==='manual'\?'manual':'auto'/);
 assert.match(app,/function applyDailyRoutes\(payload\)/);
 assert.match(app,/if\(route&&d\.mode==='auto'\)/);
 assert.match(js,/if\(!full\.length\)/);
});
test('search markers and duplicated places are day scoped without forced region',async()=>{
 const quick=await read('public/static/quick-add.js'),search=await read('public/static/search-screen.js'),css=await read('public/static/vnext.css');
 assert.match(quick,/const duplicate=app\.allStops\(\)\.some/);
 assert.match(quick,/window\.YeoNext\?\.searchRegion/);
 assert.match(search,/function savedPlaces\(\)\{return window\.TripApp\?\.allStops\?\.\(\)\|\|\[\];\}/);
 assert.match(search,/showSavedPlace:showSaved/);
 assert.match(css,/\.quick-region-label\{display:none!important\}/);
});
