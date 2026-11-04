import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {geocode} from '../lib/core.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const point=(id,name,lat,lng)=>({id,name,lat,lng,address:'서울'});
const placeholder=(kind)=>point(kind,kind==='origin'?'출발지 미설정':'도착지 미설정',37,127);

test('search is compact: redundant stop heading and list hint hidden, compact toolbar and result rows',async()=>{
 const [css,html]=await Promise.all([read('public/static/search-compact-v86.css'),read('public/index.html')]);
 assert.match(css,/#search-screen\[data-search-kind="stop"\] #search-stage-card/);
 assert.match(css,/#search-screen\[data-search-mode="list"\] #search-area-tools/);
 assert.match(css,/min-height:34px!important/);
 assert.match(css,/\.quick-result-row\s*\{[^}]*min-height:60px!important/);
 assert.match(html,/search-compact-v86\.css\?v=1\.0\.0/);
});
test('keyword and full address search both use API; geocoder works on valid street query',async()=>{
 const js=await read('public/static/quick-add.js');
 assert.match(js,/function requestAddress\(term,signal\)/);
 assert.match(js,/\/api\/geocode\?q=/);
 assert.match(js,/window\.TripSearch\?\.looksLikeAddress\?\.\(text\)/);
 assert.match(js,/const addressWork=addressQuery/);
 assert.match(js,/window\.TripSearch\?\.combine\?\.\(keywordItems,addressItems\)/);
 assert.match(js,/!addressQuery&&!keywordItems\.length/);
 const src=await read('public/static/search-utils.js'),ctx={};ctx.globalThis=ctx;
 vm.runInNewContext(src,ctx);
 assert.equal(ctx.TripSearch.looksLikeAddress('인천 부평구 수변로 22'),true);
 assert.equal(ctx.TripSearch.looksLikeAddress('부개역'),false);
 const combined=ctx.TripSearch.combine([{id:'poi',name:'부개역',lat:37.48,lng:126.73}],
  [{address:'인천 부평구 수변로 22',lat:37.485,lng:126.724}]);
 assert.equal(combined.length,2);
 assert.equal(combined[1].source,'naver-address');
});
test('Naver geocoding result normalizes both road-name and lot-number addresses',async()=>{
 const saved=globalThis.fetch;
 let called;
 try{
  globalThis.fetch=async(url,options)=>{
   called=new URL(url);
   assert.equal(options.headers['x-ncp-apigw-api-key-id'],'fixture-id');
   return Response.json({status:'OK',addresses:[
    {roadAddress:'인천광역시 부평구 수변로 22',jibunAddress:'인천광역시 부평구 부개동 123',x:'126.724',y:'37.485'},
    {roadAddress:'',jibunAddress:'인천광역시 부평구 부개동 123-4',x:'126.723',y:'37.484'}
   ]});
  };
  const response=await geocode('인천 부평구 수변로 22',{NAVER_MAPS_CLIENT_ID:'fixture-id',NAVER_MAPS_CLIENT_SECRET:'fixture-key'});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(called.searchParams.get('query'),'인천 부평구 수변로 22');
  assert.equal(data.results.length,2);
  assert.equal(data.results[0].lat,37.485);
  assert.match(data.results[1].address,/부개동/);
 }finally{globalThis.fetch=saved;}
});
test('user may cancel either endpoint without deleting its place, with remaining endpoint intact',async()=>{
 const app=await read('public/static/app.js');
 const start=app.indexOf('function clearCollectedEndpoint(kind){'),end=app.indexOf('function removeCollectedPlace(',start);
 assert.ok(start>0&&end>start);
 const fn=app.slice(start,end);
 const roles={configured:p=>!!p&&!/미설정/.test(p.name),
  same:(a,b)=>Boolean(a&&b&&a.lat===b.lat&&a.lng===b.lng&&a.name===b.name)};
 const d={date:'2026-11-04',origin:point('origin','서울역',37.55,126.97),
  destination:point('end','인천공항',37.45,126.45),stops:[point('s','남산',37.56,126.98)]};
 const state={active:0},events=[],uids=['z1','z2'];
 const clear=new Function('day','state','window','uid','syncLinkedOrigins','invalidateRoutes',
  'selectedMapStop','refresh','document','Event',fn+';return clearCollectedEndpoint')(
  ()=>d,state,{YGPlaceRoles:roles},()=>uids.shift(),()=>{},()=>{},null,()=>{},
  {dispatchEvent:e=>events.push(e.type)},Event);
 assert.equal(clear('origin').ok,true);
 assert.match(d.origin.name,/미설정/);
 assert.equal(d.destination.name,'인천공항');
 assert.equal(d.stops.length,2);
 assert.equal(d.stops[1].name,'서울역');
 assert.equal(clear('destination').ok,true);
 assert.match(d.destination.name,/미설정/);
 assert.equal(d.stops.length,3);
 assert.ok(events.includes('trip:endpoint-changed'));
});
test('partial route response preserves stops on incomplete days and rejects missing route on ready days',async()=>{
 const src=await read('public/static/app.js');
 const part=src.slice(src.indexOf('function applyDailyRoutes(payload){'),src.indexOf('function setTravelDates(',src.indexOf('function applyDailyRoutes(payload){')));
 const incomplete={date:'2026-11-04',id:'d1',stops:[point('visit1','남산',37.55,126.99)],
  origin:placeholder('origin'),destination:point('end1','서울역',37.54,126.97),mode:'auto'};
 const ready={date:'2026-11-05',id:'d2',stops:[point('visit2','광화문',37.57,126.97)],
  origin:point('origin2','서울역',37.55,126.97),destination:point('end2','명동',37.56,126.98),mode:'auto'};
 const state={days:[incomplete,ready],dirtyDayIds:new Set()};
 const fn=new Function('state','window','liveRoutes','sceneSignature','sceneResult','mapFitQueued','refresh','document','Event',
   part+';return applyDailyRoutes')(
   state,{YGPlaceRoles:{configured:p=>!!p&&!/미설정/.test(p.name)}},new Map(),
   '',null,false,()=>{}, {dispatchEvent:()=>{}},Event);
 assert.equal(fn({days:[{date:incomplete.date,route:null},{date:ready.date,route:null}]}),false);
 const good={days:[{date:incomplete.date,route:null},
  {date:ready.date,route:{orderIds:['visit2'],entries:[]}}]};
 assert.equal(fn(good),true);
 assert.deepEqual(incomplete.stops.map(p=>p.id),['visit1']);
 assert.equal(incomplete.result,null);
 assert.deepEqual(ready.stops.map(p=>p.id),['visit2']);
 assert.deepEqual(ready.result.orderIds,['visit2']);
});
test('calculation works with only one ready day and the endpoint dialog has a clear action',async()=>{
 const [ui,html,app]=await Promise.all([read('public/static/vnext.js'),read('public/index.html'),read('public/static/app.js')]);
 const readiness=ui.slice(ui.indexOf('function routeReady(d){'),ui.indexOf('function openSheet(){'));
 assert.match(readiness,/days\(\)\.filter\(routeReady\)\.length/);
 assert.match(readiness,/ready:ready>0/);
 assert.match(ui,/filter\(\(\{d\}\)=>routeReady\(d\)\)/);
 assert.match(ui,/const routes=arranged\.map\(d=>\(\{date:d\.date,route:null\}\)\)/);
 assert.match(ui,/if\(!day\(\)\.result\)app\.setActive\(full\[0\]\.i\)/);
 assert.doesNotMatch(html,/id="yg-endpoint-chooser-clear"/);
 assert.match(ui,/selected\?app\.clearCollectedEndpoint\(kind\):app\.setCollectedRole/);
 assert.match(app,/function clearCollectedEndpoint\(kind\)/);
});
test('changed modules have valid JavaScript syntax',()=>{
 for(const path of ['public/static/app.js','public/static/vnext.js','public/static/quick-add.js']){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(r.status,0,path+'\n'+r.stderr);
 }
});
