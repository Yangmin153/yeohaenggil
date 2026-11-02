import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshotDays,encodeSnapshot,decodeSnapshot,summaryText,getPreviewURL,validateSnapshot} from '../public/static/shared-trip-core.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const p=(id,name,x,y)=>({id,name,lat:x,lng:y,address:'서울특별시 종로구'});
const sample=()=>({
 date:'2026-11-03',origin:p('s','경복궁',37.58,126.977),
 destination:p('e','서울역',37.555,126.971),
 stops:[p('1','북촌한옥마을',37.583,126.984),p('2','광화문광장',37.572,126.977)],
 result:{orderIds:['2','1'],drivingMinutes:25,totalDistanceMeters:5900},
 liveOrigin:undefined
});
test('view-only trip link roundtrips exact stop order and limits account data',async()=>{
 const day=sample();day.privateNote='secret';day.user_id='user-123';
 const payload=snapshotDays([day]);const url=getPreviewURL(await encodeSnapshot(payload),'https://yeohaenggil.vercel.app');
 assert.match(url,/^https:\/\/yeohaenggil\.vercel\.app\/view\.html#trip=[A-Za-z0-9_-]+$/);
 assert.doesNotMatch(url,/secret|user-123|\/api\//);
 const result=await decodeSnapshot(url.split('#trip=')[1]);
 assert.deepEqual(result.d[0].p.map(x=>x.n),['경복궁','광화문광장','북촌한옥마을','서울역']);
 assert.equal(result.d[0].m,25);
 assert.equal(result.d[0].k,5900);
 assert.match(summaryText(result),/자동차 이동 약 25분/);
});
test('share link deliberately excludes live GPS coordinates',()=>{
 const day=sample();day.liveOrigin=p('gps','현재위치',37.99999,126.34567);
 const result=snapshotDays([day]).d[0];
 assert.equal(result.p[0].n,'경복궁');
 assert.equal(result.m,null);
 assert.equal(result.k,null);
});
test('rejects routes missing calculation and malformed or oversized shared links',async()=>{
 const day=sample();day.result=null;
 assert.throws(()=>snapshotDays([day]),/동선을 계산/);
 assert.rejects(()=>decodeSnapshot('z%%%%'),/올바른|길거나/);
 assert.throws(()=>validateSnapshot({v:1,d:[{t:'bad',p:[{n:'X',a:'',x:Infinity,y:3}]}]}));
 const tooMany=sample();tooMany.stops=Array.from({length:41},(_,i)=>p(String(i),'x',37,126));
 assert.throws(()=>snapshotDays([tooMany]),/최대 40곳/);
});
test('sharing uses independent noneditable view, preserves trip editor & offers native Kakao share sheet',async()=>{
 const [html,view,ui,viewjs]=await Promise.all(['public/index.html','public/view.html','public/static/share-trip.js','public/static/view-trip.js'].map(read));
 for(const id of ['yg-share-open','yg-share-panel','yg-share-link','yg-share-feedback','yg-calc-overlay','yg-calc-bar'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/data-share-action="text"/);
 assert.match(html,/data-share-action="image"/);
 assert.match(view,/읽기 전용 일정/);
 assert.match(view,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(view,/(?:id="yg-calculate"|id="yg-add-visit"|id="account-auth-submit")/);
 assert.match(ui,/navigator\.share/);
 assert.match(viewjs,/decodeSnapshot/);
 assert.match(viewjs,/sv-timeline/);
 assert.match(viewjs,/mapPlot/);
});
test('route loading progress tracks completed work, not invented percentages',async()=>{
 const [html,js]=await Promise.all(['public/index.html','public/static/vnext.js'].map(read));
 assert.match(html,/id="yg-calc-spinner"/);
 assert.match(html,/id="yg-calc-count"/);
 assert.match(js,/bar\.max=full\.length;bar\.value=completed/);
 assert.match(js,/completed\+\+;progress\(\)/);
 assert.match(js,/overlay\.hidden=true;busy=false/);
});
test('search keyboard viewport and national map default zoom improved without API changes',async()=>{
 const [app,search,quick,style]=await Promise.all(['public/static/app.js','public/static/search-screen.js','public/static/quick-add.js','public/static/share-controls.css'].map(read));
 assert.match(app,/new naver\.maps\.LatLng\(36\.35,127\.9\),zoom:7/);
 assert.match(search,/KOREA_ZOOM=7/);
 assert.match(search,/screen\.dataset\.keyboardOpen=String\(keyboardOpen\)/);
 assert.match(quick,/if\(window\.YeoSearch\?\.isOpen\?\.\(\)\)return/);
 assert.match(style,/search-screen-results-mount/);
});
