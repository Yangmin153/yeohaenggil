import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../api/geocode.js';
const uri=q=>new Request('https://example.vercel.app/api/geocode?q='+encodeURIComponent(q));

test('Kakao address API resolves a full road-address query via existing REST credentials',async()=>{
 const oldKey=process.env.KAKAO_REST_API_KEY,original=globalThis.fetch;
 const requests=[];
 try{
  process.env.KAKAO_REST_API_KEY='fake-server-key';
  globalThis.fetch=async(url,options)=>{
   requests.push({url:new URL(url),headers:options.headers});
   return Response.json({documents:[{
    address_name:'인천 부평구 부개동 123',
    road_address:{address_name:'인천 부평구 수변로 22'},
    x:'126.724',y:'37.485'
   }]});
  };
  const response=await GET(uri('인천 부평구 수변로 22'));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(requests.length,1);
  assert.equal(requests[0].url.hostname,'dapi.kakao.com');
  assert.equal(requests[0].url.pathname,'/v2/local/search/address.json');
  assert.equal(requests[0].url.searchParams.get('query'),'인천 부평구 수변로 22');
  assert.equal(requests[0].headers.Authorization,'KakaoAK fake-server-key');
  assert.equal(body.results[0].address,'인천 부평구 수변로 22');
  assert.equal(body.results[0].lat,37.485);
  assert.equal(body.results[0].lng,126.724);
  assert.equal(JSON.stringify(body).includes('fake-server-key'),false);
 }finally{
  globalThis.fetch=original;
  if(oldKey===undefined)delete process.env.KAKAO_REST_API_KEY;
  else process.env.KAKAO_REST_API_KEY=oldKey;
 }
});

test('Naver geocode fallback runs when Kakao has no matching street address',async()=>{
 const before={K:process.env.KAKAO_REST_API_KEY,I:process.env.NAVER_MAPS_CLIENT_ID,S:process.env.NAVER_MAPS_CLIENT_SECRET};
 const original=globalThis.fetch;
 const hosts=[];
 try{
  process.env.KAKAO_REST_API_KEY='fake-key';
  process.env.NAVER_MAPS_CLIENT_ID='fake-id';
  process.env.NAVER_MAPS_CLIENT_SECRET='fake-secret';
  globalThis.fetch=async(url)=>{
   const u=new URL(url);hosts.push(u.hostname);
   if(u.hostname==='dapi.kakao.com')return Response.json({documents:[]});
   return Response.json({status:'OK',addresses:[{roadAddress:'서울 중구 세종대로 110',x:'126.978',y:'37.566'}]});
  };
  const result=await GET(uri('서울 중구 세종대로 110'));
  assert.equal(result.status,200);
  const data=await result.json();
  assert.deepEqual(hosts,['dapi.kakao.com','maps.apigw.ntruss.com']);
  assert.equal(data.results[0].address,'서울 중구 세종대로 110');
 }finally{
  globalThis.fetch=original;
  for(const [key,old] of [['KAKAO_REST_API_KEY',before.K],['NAVER_MAPS_CLIENT_ID',before.I],['NAVER_MAPS_CLIENT_SECRET',before.S]]){
   if(old===undefined)delete process.env[key];else process.env[key]=old;
  }
 }
});
