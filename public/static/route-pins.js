/** One presentation contract for Naver Maps markers in itinerary and search views.
 * Map coordinates are untouched: Kakao y -> latitude, x -> longitude.
 * The icon anchor is derived from the CSS dimensions (44x52) — no GPS offsets. */
(function(root){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const colors={origin:'#2175e6',destination:'#e64b3e',stop:'#e75b18',pending:'#2385ae',selected:'#235de2',cluster:'#395570',both:'#6157a2'};
function html(place,{kind='pending',order='',count=0,selected=false}={}){
 const type=colors[kind]?kind:'pending',meta=root.TripMeta?.meta?.(place),
 svg=root.TripMeta?.icon?.(place,13)||'',cat=meta?.label||'장소';
 const text=type==='origin'?'출발':type==='destination'?'도착':type==='both'?'출발·도착':type==='cluster'?String(count):type==='stop'?(String(order||'•')):'';
 return '<div class="yg-map-pin yg-map-pin--'+type+(selected?' yg-map-pin--selected':'')+'" style="--yg-pin-color:'+colors[type]+'">'+
  '<span class="yg-map-pin__head">'+(type==='both'?'<b aria-label="출발·도착"><span>출발</span><span>도착</span></b>':text?'<b>'+esc(text)+'</b>':svg)+'</span>'+
  (type==='stop'||type==='pending'?'<span class="yg-map-pin__category" title="'+esc(cat)+'">'+svg+'</span>':'')+
  '<span class="yg-map-pin__tail"></span></div>';
}
function coincident(a,b){
 if(!a||!b)return false;
 const ax=Number(a.lat),ay=Number(a.lng),bx=Number(b.lat),by=Number(b.lng);
 return [ax,ay,bx,by].every(Number.isFinite)&&Math.abs(ax-bx)<0.00003&&Math.abs(ay-by)<0.00003;
}
// A numerical cluster is not an accurate label when both endpoints occupy
// the same GPS location. Do not confuse nearby-but-distinct stops with endpoints.
function overlapRole(group,origin,destination){
 // Clearing an endpoint intentionally retains its old coordinates for a future
 // search. Coordinates alone MUST NOT make an unassigned endpoint look active.
 const assigned=p=>Boolean(p&&typeof p.name==='string'&&p.name.trim()&&!/미설정/.test(p.name)&&
  Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
 if(!Array.isArray(group)||!assigned(origin)||!assigned(destination)||!coincident(origin,destination))return null;
 const places=group.map(entry=>entry?.place||entry).filter(Boolean);
 return places.some(place=>coincident(place,origin))&&places.some(place=>coincident(place,destination))?'both':null;
}
function marker(map,place,options={}){
 const maps=root.naver?.maps,lat=Number(place?.lat),lng=Number(place?.lng);
 if(!maps?.Marker||!map||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 return new maps.Marker({map,position:new maps.LatLng(lat,lng),title:String(place.name||'')+(options.kind==='both'?' · 출발·도착':''),zIndex:options.zIndex||100,
  icon:{content:html(place,options),anchor:new maps.Point(22,52)}});
}
root.YeoPins=Object.freeze({html,marker,colors,coincident,overlapRole});
})(globalThis);
