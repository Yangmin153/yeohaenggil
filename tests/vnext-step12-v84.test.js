import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('STEP1 places date selector before showcase and removes forced centered vertical gap',async()=>{
 const [html,css]=await Promise.all(['public/index.html','public/static/vnext-step12-compact-v84.css'].map(read));
 assert.ok(html.includes('id="yg-date-range-open"'));
 assert.match(css,/#yg-step-one\s*\{[^}]*justify-content:flex-start!important/);
 assert.match(css,/#yg-step-one \.yg-date-card\s*\{[^}]*order:1/);
 assert.match(css,/#yg-step-one \.yg-trip-showcase\s*\{[^}]*order:4/);
 assert.match(css,/#yg-step-one \.yg-trip-showcase\s*\{[^}]*display:none!important/);
});
test('STEP2 date switch and top visit search stay compact on mobile',async()=>{
 const css=await read('public/static/vnext-step12-compact-v84.css');
 assert.match(css,/#yg-plan-date\s*\{[^}]*min-height:36px!important/);
 assert.match(css,/#yg-active-date\s*\{[^}]*height:36px!important/);
 assert.match(css,/#yg-add-visit\s*\{[^}]*min-height:48px!important/);
});
test('STEP2 endpoint summary opens one dialog with an existing-place list plus search fallback',async()=>{
 const [html,ui]=await Promise.all(['public/index.html','public/static/vnext.js'].map(read));
 for(const id of ['yg-role-status-origin','yg-role-status-destination','yg-endpoint-chooser','yg-endpoint-chooser-list','yg-endpoint-chooser-search'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('data-pick-endpoint="origin"'));
 assert.ok(html.includes('data-pick-endpoint="destination"'));
 assert.match(ui,/function openEndpointChooser\(kind\)/);
 assert.match(ui,/data-chooser-place/);
 assert.match(ui,/app\.setCollectedRole\(button\.dataset\.chooserPlace,kind\)/);
 assert.match(ui,/if\(kind\)openSearch\(kind\)/);
 assert.doesNotMatch(ui,/data-assign-role/);
 assert.match(ui,/closeEndpointChooser\(\{restoreFocus:false\}\)/);
 assert.match(ui,/YGScrollLock\?\.lock\('endpoint-chooser'\)/);
 assert.match(ui,/YGScrollLock\?\.unlock\('endpoint-chooser'\)/);
});
test('endpoint search preserves existing assigned locations and recalculates routes through collected roles',async()=>{
 const app=await read('public/static/app.js');
 const start=app.indexOf('function setEndpointFromSearch(kind,item){');
 const end=app.indexOf('function setCollectedRole(id,role){',start);
 const block=app.slice(start,end);
 assert.match(block,/const result=setCollectedRoleFromSearch\(item,kind\)/);
 assert.ok(!block.includes('d[kind]=place'));
 assert.match(app,/function setCollectedRoleFromSearch\(item,role\)/);
 assert.match(app,/invalidateRoutes\(\);selectedMapStop=null;refresh\(\)/);
});
test('search map uses one SDK map instance and a coalesced viewport resize path',async()=>{
 const js=await read('public/static/search-screen.js');
 assert.equal(js.match(/new maps\.Map\(/g)?.length,1);
 assert.match(js,/if\(signature===lastViewportSignature\)return/);
 assert.match(js,/if\(!searchMap\|\|mapResizeFrame\)return/);
 assert.match(js,/const created=maybeMap\(\)/);
 assert.match(js,/window\.naver\?\.maps\?\.Event\?\.trigger\?\.\(searchMap,'resize'\)/);
 assert.match(js,/renderStaticFallback\(\)/);
 assert.match(js,/const density=window\.devicePixelRatio>=1\.5\?'2':'1'/);
});
test('changed scripts parse correctly',()=>{
 for(const file of ['public/static/vnext.js','public/static/search-screen.js','public/static/app.js']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+'\n'+result.stderr);
 }
});
