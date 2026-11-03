/* Date-only helpers for range selection. Independent of browser locale and timezone. */
const DAY=86400000,MAX_DAYS=10;
export function valid(k){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(k||''))return false;
 const n=Date.parse(k+'T00:00:00Z');
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===k;
}
export function rangeDays(a,b){return valid(a)&&valid(b)?(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY+1:0;}
export function applyRangeChoice(a,b,key){
 if(!valid(key))return {a,b,error:'날짜가 올바르지 않아요.'};
 if(!a||b||key<a)return {a:key,b:'',error:''};
 const count=rangeDays(a,key);
 if(count>MAX_DAYS)return {a,b,error:'최대 10일까지 여행할 수 있어요. 돌아오는 날짜를 다시 선택해 주세요.'};
 return {a,b:key,error:''};
}
