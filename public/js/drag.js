// Pointer Events support both mouse and touch without exposing private hands.
export function bindCardDrag(root,onDrop){
 let gesture=null,ghost=null,target=null,frame=null,suppressUntil=0;
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
  cancelAnimationFrame(frame);frame=null;ghost?.remove();ghost=null;target?.classList.remove('drop-target');target=null;
  root.querySelector('.drag-source')?.classList.remove('drag-source');root.classList.remove('dragging-card');
  if(gesture){try{gesture.card.releasePointerCapture(gesture.id);}catch{}gesture=null;}
 }
 root.addEventListener('pointerdown',e=>{
  const card=e.target.closest('[data-draggable="true"]');
  if(!card||e.button!==0||!e.isPrimary||gesture)return;
  gesture={card,index:Number(card.dataset.hand),id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false};
  card.setPointerCapture(e.pointerId);
 },options);
 root.addEventListener('dragstart',e=>{if(e.target.closest('[data-hand]'))e.preventDefault();},options);
 document.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  gesture.x=e.clientX;gesture.y=e.clientY;
  if(!gesture.active&&Math.hypot(gesture.x-gesture.startX,gesture.y-gesture.startY)<7)return;
  e.preventDefault();
  if(!gesture.active){
   gesture.active=true;gesture.card.classList.add('drag-source');root.classList.add('dragging-card');
   ghost=document.createElement('div');ghost.className='card-drag-ghost';ghost.setAttribute('aria-hidden','true');
   const image=gesture.card.querySelector('img').cloneNode();image.draggable=false;ghost.append(image);document.body.append(ghost);
   frame=requestAnimationFrame(tick);
  }
  ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`;hover();
 },{...options,passive:false});
 document.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const active=gesture.active,index=gesture.index;
  if(active){gesture.x=e.clientX;gesture.y=e.clientY;hover();suppressUntil=Date.now()+500;}
  const cell=target?.dataset.cell;clear();
  if(active&&cell){const[x,y]=cell.split(',').map(Number);onDrop(index,x,y);}
 },options);
 document.addEventListener('pointercancel',clear,options);
 window.addEventListener('blur',clear,options);
 root.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{...options,capture:true});
 return ()=>{clear();controller.abort();};
}
