/* Browser smoke for design-only Preview; sample trips are synthetic test data. */
import {chromium} from 'playwright';
import {encodeSnapshot,snapshotDays} from '../public/static/shared-trip-core.js';
const base=process.env.YG_PREVIEW_URL||'https://yeohaenggil-lir84pkqw-travel-alex.vercel.app';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:1,acceptDownloads:true,locale:'ko-KR'});
const page=await ctx.newPage();page.setDefaultTimeout(18000);
const place=(id,name,lat,lng)=>({id,name,lat,lng,address:'서울특별시 종로구'});
const start=place('s','경복궁',37.5797,126.977),end=place('e','서울역',37.5547,126.9707),one=place('1','북촌한옥마을',37.5826,126.984);
const day={id:'day-1',date:'2026-11-03',origin:start,destination:end,stops:[one],departure:'09:00',mode:'auto',unassignedStops:[],
 result:{orderIds:['1'],entries:[{place:start},{place:one},{place:end}],drivingMinutes:22,totalDistanceMeters:6500}};
try{
 let r=await page.goto(base+'/view.html#trip='+await encodeSnapshot(snapshotDays([day])),{waitUntil:'domcontentloaded',timeout:45000});
 if(!r||r.status()!==200)throw Error('Read-only page HTTP '+(r?.status()||0));
 await page.locator('#sv-timeline .sv-stop').first().waitFor();
 const count=await page.locator('#sv-timeline .sv-stop').count();
 if(count!==3)throw Error('Expected 3 route locations, got '+count);
 const save=page.waitForEvent('download',{timeout:20000});
 await page.locator('#sv-save-card').click();
 const downloaded=await save;
 if(!downloaded.suggestedFilename().endsWith('.png'))throw Error('PNG not downloaded');
 console.log('PASS: view-only page and PNG download',downloaded.suggestedFilename());
 const config=await page.evaluate(async()=>{
   const r=await fetch('/api/config');const cfg=await r.json();
   return {status:r.status,supabaseReady:cfg.supabaseReady,match:cfg.supabaseUrl==='https://halbesrgdvjdzrvmdyxy.supabase.co',mapKeyPresent:Boolean(cfg.mapsKeyId)};
 });
 console.log('CONFIG_STATUS',JSON.stringify(config));
 if(config.status!==200||!config.supabaseReady||!config.match)throw Error('Preview branch Supabase URL/key missing');
 // Preserve state across reload as if a visitor had finished a trip.
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.evaluate(d=>{
  localStorage.setItem('yeohaenggil.v2.days',JSON.stringify([d]));
  localStorage.setItem('yeohaenggil.vnext.step','3');
 },day);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#yg-share-open').waitFor({state:'visible'});
 await page.locator('#yg-share-open').click();
 await page.locator('#yg-share-link').waitFor({state:'visible'});
 const link=await page.locator('#yg-share-link').inputValue();
 if(!link.includes('/view.html#trip='))throw Error('No view-only URL generated');
 const png=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-share-action="save"]').click();
 if(!(await png).suggestedFilename().endsWith('.png'))throw Error('Share modal PNG missing');
 console.log('PASS: share modal actual browser copy-link/PNG UI');
 await page.locator('#yg-share-close').click();
 // Search layout check: shrinking viewport simulates the area remaining above a keyboard.
 await page.locator('[data-yg-step="2"]').click();
 await page.locator('#yg-add-visit').click();
 await page.locator('#quick-input').fill('경복궁');
 await page.locator('#quick-input').press('Enter');
 await page.locator('#quick-results .quick-result-row').first().waitFor({timeout:25000});
 await page.setViewportSize({width:390,height:520});
 const box=await page.locator('.search-screen-results-mount').boundingBox();
 if(!box||box.y+box.height>530)throw Error('Search results overflow mobile viewport');
 console.log('PASS: visit search and compact viewport result list');
}catch(e){
 console.error('DESIGN_SMOKE_FAILED',e.stack||e.message);
 await page.screenshot({path:'/tmp/yg-design-smoke-error.png'}).catch(()=>{});
 process.exitCode=1;
}finally{await ctx.close();await browser.close();}
