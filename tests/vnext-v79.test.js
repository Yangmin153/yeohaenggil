import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('fullscreen search toolbar is between form and map, never floating over the map',async()=>{
 const [html,css]=await Promise.all(['public/index.html','public/static/design-v53.css'].map(read));
 const at=id=>html.indexOf('id="'+id+'"');
 assert.ok(at('search-screen-form-mount')<at('search-screen-toolbar'));
 assert.ok(at('search-screen-toolbar')<at('search-area-tools'));
 assert.ok(at('search-area-tools')<at('search-map-stage'));
 assert.match(css,/\.search-screen-toolbar\{display:flex/);
 assert.match(css,/\.search-screen-toolbar button:not\(\[hidden\]\)\{position:static!important/);
 assert.doesNotMatch(css,/\.search-list-toggle\{position:absolute/);
 assert.doesNotMatch(css,/padding-top:48px!important/);
});
test('one cancellable preview works for search results while map tapping never selects a place',async()=>{
 const [html,script]=await Promise.all(['public/index.html','public/static/search-screen.js'].map(read));
 assert.match(html,/id="search-picked-cancel"/);
 assert.match(script,/function clearPreview\(\{restoreCamera=true\}/);
 assert.match(script,/searchMap\.setCenter\(previewCamera\.center\)/);
 assert.match(script,/if\(opened\)paintMarkers\(\)/);
 assert.match(script,/selectedMarker=mark\(selected,true\)/);
 assert.match(script,/\$\('search-picked-cancel'\)\.addEventListener\('click',\(\)=>clearPreview\(\)\)/);
 assert.doesNotMatch(script,/preview\(\{id:'manual-'/);
 assert.doesNotMatch(script,/maps\.Event\.addListener\(searchMap,'click'/);
 assert.match(script,/clearPreview\(\{restoreCamera:false\}\)/);
});
test('add click keeps place search visible for the next query; map preview remains optional',async()=>{
 const [quick,screen]=await Promise.all(['public/static/quick-add.js','public/static/search-screen.js'].map(read));
 assert.match(quick,/addSuccess\?\.\(item\.name[^\n]*item\)/);
 assert.match(screen,/function focusAdded\(item\)/);
 assert.match(screen,/previewSource='added'/);
 assert.match(screen,/searchMap\.panTo\(new window\.naver\.maps\.LatLng/);
 assert.match(screen,/showMode\('list'\)/);
 assert.match(screen,/input\.focus\(\{preventScroll:true\}\)/);
 assert.match(screen,/if\(returnStep===3/);
 assert.match(quick,/app\.previewPlace\(item\)/);
});
test('endpoint search result instantly sets endpoint without choosing map coordinates',async()=>{
 const [quick,screen]=await Promise.all(['public/static/quick-add.js','public/static/search-screen.js'].map(read));
 assert.match(quick,/YeoSearch\.completeEndpoint\(item\)/);
 assert.match(screen,/function completeEndpoint\(item\)/);
 assert.match(screen,/setEndpointFromSearch\?\.\(kind,item\)/);
 assert.match(screen,/show\('destination'\)/);
});
test('popup and result mode preserve background lock and keyboard-friendly scrolling',async()=>{
 const [screen,style]=await Promise.all(['public/static/search-screen.js','public/static/vnext.css'].map(read));
 assert.match(screen,/YGScrollLock\?\.lock\('search-screen'\)/);
 assert.match(screen,/YGScrollLock\?\.unlock\('search-screen'\)/);
 assert.match(screen,/lockBackground\(\)/);
 assert.match(screen,/unlockBackground\(\)/);
 assert.match(style,/overflow-y:auto!important;overflow-x:hidden!important/);
});
test('search UI strings are explicit and buttons have minimum 44px target',async()=>{
 const [html,css,screen]=await Promise.all(['public/index.html','public/static/design-v53.css','public/static/search-screen.js'].map(read));
 assert.match(html,/id="search-list-toggle"/);
 assert.match(html,/id="search-global-results"/);
 assert.match(css,/min-height:44px/);
 assert.match(screen,/textContent='담은 장소 보기'/);
 assert.match(html,/search-screen\.js\?v=7\.12\.0/);
});
