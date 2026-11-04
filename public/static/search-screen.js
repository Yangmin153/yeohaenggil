import {focusedStaticMapLayout} from './static-map-layout.js';
/** v5.3 Mobile-first full-screen Naver map search. Reuses the existing /api/places search and list DOM. */
const $=id=>document.getElementById(id);
const screen=$('search-screen'),form=$('quick-form'),results=$('quick-results'),input=$('quick-input'),original=$('mobile-bottom-actions');
const mapNode=$('search-naver-map'),mapStage=$('search-map-stage'),resultMount=$('search-screen-results-mount');
const feedback=$('search-screen-feedback'),picked=$('search-picked');
const centers={제주:[33.489,126.498],서울:[37.5665,126.978],부산:[35.1796,129.0756],강릉:[37.7519,128.8761],경주:[35.8562,129.2247],속초:[38.207,128.5918],여수:[34.7604,127.6622],전주:[35.8242,127.148],인천:[37.4563,126.7052],서귀포:[33.254,126.559]};
let opened=false,historyEntry=false,previousFocus=null,previousScroll=0,searchKind='stop',returnStep=2,searchDayId=null;
let mode='map',selected=null,items=[],searchMap=null,markers=[],selectedMarker=null,savedMarkers=[],savedSignature='',isSavedSelection=false,previewCamera=null,previewSource=null;
let feedbackTimer=null,transitionTimer=null,lastChosenRegion='',backgroundInert=[],staticSignature='',staticFocus=null,staticTimer=0,staticSerial=0,dynamicUnavailable=Boolean(window.__ygNaverAuthFailed),lastViewportSignature='',mapResizeFrame=0;
function lockBackground(){
 backgroundInert=[];
 for(const node of document.body.children){
  if(node===screen||node.id==='yg-place-sheet'||node.tagName==='SCRIPT'||node.tagName==='STYLE')continue;
  backgroundInert.push([node,node.inert]);node.inert=true;
 }
}
function unlockBackground(){
 for(const [node,prior] of backgroundInert)if(node.isConnected)node.inert=prior;
 backgroundInert=[];
}

function resizeSearchMap(){
 if(!searchMap||mapResizeFrame)return;
 mapResizeFrame=requestAnimationFrame(()=>{
  mapResizeFrame=0;
  if(!opened||mode!=='map'||!searchMap)return;
  window.naver?.maps?.Event?.trigger?.(searchMap,'resize');
 });
}
function updateSize(){
 const viewport=window.visualViewport;
 const height=Math.max(180,Math.round(viewport?.height||innerHeight));
 const top=Math.max(0,Math.round(viewport?.offsetTop||0));
 const keyboardOpen=Boolean(opened&&viewport&&innerHeight-(viewport.height+viewport.offsetTop)>120);
 const signature=[height,top,keyboardOpen].join('|');
 if(signature===lastViewportSignature)return;
 lastViewportSignature=signature;
 screen.style.setProperty('--search-height',height+'px');
 screen.style.setProperty('--search-top',top+'px');
 screen.dataset.keyboardOpen=String(keyboardOpen);
 if(opened&&mode==='map'){
  if(searchMap)resizeSearchMap();
  else queueStaticFallback(keyboardOpen?180:110);
 }
}
// A new traveler has no chosen destination yet. Never infer Jeju (or any other
// region) from the legacy default region or from the background map camera.
const KOREA_CENTER=[36.35,127.9],KOREA_ZOOM=7;
function chosenPlace(){
 const d=window.TripApp?.getDay?.();
 return [...(d?.stops||[]),d?.origin,d?.destination].find(p=>
  p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&!/미설정/.test(String(p.name||''))
 )||null;
}
function mapCenter(){
 const place=chosenPlace();
 if(place)return [Number(place.lat),Number(place.lng)];
 const region=window.YeoNext?.searchRegion?.()||'';
 if(centers[region])return centers[region];
 return KOREA_CENTER;
}
function mapStartZoom(){
 if(chosenPlace())return 12;
 const region=window.YeoNext?.searchRegion?.()||'';
 return centers[region]?11:KOREA_ZOOM;
}
function mapViewKey(){
 const d=window.TripApp?.getDay?.(),place=chosenPlace();
 return [d?.id||'',place?.id||'',place?.lat||'',place?.lng||'',window.YeoNext?.searchRegion?.()||''].join('|');
}
/** Dynamic Maps on a new Vercel Preview hostname may fail Naver's referer check.
 * The same-origin Static Map endpoint can still provide a genuine Naver map.
 * This fallback is view-only: map touches and marker touches NEVER add places.
 */
