import {OBJECTIVE} from './objectives.js?v=3';
import {newGame,level,power,previewPlacement,legalCells,STAT_NAMES} from './engine.js?v=16';
import {CARD,RACES,JOBS} from './cards.js?v=4';

export const TUTORIAL_CHAPTERS=[
 {title:'序盤：王国をつくる',intro:'マグノリアは、カードを王国に配置して勝利点（VP）を稼ぐゲームです。最後に最もVPが多い人が勝ちます。第1章は何もない王国から、手札交換・配置・各フェーズを1回ずつ試します。',goal:'最初の例：人間の行商を置き、その後ろにドワーフの料理人を置いてみましょう。行商の収入、料理人の発展とVPを1ラウンドで確認できます。この練習では、案内したカードと場所だけ操作できます。'},
 {title:'中盤：育てて組み合わせる',intro:'第2章は練習用に準備した途中盤面です。前の章の続きではありません。技術2点・信仰2点、7金から始めます。どちらもあと1点でLv.2。種族・職業の3枚揃えと、信奉者のVP効果を試します。',goal:'拳闘士でドワーフの種族揃え、信奉者で聖職者の職業揃えを横に完成させます。信奉者で育てた信仰が、その後のVPになる流れも確認します。'},
 {title:'終盤：勝ち切るタイミング',intro:'7体の王国から、魔術師の戦争時効果と9体による終了を試します。技術・信仰はLv.3、VPは30です。',goal:'魔術師を前線に置き、戦争報酬に追加VPを得ます。祈り手を9体目にして、全員が終了する流れを確認します。'},
 {title:'追加目標：手紙を読んで先に達成',intro:'12枚の追加目標から4枚を公開し、先に達成すると各3VP。この練習は固定の4枚です。盤面左上の青い手紙は自分の数値の接近、赤い手紙は相手の接近を知らせます。普段は手紙マークが出ません。',goal:'青・赤の手紙を読んでから、行商と料理人を置いて所持金2金を目指します。コスト3以下のユニット3体は相手も同時に達成できる例です。相手は信仰レベル3にも接近しています。得点と手紙タグ、薄くなった目標を確認しましょう。'},
];
const specs=[
 {gold:5,tech:0,faith:0,vp:0,board:[],hand:['human_marchant','dwarf_cook','dwarf_pugilist','elf_marchant','demon_storm'],enemy:[],enemyHand:['human_marchant','goblin_soldier','elf_marchant','dwarf_cook','elf_saint']},
 {gold:7,tech:2,faith:2,vp:12,board:[['dwarf_cook',0,0],['dwarf_gem',1,0],['human_saint',0,1],['elf_saint',1,1],['human_knight',0,-1]],hand:['dwarf_pugilist','elf_follower','golem_iron','elf_artist','human_great_marchant'],enemy:[['human_knight',0,0],['human_marchant',1,0],['elf_saint',0,1]],enemyHand:['goblin_soldier','elf_marchant','human_great_marchant','dwarf_cook','elf_artist']},
 {gold:8,tech:7,faith:7,vp:30,board:[['golem_iron',0,0],['human_knight',1,0],['elf_mistic',1,2],['dwarf_cook',0,1],['human_saint',1,1],['elf_artist',2,1],['human_marchant',0,2]],hand:['elf_caster','dwarf_beer','elf_saint','human_great_marchant','demon_destroy'],enemy:[['demon_pest',0,0],['goblin_great_soldier',1,0],['elf_archer',2,0],['human_great_marchant',0,1]],enemyHand:['goblin_soldier','elf_marchant','human_saint','dwarf_cook','golem_gold']},
 {gold:5,tech:0,faith:0,vp:0,board:[['human_marchant',0,0],['dwarf_cook',0,1]],hand:['human_marchant','dwarf_cook','golem_iron','elf_artist','goblin_soldier'],enemy:[['human_knight',0,0],['elf_marchant',1,0],['human_saint',0,1]],enemyHand:['dwarf_cook','elf_mistic','goblin_soldier','human_great_marchant','golem_gold']},
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
 if(chapter===3){g.settings.additionalObjectives=true;g.objectives=['gold2','cheap3','faith3','jobs4'].map(id=>({id,claimedBy:[]}));enemy.faith=6;enemy.tech=0;enemy.vp=0;}
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
 {title:'追加目標と青・赤の手紙',paragraphs:['追加目標を使う場合、12枚からランダムに4枚を公開します。条件を先に満たした人に各3VP。同じフェイズの判定で複数人が達成すると全員が3VPを得ます。達成済みの目標は薄くなり、達成者名を記録します。再加点はしません。','青い手紙は自分の数値が条件に近づいたときだけ出ます。押すと目標と残りの数値を確認できます。配置案や手順は表示しません。赤い手紙は相手の公開盤面が達成間近のときだけ出て、目標と相手の名前を表示します。非公開の手札は判断に使いません。','所持金2金は配置終了時にちょうど2金。未配置枠の報酬も加えて判定します。1枚配置した瞬間に2金になっても、未配置枠の1金で3金になれば未達成です。所持金12金は各フェイズ終了時にちょうど12金で判定。収入7金は所持金ではなく、基本3金を含むそのフェイズの収入です。','目標を達成すると、3枚揃いのタグと同じ欄に手紙風の達成タグと獲得VPが残ります。追加目標だけでも得点が伸びるため、40VPの終了条件にも含まれます。']},
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
 if(chapter===3){
  if(!replayPhase&&['round','ended'].includes(phase))return {step:4,title:'追加目標の練習を完了！',text:'青い手紙で自分の進捗、赤い手紙で相手の接近を確認しました。達成した目標の3VPと、盤面下の手紙タグを確認しましょう。同時達成は全員が得点し、達成済みの目標は薄く表示されます。',done:true};
  if(replayPhase&&replayPhase!=='draw')return {step:3,title:'指定フェイズの終了時に目標を判定',text:'各フェイズの最後に目標を確認します。自分と相手の達成、3VPの加点、達成者名と手紙タグに注目しましょう。',target:'.replay-controls'};
  if(phase==='draw'||replayPhase==='draw')return {step:1,title:'追加目標の練習を始めよう',text:'今回は手札を交換しません。「交換せず補充」で進み、盤面左上の青・赤の手紙を読みましょう。',target:'.hand'};
  return {step:2,title:'手紙を読んで、所持金2金を狙おう',text:'青い手紙は自分の進捗、赤い手紙は相手の接近です。行商1金→料理人2金の順で置くと、5−1−2＝2金。配置終了時に目標を達成できます。',target:'.objective-mailbox'};
 }
 if(!replayPhase&&['round','ended'].includes(phase))return {step:4,title:chapter===2?'基本3章の練習、おつかれさまでした！':'この章の1ラウンドを完了！',text:chapter===0?'お金を払ってカードを置き、戦争・発展・収入・VPが順に発生する流れを体験しました。次は途中盤面から、技術・信仰点と組み合わせを練習します。':chapter===1?'技術・信仰点は使うカードと組み合わせると役立ちます。3枚揃えとレベルの境目も確認できましたか？ 次は終了直前の盤面で、最後の得点まで体験します。':'最終結果は戦争だけでなく、カードのVP・配置ボーナス・残金の合計で決まります。勝っても負けても練習は完了です。下の解説はいつでも読み直せます。次は追加目標の手紙と、先着の得点を練習できます。',target:null,done:true};
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
  return {handIndex:index,canConfirm:ready,purpose:['今は5金。9金のデーモンを交換して、置ける手札を残します。','拳闘士と信奉者で、種族揃え・職業揃えを試します。今回は交換しません。','魔術師と祈り手で、戦争時効果と全員の終了を試します。今回は交換しません。','青・赤の手紙で目標を確認します。今回は交換しません。'][chapter],text:chapter===0?'「嵐のデーモン」を選び、「交換を確定」を押しましょう。':'「交換せず補充」を押しましょう。'};
 }
 if(phase!=='place')return null;
 const steps=[
  [['human_marchant',0,0,'「人間の行商」を光る＋へ。'],['dwarf_cook',0,1,'「ドワーフの料理人」を行商の下へ。']],
  [['dwarf_pugilist',2,0,'「ドワーフの拳闘士」をドワーフ2枚の右へ。'],['elf_follower',2,1,'「エルフの信奉者」を聖職者2枚の右へ。']],
  [['elf_caster',2,0,'「エルフの魔術師」を上段右の前線へ。'],['elf_saint',2,2,'「エルフの祈り手」を下段右へ。']],
  [['human_marchant',1,0,'「人間の行商」を既存の行商の右へ。'],['dwarf_cook',1,1,'「ドワーフの料理人」を既存の料理人の右へ。']]
 ][chapter];
 const step=steps?.[moves];
 if(!step)return {handIndex:-1,canConfirm:moves===2,purpose:'確定して、置いた2枚の働きを順番に確認します。',text:'「2枚の配置を確定」を押しましょう。'};
 return {card:step[0],handIndex:hand.indexOf(step[0]),x:step[1],y:step[2],canConfirm:false,text:step[3],purpose:chapter===3?(moves===0?'1金を払い、安いユニット3体の条件に届かせます。所持金2金は2枚目の後で判定します。':'2金を払って残金2金。2枠とも配置するので、未配置枠の報酬はありません。'):chapter===1&&moves===1?'信奉者で聖職者の横列を完成させます。種族が違っても、職業だけの一致で信仰＋2です。':placementPurpose(step[0])};
}
export function tutorialPlacementAllowed(task,handIndex,x,y){return !!task?.card&&task.handIndex===handIndex&&task.x===x&&task.y===y;}
// Staggered columns show that the front is decided independently in each column.
export const TUTORIAL_FRONTLINE=[
 {card:'human_knight',x:0,y:0},
 {card:'dwarf_cook',x:0,y:1},{card:'dwarf_pugilist',x:1,y:1},
 {card:'human_marchant',x:0,y:2},{card:'elf_follower',x:1,y:2},{card:'elf_mistic',x:2,y:2}
];
export const TUTORIAL_SLIDES=[
 {title:'チュートリアルへようこそ！',text:'一緒にマグノリアを学びましょう。まず基本を知り、3つの短い盤面練習へ進みます。',kind:'welcome',section:'ようこそ'},
 {title:'自分の王国をつくり、VPを稼ぐゲーム',text:'カードを王国に置いて勝利点（VP）を稼ぎ、最後に最もVPが多い人が勝ちます。誰かが40VPか9体に達したラウンドで終了です。',kind:'kingdom',section:'ゲームの概要'},
 {title:'1ラウンドは、この6つのフェーズ',text:'ドロー→配置→戦争→発展→収入→VP。全員の配置が決まったら、後半4フェーズを順番に処理します。',kind:'flow',section:'ラウンドの流れ'},
 {title:'① ドロー：使いたい手札を整える',text:'不要な手札を捨て、5枚まで補充します。交換は毎ラウンド1回。今回は5金で置けるカードを残しましょう。',kind:'draw',phase:'draw',section:'各フェーズ'},
 {title:'② 配置：お金を払い、最大2枚を置く',text:'コストを払い、最大2枚を上下左右につなげて置きます。王国は縦横3マスまで。置いたカードは動かせません。',kind:'placement',phase:'place',section:'各フェーズ'},
 {title:'③ 戦争：各縦列の先頭が、前線',text:'各縦列の一番上が前線です。金色の枠のカードの戦力を合計して比べます。この2人戦では1位4VP・2位0VP。同戦力は同順位です。',kind:'front',phase:'war',section:'各フェーズ'},
 {title:'④ 発展：技術点・信仰点を増やす',text:'発展効果で技術・信仰が増えます。料理人なら技術＋1。カードを置いておけば毎ラウンド発動します。',kind:'develop',phase:'develop',section:'各フェーズ'},
 {title:'⑤ 収入：次の配置に使うお金を得る',text:'全員が基本収入3金を得ます。収入カードの効果は上乗せ。行商ならさらに＋1金です。',kind:'income',phase:'income',section:'各フェーズ'},
 {title:'⑥ VP：王国のカードで得点する',text:'VP効果で得点します。料理人は技術レベル×1VP。直前の発展で上がったレベルを使います。',kind:'scoring',phase:'vp',section:'各フェーズ'},
 {title:'カードの効果は「いつ」と「何が」を見る',text:'効果欄の「いつ」「何が増えるか」を見ましょう。配置時は置いた瞬間、発展・収入・VPはそのフェーズで発動します。',kind:'effects',section:'カードの効果'},
 {title:'技術・信仰って、何に使うの？',text:'1・3・7・15点でレベルが上がり、対応するカードの効果が強くなります。効果を使っても点数は消費しません。',kind:'levels',section:'技術と信仰'},
 {title:'では、実際の盤面でやってみましょう！',text:'光るカードと＋を順に操作しましょう。置いたカードの働きを各フェーズで確認します。詳しいルールは「解説集」へ。',kind:'practice',section:'盤面で練習'}
];

