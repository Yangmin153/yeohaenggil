import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const place=(id,name,lat=37.551,lng=126.989)=>({id,name,lat,lng});
async function pinCore(){
 const root={};root.globalThis=root;
 runInNewContext(await read('public/static/route-pins.js'),root);
 return root.YeoPins;
}

test('overlapping departure and arrival render 출발·도착, not numeric 2',async()=>{
 const pins=await pinCore();
 const o=place('origin','서울역'),d=place('destination','서울역');
 assert.equal(pins.overlapRole([{place:o},{place:d}],o,d),'both');
 const markup=pins.html(o,{kind:'both',count:2});
 assert.match(markup,/yg-map-pin--both/);
 assert.match(markup,/<span>출발<\/span><span>도착<\/span>/);
 assert.doesNotMatch(markup,/<b>2<\/b>/);
 assert.match(markup,/aria-label="출발·도착"/);
});
test('nearby but nonidentical locations still use a normal count cluster',async()=>{
 const pins=await pinCore();
 const o=place('origin','서울역'),d=place('destination','서울역',37.5511,126.989);
 assert.equal(pins.overlapRole([{place:o},{place:d}],o,d),null);
 assert.match(pins.html(o,{kind:'cluster',count:2}),/<b>2<\/b>/);
 assert.equal(pins.overlapRole([{place:o}],o,place('x','서울역')), 'both');
});
test('both map renderers and static fallbacks use shared role detection at identical GPS',async()=>{
 const [app,search,fallback,css]=await Promise.all([
  read('public/static/app.js'),read('public/static/search-screen.js'),
  read('public/static/step2-map-fallback.js'),read('public/static/endpoint-clarity-v89.css')
 ]);
 assert.match(app,/YeoPins\?\.overlapRole\?\.\(group,d\.liveOrigin\|\|d\.origin,d\.destination\)/);
 assert.match(app,/const kind=overlap\|\|/);
 assert.match(search,/YeoPins\?\.overlapRole\?\.\(group,d\?\.origin,d\?\.destination\)/);
 assert.match(search,/YeoPins\?\.overlapRole\?\.\(\[\{place:target\}\],d\?\.origin,d\?\.destination\)/);
 assert.match(fallback,/YeoPins\?\.overlapRole\?\.\(\[\{place:e\.place\}\],d\?\.origin,d\?\.destination\)/);
 assert.match(css,/\.yg-map-pin--both \.yg-map-pin__head/);
 assert.match(css,/\.yg-step2-static-pin\.is-both/);
 assert.match(css,/\.search-static-pin\.is-both/);
});
test('endpoint chooser exposes current role, selects current row first and explicitly says tap again to clear',async()=>{
 const [ui,html,css]=await Promise.all([
  read('public/static/vnext.js'),read('public/index.html'),read('public/static/endpoint-clarity-v89.css')
 ]);
 assert.match(html,/id="yg-endpoint-chooser-help"/);
 assert.match(html,/id="yg-endpoint-chooser-current"/);
 assert.match(html,/yg-role-toggle-help/);
 assert.match(ui,/items\.sort\(\(a,b\)=>/);
 assert.match(ui,/currently selected|다시 누르면 해제|다시 눌러 해제/);
 assert.match(ui,/aria-pressed="'\+String\(chosen\)/);
 assert.match(ui,/data-chooser-selected="'\+String\(chosen\)/);
 assert.match(ui,/selected\?app\.clearCollectedEndpoint\(kind\):app\.setCollectedRole/);
 assert.doesNotMatch(html,/id="yg-endpoint-chooser-clear"/);
 assert.match(css,/\.yg-endpoint-chooser-place\.is-selected/);
});
test('same location can serve both roles; unassigning one preserves the other',async()=>{
 const source=await read('public/static/app.js');
 const start=source.indexOf('function clearCollectedEndpoint(kind){');
 const end=source.indexOf('function removeCollectedPlace(',start);
 assert.ok(start>=0&&end>start);
 const d={origin:place('s','서울역'),destination:place('e','서울역'),stops:[],date:'2026-11-05'};
 const same=(a,b)=>a&&b&&a.lat===b.lat&&a.lng===b.lng&&a.name===b.name;
 const roles={configured:p=>Boolean(p&&!/미설정/.test(p.name)),same};
 const state={active:0};
 const clear=new Function('day','state','window','uid','syncLinkedOrigins','invalidateRoutes','selectedMapStop','refresh','document','Event',
 source.slice(start,end)+';return clearCollectedEndpoint')(
 ()=>d,state,{YGPlaceRoles:roles},()=> 'stop-from-origin',()=>{},()=>{},null,()=>{},
 {dispatchEvent:()=>{}},Event
 );
 assert.equal(clear('origin').ok,true);
 assert.match(d.origin.name,/미설정/);
 assert.equal(d.destination.name,'서울역');
 assert.equal(d.stops.length,0,'destination already covers the shared location');
 assert.equal(clear('destination').ok,true);
 assert.match(d.destination.name,/미설정/);
 assert.equal(d.stops.length,1,'clearing the final role preserves the saved visit');
});
test('modified scripts parse and stylesheet gets included in build',async()=>{
 const html=await read('public/index.html');
 assert.match(html,/endpoint-clarity-v89\.css\?v=1\.0\.0/);
 assert.match(html,/route-pins\.js\?v=8\.9\.1/);
 for(const path of ['public/static/vnext.js','public/static/app.js','public/static/search-screen.js','public/static/route-pins.js','public/static/step2-map-fallback.js']){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(r.status,0,path+'\n'+r.stderr);
 }
});
