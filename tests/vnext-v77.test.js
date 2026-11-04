import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankResults,searchIntent,tripSearchAnchor} from '../public/static/region-search.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const place=(id,name,lat,lng)=>({id,name,lat,lng,address:'대한민국'});
test('nationwide search ranks exact name higher than a geographically close unrelated shop',()=>{
 const anchor={lat:37.57,lng:126.98};
 const nearby=place('1','하림각제과점',37.58,126.97);
 const exact=place('2','하림각',35.17,129.07);
 const found=rankResults([nearby,exact],'',anchor,'하림각');
 assert.equal(found[0].id,'2');
});
test('identical nationwide business names prefer a nearby result without excluding remote names',()=>{
 const anchor={lat:37.57,lng:126.98};
 const far=place('remote','하림각',35.17,129.07),near=place('near','하림각',37.57,126.99);
 const sorted=rankResults([far,near],'',anchor,'하림각');
 assert.deepEqual(sorted.map(p=>p.id),['near','remote']);
});
test('quick search does not send distance restriction and loads additional nationwide page',async()=>{
 const script=await read('public/static/quick-add.js');
 assert.match(script,/new URLSearchParams\(\{q:term,page:String\(page\)\}\)/);
 assert.doesNotMatch(script,/params\.set\('bias'/);
 assert.doesNotMatch(script,/params\.set\('nearby'/);
 assert.match(script,/if\(hasNext\)/);
 assert.match(script,/request\(q,signal,2\)/);
 assert.match(script,/next\.slice\(0,30\)/);
});
test('map mode styles are scoped to bottom dock, never full-screen search',async()=>{
 const [oldCss,css,html]=await Promise.all(['public/static/mobile-v49.css','public/static/vnext.css','public/index.html'].map(read));
 assert.doesNotMatch(oldCss,/body\[data-mobile-view="map"\] \.quick-results\{display:flex!important/);
 assert.match(oldCss,/body\[data-mobile-view="map"\] \.mobile-bottom-actions \.quick-results/);
 assert.match(css,/body\.search-open #search-screen #search-screen-results-mount #quick-results/);
 assert.match(css,/display:block!important;position:static!important/);
 assert.match(css,/overflow-y:auto!important;overflow-x:hidden!important/);
 assert.match(html,/quick-add\.js\?v=8\.6\.0/);
});
test('full screen search freezes unrelated underlying UI and restores previous inert state',async()=>{
 const js=await read('public/static/search-screen.js');
 assert.match(js,/function lockBackground\(\)/);
 assert.match(js,/backgroundInert\.push\(\[node,node\.inert\]\);node\.inert=true/);
 assert.match(js,/function unlockBackground\(\)/);
 assert.match(js,/node\.inert=prior/);
 assert.match(js,/YGScrollLock\?\.lock\('search-screen'\)/);
 assert.match(js,/YGScrollLock\?\.unlock\('search-screen'\)/);
 assert.match(js,/touchmove/);
 assert.match(js,/passive:false,capture:true/);
});

test('subway station ranks before nearby parking and a similarly named wedding venue',()=>{
 const anchor={lat:37.49,lng:126.72,city:'인천',district:'부평구'};
 const candidates=[
  {id:'parking',name:'부평역 주차장',lat:37.49,lng:126.72,category:'주차장',categoryGroupCode:'PK6',address:'인천 부평구'},
  {id:'wedding',name:'부평역 빌라드마리',lat:37.49,lng:126.721,category:'웨딩홀',address:'인천 부평구'},
  {id:'station',name:'부평역 1호선',lat:37.49,lng:126.72,category:'지하철역',categoryGroupCode:'SW8',address:'인천 부평구'}
 ];
 assert.equal(searchIntent('부평역'),'subway');
 assert.equal(rankResults(candidates,'',anchor,'부평역')[0].id,'station');
 assert.equal(searchIntent('부평역 주차장'),'generic');
 assert.equal(rankResults(candidates,'',anchor,'부평역 주차장')[0].id,'parking');
});
test('trip center is selected from the densest cluster of saved stops',()=>{
 const cluster=[
  {id:'remote',name:'remote',lat:33.49,lng:126.5,address:'제주 제주시'},
  {id:'local-1',name:'local',lat:37.49,lng:126.72,address:'인천 부평구'},
  {id:'local-2',name:'local 2',lat:37.491,lng:126.721,address:'인천 부평구'}
 ];
 const context=tripSearchAnchor({stops:cluster});
 assert.equal(context.city,'인천');
 assert.equal(context.district,'부평구');
});
test('station category lookup is additive and does not suppress nationwide POIs',async()=>{
 const src=await read('public/static/quick-add.js');
 const api=await read('lib/place-search.js');
 assert.match(src,/request\(q,signal,1,'SW8'\)/);
 assert.match(src,/contextualQuery/);
 assert.match(api,/category_group_code/);
 assert.match(api,/categoryGroupCode/);
});
