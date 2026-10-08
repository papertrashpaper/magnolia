// 収録枚数は2026-10-08に提供された説明書のカードリスト（01-01〜01-41）に準拠。
export const RACES = {human:'人間',dwarf:'ドワーフ',elf:'エルフ',goblin:'ゴブリン',golem:'ゴーレム',demon:'デーモン'};
export const JOBS = {warrior:'戦士',merchant:'商人',artisan:'職人',priest:'聖職者',mage:'魔術師',ruler:'君主'};
export const RACE_BONUS = {human:{vp:5},dwarf:{tech:2},elf:{faith:2},goblin:{gold:3},golem:{tech:2,faith:2},demon:{vp:7}};
export const JOB_BONUS = {warrior:{gold:3},merchant:{vp:5},artisan:{tech:2},priest:{faith:2},mage:{gold:1,vp:3},ruler:{vp:9}};
const e=(phase,stat,amount,scale=null)=>({phase,stat,amount,scale});
const list=[
 ['human_knight','人間の騎士','human','warrior',3,6,[e('war','vp',1)],'png',3],
 ['human_marchant','人間の行商','human','merchant',1,3,[e('income','gold',1)],'png',3],
 ['human_saint','人間の聖職者','human','priest',3,2,[e('develop','faith',1),e('vp','vp',1,'faithLevel')],'png',3],
 ['human_sorcerer','人間の呪い師','human','mage',3,4,[e('place','faith',1),e('power','power',1,'faithLevel')],'png',3],
 ['human_smith','人間の大工','human','artisan',5,2,[e('place','tech',1),e('vp','vp',2,'techLevel')],'webp',3],
 ['human_great_marchant','人間の大商人','human','merchant',2,2,[e('income','gold',2)],'png',2],
 ['human_undertaker','人間の葬儀屋','human','artisan',3,2,[e('place','tech',1),e('noWar','vp',2)],'png',2],
 ['human_king','人間の君主','human','ruler',6,6,[e('place','vp',1,'race'),e('final','tripleGold',1)],'png',1],
 ['dwarf_pugilist','ドワーフの拳闘士','dwarf','warrior',2,5,[e('place','tech',1)],'jpg',3],
 ['dwarf_gem','ドワーフの鉱石屋','dwarf','merchant',3,4,[e('place','tech',1),e('income','gold',1,'techLevel')],'jpg',3],
 ['dwarf_cook','ドワーフの料理人','dwarf','artisan',2,1,[e('develop','tech',1),e('vp','vp',1,'techLevel')],'png',3],
 ['dwarf_saint','ドワーフの神官','dwarf','priest',4,6,[e('develop','tech',1),e('develop','faith',1)],'png',3],
 ['dwarf_alchemist','ドワーフの錬金術師','dwarf','mage',2,2,[e('power','power',2,'faithLevel'),e('income','gold',1)],'jpg',3],
 ['dwarf_beer','ドワーフのビール職人','dwarf','artisan',6,2,[e('vp','vp',3,'techLevel')],'png',2],
 ['dwarf_gardian','ドワーフの聖堂守り','dwarf','priest',4,5,[e('income','gold',1),e('vp','vp',1,'cost4Plus')],'webp',2],
 ['dwarf_king','ドワーフの王','dwarf','ruler',7,7,[e('place','tech',5),e('place','vp',1,'race')],'png',1],
 ['elf_archer','エルフの射手','elf','warrior',2,3,[e('alwaysPower','power',1)],'png',3],
 ['elf_marchant','エルフの交易人','elf','merchant',1,2,[e('place','faith',1),e('income','gold',1)],'png',3],
 ['elf_artist','エルフの芸術家','elf','artisan',3,1,[e('vp','vp',2,'techLevel')],'png',3],
 ['elf_mistic','エルフの神秘家','elf','mage',2,2,[e('place','faith',1),e('power','power',2,'faithLevel')],'png',3],
 ['elf_saint','エルフの祈り手','elf','priest',1,2,[e('place','vp',1,'faithLevel'),e('develop','faith',1)],'jpg',3],
 ['elf_caster','エルフの魔術師','elf','mage',6,3,[e('power','power',3,'faithLevel'),e('war','vp',1,'faithLevel')],'png',2],
 ['elf_queen','エルフの女王','elf','ruler',7,7,[e('place','faith',5),e('place','vp',1,'race')],'jpg',1],
 ['elf_follower','エルフの信奉者','elf','priest',3,3,[e('place','faith',2),e('vp','vp',1,'faithLevel')],'jpg',2],
 ['goblin_soldier','ゴブリンの兵士','goblin','warrior',1,4,[e('war','vp',1)],'jpg',3],
 ['goblin_scavenger','ゴブリンのゴミ売り','goblin','merchant',2,3,[e('war','vp',1),e('income','gold',1)],'jpg',3],
 ['goblin_junk','ゴブリンのガラクタ集め','goblin','artisan',2,4,[e('place','tech',1),e('war','vp',1)],'jpg',3],
 ['goblin_saint','ゴブリンの祈祷師','goblin','mage',1,3,[e('place','faith',1),e('power','power',1,'faithLevel')],'jpg',3],
 ['goblin_lunatic','ゴブリンの錯乱者','goblin','priest',2,2,[e('place','faith',1),e('vp','vp',1,'faithLevel')],'jpg',3],
 ['goblin_great_soldier','ゴブリンの百人長','goblin','warrior',2,5,[e('war','vp',2)],'jpg',2],
 ['goblin_strategist','ゴブリンの戦術家','goblin','mage',4,4,[e('vp','vp',1,'basePower4Plus')],'jpg',2],
 ['goblin_king','ゴブリンの族長','goblin','ruler',8,2,[e('place','vp',1,'race'),e('vp','vp',1,'cost3Minus')],'jpg',1],
 ['golem_iron','鉄のゴーレム','golem','warrior',2,4,[e('power','power',1,'techLevel'),e('power','power',1,'faithLevel')],'jpg',3],
 ['golem_gold','黄金のゴーレム','golem','merchant',2,4,[e('place','gold',1,'jobTypes')],'png',3],
 ['golem_stollow','藁のゴーレム','golem','mage',5,4,[e('power','power',2,'faithLevel'),e('income','gold',2,'techLevel')],'png',3],
 ['golem_cristal','水晶のゴーレム','golem','priest',6,1,[e('vp','vp',2,'techLevel'),e('vp','vp',2,'faithLevel')],'jpg',2],
 ['golem_king','ゴーレムの王','golem','ruler',6,8,[e('place','equalize',1),e('place','vp',1,'race')],'png',1],
 ['demon_destroy','破壊のデーモン','demon','warrior',5,8,[e('war','vp',1)],'jpg',3],
 ['demon_eye','眼のデーモン','demon','merchant',5,6,[e('income','gold',2)],'jpg',3],
 ['demon_pest','疫病のデーモン','demon','artisan',5,4,[e('vp','vp',4)],'jpg',3],
 ['demon_storm','嵐のデーモン','demon','ruler',9,13,[e('place','vp',1,'race'),e('persistent','doubleBonus',1)],'jpg',1],
];
export const CARDS=list.map(([id,name,race,job,cost,power,effects,ext,copies],index)=>({id,name,race,job,cost,power,effects,image:`assets/${id}.${ext}`,copies,index}));
export const CARD=Object.fromEntries(CARDS.map(c=>[c.id,c]));
const PHASES={place:'配置時',develop:'発展',income:'収入',vp:'VP',war:'戦争VP獲得時',noWar:'戦争VPなし',power:'自身の追加戦力'};
const STATS={gold:'金',tech:'技術点',faith:'信仰点',vp:'VP',power:'戦力'};
const SCALES={faithLevel:'信仰レベル',techLevel:'技術レベル',race:'同種族のユニット数',cost4Plus:'コスト4以上のユニット数',cost3Minus:'コスト3以下のユニット数',basePower4Plus:'基本戦力4以上のユニット数',jobTypes:'職業の種類数'};
export function effectText(effect){
 if(effect.stat==='equalize')return '配置時：技術点と信仰点を高い方に揃える';
 if(effect.stat==='doubleBonus')return '持続：すべての配置ボーナスを2倍';
 if(effect.stat==='tripleGold')return '終了時：お金によるVPを3倍（端数切り捨て後）';
 if(effect.phase==='alwaysPower')return '前線でなくても戦争に参加';
 return `${PHASES[effect.phase]}：${effect.amount}${STATS[effect.stat]}${effect.scale?` × ${SCALES[effect.scale]}`:''}`;
}
