import {valid,applyRangeChoice} from './date-range-core.js';
/* One-calendar flight-ticket-style date range selector. Keeps existing date inputs and trip schema. */
const $=id=>document.getElementById(id);
const start=$('yg-start-date'),end=$('yg-end-date'),panel=$('yg-calendar'),grid=$('yg-calendar-grid');
const opener=$('yg-date-range-open'),monthText=$('yg-calendar-month'),hint=$('yg-calendar-hint');
const DAY=86400000;
let visibleMonth=new Date(),rangeStart='',rangeEnd='',opened=false;
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const utcDay=k=>Date.parse(k+'T00:00:00Z');
const fmt=k=>!valid(k)?'날짜 선택':new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'}).format(utcDay(k));

function syncLabels(){
 $('yg-date-range-start').textContent=fmt(rangeStart);
 $('yg-date-range-end').textContent=fmt(rangeEnd);
 opener.setAttribute('aria-expanded',String(opened));
 if(!opened&&rangeStart&&rangeEnd)opener.setAttribute('aria-label',fmt(rangeStart)+'부터 '+fmt(rangeEnd)+'까지, 날짜 바꾸기');
}
function writeDates(){
 // Only commit the range once BOTH dates are chosen. A first click must not
 // overwrite an existing itinerary or trigger the old native-date listener.
 if(!rangeStart||!rangeEnd)return;
 start.value=rangeStart;end.value=rangeEnd;
 end.dispatchEvent(new Event('change',{bubbles:true}));
}
function setOpen(value){
 opened=Boolean(value);panel.hidden=!opened;syncLabels();
 if(opened){render();$('yg-calendar-close').focus({preventScroll:true});}
 else opener.focus({preventScroll:true});
}
function render(){
 monthText.textContent=visibleMonth.toLocaleDateString('ko-KR',{year:'numeric',month:'long'});
 grid.replaceChildren();
 const firstWeekday=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),1).getDay();
 const daysInMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,0).getDate();
 for(let i=0;i<firstWeekday;i++){
  const blank=document.createElement('span');blank.className='yg-calendar-blank';blank.setAttribute('aria-hidden','true');grid.append(blank);
 }
 for(let i=1;i<=daysInMonth;i++){
  const date=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),i),key=dateKey(date);
  const dayButton=document.createElement('button');dayButton.type='button';dayButton.className='yg-calendar-day';dayButton.dataset.date=key;
  dayButton.textContent=String(i);dayButton.setAttribute('aria-label',fmt(key));
  const inside=Boolean(rangeStart&&rangeEnd&&key>rangeStart&&key<rangeEnd);
  if(key===rangeStart){dayButton.classList.add('is-start');dayButton.setAttribute('aria-pressed','true');}
  else if(key===rangeEnd){dayButton.classList.add('is-end');dayButton.setAttribute('aria-pressed','true');}
  else if(inside){dayButton.classList.add('is-in-range');dayButton.setAttribute('aria-pressed','false');}
  else dayButton.setAttribute('aria-pressed','false');
  grid.append(dayButton);
 }
 const selectingEnd=Boolean(rangeStart&&!rangeEnd);
 hint.textContent=selectingEnd?'돌아오는 날짜를 선택하세요. (최대 10일)':'먼저 출발일을 선택한 뒤 돌아오는 날짜를 선택하세요.';
}
function choose(key){
 const result=applyRangeChoice(rangeStart,rangeEnd,key);
 if(result.error){hint.textContent=result.error;hint.dataset.error='true';return;}
 hint.dataset.error='false';rangeStart=result.a;rangeEnd=result.b;writeDates();
 if(rangeEnd){syncLabels();setOpen(false);}
 else{visibleMonth=new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);render();syncLabels();}
}
function refresh(){
 rangeStart=valid(start.value)?start.value:'';rangeEnd=valid(end.value)?end.value:'';
 if(rangeStart)visibleMonth=new Date(Number(rangeStart.slice(0,4)),Number(rangeStart.slice(5,7))-1,1);
 syncLabels();if(opened)render();
}
opener.addEventListener('click',()=>setOpen(!opened));
$('yg-calendar-close').addEventListener('click',()=>setOpen(false));
$('yg-calendar-prev').addEventListener('click',()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()-1,1);render();});
$('yg-calendar-next').addEventListener('click',()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,1);render();});
grid.addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(b)choose(b.dataset.date);});
grid.addEventListener('keydown',e=>{
 const button=e.target.closest('[data-date]');if(!button)return;
 const dx={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(!dx)return;
 e.preventDefault();const d=new Date(utcDay(button.dataset.date)+dx*DAY),key=dateKey(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
 visibleMonth=new Date(d.getUTCFullYear(),d.getUTCMonth(),1);render();
 grid.querySelector('[data-date="'+key+'"]')?.focus();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();setOpen(false);}});
[start,end].forEach(el=>el.addEventListener('change',refresh));
document.addEventListener('trip:days-imported',()=>requestAnimationFrame(refresh));
refresh();
