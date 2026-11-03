/* Test the user-facing "check one visit -> edit -> first visit" flow.
 * The actual auto-optimizer is unit-tested separately; the route HTTP response
 * is intercepted here to test UI without additional paid Naver API usage. */
import {chromium} from 'playwright';
const base=process.env.YG_PREVIEW_URL||'https://yeohaenggil-2kqsu0dve-travel-alex.vercel.app';
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await b.newContext({viewport:{width:390,height:800},locale:'ko-KR'});
const page=await context.newPage();page.setDefaultTimeout(18000);
const p=(id,name,lat,lng)=>({id,name,lat,lng,address:'서울특별시',locked:false});
const S=p('start','서울역',37.5547,126.9707),E=p('end','경복궁',37.5797,126.977);
const A=p('a','카페 A',37.572,126.978),B=p('b','맛집 B',37.582,126.984),C=p('c','관광지 C',37.566,126.986);
const initial={id:'test-trip',date:'2026-11-03',origin:S,destination:E,departure:'09:00',
 mode:'auto',stops:[A,B,C],unassignedStops:[],result:{
 orderIds:['a','b','c'],
 entries:[S,A,B,C,E].map(x=>({place:x,leg:null})),
 drivingMinutes:42,totalDistanceMeters:8000
}};
let requested=null;
await page.route('**/api/route',async route=>{
 const body=route.request().postDataJSON();requested=body;
 const places=[body.origin,...body.stops,body.destination];
 const planned={
  orderIds:body.stops.map(x=>x.id),
  entries:places.map(x=>({place:x,leg:{durationMinutes:8,distanceMeters:1500,path:[[x.lng,x.lat]]}})),
  drivingMinutes:32,totalDistanceMeters:7200,totalMinutes:32,status:'ok',warnings:[],savedMinutes:3
 };
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(planned)});
});
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.evaluate(d=>{
  localStorage.setItem('yeohaenggil.v2.days',JSON.stringify([d]));
  localStorage.setItem('yeohaenggil.vnext.step','3');
 },initial);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-yg-step="3"]').click();
 await page.locator('#yg-route-adjust>summary').click();
 await page.locator('[data-adjust-select="c"]').check();
 await page.locator('#yg-adjust-edit-selected').click();
 await page.locator('#yg-position-select').selectOption('1');
 await page.locator('#yg-position-apply').click();
 await page.waitForFunction(()=>window.TripApp?.getDay?.()?.result?.orderIds?.[0]==='c',null,{timeout:30000});
 const details=await page.evaluate(()=>{
  const d=window.TripApp.getDay();
  return{order:d.result?.orderIds,ordered:d.stops.map(s=>({id:s.id,locked:s.locked})),mode:d.mode};
 });
 console.log('EDIT_VISIT_RESULT',JSON.stringify({details,routeRequest:requested?.stops?.map(s=>({id:s.id,locked:s.locked}))}));
 if(details.order[0]!=='c'||details.mode!=='auto'||!requested?.stops?.[0]?.locked||requested?.stops?.[0]?.id!=='c')throw Error('Desired first visit was not preserved in reoptimization request');
 if(await page.locator('[data-route-up],[data-route-down],[data-route-lock]').count())throw Error('Legacy lock and arrow controls should be removed');
 console.log('PASS: select third visit, edit it to first, reoptimize remaining route and keep desired first position');
}catch(error){
 console.error('VISIT_EDIT_SMOKE_FAILED',error.stack||String(error));
 await page.screenshot({path:'/tmp/yg-visit-edit-failure.png'}).catch(()=>{});
 process.exitCode=1;
}finally{await context.close();await b.close();}
