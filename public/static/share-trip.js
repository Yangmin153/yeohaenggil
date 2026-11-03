import {snapshotDays,encodeSnapshot,summaryText,getPreviewURL} from './shared-trip-core.js';
const $=id=>document.getElementById(id),panel=$('yg-share-panel'),notice=$('yg-share-feedback');
let data=null,link='',busy=false;
function msg(message){notice.hidden=false;notice.textContent=message;}
function open(){panel.hidden=false;document.body.classList.add('yg-share-open');$('yg-share-close').focus({preventScroll:true});}
function close(){panel.hidden=true;document.body.classList.remove('yg-share-open');notice.hidden=true;$('yg-share-open').focus({preventScroll:true});}
async function build(){
 data=snapshotDays(window.TripApp?.getDays?.()||[]);
 link=getPreviewURL(await encodeSnapshot(data),location.origin);
 $('yg-share-link').value=link;return link;
}
async function copy(text){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
 const field=$('yg-share-link');field.value=text;field.focus();field.select();
 if(document.execCommand?.('copy'))return true;
 throw Error('자동 복사를 지원하지 않는 브라우저예요. 링크 입력창에서 직접 복사해 주세요.');
}
function day(){
 const n=window.TripApp?.getActive?.()||0;
 return data?.d?.[n]||data?.d?.[0];
}
async function act(action){
 if(busy)return;
 busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  if(!data)await build();
  if(action==='copy'){
   await copy(link);msg('읽기 전용 링크를 복사했어요. 카카오톡에 붙여 넣어 보내세요.');
  }else if(action==='text'){
   const text=summaryText(data)+'\n\n일정 확인: '+link;
   if(navigator.share){
    try{await navigator.share({title:'여행길 · 함께 보는 여행 일정',text});msg('공유 메뉴에서 카카오톡을 선택할 수 있어요.');}
    catch(e){if(e.name!=='AbortError')throw e;}
   }else{await copy(text);msg('일정과 링크를 복사했어요. 카카오톡에 붙여 넣어 보내세요.');}
  }
 }catch(e){if(e.name!=='AbortError')msg(e.message||'공유 중 문제가 발생했어요.');}
 finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
$('yg-share-open')?.addEventListener('click',async()=>{
 try{
  data=null;link='';notice.hidden=true;
  await build();open();
 }catch(e){window.TripApp?.toast?.(e.message||'동선을 계산한 다음 공유할 수 있어요.');}
});
$('yg-share-close')?.addEventListener('click',close);
panel?.querySelectorAll('[data-share-action]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.shareAction)));
panel?.addEventListener('click',e=>{if(e.target===panel)close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
