import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {focusedStaticMapLayout} from '../public/static/static-map-layout.js';
import {GET as GETStaticMap} from '../api/static-map.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('focus layout stays centered on newest added place without shifting toward older stops',()=>{
 const points=[{x:37.58,y:126.977},{x:37.582,y:126.984},{x:37.56,y:126.99}];
 const layout=focusedStaticMapLayout(points,points[2],390,530,13);
 assert.equal(layout.lat,37.56);
 assert.equal(layout.lng,126.99);
 assert.equal(layout.level,13);
 assert.ok(Math.abs(layout.pixels[2].x-195)<0.01);
 assert.ok(Math.abs(layout.pixels[2].y-265)<0.01);
 assert.ok(layout.pixels[0].x!==layout.pixels[2].x);
 assert.equal(focusedStaticMapLayout(points,{x:34,y:126.5},390,530,13),null);
});
test('same-origin Static Map API validates focused point, dimensions, and abuse boundaries',async()=>{
 const req=search=>new Request('https://example.com/api/static-map?'+search);
 for(const qs of [
 'p=37.580000%2C126.977000&f=37.590000%2C126.977000',
 'p=37.580000%2C126.977000&f=37.580000%2C126.977000&w=1600',
 'p=37.580000%2C126.977000&f=37.580000%2C126.977000&z=18'
 ]){const response=await GETStaticMap(req(qs));assert.equal(response.status,422);}
});
test('search results add only by button, then Naver map preview contains saved and focused markers without candidates',async()=>{
 const [screen,html,css,quick]=await Promise.all(['public/static/search-screen.js','public/index.html','public/static/search-transition.css','public/static/quick-add.js'].map(read));
 assert.match(quick,/YeoSearch\?\.addSuccess\?\.\(item\.name/);
 assert.match(screen,/if\(place\)focusAdded\(place\)/);
 assert.match(screen,/items=\[\];clearMarkers\(\)/);
 assert.match(screen,/selectedMarker=mark\(selected,true\)/);
 assert.match(screen,/refreshSavedMarkers\(\);selectedMarker=mark\(selected,true\)/);
 assert.match(screen,/getMapDiagnostics:/);
 assert.match(screen,/searchMap\.panTo\(new window\.naver\.maps\.LatLng/);
 assert.match(screen,/renderStaticFallback\(\)/);
 assert.ok(!screen.includes("maps.Event.addListener(searchMap,'click'"));
 assert.ok(!screen.includes("maps.Event.addListener(m,'click'"));
 assert.ok(html.includes('id="search-static-fallback"'));
 assert.match(css,/\.search-static-pin/);
});
test('departure and destination have distinct accessible search stages and a short, nonblocking handoff notice',async()=>{
 const [screen,html,css]=await Promise.all(['public/static/search-screen.js','public/index.html','public/static/search-transition.css'].map(read));
 for(const id of ['search-stage-label','search-stage-help','search-stage-icon','search-transition-toast'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/aria-live="polite"/);
 assert.ok(screen.includes("출발지를 설정했어요. 이제 도착지를 선택해 주세요."));
 assert.ok(screen.includes('출발지와 도착지를 설정했어요.'));
 assert.match(screen,/transitionTimer=setTimeout/);
 assert.ok(screen.includes("show('destination',{transitionMessage:"));
 assert.ok(screen.includes("screen.dataset.searchKind=searchKind"));
 assert.match(css,/data-search-kind="origin"/);
 assert.match(css,/data-search-kind="destination"/);
});
