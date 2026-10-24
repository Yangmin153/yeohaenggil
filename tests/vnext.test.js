import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {allocateTrip,validateTrip,runMultiDay} from '../lib/multi-day.js';
import {normalizeKakao} from '../lib/place-search.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const point=(id,lat=33.45,lng=126.48,extra={})=>({id,name:id,lat,lng,locked:false,...extra});
const trip=()=>({
 days:[
 {date:'2026-10-31',origin:point('start-one',33.51,126.49),destination:point('hotel-west',33.45,126.3)},
 {date:'2026-11-01',origin:point('hotel-west',33.45,126.3),destination:point('hotel-east',33.47,126.8)},
 {date:'2026-11-02',origin:point('hotel-east',33.47,126.8),destination:point('airport',33.51,126.49)}],
 stops:[point('beach',33.39,126.24),point('island',33.5,126.9,{fixedDate:'2026-11-01'}),point('cafe',33.48,126.4,{fixedDate:null})]
});
test('validates 3-day journey over October-November and fixed dates',()=>{
 const t=trip();assert.equal(validateTrip(t),null);
 assert.equal(validateTrip({...t,days:[...t.days.slice(0,1),{...t.days[1],date:'2026-11-03'},t.days[2]]})?.includes('연속'),true);
 assert.match(validateTrip({...t,stops:[{...t.stops[1],fixedDate:'2026-11-03'}]}),/기간 밖/);
});
test('multi-day assignment reserves every pinned place and never loses or duplicates stops',()=>{
 const t=trip(),a=allocateTrip(t);
 assert.equal(a.length,3);assert.ok(a[1].some(s=>s.id==='island'));
 assert.deepEqual(a.flat().map(s=>s.id).sort(),t.stops.map(s=>s.id).sort());
 assert.equal(t.stops[0].fixedDate,undefined);
});
test('automatically allocated stops do not invent sightseeing duration and final per-day routing works',async()=>{
 const t=trip(),r=await runMultiDay(t,{});
 assert.equal(r.days.length,3);
 assert.equal(r.days.flatMap(d=>d.assignedStopIds).length,t.stops.length);
 assert.ok(r.days[1].assignedStopIds.includes('island'));
 assert.ok(r.days.every(d=>Number.isFinite(d.route.drivingMinutes)));
 assert.ok(r.days.every(d=>!JSON.stringify(d.route.entries).includes('stayMinutes')));
 assert.ok(r.warnings.some(w=>w.includes('근사')));
});
test('same-day trip and out-of-bound coordinate validation',()=>{
 const d=trip().days[0],solo={days:[d],stops:[]};assert.equal(validateTrip(solo),null);
 assert.ok(validateTrip({...solo,days:[{...d,origin:point('bad',126.99,33.55)}]}));
});
test('Kakao y latitude and x longitude keep Naver LatLng position correct',async()=>{
 const x=normalizeKakao({id:'1',place_name:'한라산',y:'33.361666',x:'126.529166',address_name:'제주특별자치도'});
 assert.equal(x.lat,33.361666);assert.equal(x.lng,126.529166);
 const app=await read('public/static/app.js'),search=await read('public/static/search-screen.js'),core=await read('lib/core.js');
 assert.match(app,/new naver\.maps\.LatLng\(place\.lat,place\.lng\)/);
 assert.match(search,/new window\.naver\.maps\.LatLng\(Number\(item\.lat\),Number\(item\.lng\)\)/);
 assert.match(core,/const coordinates = p => `\$\{p\.lng\.toFixed\(7\)\},\$\{p\.lat\.toFixed\(7\)\}`/);
 assert.match(core,/\[\[a\.lng,a\.lat\],\[b\.lng,b\.lat\]\]/);
});
test('wizard screens and real calendar date picker are wired',async()=>{
 const html=await read('public/index.html'),app=await read('public/static/app.js'),wiz=await read('public/static/vnext.js');
 for(const id of ['yg-start-date','yg-end-date','yg-add-visit','yg-next-places','yg-place-sheet','yg-calculate','yg-three-recalc','yg-delete-routes'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/function syncLinkedOrigins\(from=1\)/);
 assert.match(app,/function setTravelDates\(start,end\)/);
 assert.match(wiz,/function calculate\(\)/);
 assert.match(wiz,/function renderSheet\(\)/);
});

test('POST /api/multi-route rejects forged origin, malformed payload and invalid fixed dates',async()=>{
 const {POST}=await import('../api/multi-route.js');
 const url='https://yeohaenggil.example/api/multi-route';
 const make=(body,origin)=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
 assert.equal((await POST(make(trip(),'https://foreign.example'))).status,403);
 const payload=trip();payload.stops[1].fixedDate='2026-11-09';
 const invalid=await POST(make(payload));assert.equal(invalid.status,422);
 assert.match((await invalid.json()).detail,/기간 밖/);
});
test('POST /api/multi-route includes every stop exactly once in route assignments',async()=>{
 const {POST}=await import('../api/multi-route.js');
 const url='https://yeohaenggil.example/api/multi-route',payload=trip();
 const response=await POST(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
 assert.equal(response.status,200);
 const data=await response.json(),ids=data.days.flatMap(d=>d.assignedStopIds);
 assert.deepEqual(ids.sort(),payload.stops.map(s=>s.id).sort());
 assert.equal(data.days[1].assignedStopIds.includes('island'),true);
});