function hideStaticFallback(){
 clearTimeout(staticTimer);staticTimer=0;
 staticSerial++;staticSignature='';staticFocus=null;
 $('search-static-fallback').hidden=true;
 $('search-static-markers').replaceChildren();
 $('search-static-image').onload=null;
 $('search-static-image').onerror=null;
}
function queueStaticFallback(delay=0){
 clearTimeout(staticTimer);
 if(!opened||mode!=='map'||(searchMap&&!dynamicUnavailable))return;
 staticTimer=setTimeout(()=>{staticTimer=0;renderStaticFallback();},delay);
}
function renderStaticFallback(){
 if(!opened||mode!=='map'||(searchMap&&!dynamicUnavailable))return;
 const root=$('search-static-fallback'),pinLayer=$('search-static-markers'),image=$('search-static-image');
 const box=mapStage.getBoundingClientRect();
 const width=Math.min(1024,Math.round(box.width)),height=Math.min(1024,Math.round(box.height));
 // Avoid stretching a 240px keyboard-era image into a taller map.
 // A compact iPhone map can be shorter than 240px after Safari UI changes.
 // Render a real image at its actual dimensions instead of getting stuck in a
 // permanent "adjusting screen" state.
 if(width<320||height<120||width>1024||height>1024){
  root.hidden=true;
  $('search-map-message').hidden=false;
  $('search-map-message').textContent='지도를 불러오는 중이에요.';
  return;
 }
 const d=window.TripApp?.getDay?.();
 const target=selected||d?.stops?.at(-1)||
  (!/미설정/.test(String(d?.origin?.name||''))?d?.origin:null)||
  (!/미설정/.test(String(d?.destination?.name||''))?d?.destination:null);
 if(!target||!Number.isFinite(Number(target.lat))||!Number.isFinite(Number(target.lng))){
  root.hidden=true;
  $('search-map-message').hidden=false;
  $('search-map-message').textContent='검색 결과에서 장소를 선택하면 지도에 표시돼요.';
  return;
 }
 const focus={x:Number(target.lat),y:Number(target.lng)},saved=existingPlaces();
 const points=[{place:target,kind:'focused',label:''}];
 const seen=new Set([focus.x.toFixed(5)+':'+focus.y.toFixed(5)]);
 const stopIndex=d?.stops?.findIndex(p=>Math.abs(Number(p.lat)-focus.x)<.00003&&Math.abs(Number(p.lng)-focus.y)<.00003)??-1;
 points[0].label=stopIndex>=0?String(stopIndex+1):searchKind==='origin'?'출발':searchKind==='destination'?'도착':'●';
 for(const entry of saved){
  const place=entry.place,x=Number(place?.lat),y=Number(place?.lng);
  if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  const key=x.toFixed(5)+':'+y.toFixed(5);
  if(seen.has(key))continue;
  seen.add(key);
  const i=d?.stops?.findIndex(p=>p.id===place.id)??-1;
  points.push({place,kind:entry.kind,label:entry.kind==='origin'?'출발':entry.kind==='destination'?'도착':String(i+1)});
 }
 const coords=points.map(e=>({x:Number(e.place.lat),y:Number(e.place.lng)}));
 const layout=focusedStaticMapLayout(coords,focus,width,height,13);
 if(!layout){root.hidden=true;return;}
 const density=window.devicePixelRatio>=1.5?'2':'1';
 const signature=[width,height,density,focus.x.toFixed(6),focus.y.toFixed(6),...coords.map(p=>p.x.toFixed(6)+':'+p.y.toFixed(6))].join('|');
 if(signature===staticSignature)return;
 staticSignature=signature;staticFocus=focus;const request=++staticSerial;
 root.hidden=true;pinLayer.replaceChildren();
 $('search-map-message').hidden=false;
 $('search-map-message').textContent='선택한 장소의 지도를 불러오고 있어요.';
 points.forEach((entry,i)=>{
  const pt=layout.pixels[i];
  if(pt.x<0||pt.x>width||pt.y<0||pt.y>height)return;
  const marker=document.createElement('span');
  marker.className='search-static-pin'+(i===0?' is-focused':entry.kind==='origin'?' is-origin':entry.kind==='destination'?' is-destination':'');
  marker.textContent=entry.label;
  marker.style.left=(pt.x/width*100)+'%';marker.style.top=(pt.y/height*100)+'%';
  marker.title=entry.place.name||'방문지';
  pinLayer.append(marker);
 });
 // Only the focus affects the actual raster: other saved points use inert HTML pins.
 // This keeps a focused map cacheable even while the visit list changes.
 const query=new URLSearchParams({
  p:focus.x.toFixed(6)+','+focus.y.toFixed(6),
  f:focus.x.toFixed(6)+','+focus.y.toFixed(6),
  w:String(width),h:String(height),z:'13',s:density
 });
 const url='/api/static-map?'+query;
 const valid=()=>request===staticSerial&&staticSignature===signature&&opened&&mode==='map'&&!searchMap;
 image.onload=()=>{
  if(!valid())return;
  const now=mapStage.getBoundingClientRect();
  if(Math.abs(Math.min(1024,now.width)-width)>2||Math.abs(Math.min(1024,now.height)-height)>2){
   root.hidden=true;staticSignature='';queueStaticFallback(90);return;
  }
  root.hidden=false;$('search-map-message').hidden=true;
 };
 image.onerror=()=>{
  if(!valid())return;
  root.hidden=true;$('search-map-message').hidden=false;
  $('search-map-message').textContent='지도를 표시하지 못했어요. 검색 결과에서 장소를 계속 선택할 수 있어요.';
 };
 if(image.getAttribute('src')===url&&image.complete&&image.naturalWidth>0)image.onload();
 else image.src=url;
}
function maybeMap(){
 if(!opened)return;
 if(searchMap&&!dynamicUnavailable)return false;
 const maps=dynamicUnavailable?null:window.naver?.maps;
 if(!maps?.Map||!mapNode?.clientWidth||mapNode.clientHeight<80){
  if(screen.dataset.keyboardOpen==='true')queueStaticFallback(160);
  else renderStaticFallback();
  return;
 }
 try{
  // If an added place is waiting for its map preview, initialize at that exact
  // coordinate rather than the first previously saved visit.
  const c=selected&&Number.isFinite(Number(selected.lat))&&Number.isFinite(Number(selected.lng))
   ?[Number(selected.lat),Number(selected.lng)]:mapCenter();
  searchMap=new maps.Map(mapNode,{center:new maps.LatLng(c[0],c[1]),zoom:selected?13:mapStartZoom(),minZoom:6,maxZoom:20,zoomControl:false,mapDataControl:false,scaleControl:false,logoControl:true});
  hideStaticFallback();
  $('search-map-message').hidden=true;
  // Map is for browsing only: selecting arbitrary coordinates is disabled.
  // Places and endpoints are selected from verified search results.
  savedSignature='';paintMarkers();return true;
 }catch(e){console.warn('장소 검색 지도 초기화 실패',e);dynamicUnavailable=true;searchMap=null;queueStaticFallback();}
}
function clearMarkers(){
 for(const m of markers)try{m.setMap(null);}catch(error){console.warn('검색 마커 정리 중 오류',error?.message||error);}
 markers=[];
 if(selectedMarker){try{selectedMarker.setMap(null);}catch(error){console.warn('선택 마커 정리 중 오류',error?.message||error);}selectedMarker=null;}
}
function clearSavedMarkers(){for(const marker of savedMarkers)try{marker.setMap(null);}catch(error){console.warn('저장된 장소 마커 정리 중 오류',error?.message||error);}savedMarkers=[];}
function savedPlaces(){return window.TripApp?.getDay?.()?.stops||[];}
function updateSavedButton(){
 const d=window.TripApp?.getDay?.(),items=[...(d?.stops||[]),d?.origin,d?.destination].filter(window.YGPlaceRoles?.configured||(()=>false));
 const unique=[];
 for(const p of items)if(!unique.some(q=>window.YGPlaceRoles?.same?.(p,q)))unique.push(p);
 const n=unique.length,button=$('search-screen-count');
 button.textContent='담은 장소 '+n+'곳';
 button.setAttribute('aria-label','담은 장소 '+n+'곳과 출발·도착 설정 보기');
}
function existingPlaces(){
 const d=window.TripApp?.getDay?.();if(!d)return [];
 return [...savedPlaces().map(place=>({place,kind:'pending'})),
  ...(['origin','destination'].filter(kind=>d[kind]&&Number.isFinite(d[kind].lat)&&Number.isFinite(d[kind].lng)&&!/미설정/.test(d[kind].name||'')).map(kind=>({place:d[kind],kind})))];
}
function endpointMode(){return searchKind==='origin'||searchKind==='destination';}
function actionText(){return searchKind==='origin'?'출발지로 설정':searchKind==='destination'?'도착지로 설정':'이 장소 담기';}
function showSaved(place){
 rememberCamera();selected=place;previewSource='saved';isSavedSelection=true;
 $('search-picked-cancel').textContent='닫기';
 $('search-picked-name').textContent=place.name;
 $('search-picked-address').textContent=(place.address||'')+' · 이미 담은 장소';
 $('search-picked-add').textContent=endpointMode()?actionText():'이미 추가됨';
 $('search-picked-add').disabled=!endpointMode();
 picked.hidden=false;showMode('map');
}
/**
 * Deterministically rebuild persisted place pins from the active day's data.
 * Never rely on the cached signature: Naver map lifecycle and hiding/showing
 * the search screen can detach marker overlays without changing place data.
 */
