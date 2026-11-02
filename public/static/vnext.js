/** 여행길 vNext · One day at a time.
 * Existing API /api/route and Kakao/Naver map integrations are unchanged. */
(function(){
'use strict';
const app=window.TripApp,$=id=>document.getElementById(id);
if(!app||!$('yg-step-one'))return;
const MS=86400000,MAX_DAYS=10,escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let currentStep=1,busy=false,sheetOpen=false,sheetFreeze=null,lastWarnings=[],dragStartY=0;
const days=()=>app.getDays(),day=()=>app.getDay(),stops=()=>day().stops;
function ms(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;
 const t=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t:NaN;
}
function dateText(value,{short=false}={}){
 if(!Number.isFinite(ms(value)))return '날짜 미정';
 const t=new Date(ms(value));
 if(short)return (t.getUTCMonth()+1)+'.'+String(t.getUTCDate()).padStart(2,'0')+' ('+['일','월','화','수','목','금','토'][t.getUTCDay()]+')';
 return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(ms(value)).replace(/\s+/g,' ');
}
function duration(start,end){const a=ms(start),b=ms(end);return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/MS)+1:0;}
function configured(p){return p&&!/미설정/.test(p.name||'')&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);}
function error(message){$('yg-stage-one-error').textContent=message;$('yg-stage-one-error').hidden=!message;}
function renderDates(){/* Date cards were removed from STEP 1; only the duration is visible. */}
function syncDateRange(){
 const start=$('yg-start-date').value,end=$('yg-end-date').value,count=duration(start,end);
 if(!start||!end){$('yg-duration').textContent='두 날짜를 선택해 주세요.';error('');return;}
 if(count<1){$('yg-duration').textContent='날짜를 확인해 주세요';error('돌아오는 날은 출발일보다 빠를 수 없어요.');return;}
 if(count>MAX_DAYS){$('yg-duration').textContent='최대 10일까지 선택할 수 있어요';error('여행 기간은 최대 10일까지 설정할 수 있습니다.');return;}
 const expected=Array.from({length:count},(_,i)=>new Date(ms(start)+i*MS).toISOString().slice(0,10)).join('|');
 if(days().map(d=>d.date).join('|')!==expected&&!app.setTravelDates(start,end)){error('여행 날짜를 변경할 수 없어요. 다시 시도해 주세요.');return;}
 error('');
 $('yg-duration').textContent=count===1?'당일치기 여행':(count-1)+'박 '+count+'일 여행';
 renderDates();renderDaily();
}
function renderDaily(){
 const list=days(),active=app.getActive(),d=day();
 if(!d)return;
 const select=$('yg-active-date'),key=list.map(x=>x.date).join('|');
 if(select.dataset.dates!==key){
  select.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+dateText(x.date,{short:true})+'</option>').join('');
  select.dataset.dates=key;
 }
 select.value=String(active);
 const inherit=active>0&&d.originMode!=='custom';
 $('yg-day-inherit').hidden=active===0;
 document.querySelectorAll('[name="yg-origin-choice"]').forEach(el=>el.checked=el.value===(inherit?'inherit':'custom'));
 const previous=list[active-1]?.destination;
 $('yg-origin-display').textContent=inherit?(configured(previous)?previous.name:'전날 도착지를 설정해 주세요'):(configured(d.origin)?d.origin.name:'어디서 출발하나요?');
 $('yg-origin-sub').textContent=inherit?'자동으로 연결된 출발지':(d.origin.address||'공항, 숙소 등 하루를 시작하는 장소');
 $('yg-origin-pick').disabled=inherit;
 $('yg-dest-display').textContent=configured(d.destination)?d.destination.name:'마지막으로 어디에 도착하나요?';
 $('yg-dest-sub').textContent=d.destination.address||'숙소, 공항 등 하루를 마치는 장소';
 const count=d.stops.length,pending=app.unassignedStops().length;
 $('yg-day-stop-count').textContent=count+'곳';
 $('yg-day-stop-sub').textContent='';
 $('yg-empty-inline').hidden=count!==0;
 $('yg-stop-count').textContent=count+'곳';
 $('yg-legacy-stops').hidden=!pending;
 $('yg-legacy-count').textContent=String(pending);
 $('yg-route-mode').value=d.mode==='manual'?'manual':'auto';
 $('yg-origin-pick').classList.toggle('is-configured',configured(d.origin));
 $('yg-dest-pick').classList.toggle('is-configured',configured(d.destination));
 renderAdjustment();if(sheetOpen)renderSheet();
}
function renderAdjustment(){
 const d=day(),ids=d.result?.orderIds||d.stops.map(p=>p.id),byId=new Map(d.stops.map(p=>[p.id,p])),ordered=ids.map(id=>byId.get(id)).filter(Boolean);
 $('yg-adjust-list').innerHTML=ordered.length?ordered.map((p,i)=>{
  const name=escape(p.name),icon=window.TripMeta?.icon?.(p,17)||'•',fixed=Boolean(p.locked);
  return '<div class="yg-adjust-row"><span class="yg-adjust-index">'+(i+1)+'</span>'+
   '<span class="yg-adjust-icon">'+icon+'</span><div class="yg-adjust-name"><strong>'+name+'</strong><small>'+(fixed?'이 순서 고정':'자동 최적화 대상')+'</small></div>'+
   '<label class="yg-adjust-lock"><input type="checkbox" data-route-lock="'+escape(p.id)+'" '+(fixed?'checked':'')+'><span>고정</span></label>'+
   '<div class="yg-adjust-move"><button type="button" data-route-up="'+escape(p.id)+'" aria-label="'+name+' 한 칸 위로" '+(i===0?'disabled':'')+'>▲</button>'+
   '<button type="button" data-route-down="'+escape(p.id)+'" aria-label="'+name+' 한 칸 아래로" '+(i===ordered.length-1?'disabled':'')+'>▼</button></div>'+ 
   '<button type="button" class="yg-adjust-delete" data-adjust-remove="'+escape(p.id)+'" aria-label="'+name+' 방문지 삭제" title="이 방문지 삭제">×</button></div>';
 }).join(''):'<p class="yg-adjust-empty">방문지를 추가하면 순서를 조정할 수 있어요.</p>';
}
function renderSheet(){
 const d=day(),items=d.stops;
 $('yg-sheet-count').textContent=String(items.length);
 $('yg-stop-count').textContent=items.length+'곳';
 $('yg-sheet-date').textContent=dateText(d.date,{short:true})+' · 이 날짜에 담은 장소';
 $('yg-sheet-list').innerHTML=items.length?items.map(p=>{
  const name=escape(p.name),cat=window.TripMeta?.meta?.(p)?.label||p.category||'장소';
  const icon=window.TripMeta?.icon?.(p,18)||'•';
  return '<div class="yg-place-row" data-place-id="'+escape(p.id)+'">'+
   '<span class="yg-place-category" aria-label="'+escape(cat)+'">'+icon+'</span>'+
   '<div class="yg-place-details"><button type="button" class="yg-place-focus" data-focus-place="'+escape(p.id)+'"><strong>'+name+'</strong><small>'+escape(p.address||cat)+'</small></button></div>'+
   '<button type="button" class="yg-place-remove" data-remove-place="'+escape(p.id)+'" aria-label="'+name+' 삭제">×</button></div>';
 }).join(''):'<div class="yg-empty-sheet"><strong>아직 담은 장소가 없어요.</strong><p>가고 싶은 장소를 검색해서 추가해 보세요.</p></div>';
}
function openSheet(){
 if(sheetOpen)return;
 document.activeElement?.blur?.();
 sheetOpen=true;renderSheet();$('yg-place-sheet').hidden=false;
 document.body.classList.add('yg-sheet-open');
 window.YGScrollLock?.lock('visit-sheet');
}
function closeSheet(){
 if(!sheetOpen)return;
 sheetOpen=false;$('yg-place-sheet').hidden=true;
 document.body.classList.remove('yg-sheet-open');
 window.YGScrollLock?.unlock('visit-sheet');
}
function go(next){
 if(next===2&&!days().every(d=>Number.isFinite(ms(d.date)))){error('출발일과 돌아오는 날을 먼저 선택해 주세요.');currentStep=1;document.body.dataset.tripStep='1';return;}
 if(next===3&&!days().some(d=>d.result)){app.toast('먼저 동선을 계산해 주세요.');return;}
 closeSheet();window.YeoSearch?.hide?.();
 currentStep=next;document.body.dataset.tripStep=String(next);
  const help=$('yg-progress-help');
  if(help)help.textContent=next===3?'날짜나 방문지를 수정하려면 위의 ① 여행 일정 · ② 장소 담기를 눌러 이동하세요.':'위의 단계 이름을 누르면 언제든 해당 화면으로 이동할 수 있어요.';
  
 document.querySelectorAll('[data-yg-step]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.ygStep)===next?'step':'false'));
 window.TripUX?.switchView?.(next===3?'map':'edit');
 if(next===1)renderDates();if(next===2||next===3)renderDaily();
 if(next===3)renderWarnings();
 try{localStorage.setItem('yeohaenggil.vnext.step',String(next));}catch{}
 window.scrollTo({top:0,behavior:'instant'});
 if(next===2||next===3)requestAnimationFrame(()=>setTimeout(()=>{app.resizeMap();app.refreshMap();},130));
}
function renderWarnings(){
 const notReady=days().filter(d=>!d.result).length,estimated=days().filter(d=>d.result&&['estimated','mixed','road_partial'].includes(d.result.status)).length;
 const messages=[...new Set([...lastWarnings,...days().flatMap(d=>d.result?.warnings||[])])].filter(Boolean);
 if(notReady)messages.unshift('아직 동선을 만들지 않은 날짜가 '+notReady+'일 있어요.');
 if(estimated)messages.unshift('도로 경로 일부에 근사 계산 또는 추정 구간이 포함될 수 있습니다.');
 $('yg-assign-warning').textContent=messages.join(' ');
}
async function calculate(){
 if(busy)return;
 const arranged=days(),pending=app.unassignedStops(),full=arranged.map((d,i)=>({d,i})).filter(({d})=>configured(d.origin)&&configured(d.destination));
 const incomplete=arranged.find(d=>d.stops.length&&(!configured(d.origin)||!configured(d.destination)));
 if(incomplete){app.setActive(arranged.indexOf(incomplete));go(2);app.toast(dateText(incomplete.date)+' 출발지와 도착지를 먼저 설정해 주세요.');return;}
 if(pending.length){
  go(2);app.toast('기존 미배정 장소 '+pending.length+'곳이 남아 있어요. 날짜를 고른 뒤 한 번에 옮겨 주세요.');return;
 }
 if(!full.length){app.toast('출발지와 도착지를 설정해 주세요.');go(2);return;}
 // Existing assigned visits are pinned to their day. Only the unassigned pool is redistributed.
 const snapshot=JSON.stringify({days:arranged.map(d=>({date:d.date,origin:d.origin,destination:d.destination,stops:d.stops,mode:d.mode})),pending});
 const routeRequest=async(d,orderedStops)=>{
  const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({origin:d.origin,destination:d.destination,stops:orderedStops||d.stops,mode:d.mode==='manual'?'manual':'auto',departure:d.departure||'09:00'})});
  const route=await response.json().catch(()=>null);
  if(!response.ok)throw Error(dateText(d.date)+': '+(route?.detail||'네이버 경로 계산이 실패했어요.'));
  return route;
 };
 busy=true;for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=true;
 const overlay=$('yg-calc-overlay'),bar=$('yg-calc-bar'),counter=$('yg-calc-count'),message=$('yg-calc-overlay-message');
 let completed=0;
 const progress=()=>{
  bar.max=full.length;bar.value=completed;
  counter.textContent=completed+' / '+full.length+'일 완료';
  message.textContent=completed===full.length?'계산 결과를 정리하고 있어요.':'날짜별 실제 자동차 이동 경로를 확인하고 있어요.';
 };
 overlay.hidden=false;progress();
 $('yg-calc-progress').hidden=false;
 $('yg-calc-progress').textContent='동선 계산 중 · 0 / '+full.length+'일 완료';
 try{
  let result;
  const routes=arranged.map(d=>({date:d.date,route:null})),queue=[...full];
  await Promise.all(Array.from({length:Math.min(2,queue.length)},async()=>{
   while(queue.length){const {d,i}=queue.shift();routes[i].route=await routeRequest(d);
    completed++;progress();$('yg-calc-progress').textContent='동선 계산 중 · '+completed+' / '+full.length+'일 완료';
   }
  }));
  result={days:routes,warnings:[]};
  const latest=JSON.stringify({days:days().map(d=>({date:d.date,origin:d.origin,destination:d.destination,stops:d.stops,mode:d.mode})),pending:app.unassignedStops()});
  if(snapshot!==latest)throw Error('계산 중 일정이 변경됐어요. 다시 계산해 주세요.');
  const ok=app.applyDailyRoutes(result);
  if(!ok)throw Error('계산 결과와 현재 방문지가 일치하지 않아요. 다시 계산해 주세요.');
  lastWarnings=result.warnings||[];$('yg-calc-progress').hidden=true;go(3);
 }catch(e){app.toast('동선 계산 실패: '+e.message);$('yg-calc-progress').textContent=e.message;}
 finally{
  overlay.hidden=true;busy=false;
  if(completed===full.length)$('yg-calc-progress').hidden=true;
  for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=false;
 }
}
function openSearch(){
 if(!days().every(d=>d.date)){app.toast('여행 날짜를 먼저 선택해 주세요.');return;}
 if(window.YeoSearch)window.YeoSearch.show();else app.openModal('stop');
}
// STEP 1: The native calendar is date-only, no endpoint inputs here.
$('yg-start-date').addEventListener('change',()=>{
 if(!$('yg-end-date').value)$('yg-end-date').value=$('yg-start-date').value;
 syncDateRange();
});
$('yg-end-date').addEventListener('change',syncDateRange);
// STEP 2: Selecting a date never recreates/stomps another day's stops.
$('yg-active-date').addEventListener('change',e=>app.setActive(Number(e.target.value)));
$('yg-origin-pick').addEventListener('click',()=>{if(window.YeoSearch)window.YeoSearch.show('origin');else app.openModal('origin');});
$('yg-dest-pick').addEventListener('click',()=>{if(window.YeoSearch)window.YeoSearch.show('destination');else app.openModal('destination');});
document.querySelectorAll('[name="yg-origin-choice"]').forEach(radio=>radio.addEventListener('change',()=>{
 if(!radio.checked)return;
 app.setDayOriginMode(app.getActive(),radio.value);
 if(radio.value==='custom'){if(window.YeoSearch)window.YeoSearch.show('origin');else app.openModal('origin');}
}));
$('yg-add-visit').addEventListener('click',openSearch);
$('yg-fit-all').addEventListener('click',()=>{app.fitMap();app.resizeMap();});
$('yg-legacy-assign').addEventListener('click',()=>{
 const count=app.unassignedStops().length,chosen=day()?.date;
 if(!count||!chosen)return;
 if(!confirm('기존 미배정 장소 '+count+'곳을 '+dateText(chosen,{short:true})+' 일정에 담을까요?'))return;
 const result=app.moveUnassignedToActive();
 if(!result.ok)return app.toast(result.error);
 app.toast('기존 장소 '+result.count+'곳을 이 날짜로 옮겼어요.');renderDaily();
});
$('yg-next-places').addEventListener('click',()=>go(2));
$('yg-back-dates').addEventListener('click',()=>go(1));
$('yg-back-places').addEventListener('click',()=>go(2));
$('yg-calculate').addEventListener('click',calculate);
$('yg-three-recalc').addEventListener('click',calculate);
$('yg-three-add').addEventListener('click',()=>openSearch());
$('yg-open-stops').addEventListener('click',openSheet);
$('yg-three-list').addEventListener('click',openSheet);
$('yg-route-mode').addEventListener('change',e=>{
 app.setRouteMode(e.target.value);renderDaily();app.toast('계산 방식을 변경했어요. 다시 계산해 주세요.');
});
$('yg-place-sheet').addEventListener('click',e=>{
 if(e.target.closest('[data-close-sheet]'))return closeSheet();
 const remove=e.target.closest('[data-remove-place]');
 if(remove){app.removeStop(remove.dataset.removePlace);renderDaily();return;}
 const focus=e.target.closest('[data-focus-place]');
 if(focus){
  const p=app.allStops().find(s=>s.id===focus.dataset.focusPlace);
  if(!p)return;closeSheet();go(2);app.focusPlace(p.id);
  document.getElementById('map-region').scrollIntoView({behavior:'smooth',block:'center'});
 }
});

