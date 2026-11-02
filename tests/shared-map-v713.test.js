import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshotDays,validateSnapshot,summaryText,encodeSnapshot,decodeSnapshot} from '../public/static/shared-trip-core.js';
import {staticMapLayout} from '../public/static/static-map-layout.js';
import {GET as staticMapGET} from '../api/static-map.js';
const file=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const p=(id,name,lat=37.57,lng=126.98)=>({id,name,lat,lng,address:'서울특별시 종로구'});
test('partially planned and undated trips share without calculation or endpoints',async()=>{
 const day={date:'2026-11-03',origin:p('s','출발지 미설정'),destination:p('e','도착지 미설정'),
  stops:[p('v1','광화문광장')],result:null};
 const snap=snapshotDays([day]);
 assert.equal(snap.d[0].w,'draft');
 assert.deepEqual(snap.d[0].p.map(x=>x.n),['광화문광장']);
 assert.equal(snap.d[0].p[0].r,'V');
 assert.equal(snap.d[0].m,null);
 assert.match(summaryText(snap),/계획 중/);
 assert.match(summaryText(snap),/서울특별시 종로구/);
 const code=await encodeSnapshot(snap);
 assert.deepEqual(await decodeSnapshot(code),snap);
 const empty=snapshotDays([{date:'2026-11-04',stops:[],origin:null,destination:null,result:null}]);
 assert.deepEqual(validateSnapshot(empty),empty);
 assert.match(summaryText(empty),/아직 담은 장소가 없어요/);
});
test('new snapshots keep correct start/visit/end labels without fabricating an optimized order',()=>{
 const snap=snapshotDays([{date:'2026-11-03',origin:p('s','숙소'),destination:null,stops:[p('1','카페'),p('2','맛집')]}]);
 assert.deepEqual(snap.d[0].p.map(x=>x.r),['S','V','V']);
 const text=summaryText(snap);
 assert.match(text,/출발 · 숙소/);
 assert.match(text,/1\\. 방문 · 카페/);
 assert.doesNotMatch(text,/도착 · 카페/);
});
test('static map viewport uses exact Web Mercator map projection for real coordinates',()=>{
 const pts=[{x:37.5797,y:126.977},{x:37.583,y:126.986}];
 const result=staticMapLayout(pts);
 assert.ok(result&&result.level>=6&&result.level<=16);
 assert.ok(result.pixels.every(p=>p.x>=0&&p.x<=904&&p.y>=0&&p.y<=285));
 assert.equal(staticMapLayout([{x:55,y:151}]),null);
});
test('server static map rejects non-Korean coordinates and external fetchers before paid API',async()=>{
 const req=(suffix,headers={})=>new Request('https://example.com/api/static-map?p='+suffix,{headers});
 const invalid=await staticMapGET(req('55.000000,151.000000'));
 assert.equal(invalid.status,422);
 const cross=await staticMapGET(req('37.579700,126.977000',{'sec-fetch-site':'cross-site'}));
 assert.equal(cross.status,403);
});
test('PNG uses a real Static Map image and no invented route strokes',async()=>{
 const [card,view,api]=await Promise.all(['public/static/trip-card.js','public/static/view-trip.js','api/static-map.js'].map(file));
 assert.match(card,/\\/api\\/static-map\\?p=/);
 assert.match(card,/ctx\\.drawImage\\(actual\\.image/);
 assert.doesNotMatch(card,/ctx\\.lineTo\\(p\\.x,p\\.y\\)/);
 assert.doesNotMatch(view,/new maps\\.Polyline/);
 assert.doesNotMatch(view,/createElementNS\\(svgNS,'polyline'\\)/);
 assert.match(view,/renderStaticMap\\(day\\)/);
 assert.match(api,/maps\\.apigw\\.ntruss\\.com\\/map-static\\/v2\\/raster/);
 assert.match(api,/process\\.env\\.NAVER_MAPS_CLIENT_SECRET/);
});
test('share button sits next to login and account colors are mint throughout the library',async()=>{
 const [html,css]=await Promise.all(['public/index.html','public/static/account-mint.css'].map(file));
 const i=html.indexOf('id="yg-share-open"'),j=html.indexOf('id="account-button"');
 assert.ok(i>0&&j>i&&j-i<190);
 assert.equal((html.match(/id="yg-share-open"/g)||[]).length,1);
 assert.match(html,/account-mint\\.css/);
 assert.match(css,/account-signed-hero/);
 assert.match(css,/account-toolbar button:first-child/);
 assert.match(css,/#13b5a1/);
});
