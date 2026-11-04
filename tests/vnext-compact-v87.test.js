import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('step progress sizing applies identically to STEP 1, 2 and 3, not STEP 2 only',async()=>{
 const [css,html]=await Promise.all([
  read('public/static/vnext-compact-v87.css'),read('public/index.html')]);
 assert.match(css,/body\[data-trip-step\] #yg-progress\s*\{[^}]*gap:4px!important/);
 assert.match(css,/body\[data-trip-step\] #yg-progress>button\s*\{[^}]*min-height:42px!important/);
 assert.match(css,/body\[data-trip-step\] #yg-progress>button span\s*\{[^}]*width:22px!important/);
 assert.ok(html.includes('vnext-compact-v87.css?v=1.0.0'));
 assert.ok(html.indexOf('search-compact-v86.css')<html.indexOf('vnext-compact-v87.css'));
 assert.match(html,/src="\/static\/vnext\.js\?v=8\.9\.2"/);
 assert.doesNotMatch(css,/body\[data-trip-step="2"\] #yg-progress/);
});

test('STEP 2 date widget has single compact align-left label and a right-aligned date select',async()=>{
 const css=await read('public/static/vnext-compact-v87.css');
 assert.match(css,/body\[data-trip-step="2"\] #yg-plan-date\s*\{[^}]*min-height:48px!important/);
 assert.match(css,/body\[data-trip-step="2"\] #yg-plan-date \.yg-date-switch\s*\{[^}]*justify-content:space-between!important/);
 assert.match(css,/body\[data-trip-step="2"\] #yg-plan-date #yg-active-date\s*\{[^}]*height:36px!important/);
 assert.match(css,/box-shadow:none!important/);
});

test('STEP 2 inline stop items and delete buttons use reduced visual size and maintain touch target',async()=>{
 const [css,ui]=await Promise.all([read('public/static/vnext-compact-v87.css'),read('public/static/vnext.js')]);
 assert.match(css,/#yg-inline-stops \.yg-role-place\s*\{[^}]*padding:4px 0!important/);
 assert.match(css,/#yg-inline-stops \.yg-role-place-icon\s*\{[^}]*width:28px!important/);
 assert.match(css,/#yg-inline-stops \.yg-role-place-delete\s*\{[^}]*width:36px!important/);
 assert.match(css,/#yg-inline-stops \.yg-role-place-delete::after\s*\{[^}]*inset:-4px/);
 assert.match(ui,/data-remove-place/);
 assert.match(ui,/aria-label="'\+name\+' 삭제"/);
});

test('selected endpoint can be tapped again to clear, no separate cancel button remains',async()=>{
 const [html,script]=await Promise.all([read('public/index.html'),read('public/static/vnext.js')]);
 assert.doesNotMatch(html,/id="yg-endpoint-chooser-clear"/);
 assert.doesNotMatch(script,/\$\('yg-endpoint-chooser-clear'\)/);
 assert.match(script,/data-chooser-selected/);
 assert.match(script,/aria-pressed="'\+String\(chosen\)/);
 assert.match(script,/다시 눌러 해제/);assert.match(script,/지정하기/);
 assert.doesNotMatch(script,/chosen\?' disabled/);
});

test('endpoint chooser tap dispatches clear on selected and select on unselected place',async()=>{
 const script=await read('public/static/vnext.js');
 const start=script.indexOf("$('yg-endpoint-chooser').addEventListener('click',e=>{");
 const end=script.indexOf('\n});',start);
 assert.ok(start>=0&&end>start,'chooser click handler must exist');
 const block=script.slice(start,end+4);
 const events=[];
 let handler=null;
 const $=()=>({addEventListener:(_type,fn)=>{handler=fn}});
 const app={
  clearCollectedEndpoint(kind){events.push(['clear',kind]);return {ok:true,changed:true}},
  setCollectedRole(id,kind){events.push(['select',id,kind]);return {ok:true,id}},
  focusPlace(id){events.push(['focus',id])},
  toast(message){events.push(['toast',message])}
 };
 const closeEndpointChooser=()=>events.push(['close']);
 new Function('$','app','closeEndpointChooser','endpointChooserKind',block)(
  $,app,closeEndpointChooser,'destination');
 const tap=(selected)=>handler({target:{
  id:'',closest:()=>({dataset:{chooserPlace:'place-1',chooserSelected:String(selected)}})
 }});
 tap(true);
 assert.deepEqual(events.slice(0,2),[['clear','destination'],['close']]);
 assert.ok(!events.some(e=>e[0]==='focus'));
 events.length=0;
 tap(false);
 assert.deepEqual(events.slice(0,3),[['select','place-1','destination'],['close'],['focus','place-1']]);
});

test('changed STEP 2 script is syntactically valid',()=>{
 const result=spawnSync(process.execPath,['--check','public/static/vnext.js'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
