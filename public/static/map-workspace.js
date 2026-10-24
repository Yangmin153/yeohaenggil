/** Map workspace: large map, gesture recovery, sheet-aware fit, route export. */
(function(){'use strict';const $=id=>document.getElementById(id);const app=()=>window.TripApp;let fullscreen=false,sheetOpen=false,fitTimeout=null;
const media=window.matchMedia('(max-width: 768px)');
function days(){return app()?.getDays()||[];}
function current(){return app()?.getDay();}
function visibleSheetPixels(){const sheet=$('map-sheet'),map=$('map-region');if(!sheet||!map||getComputedStyle(sheet).display==='none')return 0;
 const a=sheet.getBoundingClientRect(),b=map.getBoundingClientRect();return Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
function fitPadding(){const small=media.matches,height=$('map-region')?.clientHeight||300;return {top:small?18:34,left:small?16:42,right:small?16:42,bottom:small?24:Math.max(40,visibleSheetPixels()+24)};}
function escaped(t){return String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){const d=current();if(!d)return;
 $('map-day-select').innerHTML=days().map((day,i)=>`<option value="${i}" ${i===app().getActive()?'selected':''}>${day.date?new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z')):(i+1)+'일 차'}</option>`).join('');
 const ordered=d.result?.orderIds?.length?d.result.orderIds.map(id=>d.stops.find(x=>x.id===id)).filter(Boolean):d.stops;
 const places=[d.origin,...ordered,d.destination].filter(p=>p&&!/미설정/.test(p.name));
 $('map-sheet-list').innerHTML=places.map((p,i)=>`<button class="map-sheet-place" type="button" data-map-place="${escaped(p.id)}"><span class="map-sheet-order">${d.result?(i===0?'S':i===places.length-1?'E':i):'•'}</span><span class="map-sheet-place-name">${escaped(p.name)}</span><span class="map-sheet-category">${p.id===d.origin.id?'출발':p.id===d.destination.id?'도착':window.TripMeta.meta(p).label}</span></button>`).join('');
 const locked=Boolean(window.__tripMapLocked);$('map-lock').textContent=locked?'움직임 허용':'지도 잠그기';$('map-lock').setAttribute('aria-pressed',String(locked));
 $('map-maximize').textContent=fullscreen?'작게 보기':'지도 크게';$('map-maximize').setAttribute('aria-pressed',String(fullscreen));
 $('map-sheet-toggle').setAttribute('aria-expanded',String(sheetOpen));$('map-sheet').classList.toggle('is-open',sheetOpen);
}
function resize(){requestAnimationFrame(()=>{app()?.resizeMap();});}
function fit(){app()?.fitMap(fitPadding());}
function lock(next){window.__tripMapLocked=next;app()?.setMapLocked(next);render();}
function expanded(next){fullscreen=next;document.body.classList.toggle('map-immersive',next);$('map-full-close').hidden=!next;if(next)sheetOpen=false;render();resize();setTimeout(fit,120);}
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
 $('map-sheet-toggle').addEventListener('click',()=>{sheetOpen=!sheetOpen;render();resize();setTimeout(fit,95);});
 $('map-sheet-list').addEventListener('click',e=>{const btn=e.target.closest('[data-map-place]');if(btn)mapPlace(btn.dataset.mapPlace);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullscreen)expanded(false)});
 media.addEventListener?.('change',()=>{if(!fullscreen)lock(false);resize()});
 window.MapWorkspace={refresh:render,fitPadding,visibleSheetPixels};render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
