/** v5.3 Mobile-first full-screen Naver map search. Reuses the existing /api/places search and list DOM. */
const $=id=>document.getElementById(id);
const screen=$('search-screen'),form=$('quick-form'),results=$('quick-results'),input=$('quick-input'),original=$('mobile-bottom-actions');
const mapNode=$('search-naver-map'),mapStage=$('search-map-stage'),resultMount=$('search-screen-results-mount');
const feedback=$('search-screen-feedback'),picked=$('search-picked');
const centers={제주:[33.489,126.498],서울:[37.5665,126.978],부산:[35.1796,129.0756],강릉:[37.7519,128.8761],경주:[35.8562,129.2247],속초:[38.207,128.5918],여수:[34.7604,127.6622],전주:[35.8242,127.148],인천:[37.4563,126.7052],서귀포:[33.254,126.559]};
let opened=false,historyEntry=false,previousFocus=null,previousScroll=0;
let mode='map',selected=null,items=[],searchMap=null,markers=[],selectedMarker=null,savedMarkers=[],savedSignature='',isSavedSelection=false;
let feedbackTimer=null, lastChosenRegion='';
function updateSize(){
 const viewport=window.visualViewport;
 screen.style.setProperty('--search-height',Math.round(viewport?.height||innerHeight)+'px');
 screen.style.setProperty('--search-top',Math.round(viewport?.offsetTop||0)+'px');
 if(searchMap&&opened&&mode==='map')requestAnimationFrame(()=>window.naver?.maps?.Event?.trigger(searchMap,'resize'));
}
function mapCenter(){
 const d=window.TripApp?.getDay?.();
 const place=[d?.origin,...(d?.stops||[]),d?.destination].find(p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&!/미설정/.test(p.name||''));
 if(place)return [place.lat,place.lng];
 const region=window.YeoNext?.searchRegion?.()||'';
 if(centers[region])return centers[region];
 const naverMap=window.TripApp?.getMap?.();
 const c=naverMap?.getCenter?.();
 return c?[c.lat(),c.lng()]:[36.35,127.9];
}
function maybeMap(){
 if(!opened)return;
 if(searchMap){updateSize();return;}
 const maps=window.naver?.maps;
 if(!maps?.Map||!mapNode?.clientWidth||mapNode.clientHeight<80){
  $('search-map-message').textContent='지도를 불러올 수 없다면 목록에서 장소를 선택할 수 있어요.';
  return;
 }
 try{
  const c=mapCenter();
  searchMap=new maps.Map(mapNode,{center:new maps.LatLng(c[0],c[1]),zoom:11,minZoom:6,maxZoom:20,zoomControl:false,mapDataControl:false,scaleControl:false,logoControl:true});
  $('search-map-message').hidden=true;
  maps.Event.addListener(searchMap,'click',e=>{
   const latitude=e.coord.lat(),longitude=e.coord.lng();
   preview({id:'manual-'+latitude.toFixed(6)+'-'+longitude.toFixed(6),name:'지도에서 선택한 위치',address:latitude.toFixed(5)+', '+longitude.toFixed(5),lat:latitude,lng:longitude,category:'장소'});
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
function savedPlaces(){return window.TripApp?.allStops?.()||[];}
function showSaved(place){
 selected=place;isSavedSelection=true;
 $('search-picked-name').textContent=place.name;
 $('search-picked-address').textContent=(place.address||'')+' · 이미 담은 장소';
 $('search-picked-add').textContent='이미 추가됨';
 $('search-picked-add').disabled=true;
 picked.hidden=false;showMode('map');
 if(searchMap)searchMap.panTo(new window.naver.maps.LatLng(place.lat,place.lng));
}
function refreshSavedMarkers(){
 const current=window.TripApp?.getDay?.();
 const signature=String(current?.id||'')+'|'+savedPlaces().map(p=>[p.id,p.lat,p.lng,p.name].join(':')).join('|');
 if(signature===savedSignature)return;
 savedSignature=signature;clearSavedMarkers();
 if(!searchMap||!window.naver?.maps?.Marker)return;
 const grouped=new Map();
 for(const place of savedPlaces()){
  const key=Number(place.lat).toFixed(4)+':'+Number(place.lng).toFixed(4);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(place);
 }
 for(const group of grouped.values()){
  const place=group[0],count=group.length;
  const pin=window.YeoPins?.marker?.(searchMap,place,{kind:count>1?'cluster':'pending',count,zIndex:600});
  if(!pin)continue;
  window.naver.maps.Event.addListener(pin,'click',()=>{if(count>1)window.YeoNext?.openSheet?.();else showSaved(place);});
  savedMarkers.push(pin);
 }
}
function mark(item,pickedOne=false){
 return window.YeoPins?.marker?.(searchMap,item,{kind:pickedOne?'selected':'pending',selected:pickedOne,zIndex:pickedOne?800:100})||null;
}
function paintMarkers(){
 clearMarkers();
 if(!searchMap)return;
 for(const item of items.slice(0,15)){
  const m=mark(item);
  if(!m)continue;
  markers.push(m);
  window.naver.maps.Event.addListener(m,'click',()=>preview(item));
 }
 if(selected&&!isSavedSelection)selectedMarker=mark(selected,true);
 refreshSavedMarkers();
}
function showMode(next){
 mode=next==='list'?'list':'map';
 mapStage.hidden=mode!=='map';
 resultMount.hidden=mode!=='list';
 $('search-list-toggle').textContent=mode==='list'?'지도보기':'목록보기';
 $('search-list-toggle').setAttribute('aria-pressed',String(mode==='list'));
 screen.dataset.searchMode=mode;
 if(mode==='map'){requestAnimationFrame(()=>{maybeMap();updateSize();});}
}
function searchStarted(){if(!opened)return;showMode('list');}
function onResults(next){
 items=Array.isArray(next)?next:[];
 paintMarkers();
 if(opened&&input.value.trim().length>=2)showMode('list');
}
function preview(item){
 if(!item)return;
 selected=item;isSavedSelection=false;$('search-picked-add').disabled=false;$('search-picked-add').textContent='+ 방문지 추가';
 $('search-picked-name').textContent=String(item.name||'선택한 위치');
 $('search-picked-address').textContent=String(item.address||'주소를 확인해 주세요.');
 picked.hidden=false;
 showMode('map');
 if(!searchMap)maybeMap();
 paintMarkers();
 if(searchMap)searchMap.panTo(new window.naver.maps.LatLng(Number(item.lat),Number(item.lng)));
 input.blur();
}
function show(){
 if(opened)return;
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;
 opened=true;historyEntry=true;previousFocus=document.activeElement;previousScroll=window.scrollY;
 feedback.hidden=true;picked.hidden=true;selected=null;items=[];isSavedSelection=false;input.value='';results.replaceChildren();results.hidden=true;
 $('search-screen-region').textContent=(window.YeoNext?.dateLabel?.()||'오늘')+' · 방문지 추가';
 $('search-screen-count').textContent='담은 장소 보기 ('+savedPlaces().length+')';
 screen.hidden=false;screen.querySelector('#search-screen-form-mount').append(form);resultMount.append(results);
 document.documentElement.style.overflow='hidden';document.body.style.position='fixed';document.body.style.top='-'+previousScroll+'px';document.body.style.width='100%';document.body.classList.add('search-open');
 savedSignature='';updateSize();showMode('map');
 const region=String(window.TripApp?.getDay?.()?.id||'');
 if(searchMap&&lastChosenRegion!==region){const [lat,lng]=mapCenter();searchMap.setCenter(new window.naver.maps.LatLng(lat,lng));searchMap.setZoom(11);}
 lastChosenRegion=region;
 history.pushState({...history.state,yeohaenggilSearch:true},'',location.href);
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function hide(fromPopstate=false){
 if(!opened)return;
 opened=false;selected=null;items=[];clearMarkers();clearSavedMarkers();savedSignature='';input.blur();
 original.insertBefore(results,original.firstChild);original.insertBefore(form,$('quick-feedback'));
 screen.hidden=true;mapStage.hidden=false;resultMount.hidden=true;results.hidden=true;
 document.body.classList.remove('search-open');document.body.style.position='';document.body.style.top='';document.body.style.width='';document.documentElement.style.overflow='';
 window.scrollTo(0,previousScroll);
 clearTimeout(feedbackTimer);feedback.hidden=true;picked.hidden=true;
 if(!fromPopstate&&historyEntry&&history.state?.yeohaenggilSearch)history.back();
 historyEntry=false;
 (previousFocus?.isConnected?previousFocus:$('btn-add-place'))?.focus?.({preventScroll:true});
}
function addSuccess(message){
 if(!opened)return;
 selected=null;isSavedSelection=false;picked.hidden=true;
 savedSignature='';refreshSavedMarkers();
 $('search-screen-count').textContent='담은 장소 보기 ('+savedPlaces().length+')';
 feedback.textContent='✓ '+message;feedback.hidden=false;
 clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.hidden=true,2100);
 showMode('map');
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function chooseAdd(){
 if(!selected||isSavedSelection)return;
 const ok=window.TripQuickAdd?.addPlace?.(selected);
 if(ok===false){$('search-picked-add').textContent='이미 추가한 장소';setTimeout(()=>$('search-picked-add').textContent='+ 방문지 추가',1200);}
}
$('search-screen-back').addEventListener('click',()=>hide());
$('search-list-toggle').addEventListener('click',()=>showMode(mode==='list'?'map':'list'));
$('search-picked-add').addEventListener('click',chooseAdd);
input.addEventListener('input',()=>{selected=null;picked.hidden=true;});
input.addEventListener('focus',()=>{if(!opened&&matchMedia('(max-width:768px)').matches)show()});
input.addEventListener('pointerdown',e=>{if(!opened&&matchMedia('(max-width:768px)').matches){e.preventDefault();show();}});
window.addEventListener('popstate',()=>{if(opened)hide(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();hide();}});
window.visualViewport?.addEventListener('resize',updateSize);
window.visualViewport?.addEventListener('scroll',updateSize);
window.addEventListener('resize',updateSize);
document.addEventListener('trip-map-ready',()=>{if(opened)maybeMap()});
document.addEventListener('trip:stops-changed',()=>{if(opened){savedSignature='';refreshSavedMarkers();$('search-screen-count').textContent='담은 장소 보기 ('+savedPlaces().length+')';}});
document.addEventListener('trip:day-changed',()=>{if(opened){selected=null;picked.hidden=true;isSavedSelection=false;savedSignature='';refreshSavedMarkers();$('search-screen-count').textContent='담은 장소 보기 ('+savedPlaces().length+')';}});
window.addEventListener('resize',()=>{if(opened)refreshSavedMarkers();});
$('search-screen-count').addEventListener('click',()=>window.YeoNext?.openSheet?.());
window.YeoSearch={show,hide,isOpen:()=>opened,preview,showSavedPlace:showSaved,searchStarted,onResults,addSuccess,refreshSavedMarkers};
