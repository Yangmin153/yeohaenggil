import {staticMapLayout} from './static-map-layout.js';
/* One-day share image: coordinate-based route schematic, no remote map tile capture. */
function rectangle(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function wrap(ctx,text,width){
 const words=[...String(text||'')],rows=[],len=32;let row='';
 for(const c of words){if(ctx.measureText(row+c).width>width&&row){rows.push(row);row=c;}else row+=c;}
 if(row)rows.push(row);return rows.slice(0,2);
}
export function mapPlot(places,w,h){
 const xs=places.map(p=>p.y),ys=places.map(p=>p.x);
 const loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
 const spanX=Math.max(.004,hiX-loX),spanY=Math.max(.004,hiY-loY);
 const cx=(loX+hiX)/2,cy=(loY+hiY)/2;
 return places.map(p=>({
  x:Math.max(26,Math.min(w-26,w/2+(p.y-cx)/spanX*(w*.67))),
  y:Math.max(26,Math.min(h-26,h/2-(p.x-cy)/spanY*(h*.65)))
 }));
}

function role(day,i){return day.p[i]?.r||(i===0?'S':i===day.p.length-1?'E':'V');}
function label(day,i){const r=role(day,i);return r==='S'?'출발':r==='E'?'도착':String(day.p.slice(0,i+1).filter((p,k)=>role(day,k)==='V').length);}
async function realMapImage(day){
 const pts=day.p,layout=staticMapLayout(pts);
 if(!layout)throw Error('선택한 장소가 네이버 지도 표시 범위 밖에 있어요.');
 const url='/api/static-map?p='+encodeURIComponent(pts.map(p=>p.x.toFixed(6)+','+p.y.toFixed(6)).join(';'));
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok){
  const error=await response.json().catch(()=>null);
  throw Error((error?.detail||'네이버 지도 이미지를 불러올 수 없어요.')+' Static Map API 사용 권한을 확인해 주세요.');
 }
 const type=response.headers.get('content-type')||'';
 if(!type.startsWith('image/'))throw Error('네이버 지도가 이미지로 응답하지 않았어요.');
 const blob=await response.blob();
 const image=await createImageBitmap(blob).catch(async()=>{
  const objectUrl=URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('지도 이미지 디코딩 실패'));i.src=objectUrl;});}
  finally{URL.revokeObjectURL(objectUrl);}
 });
 return {image,layout};
}
export async function buildTripCard(day){
 await document.fonts?.ready?.catch?.(()=>{});
 if(!day||!Array.isArray(day.p))throw Error('일정을 확인해 주세요.');
 const n=day.p.length,showMap=n>0;
 // Never substitute fake connected lines for an unavailable real map.
 const actual=showMap?await realMapImage(day):null;
 const canvas=document.createElement('canvas');
 canvas.width=1080;canvas.height=Math.min(5000,665+Math.max(1,n)*68);const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('이미지를 만들 수 없는 브라우저예요.');
 ctx.fillStyle='#f7faf9';ctx.fillRect(0,0,canvas.width,canvas.height);
 rectangle(ctx,44,42,992,canvas.height-84,28,'#ffffff');
 ctx.fillStyle='#119e88';ctx.font='800 26px Pretendard, sans-serif';ctx.fillText('여행길  ·  함께 보는 여행',88,105);
 ctx.fillStyle='#163336';ctx.font='800 48px Pretendard, sans-serif';ctx.fillText('우리의 여행길',88,181);
 ctx.fillStyle='#768b8c';ctx.font='500 26px Pretendard, sans-serif';
 const estimate=day.m===null?'계획 중':('차량 이동 약 '+day.m+'분');
 ctx.fillText(day.t+'  ·  '+estimate,88,232);
 const mapTop=265,mapH=285,mapLeft=88,mapW=904;
 if(actual){
  ctx.save();ctx.beginPath();ctx.roundRect(mapLeft,mapTop,mapW,mapH,18);ctx.clip();
  ctx.drawImage(actual.image,mapLeft,mapTop,mapW,mapH);ctx.restore();
  const positions=actual.layout.pixels;
  positions.forEach((p,i)=>{
   const x=mapLeft+p.x,y=mapTop+p.y;
   ctx.fillStyle=role(day,i)==='S'?'#087b70':role(day,i)==='E'?'#ed8c6d':'#22b1a3';
   ctx.strokeStyle='white';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#fff';ctx.font='800 16px Pretendard, sans-serif';ctx.textAlign='center';
   ctx.fillText(role(day,i)==='V'?label(day,i):role(day,i),x,y+6);
  });ctx.textAlign='left';
 }else{
  rectangle(ctx,mapLeft,mapTop,mapW,mapH,18,'#e9f7f2');
  ctx.fillStyle='#718e85';ctx.font='700 26px Pretendard, sans-serif';ctx.fillText('아직 방문지를 담지 않았어요.',126,mapTop+148);
 }
 ctx.fillStyle='#7f8d8c';ctx.font='500 18px Pretendard, sans-serif';
 ctx.fillText(actual?'지도 제공 NAVER · 방문지 위치 표시 (도로 경로선 미표시)':'방문지를 추가하면 지도를 함께 저장할 수 있어요.',88,580);
 ctx.fillStyle='#203b41';ctx.font='800 34px Pretendard, sans-serif';ctx.fillText('방문 순서',88,630);
 let y=675;
 day.p.forEach((p,i)=>{
  const kind=label(day,i),type=role(day,i);
  rectangle(ctx,89,y-30,48,48,14,type==='S'?'#087b70':type==='E'?'#eb966f':'#e7f9f2');
  ctx.fillStyle=type!=='V'?'white':'#128e7c';
  ctx.font='800 19px Pretendard, sans-serif';ctx.textAlign='center';ctx.fillText(kind,113,y+1);ctx.textAlign='left';
  ctx.fillStyle='#213a40';ctx.font='700 28px Pretendard, sans-serif';
  ctx.fillText(String(p.n).slice(0,32),160,y+1);
  y+=68;
 });
 if(!n){ctx.fillStyle='#80938c';ctx.font='500 24px Pretendard, sans-serif';ctx.fillText('방문지 추가 후 이 여행을 함께 완성해 보세요.',88,y);}
 ctx.fillStyle='#80938d';ctx.font='500 20px Pretendard, sans-serif';
 ctx.fillText('동선은 실제 방문 순서이며, 실시간 교통 상황에 따라 이동시간이 달라질 수 있어요.',88,canvas.height-77);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 생성에 실패했어요.')),'image/png'));
}

export async function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function shareImage(blob,day){
 const file=new File([blob],'여행길-'+day.t+'.png',{type:'image/png'});
 const data={files:[file],title:'여행길 · '+day.t,text:'여행길에서 만든 여행 일정 이미지예요.'};
 if(navigator.canShare?.({files:[file]})&&navigator.share){
  await navigator.share(data);return true;
 }
 await downloadBlob(blob,file.name);
 return false;
}
