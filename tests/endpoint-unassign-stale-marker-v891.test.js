import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const same=(a,b)=>Boolean(a&&b&&a.name===b.name&&a.lat===b.lat&&a.lng===b.lng);
const place=(id,name)=>({id,name,lat:37.551,lng:126.989,address:'서울특별시'});
async function pins(){
 const context={};context.globalThis=context;
 runInNewContext(await read('public/static/route-pins.js'),context);
 return context.YeoPins;
}
test('unassigned endpoint with retained coordinates NEVER displays 출발·도착',async()=>{
 const p=await pins();
 const o=place('o','서울역'),d=place('d','서울역'),one=[{place:o}];
 assert.equal(p.overlapRole(one,o,d),'both');
 const clearedOrigin={...o,name:'출발지 미설정'};
 assert.equal(clearedOrigin.lat,o.lat,'clearing retains GPS coordinates');
 assert.equal(p.overlapRole(one,clearedOrigin,d),null);
 const clearedDestination={...d,name:'도착지 미설정'};
 assert.equal(p.overlapRole(one,o,clearedDestination),null);
 assert.equal(p.overlapRole(one,clearedOrigin,clearedDestination),null);
 assert.equal(p.overlapRole(one,null,d),null);
});
test('after user taps to clear both, saved visit can remain without stale dual marker',async()=>{
 const app=await read('public/static/app.js'),p=await pins();
 const begin=app.indexOf('function clearCollectedEndpoint(kind){');
 const end=app.indexOf('function removeCollectedPlace(',begin);
 assert.ok(begin>0&&end>begin);
 const d={date:'2026-11-05',origin:place('o','서울역'),destination:place('d','서울역'),stops:[]};
 const roles={configured:x=>Boolean(x&&x.name&&!/미설정/.test(x.name)),same};
 const events=[],changes=[];
 const action=new Function('day','state','window','uid','syncLinkedOrigins','invalidateRoutes',
  'selectedMapStop','refresh','document','Event',
  app.slice(begin,end)+';return clearCollectedEndpoint')(
  ()=>d,{active:0},{YGPlaceRoles:roles},()=> 'saved-visit',
  ()=>{},days=>changes.push(days),null,()=>{},
  {dispatchEvent:e=>events.push(e.type)},Event);
 assert.equal(p.overlapRole([{place:d.origin},{place:d.destination}],d.origin,d.destination),'both');
 assert.equal(action('origin').ok,true);
 assert.match(d.origin.name,/미설정/);
 assert.equal(p.overlapRole([{place:d.destination}],d.origin,d.destination),null);
 assert.equal(d.destination.name,'서울역','unassign one role must preserve the other');
 assert.equal(action('destination').ok,true);
 assert.equal(d.stops.length,1,'the last endpoint returns to saved visits');
 assert.equal(d.stops[0].name,'서울역');
 assert.equal(p.overlapRole([{place:d.stops[0]}],d.origin,d.destination),null);
 assert.equal(d.origin.lat,d.destination.lat,'coordinates unchanged, so stale labels would appear without the guard');
 assert.deepEqual(changes,[[0],[0]]);
 assert.equal(events.filter(x=>x==='trip:endpoint-changed').length,2);
});
test('search highlighted pin recreates itself when overlapping role state changes',async()=>{
 const s=await read('public/static/search-screen.js');
 const start=s.indexOf('function paintMarkers(){'),end=s.indexOf('function showMode(next){',start);
 const body=s.slice(start,end);
 assert.match(body,/const role=selected&&window\.YeoPins\?\.overlapRole/);
 assert.match(body,/\+'\|'\+role/);
 assert.match(body,/selectedMarkerKey!==key/);
 assert.match(body,/selectedMarker=mark\(selected,true\)/);
 const pinsSrc=await read('public/static/route-pins.js');
 assert.match(pinsSrc,/if\(!Array\.isArray\(group\)\|\|!assigned\(origin\)\|\|!assigned\(destination\)\|\|!coincident/);
});
test('main cards and chooser recompute text from saved endpoint state',async()=>{
 const source=await read('public/static/vnext.js');
 assert.match(source,/\$\('yg-role-status-origin'\)\.textContent=configured\(d\.origin\)\?d\.origin\.name:'아직 미지정'/);
 assert.match(source,/\$\('yg-role-status-destination'\)\.textContent=configured\(d\.destination\)\?d\.destination\.name:'아직 미지정'/);
 assert.match(source,/document\.addEventListener\('trip:endpoint-changed',\(\)=>\{renderDaily\(\);renderWarnings\(\);\}\)/);
 assert.match(source,/if\(!items\.length\)\{list\.innerHTML=/);
 const app=await read('public/static/app.js');
 assert.match(app,/document\.dispatchEvent\(new Event\('trip:endpoint-changed'\)\)/);
});
