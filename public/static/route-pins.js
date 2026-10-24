/** One presentation contract for Naver Maps markers in itinerary and search views.
 * Map coordinates are untouched: Kakao y -> latitude, x -> longitude.
 * The icon anchor is derived from the CSS dimensions (44x52) — no GPS offsets. */
(function(root){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const colors={origin:'#2175e6',destination:'#e64b3e',stop:'#e75b18',pending:'#2385ae',selected:'#235de2',cluster:'#395570'};
function html(place,{kind='pending',order='',count=0,selected=false}={}){
 const type=colors[kind]?kind:'pending',meta=root.TripMeta?.meta?.(place),
 svg=root.TripMeta?.icon?.(place,13)||'',cat=meta?.label||'장소';
 const text=type==='origin'?'S':type==='destination'?'E':type==='cluster'?String(count):type==='stop'?(String(order||'•')):'';
 return '<div class="yg-map-pin yg-map-pin--'+type+(selected?' yg-map-pin--selected':'')+'" style="--yg-pin-color:'+colors[type]+'">'+
  '<span class="yg-map-pin__head">'+(text?'<b>'+esc(text)+'</b>':svg)+'</span>'+
  (type==='stop'||type==='pending'?'<span class="yg-map-pin__category" title="'+esc(cat)+'">'+svg+'</span>':'')+
  '<span class="yg-map-pin__tail"></span></div>';
}
function marker(map,place,options={}){
 const maps=root.naver?.maps,lat=Number(place?.lat),lng=Number(place?.lng);
 if(!maps?.Marker||!map||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 return new maps.Marker({map,position:new maps.LatLng(lat,lng),title:String(place.name||''),zIndex:options.zIndex||100,
  icon:{content:html(place,options),anchor:new maps.Point(22,52)}});
}
root.YeoPins=Object.freeze({html,marker,colors});
})(globalThis);
