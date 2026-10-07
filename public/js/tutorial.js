import {newGame} from './engine.js?v=6';
import {CARD} from './cards.js?v=3';

export function tutorialGame(name){
 const game=newGame([{id:'human',name:name.trim()||'あなた',cpu:false},{id:'cpu-0',name:'宿屋の常連',cpu:true}],{warVP:[4,0]});
 // 実際の山札と交換し、練習中もカードの枚数を保つ。
 const choices=[...new Set(game.deck.filter(id=>CARD[id].cost<=2))].slice(0,5);
 for(let i=0;i<choices.length;i++){
  const index=game.deck.indexOf(choices[i]);
  [game.players[0].hand[i],game.deck[index]]=[game.deck[index],game.players[0].hand[i]];
 }
 game.tutorial=true;return game;
}
export function tutorialGuide({round,phase,moves=0,replayPhase=null}){
 if(round>1||phase==='ended'||(phase==='round'&&!replayPhase))return {step:4,title:'最初の1ラウンド、完了！',text:'カードを置くほど王国が育ちます。技術・信仰は1・3・7・15点でレベルアップ。同じ種族や職業を縦横に3枚そろえるとボーナスです。40VP、または9体配置したラウンドで終了します。',target:null,done:true};
 if(replayPhase&&replayPhase!=='draw')return {step:3,title:'戦争から収入まで、増減を見よう',text:'中央の「次の処理」で1つずつ確認します。戦争は各縦列の最前線の戦力で順位を決め、発展で技術・信仰、収入でお金、最後にカードのVPを得ます。全て確認すると結果画面へ進みます。',target:'.replay-controls'};
 if(phase==='draw'||replayPhase==='draw')return {step:1,title:'まずは手札を整えよう',text:'手札は5枚。不要なカードを選ぶと、捨ててから5枚まで補充します。今回は安いカードを用意しました。そのまま「交換せず補充」で進んでもOKです。',target:'#confirmButton'};
 return {step:2,title:moves?'仮配置の増減を確認しよう':'カードを卓に置いてみよう',text:moves?'お金と戦力が変わりました。「最後の配置を戻す」で取り消せます。2枚目は上下左右の「＋」へ。最大2枚置けます。準備ができたら「配置を確定」を押してください。置かなかった枠は、配置処理後に1金ずつもらえます。':'手札のカードを「＋」にドラッグ、またはカードを選んで「＋」を押します。コストはカード左上の数字。まずは1枚置いて、お金の変化を見てみましょう。王国は幅・高さ3マスまで広げられます。',target:moves?'#confirmButton':'.hand'};
}
