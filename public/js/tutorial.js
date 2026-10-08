import {newGame,level,power,previewPlacement,legalCells,STAT_NAMES} from './engine.js?v=11';
import {CARD,RACES,JOBS} from './cards.js?v=3';

export const TUTORIAL_CHAPTERS=[
 {title:'序盤：王国をつくる',intro:'マグノリアは、カードを王国に配置して勝利点（VP）を稼ぐゲームです。最後に最もVPが多い人が勝ちます。第1章は何もない王国から、手札交換・配置・各フェーズを1回ずつ試します。',goal:'最初の例：人間の行商を置き、その後ろにドワーフの料理人を置いてみましょう。行商の収入、料理人の発展とVPを1ラウンドで確認できます。この練習では、案内したカードと場所だけ操作できます。'},
 {title:'中盤：育てて組み合わせる',intro:'第2章は練習用に準備した途中盤面です。前の章の続きではありません。技術2点・信仰2点、7金から始めます。どちらもあと1点でLv.2。種族と職業、それぞれの3枚揃え、レベルを使う効果、前線の騎士の戦争時効果を試しましょう。',goal:'拳闘士でドワーフの種族揃え、信奉者で聖職者の職業揃えを横に完成させます。前線には人間の騎士を用意しました。戦争報酬を得ると、騎士の効果で追加1VPも獲得できます。'},
 {title:'終盤：勝ち切るタイミング',intro:'第3章も独立した例題です。王国は7体、技術・信仰はLv.3、VPは39。得点用のカードが既にあるため、この1ラウンドで終了条件に到達します。最後の配置を考え、残金を含む最終得点まで確認しましょう。',goal:'戦力を増やす・今すぐVPを増やす・お金を残す、どれがよさそうでしょうか。9体になると終了することも意識して、指定の2枚を置き、終了まで確認してください。'},
];
const specs=[
 {gold:5,tech:0,faith:0,vp:0,board:[],hand:['human_marchant','dwarf_cook','dwarf_pugilist','elf_marchant','demon_storm'],enemy:[],enemyHand:['human_marchant','goblin_soldier','elf_marchant','dwarf_cook','elf_saint']},
 {gold:7,tech:2,faith:2,vp:12,board:[['dwarf_cook',0,0],['dwarf_gem',1,0],['human_saint',0,1],['elf_saint',1,1],['human_knight',0,-1]],hand:['dwarf_pugilist','elf_follower','golem_iron','elf_artist','human_great_marchant'],enemy:[['human_knight',0,0],['human_marchant',1,0],['elf_saint',0,1]],enemyHand:['goblin_soldier','elf_marchant','human_great_marchant','dwarf_cook','elf_artist']},
 {gold:8,tech:7,faith:7,vp:39,board:[['golem_iron',0,0],['human_knight',1,0],['elf_mistic',2,0],['dwarf_cook',0,1],['human_saint',1,1],['elf_artist',2,1],['human_marchant',0,2]],hand:['elf_follower','dwarf_beer','elf_saint','human_great_marchant','demon_destroy'],enemy:[['demon_pest',0,0],['goblin_great_soldier',1,0],['elf_archer',2,0],['human_great_marchant',0,1]],enemyHand:['goblin_soldier','elf_marchant','human_saint','dwarf_cook','golem_gold']},
];
export function tutorialGame(name,chapter=0){
 if(!Number.isInteger(chapter)||!specs[chapter])throw Error('練習の章が見つかりません。');
 const g=newGame([{id:'human',name:name.trim()||'あなた',cpu:false},{id:'cpu-0',name:'宿屋の常連',cpu:true,cpuDifficulty:'normal'}],{warVP:[4,0]});
 // 配られたカードを戻し、練習用のカードを実際の山札から取る。
 for(const p of g.players){g.deck.push(...p.hand);p.hand=[];}
 const take=id=>{const i=g.deck.indexOf(id);if(i<0)throw Error(`練習用カードが不足：${id}`);return g.deck.splice(i,1)[0];};
 const s=specs[chapter],own=g.players[0],enemy=g.players[1];
 Object.assign(own,{gold:s.gold,tech:s.tech,faith:s.faith,vp:s.vp});
 Object.assign(enemy,{gold:chapter?6:5,tech:chapter?3:0,faith:chapter?3:0,vp:chapter===2?35:chapter===1?13:0});
 own.board=s.board.map(([id,x,y])=>({card:take(id),x,y}));
 enemy.board=s.enemy.map(([id,x,y])=>({card:take(id),x,y}));
 own.hand=s.hand.map(take);enemy.hand=s.enemyHand.map(take);
 if(chapter===0)g.deck.push(take('elf_saint'));
 own.power=power(own);enemy.power=power(enemy);
 g.tutorial=true;g.tutorialChapter=chapter;return g;
}

