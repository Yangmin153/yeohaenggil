import {runMultiDay,validateTrip} from '../lib/multi-day.js';
import {json,err} from '../lib/core.js';
export async function POST(request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return err('다른 출처의 요청은 허용하지 않습니다.',403);
 if(!String(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return err('JSON 요청만 허용합니다.',415);
 if(Number(request.headers.get('content-length')||0)>70000)return err('요청이 너무 큽니다.',413);
 let body;
 try{const raw=await request.text();if(raw.length>70000)return err('요청이 너무 큽니다.',413);body=JSON.parse(raw)}catch{return err('여행 계획 형식을 확인해 주세요.')}
 const problem=validateTrip(body);if(problem)return err(problem,422);
 try{return json(await runMultiDay(body,process.env));}catch{return err('날짜별 경로 계산 중 오류가 발생했습니다. 다시 시도해 주세요.',500);}
}
