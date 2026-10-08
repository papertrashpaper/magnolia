import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCardDrag} from '../public/js/drag.js';

function fixture(t){
 const saved=new Map();
 const install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 const classes=()=>{const values=new Set();return{add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x)};};
 const card=()=>({dataset:{hand:'0'},classList:classes(),setPointerCapture(){},releasePointerCapture(){},querySelector:()=>({cloneNode:()=>({})}),closest:()=>null});
 const root=new EventTarget();root.classList=classes();root.card=card();root.setPointerCapture=id=>{root.captured=id;};root.releasePointerCapture=()=>{root.captured=null;};
 const cell={dataset:{cell:'0,0'},disabled:false,classList:classes(),closest:()=>cell};
 root.contains=x=>x===cell;root.querySelector=selector=>selector==='.drag-source'&&root.card.classList.contains('drag-source')?root.card:null;
 const doc=new EventTarget();doc.elementFromPoint=()=>cell;doc.body={append(){}};doc.createElement=()=>({style:{},setAttribute(){},append(){},remove(){}});
 const win=new EventTarget();win.scrollBy=()=>{};
 install('document',doc);install('window',win);install('requestAnimationFrame',()=>1);install('cancelAnimationFrame',()=>{});
 const emit=(host,type,props={})=>{const e=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(props))Object.defineProperty(e,key,{value});host.dispatchEvent(e);return e;};
 const down=(touch=false)=>{const c=root.card;c.closest=selector=>selector==='[data-draggable="true"]'?c:null;emit(root,'pointerdown',{target:c,pointerId:1,clientX:100,clientY:400,button:0,isPrimary:true,pointerType:touch?'touch':'mouse'});};
 const move=(x,y)=>emit(doc,'pointermove',{pointerId:1,clientX:x,clientY:y});
 const up=()=>emit(doc,'pointerup',{pointerId:1,clientX:100,clientY:100});
 const restore=()=>{for(const[key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
 return {root,doc,cell,card,emit,down,move,up,restore};
}

test('two mouse drops survive replacement of the hand and suppress the generated click',t=>{
 const f=fixture(t),drops=[];
 const dispose=bindCardDrag(f.root,(...args)=>{drops.push(args);f.root.card=f.card();});t.after(()=>{dispose();f.restore();});
 f.down();f.move(100,100);f.up();
 assert.equal(f.emit(f.root,'click').defaultPrevented,true);
 f.cell.dataset.cell='1,0';f.down();f.move(100,100);f.up();
 assert.deepEqual(drops,[[0,0,0],[0,1,0]]);
});

test('combo hints follow the lifted card and reset on drop or cancellation',t=>{
 const f=fixture(t),changes=[];
 const dispose=bindCardDrag(f.root,()=>{},()=>{},i=>changes.push(i));t.after(()=>{dispose();f.restore();});
 f.down(true);f.move(150,402);assert.deepEqual(changes,[]);
 f.down();f.move(100,100);f.up();assert.deepEqual(changes,[0,null]);
 f.down();f.move(100,100);f.emit(f.doc,'pointercancel');assert.deepEqual(changes,[0,null,0,null]);
});

test('touch swipes scroll the hand while vertical touch drags place a card',t=>{
 const f=fixture(t),drops=[];const dispose=bindCardDrag(f.root,(...args)=>drops.push(args));t.after(()=>{dispose();f.restore();});
 f.down(true);assert.equal(f.move(150,402).defaultPrevented,false);f.up();assert.deepEqual(drops,[]);
 f.down(true);assert.equal(f.move(101,360).defaultPrevented,true);assert.equal(f.root.classList.contains('dragging-card'),true);
 f.up();assert.deepEqual(drops,[[0,0,0]]);assert.equal(f.root.classList.contains('dragging-card'),false);
});

test('cancelled pointer gestures clean up and allow the next drag',t=>{
 const f=fixture(t),drops=[];const dispose=bindCardDrag(f.root,(...args)=>drops.push(args));t.after(()=>{dispose();f.restore();});
 f.down(true);f.move(100,360);f.emit(f.doc,'pointercancel');f.up();assert.deepEqual(drops,[]);
 f.down(true);f.move(100,360);f.up();assert.deepEqual(drops,[[0,0,0]]);
});

test('unaffordable cards warn on pointerdown and never create a drag or drop',t=>{
 const f=fixture(t),drops=[],warnings=[];
 const dispose=bindCardDrag(f.root,(...args)=>drops.push(args),i=>warnings.push(i));t.after(()=>{dispose();f.restore();});
 const c=f.root.card;c.closest=selector=>selector==='[data-drag-blocked="money"]'?c:null;
 f.emit(f.root,'pointerdown',{target:c,pointerId:1,clientX:100,clientY:400,button:0,isPrimary:true,pointerType:'touch'});
 f.move(100,100);f.up();
 assert.deepEqual(warnings,[0]);assert.deepEqual(drops,[]);assert.equal(f.root.classList.contains('dragging-card'),false);
 assert.equal(f.emit(f.root,'click').defaultPrevented,true);
 f.down();f.move(100,100);f.up();assert.deepEqual(drops,[[0,0,0]]);
});


test('drag capture stays on the root while an online update replaces hand cards',t=>{
 const f=fixture(t),drops=[];const dispose=bindCardDrag(f.root,(...args)=>drops.push(args));t.after(()=>{dispose();f.restore();});
 f.down();f.move(100,300);assert.equal(f.root.captured,1);
 f.root.card=f.card();f.move(100,100);f.up();
 assert.deepEqual(drops,[[0,0,0]]);assert.equal(f.root.captured,null);
});

test('lifting reveals the mat, while a normal tap does not scroll it',t=>{
 const f=fixture(t),scrolls=[],lookup=f.root.querySelector;f.root.querySelector=selector=>selector==='#playerBoard .board-wrap'?{scrollIntoView:options=>scrolls.push(options)}:lookup(selector);
 const dispose=bindCardDrag(f.root,()=>{});t.after(()=>{dispose();f.restore();});
 f.down();f.up();assert.deepEqual(scrolls,[]);
 f.down(true);f.move(100,360);assert.deepEqual(scrolls,[{block:'center',behavior:'instant'}]);f.up();
});