const placementPurposes={
 human_marchant:'行商を置き、収入で毎ラウンド＋1金を得る準備をします。',
 dwarf_cook:'料理人で「技術を育てる→VPを得る」を試します。後方でも効果は働きます。',
 dwarf_pugilist:'拳闘士でドワーフの横列を完成させます。職業が違っても、種族揃えで技術＋2です。',
 elf_follower:'信奉者で信仰＋2。その信仰レベルを使い、VPを得る流れを試します。',
 elf_caster:'魔術師を前線に置き、戦争でVPを得たときの追加効果を試します。',
 elf_saint:'祈り手を9体目にして、全員の終了条件に届かせます。他の人が9体未満でも、このラウンドで終了です。'
};
function placementPurpose(card){return placementPurposes[card]??'カードを置いた後、効果と増減の理由を確認しましょう。';}
const changeValue=c=>`${STAT_NAMES[c.stat]} ${c.before}→${c.after}${['tech','faith'].includes(c.stat)?`（Lv.${level(c.before)}→Lv.${level(c.after)}）`:''}`;
function eventLearning(event,past,chapter,you,preview=false){
 if(chapter===3&&event?.objectiveId){const o=OBJECTIVE[event.objectiveId],goal=event.objectives?.find(g=>g.id===event.objectiveId);return {card:null,title:`${event.playerId===you?'あなた':event.after?.name??'相手'}が追加目標を達成！`,paragraphs:[`「${o.title}」を${event.phase==='place'?'配置':event.phase==='develop'?'発展':'指定'}フェイズ終了時に達成し、${o.vp}VPを獲得しました。`,goal?.claimedBy.length>1?'今回は同じ判定で複数人が達成。全員が3VPを得ます。先に処理された人だけの得点にはなりません。':'先着の目標です。達成済みになったこの目標から、後で得点することはできません。','追加目標の手紙が薄くなり、達成者名を表示します。盤面下には獲得VPつきの手紙タグが残ります。']};}
 if(!event||event.playerId!==you||!event.after||event.phase==='draw')return null;
 const p=event.after,changes=event.changes??[];
 const placed=new Set(past.filter(e=>e.phase==='place'&&e.playerId===you&&e.card).map(e=>e.card));
 if(preview&&event.card)placed.add(event.card);
 const ownEffect=c=>p.board.find(b=>placed.has(b.card)&&c.source===CARD[b.card].name+'の効果')?.card;
 let card=event.card??null,title='',paragraphs=[];
 if(event.phase==='place'&&card){
  if(chapter===2&&p.board.length===9)return {card,title:'9体になったら、全員が終了',paragraphs:['祈り手を置いて、あなたの王国が9体になりました。他のプレイヤーが9体未満でも、全員がこのラウンドで終了します。','すぐには終わりません。全員の戦争・発展・収入・VPを処理し、残金を得点に加えて勝敗を決めます。']};
  const c=CARD[card],pos=p.board.find(b=>b.card===card);
  const bonuses=changes.filter(x=>/の(種族|職業)ボーナス/.test(x.source));
  title=`${c.name}を配置`;
  for(const bonus of bonuses){
   const type=bonus.source.includes('種族')?'race':'job';
   const rows=[p.board.filter(b=>b.y===pos.y).sort((a,b)=>a.x-b.x),p.board.filter(b=>b.x===pos.x).sort((a,b)=>a.y-b.y)];
   const line=rows.find(row=>row.length===3&&row.every(b=>CARD[b.card][type]===c[type]));
   if(!line)continue;
   title=type==='race'?'ドワーフ3枚で種族揃え':'聖職者3枚で職業揃え';
   paragraphs.push(`${line.map(b=>CARD[b.card].name).join('・')}が${line===rows[0]?'横':'縦'}1列に揃いました。${type==='race'?`職業は別々でも、種族は全員「${RACES[c.race]}」`:`種族は違っても、職業は全員「${JOBS[c.job]}」`}なので、${STAT_NAMES[bonus.stat]}＋${bonus.delta}。`);
  }
  if(bonuses.length)paragraphs.push('縦か横の3枚で、種族か職業が同じならボーナス。列が完成したときに1回だけ得ます。');
  const effect=changes.find(x=>x.source===c.name+'の配置時効果');
  if(effect)paragraphs.push(`${c.name}自身の配置時効果：${changeValue(effect)}。${bonuses.length?'その後に3枚揃えのボーナスを加えます。':''}`);
  if(card==='human_marchant')paragraphs.push('行商は今すぐお金を増やすのではなく、収入で毎ラウンド＋1金を生みます。');
  if(card==='dwarf_cook')paragraphs.push('後方の料理人も、発展で技術＋1、そのレベルを使ってVPを生みます。');
  if(card==='elf_caster')paragraphs.push('魔術師の戦争時効果は、この後の戦争で報酬VPを得ると発動します。');
  if(card==='elf_saint')paragraphs.push(`祈り手で${p.board.length}体に。9体なら、このラウンドの最後に終了します。`);
 }else if(event.phase==='war'){
  const fronts=p.board.filter(b=>placed.has(b.card)&&!p.board.some(other=>other.x===b.x&&other.y<b.y));
  card=fronts[0]?.card??null;title='前線のカードで戦争';
  paragraphs.push(fronts.length?`今回置いた${fronts.map(b=>CARD[b.card].name).join('・')}が前線で参戦。王国全体の戦力${p.power}で${p.rank}位、報酬${p.warVP}VPです。`:`今回置いたカードは後方なので参戦しません。王国全体の戦力${p.power}で${p.rank}位、報酬${p.warVP}VPです。`);
  for(const change of changes){const id=ownEffect(change);if(id){card=id;title='置いた魔術師の戦争時効果が発動';paragraphs.push(`戦争の報酬${p.warVP}VPを得たので、魔術師が信仰Lv.${level(p.faith)}×1＝${change.delta}VPを追加しました。戦争報酬が0VPなら、この効果は発動しません。`);}}
 }else if(event.phase==='income'){
  const extra=changes.filter(c=>c.stat==='gold'&&ownEffect(c));
  card=extra.length?ownEffect(extra[0]):null;title=card?'置いたカードが収入を生みました':'基本収入を受け取る';
  for(const c of extra)paragraphs.push(`今回置いた${CARD[ownEffect(c)].name}のおかげで＋${c.delta}金。基本収入3金に上乗せされます。`);
  if(!extra.length)paragraphs.push('今回置いたカードに収入効果はありません。基本収入3金は毎ラウンド得られます。');
  if(chapter===2)paragraphs.push('最後の収入も、残金の得点に含まれます。');
 }else if(['develop','vp'].includes(event.phase)){
  const effects=changes.map(change=>({change,card:ownEffect(change)})).filter(x=>x.card);
  card=effects[0]?.card??null;title=event.phase==='develop'?'発展の結果':'VPの結果';
  for(const item of effects){
   const c=item.change,name=CARD[item.card].name;
   if(event.phase==='develop')paragraphs.push(`今回置いた${name}のおかげで、${changeValue(c)}。この後のVPには新しいレベルを使います。`);
   else{
    const eff=CARD[item.card].effects.find(e=>e.phase==='vp'&&e.stat===c.stat);
    const stat=eff?.scale==='techLevel'?'tech':eff?.scale==='faithLevel'?'faith':null;
    const grown=stat?past.flatMap(e=>e.playerId===you?(e.changes??[]):[]).find(x=>x.stat===stat&&[...placed].some(id=>x.source.startsWith(CARD[id].name))):null;
    paragraphs.push(`今回置いた${name}で${c.delta}VP。${stat?`${stat==='tech'?'技術':'信仰'}${p[stat]}点・Lv.${level(p[stat])}×${eff.amount}＝${c.delta}VPです。`:''}`);
    if(grown)paragraphs.push(`配置で育てた${STAT_NAMES[stat]}が、この得点につながりました。点数は消費しません。`);
   }
  }
  if(!effects.length){
   const phase=event.phase==='develop'?'発展':'VP';
   const hasEffect=p.board.some(b=>placed.has(b.card)&&CARD[b.card].effects.some(e=>e.phase===event.phase));
   paragraphs.push(hasEffect?`今回置いたカードの${phase}効果は、今の条件では増減しません。`:`今回置いたカードに${phase}効果はありません。${changes.length?'表示される増減は、もともと王国にあったカードの効果です。':'このフェーズでの増減はありません。'}`);
  }
 }else if(event.phase==='final'){
  card=[...p.board].reverse().find(b=>placed.has(b.card))?.card??null;title='9体目を置いたラウンドの最終得点';
  paragraphs.push(`${card?CARD[card].name:'今回の配置'}で9体に。他のプレイヤーが9体未満でも全員終了です。全フェーズを終えてから、残金${p.gold}金を${p.finalGoldVP??Math.floor(p.gold/3)}VPに換算し、最終${p.vp}VPです。`);
 }
 return paragraphs.length?{card,title,paragraphs}:null;
}
export function tutorialFeedback(resolution,eventIndex,chapter=0,you='human'){
 const past=resolution?.events?.slice(0,eventIndex+1)??[];
 // The same line bonus has already been explained when the card was drafted.
 const event=past.at(-1);
 if(event?.phase==='place'&&(event.changes??[]).some(c=>/の(種族|職業)ボーナス/.test(c.source)))return null;
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
 return (resolution?.events??[]).slice(0,eventIndex+1).flatMap((event,index)=>event.playerId===you&&event.phase!=='draw'?((event.changes??[]).length?event.changes.map(change=>({round:resolution.round,playerId:event.playerId,eventIndex:index,stat:change.stat,source:change.source,message:`${event.after.name}：${change.source}によって${STAT_NAMES[change.stat]} ${change.before}→${change.after}（${change.delta>0?'+':''}${change.delta}）`})):[{round:resolution.round,playerId:event.playerId,eventIndex:index,message:`${event.title}：この処理での値の増減はありません。`}]):[]);
}
