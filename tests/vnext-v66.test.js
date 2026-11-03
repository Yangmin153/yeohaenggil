import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('STEP2 selected date is a single top-level control and the bottom card has no redundant date input',async()=>{
 const html=await read('public/index.html');
 const step2=html.slice(html.indexOf('id="yg-plan-date"'),html.indexOf('id="trip-workspace"'));
 assert.equal((step2.match(/id="yg-active-date"/g)||[]).length,1);
 assert.ok(step2.indexOf('id="yg-active-date"')<step2.indexOf('id="yg-add-visit"'));
 assert.match(step2,/id="yg-open-stops"/);
 assert.match(step2,/id="yg-legacy-assign"/);
});
test('STEP2 selected day receives new places; duplicate checks do not cross dates',async()=>{
 const [app,quick,search]=await Promise.all([read('public/static/app.js'),read('public/static/quick-add.js'),read('public/static/search-screen.js')]);
 assert.match(app,/const duplicate=\[\.\.\.d\.stops,d\.origin,d\.destination\]\.some/);
 assert.match(app,/d\.stops\.push\(stop\)/);
 assert.match(quick,/app\.getDay\(\)\.stops\.some/);
 assert.match(search,/window\.TripApp\?\.getDay\?\.\(\)\?\.stops/);
 assert.match(app,/collecting\?\[\.\.\.d\.stops,d\.origin,d\.destination\]/);
});
test('STEP2 list no longer exposes per-place date or order controls',async()=>{
 const v=await read('public/static/vnext.js');
 const list=v.slice(v.indexOf('function renderSheet()'),v.indexOf('function openSheet()'));
 assert.doesNotMatch(list,/data-fixed-id|yg-stop-date|data-stop-up|data-stop-down/);
 assert.match(list,/data-remove-place/);
 assert.match(list,/const d=day\(\),items=d\.stops/);
});
test('migration preserves legacy unassigned stops until a user explicitly confirms transfer',async()=>{
 const [app,ui]=await Promise.all([read('public/static/app.js'),read('public/static/vnext.js')]);
 assert.match(app,/function moveUnassignedToActive\(\)/);
 assert.match(app,/const pending=unassignedStops\(\),d=day\(\)/);
 assert.match(app,/if\(d\.stops\.length\+added\.length>30\)/);
 assert.match(ui,/confirm\('기존 미배정 장소 '/);
 assert.match(ui,/app\.moveUnassignedToActive\(\)/);
});
test('STEP3 result date picker lives after map and before metrics; existing map date switch retained',async()=>{
 const [html,map]=await Promise.all([read('public/index.html'),read('public/static/map-workspace.js')]);
 const left=html.indexOf('id="map-region"'),picker=html.indexOf('id="yg-result-date"'),metrics=html.indexOf('id="route-results"');
 assert.ok(left<picker&&picker<metrics);
 assert.match(map,/\$\('map-day-select'\)\.addEventListener\('change'/);
});
test('auth modern flow provides signin signup confirmation resend recovery and no unconfigured OAuth shortcuts',async()=>{
 const [html,js]=await Promise.all([read('public/index.html'),read('public/static/accounts.js')]);
 for(const id of ['account-auth-welcome','account-auth-credentials','account-auth-verify','account-auth-recovery','account-password-confirm','account-verify-email'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/auth\.signUp\(/);assert.match(js,/auth\.signInWithPassword\(/);
 assert.match(js,/auth\.resend\(\{type:'signup'/);
 assert.match(js,/auth\.resetPasswordForEmail\(/);
 assert.match(js,/event==='PASSWORD_RECOVERY'/);
 assert.match(js,/event==='SIGNED_IN'/);
 assert.doesNotMatch(html,/data-account-action="google"|data-account-action="apple"/);
});
test('signup validates email and matching passwords and keeps auth session persistence',async()=>{
 const js=await read('public/static/accounts.js');
 assert.match(js,/function validateFields\(\)/);
 assert.match(js,/if\(action==='signup'&&password!==confirm\)/);
 assert.match(js,/persistSession:true,autoRefreshToken:true,detectSessionInUrl:true/);
 assert.match(js,/location\.origin\+location\.pathname/);
 assert.match(js,/humanError\(e\)/);
});
