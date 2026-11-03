import {decodeSnapshot} from './shared-trip-core.js';
const $=id=>document.getElementById(id);
let snapshot=null,index=0,map=null,markers=[],mapInitializing=false;
const role=(day,i)=>day.p[i]?.r||(i===0?'S':i===day.p.length-1?'E':'V');
const markerLabel=(day,i)=>role(day,i)==='V'?String(day.p.slice(0,i+1).filter((p,j)=>role(day,j)==='V').length):role(day,i);
function el(tag,cls='',value=''){
 const node=document.createElement(tag);if(cls)node.className=cls;if(value)node.textContent=value;return node;
}
function showMapStatus(message,failed=false){
 $('sv-map-caption').textContent=message;
 $('sv-map-unavailable').hidden=!failed;
 if(failed)$('sv-map-unavailable').textContent=message;
}
function clearMarkers(){
 for(const marker of markers)try{marker.setMap(null);}catch(error){
  console.warn('공유 지도 마커를 정리하지 못했어요.',error?.message||error);
 }
 markers=[];
}
function placeLine(day){
 const root=$('sv-timeline');root.replaceChildren();
 if(!day.p.length){
  root.append(el('li','sv-stop-empty','아직 담은 장소가 없어요. 일정을 만드는 중이에요.'));return;
 }
 day.p.forEach((place,i)=>{
  const row=el('li','sv-stop sv-stop-'+role(day,i).toLowerCase());
  const marker=el('span','sv-number',role(day,i)==='S'?'출발':role(day,i)==='E'?'도착':markerLabel(day,i));
  const details=el('div','sv-stop-text');details.append(el('strong','',place.n));
  if(place.a)details.append(el('small','',place.a));
  const focus=el('button','sv-stop-focus','지도에서 보기');focus.type='button';
  focus.dataset.focusIndex=String(i);focus.setAttribute('aria-label',place.n+' 지도에서 보기');
  row.append(marker,details,focus);root.append(row);
 });
}
function drawMap(){
 if(!map||!window.naver?.maps)return;
 clearMarkers();
 const day=snapshot?.d[index],points=day?.p||[],maps=window.naver.maps;
 if(!points.length){
  showMapStatus('아직 지도에 표시할 장소가 없어요.',true);return;
 }
 $('sv-map-unavailable').hidden=true;
 const bounds=new maps.LatLngBounds();
 points.forEach((place,i)=>{
  const position=new maps.LatLng(place.x,place.y);bounds.extend(position);
  const marker=new maps.Marker({
   map,position,title:place.n,zIndex:i+10,
   icon:{
    content:'<span class="sv-naver-pin">'+markerLabel(day,i)+'</span>',
    anchor:new maps.Point(16,16)
   }
  });
  if(typeof maps.Event?.addListener==='function')maps.Event.addListener(marker,'click',()=>focusPlace(i,false));
  markers.push(marker);
 });
 if(points.length===1) {map.setCenter(new maps.LatLng(points[0].x,points[0].y));map.setZoom(13);}
 else map.fitBounds(bounds,{top:56,right:52,bottom:56,left:52,maxZoom:14});
 showMapStatus('네이버 지도 · 실제 도로 경로선이 아닌 방문지 위치만 표시합니다.');
}
function paint(){
 const day=snapshot.d[index],tabs=$('sv-days');tabs.replaceChildren();
 snapshot.d.forEach((d,i)=>{
  const button=el('button','sv-day'+(index===i?' is-active':''),d.t);
  button.type='button';button.setAttribute('aria-pressed',String(index===i));
  button.addEventListener('click',()=>{index=i;paint();});
  tabs.append(button);
 });
 $('sv-day-status').textContent=day.w==='optimized'?'동선 계산 완료':'여행 계획 중 · 방문 순서는 바뀔 수 있어요';
 $('sv-metrics').textContent=(day.m!==null?'차량 이동 약 '+day.m+'분':'장소 '+day.p.length+'곳')+(day.k!==null?' · '+(day.k/1000).toFixed(1)+'km':'');
 placeLine(day);drawMap();
}
function focusPlace(i,scroll=true){
 const place=snapshot?.d[index]?.p?.[i];if(!place)return;
 if(map&&window.naver?.maps){
  map.panTo(new window.naver.maps.LatLng(place.x,place.y));
  map.setZoom(14);
 }
 $('sv-map-caption').textContent=place.n+' · '+(place.a||'지도에서 위치를 확인하세요.');
 $('sv-timeline').querySelectorAll('.sv-stop').forEach((row,j)=>row.classList.toggle('is-focused',j===i));
 if(scroll)$('sv-map').scrollIntoView({behavior:'smooth',block:'center'});
}
function fitAll(){
 $('sv-timeline').querySelectorAll('.sv-stop').forEach(row=>row.classList.remove('is-focused'));
 drawMap();
}
async function initMap(){
 if(map||mapInitializing)return;
 mapInitializing=true;
 try{
  const response=await fetch('/api/config',{cache:'no-store'});
  const config=await response.json();
  if(!response.ok||!config.mapsKeyId)throw Error('네이버 지도 설정을 확인해 주세요.');
  if(!window.naver?.maps?.Map){
   await new Promise((resolve,reject)=>{
    let settled=false;
    const timeout=setTimeout(()=>{if(!settled){settled=true;reject(Error('네이버 지도 연결 시간이 초과됐어요.'));}},12000);
    window.__ygShareMapReady=()=>{
     if(settled)return;settled=true;clearTimeout(timeout);resolve();
    };
    const script=document.createElement('script');
    script.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(config.mapsKeyId)+'&callback=__ygShareMapReady';
    script.onerror=()=>{if(!settled){settled=true;clearTimeout(timeout);reject(Error('네이버 지도 스크립트를 불러올 수 없어요.'));}};
    document.head.append(script);
   });
  }
  if(!window.naver?.maps?.Map)throw Error('네이버 지도를 사용할 수 없어요.');
  // Exactly one dynamic map. No static image, SVG or artificial route overlay.
  map=new window.naver.maps.Map($('sv-map'),{
   center:new window.naver.maps.LatLng(36.35,127.9),
   zoom:8,minZoom:6,maxZoom:18,zoomControl:true,zoomControlOptions:{position:window.naver.maps.Position.TOP_RIGHT}
  });
  drawMap();
 }catch(error){
  showMapStatus('지도를 표시하지 못했어요. '+(error?.message||'연결을 다시 확인해 주세요.'),true);
 }finally{mapInitializing=false;}
}
function showError(message){
 const error=$('sv-error');error.hidden=false;error.textContent=message;
}
(async()=>{
 try{
  const code=location.hash.startsWith('#trip=')?location.hash.slice(6):'';
  snapshot=await decodeSnapshot(code);
  $('sv-content').hidden=false;
  paint();
  $('sv-map-fit').addEventListener('click',fitAll);
  $('sv-timeline').addEventListener('click',event=>{
   const button=event.target.closest('[data-focus-index]');
   if(button)focusPlace(Number(button.dataset.focusIndex));
  });
  void initMap();
 }catch(error){showError(error?.message||'이 여행 링크를 열 수 없어요.');}
})();