import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('지역 선택이 지도와 장소 수집보다 앞에 위치',async()=>{
 const h=await read('public/index.html');
 assert.ok(h.indexOf('class="region-onboarding"')<h.indexOf('id="trip-workspace"'));
 assert.match(h,/id="trip-region"/);assert.match(h,/id="region-confirm"/);
 assert.match(h,/id="btn-change-region"/);
});
test('선택 전 진입 차단, 직접 검색, 지역 변경 시 장소 보존',async()=>{
 const ui=await read('public/static/design-v51.js'),app=await read('public/static/app.js');
 assert.match(ui,/function ensureSelected\(\)/);assert.match(ui,/function rechoose\(\)/);
 assert.match(ui,/app\(\)\?\.setRegion\(v\)/);assert.match(ui,/\.centerMapAtRegion/);
 assert.match(app,/function setRegion\(value\)/);assert.match(app,/for\(const d of state\.days\)d\.region=region/);
});
test('검색 입력 응답은 취소와 재사용 캐시로 최적화',async()=>{
 const quick=await read('public/static/quick-add.js');
 assert.match(quick,/TTL=45000,LIMIT=36/);assert.match(quick,/AbortController/);
 assert.match(quick,/cache\.set\(path/);assert.match(quick,/current!==sequence/);
});
test('장소 중복 추가를 막고 검색 선택 후 STEP 2로 돌아옴',async()=>{
 const quick=await read('public/static/quick-add.js'),search=await read('public/static/search-screen.js');
 assert.match(quick,/if\(duplicate\)\{feedback/);
 assert.match(quick,/return true;/);
 assert.match(search,/function addSuccess\(message,place=null,addedId=null\)/);
 assert.match(search,/function showMode\(next\)/);
});
