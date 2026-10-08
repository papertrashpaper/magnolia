// Pointer Events support both mouse and touch without exposing private hands.
export function bindCardDrag(root,onDrop,onBlocked=()=>{},onDragChange=()=>{}){
 let gesture=null,ghost=null,target=null,frame=null,holdTimer=null,suppressUntil=0;
 const controller=new AbortController(),options={signal:controller.signal};
 function hover(){
  const next=document.elementFromPoint(gesture.x,gesture.y)?.closest('[data-cell]');
  const legal=next&&root.contains(next)&&!next.disabled?next:null;
  if(target!==legal){target?.classList.remove('drop-target');target=legal;target?.classList.add('drop-target');}
 }
 function tick(){
  if(!gesture?.active)return;
  const gallery=root.querySelector('.kingdom-overview')?.getBoundingClientRect();
  const top=gallery&&getComputedStyle(root.querySelector('.kingdom-overview')).position==='sticky'?Math.min(gallery.bottom+36,innerHeight-120):72;
  const speed=gesture.y<top?-12:gesture.y>innerHeight-65?12:0;
  if(speed)window.scrollBy(0,speed);
  hover();frame=requestAnimationFrame(tick);
 }
 function clear(){
  clearTimeout(holdTimer);holdTimer=null;
  cancelAnimationFrame(frame);frame=null;ghost?.remove();ghost=null;target?.classList.remove('drop-target');target=null;
  root.querySelector('.drag-source')?.classList.remove('drag-source');root.classList.remove('dragging-card');
  if(gesture?.active)onDragChange(null);
  const ended=gesture;gesture=null;
  if(ended){try{(ended.active?root:ended.card).releasePointerCapture(ended.id);}catch{}}
 }
 function lift(){
  if(!gesture||gesture.scrolling)return;
  gesture.active=true;try{root.setPointerCapture(gesture.id);}catch{}gesture.card.classList.add('drag-source');root.classList.add('dragging-card');onDragChange(gesture.index);
  root.querySelector('#playerBoard .board-wrap')?.scrollIntoView({block:'center',behavior:'instant'});
  ghost=document.createElement('div');ghost.className='card-drag-ghost';ghost.setAttribute('aria-hidden','true');
  const image=gesture.card.querySelector('img').cloneNode();image.draggable=false;ghost.append(image);document.body.append(ghost);
  ghost.style.left=`${gesture.x}px`;ghost.style.top=`${gesture.y}px`;
  frame=requestAnimationFrame(tick);
 }
 root.addEventListener('pointerdown',e=>{
  const blocked=e.target.closest('[data-drag-blocked="money"]');
  if(blocked&&e.button===0&&e.isPrimary){onBlocked(Number(blocked.dataset.hand));suppressUntil=Date.now()+500;return;}
  const card=e.target.closest('[data-draggable="true"]');
  if(!card||e.button!==0||!e.isPrimary||gesture)return;
  gesture={card,index:Number(card.dataset.hand),id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false,touch:e.pointerType==='touch',hand:card.closest('.hand'),lastX:e.clientX,lastY:e.clientY,scrolling:false,scrollAxis:null,moved:false};
  try{card.setPointerCapture(e.pointerId);}catch{}
  if(gesture.touch)holdTimer=setTimeout(()=>{holdTimer=null;lift();},450);
 },options);
 root.addEventListener('dragstart',e=>{if(e.target.closest('[data-hand]'))e.preventDefault();},options);
 document.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const stepX=e.clientX-gesture.lastX,stepY=e.clientY-gesture.lastY;
  gesture.x=e.clientX;gesture.y=e.clientY;gesture.lastX=e.clientX;gesture.lastY=e.clientY;
  const dx=Math.abs(gesture.x-gesture.startX),dy=Math.abs(gesture.y-gesture.startY);
  if(gesture.touch&&!gesture.active){
   // Moving before the hold finishes is a scroll, never a delayed drag.
   e.preventDefault();
   if(!gesture.scrolling&&Math.hypot(dx,dy)<10)return;
   clearTimeout(holdTimer);holdTimer=null;
   if(!gesture.scrolling){gesture.scrolling=true;gesture.scrollAxis=dx>dy&&gesture.hand?'x':'y';}
   if(gesture.scrollAxis==='x')gesture.hand.scrollLeft-=stepX;else window.scrollBy(0,-stepY);
   return;
  }
  if(!gesture.active){if(Math.hypot(dx,dy)<8)return;lift();}
  if(Math.hypot(dx,dy)>=8)gesture.moved=true;
  e.preventDefault();
  ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`;hover();
 },{...options,passive:false});
 document.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const active=gesture.active,index=gesture.index;
  if(gesture.scrolling)suppressUntil=Date.now()+500;
  if(active){gesture.x=e.clientX;gesture.y=e.clientY;hover();suppressUntil=Date.now()+500;}
  const cell=gesture.moved?target?.dataset.cell:null;clear();
  if(active&&cell){const[x,y]=cell.split(',').map(Number);onDrop(index,x,y);}
 },options);
 document.addEventListener('pointercancel',e=>{if(gesture&&e.pointerId===gesture.id)clear();},options);
 root.addEventListener('lostpointercapture',e=>{if(gesture?.active&&e.target===root&&e.pointerId===gesture.id)clear();},options);
 root.addEventListener('contextmenu',e=>{if(gesture?.touch){e.preventDefault();e.stopImmediatePropagation();}},{...options,capture:true});
 window.addEventListener('blur',clear,options);
 root.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{...options,capture:true});
 return ()=>{clear();controller.abort();};
}
