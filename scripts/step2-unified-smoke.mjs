/* Local browser smoke: desktop Chromium and iPhone-like WebKit.
 * Static API response is stubbed; no claim of testing NAVER credentials or physical iPhone. */
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const fixtures=[
 {name:'PC Chromium',engine:chromium,viewport:{width:1280,height:850},mobile:false},
 {name:'iPhone WebKit simulation',engine:webkit,viewport:{width:390,height:844},mobile:true}
];
const start={id:'airport',name:'김포공항',lat:37.5584,lng:126.7906,address:'서울 강서구 하늘길'};
const destination={id:'hotel',name:'호텔',lat:37.566,lng:126.978,address:'서울 중구'};
const stop={id:'forest',name:'서울숲',lat:37.5445,lng:127.0375,address:'서울 성동구'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm+wAAAAASUVORK5CYII=','base64');
for(const fixture of fixtures){
 const browser=await fixture.engine.launch({headless:true});
 const page=await browser.newPage({viewport:fixture.viewport,isMobile:fixture.mobile,hasTouch:fixture.mobile,
  deviceScaleFactor:fixture.mobile?3:1});
 const problems=[];
 page.on('pageerror',e=>problems.push(e.message));
 await page.route('**/api/static-map?*',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
 try{
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>!!window.YeoNext&&!!window.YeoSearch&&!!window.TripQuickAdd,{timeout:10000});
  await page.evaluate(()=>{
   document.getElementById('yg-start-date').value='2026-11-10';
   document.getElementById('yg-end-date').value='2026-11-10';
   document.getElementById('yg-end-date').dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#yg-next-places').click();
  await page.waitForFunction(()=>document.body.dataset.tripStep==='2');
  assert.equal(await page.locator('#yg-step-two-hub').isVisible(),true);
  assert.equal(await page.locator('#yg-calculate').isDisabled(),true);
  await page.evaluate(()=>{window.__testFocus=[];document.addEventListener('trip:planner-focus',e=>window.__testFocus.push(e.detail.id));});
  await page.locator('#yg-add-visit').click();
  assert.equal(await page.locator('#search-screen').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.YeoSearch.mode()),'stop');
  await page.evaluate(place=>window.TripQuickAdd.addPlace(place),stop);
  await page.waitForFunction(()=>document.getElementById('search-screen').hidden&&window.TripApp.getDay().stops.length===1);
  assert.equal(await page.locator('#yg-calculate').isDisabled(),true);
  await page.waitForFunction(()=>window.__testFocus.length>=1,{},{timeout:5000});
  assert.ok((await page.evaluate(()=>window.__testFocus)).length>=1);
  await page.locator('#yg-open-stops').click();
  assert.equal(await page.locator('#yg-open-stops').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#yg-inline-stops [data-inline-focus]').count(),1);
  await page.locator('#yg-origin-pick').click();
  assert.equal(await page.evaluate(()=>window.YeoSearch.mode()),'origin');
  assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
  await page.evaluate(place=>window.YeoSearch.completeEndpoint(place),start);
  await page.waitForFunction(()=>document.getElementById('search-screen').hidden);
  assert.equal(await page.evaluate(()=>window.YeoSearch.isOpen()),false);
  assert.equal(await page.locator('#yg-calculate').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.TripApp.getDay().origin.name),'김포공항');
  await page.locator('#yg-dest-pick').click();
  assert.equal(await page.evaluate(()=>window.YeoSearch.mode()),'destination');
  await page.evaluate(place=>window.YeoSearch.completeEndpoint(place),destination);
  await page.waitForFunction(()=>document.getElementById('search-screen').hidden);
  assert.equal(await page.evaluate(()=>window.TripApp.getDay().destination.name),'호텔');
  await page.waitForFunction(()=>!document.getElementById('yg-calculate').disabled);
  assert.equal(await page.locator('#yg-calculate').isEnabled(),true);
  await page.locator('#yg-inline-stops [data-inline-focus]').click();
  const lastFocus=await page.evaluate(()=>window.__testFocus.at(-1));
  assert.equal(lastFocus,await page.evaluate(()=>window.TripApp.getDay().stops[0].id));
  await page.waitForTimeout(250);
  const imageVisible=await page.locator('.yg-step2-static-map').isVisible();
  assert.equal(imageVisible,true,'Preview Static Map fallback should display when Dynamic Map is missing');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=2,'horizontal overflow '+overflow);
  await page.locator('#yg-inline-stops [data-inline-remove]').click();
  await page.waitForFunction(()=>window.TripApp.getDay().stops.length===0);
  assert.equal(await page.locator('#yg-calculate').isDisabled(),true);
  assert.equal(await page.locator('#yg-inline-stops .yg-inline-row').count(),0);
  // After a full-screen search exits, the page is no longer locked.
  assert.notEqual(await page.evaluate(()=>document.body.style.position),'fixed');
  assert.deepEqual(problems.filter(msg=>!/Naver|지도|api|Failed to fetch|resize|TypeError: NetworkError/.test(msg)),[]);
  console.log('PASS '+fixture.name+' — search return, endpoint independence, list CRUD, status, focus, fallback and viewport');
 }catch(e){
  console.error('FAIL '+fixture.name+': '+e.stack);
  console.error('PAGE ERRORS: '+JSON.stringify(problems));
  await page.screenshot({path:'/tmp/step2-'+(fixture.mobile?'webkit':'chromium')+'.png',fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
}
