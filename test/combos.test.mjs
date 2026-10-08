import {CARDS,RACES,JOBS} from '../public/js/cards.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlayer,placeOne,clone,previewPlacement} from '../public/js/engine.js';
import {completedCombos,newCombos,placementComboHints,COMBO_COLORS,comboStyle} from '../public/js/combos.js';

function pair(){
 const p=makePlayer('human','あなた');p.gold=30;p.hand=['dwarf_pugilist','dwarf_cook','dwarf_saint','human_marchant'];
 placeOne(p,{handIndex:0,x:0,y:0});placeOne(p,{handIndex:0,x:-1,y:0});return p;
}
test('候補は合法で支払える配置のみ。負座標の列にも対応し実盤面を変更しない',()=>{
 const p=pair(),before=clone(p),hints=placementComboHints(p);
 assert.deepEqual(p,before);
 assert.ok(hints.some(h=>h.handIndex===0&&h.x===-2&&h.y===0&&h.combos.some(c=>c.key==='y:0:race:dwarf')));
 assert.equal(hints.some(h=>h.handIndex===1),false);
 p.gold=3;assert.equal(placementComboHints(p).length,0);
});
test('技術上限で増減がなくても揃いを表示し、成立済みボーナスは再通知しない',()=>{
 const p=pair();p.tech=15;
 const hint=placementComboHints(p).find(h=>h.x===-2&&h.y===0),after=previewPlacement(p,[{handIndex:hint.handIndex,x:hint.x,y:hint.y}]).player;
 assert.equal(after.tech,15);assert.equal(newCombos(p,after).length,1);
 assert.equal(completedCombos(after)[0].cells.length,3);assert.equal(newCombos(after,clone(after)).length,0);
});
test('交差する縦横と種族・職業の同時成立をすべて識別する',()=>{
 const p=makePlayer('human','あなた');p.gold=10;p.hand=['human_marchant'];
 p.board=[{card:'human_marchant',x:-1,y:0},{card:'human_great_marchant',x:1,y:0},{card:'elf_marchant',x:0,y:-1},{card:'goblin_scavenger',x:0,y:1},...[-1,1].flatMap(x=>[-1,1].map(y=>({card:'golem_iron',x,y})))];
 const hint=placementComboHints(p).find(h=>h.x===0&&h.y===0);
 assert.deepEqual(hint.combos.map(c=>c.key).sort(),['x:0:job:merchant','y:0:job:merchant','y:0:race:human']);
});
test('未成立の列は表示せず、取り消した盤面からも成立表示を外す',()=>{
 const p=pair(),after=previewPlacement(p,[{handIndex:0,x:-2,y:0}]).player;
 assert.equal(completedCombos(p).length,0);assert.equal(completedCombos(after).length,1);
 after.board.pop();assert.equal(completedCombos(after).length,0);
});

test('全6種族・全6職業で、自分・CPU・他参加者の候補と成立後の色・表記が一致',()=>{
 for(const [type,names] of [['race',RACES],['job',JOBS]])for(const [value,name] of Object.entries(names))for(const id of ['human','cpu','remote']){
  const cards=CARDS.filter(c=>c[type]===value).slice(0,3);assert.equal(cards.length,3);
  const p=makePlayer(id,id);p.gold=100;p.hand=[cards[2].id];p.board=cards.slice(0,2).map((c,x)=>({card:c.id,x,y:0}));
  const hint=placementComboHints(p).find(h=>h.x===2&&h.y===0),expected=`y:0:${type}:${value}`;
  assert.ok(hint,`${id}:${type}:${value}`);
  const predicted=hint.combos.find(g=>g.key===expected);assert.ok(predicted);
  const after=previewPlacement(p,[{handIndex:0,x:2,y:0}]).player;
  const group=completedCombos(after).find(g=>g.key===expected);assert.equal(group.label,`${type==='race'?'種族':'職業'}揃い・${name}`);
  assert.equal(comboStyle([predicted]),comboStyle([group]));assert.ok(comboStyle([group]).includes(COMBO_COLORS[type][value]));
  assert.equal(newCombos(p,after).find(g=>g.key===expected).cells.length,3);assert.equal(after.id,id);
 }
});
