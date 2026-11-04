import {geocode} from '../lib/core.js';

// The existing location keyword search uses Kakao's REST key. Reuse that key
// server-side for address coordinates; Naver geocoding remains the fallback.
export async function GET(request){
 const query=(new URL(request.url).searchParams.get('q')||'').trim();
 if(query.length<2||query.length>120)return geocode(query,process.env);
 const key=process.env.KAKAO_REST_API_KEY;
 if(key){
  try{
   const url=new URL('https://dapi.kakao.com/v2/local/search/address.json');
   url.searchParams.set('query',query);url.searchParams.set('size','10');
   const response=await fetch(url,{
    headers:{Authorization:'KakaoAK '+key,Accept:'application/json'},
    signal:AbortSignal.timeout(6000)
   });
   if(response.ok){
    const body=await response.json();
    const results=(Array.isArray(body.documents)?body.documents:[]).map(item=>({
     address:String(item.road_address?.address_name||item.address?.address_name||item.address_name||''),
     lat:Number(item.y),lng:Number(item.x)
    })).filter(p=>p.address&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&
      p.lat>=32&&p.lat<=40&&p.lng>=123&&p.lng<=133);
    if(results.length)return Response.json({results},{headers:{
     'cache-control':'no-store','x-content-type-options':'nosniff'
    }});
   }
  }catch(error){
   // A failed optional provider should not disable the existing Naver lookup.
  }
 }
 return geocode(query,process.env);
}