$('yg-adjust-list').addEventListener('click',e=>{
 const remove=e.target.closest('[data-adjust-remove]');
 if(remove){
  const id=remove.dataset.adjustRemove;
  if(!day().stops.some(p=>p.id===id))return;
  if(app.removeStop(id)){renderDaily();app.toast('방문지를 삭제했어요. 다시 최적화해 주세요.');}
  return;
 }
 const up=e.target.closest('[data-route-up]'),down=e.target.closest('[data-route-down]');
 if(up){app.moveRouteStop(up.dataset.routeUp,-1);renderDaily();}
 else if(down){app.moveRouteStop(down.dataset.routeDown,1);renderDaily();}
});
$('yg-adjust-list').addEventListener('change',e=>{
 const checkbox=e.target.closest('[data-route-lock]');if(checkbox){app.setRouteStopLocked(checkbox.dataset.routeLock,checkbox.checked);renderDaily();}
});
$('yg-sheet-map').addEventListener('click',()=>{closeSheet();openSearch();});

const sheetHeader=$('yg-place-sheet').querySelector('.yg-sheet-head');
sheetHeader.addEventListener('touchstart',e=>{dragStartY=e.touches[0]?.clientY||0;},{passive:true});
sheetHeader.addEventListener('touchend',e=>{if((e.changedTouches[0]?.clientY||0)-dragStartY>85)closeSheet();},{passive:true});
document.querySelectorAll('[data-yg-step]').forEach(btn=>btn.addEventListener('click',()=>go(Number(btn.dataset.ygStep))));
document.addEventListener('trip:endpoint-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:day-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:stops-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:stop-added',()=>renderDaily());
document.addEventListener('trip:route-mode-changed',()=>renderDaily());
document.addEventListener('trip:days-imported',()=>{
 const d=days(),valid=d.length&&d.every(x=>Number.isFinite(ms(x.date)));
 $('yg-start-date').value=valid?d[0].date:'';
 $('yg-end-date').value=valid?d.at(-1).date:'';
 if(valid){$('yg-duration').textContent=d.length===1?'당일치기 여행':(d.length-1)+'박 '+d.length+'일 여행';error('');go(2);}
 else{$('yg-duration').textContent='날짜를 선택해 주세요.';go(1);}
 renderDaily();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen)closeSheet();});
function init(){
 document.body.classList.remove('region-needs-choice');document.body.classList.add('region-ready');
 const d=days();
 if(d.length&&d.every(x=>x.date)){
  $('yg-start-date').value=d[0].date;$('yg-end-date').value=d.at(-1).date;syncDateRange();
 }else{$('yg-duration').textContent='날짜를 선택해 주세요';renderDates();}
 const stored=(()=>{try{return Number(localStorage.getItem('yeohaenggil.vnext.step'))}catch{return 1}})();
 go(d.every(x=>x.date)&&(stored===2||stored===3)&&d.some(x=>x.result||stored===2)?stored:1);
 renderDaily();
}
window.YeoNext={go,calculate,renderDaily,renderSheet,openSheet,dateLabel:()=>dateText(day()?.date,{short:true}),searchRegion:()=>''};
init();
})();
