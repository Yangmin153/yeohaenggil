/* Email auth & owner-scoped travel plans; never handles raw passwords outside Supabase SDK. */
const $=id=>document.getElementById(id),app=()=>window.TripApp;
let api=null,session=null,user=null,activeId=null,config=null,lastId=null,busy=false,authView='signin',pendingEmail='',pendingEmailType='signup',oauthCheckedAt=0;
let tripCache=null,tripCacheUser=null,tripLoadedAt=0,tripPending=null,tripRequestId=0,openRequestId=0,apiPending=null;
const DRAFT_KEY='yeohaenggil.vnext.draft-scope-id';
function rotateDraftScope(){
 const id=globalThis.crypto?.randomUUID?.()||String(Date.now());
 try{sessionStorage.setItem(DRAFT_KEY,id);}catch{}
 return id;
}
function restoreDraftScope(){
 try{
  const stored=sessionStorage.getItem(DRAFT_KEY);
  if(stored&&/^[a-z0-9-]{8,80}$/i.test(stored))return stored;
 }catch{}
 return rotateDraftScope();
}
let draftScopeId=restoreDraftScope();
const enabledOAuth={google:false,kakao:false};
const panel=$('account-panel'),feedback=$('account-feedback'),travelList=$('account-trips');
const notice=(msg,error=false)=>{feedback.textContent=msg;feedback.dataset.error=String(error)};
const loggedIn=()=>Boolean(user&&session?.access_token);
const storageScope=()=>loggedIn()?user.id+':'+(activeId?'trip:'+activeId:'draft:'+draftScopeId):'guest';
const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email||'').trim());
const passwordOK=value=>typeof value==='string'&&value.length>=8&&value.length<=128;
function setView(view){
 authView=view;
 $('account-auth-welcome').hidden=view!=='welcome';
 $('account-auth-credentials').hidden=!['signin','signup','reset'].includes(view);
 $('account-auth-verify').hidden=view!=='verify';
 $('account-auth-recovery').hidden=view!=='recovery';
 if(['signin','signup','reset'].includes(view)){
  $('account-auth-title').textContent=view==='signup'?'회원가입':view==='reset'?'비밀번호 찾기':'이메일로 로그인';
  $('account-password-field').hidden=view==='reset';
  $('account-confirm-field').hidden=view!=='signup';
  $('account-password').autocomplete=view==='signup'?'new-password':'current-password';
  $('account-auth-submit').dataset.accountAction=view;
  $('account-auth-submit').textContent=view==='signup'?'회원가입':view==='reset'?'재설정 메일 보내기':'로그인';
  $('account-auth-alternate').hidden=view==='reset';
   $('account-auth-alternate').dataset.authView=view==='signup'?'signin':'signup';
   $('account-auth-alternate').textContent=view==='signup'?'이미 가입하셨나요? 로그인':'계정이 없으신가요? 회원가입';
  $('account-auth-reset-link').hidden=view!=='signin';
  $('account-password-hint').textContent=view==='signup'?'비밀번호는 8~128자로 입력해 주세요.':'';
 }
 if(view==='verify'){
  $('account-verify-email').textContent=pendingEmail;
  $('account-verify-title').textContent=pendingEmailType==='recovery'?'비밀번호 재설정 메일을 보냈어요.':'인증 메일을 보냈어요.';
 }
 feedback.textContent='';feedback.dataset.error='false';
}
function humanError(err){
 const s=String(err?.code||'')+' '+String(err?.message||err||'');
 if(/invalid_credentials|invalid login/i.test(s))return '이메일 또는 비밀번호를 확인해 주세요.';
 if(/email_not_confirmed/i.test(s))return '이메일 인증을 완료한 뒤 로그인해 주세요.';
 if(/user_already_exists|user already registered/i.test(s))return '이미 가입된 이메일입니다. 로그인해 주세요.';
 if(/weak_password|password should|password is too/i.test(s))return '비밀번호 조건을 확인해 주세요.';
 if(/email_address_invalid|invalid email/i.test(s))return '올바른 이메일 주소를 입력해 주세요.';
 if(/over_email_send_rate_limit|email rate limit|rate limit/i.test(s))return '메일 요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.';
 if(/otp_expired|expired/i.test(s))return '인증 링크가 만료됐어요. 새 인증 메일을 요청해 주세요.';
 if(/network|fetch failed|failed to fetch/i.test(s))return '인터넷 연결을 확인하고 다시 시도해 주세요.';
 return String(err?.message||err||'요청을 완료하지 못했어요.');
}
function validateFields(){
 const email=$('account-email').value.trim(),password=$('account-password').value,confirm=$('account-password-confirm').value;
 $('account-email-hint').textContent=email&&!validEmail(email)?'이메일 주소를 다시 확인해 주세요.':'';
 if(authView==='signup')$('account-password-hint').textContent=confirm&&password!==confirm?'비밀번호가 서로 달라요.':!passwordOK(password)?'비밀번호는 8~128자로 입력해 주세요.':'';
 return {email,password,confirm};
}

