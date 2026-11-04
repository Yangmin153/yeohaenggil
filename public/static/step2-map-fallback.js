import {focusedStaticMapLayout} from './static-map-layout.js';
/* View-only real Naver Static Map fallback for STEP 2 Preview deployments. */
const parent=document.getElementById('map-region'),box=document.createElement('div');
box.id='yg-step2-static-map';box.hidden=true;box.setAttribute('role','img');box.setAttribute('aria-label','이 날짜에 저장한 장소 지도');
const img=document.createElement('img');img.alt='네이버 정적 지도';img.decoding='async';
const pins=document.createElement('div');pins.id='yg-step2-static-pins';pins.setAttribute('aria-hidden','true');
box.append(img,pins);parent?.append(box);
let focusId=null,signature='',serial=0,forceStatic=Boolean(window.__ygNaverAuthFailed);
const day=()=>window.TripApp?.getDay?.(),map=()=>window.TripApp?.getMap?.();
const hasDynamicMap=()=>!!map()&&!forceStatic;
function valid(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
 Number(p.lat)>=33&&Number(p.lat)<=39&&Number(p.lng)>=124&&Number(p.lng)<=132&&!/미설정/.test(String(p.name||''));}
function stopPlaces(){const d=day();if(!d)return [];
 return [...d.stops.map((place,i)=>({place,label:String(i+1),kind:'stop'})),
  {place:d.origin,label:'출발',kind:'origin'},
  {place:d.destination,label:'도착',kind:'destination'}].filter(e=>valid(e.place));}
function hide(){box.hidden=true;document.body.classList.remove('yg-step2-static-active');}
function render(){
 if(!parent||document.body.dataset.tripStep!=='2'||hasDynamicMap()){hide();return;}
 const all=stopPlaces();if(!all.length){hide();return;}
 const chosen=all.find(e=>e.place.id===focusId)||all.filter(e=>e.kind==='stop').at(-1)||all[0];
 const entries=[chosen],seen=new Set([Number(chosen.place.lat).toFixed(5)+':'+Number(chosen.place.lng).toFixed(5)]);
 for(const e of all){const key=Number(e.place.lat).toFixed(5)+':'+Number(e.place.lng).toFixed(5);
  if(!seen.has(key)){seen.add(key);entries.push(e);}}
 const w=Math.max(320,Math.min(1024,Math.round(parent.clientWidth||390)));
 const h=Math.max(240,Math.min(1024,Math.round(parent.clientHeight||240)));
 const coords=entries.map(e=>({x:Number(e.place.lat),y:Number(e.place.lng)}));
 const center=coords[0],layout=focusedStaticMapLayout(coords,center,w,h,13);
 if(!layout){hide();return;}
 const density=window.devicePixelRatio>=1.5?'2':'1';
 const d=day(),dual=window.YeoPins?.overlapRole?.([{place:d?.origin}],d?.origin,d?.destination)==='both';
 const next=[d?.id,w,h,density,dual?'both':'separate',...entries.map(e=>e.place.id+':'+e.place.lat+':'+e.place.lng+':'+e.kind),focusId||''].join('|');
 if(signature===next)return;
 signature=next;const token=++serial;pins.replaceChildren();box.hidden=true;
 entries.forEach((e,i)=>{const point=layout.pixels[i];
  if(point.x<0||point.x>w||point.y<0||point.y>h)return;
  const pin=document.createElement('span');
  const d=day(),dual=window.YeoPins?.overlapRole?.([{place:e.place}],d?.origin,d?.destination)==='both';
  pin.className='yg-step2-static-pin'+(i===0?' is-focused':'')+(dual?' is-both':e.kind==='origin'?' is-origin':e.kind==='destination'?' is-destination':'');
  pin.textContent=dual?'출발·도착':e.label;
  pin.title=e.place.name+(dual?' · 출발·도착':'');pin.style.left=point.x/w*100+'%';pin.style.top=point.y/h*100+'%';pins.append(pin);
 });
 const q=new URLSearchParams({
  p:center.x.toFixed(6)+','+center.y.toFixed(6),
  f:center.x.toFixed(6)+','+center.y.toFixed(6),
  w:String(w),h:String(h),z:'13',s:density
 });
 img.onload=()=>{
  if(token!==serial||document.body.dataset.tripStep!=='2'||hasDynamicMap())return;
  const nowW=Math.round(parent.clientWidth),nowH=Math.round(parent.clientHeight);
  if(Math.abs(nowW-w)>2||Math.abs(nowH-h)>2){signature='';box.hidden=true;requestAnimationFrame(render);return;}
  box.hidden=false;document.body.classList.add('yg-step2-static-active');
  if(forceStatic)document.getElementById('map-placeholder')?.classList.add('hidden');
 };
 img.onerror=()=>{if(token===serial)hide();};
 const address='/api/static-map?'+q;
 if(img.getAttribute('src')===address&&img.complete&&img.naturalWidth>0)img.onload();
 else img.src='/api/static-map?'+q;
}
document.addEventListener('trip:map-focus',e=>{focusId=e.detail?.id||null;requestAnimationFrame(render);});
for(const type of ['trip:stops-changed','trip:endpoint-changed','trip:day-changed','trip:days-imported']){
 document.addEventListener(type,()=>{if(type==='trip:day-changed'||type==='trip:days-imported')focusId=null;signature='';requestAnimationFrame(render);});
}
document.addEventListener('trip-maps-auth-failed',()=>{forceStatic=true;signature='';requestAnimationFrame(render);});
document.addEventListener('trip-map-ready',()=>{if(!forceStatic)hide();});
if(parent&&typeof ResizeObserver==='function')new ResizeObserver(()=>{if(document.body.dataset.tripStep==='2')requestAnimationFrame(render);}).observe(parent);
if(typeof MutationObserver==='function')new MutationObserver(()=>{signature='';requestAnimationFrame(render);}).observe(document.body,{attributes:true,attributeFilter:['data-trip-step']});
window.addEventListener('resize',()=>{signature='';requestAnimationFrame(render);});
requestAnimationFrame(render);
