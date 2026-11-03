/* STEP 2 role transfers preserve the existing itinerary data format. */
(function(root){
'use strict';
const configured=p=>Boolean(p&&typeof p.name==='string'&&!/미설정/.test(p.name)&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
const same=(a,b)=>Boolean(a&&b&&((a.sourceId&&b.sourceId&&a.sourceId===b.sourceId)||(Math.abs(Number(a.lat)-Number(b.lat))<0.00003&&Math.abs(Number(a.lng)-Number(b.lng))<0.00003&&String(a.name||'')===String(b.name||''))));
const roleOf=(d,id)=>d.stops.some(p=>p.id===id)?'stop':configured(d.origin)&&d.origin.id===id?'origin':configured(d.destination)&&d.destination.id===id?'destination':null;
const blank=(old,role,uid)=>({id:old?.id||uid(),name:role==='origin'?'출발지 미설정':'도착지 미설정',lat:Number(old?.lat)||36.35,lng:Number(old?.lng)||127.9,locked:false});
const asStop=(p,d,uid)=>({...p,id:uid(),locked:false,fixedDate:d.date||null});
const fail=error=>({ok:false,error});
function select(d,index,id,target,uid){
 if(!d||!Array.isArray(d.stops)||!['stop','origin','destination'].includes(target))return fail('올바른 장소 역할을 선택해 주세요.');
 const from=roleOf(d,id);
 if(!from)return fail('해당 날짜의 장소를 찾지 못했어요.');
 if(from===target)return {ok:true,changed:false,id};
 if(from==='origin'&&index>0&&d.originMode!=='custom')return fail('이어받은 출발지는 다른 장소를 선택해 변경해 주세요.');
 const chosen=from==='stop'?d.stops.find(p=>p.id===id):d[from];
 if(target==='stop'){
  if(d.stops.length>=30&&!d.stops.some(p=>same(p,chosen)))return fail('방문지는 하루 최대 30곳까지 담을 수 있어요.');
  if(!d.stops.some(p=>same(p,chosen)))d.stops.push(asStop(chosen,d,uid));
  d[from]=blank(d[from],from,uid);
  if(from!=='stop'&&configured(d[from==='origin'?'destination':'origin'])&&same(chosen,d[from==='origin'?'destination':'origin'])){
   const partner=from==='origin'?'destination':'origin';
   d[partner]=blank(d[partner],partner,uid);
  }
  if(from==='origin'&&index>0)d.originMode='custom';
  return {ok:true,changed:true,id:d.stops.find(p=>same(p,chosen))?.id||null,from,to:target};
 }
 const opposite=target==='origin'?'destination':'origin';
 if(from==='stop'){
  const previous=d[target],inherited=target==='origin'&&index>0&&d.originMode!=='custom';
  d.stops=d.stops.filter(p=>p.id!==id);
  d[target]={...chosen,id:previous.id};
  if(configured(previous)&&!inherited&&!same(previous,d[opposite])&&!d.stops.some(p=>same(p,previous)))d.stops.push(asStop(previous,d,uid));
  if(target==='origin'&&index>0)d.originMode='custom';
  return {ok:true,changed:true,id:d[target].id,from,to:target};
 }
 const previous=d[target],inherited=target==='origin'&&index>0&&d.originMode!=='custom';
 if(configured(previous)&&same(previous,chosen))return {ok:true,changed:false,id:previous.id};
 if(configured(previous)&&!inherited&&!d.stops.some(p=>same(p,previous))){
  if(d.stops.length>=30)return fail('방문지는 하루 최대 30곳까지 담을 수 있어요.');
  d.stops.push(asStop(previous,d,uid));
 }
 d[target]={...chosen,id:previous.id};
 if(index>0&&target==='origin')d.originMode='custom';
 return {ok:true,changed:true,id:d[target].id,from,to:target};
}
function remove(d,index,id,uid){
 if(!d||!Array.isArray(d.stops))return fail('일정을 확인할 수 없어요.');
 const from=roleOf(d,id);
 if(!from)return fail('삭제할 장소를 찾지 못했어요.');
 if(from==='origin'&&index>0&&d.originMode!=='custom')return fail('이어받은 출발지는 먼저 다른 장소로 변경해 주세요.');
 if(from==='stop')d.stops=d.stops.filter(p=>p.id!==id);
 else{
  const previous=d[from];d[from]=blank(previous,from,uid);
  const partner=from==='origin'?'destination':'origin';
  if(configured(d[partner])&&same(previous,d[partner]))d[partner]=blank(d[partner],partner,uid);
  if(from==='origin'&&index>0)d.originMode='custom';
 }
 return {ok:true,changed:true,from};
}
root.YGPlaceRoles=Object.freeze({configured,same,roleOf,select,remove});
})(window);
