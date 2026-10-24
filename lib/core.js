/**
 * 여행길 — Vercel Node.js Functions용 공통 경로 엔진.
 * 출발지/관광지/도착지와 네이버 도로 이동시간을 기준으로 방문 순서를 계산합니다.
 * Credentials are read ONLY from server-side environment (never sent to the browser).
 */
const DIRECTION_API = 'https://maps.apigw.ntruss.com/map-direction/v1/driving';
const GEOCODE_API = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (value, status=200) => new Response(JSON.stringify(value), {status,headers:JSON_HEADERS});
const err = (message, status=400) => json({detail:message},status);
const ready = env => Boolean(env.NAVER_MAPS_CLIENT_ID && env.NAVER_MAPS_CLIENT_SECRET);
const headers = env => ({'x-ncp-apigw-api-key-id':env.NAVER_MAPS_CLIENT_ID,'x-ncp-apigw-api-key':env.NAVER_MAPS_CLIENT_SECRET,'accept':'application/json'});
const goodPlace = p => p && typeof p.id==='string' && p.id.length>0 && p.id.length<=100 && typeof p.name==='string' && p.name.trim().length>0 && p.name.length<=100 && typeof p.lat==='number' && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && typeof p.lng==='number' && Number.isFinite(p.lng) && Math.abs(p.lng)<=180 && (p.locked===undefined || typeof p.locked==='boolean');
function validatePlan(p){
  if (!p || !goodPlace(p.origin) || !goodPlace(p.destination) || !Array.isArray(p.stops) || p.stops.length>30 || !p.stops.every(goodPlace)) return '출발지·도착지·관광지 정보를 확인하세요 (최대 30곳).';
  if (!['auto','manual'].includes(p.mode) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.departure||'')) return '경로 모드와 출발 시간을 확인하세요.';
  if (new Set(p.stops.map(s=>s.id)).size!==p.stops.length) return '관광지 ID가 중복되었습니다.';
  return null;
}
function km(a,b){const R=Math.PI/180,dlat=(b.lat-a.lat)*R,dlng=(b.lng-a.lng)*R,u=Math.sin(dlat/2)**2+Math.cos(a.lat*R)*Math.cos(b.lat*R)*Math.sin(dlng/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(u)));}
function estimate(a,b){const distance=km(a,b)*1.33;return {durationMinutes:Math.round((distance/42*60+(distance>0?4:0))*10)/10,distanceMeters:Math.round(distance*1000),path:[[a.lng,a.lat],[b.lng,b.lat]],source:'estimate'};}
const coordinates = p => `${p.lng.toFixed(7)},${p.lat.toFixed(7)}`;
async function roadLeg(a,b,env){
  if (km(a,b)<0.005) return {durationMinutes:0,distanceMeters:0,path:[[a.lng,a.lat]],source:'same_point'};
  if (!ready(env)) return estimate(a,b);
  try {
    const u=new URL(DIRECTION_API);u.searchParams.set('start',coordinates(a));u.searchParams.set('goal',coordinates(b));u.searchParams.set('option','traoptimal');
    const res=await fetch(u,{headers:headers(env),signal:AbortSignal.timeout(5500)});
    if(!res.ok) throw new Error('네이버 API 응답 오류 '+res.status);
    const body=await res.json(), route=body?.route?.traoptimal?.[0];
    if(body?.code!==0||!route||!Number.isFinite(route.summary?.duration)||!Number.isFinite(route.summary?.distance))throw Error('길찾기 결과 없음');
    const path=Array.isArray(route.path)&&route.path.length>0?route.path:[[a.lng,a.lat],[b.lng,b.lat]];
    return {durationMinutes:Math.round(route.summary.duration/6000)/10,distanceMeters:route.summary.distance,path,source:'naver'};
  } catch {return estimate(a,b);}
}
async function withConcurrency(items, max, fn){
  let next=0;const results=Array(items.length);
  const pool=Array.from({length:Math.min(max,items.length)}, async()=>{while(next<items.length){const i=next++;results[i]=await fn(items[i],i);}});
  await Promise.all(pool);return results;
}
function optimalMatrix(n,stopPlaces,origin,destination,legMap){
  const fixed=new Map(stopPlaces.map((p,i)=>[i,p.locked?i+1:null]).filter(x=>x[1]!==null));
  const free=stopPlaces.map((_,i)=>i+1).filter((_,i)=>!fixed.has(i));
  let best=Infinity,bestOrder=null;
  const routeCost=order=>{const full=[0,...order,n+1];let v=0;for(let k=0;k<full.length-1;k++)v+=legMap.get(`${full[k]}:${full[k+1]}`).durationMinutes;return v;};
  const recurse=(depth,remaining,order)=>{
    if(depth===n){const c=routeCost(order);if(c<best){best=c;bestOrder=[...order];}return;}
    if(fixed.has(depth)){order.push(fixed.get(depth));recurse(depth+1,remaining,order);order.pop();return;}
    for(let j=0;j<remaining.length;j++){order.push(remaining[j]);recurse(depth+1,remaining.slice(0,j).concat(remaining.slice(j+1)),order);order.pop();}
  };
  recurse(0,free,[]);return bestOrder||[];
}
function heuristicOrder(stops,origin,destination){
  const assigned=stops.map((s,i)=>s.locked?i:null);const remaining=stops.map((_,i)=>i).filter(i=>!stops[i].locked);
  let prev=origin;
  for(let i=0;i<assigned.length;i++){
    if(assigned[i]!==null){prev=stops[assigned[i]];continue;}
    let anchor=destination;for(let j=i+1;j<assigned.length;j++){if(assigned[j]!==null){anchor=stops[assigned[j]];break;}}
    let bestIndex=0,best=Infinity;for(let j=0;j<remaining.length;j++){
      const s=stops[remaining[j]],value=km(prev,s)+0.4*km(s,anchor);
      if(value<best){best=value;bestIndex=j;}
    }
    assigned[i]=remaining.splice(bestIndex,1)[0];prev=stops[assigned[i]];
  }
  const cost=order=>{let sum=0,p=origin;for(const ix of order){sum+=km(p,stops[ix]);p=stops[ix];}return sum+km(p,destination);};
  let best=cost(assigned);
  for(let iter=0;iter<5;iter++){
    let improved=false;
    for(let i=0;i<assigned.length;i++)for(let j=i+1;j<assigned.length;j++){
      if(assigned.slice(i,j+1).some(ix=>stops[ix].locked))continue;
      const alternative=assigned.slice(0,i).concat(assigned.slice(i,j+1).reverse(),assigned.slice(j+1));const c=cost(alternative);
      if(c+1e-8<best){assigned.splice(0,assigned.length,...alternative);best=c;improved=true;}
    }
    if(!improved) break;
  }
  return assigned.map(i=>i+1);
}
function timeAt(start,totalMinutes){const [hours,minutes]=start.split(':').map(Number);const count=hours*60+minutes+Math.round(totalMinutes),day=Math.floor(count/1440),local=((count%1440)+1440)%1440;return `${String(Math.floor(local/60)).padStart(2,'0')}:${String(local%60).padStart(2,'0')}${day?` (+${day}일)`:''}`;}
async function buildPlan(p,env){
  const n=p.stops.length,all=[p.origin,...p.stops,p.destination],matrix=new Map();
  const exactLimit=Math.min(6,Math.max(0,Number.isFinite(+env.MAX_EXACT_STOPS)?+env.MAX_EXACT_STOPS:4));
  const exact=p.mode==='auto'&&n<=exactLimit;
  const pairs=[];
  if(exact){
    if(!n) pairs.push([0,n+1]);
    for(let i=1;i<=n;i++){pairs.push([0,i],[i,n+1]);for(let j=1;j<=n;j++)if(i!==j)pairs.push([i,j]);}
  }
  const result=await withConcurrency(pairs,5,async([i,j])=>roadLeg(all[i],all[j],env));
  pairs.forEach(([i,j],k)=>matrix.set(`${i}:${j}`,result[k]));
  const order=p.mode==='manual'?p.stops.map((_,i)=>i+1):exact?optimalMatrix(n,p.stops,p.origin,p.destination,matrix):heuristicOrder(p.stops,p.origin,p.destination);
  const seq=[0,...order,n+1],missing=[];
  for(let i=0;i<seq.length-1;i++)if(!matrix.has(`${seq[i]}:${seq[i+1]}`))missing.push([seq[i],seq[i+1]]);
  const more=await withConcurrency(missing,5,async([i,j])=>roadLeg(all[i],all[j],env));
  missing.forEach(([i,j],k)=>matrix.set(`${i}:${j}`,more[k]));
  let elapsed=0,driving=0,distance=0,road=0,estimated=0;
  const entries=[{kind:'origin',place:p.origin,arrival:p.departure,departure:p.departure,leg:null}];
  for(let i=0;i<seq.length-1;i++){
    const j=seq[i+1],leg=matrix.get(`${seq[i]}:${j}`);elapsed+=leg.durationMinutes;driving+=leg.durationMinutes;distance+=leg.distanceMeters;
    if(leg.source==='naver')road++;if(leg.source==='estimate')estimated++;
    const isEnd=j===n+1,place=all[j],arrival=timeAt(p.departure,elapsed);
    entries.push({kind:isEnd?'destination':'stop',place,arrival,departure:timeAt(p.departure,elapsed),leg});
  }
  const anyEstimated=[...matrix.values()].some(r=>r.source==='estimate');
  let baselineDrivingMinutes=null,savedMinutes=null;
  if(exact&&!anyEstimated){
    const baseline=[0,...p.stops.map((_,i)=>i+1),n+1];
    baselineDrivingMinutes=baseline.slice(0,-1).reduce((sum,ix,k)=>sum+matrix.get(`${ix}:${baseline[k+1]}`).durationMinutes,0);
    savedMinutes=Math.max(0,Math.round((baselineDrivingMinutes-driving)*10)/10);
    baselineDrivingMinutes=Math.round(baselineDrivingMinutes*10)/10;
  }
  const warnings=[];
  if(!ready(env))warnings.push('네이버 API 키가 설정되지 않아 직선거리 기반으로 계산했습니다. 실제 자동차 경로가 아닙니다.');
  else if(estimated)warnings.push(`네이버 길찾기에 실패한 ${estimated}개 이동 구간에 추정치를 사용했습니다. API 권한이나 좌표를 확인하세요.`);
  if(exact&&anyEstimated)warnings.push('비교한 후보 구간에 추정치가 있어 네이버 도로시간 기준 최소 경로를 보장하지 않습니다.');
  if(p.mode==='auto'&&!exact)warnings.push('이 일정은 거리 기반 휴리스틱으로 방문 순서를 결정했습니다. 도로 이동시간 기준 전역 최적해는 보장하지 않습니다.');
  const status=road===0?'estimated':estimated?'mixed':exact&&anyEstimated?'road_partial':exact?'road_exact':'road_order';
  return {entries,orderIds:order.map(i=>all[i].id),totalDistanceMeters:distance,drivingMinutes:Math.round(driving*10)/10,totalMinutes:Math.round(elapsed*10)/10,baselineDrivingMinutes,savedMinutes,status,warnings,apiLegs:road,estimatedLegs:estimated,calculatedAt:new Date().toISOString()};
}
async function geocode(q,env){
  if(!ready(env))return err('네이버 API 인증키가 필요합니다. Vercel 환경변수 설정을 확인하세요.',503);
  if(q.length<2||q.length>120)return err('주소는 2~120자로 입력하세요.');
  try{
    const u=new URL(GEOCODE_API);u.searchParams.set('query',q);
    const res=await fetch(u,{headers:headers(env),signal:AbortSignal.timeout(7000)});
    if(!res.ok)return err('네이버 주소 검색 요청에 실패했습니다 (API 권한 및 요금 설정 확인).',502);
    const body=await res.json();if(body?.status!=='OK'||!Array.isArray(body.addresses))return err('주소 검색 결과를 받지 못했습니다.',502);
    return json({results:body.addresses.slice(0,8).map(x=>({address:x.roadAddress||x.jibunAddress||'',lat:Number(x.y),lng:Number(x.x)})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng))});
  }catch{return err('네이버 주소 검색이 지연되거나 실패했습니다.',502);}
}

export {json,err,ready,km,roadLeg,validatePlan,optimalMatrix,heuristicOrder,estimate,buildPlan,geocode};
