/** Shared iOS/Android background scroll lock for overlays and dialogs. */
(function(root){
 'use strict';
 const owners=new Set();let snapshot=null;
 const doc=()=>root.document;
 function lock(owner){
  if(!owner||owners.has(owner))return;
  const d=doc();if(!d)return;
  if(!owners.size){
   const body=d.body,html=d.documentElement;
   snapshot={y:root.scrollY||0,
    bodyPosition:body.style.position,bodyTop:body.style.top,
    bodyLeft:body.style.left,bodyRight:body.style.right,
    bodyWidth:body.style.width,bodyOverflow:body.style.overflow,
    htmlOverscroll:html.style.overscrollBehavior,htmlOverflow:html.style.overflow,htmlScrollBehavior:html.style.scrollBehavior};
   body.style.position='fixed';body.style.top='-'+snapshot.y+'px';
   body.style.left='0';body.style.right='0';body.style.width='100%';
   body.style.overflow='hidden';html.style.overflow='hidden';
  }
  owners.add(owner);
  d.documentElement.style.overscrollBehavior='none';
 }
 function unlock(owner){
  if(!owners.delete(owner)||owners.size)return;
  const saved=snapshot;snapshot=null;
  if(!saved)return;
  const body=doc().body,html=doc().documentElement;
  body.style.position=saved.bodyPosition;body.style.top=saved.bodyTop;
  body.style.left=saved.bodyLeft;body.style.right=saved.bodyRight;
  body.style.width=saved.bodyWidth;body.style.overflow=saved.bodyOverflow;
  html.style.overflow=saved.htmlOverflow;html.style.overscrollBehavior=saved.htmlOverscroll;
  // Override site-wide smooth scrolling for exact restoration; restore original style.
  html.style.scrollBehavior='auto';
  try{root.scrollTo({top:saved.y,behavior:'instant'});}
  finally{html.style.scrollBehavior=saved.htmlScrollBehavior;}
 }
 function active(){return owners.size>0;}
 // Visual viewport follows Safari's keyboard and browser bars without disabling zoom.
 function viewport(){
  const html=doc()?.documentElement;if(!html?.style?.setProperty)return;
  const v=root.visualViewport;
  html.style.setProperty('--yg-viewport-height',Math.round(v?.height||root.innerHeight||800)+'px');
  html.style.setProperty('--yg-viewport-top',Math.round(v?.offsetTop||0)+'px');
 }
 root.visualViewport?.addEventListener('resize',viewport);
 root.visualViewport?.addEventListener('scroll',viewport);
 root.addEventListener?.('resize',viewport);viewport();
 root.YGScrollLock=Object.freeze({lock,unlock,active});
})(globalThis);
