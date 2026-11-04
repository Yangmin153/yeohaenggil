import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {optimalMatrix,heuristicOrder} from '../lib/core.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
function stop(id,name,lat,lng,locked=false){return{id,name,lat,lng,locked};}
async function positionHarness({fixedOther=false}={}){
 const text=await read('public/static/app.js');
 const a=text.indexOf('function setRouteStopPosition('),b=text.indexOf('// Result-step adjustments',a);
 assert.ok(a>0&&b>a);
 const A=stop('a','카페',37.58,126.978),B=stop('b','관광지',37.57,126.99,fixedOther),C=stop('c','맛집',37.6,126.95),D=stop('d','쇼핑',37.56,126.97);
 const d={id:'day1',mode:'auto',origin:stop('start','숙소',37.57,126.97),destination:stop('end','숙소',37.57,126.97),stops:[A,B,C,D],result:{orderIds:['a','b','c','d']}};
 const ctx={day:()=>d,state:{dirtyDayIds:new Set()},sceneSignature:'before',sceneResult:{},mapFitQueued:false,refresh:()=>{},document:{dispatchEvent:()=>{}},Event:class{constructor(type){this.type=type;}},toast:()=>{},Number,Map,Set,Array};
 const fn=vm.runInNewContext(text.slice(a,b)+'\nsetRouteStopPosition',ctx);
 return {fn,d};
}
test('choose the original third stop for first; retain automatic mode and optimize remaining stops',async()=>{
 const {fn,d}=await positionHarness();
 assert.equal(fn('c',1),true);
 assert.deepEqual(d.stops.map(x=>x.id),['c','a','b','d']);
 assert.equal(d.stops[0].locked,true);
 assert.equal(d.stops[1].locked,false);
 assert.equal(d.mode,'auto');
 assert.equal(d.result,null);
 const original=d.stops;
 const start=d.origin,end=d.destination,n=original.length;
 const matrix=new Map();
 for(let i=0;i<n+2;i++)for(let j=0;j<n+2;j++){
  matrix.set(i+':'+j,{durationMinutes:1+Math.abs(i-j)*2,distanceMeters:100});
 }
 const best=optimalMatrix(n,original,start,end,matrix);
 assert.equal(best.length,n);
 assert.equal(best[0],1,'Exact route optimization must honor chosen visit 1');
 const heuristic=heuristicOrder(original,start,end);
 assert.equal(heuristic[0],1,'Heuristic must also honor chosen visit 1');
});
test('editing a preferred stop never silently displaces another preferred stop',async()=>{
 const {fn,d}=await positionHarness({fixedOther:true});
 assert.equal(fn('c',2),false);
 assert.deepEqual(d.stops.map(x=>x.id),['a','b','c','d']);
 assert.equal(fn('c',1),true);
 assert.deepEqual(d.stops.map(x=>x.id),['c','b','a','d']);
 assert.equal(d.stops[1].locked,true);
});
test('search UI remains open with saved location marker, without map-based place picking',async()=>{
 const search=await read('public/static/search-screen.js');
 const quick=await read('public/static/quick-add.js');
 assert.match(search,/function addSuccess\(message,place=null\)/);
 const area=search.slice(search.indexOf('function addSuccess('),search.indexOf('function completeEndpoint('));
 assert.match(area,/hide\(\)/);
 assert.match(search,/previewSource='added'/);
 assert.match(search,/selectedMarker=mark\(selected,true\)/);
 assert.match(search,/searchMap\.panTo\(new window\.naver\.maps\.LatLng/);
 assert.doesNotMatch(search,/maps\.Event\.addListener\(searchMap,'click'/);
 assert.doesNotMatch(search,/maps\.Event\.addListener\(m,'click'/);
 assert.match(quick,/YeoSearch\.completeEndpoint\(item\)/);
});
test('shared page renders exactly one live Naver map with markers, without any synthetic layered maps',async()=>{
 const [html,js,css]=await Promise.all(['public/view.html','public/static/view-trip.js','public/static/shared-trip.css'].map(read));
 assert.match(html,/id="sv-map"/);
 assert.match(html,/id="sv-map-unavailable"/);
 assert.doesNotMatch(html,/id="sv-fallback-map"/);
 assert.doesNotMatch(html,/class="sv-static-background"/);
 assert.doesNotMatch(js,/renderStaticMap|svgMap|sv-static-background|sv-fallback-map|new maps\.Polyline/);
 assert.match(js,/new window\.naver\.maps\.Map/);
 assert.match(js,/new maps\.Marker/);
 assert.match(js,/clearMarkers\(\)/);
 assert.match(css,/\.sv-map-wrap\{position:relative/);
});
test('visit editor uses a checkbox, one edit button, a desired position selector and no arrow controls',async()=>{
 const [html,js]=await Promise.all(['public/index.html','public/static/vnext.js'].map(read));
 for(const id of ['yg-adjust-list','yg-adjust-edit-selected','yg-position-dialog','yg-position-select','yg-position-apply'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(js,/data-adjust-select/);
 assert.match(js,/selectedAdjustId/);
 assert.match(js,/app\.setRouteStopPosition\(id,Number\(selected\)\)/);
 assert.doesNotMatch(js,/data-route-up|data-route-down|data-route-lock/);
 assert.match(js,/await calculate\(\)/);
});
