import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('selected-place panel stays hidden on first search open and on list view',async()=>{
 const [html,css,js]=await Promise.all(['public/index.html','public/static/search-map-clarity-v82.css','public/static/search-screen.js'].map(read));
 assert.match(html,/<div class="search-picked" id="search-picked"[^>]* hidden>/);
 assert.match(css,/#search-screen #search-picked\[hidden\]\s*\{[^}]*display:none!important/);
 assert.match(css,/#search-screen\[data-search-mode="list"\] #search-picked\s*\{[^}]*display:none!important/);
 assert.match(js,/function clearPreview\([^)]*\)[\s\S]*?picked\.hidden=true;/);
 assert.match(js,/function preview\([^)]*\)[\s\S]*?picked\.hidden=false;/);
 assert.match(html,/search-map-clarity-v82\.css\?v=1\.1\.0/);
});
test('place action ignores absent selection and list mode; shows a single add on success',async()=>{
 const src=await read('public/static/search-screen.js');
 const start=src.indexOf('let addingSelection=false;');
 const end=src.indexOf("$('search-screen-back').addEventListener",start);
 assert.ok(start>0&&end>start);
 const block=src.slice(start,end);
 const button={disabled:false,textContent:'이 장소 담기'};
 let calls=0,invoke;
 const api={TripQuickAdd:{addPlace(item){calls++;invoke();return true;}}};
 const make=new Function('opened','mode','selected','endpointMode','isSavedSelection','window','$','notify','completeEndpoint',block+';return chooseAdd;');
 invoke=make(true,'map',{name:'서울역'},()=>false,false,api,()=>button,()=>{},()=>false);
 assert.equal(invoke(),true);
 assert.equal(calls,1,'a second handler invocation must not duplicate the added stop');
 assert.equal(button.disabled,true);
 const withoutSelection=make(true,'map',null,()=>false,false,api,()=>button,()=>{},()=>false);
 assert.equal(withoutSelection(),false);
 const list=make(true,'list',{name:'서울역'},()=>false,false,api,()=>button,()=>{},()=>false);
 assert.equal(list(),false);
 assert.equal(calls,1);
});
test('failed add restores button without incorrectly claiming a duplicate',async()=>{
 const src=await read('public/static/search-screen.js');
 const start=src.indexOf('let addingSelection=false;');
 const end=src.indexOf("$('search-screen-back').addEventListener",start);
 const block=src.slice(start,end),button={disabled:false,textContent:'이 장소 담기'};
 const make=new Function('opened','mode','selected','endpointMode','isSavedSelection','window','$','notify','completeEndpoint',block+';return chooseAdd;');
 const action=make(true,'map',{name:'서울역'},()=>false,false,{TripQuickAdd:{addPlace:()=>false}},()=>button,()=>{},()=>false);
 assert.equal(action(),false);
 assert.equal(button.disabled,false);
 assert.equal(button.textContent,'이 장소 담기');
 assert.doesNotMatch(block,/setTimeout\(\(\)=>\$\('search-picked-add'\)\.textContent/);
});
