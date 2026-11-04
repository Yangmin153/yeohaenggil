import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const point=(id,name)=>({id,name,lat:37.5,lng:127.0,locked:false});
function mkDay(date,id,ids){
 return {id,date,stops:ids.map(x=>point(x,x)),unassignedStops:[],
  origin:point('o'+id,'서울역'),destination:point('e'+id,'잠실역'),
  originMode:'custom',departure:'09:00',mode:'auto',result:null,region:'서울'};
}
function makeDateHarness(source,initial,archiveScope='account-A'){
 const start=source.indexOf('const archiveStorageKey=scope=>');
 const end=source.indexOf('async function calculateRoute(',start);
 assert.ok(start>0&&end>start);
 const state={days:initial,active:0,loading:false,dirtyDayIds:new Set()};
 const entries=new Map(),storage={
  getItem:key=>entries.get(key)??null,
  setItem:(key,value)=>entries.set(key,value),
  removeItem:key=>entries.delete(key)
 };
 let owner=archiveScope;
 const window={YeoAccount:{storageScope:()=>owner}};
 const code=source.slice(start,end)+';return {setTravelDates,migrateArchiveScope}';
 const f=new Function('state','window','localStorage','currentRegion','freshDays','makeNextDay','syncLinkedOrigins','refresh','document','Event','toast','sceneSignature','sceneResult','mapFitQueued',code);
 const api=f(state,window,storage,()=> '서울',()=>[mkDay('','new',[])],
  d=>mkDay('',d.id+'-next',[]),()=>{},()=>{},
  {dispatchEvent:()=>{}},Event,()=>{},'',null,false);
 return {state,storage,entries,api,setOwner:v=>owner=v};
}
test('shrinking then restoring a trip preserves each visit on its original day',async()=>{
 const app=await read('public/static/app.js');
 const h=makeDateHarness(app,[mkDay('2026-11-04','a',['a']),mkDay('2026-11-05','b',['b'])]);
 assert.equal(h.api.setTravelDates('2026-11-04','2026-11-04'),true);
 assert.deepEqual(h.state.days[0].stops.map(p=>p.id),['a']);
 assert.equal(h.api.setTravelDates('2026-11-04','2026-11-05'),true);
 assert.deepEqual(h.state.days.map(d=>d.stops.map(p=>p.id)),[['a'],['b']]);
});
test('archived dates are isolated by user/trip scope and are not read from legacy global storage',async()=>{
 const app=await read('public/static/app.js');
 const h=makeDateHarness(app,[mkDay('2026-11-04','a',[]),mkDay('2026-11-05','b',['private'])],'A:trip1');
 assert.equal(h.api.setTravelDates('2026-11-04','2026-11-04'),true);
 assert.ok([...h.entries.keys()].some(k=>k.includes(encodeURIComponent('A:trip1'))));
 h.setOwner('B:trip2');
 h.state.days=[mkDay('2026-11-04','a',[])];
 assert.equal(h.api.setTravelDates('2026-11-04','2026-11-05'),true);
 assert.equal(h.state.days[1].stops.length,0,'foreign account must not see archived visits');
 const accounts=await read('public/static/accounts.js');
 assert.match(accounts,/const storageScope=\(\)=>loggedIn\(\)\?user\.id/);
 assert.match(accounts,/draftScopeId=/);
 assert.match(accounts,/sessionStorage\.getItem\(DRAFT_KEY\)/);
 assert.match(accounts,/if\(lastId!==null\)draftScopeId=rotateDraftScope\(\)/);
 assert.match(accounts,/migrateArchiveScope\?\.\(previousScope,storageScope\(\)\)/);
});
test('editing one day leaves unrelated calculated days unchanged',async()=>{
 const src=await read('public/static/app.js');
 const start=src.indexOf('function invalidateRoutes(indices=null){');
 const end=src.indexOf('function toast(',start);
 assert.ok(start>0&&end>start);
 const state={days:[{id:'day1',result:{orderIds:['a']}},{id:'day2',result:{orderIds:['b']}}],dirtyDayIds:new Set()};
 const liveRoutes=new Map(),fun=new Function('state','liveRoutes','sceneSignature','sceneResult','mapFitQueued',
  src.slice(start,end)+';return invalidateRoutes');
 const invalidate=fun(state,liveRoutes,'',null,false);
 invalidate([0]);
 assert.equal(state.days[0].result,null);
 assert.deepEqual(state.days[1].result,{orderIds:['b']});
 assert.ok(state.dirtyDayIds.has('day1'));
 assert.equal(state.dirtyDayIds.has('day2'),false);
 assert.match(src,/invalidateRoutes\(\[state\.active\]\)/);
});
test('guest refresh saves validated compact routes, falling back to place-only on quota failure',async()=>{
 const src=await read('public/static/app.js');
 const start=src.indexOf('function save(){'),end=src.indexOf('function refresh(',start);
 const part=src.slice(start,end);
 const snapshot=[mkDay('2026-11-04','a',['a'])];
 snapshot[0].result={orderIds:['a'],entries:[]};
 const storage=new Map();
 let failFirst=false,called=0;
 const localStorage={setItem:(key,data)=>{
  called++;
  if(failFirst&&called===1)throw Error('quota exceeded');
  storage.set(key,data);
 }};
 const toast=()=>{};
 const getSave=()=>new Function('window','localStorage','STORAGE_KEY','exportCloudDays','toast',
  part+';return save')({YeoAccount:{isSignedIn:()=>false}},localStorage,'saved',()=>snapshot,toast);
 getSave()();
 assert.deepEqual(JSON.parse(storage.get('saved'))[0].result.orderIds,['a']);
 called=0;failFirst=true;storage.clear();
 getSave()();
 assert.equal(JSON.parse(storage.get('saved'))[0].result,undefined);
});
test('search starts address and keyword requests independently and handles response order',async()=>{
 const src=await read('public/static/quick-add.js');
 assert.match(src,/const keywordWork=\(async\(\)=>\{/);
 assert.match(src,/const addressWork=addressQuery/);
 assert.match(src,/Promise\.all\(\[keywordWork,addressWork\]\)/);
 assert.match(src,/if\(addressItems\.length\)emit\(\)/);
 assert.match(src,/if\(!addressQuery&&!keywordItems\.length\)/);
});
test('search markers reconcile saved pins instead of tearing down all pins on every event',async()=>{
 const src=await read('public/static/search-screen.js');
 const from=src.indexOf('function refreshSavedMarkers(){');
 const to=src.indexOf('function showMode(next){',from);
 const body=src.slice(from,to);
 assert.ok(from>0&&to>from);
 assert.match(body,/savedMarkerRegistry\.has\(key\)/);
 assert.match(body,/savedMarkerRegistry\.delete\(key\)/);
 assert.doesNotMatch(body,/clearSavedMarkers\(\);\s*if\(!searchMap/);
 const paint=body.slice(body.indexOf('function paintMarkers(){'));
 assert.doesNotMatch(paint,/clearMarkers\(\)/);
 assert.match(src,/function queueMarkerPaint\(\)/);
});
test('all three steps share UI styles; incomplete day has editing CTA and safe area',async()=>{
 const [html,css,js]=await Promise.all(['public/index.html','public/static/vnext-unified-v88.css','public/static/vnext.js'].map(read));
 assert.match(css,/body\[data-trip-step\] #yg-progress/);
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/yg-incomplete-day/);
 assert.match(html,/id="yg-incomplete-day"/);
 assert.match(html,/id="yg-incomplete-edit"/);
 assert.match(js,/renderWarnings\(\)[\s\S]*?incomplete\.hidden/);
 assert.match(js,/\$\('yg-incomplete-edit'\)\.addEventListener/);
});
test('CSS build validates 22 ordered stylesheets before consolidating output',()=>{
 const p=spawnSync(process.execPath,['scripts/build-css.mjs','--verify'],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 const stats=JSON.parse(p.stdout.trim());
 assert.ok(stats.links>=21);
 assert.ok(stats.bytes>250000);
});
test('all changed JS parses',()=>{
 for(const p of ['public/static/app.js','public/static/accounts.js','public/static/vnext.js','public/static/quick-add.js','public/static/search-screen.js','scripts/build-css.mjs']){
  const x=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(x.status,0,p+'\n'+x.stderr);
 }
});
