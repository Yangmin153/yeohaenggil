import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/static/scroll-lock.js',import.meta.url),'utf8');
function setup(){
 const style=()=>({position:'',top:'',left:'',right:'',width:'',overflow:'auto',overscrollBehavior:'contain',scrollBehavior:'smooth',setProperty(k,v){this[k]=v;}});
 const calls=[],events={};
 const root={document:{body:{style:style()},documentElement:{style:style()}},scrollY:624,innerHeight:844,
 scrollTo(v){calls.push(v);},visualViewport:{height:510,offsetTop:24,addEventListener(k,v){events[k]=v;}}};
 vm.runInNewContext(source,root);return {root,calls,events,lock:root.YGScrollLock};
}
test('nested overlays retain the original scroll offset until the final owner closes',()=>{
 const {root,calls,lock}=setup();lock.lock('search');lock.lock('search');root.scrollY=0;lock.lock('list');
 assert.equal(root.document.body.style.top,'-624px');lock.unlock('search');lock.unlock('unknown');
 assert.equal(lock.active(),true);assert.equal(calls.length,0);lock.unlock('list');
 assert.equal(lock.active(),false);assert.equal(calls[0].top,624);assert.equal(calls[0].behavior,'instant');
 assert.equal(root.document.body.style.position,'');assert.equal(root.document.body.style.overflow,'auto');
 assert.equal(root.document.documentElement.style.scrollBehavior,'smooth');
 assert.equal(root.document.documentElement.style.overscrollBehavior,'contain');
});
test('keyboard viewport dimensions update on resize and scroll without changing saved page offset',()=>{
 const {root,events,lock}=setup();lock.lock('account');root.visualViewport.height=320;root.visualViewport.offsetTop=60;events.resize();events.scroll();
 assert.equal(root.document.documentElement.style['--yg-viewport-height'],'320px');
 assert.equal(root.document.documentElement.style['--yg-viewport-top'],'60px');
 assert.equal(root.document.body.style.top,'-624px');
});
