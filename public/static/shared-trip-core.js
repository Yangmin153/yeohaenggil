/* Safe, portable, view-only travel snapshots; deliberately excludes account data. */
const MAX_DAYS=10,MAX_STOPS=40,MAX_LINK=19000;
const compactPlace=p=>{
 if(!p||typeof p.name!=='string')return null;
 const x=Number(p.lat),y=Number(p.lng);
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>90||Math.abs(y)>180||/미설정/.test(p.name))return null;
 return {n:p.name.slice(0,90),a:String(p.address||'').slice(0,115),x:+x.toFixed(6),y:+y.toFixed(6)};
};
const validPlace=p=>p&&typeof p.n==='string'&&p.n.length<=90&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=90&&Math.abs(p.y)<=180;
const dayName=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:'여행 날짜';
export function snapshotDays(days){
 if(!Array.isArray(days)||!days.length||days.length>MAX_DAYS)throw Error('공유할 여행 날짜를 확인해 주세요.');
 return {v:1,d:days.map(day=>{
  if(!day?.result||!Array.isArray(day.result.orderIds))throw Error('모든 여행 날짜의 동선을 계산한 뒤 공유할 수 있어요.');
  const stops=day.stops||[];
  if(stops.length>MAX_STOPS)throw Error('하루에 공유할 수 있는 방문지는 최대 40곳이에요.');
  const byId=new Map(stops.map(p=>[p.id,p]));
  const sorted=day.result.orderIds.map(id=>byId.get(id));
  if(sorted.length!==stops.length||sorted.some(p=>!p)||new Set(day.result.orderIds).size!==stops.length)throw Error('계산된 방문지 순서가 올바르지 않아요. 다시 계산해 주세요.');
  // Never publish a live/current GPS coordinate in a share link without separate consent.
  const places=[day.origin,...sorted,day.destination].map(compactPlace);
  if(places.some(p=>!validPlace(p)))throw Error('장소 좌표를 확인한 뒤 다시 공유해 주세요.');
  const minutes=Number(day.result.drivingMinutes),distance=Number(day.result.totalDistanceMeters);
  return {t:dayName(day.date),p:places,m:!day.liveOrigin&&Number.isFinite(minutes)&&minutes>=0?Math.round(minutes):null,
   k:!day.liveOrigin&&Number.isFinite(distance)&&distance>=0?Math.round(distance):null};
 })};
}
export function validateSnapshot(s){
 if(!s||s.v!==1||!Array.isArray(s.d)||!s.d.length||s.d.length>MAX_DAYS)throw Error('지원하지 않는 여행 링크예요.');
 for(const d of s.d){
  if(typeof d.t!=='string'||d.t.length>25||!Array.isArray(d.p)||d.p.length<2||d.p.length>MAX_STOPS+2||
   !d.p.every(validPlace)||d.p.some(p=>typeof p.a!=='string'||p.a.length>115)||
   (d.m!==null&&(!Number.isFinite(d.m)||d.m<0))||(d.k!==null&&(!Number.isFinite(d.k)||d.k<0)))
   throw Error('여행 링크에 유효하지 않은 장소 정보가 있어요.');
 }
 return s;
}
function toBase64(bytes){
 let result='';for(const b of bytes)result+=String.fromCharCode(b);
 return btoa(result).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64(text){
 if(!/^[\w-]+$/.test(text)||text.length>MAX_LINK)throw Error('링크가 너무 길거나 올바르지 않아요.');
 const data=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));
 return Uint8Array.from(data,c=>c.charCodeAt(0));
}
export async function encodeSnapshot(data){
 const original=new TextEncoder().encode(JSON.stringify(validateSnapshot(data)));
 let format='j',bytes=original;
 if(typeof CompressionStream==='function'){
  try{
   const stream=new Blob([original]).stream().pipeThrough(new CompressionStream('gzip'));
   const packed=new Uint8Array(await new Response(stream).arrayBuffer());
   if(packed.length<original.length){format='z';bytes=packed;}
  }catch{}
 }
 const code=format+toBase64(bytes);
 if(code.length>MAX_LINK)throw Error('공유 링크가 너무 길어요. 날짜별 이미지로 공유해 주세요.');
 return code;
}
export async function decodeSnapshot(code){
 if(typeof code!=='string'||code.length<3||code.length>MAX_LINK)throw Error('올바른 공유 링크가 아니에요.');
 const format=code[0];if(format!=='j'&&format!=='z')throw Error('지원하지 않는 여행 링크예요.');
 let bytes=fromBase64(code.slice(1));
 if(format==='z'){
  if(typeof DecompressionStream!=='function')throw Error('이 브라우저에서 링크 압축을 해제할 수 없어요.');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 if(bytes.length>150000)throw Error('공유 정보의 용량이 너무 커요.');
 try{return validateSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}
 catch(e){throw Error('여행 링크를 읽을 수 없어요. '+e.message);}
}
export function summaryText(snapshot){
 validateSnapshot(snapshot);
 return ['[여행길] 함께 보는 여행 일정',...snapshot.d.flatMap(d=>[
  d.t+(d.m!==null?' · 자동차 이동 약 '+d.m+'분':''),
  ...d.p.map((p,i)=> (i===0?'출발':i===d.p.length-1?'도착':i+'.')+' '+p.n)
 ])].join('\n');
}
export function getPreviewURL(code,origin){
 return new URL('/view.html#trip='+code,origin).href;
}
