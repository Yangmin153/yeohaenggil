import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const load=async()=>new Function('window',(await read('public/static/place-role-core.js'))+';return window.YGPlaceRoles;')({});
const place=(id,name,lat,lng)=>({id,name,lat,lng,sourceId:id});
const day=()=>({date:'2026-11-04',origin:place('origin','출발지 미설정',37,127),destination:place('end','도착지 미설정',37,127),stops:[place('a','A',37.1,127),place('b','B',37.2,127),place('c','C',37.3,127)]});
test('roles convert saved stops without double-counting them as via points',async()=>{
 const roles=await load(),d=day();let x=0,uid=()=>String(++x);
 assert.equal(roles.select(d,0,'a','origin',uid).ok,true);
 assert.equal(roles.select(d,0,'c','destination',uid).ok,true);
 assert.deepEqual(d.stops.map(p=>p.name),['B']);
 assert.equal(d.origin.name,'A');assert.equal(d.destination.name,'C');
 roles.select(d,0,'b','origin',uid);
 assert.equal(d.origin.name,'B');assert.deepEqual(d.stops.map(p=>p.name),['A']);
});
test('the same location can be both start and finish, with no duplicate stop',async()=>{
 const roles=await load(),d=day();let x=0,uid=()=>String(++x);
 roles.select(d,0,'a','origin',uid);roles.select(d,0,d.origin.id,'destination',uid);
 assert.equal(d.origin.name,'A');assert.equal(d.destination.name,'A');
 assert.ok(d.stops.every(p=>p.name!=='A'));
 roles.select(d,0,d.origin.id,'stop',uid);
 assert.equal(d.stops.filter(p=>p.name==='A').length,1);
 assert.match(d.origin.name,/미설정/);assert.match(d.destination.name,/미설정/);
});
test('inherited start never becomes an unintended stop',async()=>{
 const roles=await load(),d=day();let x=0,uid=()=>String(++x);
 d.origin=place('origin','전날 도착지',37.6,127);d.originMode='inherit';
 roles.select(d,1,'a','origin',uid);
 assert.equal(d.origin.name,'A');assert.equal(d.originMode,'custom');
 assert.ok(!d.stops.some(p=>p.name==='전날 도착지'));
});
test('unified screen chooses endpoints from one saved-place popup and preserves search fallback',async()=>{
 const [html,ui,app,search,css]=await Promise.all([
 'public/index.html','public/static/vnext.js','public/static/app.js','public/static/search-screen.js',
 'public/static/step2-role-picker.css'].map(read));
 for(const id of ['yg-inline-stops','yg-role-status','search-picked-origin','search-picked-destination'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(ui,/data-chooser-place/);assert.doesNotMatch(ui,/data-assign-role/);assert.match(app,/function setCollectedRoleFromSearch/);
 assert.match(search,/function chooseRole/);
 assert.match(css,/#yg-endpoint-section\{display:none!important/);
});
