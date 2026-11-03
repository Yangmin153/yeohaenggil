/** Map workspace: large map, gesture recovery, sheet-aware fit, route export. */
(function(){'use strict';const $=id=>document.getElementById(id);const app=()=>window.TripApp;let fullscreen=false,sheetOpen=false,fitTimeout=null,lastDateSignature='';
const media=window.matchMedia('(max-width: 768px)');
function days(){return app()?.getDays()||[];}
function current(){return app()?.getDay();}
function visibleSheetPixels(){const sheet=$('map-sheet'),map=$('map-region');if(!sheet||!map||getComputedStyle(sheet).display==='none')return 0;
 const a=sheet.getBoundingClientRect(),b=map.getBoundingClientRect();return Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
function fitPadding(){const small=media.matches,height=$('map-region')?.clientHeight||300;return {top:small?18:34,left:small?16:42,right:small?16:42,bottom:small?24:Math.max(40,visibleSheetPixels()+24)};}
function escaped(t){return String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dateLabel(d,i){
 if(!d.date)return (i+1)+'일 차';
 const t=new Date(d.date+'T12:00:00Z');
 return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(t);
}
function closeDateMenu(returnFocus=false){
 const menu=$('yg-result-day-menu'),toggle=$('yg-result-day-toggle');
 menu.hidden=true;toggle.setAttribute('aria-expanded','false');
 if(returnFocus)toggle.focus({preventScroll:true});
}
function renderDatePicker(){
 const all=days(),active=app().getActive(),signature=all.map(d=>d.id+':'+d.date+':'+Boolean(d.result)).join('|');
 const native=$('map-day-select'),menu=$('yg-result-day-menu'),toggle=$('yg-result-day-toggle');
 if(signature!==lastDateSignature){
  lastDateSignature=signature;
  native.innerHTML=all.map((d,i)=>'<option value="'+i+'">'+escaped(dateLabel(d,i))+'</option>').join('');
  menu.innerHTML=all.map((d,i)=>'<button type="button" data-result-day="'+i+'" class="yg-result-day-option"><span>'+escaped(dateLabel(d,i))+'</span><small>'+(d.result?'동선 계산 완료':'계산 전')+'</small></button>').join('');
 }
 native.value=String(active);
 $('yg-result-day-label').textContent=dateLabel(all[active],active);
 toggle.setAttribute('aria-label','여행 날짜: '+dateLabel(all[active],active)+'. 다른 날짜 선택');
 menu.querySelectorAll('[data-result-day]').forEach((el,i)=>{
  const selected=i===active;el.classList.toggle('is-active',selected);
  el.setAttribute('aria-current',selected?'date':'false');
 });
}
function render(){const d=current();if(!d)return;
 renderDatePicker();
 const ordered=d.result?.orderIds?.length?d.result.orderIds.map(id=>d.stops.find(x=>x.id===id)).filter(Boolean):d.stops;
 const places=[d.origin,...ordered,d.destination].filter(p=>p&&!/미설정/.test(p.name));
 $('map-sheet-list').innerHTML=places.map((p,i)=>`<button class="map-sheet-place" type="button" data-map-place="${escaped(p.id)}"><span class="map-sheet-order">${i===0?'출발':i===places.length-1?'도착':d.result?i:'•'}</span><span class="map-sheet-place-name">${escaped(p.name)}</span><span class="map-sheet-category">${p.id===d.origin.id?'출발':p.id===d.destination.id?'도착':window.TripMeta.meta(p).label}</span></button>`).join('');
 const locked=Boolean(window.__tripMapLocked);$('map-lock').textContent=locked?'움직임 허용':'지도 잠그기';$('map-lock').setAttribute('aria-pressed',String(locked));
 $('map-maximize').textContent=fullscreen?'작게 보기':'지도 크게';$('map-maximize').setAttribute('aria-pressed',String(fullscreen));
 $('map-sheet-toggle').setAttribute('aria-expanded',String(sheetOpen));$('map-sheet').classList.toggle('is-open',sheetOpen);
}
function resize(){requestAnimationFrame(()=>{app()?.resizeMap();});}
function fit(){app()?.fitMap(fitPadding());}
function lock(next){window.__tripMapLocked=next;app()?.setMapLocked(next);render();}
function expanded(next){if(next)window.YGScrollLock?.lock('fullscreen-map');else window.YGScrollLock?.unlock('fullscreen-map');fullscreen=next;document.body.classList.toggle('map-immersive',next);$('map-full-close').hidden=!next;if(next)sheetOpen=false;render();resize();setTimeout(fit,120);}
function mapPlace(id){sheetOpen=false;render();app()?.focusPlace(id);}
function init(){if(!app())return;
 window.__tripMapLocked=false;app().setMapLocked(false);

 const changeZoom=step=>{
  const map=app()?.getMap?.();
  if(!map)return app()?.toast?.('지도가 나타난 다음 눌러주세요.');
  const next=Math.max(6,Math.min(19,map.getZoom()+step));
  if(next!==map.getZoom())map.setZoom(next);
 };
 $('yg-route-fit').addEventListener('click',fit);
 $('map-zoom-out').addEventListener('click',()=>changeZoom(-1));
 $('map-zoom-in').addEventListener('click',()=>changeZoom(1));
 $('map-lock').addEventListener('click',()=>lock(!window.__tripMapLocked));
 $('map-maximize').addEventListener('click',()=>expanded(!fullscreen));$('map-full-close').addEventListener('click',()=>expanded(false));

 $('btn-sidebar-toggle').addEventListener('click',()=>{const collapsed=document.body.classList.toggle('sidebar-collapsed');$('btn-sidebar-toggle').textContent=collapsed?'목록 열기':'목록 접기';$('btn-sidebar-toggle').setAttribute('aria-pressed',String(collapsed));resize();});
 $('map-day-select').addEventListener('change',e=>app().setActive(Number(e.target.value)));
 $('yg-result-day-toggle').addEventListener('click',()=>{
  const menu=$('yg-result-day-menu'),open=menu.hidden;
  if(!open)return closeDateMenu();
  renderDatePicker();menu.hidden=false;menu.classList.remove('is-upward');
  $('yg-result-day-toggle').setAttribute('aria-expanded','true');
  const toggle=$('yg-result-day-toggle').getBoundingClientRect();
  const popupHeight=menu.getBoundingClientRect().height;
  if(window.innerHeight-toggle.bottom<popupHeight+80&&toggle.top>popupHeight+20){
   menu.classList.add('is-upward');
  }
  requestAnimationFrame(()=>menu.querySelector('[aria-current="date"]')?.focus({preventScroll:true}));
 });
 $('yg-result-day-menu').addEventListener('click',e=>{
  const option=e.target.closest('[data-result-day]');if(!option)return;
  const value=Number(option.dataset.resultDay);if(!Number.isInteger(value))return;
  closeDateMenu();app().setActive(value);
  $('yg-result-day-toggle').focus({preventScroll:true});
 });
 document.addEventListener('click',e=>{if(!e.target.closest('#yg-result-date'))closeDateMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('yg-result-day-menu').hidden){e.preventDefault();closeDateMenu(true);}});
 $('yg-result-day-menu').addEventListener('keydown',e=>{
  const options=[...$('yg-result-day-menu').querySelectorAll('[data-result-day]')];
  const index=options.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();closeDateMenu(true);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();options[(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
  }
 });
 $('map-sheet-toggle').addEventListener('click',()=>{sheetOpen=!sheetOpen;render();resize();setTimeout(fit,95);});
 $('map-sheet-list').addEventListener('click',e=>{const btn=e.target.closest('[data-map-place]');if(btn)mapPlace(btn.dataset.mapPlace);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullscreen)expanded(false)});
 media.addEventListener?.('change',()=>{if(!fullscreen)lock(false);resize()});
 window.MapWorkspace={refresh:render,fitPadding,visibleSheetPixels};render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
