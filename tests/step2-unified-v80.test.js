import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('all three edit actions are in one STEP2 card with collapsible saved visits',async()=>{
 const html=await read('public/index.html'),start=html.indexOf('<section id="yg-daily-editor"'),end=html.indexOf('<div id="yg-map-caption"',start);
 const card=html.slice(start,end);
 for(const id of ['yg-add-visit','yg-open-stops','yg-inline-stops','yg-endpoint-section','yg-origin-pick','yg-dest-pick'])assert.ok(card.includes('id="'+id+'"'),id);
 assert.ok(html.includes('id="yg-step2-readiness"'));assert.match(html,/id="yg-calculate"[^>]*disabled>동선 확인하기/);
});
test('readiness requires stops, an origin and destination on every day',async()=>{
 const src=await read('public/static/vnext.js'),part=src.slice(src.indexOf('function readiness(){'),src.indexOf('function updateReadiness(){'));
 const configured=p=>p?.name!=='미설정'&&!!p?.name;
 const fn=new Function('days','app','dateText','configured',part+';return readiness()');
 const day={date:'2026-11-04',stops:[],origin:{name:'미설정'},destination:{name:'미설정'}};
 const testDay=(days,pending=[])=>fn(()=>days,{unassignedStops:()=>pending},d=>d,configured);
 assert.equal(testDay([day]).ready,false);
 day.stops=[{id:'1'}];day.origin={name:'서울역'};day.destination={name:'인천공항'};
 assert.equal(testDay([day]).ready,true);
 assert.equal(testDay([day,{...day,destination:{name:'미설정'}}]).ready,false);
 assert.equal(testDay([day],[{id:'x'}]).ready,false);
});
test('setting an endpoint closes search without a forced destination handoff',async()=>{
 const src=await read('public/static/search-screen.js'),part=src.slice(src.indexOf('function completeEndpoint(item){'),src.indexOf('function chooseAdd(){'));
 const calls=[],app={setEndpointFromSearch:()=>true,getDay:()=>({origin:{id:'o'}}),toast:()=>{},focusPlace:id=>calls.push(id)};
 const f=new Function('searchKind','endpointMode','window','hide','requestAnimationFrame',part+';return completeEndpoint;');
 assert.equal(f('origin',()=>true,{TripApp:app},()=>calls.push('hide'),cb=>cb())({name:'서울역'}),true);
 assert.deepEqual(calls,['hide','o']);assert.ok(!part.includes("show('destination'"));
});
test('map candidates are hidden and saved map positions are real Naver images',async()=>{
 const [search,fallback,css,html]=await Promise.all(['public/static/search-screen.js','public/static/step2-map-fallback.js','public/static/step2-unified.css','public/index.html'].map(read));
 const area=search.slice(search.indexOf('function paintMarkers(){'),search.indexOf('function showMode(',search.indexOf('function paintMarkers(){')));
 assert.ok(!area.includes('for(const item of items'));assert.ok(area.includes('refreshSavedMarkers()'));
 assert.ok(fallback.includes('focusedStaticMapLayout(coords,center,w,h,13)'));
 assert.ok(fallback.includes("img.src='/api/static-map?'"));
 assert.ok(css.includes('pointer-events:none'));assert.ok(html.includes('step2-map-fallback.js?v=1.1.0'));
});
