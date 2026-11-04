import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const example=(i)=>({id:'place'+i,name:'장소'+i,lat:33.4+i*.01,lng:126.3+i*.02});
async function planner(){
 const root={URLSearchParams,URL};root.globalThis=root;
 vm.runInNewContext(await read('public/static/navigation.js'),root);
 return root.TripNaviPlanner;
}
const day=()=>{
 const origin=example(50),destination=example(51),stops=[example(0),example(1),example(2),example(3)];
 return {id:'d1',origin,destination,stops,result:{orderIds:['place3','place1','place2','place0'],entries:[origin,stops[3],stops[1],stops[2],stops[0],destination].map(place=>({place}))}};
};
test('Kakao JavaScript Navi.start uses viaPoints (NOT unsupported viaList)',async()=>{
 const p=await planner(),parts=p.sections(day(),'kakao'),first=p.kakaoArguments(parts[0]);
 assert.equal(parts[0].via.length,3);
 assert.ok(Array.isArray(first.viaPoints));
 assert.deepEqual(JSON.parse(JSON.stringify(first.viaPoints)).map(p=>p.name),['장소3','장소1','장소2']);
 assert.equal(first.viaList,undefined);
 assert.equal(first.x,parts[0].destination.lng);
 assert.equal(first.y,parts[0].destination.lat);
 const src=await read('public/static/navigation.js');
 assert.match(src,/root\.Kakao\.Navi\.start\(kakaoArguments\(part\)\)/);
 assert.match(src,/kakao_js_sdk\/2\.8\.4/);
});
test('Naver navigation has waypoints 1-5 and starts from current location',async()=>{
 const p=await planner(),parts=p.sections(day(),'naver'),url=new URL(p.naverUrl(parts[0],'https://example.com'));
 assert.equal(url.searchParams.get('slat'),null);
 assert.equal(url.searchParams.get('slng'),null);
 assert.equal(url.searchParams.get('v1name'),'장소3');
 assert.equal(url.searchParams.get('v4name'),'장소0');
 assert.equal(url.searchParams.get('dname'),'장소51');
 const preview=new URL(p.naverRouteUrl(parts[0],'https://example.com'));
 assert.equal(preview.protocol,'nmap:');
 assert.equal(preview.host,'route');
 assert.equal(preview.pathname,'/car');
 assert.equal(preview.searchParams.get('v1name'),'장소3');
 const intent=p.naverLaunchUrl(parts[0],'https://example.com','Mozilla/5.0 (Linux; Android 14)');
 assert.match(intent,/^intent:\/\/route\/car\?/);
 assert.match(intent,/v1name=%EC%9E%A5%EC%86%8C3/);
 assert.match(intent,/v4lat=/);
 assert.match(intent,/#Intent;scheme=nmap;action=android\.intent\.action\.VIEW;/);
 assert.match(intent,/package=com\.nhn\.android\.nmap;end$/);
 assert.equal(p.naverLaunchUrl(parts[0],'https://example.com','iPhone').startsWith('nmap://route/car?'),true);
});
test('search marker renderer always rehydrates saved pins, without stale signature cache',async()=>{
 const src=await read('public/static/search-screen.js');
 const start=src.indexOf('function refreshSavedMarkers(){'),end=src.indexOf('function mark(item,pickedOne=false){',start);
 const sub=src.slice(start,end);
 assert.match(sub,/savedMarkerRegistry\.delete\(key\)/);
 assert.match(sub,/for\(const entry of existingPlaces\(\)\)/);
 assert.match(sub,/savedMarkerRegistry\.set\(key,pin\)/);
 assert.doesNotMatch(sub,/signature===savedSignature/);
 assert.match(src,/if\(searchMap&&!dynamicUnavailable\)return false;/);
 assert.match(src,/const created=maybeMap\(\)/);assert.match(src,/resizeSearchMap\(\)/);
 assert.match(src,/document\.addEventListener\('trip:endpoint-changed'/);
});
test('selected search candidate hides competing search-result markers while preserving saved places',async()=>{
 const src=await read('public/static/search-screen.js');
 const start=src.indexOf('function paintMarkers(){'),end=src.indexOf('function showMode(next){',start),block=src.slice(start,end);
 assert.match(block,/const key=selected/);
 assert.match(block,/if\(key&&!selectedMarker\)/);assert.match(block,/refreshSavedMarkers\(\)/);
 assert.doesNotMatch(block,/for\(const item of items.slice\(0,15\)\)/);
 assert.doesNotMatch(block,/for\(const item of items/);
});
