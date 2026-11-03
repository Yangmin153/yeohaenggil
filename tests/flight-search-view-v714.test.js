import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {valid,rangeDays,applyRangeChoice} from '../public/static/date-range-core.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('ticket-style range selects departure first, then return, including a one-day trip',()=>{
 assert.equal(valid('2026-11-03'),true);
 assert.equal(valid('2026-02-30'),false);
 assert.equal(rangeDays('2026-11-03','2026-11-05'),3);
 let choice=applyRangeChoice('','','2026-11-03');
 assert.deepEqual(choice,{a:'2026-11-03',b:'',error:''});
 choice=applyRangeChoice(choice.a,choice.b,'2026-11-03');
 assert.deepEqual(choice,{a:'2026-11-03',b:'2026-11-03',error:''});
 choice=applyRangeChoice(choice.a,choice.b,'2026-12-01');
 assert.deepEqual(choice,{a:'2026-12-01',b:'',error:''});
});
test('earlier second date restarts departure, 10-day limit never overwrites a valid itinerary',()=>{
 let selected=applyRangeChoice('','','2026-11-08');
 assert.deepEqual(applyRangeChoice(selected.a,selected.b,'2026-11-04'),{a:'2026-11-04',b:'',error:''});
 const failed=applyRangeChoice(selected.a,selected.b,'2026-11-22');
 assert.equal(failed.a,'2026-11-08');
 assert.equal(failed.b,'');
 assert.match(failed.error,/최대 10일/);
 selected=applyRangeChoice(selected.a,selected.b,'2026-11-17');
 assert.equal(selected.error,'');
 assert.equal(rangeDays(selected.a,selected.b),10);
});
test('calendar visually exposes one date grid and keeps existing hidden native input handlers',async()=>{
 const [html,ui]=await Promise.all(['public/index.html','public/static/date-range-picker.js'].map(read));
 for(const id of ['yg-date-range-open','yg-calendar','yg-calendar-grid','yg-start-date','yg-end-date','yg-duration'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('type="date" id="yg-start-date"'));
 assert.ok(ui.includes("if(!rangeStart||!rangeEnd)return;"));
 assert.ok(ui.includes("end.dispatchEvent(new Event('change'"));
 assert.ok(ui.includes("aria-expanded"));
 assert.ok(!html.includes('id="yg-three-list"'));
});
test('search selection is text-results-only, never a map click or map marker selection',async()=>{
 const [search,quick,app,html]=await Promise.all(['public/static/search-screen.js','public/static/quick-add.js','public/static/app.js','public/index.html'].map(read));
 assert.ok(!search.includes("maps.Event.addListener(searchMap,'click'"));
 assert.ok(!search.includes("maps.Event.addListener(m,'click'"));
 assert.ok(!search.includes("window.naver.maps.Event.addListener(pin,'click'"));
 assert.ok(search.includes("completeEndpoint(item)"));
 assert.ok(quick.includes("window.YeoSearch.completeEndpoint(item)"));
 assert.ok(html.includes('id="btn-pick-map-primary" hidden disabled'));
 assert.ok(app.includes("startMapPick(){toast('장소 검색 결과에서 방문지를 선택해 주세요.');}"));
 assert.ok(!search.includes("show('destination',{transitionMessage:"));
});
test('STEP3 selects one visit and edits its exact visit number, without arrows or lock actions',async()=>{
 const [html,js,app]=await Promise.all(['public/index.html','public/static/vnext.js','public/static/app.js'].map(read));
 assert.ok(html.includes('id="yg-adjust-edit-selected"'));
 assert.ok(html.includes('id="yg-position-select"'));
 assert.ok(html.includes('id="yg-position-apply"'));
 assert.ok(!html.includes('id="yg-three-list"'));
 assert.ok(!js.includes("data-route-up="));
 assert.ok(!js.includes("data-route-down="));
 assert.ok(!js.includes("data-route-lock="));
 assert.ok(js.includes('data-adjust-select'));
 assert.ok(js.includes('app.setRouteStopPosition(id,Number(selected))'));
 assert.ok(app.includes('function setRouteStopPosition(id,position)'));
 assert.ok(js.includes('await calculate()'));
});
test('sharing offers only link/text and viewer map has real tiles with aligned transparent markers',async()=>{
 const [html,view,viewer,share]=await Promise.all(['public/index.html','public/view.html','public/static/view-trip.js','public/static/share-trip.js'].map(read));
 assert.ok(html.includes('data-share-action="copy"'));
 assert.ok(html.includes('data-share-action="text"'));
 assert.ok(!html.includes('data-share-action="save"'));
 assert.ok(!html.includes('data-share-action="image"'));
 assert.ok(!view.includes('id="sv-save-card"'));
 assert.ok(!view.includes('id="sv-share-card"'));
 assert.ok(!viewer.includes('sv-fallback-map'));
 assert.ok(viewer.includes('drawMap()'));
 assert.ok(!viewer.includes('sv-static-background'));
 assert.ok(!view.includes('<svg'));
 assert.ok(!view.includes('sv-static-background'));
 assert.ok(viewer.includes('function focusPlace(i,scroll=true)'));
 assert.ok(!viewer.includes('new maps.Polyline'));
 assert.ok(!share.includes('buildTripCard'));
});

test('a Naver SDK marker disposal exception cannot interrupt endpoint selection',async()=>{
 const app=await read('public/static/app.js');
 const begin=app.indexOf('function clearMap(){'),end=app.indexOf('function centerMapAtRegion(',begin);
 assert.ok(begin>=0&&end>begin);
 let hidden=false,closed=false;
 const mock={setMap(){throw new TypeError("Cannot read properties of null (reading 'capitalize')");},setVisible(v){hidden=v===false;}};
 const run=new Function('markers','paths','markerInfo','console',app.slice(begin,end)+';clearMap();');
 assert.doesNotThrow(()=>run([mock],[],{close(){closed=true;}},{warn(){}}));
 assert.equal(hidden,true);
 assert.equal(closed,true);
});