function currentDays(){return app().exportCloudDays?.()||app().getDays().map(day=>structuredClone(day));}
async function initApi(){
 if(api)return api;
 if(apiPending)return apiPending;
 apiPending=(async()=>{
 config=config||await (await fetch('/api/config')).json();
 if(!config.supabaseReady||!config.supabaseUrl||!config.supabaseAnonKey)throw Error(config.supabaseError||'회원가입 서버 설정을 확인할 수 없습니다. 나중에 다시 시도해 주세요.');
 if(!window.supabase?.createClient)await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';el.onload=resolve;el.onerror=()=>reject(Error('로그인 라이브러리를 불러오지 못했습니다.'));document.head.append(el)});
 if(!window.supabase?.createClient)throw Error('로그인 라이브러리를 사용할 수 없습니다.');
 api=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 api.auth.onAuthStateChange((event,newSession)=>queueMicrotask(()=>{
  applySession(newSession);
  if(event==='PASSWORD_RECOVERY'){panel.hidden=false;document.body.classList.add('account-open');window.YGScrollLock?.lock('account');setView('recovery');$('account-auth-form').hidden=false;$('account-signed').hidden=true;}
  else if(event==='SIGNED_IN'&&authView==='verify'&&newSession?.user)notice('이메일 인증이 완료됐어요.');
 }));
 return api;
 })();
 try{return await apiPending;}finally{apiPending=null;}
}
async function refreshOAuthProviders(force=false){
 if(!config?.supabaseReady)return;
 if(!force&&Date.now()-oauthCheckedAt<60000)return;
 oauthCheckedAt=Date.now();
 let google=false,kakao=false;
 try{
  // Supabase exposes public provider availability; do not copy OAuth client secrets to Vercel.
  const response=await fetch(config.supabaseUrl+'/auth/v1/settings',{
   headers:{apikey:config.supabaseAnonKey},
   signal:AbortSignal.timeout(7500)
  });
  if(response.ok){
   const settings=await response.json();
   google=settings.external?.google===true;
   kakao=settings.external?.kakao===true;
  }
 }catch{ /* Keep disabled providers hidden until the public settings endpoint is reachable. */ }
 enabledOAuth.google=google;enabledOAuth.kakao=kakao;
 $('account-oauth-google').hidden=!google;
 $('account-oauth-kakao').hidden=!kakao;
 $('account-social-buttons').hidden=!google&&!kakao;
}
function applySession(next){
 const id=next?.user?.id||null,changed=id!==lastId;
 if(changed){
   if(lastId!==null)draftScopeId=rotateDraftScope();
   ++tripRequestId;++openRequestId;tripCache=null;tripCacheUser=null;tripLoadedAt=0;tripPending=null;
   $('account-trips-status').textContent=id?'저장된 여행을 불러오는 중…':'';
   if(lastId!==null){activeId=null;travelList.replaceChildren();app().restoreGuestDays();}
  }
 lastId=id;session=next;user=next?.user||null;
 $('account-button').textContent=user?'내 여행':'로그인';
 $('account-user').textContent=user?.email||'';
 $('account-user').hidden=!loggedIn();
 $('account-panel-title').textContent=loggedIn()?'내 여행':'여행길 계정';
 $('account-auth-form').hidden=loggedIn()&&authView!=='recovery';
 $('account-signed').hidden=!loggedIn();
 $('cloud-save').hidden=!loggedIn();
 // Prefetch as soon as Supabase restores a session; keep the current unsaved plan intact.
  if(id&&changed)void loadTrips();
}
function open(){panel.hidden=false;document.body.classList.add('account-open');window.YGScrollLock?.lock('account');if(!loggedIn()&&authView==='recovery'&&!session)setView('signin');if(loggedIn())void loadTrips();else if(api)void refreshOAuthProviders();}
function close(){panel.hidden=true;document.body.classList.remove('account-open');window.YGScrollLock?.unlock('account');}
async function request(path,method='GET',payload){
 if(!loggedIn())throw Error('로그인이 필요합니다.');
 const owner=user.id,access=session.access_token,controller=new AbortController();
 // Server verifies authentication (9s) and database access (12s) sequentially in the worst case.
 const timeout=setTimeout(()=>controller.abort(),26000);
 try{
  const r=await fetch('/api/trips'+path,{
   method,headers:{Authorization:'Bearer '+access,...(payload?{'content-type':'application/json'}:{})},
   ...(payload?{body:JSON.stringify(payload)}:{}),signal:controller.signal,cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
   const message=data.error||(r.status===401?'로그인이 만료되었습니다. 다시 로그인해 주세요.':'여행 데이터를 처리할 수 없습니다.');
   throw Error(message);
  }
  if(user?.id!==owner)throw Error('로그인 계정이 변경됐어요. 다시 진행해 주세요.');
  return data;
 }catch(e){
  if(e?.name==='AbortError')throw Error('요청 시간이 초과됐어요. 다시 시도해 주세요.');
  throw e;
 }finally{clearTimeout(timeout);}
}

function payload(name,days=currentDays(),fingerprint=null){
 return {name:String(name||'').trim(),region:String(days[0]?.region||app().getRegion()).slice(0,80),days,import_fingerprint:fingerprint};
}
function tripRow(trip){
 const row=document.createElement('div');row.className='account-trip-row';
 const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='account-trip-open';
 const name=document.createElement('strong');name.textContent=trip.name;
 const sub=document.createElement('small');sub.textContent=[trip.region,new Date(trip.updated_at).toLocaleDateString('ko-KR')+' 수정'].filter(Boolean).join(' · ');
 openBtn.append(name,sub);openBtn.onclick=async()=>{
  if(busy||openBtn.disabled)return;
  if(!confirm('이 여행을 열까요? 현재 화면의 여행이 교체됩니다. 저장하지 않은 변경사항은 사라질 수 있어요.'))return;
  const requested=++openRequestId,owner=user?.id,former=name.textContent;
  openBtn.disabled=true;name.textContent='여행을 여는 중…';
  try{
   const {trip:full}=await request('?id='+encodeURIComponent(trip.id));
   if(owner!==user?.id||requested!==openRequestId)return;
   if(!full?.days||!app().validateDays(full.days))throw Error('저장된 여행 데이터가 올바르지 않습니다.');
   if(!app().importDays(full.days))throw Error('여행 데이터를 적용하지 못했어요. 기존 일정은 유지됩니다.');
   activeId=full.id;$('account-trip-name').value=full.name||trip.name;
   close();if(full.days.some(d=>d.result)&&window.YeoNext?.go)window.YeoNext.go(3);
   app().toast('저장한 여행을 불러왔어요.');
  }catch(e){if(owner===user?.id)notice(humanError(e),true);}
  finally{name.textContent=former;openBtn.disabled=false;}
 };
 const edit=document.createElement('button');edit.type='button';edit.textContent='이름';edit.onclick=async()=>{
  if(busy||edit.disabled)return;
  const value=prompt('여행 이름 변경',trip.name);if(value===null)return;
  const nextName=value.trim();if(!nextName||nextName.length>90)return notice('이름을 1~90자로 입력해 주세요.',true);
  edit.disabled=true;
  try{
   const {trip:full}=await request('?id='+encodeURIComponent(trip.id));
   if(!full?.days)throw Error('저장된 여행 데이터를 찾을 수 없어요.');
   const {trip:updated}=await request('?id='+encodeURIComponent(trip.id),'PATCH',payload(nextName,full.days,full.import_fingerprint));
   if(activeId===trip.id)$('account-trip-name').value=nextName;
   mergeCachedTrip(updated);notice('이름을 변경했어요.');void loadTrips(true);
  }catch(e){notice(humanError(e),true);}
  finally{edit.disabled=false;}
 };
 const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='삭제';del.onclick=async()=>{
  if(busy||del.disabled)return;
  if(!confirm('여행 '+trip.name+'을(를) 삭제할까요?'))return;
  del.disabled=true;
  try{
   await request('?id='+encodeURIComponent(trip.id),'DELETE');
   if(activeId===trip.id)activeId=null;
   removeCachedTrip(trip.id);notice('여행을 삭제했어요.');void loadTrips(true);
  }catch(e){notice(humanError(e),true);}
  finally{del.disabled=false;}
 };
 const opts=document.createElement('div');opts.className='account-trip-ops';opts.append(edit,del);row.append(openBtn,opts);return row;
}
function mergeCachedTrip(trip){
 if(!trip?.id||!loggedIn())return;
 const {days,...summary}=trip;
 const previous=tripCacheUser===user.id&&Array.isArray(tripCache)?tripCache:[];
 tripCache=[summary,...previous.filter(p=>p.id!==summary.id)];
 tripCacheUser=user.id;tripLoadedAt=Date.now();
 ++tripRequestId;tripPending=null;
 showTrips(tripCache);
 $('account-trips-status').textContent=tripCache.length+'개 여행이 저장되어 있어요.';
}
function removeCachedTrip(id){
 if(tripCacheUser!==user?.id||!Array.isArray(tripCache))return;
 tripCache=tripCache.filter(p=>p.id!==id);tripLoadedAt=Date.now();
 ++tripRequestId;tripPending=null;
 showTrips(tripCache);
 $('account-trips-status').textContent=tripCache.length+'개 여행이 저장되어 있어요.';
}
function showTrips(trips){
 travelList.replaceChildren(...trips.map(tripRow));
 if(!trips.length){const p=document.createElement('p');p.className='account-empty';p.textContent='아직 저장한 여행이 없어요. 여행 이름을 입력하고 저장해 보세요.';travelList.append(p);}
}
async function loadTrips(force=false){
 if(!loggedIn())return;
 const owner=user.id,status=$('account-trips-status'),hasCached=tripCacheUser===owner&&Array.isArray(tripCache);
 if(hasCached&&(!travelList.children.length||force))showTrips(tripCache);
 if(!force&&hasCached&&Date.now()-tripLoadedAt<30000){status.textContent=tripCache.length+'개 여행이 저장되어 있어요.';return;}
 if(tripPending&&!force)return tripPending;
 if(tripPending&&force){++tripRequestId;tripPending=null;}
 const requestId=++tripRequestId;
 status.textContent=hasCached?'최신 저장 목록을 확인하는 중…':'저장된 여행을 불러오는 중…';
 const pending=(async()=>{
  try{
   const {trips}=await request('?summary=1');
   if(user?.id!==owner||requestId!==tripRequestId)return;
   tripCacheUser=owner;tripCache=Array.isArray(trips)?trips:[];tripLoadedAt=Date.now();
   showTrips(tripCache);
   status.textContent=tripCache.length?tripCache.length+'개 여행이 저장되어 있어요.':'아직 저장한 여행이 없습니다.';
  }catch(e){
   if(user?.id!==owner||requestId!==tripRequestId)return;
   status.textContent=hasCached?'최근 목록을 표시 중이에요. 새로고침해 주세요.':'목록을 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.';
   notice(humanError(e),true);
  }
 })();
 tripPending=pending;
 try{await pending;}finally{if(tripPending===pending)tripPending=null;}
}
async function saveCloud(){
 if(!loggedIn()){open();notice('다른 기기에서 이어서 보려면 로그인해 주세요.');return;}
 const name=$('account-trip-name').value.trim();if(!name||name.length>90)throw Error('여행 이름은 1~90자로 입력해 주세요.');
 const previousScope=storageScope();
 const data=await request(activeId?'?id='+activeId:'',activeId?'PATCH':'POST',payload(name));
 activeId=data.trip.id;app().migrateArchiveScope?.(previousScope,storageScope());
 mergeCachedTrip(data.trip);notice('여행을 저장했어요.');app().toast('클라우드에 저장했어요.');void loadTrips(true);
}
async function importLocal(){
 if(!loggedIn())throw Error('먼저 로그인해 주세요.');
 const raw=localStorage.getItem('yeohaenggil.v2.days');if(!raw)throw Error('가져올 브라우저 여행이 없습니다.');
 let days;try{days=JSON.parse(raw)}catch{throw Error('브라우저 일정 형식이 올바르지 않습니다.')}
 if(!app().validateDays(days))throw Error('저장된 여행 데이터가 올바르지 않습니다.');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(days)));
 const hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
 const marker='yeohaenggil.imported.'+user.id+'.'+hash;
 if(localStorage.getItem(marker))return notice('이미 가져온 여행입니다.');
 const data=await request('','POST',payload('기존 브라우저 여행',days,hash));
 localStorage.setItem(marker,data.trip.id);mergeCachedTrip(data.trip);notice('여행을 가져왔습니다. 브라우저 원본은 유지됩니다.');void loadTrips(true);
}
async function perform(action){
 if(busy)return;busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);
 if(['signin','signup','reset'].includes(action))$('account-auth-submit').textContent='처리 중…';
 try{
  if(action.startsWith('oauth:')){
   const provider=action.slice('oauth:'.length);
   if(!['google','kakao'].includes(provider))throw Error('지원하지 않는 로그인 방식입니다.');
   await initApi();
   await refreshOAuthProviders(true);
   if(!enabledOAuth[provider])throw Error('아직 설정되지 않은 로그인 방식입니다. Supabase 제공자 설정을 확인해 주세요.');
   const {error}=await api.auth.signInWithOAuth({
    provider,options:{redirectTo:location.origin+location.pathname}
   });
   if(error)throw error;
  }else if(['signup','signin','reset','resend','setrecovery'].includes(action)){
   await initApi();
   const {email,password,confirm}=validateFields();
   const redirectTo=location.origin+location.pathname;
   if(action==='setrecovery'){
    const value=$('account-recovery-password').value;
    if(!passwordOK(value)||value!==$('account-recovery-confirm').value)throw Error('비밀번호는 8자 이상으로 입력하고 확인 값과 일치시켜 주세요.');
    const {error}=await api.auth.updateUser({password:value});if(error)throw error;
    $('account-recovery-password').value='';$('account-recovery-confirm').value='';
    setView('signin');notice('비밀번호를 변경했어요.');
    if(loggedIn()){$('account-auth-form').hidden=true;$('account-signed').hidden=false;}
   }else if(action==='resend'){
    if(!validEmail(pendingEmail))throw Error('이메일 주소를 먼저 입력해 주세요.');
    const response=pendingEmailType==='recovery'?
      await api.auth.resetPasswordForEmail(pendingEmail,{redirectTo}):
      await api.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:redirectTo}});
    if(response.error)throw response.error;
    notice('메일을 다시 요청했어요. 메일함을 확인해 주세요.');
   }else{
    if(!validEmail(email))throw Error('올바른 이메일 주소를 입력해 주세요.');
    if(action==='reset'){
     const {error}=await api.auth.resetPasswordForEmail(email,{redirectTo});
     if(error)throw error;
     pendingEmail=email;pendingEmailType='recovery';setView('verify');
     notice('메일이 보이지 않으면 스팸함도 확인해 주세요.');
    }else{
     if(!passwordOK(password))throw Error('비밀번호는 8~128자로 입력해 주세요.');
     if(action==='signup'&&password!==confirm)throw Error('비밀번호 확인이 일치하지 않아요.');
     const {data,error}=action==='signup'?
       await api.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}}):
       await api.auth.signInWithPassword({email,password});
     if(error)throw error;
     $('account-password').value='';$('account-password-confirm').value='';
     if(data.session){applySession(data.session);notice('로그인이 완료됐어요. 저장된 여행을 확인할 수 있어요.');app().toast('로그인했어요.');}
     else{
      pendingEmail=email;pendingEmailType='signup';setView('verify');
      notice('메일이 오지 않으면 스팸함도 확인해 주세요.');
     }
    }
   }
  }else if(action==='save')await saveCloud();
  else if(action==='list')await loadTrips(true);
  else if(action==='import')await importLocal();
  else if(action==='new'){if(confirm('새 여행을 시작할까요? 기존 클라우드 여행은 별도로 저장해야 합니다.')){activeId=null;draftScopeId=rotateDraftScope();app().newTrip();$('account-trip-name').value='새 여행';close();}}
  else if(action==='signout'){const {error}=await api.auth.signOut();if(error)throw error;applySession(null);setView('signin');close();}
  else if(action==='password'){if(!user?.email)throw Error('계정 이메일을 확인할 수 없어요.');const {error}=await api.auth.resetPasswordForEmail(user.email,{redirectTo:location.origin+location.pathname});if(error)throw error;notice('비밀번호 변경 링크를 이메일로 보냈어요. 메일함을 확인해 주세요.');}
  else if(action==='delete'){if(prompt('계정 삭제와 여행 데이터 영구 삭제에 동의한다면 DELETE를 입력하세요.')!=='DELETE')return;const response=await fetch('/api/account',{method:'DELETE',headers:{authorization:'Bearer '+session.access_token}});const body=await response.json();if(!response.ok)throw Error(body.error||'계정 삭제를 완료하지 못했습니다.');await api.auth.signOut();applySession(null);close();}
 }catch(e){notice(humanError(e),true)}finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);if(['signin','signup','reset'].includes(authView))$('account-auth-submit').textContent=authView==='signup'?'회원가입':authView==='reset'?'재설정 메일 보내기':'로그인';}
}
function init(){
 $('account-button').onclick=open;$('cloud-save').onclick=()=>{open();void perform('save')};$('account-close').onclick=close;
 $('yg-route-save')?.addEventListener('click',saveCurrent);
 $('yg-route-load')?.addEventListener('click',openSaved);
 panel.addEventListener('click',e=>{
  if(e.target===panel){close();return;}
  const toggler=e.target.closest('[data-toggle-password]');
  if(toggler){const input=$(toggler.dataset.togglePassword);input.type=input.type==='password'?'text':'password';toggler.textContent=input.type==='password'?'보기':'숨기기';toggler.setAttribute('aria-label',input.type==='password'?'비밀번호 보기':'비밀번호 숨기기');return;}
  const social=e.target.closest('[data-oauth-provider]');if(social){void perform('oauth:'+social.dataset.oauthProvider);return;}
  const view=e.target.closest('[data-auth-view]');if(view){setView(view.dataset.authView);return;}
  const btn=e.target.closest('[data-account-action]');if(btn)void perform(btn.dataset.accountAction);
 });
 for(const id of ['account-email','account-password','account-password-confirm'])$(id).addEventListener('input',validateFields);
 $('account-auth-credentials').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.target.tagName==='INPUT'){event.preventDefault();void perform(authView);}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
 setView('signin');
 const social=$('account-social-buttons');if(social)$('account-auth-credentials').append(social);
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.replace(/^#/,'')),
  errorCode=query.get('error_code')||fragment.get('error_code')||query.get('error')||fragment.get('error');
 if(errorCode){open();setView('signin');notice(humanError({code:errorCode,message:query.get('error_description')||fragment.get('error_description')||errorCode}),true);}
 fetch('/api/config').then(r=>r.json()).then(async c=>{config=c;if(!c.supabaseReady)return;await initApi();void refreshOAuthProviders();const {data}=await api.auth.getSession();applySession(data.session)}).catch(e=>notice(humanError(e),true));
}
function saveCurrent(){
 if(!loggedIn()){
  open();notice('로그인한 뒤 여행 저장을 눌러주세요.');return;
 }
 open();
 void perform('save');
}
function openSaved(){
 open();
 if(loggedIn())void loadTrips();
 else notice('저장된 여행을 불러오려면 로그인해 주세요.');
}
window.YeoAccount={isSignedIn:loggedIn,storageScope,open,loadTrips,saveCurrent,openSaved};
init();

