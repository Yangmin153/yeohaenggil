import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {staticMapLayout,focusedStaticMapLayout} from '../public/static/static-map-layout.js';
import {GET as GETStaticMap} from '../api/static-map.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('STEP 2 embeds independent endpoint pickers and a collapsible visit list in one compact panel',async()=>{
 const [html,js,css]=await Promise.all([
  read('public/index.html'),read('public/static/vnext.js'),read('public/static/step2-unified.css')
 ]);
 const hub=html.indexOf('id="yg-step-two-hub"');
 const visit=html.indexOf('id="yg-add-visit"'),start=html.indexOf('id="yg-origin-pick"');
 const finish=html.indexOf('id="yg-dest-pick"'),close=html.indexOf('<!-- /yg-step-two-hub -->');
 assert.ok(hub>=0&&hub<visit&&visit<start&&start<finish&&finish<close);
 assert.match(html,/id="yg-inline-stops"[^>]*hidden/);
 assert.match(html,/id="yg-open-stops"[^>]*aria-expanded="false"[^>]*aria-controls="yg-inline-stops"/);
 assert.match(js,/function renderInlineStops\(\)/);
 assert.match(js,/data-inline-remove/);
 assert.match(js,/data-inline-focus/);
 assert.match(css,/#yg-inline-stops\[hidden\]/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
});
test('origin and destination selections do not automatically launch the opposite search',async()=>{
 const [search,ui]=await Promise.all([read('public/static/search-screen.js'),read('public/static/vnext.js')]);
 const endpoint=search.slice(search.indexOf('function completeEndpoint('),search.indexOf('function chooseAdd('));
 assert.match(endpoint,/setEndpointFromSearch\?\.\(kind,item\)/);
 assert.match(endpoint,/focusPlannerPlace\(id\)/);
 assert.match(endpoint,/hide\(\)/);
 assert.doesNotMatch(endpoint,/show\('destination'/);
 assert.doesNotMatch(search,/nextIsDestination/);
 assert.doesNotMatch(ui,/if\(radio\.value==='custom'\)\{if\(window\.YeoSearch\)/);
 assert.match(ui,/app\.setDayOriginMode\(app\.getActive\(\),radio\.value\)/);
});
test('new visit focus uses its saved id, not transient search candidate markers',async()=>{
 const [quick,search,app]=await Promise.all(['public/static/quick-add.js','public/static/search-screen.js','public/static/app.js'].map(read));
 assert.match(quick,/item,result\.stop\?\.id/);
 assert.match(search,/focusPlannerPlace\(addedId\)/);
 assert.doesNotMatch(search,/for\(const item of items\.slice\(0,15\)\)/);
 assert.match(app,/map\.panTo\(point\)/);
 assert.match(app,/trip:planner-focus/);
 assert.match(search,/YGScrollLock\?\.unlock\('search-screen'\)/);
});
test('the route CTA stays disabled until stored visits and their day endpoints are ready',async()=>{
 const [html,ui]=await Promise.all([read('public/index.html'),read('public/static/vnext.js')]);
 assert.match(html,/id="yg-calculate"[^>]*disabled/);
 assert.match(html,/id="yg-step-two-status" role="status" aria-live="polite"/);
 assert.match(ui,/const assigned=days\(\)\.filter\(d=>d\.stops\.length\)/);
 assert.match(ui,/button\.disabled=busy\|\|!ready/);
 assert.match(ui,/renderStepTwoReadiness\(\)/);
 assert.match(ui,/if\(!days\(\)\.some\(d=>d\.stops\.length\)\)/);
});
test('read-only static Naver fallback aligns saved pins for focus and full-area views',async()=>{
 const [js,html]=await Promise.all([read('public/static/step2-static-map.js'),read('public/index.html')]);
 assert.match(html,/step2-static-map\.js\?v=7\.19\.0/);
 assert.match(js,/new MutationObserver\(schedule\)/);
 assert.match(js,/trip:planner-focus/);
 assert.match(js,/staticMapLayout\(coords,width,height\)/);
 assert.match(js,/focusedStaticMapLayout\(coords,focusCoords,width,height,13\)/);
 assert.match(js,/!app\.getMap\?\.\(\)/);
 const points=[{x:37.58,y:126.98},{x:37.51,y:127.01}];
 const focused=focusedStaticMapLayout(points,points[1],390,260,13);
 assert.ok(focused);assert.equal(Math.round(focused.pixels[1].x),195);
 assert.equal(Math.round(focused.pixels[1].y),130);
 const full=staticMapLayout(points,390,260);
 assert.ok(full&&full.pixels.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const invalid=await GETStaticMap(new Request('https://example.com/api/static-map?p=37.580000%2C126.980000&w=150&h=260'));
 assert.equal(invalid.status,422);
});
