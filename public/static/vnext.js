/** 여행길 vNext · One day at a time.
 * Existing API /api/route and Kakao/Naver map integrations are unchanged. */
(function(){
'use strict';
const app=window.TripApp,$=id=>document.getElementById(id);
if(!app||!$('yg-step-one'))return;
const MS=86400000,MAX_DAYS=10,escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let currentStep=1,busy=false,sheetOpen=false,endpointChooserKind=null,endpointChooserFocus=null,inlineExpanded=true,sheetFreeze=null,lastWarnings=[],dragStartY=0,selectedAdjustId=null,editingAdjustId=null;
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
function uniquePlaces(d){
 const all=[d.origin,...d.stops,d.destination].filter(configured);
 const distinct=[];
 for(const p of all)if(!distinct.some(q=>window.YGPlaceRoles?.same?.(p,q)))distinct.push(p);
 return distinct;
}
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
 const count=uniquePlaces(d).length,pending=app.unassignedStops().length;
 $('yg-day-stop-count').textContent=count+'곳';
 $('yg-day-stop-sub').textContent='장소를 담고 목록에서 출발·도착을 골라 주세요.';
 $('yg-role-status-origin').textContent=configured(d.origin)?d.origin.name:'아직 미지정';
 $('yg-role-status-destination').textContent=configured(d.destination)?d.destination.name:'아직 미지정';
 document.querySelector('[data-pick-endpoint="origin"]').setAttribute('aria-label','출발지 선택 · '+(configured(d.origin)?d.origin.name:'아직 미지정'));
 document.querySelector('[data-pick-endpoint="destination"]').setAttribute('aria-label','도착지 선택 · '+(configured(d.destination)?d.destination.name:'아직 미지정'));
 $('yg-empty-inline').hidden=count!==0;
 $('yg-stop-count').textContent=count+'곳';
 $('yg-legacy-stops').hidden=!pending;
 $('yg-legacy-count').textContent=String(pending);
 $('yg-route-mode').value=d.mode==='manual'?'manual':'auto';
 $('yg-origin-pick').classList.toggle('is-configured',configured(d.origin));
 $('yg-dest-pick').classList.toggle('is-configured',configured(d.destination));
 renderAdjustment();renderSheet();renderInlineStops();updateReadiness();
}
function renderAdjustment(){
 const d=day(),ids=d.result?.orderIds||d.stops.map(p=>p.id),byId=new Map(d.stops.map(p=>[p.id,p])),ordered=ids.map(id=>byId.get(id)).filter(Boolean);
 if(selectedAdjustId&&!byId.has(selectedAdjustId))selectedAdjustId=null;
 $('yg-adjust-list').innerHTML=ordered.length?ordered.map((p,i)=>{
  const name=escape(p.name),id=escape(p.id),icon=window.TripMeta?.icon?.(p,17)||'•',checked=selectedAdjustId===p.id;
  return '<div class="yg-adjust-row'+(checked?' is-selected':'')+'">'+
   '<label class="yg-adjust-check" aria-label="'+name+' 수정할 방문지로 선택">'+
   '<input type="checkbox" data-adjust-select="'+id+'" '+(checked?'checked':'')+' aria-label="'+name+' 선택">'+
   '<span class="yg-adjust-checkmark" aria-hidden="true"></span></label>'+
   '<span class="yg-adjust-index">'+(i+1)+'</span>'+
   '<span class="yg-adjust-icon">'+icon+'</span>'+
   '<div class="yg-adjust-name"><strong>'+name+'</strong><small>'+(p.locked?(i+1)+'번째 방문으로 지정됨':'자동 동선 계산 대상')+'</small></div>'+
   '<button type="button" class="yg-adjust-delete" data-adjust-remove="'+id+'" aria-label="'+name+' 방문지 삭제" title="이 방문지 삭제">×</button></div>';
 }).join(''):'<p class="yg-adjust-empty">아직 조정할 방문지가 없어요. 장소를 추가해 주세요.</p>';
 const chosen=byId.get(selectedAdjustId);
 $('yg-adjust-edit-selected').disabled=!chosen;
 $('yg-adjust-selection-note').textContent=chosen?chosen.name+' 선택됨 · 수정 버튼을 눌러 주세요.':'수정할 방문지 한 곳을 체크해 주세요.';
}
function openVisitPositionEditor(){
 const d=day(),p=d.stops.find(x=>x.id===selectedAdjustId);if(!p)return;
 editingAdjustId=p.id;
 const dialog=$('yg-position-dialog'),selector=$('yg-position-select'),ids=d.result?.orderIds||d.stops.map(x=>x.id);
 const current=ids.indexOf(p.id)+1;
 const fixedById=new Map(d.stops.filter(x=>x.locked&&x.id!==p.id).map(x=>[x.id,x.name]));
 selector.replaceChildren();
 const auto=document.createElement('option');auto.value='auto';auto.textContent='자동 최적화에 맡기기 (순서 지정 해제)';selector.append(auto);
 ids.forEach((id,i)=>{
  const item=document.createElement('option');item.value=String(i+1);
  item.textContent=(i+1)+'번째 방문'+(fixedById.has(id)?' · '+fixedById.get(id)+' 지정됨':'');
  item.disabled=fixedById.has(id);selector.append(item);
 });
 selector.value=String(current);
 $('yg-position-place').textContent='선택한 장소: '+p.name;
 $('yg-position-warning').hidden=true;$('yg-position-warning').textContent='';
 dialog.hidden=false;document.body.classList.add('yg-position-open');
 selector.focus({preventScroll:true});
}
function closeVisitPositionEditor(){
 if($('yg-position-dialog').hidden)return;
 $('yg-position-dialog').hidden=true;document.body.classList.remove('yg-position-open');editingAdjustId=null;
 $('yg-adjust-edit-selected').focus({preventScroll:true});
}
async function applyVisitPosition(){
 const id=editingAdjustId,p=day()?.stops.find(x=>x.id===id),selected=$('yg-position-select').value;
 if(!p)return closeVisitPositionEditor();
 const successful=selected==='auto'?app.setRouteStopLocked(id,false):app.setRouteStopPosition(id,Number(selected));
 if(!successful){
  $('yg-position-warning').hidden=false;
  $('yg-position-warning').textContent='이 순서로 변경할 수 없어요. 다른 방문 순서를 선택해 주세요.';
  return;
 }
 closeVisitPositionEditor();selectedAdjustId=null;renderDaily();
 if(configured(day().origin)&&configured(day().destination)){
  app.toast(selected==='auto'?'방문 순서를 다시 자동 계산합니다.':p.name+'을(를) '+selected+'번째로 방문하도록 다시 계산합니다.');
  await calculate();
 }else app.toast('방문 순서 선택을 저장했어요. 출발지와 도착지를 설정하면 새 순서로 계산돼요.');
}

function renderSheet(){
 const d=day(),items=d.stops;
 $('yg-sheet-count').textContent=String(items.length);
 $('yg-stop-count').textContent=uniquePlaces(d).length+'곳';
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
function renderInlineStops(){
 const el=$('yg-inline-stops'),d=day();
 if(!el||!d)return;
 el.hidden=!inlineExpanded;
 $('yg-open-stops').setAttribute('aria-expanded',String(inlineExpanded));
 $('yg-open-stops').querySelector('span:last-child').textContent=inlineExpanded?'⌃':'⌄';
 if(!inlineExpanded)return;
 const inherited=app.getActive()>0&&d.originMode!=='custom';
 const raw=[
  ...(configured(d.origin)?[{p:d.origin,role:'origin',inherited}]:[]),
  ...d.stops.map(p=>({p,role:'stop',inherited:false})),
  ...(configured(d.destination)?[{p:d.destination,role:'destination',inherited:false}]:[])
 ];
 const places=[];
 for(const item of raw){
  const match=places.find(entry=>window.YGPlaceRoles?.same?.(entry.p,item.p));
  if(match){match.roles.add(item.role);continue;}
  places.push({...item,roles:new Set([item.role])});
 }
 if(!places.length){el.innerHTML='<div class="yg-role-empty">장소를 검색해서 추가해 주세요.</div>';return;}
 el.innerHTML=places.map(({p,roles,inherited:locked})=>{
  const id=escape(p.id),name=escape(p.name),description=escape(p.address||window.TripMeta?.meta?.(p)?.label||'저장한 장소');
  const icon=window.TripMeta?.icon?.(p,18)||'•';
  const tags=[...(roles.has('origin')?['<span class="yg-place-role-tag is-origin">출발</span>']:[]),
   ...(roles.has('destination')?['<span class="yg-place-role-tag is-destination">도착</span>']:[])].join('');
  return '<article class="yg-role-place" data-place-id="'+id+'"><div class="yg-role-place-main">'+
   '<span class="yg-role-place-icon" aria-hidden="true">'+icon+'</span>'+
   '<button type="button" class="yg-role-place-focus" data-focus-place="'+id+'"><strong>'+name+'</strong><small>'+description+'</small></button>'+
   (tags?'<span class="yg-role-place-tags">'+tags+'</span>':'')+
   '<button type="button" class="yg-role-place-delete" data-remove-place="'+id+'" '+(locked?'disabled':'')+' aria-label="'+name+' 삭제">×</button>'+
   '</div>'+(locked?'<span class="yg-role-inherited">전날 도착지에서 자동 연결됨</span>':'')+'</article>';
 }).join('');
}
function closeEndpointChooser({restoreFocus=true}={}){
 const dialog=$('yg-endpoint-chooser');
 if(dialog.hidden)return;
 dialog.hidden=true;document.body.classList.remove('yg-endpoint-chooser-open');
 window.YGScrollLock?.unlock('endpoint-chooser');
 const button=endpointChooserFocus;
 endpointChooserKind=null;endpointChooserFocus=null;
 if(restoreFocus&&button?.isConnected)button.focus({preventScroll:true});
}
function renderEndpointChooser(){
 if(!endpointChooserKind)return;
 const d=day(),kind=endpointChooserKind;
 $('yg-endpoint-chooser-title').textContent=kind==='origin'?'출발지 선택':'도착지 선택';
 $('yg-endpoint-chooser-caption').textContent=dateText(d.date,{short:true})+' · 담은 장소에서 선택';
 const current=d[kind],items=[];
 for(const p of [...d.stops,d.origin,d.destination]){
  if(configured(p)&&!items.some(existing=>window.YGPlaceRoles?.same?.(existing,p)))items.push(p);
 }
 const list=$('yg-endpoint-chooser-list');
 if(!items.length){list.innerHTML='<p class="yg-endpoint-chooser-empty">아직 담은 장소가 없어요.<span>아래 장소 검색에서 추가할 수 있어요.</span></p>';return;}
 list.innerHTML=items.map(p=>{
  const chosen=window.YGPlaceRoles?.same?.(p,current),name=escape(p.name),address=escape(p.address||window.TripMeta?.meta?.(p)?.label||'저장한 장소');
  const icon=window.TripMeta?.icon?.(p,18)||'•';
  return '<button type="button" data-chooser-place="'+escape(p.id)+'" data-chooser-selected="'+String(chosen)+'" class="yg-endpoint-chooser-place'+(chosen?' is-selected':'')+'" aria-pressed="'+String(chosen)+'" aria-label="'+name+(chosen?' 선택 해제':' 선택')+'">'+
   '<span class="yg-endpoint-chooser-icon" aria-hidden="true">'+icon+'</span><span class="yg-endpoint-chooser-copy"><strong>'+name+'</strong><small>'+address+'</small></span>'+
   '<span class="yg-endpoint-chooser-select">'+(chosen?'해제':'선택')+'</span></button>';
 }).join('');
}
function openEndpointChooser(kind){
 if(document.body.dataset.tripStep!=='2'||!['origin','destination'].includes(kind))return;
 endpointChooserKind=kind;endpointChooserFocus=document.activeElement;
 renderEndpointChooser();
 $('yg-endpoint-chooser').hidden=false;
 document.body.classList.add('yg-endpoint-chooser-open');
 window.YGScrollLock?.lock('endpoint-chooser');
 $('yg-endpoint-chooser-close').focus({preventScroll:true});
}
function routeReady(d){
 return configured(d.origin)&&configured(d.destination)&&
  (d.stops.length>0||Math.abs(d.origin.lat-d.destination.lat)>=0.00003||Math.abs(d.origin.lng-d.destination.lng)>=0.00003);
}
function readiness(){
 const ready=days().filter(routeReady).length,skipped=days().length-ready;
 return {ready:ready>0,count:ready,skipped,
  message:ready?'': '출발지와 도착지가 설정된 날짜가 최소 1일 필요해요.'};
}
function updateReadiness(){
 const state=readiness(),button=$('yg-calculate'),hint=$('yg-step2-readiness');
 button.disabled=busy||!state.ready;
 button.title=state.ready?state.count+'일 동선을 계산해요. 미완성 날짜는 그대로 두어요.':state.message;
 if(hint)hint.textContent=state.ready
  ?state.count+'일 동선 계산 가능'+(state.skipped?' · 나머지 '+state.skipped+'일은 나중에 완성할 수 있어요.':'')
  :state.message;
 return state;
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
 closeSheet();closeEndpointChooser({restoreFocus:false});window.YeoSearch?.hide?.();
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
 if(document.body.dataset.tripStep==='2'){
  const check=updateReadiness();if(!check.ready){app.toast(check.message+' 설정이 필요해요.');return;}
 }
 const arranged=days(),pending=app.unassignedStops(),full=arranged.map((d,i)=>({d,i})).filter(({d})=>routeReady(d));
 if(!full.length){app.toast('출발지와 도착지가 설정된 날짜가 최소 1일 필요해요.');go(2);return;}
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
  const skipped=arranged.length-full.length;
  lastWarnings=[...(result.warnings||[]),
   ...(skipped?['아직 완성하지 않은 '+skipped+'일은 계산하지 않고 방문지를 보관했어요.']:[]),
   ...(pending.length?['날짜를 정하지 않은 방문지 '+pending.length+'곳은 그대로 보관했어요.']:[])];
  if(!day().result)app.setActive(full[0].i);
  $('yg-calc-progress').hidden=true;go(3);
 }catch(e){app.toast('동선 계산 실패: '+e.message);$('yg-calc-progress').textContent=e.message;}
 finally{
  overlay.hidden=true;busy=false;
  if(completed===full.length)$('yg-calc-progress').hidden=true;
  $('yg-three-recalc').disabled=false;updateReadiness();
 }
}
function openSearch(kind='stop'){
 if(!days().every(d=>d.date)){app.toast('여행 날짜를 먼저 선택해 주세요.');return;}
 if(window.YeoSearch)window.YeoSearch.show(kind);else app.openModal(kind);
}
// STEP 1: The native calendar is date-only, no endpoint inputs here.
$('yg-start-date').addEventListener('change',()=>{
 if(!$('yg-end-date').value)$('yg-end-date').value=$('yg-start-date').value;
 syncDateRange();
});
$('yg-end-date').addEventListener('change',syncDateRange);
// STEP 2: Selecting a date never recreates/stomps another day's stops.
$('yg-active-date').addEventListener('change',e=>{inlineExpanded=true;app.setActive(Number(e.target.value));});
document.querySelectorAll('[data-pick-endpoint]').forEach(btn=>btn.addEventListener('click',()=>openEndpointChooser(btn.dataset.pickEndpoint)));
$('yg-endpoint-chooser-close').addEventListener('click',()=>closeEndpointChooser());
$('yg-endpoint-chooser').addEventListener('click',e=>{
 if(e.target.id==='yg-endpoint-chooser'){closeEndpointChooser();return;}
 const button=e.target.closest('[data-chooser-place]');
 if(!button)return;
 const kind=endpointChooserKind,selected=button.dataset.chooserSelected==='true';
 const done=selected?app.clearCollectedEndpoint(kind):app.setCollectedRole(button.dataset.chooserPlace,kind);
 if(!done?.ok){app.toast(done?.error||(selected?'지정을 해제할 수 없어요.':'장소를 선택할 수 없어요.'));return;}
 closeEndpointChooser();
 if(!selected&&done.id)app.focusPlace(done.id);
 app.toast(selected?(kind==='origin'?'출발지 지정을 해제했어요.':'도착지 지정을 해제했어요.'):
  (kind==='origin'?'출발지로 지정했어요.':'도착지로 지정했어요.'));
});
$('yg-endpoint-chooser-search').addEventListener('click',()=>{
 const kind=endpointChooserKind;
 closeEndpointChooser({restoreFocus:false});
 if(kind)openSearch(kind);
});
$('yg-origin-pick').addEventListener('click',()=>openEndpointChooser('origin'));
$('yg-dest-pick').addEventListener('click',()=>openEndpointChooser('destination'));
document.querySelectorAll('[name="yg-origin-choice"]').forEach(radio=>radio.addEventListener('change',()=>{
 if(!radio.checked)return;
 app.setDayOriginMode(app.getActive(),radio.value);
 if(radio.value==='custom')openEndpointChooser('origin');
}));
$('yg-add-visit').addEventListener('click',()=>openSearch());
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
$('yg-open-stops').addEventListener('click',()=>{inlineExpanded=!inlineExpanded;renderInlineStops();});
$('yg-inline-stops').addEventListener('click',e=>{
 const remove=e.target.closest('[data-remove-place]');
 if(remove){
  const done=app.removeCollectedPlace(remove.dataset.removePlace);
  app.toast(done?.ok?'장소를 삭제했어요.':done?.error||'장소 삭제에 실패했어요.');
  return;
 }
 const focus=e.target.closest('[data-focus-place]');
 if(focus){
  app.focusPlace(focus.dataset.focusPlace);
  $('map-region').scrollIntoView({behavior:'smooth',block:'center'});
 }
});
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

$('yg-adjust-list').addEventListener('change',e=>{
 const checkbox=e.target.closest('[data-adjust-select]');if(!checkbox)return;
 selectedAdjustId=checkbox.checked?checkbox.dataset.adjustSelect:null;
 renderAdjustment();
});
$('yg-adjust-list').addEventListener('click',e=>{
 const remove=e.target.closest('[data-adjust-remove]');if(!remove)return;
 const id=remove.dataset.adjustRemove;
 if(!day().stops.some(p=>p.id===id))return;
 if(selectedAdjustId===id)selectedAdjustId=null;
 if(app.removeStop(id)){renderDaily();app.toast('방문지를 삭제했어요. 다시 최적화해 주세요.');}
});
$('yg-adjust-edit-selected').addEventListener('click',openVisitPositionEditor);
$('yg-position-cancel').addEventListener('click',closeVisitPositionEditor);
$('yg-position-close').addEventListener('click',closeVisitPositionEditor);
$('yg-position-apply').addEventListener('click',applyVisitPosition);
$('yg-position-dialog').addEventListener('click',e=>{if(e.target.id==='yg-position-dialog')closeVisitPositionEditor();});

$('yg-sheet-map').addEventListener('click',()=>{closeSheet();openSearch();});

const sheetHeader=$('yg-place-sheet').querySelector('.yg-sheet-head');
sheetHeader.addEventListener('touchstart',e=>{dragStartY=e.touches[0]?.clientY||0;},{passive:true});
sheetHeader.addEventListener('touchend',e=>{if((e.changedTouches[0]?.clientY||0)-dragStartY>85)closeSheet();},{passive:true});
document.querySelectorAll('[data-yg-step]').forEach(btn=>btn.addEventListener('click',()=>go(Number(btn.dataset.ygStep))));
document.addEventListener('trip:endpoint-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:day-changed',()=>{closeEndpointChooser({restoreFocus:false});renderDaily();renderWarnings();});
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
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(!$('yg-endpoint-chooser').hidden){e.preventDefault();closeEndpointChooser();return;}
 if(!$('yg-position-dialog').hidden){closeVisitPositionEditor();return;}
 if(sheetOpen)closeSheet();
});
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
window.YeoNext={go,calculate,renderDaily,renderSheet,openSheet,expandPlaceList:()=>{inlineExpanded=true;renderDaily();},dateLabel:()=>dateText(day()?.date,{short:true}),searchRegion:()=>''};
init();
})();