export const TUTORIAL_REFERENCE=[
 {title:'何をするゲーム？ どうなったら勝ち？',paragraphs:['手札からカードを最大2枚ずつ王国へ置き、戦争・カードの効果・配置ボーナスでVPを稼ぎます。戦争だけでなく、毎ラウンドVPを生む王国をつくることも勝ち方です。','誰かが40VP以上、または王国に9体配置したラウンドの最後に終了します。その瞬間には終わらず、全員の戦争・発展・収入・VPを処理してから残金を得点にします。最後に最もVPが高い人が勝ち。同点なら同時優勝です。']},
 {title:'お金・戦力・技術・信仰・VPの違い',paragraphs:['お金は配置の支払いに使います。戦力は戦争の順位を決める数値。VPは勝敗を決める得点です。現在のVP順位と戦争順位は別なので、戦力で負けていてもVPで勝つことはあります。','技術点と信仰点は、カードの効果を伸ばすための技術・信仰点です。支払いに使うお金とは違い、効果を使っても消費しません。ただし、そのレベルを参照するカードがなければ、レベルを上げただけで全カードの戦力やVPが増えるわけではありません。']},
 {title:'技術・信仰は何点で強くなる？',paragraphs:['点数とレベルは別です。0点＝Lv.0、1〜2点＝Lv.1、3〜6点＝Lv.2、7〜14点＝Lv.3、15点＝Lv.4。点数は15、レベルは4が上限です。盤面のバーは今の点数、下の目盛りは次のレベルへの境目です。','たとえば技術2→3点はLv.1→2になるので、エルフの芸術家の「2VP×技術レベル」は毎ラウンド2→4VPになります。技術3→4点はLv.2のまま。同じ1点でも、境目を越えると効果が大きく伸びます。','信仰を使う例は人間の聖職者の「1VP×信仰レベル」やエルフの神秘家の「自身の追加戦力2×信仰レベル」。神秘家は基本戦力2なので、前線なら信仰Lv.2で戦力6です。技術と信仰は、それぞれ使えるカードと組み合わせて育てましょう。']},
 {title:'カードはどこを見る？',paragraphs:['左上の金額が配置コスト、その下の剣の数値が基本戦力です。種族と職業は3枚揃えの条件。下の効果欄では「いつ」「何が」「いくつ増えるか」を見ます。カードの詳細でも効果を確認できます。','「配置時」は置いた瞬間に1回、「発展」「収入」「VP」はそのフェーズごとに発動。「戦争VP獲得時」は戦争の報酬VPをもらえた場合に発動します。数字が大きいカードも、支払えるか、前線に置けるか、効果の条件を満たせるかを確認しましょう。']},
 {title:'手札交換は何を捨てる？',paragraphs:['毎ラウンドのドローで、残っている手札から好きな枚数を捨てて5枚まで補充します。捨てなくても補充されます。交換はそのラウンドで1回だけ。捨てたカードの代わりに何が来るかは分かりません。','最初は今のお金で置けるカードを残すと動きやすくなります。ただし、高いカードでも次に置きたいなら残せます。中盤以降は自分の技術・信仰で効果が伸びるカード、あと1枚で種族・職業が揃うカードを探しましょう。']},
 {title:'配置の操作・順番・取り消し',paragraphs:['カードを選び、王国の「＋」を押すかタップして配置します。PCではドラッグ、スマホでも上下にドラッグして配置できます。スマホの手札を横にスワイプすると、別のカードが見えます。2枚目の手札は1枚目を置いた後の残りから選びます。','配置は仮置きです。お金・効果・戦力の変化を見て、「最後の配置を戻す」でやり直せます。最後に配置を確定します。オンラインでは全員の確定後に順番に処理が表示されます。','1枚ごとに支払い→配置時効果→配置ボーナスの順に処理します。1枚目で得たお金や技術・信仰点を2枚目に使える場合があるので順番も大切です。置かない枠1つにつき1金を配置処理の後にもらいます。この報酬を今回の配置代金には使えません。お金が足りないカードは配置・ドラッグできません。']},
 {title:'どこに置く？ 前線と3×3の考え方',paragraphs:['カードは上下左右につなげて置きます。斜めだけの接続は不可。王国全体の幅・高さはそれぞれ3マスまで。最初のカードの最終的な位置は、あとからどちらへ広げたかで決まります。','画面の上が前方。各縦列で一番上にある1体が前線で、原則そのカードの戦力だけを合計します。高戦力カードを同じ列の後ろに置いても戦力は増えません。前に置くと前線が交代します。エルフの射手のような、後ろからでも参戦できる例外があります。','後列でも収入・発展・VPなどの効果は使えます。戦うカードを前、王国を支えるカードを後ろに置くと役割が分かりやすくなります。配置済みカードは移動・置き換えできず、王国全体もずらせません。空きをどこに残すかも考えましょう。']},
 {title:'3枚揃えると何が起きる？',paragraphs:['縦か横の1列3枚を、同じ種族または同じ職業で揃えると配置ボーナスが出ます。列が揃うと1回発動し、次のラウンドに自動で繰り返すものではありません。同時に複数列や種族・職業が揃えば、すべて発動します。','種族：人間5VP／ドワーフ技術2／エルフ信仰2／ゴブリン3金／ゴーレム技術2＋信仰2／デーモン7VP。職業：戦士3金／商人5VP／職人技術2／聖職者信仰2／魔術師1金＋3VP／君主9VP。','2枚揃ったからといって3枚目を無理に探す必要はありません。支払い、前線、カード効果と両立できると強力です。第2章では、上の横列でドワーフの種族揃え、下の横列で聖職者の職業揃えを試せます。種族か職業のどちらかが一致すれば成立し、両方を揃える必要はありません。']},
 {title:'1ラウンドに起こること',paragraphs:['ドローで手札を整える→配置で最大2枚置く→戦争で前線の戦力を比べる→発展で技術・信仰を増やす→収入で基本3金とカードの収入を得る→VPフェーズでカードの得点を得る、の順です。','配置後のお金が少なくても、収入フェーズには基本3金が入ります。発展でレベルが上がると、その後の収入・VPでは新しいレベルを参照します。戦争は発展より先なので、このラウンドの発展で得るレベルを今の戦争には使えません。','2人戦の戦争報酬は標準で1位4VP・2位0VP。3人以上は1位5VP・2位3VP・3位以下0VP。設定で変更できます。同戦力は同順位で、次の順位を飛ばします。中央の増減メッセージで、どの効果によって増えたか確認しましょう。']},
 {title:'序盤・中盤・終盤はどう動く？',paragraphs:['序盤は安いカードで、収入や毎ラウンドの発展・VPをつくると後の選択が増えます。「毎ラウンド＋1」のカードも早く置けば何度も使えます。高いカードだけを集めると、置けないまま手番を終えることがあります。','中盤は、既にあるカードに合う技術・信仰、3枚揃え、前線の強化を比べます。戦力は自分の合計だけでなく相手との比較が大切。相手を越えられるか、今の順位を保てるかを見てからお金を使いましょう。','終盤は残りの得点機会が少なくなります。収入を育てるより今すぐVPを取る方がよいこともあります。9体目を置くとそのラウンドで終了するため、まだ王国を育てたいなら空きを残す選択もできます。逆にリードしているなら終了を早める考え方もあります。']},
 {title:'最後のお金と、よくある勘違い',paragraphs:['終了時は残金3金につき1VP、端数切り捨て。たとえば8金なら2VP、9金なら3VPです。人間の君主がいる場合は、このお金のVPを3倍にします。終了ラウンドの収入も含めた残金で計算します。','技術・信仰そのものは最後にVPへ換算されません。レベルを使うカードが得点を生みます。お金を使い切る・必ず2枚置く・戦力だけを伸ばす、といった動きが毎回正解とは限りません。王国の得点源と相手、終わるタイミングを一緒に見ましょう。']},
];
const phaseLessons={
 place:['配置：先に代金、そのあと効果','各カードの処理は支払い→配置時効果→配置ボーナス。中央で理由つきの増減を確認します。置かなかった枠の1金は、今回の配置が終わってから入ります。'],
 war:['戦争：相手と前線を比べる','各縦列の金色の前線の戦力を合計します。2人戦のこの練習では1位4VP、2位0VP。同じ戦力なら両者1位。戦争VPを得たときだけ働くカードの追加効果も確認しましょう。'],
 develop:['発展：点数とレベルの両方を見る','発展のカードで技術・信仰が増えます。1・3・7・15点に達するとレベルが上がります。この後の収入・VPの効果には新しいレベルを使います。'],
 income:['収入：次に使うお金をつくる','基本収入3金は毎ラウンド全員が得ます。さらに収入カードの効果を加えます。次の配置で使える金額が増えたか、終了する場合は残金の得点がいくつになるかを見ましょう。'],
 vp:['VP：王国が生む得点を確認','VP効果は前線・後列を問わず発動します。技術・信仰レベルを参照するカードは、発展後のレベルで計算します。戦争以外の得点源も王国に用意することが大切です。'],
 final:['最終得点：残金も足して勝敗を決める','全フェーズの後、残ったお金を3金につき1VPにします。最終VPが最も高い人が勝ち。同点なら同時優勝。技術・信仰点をそのまま得点には加えません。'],
};
export function tutorialGuide({chapter=0,phase,moves=0,replayPhase=null}){
 const lesson=TUTORIAL_CHAPTERS[chapter]??TUTORIAL_CHAPTERS[0];
 if(!replayPhase&&['round','ended'].includes(phase))return {step:4,title:chapter===2?'3章の練習、おつかれさまでした！':'この章の1ラウンドを完了！',text:chapter===0?'お金を払ってカードを置き、戦争・発展・収入・VPが順に発生する流れを体験しました。次は途中盤面から、技術・信仰点と組み合わせを練習します。':chapter===1?'技術・信仰点は使うカードと組み合わせると役立ちます。3枚揃えとレベルの境目も確認できましたか？ 次は終了直前の盤面で、最後の得点まで体験します。':'最終結果は戦争だけでなく、カードのVP・配置ボーナス・残金の合計で決まります。勝っても負けても練習は完了です。下の解説はいつでも読み直せます。通常対戦では同じ考え方を、自分の引いたカードで試してみましょう。',target:null,done:true};
 if(replayPhase&&replayPhase!=='draw'){const [title,text]=phaseLessons[replayPhase]??phaseLessons.vp;return {step:3,title,text,target:'.replay-controls'};}
 if(phase==='draw'||replayPhase==='draw')return {step:1,title:'手札を整える：置けるカードを残そう',text:chapter===0?'最初は5金・手札5枚です。今回は収入・技術・信仰を試せる安いカードと、今は置けない9金の嵐のデーモンを用意しました。不要なカードを押して選び「交換を確定」。そのまま「交換せず補充」でも進めます。':`${lesson.goal} まず手札のコストと効果を確認し、使いたいカードを残しましょう。用意された手札のまま練習するなら「交換せず補充」で進めます。`,target:'.hand'};
 return {step:2,title:moves?'仮置きの結果を見て、次の一手を考える':'配置する：カードの役割と置き場所を選ぼう',text:moves?'仮置きで変わったお金・技術・信仰・戦力を見ましょう。「最後の配置を戻す」でやり直せます。2枚目の代金は今表示されているお金から支払います。1枚だけでも、何も置かなくても確定できます。準備ができたら配置を確定してください。':`${lesson.goal} 手札を選んで「＋」を押すかタップ、またはドラッグして仮置きします。上が前方。前線のカードで戦力を、後列のカードで収入や発展・VPを支える配置を試してみましょう。`,target:moves?'#confirmButton':'.hand'};
}
export function tutorialObservation(player,opponents=[]){
 if(!player)return [];
 const tips=[`現在 ${player.gold}金、戦力${power(player)}、技術${player.tech}点（Lv.${level(player.tech)}）、信仰${player.faith}点（Lv.${level(player.faith)}）。`];
 for(const stat of ['tech','faith']){const next=[1,3,7,15].find(n=>n>player[stat]);if(next)tips.push(`${stat==='tech'?'技術':'信仰'}はあと${next-player[stat]}点でLv.${level(next)}。伸びる効果をカードの詳細で確認しましょう。`);}
 const enemy=opponents[0];if(enemy)tips.push(`相手の公開盤面の戦力は${power(enemy)}。まだ確定していない配置で変わるので、今の値は目安です。`);
 // 実際に合法な1枚配置で成立するボーナスだけを案内する。
 outer:for(let i=0;i<player.hand.length;i++)for(const cell of legalCells(player.board)){
  if(CARD[player.hand[i]].cost>player.gold)continue;
  const result=previewPlacement(player,[{handIndex:i,...cell}]);
  const bonuses=result.placed[0].bonuses;
  if(bonuses.length){tips.push(`${CARD[player.hand[i]].name}は、置く場所によって${bonuses.map(b=>(b.type==='race'?RACES:JOBS)[b.value]).join('・')}の3枚揃えをつくれます。仮置きでボーナスを確認してみましょう。`);break outer;}
 }
 if(player.board.length>=7)tips.push(`いま${player.board.length}/9体。9体になったラウンドで終了します。終える前に、カードのVP効果と残金を確認しましょう。`);
 return tips;
}

