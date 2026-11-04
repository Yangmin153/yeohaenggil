/* Same-origin Naver Static Map image endpoint; client secret never reaches the browser.
 * The Naver Cloud Maps application MUST have Static Map API enabled. */
import {staticMapLayout,focusedStaticMapLayout} from '../public/static/static-map-layout.js';
const endpoint='https://maps.apigw.ntruss.com/map-static/v2/raster';
const fail=(message,status=400)=>new Response(JSON.stringify({detail:message}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function GET(request){
 const url=new URL(request.url);
 const origin=request.headers.get('origin');
 if(origin&&origin!==url.origin)return fail('다른 출처의 요청은 허용하지 않습니다.',403);
 if(request.headers.get('sec-fetch-site')==='cross-site')return fail('다른 사이트에서는 지도를 요청할 수 없습니다.',403);
 const raw=url.searchParams.get('p')||'';
 if(raw.length>1050)return fail('지도에 표시할 장소가 너무 많아요.',413);
 const parts=raw.split(';').filter(Boolean);
 if(!parts.length||parts.length>42)return fail('표시할 장소는 1~42곳이어야 해요.',422);
 const points=[];
 for(const item of parts){
  if(!/^\d{1,2}\.\d{1,6},\d{2,3}\.\d{1,6}$/.test(item))return fail('장소 좌표를 확인해 주세요.',422);
  const [x,y]=item.split(',').map(Number);points.push({x,y});
 }
 const standard=staticMapLayout(points);
 if(!standard||points.length!==standard.pixels.length)return fail('대한민국 지도 범위의 장소를 선택해 주세요.',422);
 const focusValue=url.searchParams.get('f')||'';
 let map=standard;
 if(focusValue){
  if(!/^\d{1,2}\.\d{1,6},\d{2,3}\.\d{1,6}$/.test(focusValue))return fail('지도 중심 좌표 형식을 확인해 주세요.',422);
  const [x,y]=focusValue.split(',').map(Number);
  const w=Number(url.searchParams.get('w')||390),h=Number(url.searchParams.get('h')||500),level=Number(url.searchParams.get('z')||13);
  map=focusedStaticMapLayout(points,{x,y},w,h,level);
  if(!map)return fail('방문지 범위 또는 지도 크기를 확인해 주세요.',422);
 }
 // Naver's scale=2 returns twice the image pixels without changing the map coverage.
 // Keep the CSS-sized w/h and zoom unchanged so HTML marker coordinates remain aligned.
 const scale=url.searchParams.get('s')||'1';
 if(scale!=='1'&&scale!=='2')return fail('지도 해상도 설정을 확인해 주세요.',422);
 const id=process.env.NAVER_MAPS_CLIENT_ID,secret=process.env.NAVER_MAPS_CLIENT_SECRET;
 if(!id||!secret)return fail('네이버 지도 서버 키가 설정되지 않았어요.',503);
 const api=new URL(endpoint);
 for(const [k,v] of Object.entries({w:map.width,h:map.height,center:map.lng.toFixed(7)+','+map.lat.toFixed(7),level:map.level,scale,crs:'EPSG:4326',format:'png',lang:'ko'}))api.searchParams.set(k,String(v));
 try{
  const response=await fetch(api,{headers:{'x-ncp-apigw-api-key-id':id,'x-ncp-apigw-api-key':secret,accept:'image/png,image/jpeg'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return fail('네이버 Static Map API 권한 또는 사용량을 확인해 주세요. (응답 '+response.status+')',502);
  const type=response.headers.get('content-type')||'';
  if(!/^image\/(png|jpeg)/i.test(type))return fail('네이버 지도 이미지 응답이 올바르지 않아요.',502);
  const buffer=await response.arrayBuffer();
  if(!buffer.byteLength||buffer.byteLength>4_100_000)return fail('지도 이미지 크기를 확인해 주세요.',502);
  return new Response(buffer,{status:200,headers:{'content-type':type,'x-content-type-options':'nosniff','cache-control':'private,max-age=180'}});
 }catch{return fail('네이버 정적 지도를 불러오지 못했어요.',502);}
}
