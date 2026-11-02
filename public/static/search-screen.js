/** v5.3 Mobile-first full-screen Naver map search. Reuses the existing /api/places search and list DOM. */
const $=id=>document.getElementById(id);
const screen=$('search-screen'),form=$('quick-form'),results=$('quick-results'),input=$('quick-input'),original=$('mobile-bottom-actions');
const mapNode=$('search-naver-map'),mapStage=$('search-map-stage'),resultMount=$('search-screen-results-mount');
const feedback=$('search-screen-feedback'),picked=$('search-picked');
const centers={제주:[33.489,126.498],서울:[37.5665,126.978],부산:[35.1796,129.0756],강릉:[37.7519,128.8761],경주:[35.8562,129.2247],속초:[38.207,128.5918],여수:[34.7604,127.6622],전주:[35.8242,127.148],인천:[37.4563,126.7052],서귀포:[33.254,126.559]};
let opened=false,historyEntry=false,previousFocus=null,previousScroll=0,searchKind='stop',returnStep=2,searchDayId=null;
let mode='map',selected=null,items=[],searchMap=null,markers=[],selectedMarker=null,savedMarkers=[],savedSignature='',isSavedSelection=false,previewCamera=null,previewSource=null;
let feedbackTimer=null, lastChosenRegion='',backgroundInert=[];
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

