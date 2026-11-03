import {decodeSnapshot} from './shared-trip-core.js';
import {staticMapLayout} from './static-map-layout.js';
const $=id=>document.getElementById(id);
let snapshot=null,index=0,map=null,markers=[],staticBackground=null;
const svgNS='http://www.w3.org/2000/svg';
const role=(day,i)=>day.p[i]?.r||(i===0?'S':i===day.p.length-1?'E':'V');
const markerLabel=(day,i)=>role(day,i)==='V'?String(day.p.slice(0,i+1).filter((p,j)=>role(day,j)==='V').length):role(day,i);
function el(tag,cls='',text=''){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function placeLine(day){
 const root=$('sv-timeline');root.replaceChildren();
 if(!day.p.length){root.append(el('li','sv-stop-empty','아직 담은 장소가 없어요. 일정을 만드는 중이에요.'));return;}
 day.p.forEach((p,i)=>{
  const item=el('li','sv-stop sv-stop-'+role(day,i).toLowerCase()),badge=el('span','sv-number',role(day,i)==='S'?'출발':role(day,i)==='E'?'도착':markerLabel(day,i));
  const text=el('div','sv-stop-text');text.append(el('strong','',p.n));
  if(p.a)text.append(el('small','',p.a));
  const focus=el('button','sv-stop-focus','지도에서 보기');focus.type='button';focus.dataset.focusIndex=String(i);focus.setAttribute('aria-label',p.n+' 위치 지도에서 보기');
  item.append(badge,text,focus);root.append(item);
 });
}
function svgMap(day){
 const svg=$('sv-fallback-map');svg.replaceChildren();
 const bg=document.createElementNS(svgNS,'rect');
 Object.entries({x:0,y:0,width:904,height:285,fill:'transparent'}).forEach(([k,v])=>bg.setAttribute(k,v));svg.append(bg);
 const layout=staticMapLayout(day.p,904,285);
 const coords=layout?.pixels||[];
 if(!coords.length){
  const t=document.createElementNS(svgNS,'text');
  Object.entries({x:452,y:144,fill:'#66887f','font-size':'16','text-anchor':'middle'}).forEach(([k,v])=>t.setAttribute(k,v));
  t.textContent='방문지를 추가하면 위치를 확인할 수 있어요.';svg.append(t);
 }
 coords.forEach((p,i)=>{
  const c=document.createElementNS(svgNS,'circle');
  Object.entries({cx:p.x,cy:p.y,r:16,fill:role(day,i)==='S'?'#008b78':role(day,i)==='E'?'#e98f6b':'#23b1a0'}).forEach(([k,v])=>c.setAttribute(k,v));svg.append(c);
  const t=document.createElementNS(svgNS,'text');
  Object.entries({x:p.x,y:p.y+5,fill:'#fff','font-size':'14','font-weight':'800','text-anchor':'middle'}).forEach(([k,v])=>t.setAttribute(k,v));t.textContent=markerLabel(day,i);svg.append(t);
 });
 svg.hidden=false;
}
function renderStaticMap(day){
 staticBackground?.remove();staticBackground=null;
 const layout=staticMapLayout(day.p);if(!layout||map)return;
 const img=document.createElement('img');img.className='sv-static-background';img.alt='네이버 지도 배경';
 img.decoding='async';img.src='/api/static-map?p='+encodeURIComponent(day.p.map(p=>p.x.toFixed(6)+','+p.y.toFixed(6)).join(';'));
 img.addEventListener('error',()=>{img.remove();staticBackground=null;$('sv-map-caption').textContent='지도 배경을 불러오지 못했어요. 장소 위치는 아래 목록에서 확인할 수 있어요.';});
 img.addEventListener('load',()=>{$('sv-map-caption').textContent='네이버 지도 · 방문지 위치 표시 · 실제 도로 경로선은 포함하지 않아요.';});
 const root=$('sv-map');root.insertBefore(img,root.firstChild);staticBackground=img;
}
function drawRealMap(day){
 if(!map||!window.naver?.maps){svgMap(day);renderStaticMap(day);return;}
 markers.forEach(m=>m.setMap(null));markers=[];
 const maps=window.naver.maps,pts=day.p.map(p=>new maps.LatLng(p.x,p.y));
 if(!pts.length){$('sv-fallback-map').hidden=false;$('sv-map-caption').textContent='아직 표시할 장소가 없어요.';return;}
 const bounds=new maps.LatLngBounds();
 pts.forEach((latlng,i)=>{
  bounds.extend(latlng);
  const number=markerLabel(day,i);
  const icon={content:'<div class="sv-naver-pin">'+number+'</div>',anchor:new maps.Point(16,16)};
  markers.push(new maps.Marker({map,position:latlng,title:day.p[i].n,icon}));
 });
 if(pts.length===1){map.setCenter(pts[0]);map.setZoom(13);}
 else map.fitBounds(bounds,{top:44,right:45,bottom:50,left:45,maxZoom:14});
 staticBackground?.remove();staticBackground=null;
 $('sv-fallback-map').hidden=true;
 $('sv-map-caption').textContent='네이버 지도에서 원하는 장소를 눌러 위치를 확인해 보세요.';
}

async function initMap(){
 try{
  const cfg=await (await fetch('/api/config',{cache:'no-store'})).json();
  if(!cfg.mapsKeyId)return;
  if(!window.naver?.maps?.Map){
   await new Promise((resolve,reject)=>{
    window.__ygViewMapReady=resolve;const script=document.createElement('script');
    script.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(cfg.mapsKeyId)+'&callback=__ygViewMapReady';
    script.onerror=()=>reject(Error('map unavailable'));document.head.append(script);
    setTimeout(()=>reject(Error('map timeout')),10000);
   });
  }
  if(!window.naver?.maps?.Map)return;
  map=new window.naver.maps.Map($('sv-map'),{center:new window.naver.maps.LatLng(36.35,127.9),zoom:8,minZoom:6,zoomControl:false});
  paint();
 }catch{ /* The accurate coordinate-based fallback stays visible. */ }
}
function paint(){
 const day=snapshot.d[index],tabs=$('sv-days');tabs.replaceChildren();
 snapshot.d.forEach((d,i)=>{
  const b=el('button','sv-day'+(index===i?' is-active':''),d.t);
  b.type='button';b.setAttribute('aria-pressed',String(index===i));
  b.addEventListener('click',()=>{index=i;paint()});tabs.append(b);
 });
 $('sv-day-status').textContent=day.w==='optimized'?'동선 계산 완료':'여행 계획 중 · 방문 순서는 바뀔 수 있어요';
 $('sv-metrics').textContent=(day.m!==null?'차량 이동 약 '+day.m+'분':'장소 '+day.p.length+'곳')+(day.k!==null?' · '+(day.k/1000).toFixed(1)+'km':'');
 placeLine(day);svgMap(day);if(map)drawRealMap(day);else renderStaticMap(day);
}
function focusPlace(i){
 const day=snapshot?.d?.[index],p=day?.p?.[i];if(!p)return;
 if(map&&window.naver?.maps){
  map.panTo(new window.naver.maps.LatLng(p.x,p.y));map.setZoom(14);
 }
 $('sv-map-caption').textContent=p.n+' · '+(p.a||'위치를 지도에서 확인하고 있어요.');
 $('sv-timeline').querySelectorAll('.sv-stop').forEach((row,j)=>row.classList.toggle('is-focused',j===i));
 if(!map){
  const svg=$('sv-fallback-map');svg.querySelectorAll('circle').forEach((c,j)=>{
   c.setAttribute('stroke',j===i?'#143f39':'#ffffff');c.setAttribute('stroke-width',j===i?'6':'2');
  });
 }
 $('sv-map').scrollIntoView({behavior:'smooth',block:'center'});
}
function fitAll(){
 const day=snapshot?.d?.[index];if(!day)return;
 $('sv-timeline').querySelectorAll('.sv-stop').forEach(row=>row.classList.remove('is-focused'));
 if(map)drawRealMap(day);else {svgMap(day);renderStaticMap(day);}
}

function notice(m){const n=$('sv-error');n.hidden=false;n.textContent=m;}
(async()=>{
 try{
  const code=location.hash.startsWith('#trip=')?location.hash.slice(6):'';
  snapshot=await decodeSnapshot(code);
  $('sv-content').hidden=false;paint();void initMap();
  $('sv-map-fit').addEventListener('click',fitAll);
  $('sv-timeline').addEventListener('click',e=>{const button=e.target.closest('[data-focus-index]');if(button)focusPlace(Number(button.dataset.focusIndex));});
 }catch(e){notice(e.message||'공유 링크를 열 수 없습니다.');}
})();
