/* Browser smoke for design-only Preview; sample trips are synthetic test data. */
import {chromium} from 'playwright';
import {encodeSnapshot,snapshotDays} from '../public/static/shared-trip-core.js';
const base=process.env.YG_PREVIEW_URL||'https://yeohaenggil-orodk51j3-travel-alex.vercel.app';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:1,acceptDownloads:true,locale:'ko-KR'});
const page=await ctx.newPage();page.setDefaultTimeout(18000);
page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
page.on('response',r=>{if(r.status()>=400&&/naver|map|config/i.test(r.url())){try{const u=new URL(r.url());console.log('MAP_HTTP_ERROR',r.status(),u.host+u.pathname)}catch{}}});
page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('PAGE_CONSOLE_'+m.type(),m.text().slice(0,500));});
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
 if(await page.locator('#sv-save-card').count()||await page.locator('#sv-share-card').count())throw Error('PNG save/share controls must remain removed');
 await page.waitForFunction(()=>document.querySelector('.sv-naver-pin')||document.querySelector('#sv-map-unavailable')?.hidden===false,null,{timeout:16000});
 const viewDiagnostics=await page.evaluate(()=>({
  error:document.querySelector('#sv-error')?.textContent,
  errorHidden:document.querySelector('#sv-error')?.hidden,
  mapStatus:document.querySelector('#sv-map-caption')?.textContent,
  fallbackVisible:document.querySelector('#sv-map-unavailable')?.hidden===false,
  mapPins:document.querySelectorAll('.sv-naver-pin').length,
  obsoleteLayers:document.querySelectorAll('#sv-fallback-map,.sv-static-background').length
 }));
 console.log('VIEW_MAP_DIAGNOSTICS',JSON.stringify(viewDiagnostics));
 if(viewDiagnostics.errorHidden===false)throw Error('Read-only viewer error: '+viewDiagnostics.error);
 if(viewDiagnostics.obsoleteLayers)throw Error('Read-only view still has a duplicate static map/SVG overlay');
 if(viewDiagnostics.fallbackVisible)throw Error('Naver Dynamic Map unavailable on this Preview: '+viewDiagnostics.mapStatus);
 if(viewDiagnostics.mapPins!==3)throw Error('Expected exactly three markers on the sole Naver map');
 await page.locator('[data-focus-index="1"]').click();
 const info=await page.locator('#sv-map-caption').textContent();
 if(!info.includes('북촌한옥마을'))throw Error('Selected timeline place was not focused in map');
 await page.locator('#sv-map-fit').click();
 console.log('PASS: one live Naver map, no duplicate image or SVG, marker focus/fit and no PNG controls');
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
 const beforeStop=await page.evaluate(()=>window.TripApp?.getDay?.()?.stops?.length||0);
 await page.locator('#search-list-toggle').click();
 await page.locator('#search-map-stage').waitFor({state:'visible'});
 await page.locator('#search-naver-map').click({position:{x:75,y:65},force:true});
 if(await page.locator('#search-picked').isVisible())throw Error('Map tap created a manually selected place');
 await page.locator('#search-list-toggle').click();
 // A verified result button must still add a place immediately.
 await page.locator('#quick-results .quick-direct-add').first().click();
 await page.waitForTimeout(550);
 const status=await page.evaluate(()=>({
  count:window.TripApp?.getDay?.()?.stops?.length||0,
  names:window.TripApp?.getDay?.()?.stops?.map(p=>p.name)||[],
  quickFeedback:document.querySelector('#quick-feedback')?.textContent,
  screenFeedback:document.querySelector('#search-screen-feedback')?.textContent,
  region:window.TripApp?.getRegion?.(),
  selected:document.querySelector('#search-picked-name')?.textContent
 }));
 console.log('ADD_SEARCH_DIAGNOSTICS',JSON.stringify({beforeStop,...status}));
 if(status.count<=beforeStop)throw Error('Search result +add did not increase actual itinerary visit count');
 await page.waitForTimeout(1000);
 console.log('MAP_FOCUS_INITIAL_DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>({
  diagnostics:window.YeoSearch?.getMapDiagnostics?.(),viewMode:document.querySelector('#search-screen')?.dataset.searchMode,
  mapVisible:!document.querySelector('#search-map-stage')?.hidden,
  sdkReady:Boolean(window.naver?.maps?.Map),
  mapScript:document.querySelector('#naver-maps-sdk')?{loaded:!!window.__ygNaverMapsLoaded,srcHost:new URL(document.querySelector('#naver-maps-sdk').src).host}:null,
  mapStatus:document.querySelector('#map-placeholder')?.textContent?.slice(0,220),
  apiIndicator:document.querySelector('#api-indicator')?.textContent,
  sdkScripts:[...document.querySelectorAll('script[src*="maps.js"]')].map(x=>({id:x.id,hostname:new URL(x.src).hostname})),
  stop:window.TripApp?.getDay?.()?.stops?.at(-1)
 }))));
 await page.waitForFunction(()=>{
  const map=window.YeoSearch?.getMapDiagnostics?.(),visits=window.TripApp?.getDay?.()?.stops;
  const newest=visits?.at(-1);
  return map?.viewMode==='map'&&map.selectedName===newest?.name&&map.focused&&map.candidates===0&&map.saved>=1&&
   Math.abs(map.center.lat-newest.lat)<.003&&Math.abs(map.center.lng-newest.lng)<.003;
 },null,{timeout:16000});
 console.log('FIRST_MAP_FOCUS',JSON.stringify(await page.evaluate(()=>window.YeoSearch.getMapDiagnostics())));
 // A second search must work directly from the same visible top search input.
 await page.locator('#quick-input').fill('광화문광장');
 await page.locator('#quick-input').press('Enter');
 await page.locator('#quick-results .quick-direct-add').first().waitFor({timeout:25000});
 await page.locator('#quick-results .quick-direct-add').first().click();
 await page.waitForFunction(()=>{
  const d=window.TripApp?.getDay?.(),map=window.YeoSearch?.getMapDiagnostics?.(),recent=d?.stops?.at(-1);
  return d?.stops?.length>=3&&map?.viewMode==='map'&&map.selectedName===recent?.name&&map.candidates===0&&map.focused&&map.saved>=2&&
   Math.abs(map.center.lat-recent.lat)<.003&&Math.abs(map.center.lng-recent.lng)<.003;
 },null,{timeout:16000});
 console.log('SECOND_MAP_FOCUS',JSON.stringify(await page.evaluate(()=>({
  map:window.YeoSearch.getMapDiagnostics(),visits:window.TripApp.getDay().stops.map(s=>({name:s.name,lat:s.lat,lng:s.lng}))
 }))));
 console.log('PASS: two consecutive search-only additions recenter Naver map, show all saved stops and hide candidate markers');
 // The user can always return to search results, without adding map taps.
 await page.locator('#search-list-toggle').click();
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
 // In STEP2 a confirmed starting point should automatically open destination
 // search if no destination exists; it must not skip an already chosen destination.
 await page.locator('#search-screen-back').click();
 await page.evaluate(()=>{
  const d=window.TripApp?.getDay?.();
  if(d?.destination)d.destination.name='도착지 미설정';
 });
 await page.locator('#yg-origin-pick').click();
 await page.locator('#quick-input').fill('경복궁');
 await page.locator('#quick-input').press('Enter');
 await page.locator('#quick-results .quick-direct-add').first().waitFor({timeout:25000});
 await page.evaluate(()=>{
  window.__endpointTrace={events:[],before:{kind:window.YeoSearch?.mode?.(),open:window.YeoSearch?.isOpen?.()}};
  const endpoint=window.YeoSearch.completeEndpoint;
  window.YeoSearch.completeEndpoint=(place)=>{
   window.__endpointTrace.events.push({event:'completeEndpoint',name:place?.name});
   try{
    const ok=endpoint(place);window.__endpointTrace.events.push({event:'return',ok});
    return ok;
   }catch(error){
    window.__endpointTrace.events.push({event:'error',message:error?.message,stack:String(error?.stack||'').slice(0,1500)});
    throw error;
   }
  };
  const preview=window.YeoSearch.preview;
  window.YeoSearch.preview=(place,...rest)=>{
   window.__endpointTrace.events.push({event:'preview',name:place?.name});
   return preview(place,...rest);
  };
 });
 console.log('ENDPOINT_SELECT_BUTTON',await page.locator('#quick-results .quick-direct-add').first().textContent());
 await page.locator('#quick-results .quick-direct-add').first().click();
 await page.waitForTimeout(800);
 console.log('ENDPOINT_AUTO_DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>({
  mode:window.YeoSearch?.mode?.(),open:window.YeoSearch?.isOpen?.(),
  step:document.body.dataset.tripStep,origin:window.TripApp?.getDay?.()?.origin?.name,
  destination:window.TripApp?.getDay?.()?.destination?.name,
  heading:document.querySelector('#search-screen-region')?.textContent,
  toast:document.querySelector('#toast')?.textContent,
  history:history.state,hash:location.hash,trace:window.__endpointTrace,
  pickedHidden:document.querySelector('#search-picked')?.hidden,
  quickButtons:[...document.querySelectorAll('#quick-results .quick-direct-add')].slice(0,3).map(x=>({text:x.textContent,disabled:x.disabled})),
  feedback:document.querySelector('#search-screen-feedback')?.textContent
 }))));
 await page.waitForFunction(()=>window.YeoSearch?.isOpen?.()&&window.YeoSearch?.mode?.()==='destination',null,{timeout:5000});
 if(!(await page.locator('#search-screen-region').textContent()).includes('도착지 선택'))throw Error('Destination search heading did not update');
 if(await page.locator('#search-screen').getAttribute('data-search-kind')!=='destination')throw Error('Destination color stage was not activated');
 if(!(await page.locator('#search-stage-help').textContent()).includes('도착지'))throw Error('Destination hint did not update');
 if(!(await page.locator('#search-transition-toast').textContent()).includes('출발지를 설정했어요. 이제 도착지를 선택해 주세요.'))throw Error('Origin-to-destination confirmation was not shown');
 if(!(await page.locator('#search-transition-toast').isVisible()))throw Error('Origin transition notice was not visible');
 console.log('PASS: origin-to-destination handoff changes title, warm color, hint and one unobtrusive confirmation');
 await page.locator('#quick-input').fill('서울역');
 await page.locator('#quick-input').press('Enter');
 await page.locator('#quick-results .quick-direct-add').first().waitFor({timeout:25000});
 await page.locator('#quick-results .quick-direct-add').first().click();
 await page.waitForFunction(()=>document.querySelector('#search-screen')?.hidden&&document.querySelector('#toast')?.textContent?.includes('출발지와 도착지를 설정했어요.'),null,{timeout:12000});
 const completed=await page.evaluate(()=>({
  origin:window.TripApp?.getDay?.()?.origin?.name,destination:window.TripApp?.getDay?.()?.destination?.name,
  originShown:document.querySelector('#yg-origin-display')?.textContent,destinationShown:document.querySelector('#yg-dest-display')?.textContent,
  step:document.body.dataset.tripStep
 }));
 if(completed.step!=='2'||completed.origin!==completed.originShown||completed.destination!==completed.destinationShown)throw Error('Selected endpoints were not reflected in STEP2');
 console.log('PASS: selected destination returns to STEP2 with both endpoints rendered',JSON.stringify(completed));
}catch(e){
 console.error('DESIGN_SMOKE_FAILED',e.stack||e.message);
 await page.screenshot({path:'/tmp/yg-design-smoke-error.png'}).catch(()=>{});
 process.exitCode=1;
}finally{await ctx.close();await browser.close();}