function updateSize(){
 const viewport=window.visualViewport;
 const height=Math.max(240,Math.round(viewport?.height||innerHeight));
 const top=Math.round(viewport?.offsetTop||0);
 screen.style.setProperty('--search-height',height+'px');
 screen.style.setProperty('--search-top',top+'px');
 const keyboardOpen=Boolean(opened&&viewport&&innerHeight-(viewport.height+viewport.offsetTop)>120);
 screen.dataset.keyboardOpen=String(keyboardOpen);
 if(searchMap&&opened&&mode==='map')requestAnimationFrame(()=>window.naver?.maps?.Event?.trigger(searchMap,'resize'));
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
function maybeMap(){
 if(!opened)return;
 if(searchMap){updateSize();paintMarkers();return;}
 const maps=window.naver?.maps;
 if(!maps?.Map||!mapNode?.clientWidth||mapNode.clientHeight<80){
  $('search-map-message').textContent='지도를 불러올 수 없다면 목록에서 장소를 선택할 수 있어요.';
  return;
 }
 try{
  const c=mapCenter();
  searchMap=new maps.Map(mapNode,{center:new maps.LatLng(c[0],c[1]),zoom:mapStartZoom(),minZoom:6,maxZoom:20,zoomControl:false,mapDataControl:false,scaleControl:false,logoControl:true});
  $('search-map-message').hidden=true;
  maps.Event.addListener(searchMap,'click',e=>{
   const latitude=e.coord.lat(),longitude=e.coord.lng();
   preview({id:'manual-'+latitude.toFixed(6)+'-'+longitude.toFixed(6),name:'지도에서 선택한 위치',address:'지도에서 선택한 위치',lat:latitude,lng:longitude,category:'장소'},'map');
  });
  savedSignature='';paintMarkers();
 }catch(e){console.warn('장소 검색 지도 초기화 실패',e);$('search-map-message').hidden=false;$('search-map-message').textContent='지도를 열지 못했어요. 목록 검색은 사용할 수 있어요.';}
}
function clearMarkers(){
 for(const m of markers)m.setMap(null);
 markers=[];
 if(selectedMarker){selectedMarker.setMap(null);selectedMarker=null;}
}
function clearSavedMarkers(){for(const marker of savedMarkers)marker.setMap(null);savedMarkers=[];}
function savedPlaces(){return window.TripApp?.getDay?.()?.stops||[];}
function updateSavedButton(){const n=savedPlaces().length;const button=$('search-screen-count');button.textContent='담은 장소 보기';button.setAttribute('aria-label','담은 장소 '+n+'곳 보기');}
function existingPlaces(){
 const d=window.TripApp?.getDay?.();if(!d)return [];
 return [...savedPlaces().map(place=>({place,kind:'pending'})),
  ...(['origin','destination'].filter(kind=>d[kind]&&Number.isFinite(d[kind].lat)&&Number.isFinite(d[kind].lng)&&!/미설정/.test(d[kind].name||'')).map(kind=>({place:d[kind],kind})))];
}
function endpointMode(){return searchKind==='origin'||searchKind==='destination';}
function actionText(){return searchKind==='origin'?'출발지로 설정':searchKind==='destination'?'도착지로 설정':'+ 방문지 추가';}
function showSaved(place){
 rememberCamera();selected=place;previewSource='saved';isSavedSelection=true;
 $('search-picked-cancel').textContent='닫기';
 $('search-picked-name').textContent=place.name;
 $('search-picked-address').textContent=(place.address||'')+' · 이미 담은 장소';
 $('search-picked-add').textContent=endpointMode()?actionText():'이미 추가됨';
 $('search-picked-add').disabled=!endpointMode();
 picked.hidden=false;showMode('map');paintMarkers();
 if(searchMap)searchMap.panTo(new window.naver.maps.LatLng(place.lat,place.lng));
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
  if(selected&&count===1&&Number(selected.lat)===Number(place.lat)&&Number(selected.lng)===Number(place.lng))continue;
  const pin=window.YeoPins?.marker?.(searchMap,place,{kind:count>1?'cluster':kind,count,zIndex:600});
  if(!pin)continue;
  window.naver.maps.Event.addListener(pin,'click',()=>{
   if(count>1)window.YeoNext?.openSheet?.();
   else showSaved(place);
  });
  savedMarkers.push(pin);
 }
}
function mark(item,pickedOne=false){
 return window.YeoPins?.marker?.(searchMap,item,{kind:pickedOne?'selected':'pending',selected:pickedOne,zIndex:pickedOne?800:100})||null;
}
function paintMarkers(){
 clearMarkers();
 if(!searchMap)return;
 if(selected){
  // Retain saved visits/endpoints; hide only unselected SEARCH result candidates.
  refreshSavedMarkers();selectedMarker=mark(selected,true);
  return;
 }
 // While browsing without a selected preview, all collected places stay visible.
 for(const item of items.slice(0,15)){
  const m=mark(item);
  if(!m)continue;
  markers.push(m);
  window.naver.maps.Event.addListener(m,'click',()=>preview(item));
 }
 refreshSavedMarkers();
}
function showMode(next){
 mode=next==='list'?'list':'map';
 mapStage.hidden=mode!=='map';
 resultMount.hidden=mode!=='list';
 $('search-list-toggle').textContent=mode==='list'?'지도 보기':'검색 결과 보기';
 $('search-list-toggle').hidden=!items.length&&!selected;
 $('search-list-toggle').setAttribute('aria-pressed',String(mode==='list'));
 screen.dataset.searchMode=mode;
 if(mode==='map'){requestAnimationFrame(()=>{maybeMap();updateSize();paintMarkers();});}
}
function searchStarted(){if(!opened)return;showMode('list');}
function onResults(next){
 items=Array.isArray(next)?next:[];
 paintMarkers();
 if(opened&&input.value.trim().length>=2)showMode('list');
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
 picked.hidden=false;
 showMode('map');
 if(!searchMap)maybeMap();
 paintMarkers();
 if(searchMap)searchMap.panTo(new window.naver.maps.LatLng(Number(item.lat),Number(item.lng)));
 input.blur();
}
function focusAdded(item){
 if(!item||!opened)return;
 rememberCamera();
 selected=item;previewSource='added';isSavedSelection=true;
 $('search-picked-name').textContent=String(item.name||'추가한 장소');
 $('search-picked-address').textContent=String(item.address||'')+' · 담은 장소';
 $('search-picked-add').disabled=true;$('search-picked-add').textContent='담았어요';
 $('search-picked-cancel').textContent='닫기';
 picked.hidden=false;showMode('map');paintMarkers();
 if(searchMap)searchMap.panTo(new window.naver.maps.LatLng(Number(item.lat),Number(item.lng)));
 input.blur();
}