// 解決済みの実際の記録を使い、効果がないフェーズも理由を伝える。
export function tutorialPhaseOutcome(resolution,phase,you='human'){
 if(!resolution||phase==='draw')return [];
 const events=resolution.events.filter(e=>e.phase===phase&&e.playerId===you);
 if(!events.length)return [];
 const p=events.at(-1).after,changes=events.flatMap(e=>e.changes);
 if(changes.length)return changes.map(c=>`${c.source}：${STAT_NAMES[c.stat]} ${c.before}→${c.after}${['tech','faith'].includes(c.stat)?`（Lv.${level(c.before)}→Lv.${level(c.after)}）`:''}。`);
 if(phase==='war')return [`あなたは戦力${p.power}で戦争${p.rank}位。今回の戦争報酬は${p.warVP}VPです。報酬が0VPなので、得点を得たときだけの追加効果も発動しません。戦争で得点がなくても、この後の発展・収入・VPは処理されます。`];
 const cards=p.board.flatMap(b=>CARD[b.card].effects.filter(e=>e.phase===phase).map(e=>({card:CARD[b.card],effect:e})));
 if(!cards.length)return [phase==='develop'?'今回のあなたの王国には「発展」の効果を持つカードがないため、技術・信仰は増えません。フェーズが飛ばされたわけではありません。ドワーフの料理人や人間の聖職者などを置くと、毎ラウンド技術・信仰を伸ばせます。':phase==='vp'?'今回のあなたの王国には「VP」フェーズで得点するカードがないため、ここでは増えません。戦争や配置ボーナスで得たVPは残っています。料理人・芸術家・聖職者など、王国に合う得点源を探しましょう。':phase==='final'?'今回の残金は3金未満のため、残金による得点は0VPです。端数のお金は得点になりません。':'このフェーズでは、あなたの値を変える効果がありません。カードの効果に書かれた発動タイミングを確認しましょう。'];
 return cards.map(({card,effect})=>{
  if(effect.scale==='techLevel'&&level(p.tech)===0)return `${card.name}は技術レベルを参照しますが、今はLv.0なので得られる量が0です。技術を1点以上にすると働き始めます。`;
  if(effect.scale==='faithLevel'&&level(p.faith)===0)return `${card.name}は信仰レベルを参照しますが、今はLv.0なので得られる量が0です。信仰を1点以上にすると働き始めます。`;
  if(['tech','faith'].includes(effect.stat)&&p[effect.stat]===15)return `${card.name}の発展効果はありますが、${STAT_NAMES[effect.stat]}は既に上限15点のため増えません。`;
  return `${card.name}の効果はありますが、今回の条件では値が増えません。カードの詳細で参照する値・条件を確認しましょう。`;
 });
}

