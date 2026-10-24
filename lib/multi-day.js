/** Multi-day allocation: keep fixed dates, insert flexible stops by extra driving-cost proxy.
 * Coordinates are WGS84: lat=y, lng=x (Kakao). Directions path uses [lng, lat]. */
import {buildPlan,km,roadLeg,ready} from './core.js';
const MAX_DAYS=10,MAX_STOPS=30;
const validPlace=p=>p&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=100&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=100&&
 typeof p.lat==='number'&&Math.abs(p.lat)<=90&&typeof p.lng==='number'&&Math.abs(p.lng)<=180&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const minutes=(a,b)=>km(a,b)*1.33/42*60+(km(a,b)>0.005?4:0);
function validateTrip(value){
 if(!value||!Array.isArray(value.days)||value.days.length<1||value.days.length>MAX_DAYS||
  !Array.isArray(value.stops)||value.stops.length>MAX_STOPS)return '여행일은 1~10일, 방문지는 최대 30곳까지 설정할 수 있습니다.';
 const dates=value.days.map(d=>d.date);
 if(new Set(dates).size!==dates.length||!dates.every(validDate)||!dates.every((d,i)=>i===0||Date.parse(d+'T00:00:00Z')-Date.parse(dates[i-1]+'T00:00:00Z')===86400000))
  return '여행 날짜는 시작일부터 연속된 날짜여야 합니다.';
 if(!value.days.every(d=>validPlace(d.origin)&&validPlace(d.destination)&&!/미설정/.test(d.origin.name+d.destination.name)))
  return '각 날짜의 출발지·마지막 도착지를 지정해 주세요.';
 if(!value.stops.every(s=>validPlace(s)&&(!s.fixedDate||validDate(s.fixedDate)))||new Set(value.stops.map(s=>s.id)).size!==value.stops.length)
  return '방문지와 고정 날짜 정보를 확인하세요.';
 if(value.stops.some(s=>s.fixedDate&&!dates.includes(s.fixedDate)))return '여행 기간 밖에 고정한 장소가 있습니다. 날짜를 다시 지정해 주세요.';
 return null;
}
function minimumInsertion(places,stop,origin,end){
 const line=[origin,...places,end];let best=Infinity;
 for(let i=1;i<line.length;i++)best=Math.min(best,minutes(line[i-1],stop)+minutes(stop,line[i])-minutes(line[i-1],line[i]));
 return Math.max(0,best);
}
/** Deterministic assignment with endpoint detour + count balance. Does not assert global optimality. */
function allocateTrip(trip){
 const buckets=trip.days.map(()=>[]),dates=trip.days.map(d=>d.date);
 for(const place of trip.stops)if(place.fixedDate)buckets[dates.indexOf(place.fixedDate)].push(place);
 const flexible=trip.stops.filter(s=>!s.fixedDate);
 // Assign hardest-to-place points first to avoid isolating remote locations.
 flexible.sort((a,b)=>{
  const spread=p=>Math.min(...trip.days.map(d=>minutes(d.origin,p)+minutes(p,d.destination)-minutes(d.origin,d.destination)));
  return spread(b)-spread(a);
 });
 for(const place of flexible){
  let best=Infinity,winner=0;
  for(let i=0;i<trip.days.length;i++){
   if(buckets[i].length>=MAX_STOPS)continue;
   const d=trip.days[i],base=minutes(d.origin,d.destination),added=minimumInsertion(buckets[i],place,d.origin,d.destination);
   const travel=base+added;
   const count=buckets[i].length;
   // Workload balance: count penalty and travel minutes, without imaginary sightseeing duration.
   const score=added+0.24*travel+count*18+count*count*3;
   if(score<best){best=score;winner=i;}
  }
  buckets[winner].push(place);
 }
 return buckets;
}
async function runMultiDay(trip,env){
 const problem=validateTrip(trip);if(problem)throw new Error(problem);
 const buckets=allocateTrip(trip);
 const results=Array(trip.days.length);
 // Restrict concurrent day-level route jobs to two to avoid a NAVER API call stampede.
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(2,trip.days.length)},async()=>{
  while(cursor<trip.days.length){
   const i=cursor++,d=trip.days[i],stops=buckets[i].map(s=>({...s,locked:false}));
   const route=await buildPlan({origin:d.origin,destination:d.destination,stops,mode:'auto',departure:'09:00'},env);
   results[i]={date:d.date,assignedStopIds:stops.map(s=>s.id),route};
  }
 }));
 const drive=results.map(r=>r.route.drivingMinutes),max=Math.max(...drive),min=Math.min(...drive);
 const warnings=['미지정 방문지는 날짜별 출발·도착지, 지역적 거리 및 방문지 수를 고려한 근사 배정입니다. 실제 자동차 이동시간은 날짜별 경로 계산 결과를 확인하세요.'];
 if(max>240||max-min>150)warnings.push('특정 날짜의 자동차 이동시간이 길거나 날짜별 편차가 큽니다. 고정 날짜를 조정해 보세요.');
 if(results.some(r=>r.assignedStopIds.length>12))warnings.push('한 날짜에 방문지가 12곳 넘게 배정되었습니다. 체류시간은 포함하지 않으므로 실제 일정 여유를 확인하세요.');
 if(!ready(env))warnings.push('네이버 길찾기 키가 없어 자동차 경로 시간이 추정치입니다.');
 return {days:results,warnings,assignmentMethod:'detour_distance_and_balance_heuristic',calculatedAt:new Date().toISOString()};
}
export {MAX_DAYS,MAX_STOPS,validateTrip,allocateTrip,runMultiDay};