function refreshSavedMarkers(){
 clearSavedMarkers();
 if(!searchMap||!window.naver?.maps?.Marker)return;
 const grouped=new Map();
 for(const entry of existingPlaces()){
  const {place}=entry;
  if(!Number.isFinite(Number(place.lat))||!Number.isFinite(Number(place.lng)))continue;
  const key=Number(place.lat).toFixed(5)+':'+Number(place.lng).toFixed(5);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(entry);
 }
 for(const group of grouped.values()){
  const {place,kind}=group[0],count=group.length;
  // A search selection uses the higher-priority highlighted pin at this location.
  if(selected&&Number(selected.lat).toFixed(5)===Number(place.lat).toFixed(5)&&Number(selected.lng).toFixed(5)===Number(place.lng).toFixed(5))continue;
  const pin=window.YeoPins?.marker?.(searchMap,place,{kind:count>1?'cluster':kind,count,zIndex:600});
  if(!pin)continue;
  // Saved marker is view-only inside the search screen. Search results
  // are the sole source of new places and endpoint selection.
  savedMarkers.push(pin);
 }
}
function mark(item,pickedOne=false){
 return window.YeoPins?.marker?.(searchMap,item,{kind:pickedOne?'selected':'pending',selected:pickedOne,zIndex:pickedOne?800:100})||null;
}
function paintMarkers(){
 clearMarkers();
 if(!searchMap){
  if(screen.dataset.keyboardOpen==='true')queueStaticFallback(160);
  else renderStaticFallback();
  return;
 }
 if(selected){
  // Retain saved visits/endpoints; hide only unselected SEARCH result candidates.
  refreshSavedMarkers();selectedMarker=mark(selected,true);
  return;
 }
 // Search result candidates never become map markers: only persisted stops and the chosen focus are shown.
 refreshSavedMarkers();
}
function showMode(next){
 const previous=mode;
 mode=next==='list'?'list':'map';
 if(mode==='list')hideStaticFallback();
 mapStage.hidden=mode!=='map';
 resultMount.hidden=mode!=='list';
 $('search-list-toggle').textContent=mode==='list'?'지도':'목록';
 $('search-list-toggle').setAttribute('aria-label',mode==='list'?'지도 보기':'검색 결과 목록 보기');
 $('search-list-toggle').hidden=!items.length&&!selected;
 $('search-list-toggle').setAttribute('aria-pressed',String(mode==='list'));
 screen.dataset.searchMode=mode;
 if(mode!=='map')return;
 // One visible map and one marker pass. Do not instantiate a second SDK map
 // during the iPhone keyboard's blur / visualViewport resize animation.
 requestAnimationFrame(()=>{
  if(!opened||mode!=='map')return;
  updateSize();
  const created=maybeMap();
  if(searchMap){
   resizeSearchMap();
   if(!created&&selected)paintMarkers();
   else if(!created&&previous==='list')paintMarkers();
   if(selected&&window.naver?.maps?.LatLng)
    searchMap.panTo(new window.naver.maps.LatLng(Number(selected.lat),Number(selected.lng)));
  }
 });
}
function searchStarted(){if(!opened)return;showMode('list');}
function onResults(next){
 items=Array.isArray(next)?next:[];
 if(opened&&mode==='map'&&selected)paintMarkers();
 if(opened&&input.value.trim().length>=2&&!selected)showMode('list');
}
function rememberCamera(){
 if(previewCamera||!searchMap)return;
 const center=searchMap.getCenter?.();
 if(center)previewCamera={center,zoom:searchMap.getZoom?.()};
}
function clearPreview({restoreCamera=true}={}){
 const hadSelection=Boolean(selected);
 selected=null;previewSource=null;isSavedSelection=false;
 picked.hidden=true;
 $('search-picked-add').disabled=false;
 $('search-picked-cancel').textContent='취소';
 if(hadSelection&&restoreCamera&&previewCamera&&searchMap){
  searchMap.setCenter(previewCamera.center);
  if(Number.isFinite(previewCamera.zoom))searchMap.setZoom(previewCamera.zoom);
 }
 previewCamera=null;
 if(opened)paintMarkers();
}
function preview(item,source='result'){
 if(!item)return;
 rememberCamera();
 selected=item;previewSource=source;isSavedSelection=false;
 $('search-picked-cancel').textContent='취소';
 $('search-picked-add').disabled=false;$('search-picked-add').textContent=actionText();
 $('search-picked-name').textContent=String(item.name||'선택한 위치');
 $('search-picked-address').textContent=String(item.address||'지도에서 선택한 장소');
 input.blur();
 picked.hidden=false;
 showMode('map');
}
function focusAdded(item){
 if(!item||!opened||searchKind!=='stop')return;
 // The stop is already saved by TripApp.addQuickStop. This is a *view-only*
 // focus, not another add operation or a coordinate-picking interaction.
 rememberCamera();
 selected=item;previewSource='added';isSavedSelection=true;
 $('search-picked-name').textContent=String(item.name||'추가한 장소');
 $('search-picked-address').textContent=String(item.address||'')+' · 담은 장소';
 $('search-picked-add').disabled=true;$('search-picked-add').textContent='담았어요';
 $('search-picked-cancel').textContent='닫기';
 picked.hidden=false;input.blur();showMode('map');
 input.blur();
}

