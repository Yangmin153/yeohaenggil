/** Modal-free, continuous place collection; existing itinerary schema stays intact. */
import {cleanQuery,searchTerms,rankResults,samePlace,splitPaste} from './region-search.js';
const $=id=>document.getElementById(id),app=window.TripApp;
const input=$('quick-input'),results=$('quick-results'),form=$('quick-form'),region=$('trip-region');
let selectedPreview=null,timer=null,abort=null,sequence=0,items=[],lastKey='',lastItems=[],dirty=false,feedbackTimer=0,composing=false;
const cache=new Map(),TTL=45000,LIMIT=36,metrics={requests:0,cacheHits:0,aborts:0,latencies:[],renderCount:0};
function setMessage(text,retry=false,loading=false){results.replaceChildren();const node=document.createElement('div');node.className='quick-result-message'+(loading?' is-loading':'');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.textContent=text;if(loading)window.YeoSearch?.searchStarted?.();if(retry){const b=document.createElement('button');b.textContent='다시 검색';b.type='button';b.addEventListener('click',()=>search(true));node.append(document.createElement('br'),b);}results.append(node);results.hidden=false;}
function syncRegion(){const v=app.getRegion();if(!document.body.classList.contains('region-needs-choice'))region.value=v;$('quick-region-label').textContent=v;}
function sync(){syncRegion();const disabled=$('btn-route').disabled;$('mobile-route').disabled=disabled;$('mobile-route').textContent=disabled?'최적 동선 계산 중…':app.getDay().result?'동선 다시 계산':'최적 동선 만들기';}
function setDirty(value){dirty=Boolean(value);document.body.classList.toggle('trip-route-dirty',dirty);}
function adjustViewport(){const viewport=window.visualViewport;if(!viewport)return;const rise=Math.max(0,innerHeight-viewport.height-viewport.offsetTop);document.documentElement.style.setProperty('--keyboard-rise',Math.max(0,rise>110?rise:0)+'px');if(rise>110)document.body.classList.add('quick-search-active');else if(input.value==='')document.body.classList.remove('quick-search-active');}
function setSearchActive(on){document.body.classList.toggle('quick-search-active',on);if(!on){results.hidden=true;results.replaceChildren();}adjustViewport();}
function syncView(view){if(view==='map')setSearchActive(false);else sync();}
function cancel(){clearTimeout(timer);++sequence;if(abort){metrics.aborts++;abort.abort();abort=null;}}
function cached(path){const hit=cache.get(path);if(hit&&Date.now()-hit.at<TTL){metrics.cacheHits++;cache.delete(path);cache.set(path,hit);return hit.data;}cache.delete(path);return null;}
async function request(term,signal){const path='/api/places?'+new URLSearchParams({q:term,size:'8'}),hit=cached(path);if(hit)return hit;metrics.requests++;const start=performance.now();const response=await fetch(path,{signal,headers:{accept:'application/json'}});const data=await response.json();metrics.latencies.push(Math.round(performance.now()-start));if(!response.ok)throw Error(data?.detail||'장소 검색을 완료할 수 없습니다.');if(signal.aborted)throw new DOMException('검색 취소','AbortError');cache.set(path,{at:Date.now(),data});while(cache.size>LIMIT)cache.delete(cache.keys().next().value);return data;}
function render(next){
 metrics.renderCount++;items=next;results.replaceChildren();
 for(const item of next.slice(0,8)){
  const row=document.createElement('div');row.className='quick-result-row';
  const preview=document.createElement('button');preview.className='quick-result';preview.type='button';preview.setAttribute('aria-label',item.name+' 지도에서 확인');
  const info=document.createElement('span');info.className='quick-result-info';
  const heading=document.createElement('span');heading.className='quick-result-heading';
  const title=document.createElement('strong');title.textContent=item.name;
  const category=document.createElement('span');category.className='quick-result-category';category.textContent=String(item.category||'장소').split('>').at(-1).trim();
  const address=document.createElement('small');address.textContent=item.address||'주소 정보 없음';
  heading.append(title,category);info.append(heading,address);
  const categoryIcon=document.createElement('span');categoryIcon.className='yg-search-category-icon';
  categoryIcon.innerHTML=window.TripMeta?.icon?.(item,19)||'';
  preview.append(categoryIcon,info);
  preview.addEventListener('click',()=>{if(window.YeoSearch?.isOpen?.()){window.YeoSearch.preview(item);return;}selectedPreview=item;app.previewPlace(item);input.blur();setSearchActive(false);document.getElementById('map-region').scrollIntoView({behavior:'smooth',block:'start'});});
  const addButton=document.createElement('button');addButton.type='button';addButton.className='quick-direct-add';addButton.textContent='+ 추가';addButton.setAttribute('aria-label',item.name+' 방문지 추가');addButton.addEventListener('click',()=>add(item,addButton));
  row.append(preview,addButton);results.append(row);
 }
 window.YeoSearch?.onResults?.(next);
 if(!next.length){setMessage('검색 결과가 없습니다. 다른 장소를 검색해 주세요.',true);return;}
 results.hidden=false;
 if(next.length&&document.body.dataset.mobileView!=='map'&&!window.YeoSearch?.isOpen?.()){
  selectedPreview=next[0];app.previewPlace(next[0]);
 }
}
async function search(force=false){const text=cleanQuery(input.value);if(text.length<2){cancel();if(text)setMessage('두 글자 이상 입력해 주세요.');else results.hidden=true;return;}const region=window.YeoNext?.searchRegion?.()??app.getRegion();const key=region+'::'+text;if(!force&&key===lastKey&&lastItems.length){render(lastItems);return;}cancel();const current=sequence;abort=new AbortController();const signal=abort.signal;setMessage('장소를 검색하고 있어요…',false,true);setSearchActive(true);try{let found=[];for(const q of searchTerms(text,region)){const result=await request(q,signal);if(current!==sequence)return;found=result.items||[];if(found.length)break;}if(current!==sequence)return;lastKey=key;lastItems=rankResults(found,region);render(lastItems);}catch(e){if(signal.aborted||current!==sequence)return;setMessage('검색에 실패했어요: '+e.message,true);}finally{if(current===sequence)abort=null;}}
function feedback(msg){const el=$('quick-feedback');el.hidden=false;el.textContent=msg;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>el.hidden=true,2300);app.toast(msg);}
function add(item,button=null){
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return false;
 const duplicate=app.allStops().some(x=>samePlace(x,item));
 if(duplicate){feedback('이미 담은 장소예요. 중복으로 추가하지 않았어요.');return false;}
 const result=app.addQuickStop(item,false);
 if(!result.ok){feedback(result.error||'장소를 담지 못했어요. 다시 해보세요.');return false;}
 const total=app.allStops().length;
 const isFullSearch=Boolean(window.YeoSearch?.isOpen?.());
 if(button){button.textContent='✓ 담았어요';button.classList.add('is-added');button.disabled=true;}
 document.dispatchEvent(new CustomEvent('trip:stop-added',{detail:{count:total,id:result.stop?.id,name:item.name}}));
 lastKey='';lastItems=[];input.value='';cancel();
 const message=item.name+' 추가 완료 · 총 '+total+'곳';
 feedback(message);selectedPreview=null;app.clearPlacePreview();
 if(isFullSearch){
  window.YeoSearch?.addSuccess?.(item.name+' 추가 완료 · 총 '+total+'곳');
  // Leave the pressed result visibly confirmed for 450ms, without blocking the next input.
  const completed=sequence;
  setTimeout(()=>{if(sequence===completed&&!input.value.trim()){results.hidden=true;results.replaceChildren();}},450);
  requestAnimationFrame(()=>input.focus({preventScroll:true}));
 }else{
  setSearchActive(false);
  input.focus({preventScroll:true});
 }
 return true;
}
function init(){if(!app||!form)return;sync();
 $('map-preview-cancel').addEventListener('click',()=>{selectedPreview=null;app.clearPlacePreview();});
 $('map-preview-add').addEventListener('click',()=>{if(selectedPreview)add(selectedPreview);});region.addEventListener('change',()=>{if(app.setRegion(region.value)){lastKey='';lastItems=[];cancel();if(input.value.trim().length>=2)search();else sync();}});form.addEventListener('submit',e=>{e.preventDefault();search(true);});input.addEventListener('focus',()=>{setSearchActive(true);if(input.value.trim().length>=2)search();});input.addEventListener('compositionstart',()=>{composing=true;cancel();});
 input.addEventListener('compositionend',()=>{composing=false;cancel();if(cleanQuery(input.value).length>=2){setMessage('장소를 검색하고 있어요…',false,true);timer=setTimeout(()=>search(),280);}});
 input.addEventListener('input',e=>{cancel();lastKey='';lastItems=[];setSearchActive(true);const term=cleanQuery(input.value);if(term.length>=2){setMessage('장소를 검색하고 있어요…',false,true);if(!composing&&!e.isComposing)timer=setTimeout(()=>search(),280);}else if(term)setMessage('두 글자 이상 입력해 주세요.');else {results.hidden=true;window.YeoSearch?.onResults?.([]);}});input.addEventListener('paste',e=>{const lines=splitPaste(e.clipboardData?.getData('text/plain')||'');if(lines.length<=1)return;e.preventDefault();input.value=lines[0];feedback(lines.length+'개 줄을 찾았어요. 각 장소를 확인해 추가해 주세요.');search();});input.addEventListener('keydown',e=>{if(e.key==='Escape'){setSearchActive(false);input.blur();}if(e.key==='Enter'){e.preventDefault();search(true);}});document.addEventListener('pointerdown',e=>{if(window.YeoSearch?.isOpen?.())return;if(!e.target.closest('#mobile-bottom-actions')&&!e.target.closest('#trip-region'))setSearchActive(false);});window.visualViewport?.addEventListener('resize',adjustViewport);window.visualViewport?.addEventListener('scroll',adjustViewport);window.addEventListener('resize',adjustViewport);$('mobile-route').addEventListener('click',()=>setDirty(false));adjustViewport();}
window.TripQuickAdd={sync,syncRegion,syncView,setDirty,addPlace:add,getMetrics:()=>({...metrics,cacheSize:cache.size,map:app?.getMapDiagnostics?.()})};init();
