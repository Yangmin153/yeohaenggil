import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPlan} from '../lib/core.js';
import {runMultiDay} from '../lib/multi-day.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const point=(name,lng,locked=false)=>({id:name,name,lat:33.5,lng,locked});
const origin=point('start',126),destination=point('end',126.5),a=point('A',126.1),b=point('B',126.2),c=point('C',126.3);
const env={NAVER_MAPS_CLIENT_ID:'test-key',NAVER_MAPS_CLIENT_SECRET:'test-secret'};
async function withRoadFetch(fn){
 const previous=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=new URL(url),parse=v=>Number(u.searchParams.get(v).split(',')[0]);
  const x=parse('start'),y=parse('goal'),fav=(x===126&&y===126.2)||(x===126.2&&y===126.1)||(x===126.1&&y===126.5);
  return new Response(JSON.stringify({code:0,route:{traoptimal:[{summary:{duration:600000,distance:fav?1000:9000},path:[[x,33.5],[y,33.5]]}]}}),{status:200});
 };
 try{return await fn();}finally{globalThis.fetch=previous}
}
test('NAVER driving time takes priority and road distance breaks equal-time ties',async()=>{
 await withRoadFetch(async()=>{
  const r=await buildPlan({origin,destination,stops:[a,b],mode:'auto',departure:'09:00'},env);
  assert.deepEqual(r.orderIds,['B','A']);
  assert.equal(r.drivingMinutes,30);
  assert.equal(r.totalDistanceMeters,3000);
  assert.equal(r.entries[0].place.id,'start');
  assert.equal(r.entries.at(-1).place.id,'end');
  assert.equal(r.status,'road_exact');
 });
});
test('locking one stop preserves its chosen position while remaining stops are optimized',async()=>{
 await withRoadFetch(async()=>{
  const r=await buildPlan({origin,destination,stops:[a,{...b,locked:true},c],mode:'auto',departure:'09:00'},env);
  assert.equal(r.orderIds[1],'B');
  assert.deepEqual(new Set(r.orderIds),new Set(['A','B','C']));
  assert.equal(r.entries[2].place.id,'B');
 });
});
test('automatic multi-day allocator passes locked places to the actual daily road solver',async()=>{
 const trip={days:[{date:'2026-11-04',origin,destination}],stops:[a,{...b,fixedDate:'2026-11-04',locked:true},c]};
 await withRoadFetch(async()=>{
  const r=await runMultiDay(trip,env);
  assert.equal(r.days.length,1);
  assert.equal(r.days[0].route.orderIds[0],'B'); // Locked fixed-date place takes the first allocated-day slot.
  assert.equal(r.days[0].route.status,'road_exact');
 });
});
test('STEP2 search preview highlights one selected marker then focuses saved marker in planner',async()=>{
 const js=await read('public/static/search-screen.js');
 assert.match(js,/if\(selected\)\{[\s\S]*clearSavedMarkers\(\)/);
 assert.match(js,/selectedMarker=mark\(selected,true\)/);
 assert.match(js,/focusPlannerPlace\(addedId\)/);
 assert.match(js,/showMode\('list'\)/);
 assert.match(js,/picked.hidden=false;showMode\('map'\);paintMarkers\(\)/);
 assert.match(js,/document\.addEventListener\('trip:stops-changed'/);
});
test('STEP2 collection sheet hides date choice and only supports deletion',async()=>{
 const [html,ui]=await Promise.all([read('public/index.html'),read('public/static/vnext.js')]);
 assert.match(html,/id="yg-open-stops"/);
 assert.doesNotMatch(ui,/data-fixed-id/);
 assert.match(ui,/data-remove-place/);
 assert.doesNotMatch(ui,/data-stop-up|data-stop-down/);
 const start=html.indexOf('id="yg-endpoint-section"'),map=html.indexOf('id="map-region"');
 assert.ok(start>=0&&map>=0&&start<map);
});
test('STEP3 footer keeps visit navigation and both recalc actions live beneath visit adjustment',async()=>{
 const [html,app,ui,css]=await Promise.all([read('public/index.html'),read('public/static/app.js'),read('public/static/vnext.js'),read('public/static/vnext.css')]);
 const start=html.indexOf('id="yg-step-three-actions"'),end=html.indexOf('class="footer"',start);
 const foot=html.slice(start,end);
 assert.equal((foot.match(/<button /g)||[]).length,2);
 assert.match(foot,/id="yg-back-places"/);
 assert.match(foot,/id="yg-three-add"/);
 assert.match(html,/id="yg-three-recalc"/);
 assert.match(html,/id="yg-live-optimize"/);
 assert.match(html,/id="yg-route-adjust"/);
 assert.match(ui,/app\.setRouteStopPosition\(/);
 assert.match(ui,/data-adjust-select/);
 assert.match(app,/function moveRouteStop\(id,direction\)/);
 assert.match(app,/function setRouteStopLocked\(id,locked\)/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
});