// A lesson permits only its current action. Derive the next task from the draft,
// so undoing a placement restores the previous task without a separate counter.
export function tutorialTask(chapter,phase,hand=[],moves=0,discard=[]){
 if(phase==='draw'){
  const index=chapter===0?hand.indexOf('demon_storm'):-1;
  const ready=chapter===0?discard.length===1&&discard[0]===index:discard.length===0;
  return {handIndex:index,canConfirm:ready,purpose:['今は5金なので、9金のデーモンを交換します。行商と料理人は残し、このラウンドから収入・発展・VPを働かせる準備をしましょう。','拳闘士で3枚揃えと前線強化、信奉者で信仰Lv.2を狙うため、この2枚を残します。戦争報酬を得たときに、用意した騎士の追加1VPも発動することを確かめましょう。','信奉者と祈り手で最後のVPを増やし、9体配置から最終得点まで確認するため、今回は手札を交換しません。'][chapter],text:chapter===0?'まず9金の「嵐のデーモン」を選び、「交換を確定」を押しましょう。今は5金なので、使えるカードに交換します。':'この章は用意した手札を使います。「交換せず補充」を押して配置へ進みましょう。'};
 }
 if(phase!=='place')return null;
 const steps=[
  [['human_marchant',0,0,'最初に「人間の行商」を光る＋へ置きましょう。1金で配置でき、収入の土台になります。'],['dwarf_cook',0,1,'次に「ドワーフの料理人」を行商の下の光る＋へ。後ろでも発展・VPの効果は働きます。']],
  [['dwarf_pugilist',2,0,'「ドワーフの拳闘士」をドワーフ2枚の右へ。同じ種族が横に3枚揃う技術ボーナスを見ましょう。'],['elf_follower',2,1,'「エルフの信奉者」を聖職者2枚の右へ。種族が違っても、同じ職業が横に3枚揃うボーナスを見ましょう。']],
  [['elf_follower',1,2,'「エルフの信奉者」を下段中央へ。信仰を増やし、VPを得るカードを加えます。'],['elf_saint',2,2,'「エルフの祈り手」を下段右へ。配置時VPを確認し、9体になった王国の最終ラウンドを見届けましょう。']]
 ][chapter];
 const step=steps?.[moves];
 if(!step)return {handIndex:-1,canConfirm:moves===2,purpose:'行動を確定して、置いたカードが戦争・発展・収入・VPでどう働くかを順番に確認します。',text:'2枚置けました。お金と効果の変化を確認し、「2枚の配置を確定」を押しましょう。取り消すと前の手順へ戻れます。'};
 return {card:step[0],handIndex:hand.indexOf(step[0]),x:step[1],y:step[2],canConfirm:false,text:step[3],purpose:chapter===1&&moves===1?'下の横列には、人間の聖職者とエルフの祈り手がいます。種族は違いますが、職業はどちらも「聖職者」。信奉者も聖職者なので右に並べ、職業だけの一致でも3枚揃えが成立することを確かめます。':placementPurpose(step[0])};
}
export function tutorialPlacementAllowed(task,handIndex,x,y){return !!task?.card&&task.handIndex===handIndex&&task.x===x&&task.y===y;}
// Staggered columns show that the front is decided independently in each column.
export const TUTORIAL_FRONTLINE=[
 {card:'human_knight',x:0,y:0},
 {card:'dwarf_cook',x:0,y:1},{card:'dwarf_pugilist',x:1,y:1},
 {card:'human_marchant',x:0,y:2},{card:'elf_follower',x:1,y:2},{card:'elf_mistic',x:2,y:2}
];
export const TUTORIAL_SLIDES=[
 {title:'チュートリアルへようこそ！',text:'宿屋の卓で、一緒にマグノリアについて学びましょう。まずはゲームとラウンドの仕組みを絵で知り、そのあと短い盤面練習へ。全ラウンドを遊ばなくても、序盤から終盤まで体験できます。',kind:'welcome',section:'ようこそ'},
 {title:'自分の王国をつくり、VPを稼ぐゲーム',text:'手札からカードを置いて王国を広げます。戦争の報酬やカードの効果で勝利点（VP）を増やし、最後に最もVPが多い人が勝ちます。誰かが40VP、または9体配置したラウンドの最後に終了します。',kind:'kingdom',section:'ゲームの概要'},
 {title:'1ラウンドは、この6つのフェーズ',text:'手札交換と配置を決めたら、全員の確定後に戦争・発展・収入・VPを順番に処理します。終了条件に届いていなければ、また手札交換から。ここから一つずつ、何をする時間なのか見ていきましょう。',kind:'flow',section:'ラウンドの流れ'},
 {title:'① ドロー：使いたい手札を整える',text:'手札から不要なカードを好きな枚数だけ捨てて、5枚になるまで補充します。交換はラウンドに1回。捨てなくても足りない分は引けます。最初は5金なので、すぐ置けるカードを残してみましょう。',kind:'draw',phase:'draw',section:'各フェーズ'},
 {title:'② 配置：お金を払い、最大2枚を置く',text:'1枚ずつコストを払い、王国のカードへ上下左右につなげて置きます。王国の幅・高さはそれぞれ3マスまで。置いたカードは動かせません。置かない枠1つにつき1金を配置処理の後にもらうので、今回の支払いには使えません。',kind:'placement',phase:'place',section:'各フェーズ'},
 {title:'③ 戦争：各縦列の先頭が、前線',text:'画面の上が前方です。それぞれの縦列で一番上にあるカードの戦力を合計して比べます。金色の3枚は、段が違ってもすべて前線。この2人戦では1位4VP・2位0VP。同戦力は同順位です。後ろのカードも、発展・収入・VPの効果は働きます。',kind:'front',phase:'war',section:'各フェーズ'},
 {title:'④ 発展：技術点・信仰点を増やす',text:'「発展」の効果を持つカードが働きます。料理人なら技術＋1、祈り手なら信仰＋1。置いておけば毎ラウンド発動します。対応するカードがなければ、この時間には増えません。点数とレベルの使い道は、このあと説明します。',kind:'develop',phase:'develop',section:'各フェーズ'},
 {title:'⑤ 収入：次の配置に使うお金を得る',text:'全員が基本収入3金を受け取ります。さらに「収入」のカードがあれば、その効果も加えます。行商1枚なら合計4金。配置でお金を使っても、ここで次のラウンドの資金を得られます。',kind:'income',phase:'income',section:'各フェーズ'},
 {title:'⑥ VP：王国のカードで得点する',text:'「VP」の効果を持つカードが得点を生みます。料理人なら技術レベル×1VP、信奉者なら信仰レベル×1VP。直前の発展で上がったレベルを使います。対応するカードがない、または参照するレベルが0なら、ここではVPが増えません。',kind:'scoring',phase:'vp',section:'各フェーズ'},
 {title:'カードの効果は「いつ」と「何が」を見る',text:'「配置時」は置いた瞬間に1回。「発展・収入・VP」は毎ラウンド、その時間に発動します。信奉者は配置時に信仰＋2、その後は毎ラウンドのVPで信仰レベル分を得点します。配置の処理順は、支払い → 配置時効果 → 3枚揃えのボーナスです。',kind:'effects',section:'カードの効果'},
 {title:'技術・信仰って、何に使うの？',text:'点数が1・3・7・15になるとレベルが上がり、そのレベルを参照するカードの効果が強くなります。支払い用のお金と違い、効果を使っても点数は消費しません。技術・信仰そのものは得点にならないので、対応するカードと組み合わせましょう。',kind:'levels',section:'技術と信仰'},
 {title:'では、実際の盤面でやってみましょう！',text:'光るカードと光る＋を順番に操作します。まず手札交換、そのあと2枚配置。続く戦争・発展・収入・VPは一つずつ進め、何によって増えたのか確認しましょう。詳しい説明はいつでも「解説集」で読めます。',kind:'practice',section:'盤面で練習'}
];

