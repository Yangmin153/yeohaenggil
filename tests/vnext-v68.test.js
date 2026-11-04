import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function navigation(){
 const globals={URLSearchParams};globals.globalThis=globals;vm.runInNewContext(await read('public/static/navigation.js'),globals);
 return globals.TripNaviPlanner;
}
const place=(id,i)=>({id,name:'방문지 '+id,lat:33.3+i*0.01,lng:126.4+i*0.03});
const makeDay=(n=12)=>{
 const stops=Array.from({length:n},(_,i)=>place('place-'+i,i));
 const optimized=[...stops].reverse(),origin=place('origin',80),destination=place('end',81);
 const entries=[origin,...optimized,destination].map(p=>({place:p}));
 return {id:'day-1',origin,destination,stops,result:{orderIds:optimized.map(p=>p.id),entries}};
};
test('external navigation starts at GPS and follows the calculated visit order, then destination',async()=>{
 const nav=await navigation(),d=makeDay(12);
 for(const provider of ['naver','kakao']){
  const parts=nav.sections(d,provider),flattened=parts.flatMap(p=>[...p.via,p.destination]);
  assert.deepEqual(JSON.parse(JSON.stringify(flattened.map(x=>x.id))),[...d.result.orderIds,'end']);
  assert.ok(parts.every(p=>p.via.length<=nav.MAX_VIA[provider]));
  assert.equal(parts.at(-1).destination.id,'end');
  assert.equal(parts[0].startHint,'현재 위치');
 }
 assert.equal(nav.sections(d,'naver').length,3);
 assert.equal(nav.sections(d,'kakao').length,4);
});
test('when route has 0 visits, only the actual planned endpoint becomes navigation destination',async()=>{
 const nav=await navigation(),d=makeDay(0),parts=nav.sections(d,'naver');
 assert.equal(parts.length,1);assert.equal(parts[0].destination.id,'end');assert.equal(parts[0].via.length,0);
});
test('NAVER navigation URI contains 1..5 waypoints and omits explicit origin coordinates',async()=>{
 const nav=await navigation(),d=makeDay(12),first=nav.sections(d,'naver')[0];
 const uri=nav.naverUrl(first,'https://example.vercel.app'),u=new URL(uri);
 assert.equal(u.protocol,'nmap:');assert.equal(u.hostname,'navigation');
 assert.equal(u.searchParams.get('slat'),null);assert.equal(u.searchParams.get('slng'),null);
 assert.equal(u.searchParams.get('dlat'),String(first.destination.lat));
 assert.equal(u.searchParams.get('dlng'),String(first.destination.lng));
 assert.equal(u.searchParams.get('v1lat'),String(first.via[0].lat));
 assert.equal(u.searchParams.get('v5lng'),String(first.via[4].lng));
 assert.equal(u.searchParams.get('v6lat'),null);
 assert.equal(u.searchParams.get('appname'),'https://example.vercel.app');
});
test('KakaoNavi GPS navigation uses WGS84 longitude x and latitude y for all 3 waypoints',async()=>{
 const nav=await navigation(),d=makeDay(12),part=nav.sections(d,'kakao')[0],data=nav.kakaoArguments(part);
 assert.equal(data.coordType,'wgs84');assert.equal(data.x,part.destination.lng);
 assert.equal(data.y,part.destination.lat);assert.equal(data.viaPoints.length,3);
 assert.equal(data.viaPoints[0].x,part.via[0].lng);
 assert.equal(data.viaPoints[0].y,part.via[0].lat);
});
test('outdated or incomplete calculated routes cannot be transferred to navigation',async()=>{
 const nav=await navigation(),d=makeDay(3);
 d.result.orderIds=[...d.result.orderIds,'missing'];assert.equal(nav.sections(d,'naver').length,0);
 d.result.orderIds=d.result.orderIds.slice(0,-1);d.result.entries[1].place.id='tampered';
 assert.equal(nav.sections(d,'naver').length,0);
});
test('endpoint search uses exact same full-screen screen and retains saved visit markers on selected search candidate',async()=>{
 const [screen,quick,vnext,app]=await Promise.all(['public/static/search-screen.js','public/static/quick-add.js','public/static/vnext.js','public/static/app.js'].map(read));
 assert.match(screen,/function show\(kind='stop',options=\{\}\)/);
 assert.match(screen,/function endpointMode\(\)/);
 assert.match(screen,/refreshSavedMarkers\(\);selectedMarker=mark\(selected,true\)/);
 assert.match(screen,/function completeEndpoint\(item\)/);
 assert.match(quick,/window\.YeoSearch\.preview\(item\)/);
 assert.match(vnext,/data-chooser-place/);
 assert.doesNotMatch(screen,/function chooseRole\(kind\)/);
 assert.match(app,/function setCollectedRoleFromSearch\(item,role\)/);
 assert.match(app,/function setEndpointFromSearch\(kind,item\)/);assert.match(app,/const result=setCollectedRoleFromSearch\(item,kind\)/);
});
test('navigation chooser is present and Kakao JS key is optional, never server REST API key',async()=>{
 const [html,config,css]=await Promise.all(['public/index.html','api/config.js','public/static/vnext.css'].map(read));
 for(const id of ['yg-nav-open','yg-nav-modal','yg-nav-segments','yg-nav-start'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(config,/KAKAO_JAVASCRIPT_KEY\|\|env\.KAKAO_JS_KEY/);
 assert.doesNotMatch(config,/kakaoJsKey:.*KAKAO_REST_API_KEY/);
 assert.match(css,/\.yg-nav-panel/);
});
