import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function roles(){
 const root={};root.window=root;
 runInNewContext(await read('public/static/place-role-core.js'),root);
 return root.YGPlaceRoles;
}
const place=(id,name,sourceId)=>({id,name,sourceId,lat:37.489,lng:126.724,address:'인천 부평구 수변로 22'});

async function renderer(d,kind,core){
 const source=await read('public/static/vnext.js');
 const start=source.indexOf('function renderEndpointChooser(){');
 const end=source.indexOf('function openEndpointChooser(',start);
 assert.ok(start>=0&&end>start,'chooser render function exists');
 const els=new Map();
 const $=id=>{
  if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',
   classList:{toggle(){}}});
  return els.get(id);
 };
 const fn=new Function('endpointChooserKind','day','$','dateText','configured','window','escape',
  source.slice(start,end)+';return renderEndpointChooser;')(
  kind,()=>d,$,()=> '11.12 (목)',core.configured,
  {YGPlaceRoles:core,TripMeta:{icon:()=> '•',meta:()=>({label:'교통'})}},
  v=>String(v));
 fn();
 return {heading:$('yg-endpoint-chooser-current').textContent,html:$('yg-endpoint-chooser-list').innerHTML};
}
async function clearEndpoint(d,kind,core){
 const app=await read('public/static/app.js');
 const start=app.indexOf('function clearCollectedEndpoint(kind){');
 const end=app.indexOf('function removeCollectedPlace(',start);
 assert.ok(start>=0&&end>start);
 const events=[];
 const clear=new Function('day','state','window','uid','syncLinkedOrigins',
  'invalidateRoutes','selectedMapStop','refresh','document','Event',
  app.slice(start,end)+';return clearCollectedEndpoint;')(
  ()=>d,{active:0},{YGPlaceRoles:core},()=> 'saved-stop',
  ()=>{},()=>{},null,()=>{},
  {dispatchEvent:e=>events.push(e.type)},Event);
 return {result:clear(kind),events};
}

for(const kind of ['origin','destination']){
 test(kind+' after unassign no longer shows the saved visit as currently assigned',async()=>{
  const core=await roles(),selected=place('original','부개역 1호선','kakao-1');
  const d={date:'2026-11-12',stops:[],
   origin:place('origin-slot','부개역 1호선','kakao-1'),
   destination:place('destination-slot','상동역','kakao-2'),
   originMode:'custom'};
  if(kind==='destination'){
   d.origin=place('origin-slot','상동역','kakao-2');
   d.destination=place('destination-slot','부개역 1호선','kakao-1');
  }
  const before=await renderer(d,kind,core);
  assert.match(before.html,/data-chooser-selected="true"/);
  assert.match(before.html,/다시 눌러 해제/);
  const {result,events}=await clearEndpoint(d,kind,core);
  assert.equal(result.ok,true);
  assert.ok(events.includes('trip:endpoint-changed'));
  assert.match(d[kind].name,/미설정/);
  assert.equal(d[kind].sourceId,undefined,'cleared role must not keep old source identity');
  assert.equal(d[kind].lat,selected.lat,'backward-compatible location coordinates can remain');
  assert.equal(d.stops.length,1);
  assert.equal(d.stops[0].sourceId,selected.sourceId);
  const after=await renderer(d,kind,core);
  assert.match(after.heading,/아직 미지정/);
  assert.match(after.html,/부개역 1호선/);
  assert.match(after.html,/data-chooser-selected="false"/);
  assert.match(after.html,/지정하기/);
  assert.doesNotMatch(after.html,/data-chooser-selected="true"/);
  assert.doesNotMatch(after.html,/다시 눌러 해제/);
  // Tapping the retained visit can assign the place again, and a second tap clears it.
  const reselect=core.select(d,0,d.stops[0].id,kind,()=> 'recycled-stop');
  assert.equal(reselect.ok,true);
  const selectedAgain=await renderer(d,kind,core);
  assert.match(selectedAgain.html,/data-chooser-selected="true"/);
  assert.match(selectedAgain.html,/다시 눌러 해제/);
  await clearEndpoint(d,kind,core);
  const clearedAgain=await renderer(d,kind,core);
  assert.doesNotMatch(clearedAgain.html,/data-chooser-selected="true"/);
 });
}

test('former endpoint coordinates must not produce a ghost opposite-role badge',async()=>{
 const core=await roles();
 const d={date:'2026-11-12',
   origin:place('o','부개역 1호선','kakao-1'),
   destination:place('d','부개역 1호선','kakao-1'),stops:[],originMode:'custom'};
 await clearEndpoint(d,'destination',core);
 const current=await renderer(d,'origin',core);
 assert.match(current.heading,/현재 출발지.*부개역/);
 assert.doesNotMatch(current.html,/이미 도착지로 지정됨/);
});
test('renderer checks configured role before comparing place identity',async()=>{
 const ui=await read('public/static/vnext.js');
 assert.match(ui,/const sameAssigned=p=>Boolean\(configured\(current\)&&window\.YGPlaceRoles\?\.same/);
 assert.match(ui,/const chosen=sameAssigned\(p\)/);
 assert.match(ui,/configured\(d\[other\]\)&&window\.YGPlaceRoles\?\.same/);
 assert.match(ui,/items\.sort\(\(a,b\)=>Number\(sameAssigned\(b\)\)-Number\(sameAssigned\(a\)\)\)/);
});
test('changed JS is syntactically valid',()=>{
 for(const file of ['public/static/vnext.js','public/static/app.js']){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(r.status,0,file+'\n'+r.stderr);
 }
});
