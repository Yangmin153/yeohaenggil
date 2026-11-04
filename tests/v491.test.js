import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('fullscreen search reuses one search input and one results list',async()=>{
 const html=await read('public/index.html'),js=await read('public/static/search-screen.js');
 for(const id of ['search-screen','search-map-stage','search-naver-map','search-list-toggle','search-picked-add'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.equal((html.match(/id="quick-input"/g)||[]).length,1);
 assert.equal((html.match(/id="quick-results"/g)||[]).length,1);
 assert.match(js,/original\.insertBefore\(form/);assert.match(js,/history\.pushState/);
});
test('search results select a map pin before adding, with clear duplicate handling',async()=>{
 const js=await read('public/static/search-screen.js'),q=await read('public/static/quick-add.js');
 assert.match(js,/function preview\(item,source='result'\)/);assert.match(js,/function paintMarkers\(\)/);
 assert.match(js,/TripQuickAdd\?\.addPlace\?\.\(chosen\)/);
 assert.match(q,/if\(duplicate\)\{feedback/);assert.match(q,/YeoSearch\?\.onResults/);
});
test('search screen traps background scroll and restores position',async()=>{
 const js=await read('public/static/search-screen.js'),css=await read('public/static/design-v53.css');
 assert.match(js,/YGScrollLock\?\.lock\('search-screen'\)/);
 assert.match(js,/YGScrollLock\?\.unlock\('search-screen'\)/);
 const lock=await read('public/static/scroll-lock.js');
 assert.match(lock,/body\.style\.position='fixed'/);
 assert.match(lock,/root\.scrollTo\(\{top:saved\.y,behavior:'instant'\}\)/);
 assert.match(css,/overscroll-behavior:contain/);
});
test('route calculation opens results only after success',async()=>{
 const js=await read('public/static/app.js');
 assert.match(js,/let calculationSucceeded=false/);
 assert.match(js,/calculationSucceeded=true/);
 assert.match(js,/if\(calculationSucceeded&&day\(\)\.result&&day\(\)\.id===dayId\)/);
});
