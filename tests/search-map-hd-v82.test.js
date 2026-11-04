import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {GET as staticMap} from '../api/static-map.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const place='37.566500%2C126.978000';
const request=more=>new Request('https://example.com/api/static-map?p='+place+'&f='+place+'&w=390&h=460&z=13'+(more||''));

test('server forwards Naver high-resolution scale=2 without inflating map width or zoom',async()=>{
 const beforeFetch=globalThis.fetch;
 const oldId=process.env.NAVER_MAPS_CLIENT_ID,oldSecret=process.env.NAVER_MAPS_CLIENT_SECRET;
 let called=null;
 try{
  process.env.NAVER_MAPS_CLIENT_ID='local-fixture-id';
  process.env.NAVER_MAPS_CLIENT_SECRET='local-fixture-secret';
  globalThis.fetch=async(url,options)=>{
   called={url:new URL(url),options};
   return new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{'content-type':'image/png'}});
  };
  const res=await staticMap(request('&s=2'));
  assert.equal(res.status,200);
  assert.ok(called);
  assert.equal(called.url.searchParams.get('scale'),'2');
  assert.equal(called.url.searchParams.get('w'),'390');
  assert.equal(called.url.searchParams.get('h'),'460');
  assert.equal(called.url.searchParams.get('level'),'13');
  assert.equal(called.url.searchParams.get('format'),'png');
  assert.equal(called.options.headers['x-ncp-apigw-api-key-id'],'local-fixture-id');
 }finally{
  globalThis.fetch=beforeFetch;
  if(oldId===undefined)delete process.env.NAVER_MAPS_CLIENT_ID;else process.env.NAVER_MAPS_CLIENT_ID=oldId;
  if(oldSecret===undefined)delete process.env.NAVER_MAPS_CLIENT_SECRET;else process.env.NAVER_MAPS_CLIENT_SECRET=oldSecret;
 }
});
test('server rejects unsupported scale values before requesting a map',async()=>{
 for(const scale of ['0','3','abc','-1']){
  const res=await staticMap(request('&s='+scale));
  assert.equal(res.status,422);
 }
});
test('search preview uses exact viewport sizing, high DPI and a cancellable resize-aware image request',async()=>{
 const src=await read('public/static/search-screen.js');
 assert.match(src,/devicePixelRatio>=1\.5\?'2':'1'/);
 assert.match(src,/z:'13',s:density/);
 assert.match(src,/const box=mapStage\.getBoundingClientRect\(\)/);
 assert.match(src,/Math\.abs\(Math\.min\(1024,now\.height\)-height\)>2/);
 assert.match(src,/queueStaticFallback\(120\)/);
 assert.match(src,/new ResizeObserver\(/);
 assert.match(src,/request===staticSerial/);
 assert.match(src,/image\.src=url/);
 assert.match(src,/document\.addEventListener\('trip-maps-auth-failed'/);
 assert.match(src,/p:focus\.x\.toFixed\(6\)/);
});
test('STEP2 map requests twice-resolution tiles and survives Preview Dynamic Maps authorization errors',async()=>{
 const [fallback,app,style]=await Promise.all([
  read('public/static/step2-map-fallback.js'),
  read('public/static/app.js'),
  read('public/static/search-map-clarity-v82.css')
 ]);
 assert.match(fallback,/s:density/);
 assert.match(fallback,/Math\.abs\(nowW-w\)>2/);
 assert.match(fallback,/forceStatic=true/);
 assert.match(app,/new Event\('trip-maps-auth-failed'\)/);
 assert.match(style,/object-fit:contain!important/);
 assert.match(style,/width:min\(100%,1024px\)/);
});
test('selected-place buttons emphasize one primary CTA and a two-column role row',async()=>{
 const [html,style,screen]=await Promise.all([
  read('public/index.html'),read('public/static/search-map-clarity-v82.css'),read('public/static/search-screen.js')
 ]);
 const section=html.slice(html.indexOf('<div class="search-picked"'),html.indexOf('id="search-screen-results-mount"'));
 const head=section.indexOf('class="search-picked-heading"'),actions=section.indexOf('class="search-picked-actions"');
 assert.ok(head>=0&&actions>head);
 assert.ok(section.indexOf('id="search-picked-cancel"')<actions);
 assert.ok(section.indexOf('id="search-picked-add"')<section.indexOf('class="search-picked-role-row"'));
 assert.ok(section.includes('id="search-picked-origin"')&&section.includes('id="search-picked-destination"'));
 assert.match(style,/#search-screen \.search-picked-actions #search-picked-add/);
 assert.match(style,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(screen,/showRoleOptions\(\)/);
 assert.match(html,/search-map-clarity-v82\.css\?v=1\.1\.0/);
});
test('all changed scripts pass Node syntax checks',()=>{
 for(const p of ['public/static/app.js','public/static/search-screen.js','public/static/step2-map-fallback.js','api/static-map.js']){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(r.status,0,p+'\n'+r.stderr);
 }
});