const placementPurposes={
 human_marchant:'行商を早く置くと、この後の収入で毎ラウンド＋1金。次のカードを買うための土台をつくる練習です。',
 dwarf_cook:'料理人は発展で技術＋1、その技術レベルを使ってVPを生みます。「点数を育てる→得点にする」つながりと、後方でも効果が働くことを確かめます。',
 dwarf_pugilist:'上の横列には、料理人と鉱石屋のドワーフ2枚がいます。右にドワーフの拳闘士を並べ、同じ種族の3枚揃えで技術＋2を得る練習です。職業が違っても、種族が一致すれば成立します。',
 elf_follower:'信奉者は置いた瞬間に信仰＋2。その信仰レベルを使って、自身や聖職者がVPを生みます。レベルを育てるカードと得点するカードを組み合わせます。',
 elf_saint:'祈り手は置いた瞬間に信仰レベル分のVPを得ます。今回は9体目にして、終了条件に届いても発展・収入・VPまで処理することを確かめます。'
};
function placementPurpose(card){return placementPurposes[card]??'カードを置いた後、効果と増減の理由を確認しましょう。';}
const changeValue=c=>`${STAT_NAMES[c.stat]} ${c.before}→${c.after}${['tech','faith'].includes(c.stat)?`（Lv.${level(c.before)}→Lv.${level(c.after)}）`:''}`;
function eventLearning(event,past,chapter,you,preview=false){
 if(!event||event.playerId!==you||!event.after||event.phase==='draw')return null;
 const p=event.after,changes=event.changes??[];
 const placed=new Set(past.filter(e=>e.phase==='place'&&e.playerId===you&&e.card).map(e=>e.card));
 const origin=card=>preview?'いま仮に置いた':placed.has(card)?'さっき置いた':'最初から盤面にいた';
 let card=event.card??null,title='',paragraphs=[];
 if(event.phase==='place'&&card){
  const c=CARD[card],cost=changes.find(x=>x.source===c.name+'の配置コスト');
  const effects=changes.filter(x=>!x.source.endsWith('の配置コスト'));
  const pos=p.board.find(b=>b.card===card),front=pos&&!p.board.some(b=>b.x===pos.x&&b.y<pos.y);
  title=`${c.name}を置いた結果`;
  if(effects.length){
   const bonuses=effects.filter(x=>/の(種族|職業)ボーナス/.test(x.source));
   if(bonuses.length){
    title=bonuses.some(x=>x.source.includes('職業'))?'種族が違っても、聖職者3枚で職業揃え！':'職業が違っても、ドワーフ3枚で種族揃え！';
    for(const bonus of bonuses){
     const type=bonus.source.includes('種族')?'race':'job';
     const candidates=[p.board.filter(b=>b.y===pos.y).sort((a,b)=>a.x-b.x),p.board.filter(b=>b.x===pos.x).sort((a,b)=>a.y-b.y)];
     const line=candidates.find(line=>line.length===3&&line.every(b=>CARD[b.card][type]===c[type]));
     if(line)paragraphs.push(`${line===candidates[0]?'横':'縦'}1列に「${line.map(b=>CARD[b.card].name).join('」「')}」の3枚が並びました。${type==='race'?`職業は${line.map(b=>JOBS[CARD[b.card].job]).join('・')}と別々ですが、種族は全員「${RACES[c.race]}」`:`種族は${line.map(b=>RACES[CARD[b.card].race]).join('・')}で一致していませんが、職業は全員「${JOBS[c.job]}」`}なので、${bonus.source}が発動して${STAT_NAMES[bonus.stat]}＋${bonus.delta}（${bonus.before}→${bonus.after}）を得ました。`);
    }
    paragraphs.push('縦か横の1列3枚で、種族か職業のどちらかが同じなら成立します。斜めや、王国内にばらばらの3枚では成立しません。3枚目を置いて列が完成したときに1回だけ得る配置ボーナスです。');
   }else paragraphs.push(`${origin(card)}${c.name}のおかげで、${effects.map(changeValue).join('、')}になりました。`);
   if(card==='dwarf_pugilist')paragraphs.push('配置時効果で技術＋1、横に並べたドワーフ3枚の種族ボーナスでさらに＋2。配置前の技術2点から5点へ進み、Lv.1→2になりました。');
   else if(card==='elf_follower'&&bonuses.length)paragraphs.push('信奉者自身の配置時効果で信仰2→4（＋2、Lv.1→2）、その後に聖職者の職業ボーナスで4→6（さらに＋2、Lv.2のまま）。カードの効果と3枚揃えの報酬は別々に得ています。後のVPでは、信奉者だけでなく、最初からいた人間の聖職者も1VP→2VPを生む状態になりました。');
   else if(card==='elf_follower')paragraphs.push(level(effects[0].before)!==level(effects[0].after)?'信仰が3点の境目を越えてLv.2に。後のVPでは、信奉者だけでなく、最初からいた人間の聖職者も1VP→2VPを生むようになります。':'信仰の点数は増えましたが、レベルはそのまま。VPを決めるのはレベルなので、今回の信奉者のVP効果はまだ増えません。');
   else if(card==='elf_saint')paragraphs.push(`祈り手の「配置時：信仰レベル×1VP」は、置いた今だけ発動します。これで王国が${p.board.length}体に。9体なら、このラウンドの最後まで処理して終了します。`);
  }else if(card==='human_marchant'){
   paragraphs.push(`${origin(card)}行商は、今すぐお金を増やすカードではありません。${cost?`${changeValue(cost)}で代金を払いました。`:''}この後の「収入」で＋1金を得るために置きました。`);
   paragraphs.push(`行商は前線なので戦力3で参戦します。収入の土台をつくりながら、前線の戦力も用意できました。`);
  }else if(card==='dwarf_cook'){
   paragraphs.push(`${origin(card)}料理人は、後方にいても「発展：技術＋1」と「VP：技術レベル×1VP」が働きます。${cost?`${changeValue(cost)}で代金を払いました。`:''}`);
   paragraphs.push('いま技術は0なので、VP効果も0の状態です。次の発展で技術が1点・Lv.1になり、その後のVPで1VPを生む流れを見ましょう。');
  }else paragraphs.push(placementPurpose(card));
  if(!front&&card==='dwarf_cook')paragraphs.push('後方の料理人は戦力に加算されません。前で戦う行商と、後ろで王国を育てる料理人の役割を分けました。');
 }else if(event.phase==='war'){
  const fronts=p.board.filter(b=>!p.board.some(other=>other.x===b.x&&other.y<b.y));
  card=fronts.find(b=>placed.has(b.card))?.card??fronts[0]?.card;
  const warEffects=changes.filter(change=>p.board.some(b=>change.source===CARD[b.card].name+'の効果'&&CARD[b.card].effects.some(e=>e.phase==='war')));
  if(warEffects.length)card=p.board.find(b=>warEffects.some(c=>c.source===CARD[b.card].name+'の効果'))?.card;
  title=warEffects.length?'戦争の報酬が、騎士の追加VPも発動させました':'置き場所が、戦うカードを決めました';
  paragraphs.push(`今回の前線は${fronts.map(b=>CARD[b.card].name).join('・')||'なし'}。その戦力を合計した${p.power}で戦争${p.rank}位、報酬${p.warVP}VPになりました。`);
  for(const extra of warEffects){const id=p.board.find(b=>extra.source===CARD[b.card].name+'の効果').card;paragraphs.push(`戦争の報酬${p.warVP}VPを得たので、${origin(id)}${CARD[id].name}の「戦争VP獲得時」の効果も発動！ さらに${extra.delta}VPを得ました（VP ${extra.before}→${extra.after}）。戦争報酬が0VPなら、この追加効果は発動しません。`);}
  if(chapter===0&&p.board.some(b=>b.card==='dwarf_cook'))paragraphs.push('さっき置いた行商が前で戦い、後方の料理人は参戦していません。料理人を後ろに置いた目的は、この後の発展とVPで王国を支えることです。');
  else paragraphs.push('前線だけで比べるため、後ろに高戦力カードを置いても原則として戦力は増えません。この後は後方のカードも効果を発揮します。');
 }else if(event.phase==='income'){
  const earning=changes.filter(x=>x.stat==='gold'),extra=earning.filter(x=>x.source!=='基本収入');
  card=p.board.find(b=>extra.some(x=>x.source===CARD[b.card].name+'の効果')&&placed.has(b.card))?.card??p.board.find(b=>extra.some(x=>x.source===CARD[b.card].name+'の効果'))?.card;
  title=card?`${CARD[card].name}を置いた狙いが、収入になりました`:'基本収入で、次の資金を得ました';
  paragraphs.push(extra.length?`${extra.map(x=>{const b=p.board.find(b=>x.source===CARD[b.card].name+'の効果');return `${b?origin(b.card)+CARD[b.card].name:x.source}のおかげで＋${x.delta}金`;}).join('、')}。基本収入3金に上乗せされ、今回のお金は${earning[0].before}→${p.gold}金になりました。`:`カードの収入がなくても、基本収入3金でお金は${earning[0]?.before??p.gold}→${p.gold}金になります。`);
  paragraphs.push(chapter===2?'最後の収入も残金に含まれます。この後の最終得点で、3金につき1VPへ換算します。':'収入は配置時だけではなく、毎ラウンド繰り返します。早く置いた行商が、この先に買えるカードを増やしてくれます。');
 }else if(['develop','vp'].includes(event.phase)&&changes.length){
  const effects=changes.map(change=>({change,card:p.board.find(b=>change.source===CARD[b.card].name+'の効果')?.card}));
  effects.sort((a,b)=>Number(placed.has(b.card))-Number(placed.has(a.card)));
  card=effects.find(x=>x.card)?.card;
  title=event.phase==='develop'?'育てるために置いたカードが、働きました':'育てたレベルが、カードのVPになりました';
  for(const item of effects){
   const c=item.change;if(!item.card){paragraphs.push(`${c.source}によって${changeValue(c)}になりました。`);continue;}
   const name=CARD[item.card].name,eff=CARD[item.card].effects.find(e=>e.phase===event.phase&&e.stat===c.stat);
   if(event.phase==='develop'){
    const raised=level(c.before)!==level(c.after);
    paragraphs.push(`${origin(item.card)}${name}のおかげで、${changeValue(c)}になりました。${raised?'レベルの境目を越えたので、この後のVP効果が強くなります。':'点数は増えましたが、レベルは同じです。次の境目に近づきました。'}`);
    if(chapter===0&&item.card==='dwarf_cook')paragraphs.push('料理人を後ろに置いた狙いはこれです。参戦していなくても技術を育て、すぐ後のVPで技術Lv.1×1＝1VPを得られる状態になりました。');
   }else{
    const stat=eff?.scale==='techLevel'?'tech':eff?.scale==='faithLevel'?'faith':null;
    const grown=stat?past.flatMap(e=>e.playerId===you?(e.changes??[]):[]).find(x=>x.stat===stat&&level(x.before)<level(x.after)):null;
    paragraphs.push(`${origin(item.card)}${name}のおかげで${c.delta}VPを獲得しました（VP ${c.before}→${c.after}）。${stat?`${STAT_NAMES[stat]}${p[stat]}点＝Lv.${level(p[stat])}を使い、Lv.${level(p[stat])}×${eff.amount}＝${c.delta}VPです。`:''}`);
    if(grown)paragraphs.push(`ここにつながったのが「${grown.source}」です。${changeValue(grown)}でレベルが上がったため、${name}が生むVPも増えました。点数は得点に使っても消費しません。`);
   }
  }
 }else if(event.phase==='final'){
  card=p.board.at(-1)?.card;title='9体目を置いて、最後の収入まで得点にしました';
  paragraphs.push(`さっき置いた${CARD[card]?.name??'カード'}で王国が${p.board.length}体になりました。すぐ終了せず、戦争・発展・収入・VPをすべて処理した後の結果です。`);
  paragraphs.push(`最後の収入も含む残金${p.gold}金を、3金につき1VPへ換算。${p.finalGoldVP??Math.floor(p.gold/3)}VPを加え、最終${p.vp}VPになりました。`);
 }
 if(!paragraphs.length){paragraphs=tutorialPhaseOutcome({events:[event]},event.phase,you);title='今回、このフェーズで変化しない理由';}
 return paragraphs.length?{card,title,paragraphs}:null;
}
export function tutorialFeedback(resolution,eventIndex,chapter=0,you='human'){
 const past=resolution?.events?.slice(0,eventIndex+1)??[];
 return eventLearning(past.at(-1),past,chapter,you);
}
export function tutorialPlacementFeedback(player,moves,chapter=0){
 if(!moves.length)return null;
 const result=previewPlacement(player,moves),last=result.placed.at(-1);
 const event={phase:'place',playerId:player.id,card:last.card,changes:last.steps,after:result.player};
 return eventLearning(event,[],chapter,player.id,true);
}

// Only expose records that have already been presented, never later effects.
export function tutorialTrace(resolution,eventIndex,you='human'){
 return (resolution?.events??[]).slice(0,eventIndex+1).flatMap((event,index)=>event.playerId===you&&event.phase!=='draw'?((event.changes??[]).length?event.changes.map(change=>({round:resolution.round,eventIndex:index,stat:change.stat,source:change.source,message:`${event.after.name}：${change.source}によって${STAT_NAMES[change.stat]} ${change.before}→${change.after}（${change.delta>0?'+':''}${change.delta}）`})):[{round:resolution.round,eventIndex:index,message:`${event.title}：この処理での値の増減はありません。`}]):[]);
}
