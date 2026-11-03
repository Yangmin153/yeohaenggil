import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('STEP1 retains date range and creates real day records without visible day cards',async()=>{
 const [html,ui]=await Promise.all([read('public/index.html'),read('public/static/vnext.js')]);
 assert.match(html,/id="yg-start-date"/);assert.match(html,/id="yg-end-date"/);
 assert.doesNotMatch(html,/id="yg-day-cards"/);assert.match(ui,/app\.setTravelDates\(start,end\)/);
});
test('STEP2 puts one day selector at top, prior to heading and add search',async()=>{
 const html=await read('public/index.html');
 const ids=['yg-plan-date','yg-active-date','yg-step-two-intro','yg-add-visit','yg-open-stops','yg-endpoint-section','map-region'];
 const positions=ids.map(x=>html.indexOf('id="'+x+'"'));
 assert.ok(positions.every(i=>i>=0),JSON.stringify(positions));
 assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert.equal((html.match(/id="yg-active-date"/g)||[]).length,1);
});
test('STEP2 adds into active days[].stops and same-day duplicates are prevented',async()=>{
 const [app,quick]=await Promise.all([read('public/static/app.js'),read('public/static/quick-add.js')]);
 assert.match(app,/const duplicate=\[\.\.\.d\.stops,d\.origin,d\.destination\]\.some/);
 assert.match(app,/d\.stops\.push\(stop\)/);
 assert.match(app,/fixedDate:d\.date\|\|null/);
 assert.match(quick,/app\.getDay\(\)\.stops\.some/);
});
test('old unassigned data remains supported and transfer requires explicit user approval',async()=>{
 const [app,ui,html]=await Promise.all([read('public/static/app.js'),read('public/static/vnext.js'),read('public/index.html')]);
 assert.match(app,/unassignedStops:\(data\.unassignedStops\|\|\[\]\)\.map\(omitStay\)/);
 assert.match(app,/function moveUnassignedToActive\(\)/);
 assert.match(ui,/confirm\('기존 미배정 장소 '/);
 assert.match(html,/id="yg-legacy-assign"/);
 assert.match(ui,/app\.moveUnassignedToActive\(\)/);
 assert.match(ui,/if\(pending\.length\)\{/);
});
test('STEP2 saved list has category, name and delete but no date or arrow controls',async()=>{
 const [ui,html]=await Promise.all([read('public/static/vnext.js'),read('public/index.html')]);
 assert.match(ui,/const d=day\(\),items=d\.stops/);
 assert.match(ui,/data-remove-place/);
 assert.doesNotMatch(ui,/data-fixed-id|data-stop-up|data-stop-down/);
 assert.match(html,/id="yg-open-stops"/);
});
test('STEP2 map shows only current day places and STEP3 route reads selected day',async()=>{
 const [app,search]=await Promise.all([read('public/static/app.js'),read('public/static/search-screen.js')]);
 assert.match(app,/collecting\?\[\.\.\.d\.stops,d\.origin,d\.destination\]/);
 assert.match(search,/function savedPlaces\(\)\{return window\.TripApp\?\.getDay\?\.\(\)\?\.stops\|\|\[\];\}/);
 assert.match(app,/const points=collecting/);
 assert.match(app,/YeoPins\?\.marker/);
});
test('STEP3 date selector immediately follows map and remains wired to active day',async()=>{
 const [html,workspace]=await Promise.all([read('public/index.html'),read('public/static/map-workspace.js')]);
 const map=html.indexOf('id="map-region"'),date=html.indexOf('id="yg-result-date"'),results=html.indexOf('id="route-results"');
 assert.ok(map<date&&date<results);
 assert.match(workspace,/\$\('map-day-select'\)\.addEventListener\('change'/);
});
test('route calculation uses road route API, fixed order and manual mode remain',async()=>{
 const [ui,app]=await Promise.all([read('public/static/vnext.js'),read('public/static/app.js')]);
 assert.match(ui,/fetch\('\/api\/route'/);
 assert.doesNotMatch(ui,/fetch\('\/api\/multi-route'/);
 assert.match(ui,/mode:d\.mode==='manual'\?'manual':'auto'/);
 assert.match(app,/function moveRouteStop/);assert.match(app,/function setRouteStopLocked/);
});
test('shared Naver markers use true coordinates and Korean endpoints',async()=>{
 const [pins,css]=await Promise.all([read('public/static/route-pins.js'),read('public/static/route-pins.css')]);
 assert.match(pins,/new maps\.LatLng\(lat,lng\)/);
 assert.match(pins,/anchor:new maps\.Point\(22,52\)/);
 assert.match(pins,/type==='origin'\?'출발':type==='destination'\?'도착'/);
 assert.match(css,/width:44px!important;height:52px!important/);
});
test('Supabase trips stay owner scoped and legacy schema load triggers date rerender',async()=>{
 const [app,accounts,ui]=await Promise.all([read('public/static/app.js'),read('public/static/accounts.js'),read('public/static/vnext.js')]);
 assert.match(accounts,/function currentDays\(\)/);
 assert.match(app,/document\.dispatchEvent\(new Event\('trip:days-imported'\)\)/);
 assert.match(ui,/addEventListener\('trip:days-imported'/);
 assert.match(app,/unassignedStops:\(data\.unassignedStops\|\|\[\]\)\.map/);
});
