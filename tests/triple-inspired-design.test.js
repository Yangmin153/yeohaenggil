import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Triple-inspired theme applies after legacy styles without replacing core scripts',async()=>{
 const html=await read('public/index.html');
 assert.match(html,/\/static\/triple-inspired\.css\?v=1\.0\.0/);
 assert.ok(html.indexOf('route-pins.css')<html.indexOf('triple-inspired.css'));
 for(const script of ['app.js','quick-add.js','search-screen.js','vnext.js','accounts.js','navigation.js']){
  assert.match(html,new RegExp('src="/static/'+script.replace('.','\\.')+'\\?v='));
 }
});
test('STEP1 keeps real native date inputs, introduces original travel card',async()=>{
 const html=await read('public/index.html');
 for(const id of ['yg-step-one','yg-start-date','yg-end-date','yg-duration','yg-next-places','yg-trip-showcase']){
  if(id==='yg-trip-showcase')assert.match(html,/class="yg-trip-showcase"/);
  else assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.ok(html.indexOf('id="yg-start-date"')<html.indexOf('id="yg-next-places"'));
 assert.ok(html.indexOf('id="yg-next-places"')<html.indexOf('yg-trip-showcase'));
 assert.doesNotMatch(html,/step1-promo\.js/);
});
test('STEP2 search, day selection, endpoints and optimization keep their original handlers',async()=>{
 const html=await read('public/index.html');
 for(const id of ['yg-active-date','yg-add-visit','yg-open-stops','yg-origin-pick','yg-dest-pick','yg-calculate']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 const vnext=await read('public/static/vnext.js');
 assert.match(vnext,/\$\('yg-calculate'\)\.addEventListener\('click',calculate\)/);
 assert.match(vnext,/\$\('yg-next-places'\)\.addEventListener\('click',\(\)=>go\(2\)\)/);
});
test('result intro appears only on STEP3 and preserves map/timeline containers',async()=>{
 const [html,css]=await Promise.all(['public/index.html','public/static/triple-inspired.css'].map(read));
 assert.match(css,/not\(\[data-trip-step="3"\]\) \.yg-trip-result-intro\{display:none!important\}/);
 for(const id of ['map-region','route-results','timeline','yg-route-adjust','yg-nav-open','yg-step-three-actions']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('mobile theme is accessible, with minimum 12px type, reduced motion and safe-area footer',async()=>{
 const css=await read('public/static/triple-inspired.css');
 assert.match(css,/Pretendard/);
 assert.match(css,/letter-spacing:-\.03em/);
 assert.match(css,/font-size:12px!important;line-height:1\.5!important/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/#[0-9a-fA-F]{6}/);
 assert.match(css,/body\[data-trip-step="2"\] #yg-step-two-actions/);
 assert.match(css,/body\[data-trip-step="3"\] #yg-step-three-actions/);
});
