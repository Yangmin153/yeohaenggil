/* Web Mercator layout shared by Naver Static Map and the PNG markers. */
const project=(lat,lng)=>{
 const safeLat=Math.max(-85,Math.min(85,lat)),s=Math.sin(safeLat*Math.PI/180);
 return {x:(lng+180)/360,y:0.5-Math.log((1+s)/(1-s))/(4*Math.PI)};
};
export function staticMapLayout(points,width=904,height=285){
 const ps=(points||[]).filter(p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&
 Number(p.x)>=32&&Number(p.x)<=40&&Number(p.y)>=123&&Number(p.y)<=133);
 if(!ps.length)return null;
 const normalized=ps.map(p=>project(Number(p.x),Number(p.y))),xs=normalized.map(p=>p.x),ys=normalized.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const minSpan=1e-9;
 const zx=Math.log2((width-114)/(256*Math.max(minSpan,maxX-minX)));
 const zy=Math.log2((height-92)/(256*Math.max(minSpan,maxY-minY)));
 const level=Math.min(16,Math.max(6,Math.floor(Math.min(zx,zy))));
 const centerX=(maxX+minX)/2,centerY=(maxY+minY)/2;
 const lng=centerX*360-180,rad=Math.atan(Math.sinh(Math.PI*(1-2*centerY)));
 const lat=rad*180/Math.PI;
 const pixels=normalized.map(p=>({x:width/2+(p.x-centerX)*256*2**level,y:height/2+(p.y-centerY)*256*2**level}));
 return {lat,lng,level,width,height,pixels};
}

/** Focus one chosen visit even when other saved visits are far away.
 * Coordinates use the same EPSG:3857 pixel grid as Naver Static Maps.
 * This is a location preview, not a fabricated driving route. */
export function focusedStaticMapLayout(points,focus,width=390,height=500,level=13){
 const valid=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&
  Number(p.x)>=32&&Number(p.x)<=40&&Number(p.y)>=123&&Number(p.y)<=133;
 if(!Array.isArray(points)||!points.length||points.length>42||!points.every(valid)||!valid(focus))return null;
 const w=Number(width),h=Number(height),z=Number(level);
 if(!Number.isInteger(w)||w<320||w>1024||!Number.isInteger(h)||h<240||h>1024||
  !Number.isInteger(z)||z<6||z>16)return null;
 if(!points.some(p=>Math.abs(Number(p.x)-Number(focus.x))<0.00001&&Math.abs(Number(p.y)-Number(focus.y))<0.00001))return null;
 const c=project(Number(focus.x),Number(focus.y)),scale=256*2**z;
 const pixels=points.map(p=>{
  const pos=project(Number(p.x),Number(p.y));
  return {x:w/2+(pos.x-c.x)*scale,y:h/2+(pos.y-c.y)*scale};
 });
 return {lat:Number(focus.x),lng:Number(focus.y),width:w,height:h,level:z,pixels};
}
