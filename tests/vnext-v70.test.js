import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const point=i=>({id:'p'+i,name:'장소 '+i,lat:33.4+i*.001,lng:126.4+i*.002});
const makeDay=n=>{
 const stops=Array.from({length:n},(_,i)=>point(i));
 const origin=point(80),destination=point(99),ordered=[...stops].reverse();
 return {id:'day',origin,destination,stops,result:{orderIds:ordered.map(p=>p.id),entries:[origin,...ordered,destination].map(place=>({place}))}};
};
async function planner(){
 const root={URLSearchParams,URL};root.globalThis=root;
 vm.runInNewContext(await read('public/static/navigation.js'),root);
 return root.TripNaviPlanner;
}
test('direct GPS mode ignores all visits and goes only to the configured final destination',async()=>{
 const plan=await planner(),day=makeDay(14);
 for(const provider of ['naver','kakao']){
  const routes=plan.sections(day,provider,'direct');
  assert.equal(routes.length,1);assert.equal(routes[0].via.length,0);assert.equal(routes[0].destination.id,'p99');
 }
 const url=new URL(plan.naverUrl(plan.sections(day,'naver','direct')[0],'https://example.com'));
 assert.equal(url.searchParams.get('v1lat'),null);
 assert.equal(url.searchParams.get('slat'),null);
 const data=plan.kakaoArguments(plan.sections(day,'kakao','direct')[0]);
 assert.equal(data.viaPoints.length,0);
});
test('optimized route with many stops is split without dropping, duplicating or reordering visits',async()=>{
 const plan=await planner(),day=makeDay(30),want=[...day.result.orderIds,'p99'];
 for(const provider of ['naver','kakao']){
  const routes=plan.sections(day,provider,'via');
  assert.equal(routes.length,provider==='naver'?6:8);
  assert.ok(routes.every(x=>x.via.length<=plan.MAX_VIA[provider]));
  const received=routes.flatMap(r=>[...r.via,r.destination].map(p=>p.id));
  assert.deepEqual(JSON.parse(JSON.stringify(received)),want);
  assert.equal(new Set(received).size,want.length);
  assert.ok(routes.every((r,i)=>r.index===i));
  assert.ok(routes.every(r=>r.startHint==='현재 위치'||r.startHint.includes('현재 위치')));
 }
});
test('Kakao Navi uses viaPoints and direct user click rather than async SDK auto-launch',async()=>{
 const src=await read('public/static/navigation.js');
 assert.match(src,/Navi\.start\(kakaoArguments\(part\)\)/);
 assert.match(src,/function loadKakao\(/);
 assert.doesNotMatch(src,/loadKakao\(\)\.then\(k=>k\.Navi\.start/);
 assert.match(src,/root\.YGScrollLock\?\.lock\('navigation'\)/);
 assert.match(src,/root\.YGScrollLock\?\.unlock\('navigation'\)/);
 assert.match(src,/sessionStorage\.setItem\(storageKey/);
});
test('new navigation popup supports only two choices and an uncomplicated next-guidance control',async()=>{
 const [html,nav,css]=await Promise.all([read('public/index.html'),read('public/static/navigation.js'),read('public/static/vnext.css')]);
 assert.match(html,/방문지 한 곳으로 안내/);
 assert.match(html,/모든 방문지 순서대로 안내/);
 assert.match(html,/yg-nav-choice--naver/);
 assert.match(html,/yg-nav-choice--kakao/);
 assert.doesNotMatch(html,/<option value="naver">/);
 assert.match(nav,/lastOpened>=0\?'다음 길안내'/);
 assert.doesNotMatch(nav,/<strong>'\+\(part\.index\+1\)\+'구간/);
 assert.match(css,/yg-nav-choice--naver/);
 assert.match(css,/yg-nav-choice--kakao/);
});
test('all four current dialogs use the common owner-based mobile-safe scroll lock',async()=>{
 const [html,lock,visit,search,auth,nav]=await Promise.all(
 ['public/index.html','public/static/scroll-lock.js','public/static/vnext.js','public/static/search-screen.js','public/static/accounts.js','public/static/navigation.js'].map(read));
 assert.match(html,/scroll-lock\.js\?v=7\.0\.0/);
 assert.match(lock,/const owners=new Set\(\)/);
 for(const [s,owner] of [[visit,'visit-sheet'],[search,'search-screen'],[auth,'account'],[nav,'navigation']]){
  assert.ok(s.includes("YGScrollLock?.lock('"+owner+"')"));
  assert.ok(s.includes("YGScrollLock?.unlock('"+owner+"')"));
 }
});
test('legacy place editor keeps scroll lock but direct map picking is disabled',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/YGScrollLock\?\.lock\('place-editor'\)/);
 assert.match(app,/YGScrollLock\?\.unlock\('place-editor'\)/);
 const picking=app.slice(app.indexOf('function startMapPick()'),app.indexOf('// — 지도 —'));
 assert.match(picking,/장소 검색 결과에서 방문지를 선택해 주세요/);
 assert.doesNotMatch(picking,/mapPicking=true/);
});
test('step2 headings share same typographic scale and each task has one short helper',async()=>{
 const [html,css]=await Promise.all([read('public/index.html'),read('public/static/vnext.css')]);
 assert.match(html,/방문지부터 출발·도착지까지 원하는 순서대로 설정하세요/);
 assert.match(html,/각각 선택하거나 나중에 변경할 수 있어요/);
 assert.match(css,/font-size:clamp\(22px,4\.6vw,30px\)!important/);
});
