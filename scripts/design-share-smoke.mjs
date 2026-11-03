/* Browser smoke for design-only Preview; sample trips are synthetic test data. */
import {chromium} from 'playwright';
import {encodeSnapshot,snapshotDays} from '../public/static/shared-trip-core.js';
const base=process.env.YG_PREVIEW_URL||'https://yeohaenggil-orodk51j3-travel-alex.vercel.app';
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
 const mapResp=await page.request.get(base+'/api/static-map?p=37.579700,126.977000;37.582600,126.984000');
 console.log('STATIC_MAP_STATUS',mapResp.status(),mapResp.headers()['content-type']);
 if(!mapResp.ok()){
  const message=await mapResp.text().catch(()=>null);
  console.log('STATIC_MAP_DIAGNOSTIC',String(message).slice(0,340));
  throw new Error('Naver Static Map API must be enabled and return an actual image.');
 }
 if(!String(mapResp.headers()['content-type']).startsWith('image/'))throw Error('Static Map response is not an image');
 if(await page.locator('#sv-save-card').count()||await page.locator('#sv-share-card').count())throw Error('Old PNG actions should be removed');
 const mapSvg=await page.locator('#sv-fallback-map rect').getAttribute('fill');
 if(mapSvg!=='transparent')throw Error('Map marker overlay must not cover the Naver map image');
 await page.locator('[data-focus-index="1"]').click();
 const info=await page.locator('#sv-map-caption').textContent();
 if(!info.includes('북촌한옥마을'))throw Error('Selected timeline place was not focused in map');
 await page.locator('#sv-map-fit').click();
 console.log('PASS: view-only Naver map tiles, transparent pins, map focus/fit, no PNG controls');
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
 const header=await page.locator('#yg-share-open').boundingBox();
 const account=await page.locator('#account-button').boundingBox();
 if(!header||!account||Math.abs(header.y-account.y)>15)throw Error('Share and Login are not in the same header row');
 await page.locator('#yg-share-open').click();
 await page.locator('#yg-share-link').waitFor({state:'visible'});
 const link=await page.locator('#yg-share-link').inputValue();
 if(!link.includes('/view.html#trip='))throw Error('No view-only URL generated');
 if(await page.locator('[data-share-action="save"]').count()||await page.locator('[data-share-action="image"]').count())throw Error('Share modal still exposes PNG');
 if(await page.locator('[data-share-action="copy"]').count()!==1||await page.locator('[data-share-action="text"]').count()!==1)throw Error('Link and text actions are required');
 console.log('PASS: share modal offers view-only link and detailed text, no PNG actions');
 await page.locator('#yg-share-close').click();
 // Selecting the first date must not change existing dates until the second is chosen.
 await page.locator('[data-yg-step="1"]').click();
 await page.locator('#yg-date-range-open').click();
 await page.locator('[data-date="2026-11-06"]').click();
 if(await page.locator('#yg-start-date').inputValue()!=='2026-11-03')throw Error('First calendar click overwrote original itinerary');
 await page.locator('[data-date="2026-11-08"]').click();
 if(await page.locator('#yg-start-date').inputValue()!=='2026-11-06'||await page.locator('#yg-end-date').inputValue()!=='2026-11-08')throw Error('Two-click date range failed');
 console.log('PASS: airline date range waits until both departure and return are selected');
 // Search layout check: shrinking viewport simulates the area remaining above a keyboard.
 await page.locator('[data-yg-step="2"]').click();
 await page.locator('#yg-add-visit').click();
 await page.locator('#quick-input').fill('경복궁');
 await page.locator('#quick-input').press('Enter');
 await page.locator('#quick-results .quick-result-row').first().waitFor({timeout:25000});
 // The map may be viewed, but no click on it can create a manual coordinate.
 const beforeStop=await page.locator('#yg-stop-count').textContent();
 await page.locator('#search-list-toggle').click();
 await page.locator('#search-map-stage').waitFor({state:'visible'});
 await page.locator('#search-naver-map').click({position:{x:75,y:65},force:true});
 if(await page.locator('#search-picked').isVisible())throw Error('Map tap created a manually selected place');
 await page.locator('#search-list-toggle').click();
 // A verified result button must still add a place immediately.
 await page.locator('#quick-results .quick-direct-add').first().click();
 const afterStop=await page.locator('#yg-stop-count').textContent();
 if(beforeStop===afterStop)throw Error('Search result +add did not increase visit count');
 console.log('PASS: only search-result buttons add places; map taps never select coordinates');
 await page.setViewportSize({width:390,height:520});
 await page.waitForTimeout(350);
 const box=await page.locator('.search-screen-results-mount').boundingBox();
 const debug=await page.evaluate(()=>({innerHeight,visualHeight:window.visualViewport?.height,
  overlay:document.querySelector('#search-screen')?.getBoundingClientRect().toJSON(),
  result:document.querySelector('.search-screen-results-mount')?.getBoundingClientRect().toJSON(),
  cssHeight:document.querySelector('#search-screen')?.style.getPropertyValue('--search-height'),
  mode:document.querySelector('#search-screen')?.dataset.searchMode}));
 console.log('MOBILE_VIEWPORT_DIAGNOSTIC',JSON.stringify(debug));
 if(!box||box.y+box.height>530)throw Error('Search results overflow mobile viewport');
 console.log('PASS: visit search and compact viewport result list');
}catch(e){
 console.error('DESIGN_SMOKE_FAILED',e.stack||e.message);
 await page.screenshot({path:'/tmp/yg-design-smoke-error.png'}).catch(()=>{});
 process.exitCode=1;
}finally{await ctx.close();await browser.close();}
