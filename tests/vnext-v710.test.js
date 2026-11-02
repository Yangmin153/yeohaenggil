import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

async function initialMapFunctions(day,region=''){
 const source=await read('public/static/search-screen.js');
 const start=source.indexOf('const KOREA_CENTER=');
 const end=source.indexOf('function maybeMap()',start);
 assert.ok(start>=0&&end>start,'search map viewport helpers exist');
 const snippet=source.slice(start,end);
 const view=new Function('window','centers',snippet+';return {mapCenter,mapStartZoom,mapViewKey,chosenPlace};');
 const backgroundJejuMap={getCenter:()=>({lat:()=>33.39,lng:()=>126.55})};
 return view({TripApp:{getDay:()=>day,getMap:()=>backgroundJejuMap},YeoNext:{searchRegion:()=>region}},
  {부산:[35.1796,129.0756],제주:[33.489,126.498]});
}
const placeholder=name=>({id:name,name,lat:33.489,lng:126.498});

test('a first-time traveler sees Korea rather than legacy Jeju or the background map',async()=>{
 const funcs=await initialMapFunctions({
  id:'new-day',stops:[],origin:placeholder('출발지 미설정'),
  destination:placeholder('도착지 미설정')
 });
 assert.deepEqual(funcs.mapCenter(),[36.35,127.9]);
 assert.equal(funcs.mapStartZoom(),7);
 assert.equal(funcs.chosenPlace(),null);
});

test('existing trip opens its chosen stop area rather than nationwide overview',async()=>{
 const stop={id:'bupyeong',name:'부평역',lat:37.49,lng:126.722,address:'인천 부평구'};
 const funcs=await initialMapFunctions({id:'today',stops:[stop],
  origin:placeholder('출발지 미설정'),destination:placeholder('도착지 미설정')});
 assert.deepEqual(funcs.mapCenter(),[stop.lat,stop.lng]);
 assert.equal(funcs.mapStartZoom(),12);
 assert.match(funcs.mapViewKey(),/bupyeong/);
});

test('explicit region choice works only when deliberately supplied',async()=>{
 const empty={id:'today',stops:[],origin:placeholder('출발지 미설정'),destination:placeholder('도착지 미설정')};
 const funcs=await initialMapFunctions(empty,'부산');
 assert.deepEqual(funcs.mapCenter(),[35.1796,129.0756]);
 assert.equal(funcs.mapStartZoom(),11);
});

test('both itinerary and full-screen search initialize at neutral nationwide zoom and refresh asset cache',async()=>{
 const [app,search,html]=await Promise.all(['public/static/app.js','public/static/search-screen.js','public/index.html'].map(read));
 assert.match(app,/new naver\.maps\.LatLng\(36\.35,127\.9\),zoom:7/);
 assert.match(search,/zoom:mapStartZoom\(\)/);
 assert.match(search,/searchMap\.setZoom\(mapStartZoom\(\)\)/);
 assert.doesNotMatch(search,/return c\?\[c\.lat\(\),c\.lng\(\)\]/);
 assert.match(html,/app\.js\?v=7\.12\.0/);
 assert.match(html,/search-screen\.js\?v=7\.12\.0/);
 assert.match(html,/id="quick-region-label" class="quick-region-label">전국/);
});
