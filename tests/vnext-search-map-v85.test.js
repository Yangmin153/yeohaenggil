import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {focusedStaticMapLayout} from '../public/static/static-map-layout.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('STEP 1 CTA is immediately after the date card in normal flow, never after showcase',async()=>{
 const [html,css]=await Promise.all([read('public/index.html'),read('public/static/vnext-step12-compact-v84.css')]);
 const step=html.slice(html.indexOf('id="yg-step-one"'),html.indexOf('<div class="region-onboarding"'));
 assert.ok(step.indexOf('id="yg-date-range-open"')<step.indexOf('id="yg-next-places"'));
 assert.ok(step.indexOf('id="yg-next-places"')<step.indexOf('class="yg-trip-showcase"'));
 assert.match(css,/display:block!important;min-height:0!important/);
 assert.match(css,/#yg-next-places\s*\{[^}]*display:flex!important/);
 assert.match(css,/position:static!important/);
});
test('STEP 2 active date text is in a stable two-column row',async()=>{
 const css=await read('public/static/vnext-step12-compact-v84.css');
 assert.match(css,/grid-template-columns:64px minmax\(0,1fr\)!important/);
 assert.match(css,/text-align-last:left!important/);
 assert.match(css,/white-space:nowrap!important/);
});
test('visit search permanently omits departure and arrival selectors',async()=>{
 const [html,screen]=await Promise.all([read('public/index.html'),read('public/static/search-screen.js')]);
 const section=html.slice(html.indexOf('<div class="search-picked"'),html.indexOf('id="search-screen-results-mount"'));
 assert.match(section,/id="search-picked-add"/);
 assert.doesNotMatch(section,/search-picked-(origin|destination)|search-picked-role-row/);
 assert.doesNotMatch(screen,/showRoleOptions|chooseRole|search-picked-origin|search-picked-destination/);
 assert.match(html,/data-pick-endpoint="origin"/);
 assert.match(html,/data-pick-endpoint="destination"/);
});
test('a 170px tall search map can render without getting trapped at the old 240px minimum',async()=>{
 const coordinate={x:37.489,y:126.724};
 const map=focusedStaticMapLayout([coordinate],coordinate,390,170,13);
 assert.ok(map);
 assert.equal(map.height,170);
 assert.equal(map.pixels[0].x,195);
 assert.equal(map.pixels[0].y,85);
 const screen=await read('public/static/search-screen.js');
 assert.match(screen,/height<120/);
 assert.doesNotMatch(screen,/화면을 조정하고 있어요/);
});
test('adding from search results stays on overlay and focuses selected saved map marker',async()=>{
 const [screen,quick]=await Promise.all([read('public/static/search-screen.js'),read('public/static/quick-add.js')]);
 const start=screen.indexOf('function addSuccess(message,place=null){'),end=screen.indexOf('function showTransition(',start);
 const part=screen.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(part,/selected=place;previewSource='added';isSavedSelection=true/);
 assert.match(part,/picked.hidden=true;input.blur\(\)/);
 assert.match(part,/updateSavedButton\(\)/);
 assert.match(part,/showMode\('map'\)/);
 assert.doesNotMatch(part,/hide\(\)|focusPlace|expandPlaceList/);
 assert.match(quick,/YeoSearch\?\.addSuccess\?\.\(item\.name/);
 const calls=[],picked={hidden:false},input={blur:()=>calls.push('blur')};
 const make=new Function('opened','picked','input','updateSavedButton','showMode','notify','selected','previewSource','isSavedSelection','previewCamera',part+';return addSuccess');
 make(true,picked,input,()=>calls.push('counter'),v=>calls.push(v),m=>calls.push(m),null,null,false,null)('추가됨',{name:'부개역',lat:37.48,lng:126.73});
 assert.equal(picked.hidden,true);
 assert.deepEqual(calls,['blur','counter','map','추가됨']);
});
test('changed scripts pass syntax checks',()=>{
 for(const path of ['public/static/search-screen.js','public/static/static-map-layout.js']){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,path+'\n'+result.stderr);
 }
});
