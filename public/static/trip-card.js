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
export async function buildTripCard(day){
 await document.fonts?.ready?.catch?.(()=>{});
 const n=day.p.length;
 const canvas=document.createElement('canvas');
 canvas.width=1080;canvas.height=Math.min(5000,650+n*65);const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('이미지를 만들 수 없는 브라우저예요.');
 ctx.fillStyle='#f7faf9';ctx.fillRect(0,0,canvas.width,canvas.height);
 rectangle(ctx,44,42,992,canvas.height-84,28,'#ffffff');
 ctx.fillStyle='#139e88';ctx.font='800 25px Pretendard, sans-serif';ctx.fillText('YE0HAENGGIL  /  여행길',88,105);
 ctx.fillStyle='#163336';ctx.font='800 49px Pretendard, sans-serif';ctx.fillText('우리의 여행길',88,181);
 ctx.fillStyle='#768b8c';ctx.font='500 28px Pretendard, sans-serif';
 ctx.fillText(day.t+'  ·  '+(day.m===null?'자동차 이동 시간 미표시':'자동차 이동 약 '+day.m+'분'),88,232);
 const mapTop=265,mapH=285,mapLeft=88,mapW=904;
 rectangle(ctx,mapLeft,mapTop,mapW,mapH,22,'#e8f6f0');
 ctx.strokeStyle='#d2e9e1';ctx.lineWidth=2;
 for(let i=0;i<mapW;i+=60){ctx.beginPath();ctx.moveTo(mapLeft+i,mapTop);ctx.lineTo(mapLeft+i,mapTop+mapH);ctx.stroke();}
 for(let i=0;i<mapH;i+=60){ctx.beginPath();ctx.moveTo(mapLeft,mapTop+i);ctx.lineTo(mapLeft+mapW,mapTop+i);ctx.stroke();}
 const points=mapPlot(day.p,mapW-80,mapH-55).map(p=>({x:p.x+mapLeft+40,y:p.y+mapTop+28}));
 ctx.strokeStyle='#14b8a6';ctx.lineWidth=6;ctx.setLineDash([11,9]);
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);
 points.forEach((p,i)=>{
  ctx.fillStyle=i===0?'#087b70':i===points.length-1?'#ed8c6d':'#22b1a3';
  ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='800 16px Pretendard, sans-serif';ctx.textAlign='center';
  ctx.fillText(i===0?'S':i===points.length-1?'E':String(i),p.x,p.y+6);
 });ctx.textAlign='left';
 ctx.fillStyle='#477d73';ctx.font='600 20px Pretendard, sans-serif';
 ctx.fillText('방문지 좌표를 연결한 위치 개요 (실제 도로 지도 아님)',mapLeft+18,mapTop+mapH-14);
 ctx.fillStyle='#203b41';ctx.font='800 34px Pretendard, sans-serif';ctx.fillText('방문 순서',88,615);
 let y=662;
 day.p.forEach((p,i)=>{
  const kind=i===0?'출발':i===n-1?'도착':String(i);
  rectangle(ctx,89,y-29,47,47,16,i===0?'#087b70':i===n-1?'#eb966f':'#e7f9f2');
  ctx.fillStyle=i===0||i===n-1?'white':'#128e7c';
  ctx.font='800 23px Pretendard, sans-serif';ctx.textAlign='center';ctx.fillText(kind,112,y+1);ctx.textAlign='left';
  ctx.fillStyle='#213a40';ctx.font='700 29px Pretendard, sans-serif';
  ctx.fillText(String(p.n).slice(0,33),158,y+2);
  y+=65;
 });
 ctx.fillStyle='#7f8b90';ctx.font='500 22px Pretendard, sans-serif';ctx.fillText('이동시간은 경로 계산 결과이며, 실시간 교통정보와 달라질 수 있어요.',88,canvas.height-80);
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
