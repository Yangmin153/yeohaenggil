/** Read-only NAVER Static Map for STEP 2 when Preview Web Dynamic Map host is not authorized.
 * No client secret or coordinate-picking UI. Real maps always take priority. */
import {staticMapLayout,focusedStaticMapLayout} from './static-map-layout.js';

const app=window.TripApp;
const region=document.getElementById('map-region');
const fitButton=document.getElementById('yg-fit-all');
if(app&&region){
 const root=document.createElement('div');
 root.className='yg-step2-static-map';
 root.hidden=true;
 root.setAttribute('role','img');
 root.setAttribute('aria-label','저장된 방문지와 출발·도착 위치가 표시된 네이버 정적 지도');
 const image=document.createElement('img');
 image.alt='네이버 지도에 저장된 장소 위치';
 image.decoding='async';
 const markerLayer=document.createElement('div');
 markerLayer.className='yg-step2-static-pins';
 markerLayer.setAttribute('aria-hidden','true');
 root.append(image,markerLayer);
 region.append(root);
 let chosenId=null,fitAll=false,signature='',ticket=0,scheduled=false;
 const enabled=()=>document.body.dataset.tripStep==='2'&&!app.getMap?.();
 const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
  Number(p.lat)>=32&&Number(p.lat)<=40&&Number(p.lng)>=123&&Number(p.lng)<=133&&
  !/미설정/.test(String(p.name||''));
 function entries(){
  const d=app.getDay?.();
  if(!d)return [];
  return [
   ...d.stops.map((place,i)=>({place,kind:'stop',label:String(i+1)})),
   {place:d.origin,kind:'origin',label:'출발'},
   {place:d.destination,kind:'destination',label:'도착'}
  ].filter(e=>valid(e.place));
 }
 function hide(){ticket++;signature='';root.hidden=true;image.removeAttribute('src');markerLayer.replaceChildren();}
 function render(){
  if(!enabled()){if(!root.hidden)hide();return;}
  const list=entries();
  if(!list.length){if(!root.hidden)hide();return;}
  const width=Math.max(320,Math.min(1024,Math.round(region.clientWidth||390)));
  const height=Math.max(240,Math.min(1024,Math.round(region.clientHeight||260)));
  const coords=list.map(({place})=>({x:Number(place.lat),y:Number(place.lng)}));
  const focus=list.find(e=>e.place.id===chosenId)||list[0];
  const focusCoords={x:Number(focus.place.lat),y:Number(focus.place.lng)};
  const layout=fitAll?staticMapLayout(coords,width,height):
   focusedStaticMapLayout(coords,focusCoords,width,height,13);
  if(!layout)return;
  const key=[app.getDay?.()?.id,width,height,fitAll,chosenId||'',...list.map(e=>e.kind+':'+e.place.id+':'+e.place.lat+':'+e.place.lng)].join('|');
  if(key===signature)return;
  signature=key;
  const current=++ticket,query=new URLSearchParams({
   p:coords.map(p=>p.x.toFixed(6)+','+p.y.toFixed(6)).join(';'),
   w:String(width),h:String(height)
  });
  if(!fitAll){query.set('f',focusCoords.x.toFixed(6)+','+focusCoords.y.toFixed(6));query.set('z','13');}
  markerLayer.replaceChildren();
  // Places with identical coordinates are represented by a single honest shared-location pin.
  const grouped=new Map();
  list.forEach((entry,i)=>{
   const k=coords[i].x.toFixed(5)+':'+coords[i].y.toFixed(5);
   if(!grouped.has(k))grouped.set(k,{entries:[],point:layout.pixels[i]});
   grouped.get(k).entries.push(entry);
  });
  for(const group of grouped.values()){
   const {point}=group;
   if(point.x<0||point.x>width||point.y<0||point.y>height)continue;
   const member=group.entries.find(e=>e.place.id===chosenId)||group.entries[0];
   const start=group.entries.some(e=>e.kind==='origin');
   const end=group.entries.some(e=>e.kind==='destination');
   const mark=document.createElement('span');
   mark.className='yg-step2-static-pin'+(start?' is-origin':end?' is-destination':'')+
    (group.entries.some(e=>e.place.id===chosenId)?' is-selected':'');
   mark.textContent=start&&end?'출발·도착':group.entries.length>1?
    (start?'출발':end?'도착':member.label)+' +'+(group.entries.length-1):member.label;
   mark.style.left=(point.x/width*100)+'%';
   mark.style.top=(point.y/height*100)+'%';
   mark.title=group.entries.map(e=>e.place.name).join(' / ');
   markerLayer.append(mark);
  }
  image.onload=()=>{if(ticket!==current||!enabled())return;root.hidden=false;};
  image.onerror=()=>{if(ticket!==current)return;root.hidden=true;signature='';};
  image.src='/api/static-map?'+query.toString();
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
 document.addEventListener('trip:planner-focus',event=>{
  chosenId=event.detail?.id||null;fitAll=false;schedule();
 });
 document.addEventListener('trip:stops-changed',schedule);
 document.addEventListener('trip:endpoint-changed',schedule);
 document.addEventListener('trip:day-changed',()=>{chosenId=null;fitAll=false;schedule();});
 document.addEventListener('trip:days-imported',()=>{chosenId=null;fitAll=false;schedule();});
 document.addEventListener('trip-map-ready',schedule);
 document.addEventListener('trip-maps-sdk-ready',schedule);
 fitButton?.addEventListener('click',()=>{if(!app.getMap?.()){fitAll=true;chosenId=null;schedule();}});
 window.addEventListener('resize',schedule);
 if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(region);
 new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-trip-step']});
 schedule();
}
