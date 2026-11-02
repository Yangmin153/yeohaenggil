import {decodeSnapshot} from './shared-trip-core.js';
import {mapPlot,buildTripCard,downloadBlob,shareImage} from './trip-card.js';
const $=id=>document.getElementById(id);
let snapshot=null,index=0,map=null,markers=[],line=null;
const svgNS='http://www.w3.org/2000/svg';
function el(tag,cls='',text=''){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function placeLine(day){
 const root=$('sv-timeline');root.replaceChildren();
 day.p.forEach((p,i)=>{
  const item=el('li','sv-stop'),badge=el('span','sv-number',i===0?'출발':i===day.p.length-1?'도착':String(i));
  const text=el('div','sv-stop-text');text.append(el('strong','',p.n));
  if(p.a)text.append(el('small','',p.a));
  item.append(badge,text);root.append(item);
 });
}
function svgMap(day){
 const svg=$('sv-fallback-map');svg.replaceChildren();
 const coords=mapPlot(day.p,500,260);
 const bg=document.createElementNS(svgNS,'rect');Object.entries({x:0,y:0,width:500,height:260,fill:'#e9f8f2'}).forEach(([k,v])=>bg.setAttribute(k,v));svg.append(bg);
 const poly=document.createElementNS(svgNS,'polyline');
 poly.setAttribute('points',coords.map(p=>p.x+','+p.y).join(' '));poly.setAttribute('fill','none');poly.setAttribute('stroke','#14b8a6');poly.setAttribute('stroke-width','4');poly.setAttribute('stroke-dasharray','8 6');svg.append(poly);
 coords.forEach((p,i)=>{
  const c=document.createElementNS(svgNS,'circle');
  Object.entries({cx:p.x,cy:p.y,r:15,fill:i===0?'#008b78':i===coords.length-1?'#e98f6b':'#23b1a0'}).forEach(([k,v])=>c.setAttribute(k,v));svg.append(c);
  const t=document.createElementNS(svgNS,'text');
  Object.entries({x:p.x,y:p.y+5,fill:'#fff','font-size':'13','font-weight':'800','text-anchor':'middle'}).forEach(([k,v])=>t.setAttribute(k,v));t.textContent=i===0?'S':i===coords.length-1?'E':String(i);svg.append(t);
 });
 svg.hidden=false;
}
function drawRealMap(day){
 if(!map||!window.naver?.maps){svgMap(day);return;}
 markers.forEach(m=>m.setMap(null));markers=[];if(line){line.setMap(null);line=null;}
 const maps=window.naver.maps,pts=day.p.map(p=>new maps.LatLng(p.x,p.y));
 const bounds=new maps.LatLngBounds();
 pts.forEach((latlng,i)=>{
  bounds.extend(latlng);
  markers.push(new maps.Marker({map,position:latlng,title:day.p[i].n}));
 });
 line=new maps.Polyline({map,path:pts,strokeColor:'#19b7a1',strokeWeight:4,strokeOpacity:.8,strokeStyle:'shortdash'});
 if(pts.length===2&&pts[0].lat()===pts[1].lat()&&pts[0].lng()===pts[1].lng()){map.setCenter(pts[0]);map.setZoom(13);}
 else map.fitBounds(bounds,{top:38,right:32,bottom:44,left:32,maxZoom:14});
 $('sv-fallback-map').hidden=true;
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
 $('sv-metrics').textContent=(day.m!==null?'차량 이동 약 '+day.m+'분':'이동시간 미표시')+(day.k!==null?' · '+(day.k/1000).toFixed(1)+'km':'');
 placeLine(day);svgMap(day);if(map)drawRealMap(day);
}
async function act(kind){
 try{
  const day=snapshot.d[index],blob=await buildTripCard(day);
  if(kind==='save')await downloadBlob(blob,'여행길-'+day.t+'.png');
  else if(!await shareImage(blob,day))notice('이미지를 저장했어요. 카카오톡에서 사진을 첨부해 보내주세요.');
 }catch(e){if(e.name!=='AbortError')notice(e.message);}
}
function notice(m){const n=$('sv-error');n.hidden=false;n.textContent=m;}
(async()=>{
 try{
  const code=location.hash.startsWith('#trip=')?location.hash.slice(6):'';
  snapshot=await decodeSnapshot(code);
  $('sv-content').hidden=false;paint();void initMap();
  $('sv-save-card').addEventListener('click',()=>act('save'));
  $('sv-share-card').addEventListener('click',()=>act('share'));
 }catch(e){notice(e.message||'공유 링크를 열 수 없습니다.');}
})();