function show(kind='stop'){
 if(opened)return;
 searchKind=['origin','destination'].includes(kind)?kind:'stop';
 returnStep=Number(document.body.dataset.tripStep)===3?3:2;
 searchDayId=window.TripApp?.getDay?.()?.id||null;
 $('search-list-toggle').hidden=true;
  $('search-global-results').hidden=true;
  $('search-scope-note').textContent='전국에서 검색하고, 방문지 주변 결과를 우선 보여줘요. 다른 지역도 검색할 수 있어요.';
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;
 opened=true;historyEntry=true;previousFocus=document.activeElement;previousScroll=window.scrollY;
 feedback.hidden=true;clearPreview({restoreCamera:false});items=[];input.value='';results.replaceChildren();results.hidden=true;
 $('search-screen-region').textContent=(window.YeoNext?.dateLabel?.()||'오늘')+' · '+(searchKind==='origin'?'출발지 검색':searchKind==='destination'?'도착지 검색':'방문지 추가');
 updateSavedButton();
 screen.hidden=false;screen.querySelector('#search-screen-form-mount').append(form);resultMount.append(results);
 window.YGScrollLock?.lock('search-screen');document.body.classList.add('search-open');lockBackground();
 updateSize();showMode('map');
 const viewKey=mapViewKey();
 if(searchMap&&lastChosenRegion!==viewKey){
  const [lat,lng]=mapCenter();
  searchMap.setCenter(new window.naver.maps.LatLng(lat,lng));
  searchMap.setZoom(mapStartZoom());paintMarkers();
 }
 lastChosenRegion=viewKey;
 history.pushState({...history.state,yeohaenggilSearch:true},'',location.href);
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function hide(fromPopstate=false){
 if(!opened)return;
 clearPreview({restoreCamera:false});
 opened=false;items=[];searchKind='stop';clearMarkers();clearSavedMarkers();savedSignature='';input.blur();
 original.insertBefore(results,original.firstChild);original.insertBefore(form,$('quick-feedback'));
 screen.hidden=true;mapStage.hidden=false;resultMount.hidden=true;results.hidden=true;
 document.body.classList.remove('search-open');unlockBackground();window.YGScrollLock?.unlock('search-screen');
 clearTimeout(feedbackTimer);feedback.hidden=true;picked.hidden=true;
 if(!fromPopstate&&historyEntry&&history.state?.yeohaenggilSearch)history.back();
 historyEntry=false;
 // Search is a standalone overlay. Never navigate the itinerary just to close it.
 if(returnStep===3&&document.body.dataset.tripStep!=='3')window.YeoNext?.go?.(3);
 searchDayId=null;
 (previousFocus?.isConnected?previousFocus:$('btn-add-place'))?.focus?.({preventScroll:true});
}
function addSuccess(message,place=null){
 if(!opened)return;
 items=[];clearMarkers();
 updateSavedButton();
 feedback.textContent=message;feedback.hidden=false;
 clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.hidden=true,2100);
 if(place)focusAdded(place);
 else{clearPreview({restoreCamera:false});showMode('map');refreshSavedMarkers();}
}
function completeEndpoint(item){
 const kind=searchKind;
 if(!endpointMode())return false;
 if(!window.TripApp?.setEndpointFromSearch?.(kind,item))return false;
 hide();window.TripApp?.toast?.((kind==='origin'?'출발지':'도착지')+'를 설정했어요.');
 return true;
}
function chooseAdd(){
 if(!selected||(!endpointMode()&&isSavedSelection))return;
 const ok=endpointMode()?completeEndpoint(selected):window.TripQuickAdd?.addPlace?.(selected);
 if(ok===false){$('search-picked-add').textContent='이미 추가한 장소';setTimeout(()=>$('search-picked-add').textContent='+ 방문지 추가',1200);}
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
document.addEventListener('trip-map-ready',()=>{if(opened)maybeMap()});
document.addEventListener('trip:endpoint-changed',()=>{if(opened)paintMarkers();});
document.addEventListener('trip:stops-changed',()=>{if(opened){paintMarkers();updateSavedButton();}});
document.addEventListener('trip:day-changed',()=>{if(opened){clearPreview({restoreCamera:false});paintMarkers();updateSavedButton();}});
window.addEventListener('resize',()=>{if(opened&&mode==='map')paintMarkers();});
$('search-screen-count').addEventListener('click',()=>window.YeoNext?.openSheet?.());
window.YeoSearch={show,hide,isOpen:()=>opened,returnStep:()=>returnStep,mode:()=>searchKind,isEndpointMode:endpointMode,completeEndpoint,preview,clearPreview,focusAdded,showSavedPlace:showSaved,searchStarted,onResults,addSuccess,refreshSavedMarkers};