function show(kind='stop',options={}){
 if(opened)return;
 searchKind=['origin','destination'].includes(kind)?kind:'stop';
 returnStep=Number(document.body.dataset.tripStep)===3?3:2;
 searchDayId=window.TripApp?.getDay?.()?.id||null;
 $('search-list-toggle').hidden=true;
 $('search-global-results').hidden=true;
  $('search-scope-note').textContent=searchKind==='origin'
   ?'↗ 오늘 여행을 시작할 장소를 검색 결과에서 선택해 주세요.'
   :searchKind==='destination'
    ?'⌖ 하루를 마칠 도착지를 검색 결과에서 선택해 주세요.'
    :'장소 이름이나 주소를 검색해 결과에서 추가해 주세요. 지도는 위치 확인용이에요.';
 screen.dataset.searchKind=searchKind;
 input.placeholder=searchKind==='origin'?'오늘의 출발지를 검색하세요':searchKind==='destination'?'마지막 도착지를 검색하세요':'가고 싶은 장소명이나 주소 검색';
 input.setAttribute('aria-label',searchKind==='origin'?'출발지 장소 검색':searchKind==='destination'?'도착지 장소 검색':'방문지 장소 검색');
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;
 opened=true;historyEntry=true;previousFocus=document.activeElement;previousScroll=window.scrollY;
 feedback.hidden=true;clearPreview({restoreCamera:false});items=[];input.value='';results.replaceChildren();results.hidden=true;
 $('search-screen-region').textContent=(window.YeoNext?.dateLabel?.()||'오늘')+' · '+(searchKind==='origin'?'↗ 출발지 선택':searchKind==='destination'?'⌖ 도착지 선택':'방문지 추가');
 $('search-stage-icon').textContent=searchKind==='origin'?'↗':searchKind==='destination'?'⌖':'⌕';
 $('search-stage-label').textContent=searchKind==='origin'?'출발지 검색':searchKind==='destination'?'도착지 검색':'방문지 검색';
 $('search-stage-help').textContent=searchKind==='origin'
  ?'어디서 출발하시나요?'
  :searchKind==='destination'?'마지막 도착지는 어디인가요?':'장소를 담거나 바로 출발·도착으로 지정할 수 있어요.';
 updateSavedButton();
 screen.hidden=false;screen.querySelector('#search-screen-form-mount').append(form);resultMount.append(results);
 window.YGScrollLock?.lock('search-screen');document.body.classList.add('search-open');lockBackground();
 showMode('list');updateSize();
 const viewKey=mapViewKey();
 if(searchMap&&lastChosenRegion!==viewKey){
  const [lat,lng]=mapCenter();
  searchMap.setCenter(new window.naver.maps.LatLng(lat,lng));
  searchMap.setZoom(mapStartZoom());paintMarkers();
 }
 lastChosenRegion=viewKey;
 history.pushState({...history.state,yeohaenggilSearch:true},'',location.href);
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
 if(options.transitionMessage)showTransition(options.transitionMessage);
}
function hide(fromPopstate=false){
 if(!opened)return;
 clearPreview({restoreCamera:false});
 opened=false;items=[];searchKind='stop';clearMarkers();clearSavedMarkers();hideStaticFallback();savedSignature='';input.blur();
 original.insertBefore(results,original.firstChild);original.insertBefore(form,$('quick-feedback'));
 screen.hidden=true;mapStage.hidden=false;resultMount.hidden=true;results.hidden=true;
 document.body.classList.remove('search-open');unlockBackground();window.YGScrollLock?.unlock('search-screen');
 clearTimeout(feedbackTimer);clearTimeout(transitionTimer);feedback.hidden=true;picked.hidden=true;$('search-transition-toast').hidden=true;
 if(!fromPopstate&&historyEntry&&history.state?.yeohaenggilSearch)history.back();
 historyEntry=false;
 // Search is a standalone overlay. Never navigate the itinerary just to close it.
 if(returnStep===3&&document.body.dataset.tripStep!=='3')window.YeoNext?.go?.(3);
 searchDayId=null;
 (previousFocus?.isConnected?previousFocus:$('btn-add-place'))?.focus?.({preventScroll:true});
}
function notify(message){
 if(!opened)return;
 feedback.textContent=message;feedback.hidden=false;
 clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.hidden=true,2100);
}
function addSuccess(message,place=null){
 if(!opened)return;
 if(!place){notify(message);return;}
 // The inline '추가' action must stay in the search overlay. Focus only the
 // persisted result and let the existing map move to that coordinate once.
 selected=place;previewSource='added';isSavedSelection=true;previewCamera=null;
 picked.hidden=true;input.blur();
 updateSavedButton();
 showMode('map');
 notify(message);
}
function showTransition(message){
 const notice=$('search-transition-toast');
 clearTimeout(transitionTimer);
 notice.textContent=message;
 notice.hidden=false;
 transitionTimer=setTimeout(()=>{notice.hidden=true;},2300);
}
function completeEndpoint(item){
 const kind=searchKind;
 if(!endpointMode())return false;
 if(!window.TripApp?.setEndpointFromSearch?.(kind,item))return false;
 const placeId=window.TripApp?.getDay?.()?.[kind]?.id;
 hide();
 window.TripApp?.toast?.(kind==='origin'?'출발지를 설정했어요.':'도착지를 설정했어요.');
 if(placeId)requestAnimationFrame(()=>window.TripApp?.focusPlace?.(placeId));
 return true;
}
let addingSelection=false;
function chooseAdd(){
 if(addingSelection||!opened||mode!=='map'||!selected||(!endpointMode()&&isSavedSelection))return false;
 const chosen=selected,button=$('search-picked-add');
 addingSelection=true;button.disabled=true;
 try{
  const ok=endpointMode()?completeEndpoint(chosen):window.TripQuickAdd?.addPlace?.(chosen);
  // The quick-add helper already gives the real failure message (including
  // duplicate, missing region or a full day). Do not mislabel every failure.
  if(ok!==true&&opened&&selected===chosen)button.disabled=false;
  return ok===true;
 }catch(error){
  if(opened&&selected===chosen){
   button.disabled=false;
   notify('장소를 담는 중 문제가 생겼어요. 다시 시도해 주세요.');
  }
  console.warn('장소 담기 동작 실패',error);
  return false;
 }finally{addingSelection=false;}
}
$('search-screen-back').addEventListener('click',()=>hide());
$('search-list-toggle').addEventListener('click',()=>showMode(mode==='list'?'map':'list'));
$('search-picked-add').addEventListener('click',chooseAdd);
$('search-picked-cancel').addEventListener('click',()=>clearPreview());
// The saved-place list can be opened without changing the current step.
input.addEventListener('input',()=>{if(opened)clearPreview({restoreCamera:false});});
input.addEventListener('focus',()=>{if(opened)requestAnimationFrame(updateSize);});
input.addEventListener('blur',()=>{if(opened)requestAnimationFrame(updateSize);});
input.addEventListener('focus',()=>{if(!opened&&matchMedia('(max-width:768px)').matches)show()});
input.addEventListener('pointerdown',e=>{if(!opened&&matchMedia('(max-width:768px)').matches){e.preventDefault();show();}});
window.addEventListener('popstate',()=>{if(opened)hide(true)});
window.addEventListener('touchmove',e=>{
 if(!opened||e.target.closest?.('#search-screen, #yg-place-sheet'))return;
 if(e.cancelable)e.preventDefault();
},{passive:false,capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();hide();}});
window.visualViewport?.addEventListener('resize',updateSize);
window.visualViewport?.addEventListener('scroll',updateSize);
window.addEventListener('resize',updateSize);
document.addEventListener('trip-maps-auth-failed',()=>{
 dynamicUnavailable=true;
 clearMarkers();clearSavedMarkers();
 try{searchMap?.destroy?.();}catch{}
 searchMap=null;mapNode.replaceChildren();staticSignature='';
 if(opened&&mode==='map')queueStaticFallback(0);
});
if(typeof ResizeObserver==='function'){
 let lastBox='';
 new ResizeObserver(()=>{
  if(!opened||mode!=='map')return;
  const next=[Math.round(mapStage.clientWidth),Math.round(mapStage.clientHeight)].join('x');
  if(next===lastBox)return;lastBox=next;
  if(searchMap){requestAnimationFrame(()=>window.naver?.maps?.Event?.trigger?.(searchMap,'resize'));return;}
  $('search-static-fallback').hidden=true;
  queueStaticFallback(120);
 }).observe(mapStage);
}
document.addEventListener('trip-map-ready',()=>{if(opened)maybeMap()});
document.addEventListener('trip-maps-sdk-ready',()=>{if(opened&&mode==='map')maybeMap()});
document.addEventListener('trip:endpoint-changed',()=>{if(opened)paintMarkers();});
document.addEventListener('trip:stops-changed',()=>{if(opened){paintMarkers();updateSavedButton();}});
document.addEventListener('trip:day-changed',()=>{if(opened){clearPreview({restoreCamera:false});paintMarkers();updateSavedButton();}});
window.addEventListener('resize',()=>{if(opened&&mode==='map')paintMarkers();});
$('search-screen-count').addEventListener('click',()=>{hide();window.YeoNext?.expandPlaceList?.();});
window.YeoSearch={show,hide,isOpen:()=>opened,returnStep:()=>returnStep,mode:()=>searchKind,isEndpointMode:endpointMode,completeEndpoint,preview,clearPreview,focusAdded,showSavedPlace:showSaved,searchStarted,onResults,notify,addSuccess,refreshSavedMarkers,
 getMapDiagnostics:()=>({
  viewMode:mode,stage:searchKind,selectedName:selected?.name||null,
  saved: savedMarkers.length,candidates:markers.length,focused:!!selectedMarker,
  center:searchMap?.getCenter?.()?{lat:searchMap.getCenter().lat(),lng:searchMap.getCenter().lng()}:staticFocus?{lat:staticFocus.x,lng:staticFocus.y}:null,
  source:searchMap?'dynamic':!$('search-static-fallback').hidden?'static':'none',
  ...(searchMap?{}:{
   saved:[...$('search-static-markers').children].filter(p=>!p.classList.contains('is-focused')).length,
   focused:!$('search-static-fallback').hidden&&!!document.querySelector('#search-static-markers .is-focused')
  })
 })
};
