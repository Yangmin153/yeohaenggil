/** Modal-free, continuous place collection; existing itinerary schema stays intact. */
import {cleanQuery,searchTerms,rankResults,samePlace,splitPaste,tripSearchAnchor,isRegionQualified,searchIntent,distanceKm} from './region-search.js';
const $=id=>document.getElementById(id),app=window.TripApp;
const input=$('quick-input'),results=$('quick-results'),form=$('quick-form'),region=$('trip-region');
let selectedPreview=null,timer=null,abort=null,sequence=0,items=[],lastKey='',lastItems=[],dirty=false,feedbackTimer=0,composing=false,nationwide=false;
const cache=new Map(),TTL=45000,LIMIT=36,metrics={requests:0,cacheHits:0,aborts:0,latencies:[],renderCount:0};
function setMessage(text,retry=false,loading=false){results.replaceChildren();const node=document.createElement('div');node.className='quick-result-message'+(loading?' is-loading':'');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.textContent=text;if(loading)window.YeoSearch?.searchStarted?.();if(retry){const b=document.createElement('button');b.textContent='다시 검색';b.type='button';b.addEventListener('click',()=>search(true));node.append(document.createElement('br'),b);}results.append(node);results.hidden=false;}
function syncRegion(){const v=app.getRegion();if(!document.body.classList.contains('region-needs-choice'))region.value=v;$('quick-region-label').textContent=tripSearchAnchor(app.getDay())?'동선 주변':'전국';}
function sync(){syncRegion();const disabled=$('btn-route').disabled;$('mobile-route').disabled=disabled;$('mobile-route').textContent=disabled?'최적 동선 계산 중…':app.getDay().result?'동선 다시 계산':'최적 동선 만들기';}
function setDirty(value){dirty=Boolean(value);document.body.classList.toggle('trip-route-dirty',dirty);}
function adjustViewport(){const viewport=window.visualViewport;if(!viewport)return;const rise=Math.max(0,innerHeight-viewport.height-viewport.offsetTop);document.documentElement.style.setProperty('--keyboard-rise',Math.max(0,rise>110?rise:0)+'px');if(window.YeoSearch?.isOpen?.())return;if(rise>110)document.body.classList.add('quick-search-active');else if(input.value==='')document.body.classList.remove('quick-search-active');}
function setSearchActive(on){document.body.classList.toggle('quick-search-active',on);if(!on){results.hidden=true;results.replaceChildren();}adjustViewport();}
function syncView(view){if(view==='map')setSearchActive(false);else sync();}
function cancel(){clearTimeout(timer);++sequence;if(abort){metrics.aborts++;abort.abort();abort=null;}}
function cached(path){const hit=cache.get(path);if(hit&&Date.now()-hit.at<TTL){metrics.cacheHits++;cache.delete(path);cache.set(path,hit);return hit.data;}cache.delete(path);return null;}
async function request(term,signal,page=1,category=''){const params=new URLSearchParams({q:term,page:String(page)});if(category)params.set('category',category);const path='/api/places?'+params,hit=cached(path);if(hit)return hit;metrics.requests++;const start=performance.now();const response=await fetch(path,{signal,headers:{accept:'application/json'}});const data=await response.json();metrics.latencies.push(Math.round(performance.now()-start));if(!response.ok)throw Error(data?.detail||'장소 검색을 완료할 수 없습니다.');if(signal.aborted)throw new DOMException('검색 취소','AbortError');cache.set(path,{at:Date.now(),data});while(cache.size>LIMIT)cache.delete(cache.keys().next().value);return data;}
async function requestAddress(term,signal){
 const path='/api/geocode?q='+encodeURIComponent(term),hit=cached(path);
 if(hit)return Array.isArray(hit.results)?hit.results:[];
 metrics.requests++;const started=performance.now();
 const response=await fetch(path,{signal,headers:{accept:'application/json'}});
 const data=await response.json();
 metrics.latencies.push(Math.round(performance.now()-started));
 if(!response.ok)throw Error(data?.detail||'주소 검색 서버에 연결하지 못했어요.');
 if(signal.aborted)throw new DOMException('검색 취소','AbortError');
 cache.set(path,{at:Date.now(),data});
 while(cache.size>LIMIT)cache.delete(cache.keys().next().value);
 return Array.isArray(data.results)?data.results:[];
}
function render(next){
 metrics.renderCount++;items=next;results.replaceChildren();
 for(const item of next.slice(0,30)){
  const row=document.createElement('div');row.className='quick-result-row';
  const preview=document.createElement('button');preview.className='quick-result';preview.type='button';preview.setAttribute('aria-label',item.name+' 지도에서 확인');
  const info=document.createElement('span');info.className='quick-result-info';
  const heading=document.createElement('span');heading.className='quick-result-heading';
  const title=document.createElement('strong');title.textContent=item.name;
  const category=document.createElement('span');category.className='quick-result-category';category.textContent=String(item.category||'장소').split('>').at(-1).trim();
  const address=document.createElement('small');address.textContent=(item.address||'주소 정보 없음')+(item._distanceKm!==null&&item._distanceKm!==undefined&&item._distanceKm<=30?' · 동선 주변':'');
  heading.append(title,category);info.append(heading,address);
  const categoryIcon=document.createElement('span');categoryIcon.className='yg-search-category-icon';
  categoryIcon.innerHTML=window.TripMeta?.icon?.(item,19)||'';
  preview.append(categoryIcon,info);
  preview.addEventListener('click',()=>{if(window.YeoSearch?.isOpen?.()){window.YeoSearch.preview(item);return;}selectedPreview=item;app.previewPlace(item);input.blur();setSearchActive(false);document.getElementById('map-region').scrollIntoView({behavior:'smooth',block:'start'});});
  const addButton=document.createElement('button');addButton.type='button';addButton.className='quick-direct-add';addButton.textContent=window.YeoSearch?.isEndpointMode?.()?'선택':'+ 추가';addButton.setAttribute('aria-label',item.name+' 장소 선택');addButton.addEventListener('click',()=>add(item,addButton));
  row.append(preview,addButton);results.append(row);
 }
 window.YeoSearch?.onResults?.(next);
 if(!next.length){setMessage('검색 결과가 없습니다. 다른 장소를 검색해 주세요.',true);return;}
 results.hidden=false;
 if(next.length&&document.body.dataset.mobileView!=='map'&&!window.YeoSearch?.isOpen?.()){
  selectedPreview=next[0];app.previewPlace(next[0]);
 }
}
async function search(force=false,all=false){
 if(all)nationwide=true;
 const text=cleanQuery(input.value);
 if(text.length<2){cancel();if(text)setMessage('두 글자 이상 입력해 주세요.');else results.hidden=true;return;}
 const addressQuery=Boolean(window.TripSearch?.looksLikeAddress?.(text));
 const explicitRegion=isRegionQualified(text),anchor=!explicitRegion&&!addressQuery?tripSearchAnchor(app.getDay()):null;
 const intent=searchIntent(text),city=anchor?.city||'',district=anchor?.district||'';
 const scope=$('search-scope-note'),globalButton=$('search-global-results');
 const placeLabel=[city,district].filter(Boolean).join(' ');
 if(scope)scope.textContent=addressQuery?'도로명·지번 주소도 함께 검색해요.':
  anchor&&!nationwide?placeLabel+' 여행지 주변 결과 우선':'전국에서 장소명과 주소를 검색해요.';
 if(globalButton){
  globalButton.hidden=!anchor;
  globalButton.textContent=nationwide?'주변 우선':'전국';
  globalButton.setAttribute('aria-label',nationwide?'여행지 주변 결과 우선 검색':'전국 관련도순으로 검색');
 }
 const key=(nationwide?'national':'context')+'::'+(anchor?anchor.lat.toFixed(3)+','+anchor.lng.toFixed(3):'all')+'::'+text;
 if(!force&&key===lastKey&&lastItems.length){render(lastItems);return;}
 cancel();const current=sequence;abort=new AbortController();const signal=abort.signal;
 setMessage('장소와 주소를 검색하고 있어요…',false,true);setSearchActive(true);
 // Run the address lookup in parallel when the input resembles a street or lot address.
 // A keyword search failure must never suppress a successful geocode result.
 const safeAddress=()=>requestAddress(text,signal)
  .then(results=>({results,error:null})).catch(error=>({results:[],error}));
 const addressWork=addressQuery?safeAddress():null;
 try{
  let found=[],hasNext=false,keywordError=null;
  const merge=other=>{
   const ids=new Set(found.map(p=>String(p.id)));
   for(const item of other||[])if(item&&!ids.has(String(item.id))){found.push(item);ids.add(String(item.id));}
  };
  const emit=()=>{if(current!==sequence)return;
   lastKey=key;lastItems=rankResults(found,'',nationwide?null:anchor,text);render(lastItems);};
  try{
   for(const q of searchTerms(text,'')){
    const general=await request(q,signal,1);
    if(current!==sequence)return;
    found=Array.isArray(general.items)?general.items.slice():[];
    hasNext=Boolean(general.hasNext);
    if(found.length)emit();
    if(intent==='subway'){
     try{
      const station=await request(q,signal,1,'SW8');
      if(current!==sequence)return;
      merge(station.items);
      if(station.items?.length)emit();
     }catch(e){if(signal.aborted||current!==sequence)return;}
    }
    if(hasNext){
     try{
      const second=await request(q,signal,2);
      if(current!==sequence)return;
      merge(second.items);
      if(second.items?.length)emit();
     }catch(e){if(signal.aborted||current!==sequence)return;}
    }
    if(found.length)break;
   }
   if(anchor&&!nationwide&&city&&!addressQuery){
    const nearbyMatch=found.some(p=>p.name&&distanceKm(anchor,p)<=30&&(
     intent==='subway'?(p.categoryGroupCode==='SW8'||/지하철역|전철역|철도역/.test(String(p.category||''))):
      String(p.name).replace(/\s/g,'').toLowerCase()===text.replace(/\s/g,'').toLowerCase()
    ));
    if(!nearbyMatch){
     const contextualQuery=[city,district,text].filter(Boolean).join(' ');
     try{
      const contextual=await request(contextualQuery,signal,1,intent==='subway'?'SW8':'');
      if(current!==sequence)return;
      merge(contextual.items);
     }catch(e){if(signal.aborted||current!==sequence)return;}
    }
   }
  }catch(error){if(signal.aborted||current!==sequence)return;keywordError=error;}
  if(current!==sequence)return;
  const addressResult=await(addressWork||(!found.length?safeAddress():Promise.resolve({results:[],error:null})));
  if(signal.aborted||current!==sequence)return;
  if(addressResult.results.length)found=window.TripSearch?.combine?.(found,addressResult.results)||found;
  if(!found.length&&(keywordError||addressResult.error)){
   const detail=addressResult.error?.message||keywordError?.message||'검색 서비스 응답이 없습니다.';
   setMessage('검색 결과를 가져오지 못했어요. '+detail,true);return;
  }
  emit();
 }catch(e){if(signal.aborted||current!==sequence)return;setMessage('검색에 실패했어요: '+e.message,true);}
 finally{if(current===sequence)abort=null;}
}
function feedback(msg){const el=$('quick-feedback');el.hidden=false;el.textContent=msg;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>el.hidden=true,2300);if(window.YeoSearch?.isOpen?.())window.YeoSearch?.notify?.(msg);else app.toast(msg);}
function add(item,button=null){
 if(window.YeoSearch?.isOpen?.()&&window.YeoSearch?.isEndpointMode?.()){
  // A tap on a verified search result immediately sets the endpoint; the map
  // itself never accepts manually chosen locations.
  return window.YeoSearch.completeEndpoint(item);
 }
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return false;
 const duplicate=app.getDay().stops.some(x=>samePlace(x,item));
 if(duplicate){feedback('이미 담은 장소예요. 중복으로 추가하지 않았어요.');return false;}
 const result=app.addQuickStop(item,false);
 if(!result.ok){feedback(result.error||'장소를 담지 못했어요. 다시 해보세요.');return false;}
 const total=app.getDay().stops.length;
 const isFullSearch=Boolean(window.YeoSearch?.isOpen?.());
 if(button){button.textContent='✓ 담았어요';button.classList.add('is-added');button.disabled=true;}
 document.dispatchEvent(new CustomEvent('trip:stop-added',{detail:{count:total,id:result.stop?.id,name:item.name}}));
 lastKey='';lastItems=[];input.value='';cancel();
 const message=item.name+' 추가 완료 · 총 '+total+'곳';
 feedback(message);selectedPreview=null;app.clearPlacePreview();
 if(isFullSearch){
  window.YeoSearch?.addSuccess?.(item.name+'을(를) 담았어요. · '+total+'곳',item);
  // Leave the pressed result visibly confirmed for 450ms, without blocking the next input.
  const completed=sequence;
  setTimeout(()=>{if(sequence===completed&&!input.value.trim()){results.hidden=true;results.replaceChildren();}},450);
  // Keep the map visible after adding; the search input remains available for the next place.
 }else{
  setSearchActive(false);
  app.previewPlace(item);
  input.blur();
 }
 return true;
}
function init(){if(!app||!form)return;sync();$('search-global-results')?.addEventListener('click',()=>{nationwide=!nationwide;search(true);});document.addEventListener('trip:day-changed',()=>{lastKey='';lastItems=[];nationwide=false;});
 $('map-preview-cancel').addEventListener('click',()=>{selectedPreview=null;app.clearPlacePreview();});
 $('map-preview-add').addEventListener('click',()=>{if(selectedPreview)add(selectedPreview);});region.addEventListener('change',()=>{if(app.setRegion(region.value)){lastKey='';lastItems=[];cancel();if(input.value.trim().length>=2)search();else sync();}});form.addEventListener('submit',e=>{e.preventDefault();search(true);});input.addEventListener('focus',()=>{setSearchActive(true);if(input.value.trim().length>=2)search();});input.addEventListener('compositionstart',()=>{composing=true;cancel();});
 input.addEventListener('compositionend',()=>{composing=false;cancel();if(cleanQuery(input.value).length>=2){setMessage('장소를 검색하고 있어요…',false,true);timer=setTimeout(()=>search(),280);}});
 input.addEventListener('input',e=>{cancel();lastKey='';lastItems=[];nationwide=false;setSearchActive(true);const term=cleanQuery(input.value);if(term.length>=2){setMessage('장소를 검색하고 있어요…',false,true);if(!composing&&!e.isComposing)timer=setTimeout(()=>search(),280);}else if(term)setMessage('두 글자 이상 입력해 주세요.');else {results.hidden=true;window.YeoSearch?.onResults?.([]);}});input.addEventListener('paste',e=>{const lines=splitPaste(e.clipboardData?.getData('text/plain')||'');if(lines.length<=1)return;e.preventDefault();input.value=lines[0];feedback(lines.length+'개 줄을 찾았어요. 각 장소를 확인해 추가해 주세요.');search();});input.addEventListener('keydown',e=>{if(e.key==='Escape'){setSearchActive(false);input.blur();}if(e.key==='Enter'){e.preventDefault();search(true);}});document.addEventListener('pointerdown',e=>{if(window.YeoSearch?.isOpen?.())return;if(!e.target.closest('#mobile-bottom-actions')&&!e.target.closest('#trip-region'))setSearchActive(false);});window.visualViewport?.addEventListener('resize',adjustViewport);window.visualViewport?.addEventListener('scroll',adjustViewport);window.addEventListener('resize',adjustViewport);$('mobile-route').addEventListener('click',()=>setDirty(false));adjustViewport();}
window.TripQuickAdd={sync,syncRegion,syncView,setDirty,addPlace:add,getMetrics:()=>({...metrics,cacheSize:cache.size,map:app?.getMapDiagnostics?.()})};init();
