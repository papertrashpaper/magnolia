import {objectiveAlerts} from './objective-ui.js?v=1';
import {OBJECTIVE,OBJECTIVE_PHASES,objectiveProgress} from './objectives.js?v=2';
import {matBounds,createRefreshments,servingLabel} from './tavern.js?v=5';
import {tutorialGame,tutorialGuide,tutorialObservation,tutorialPhaseOutcome,TUTORIAL_CHAPTERS,TUTORIAL_REFERENCE,tutorialTask,tutorialPlacementAllowed,TUTORIAL_SLIDES,TUTORIAL_FRONTLINE,tutorialFeedback,tutorialPlacementFeedback,tutorialTrace} from './tutorial.js?v=21';
import {bindCardDrag} from './drag.js?v=9';
import {CARDS,CARD,RACES,JOBS,RACE_BONUS,JOB_BONUS,effectText} from './cards.js?v=4';
import {newGame,submit,nextRound,publicView,previewPlacement,legalCells,bounds,power,level,CPU_LEVELS,normalizeCPU} from './engine.js?v=15';
import {fillCPU} from './cpu.js?v=15';
import {PHASE_NAMES,scoreRank,changeSentence,levelChangeSentence,levelProgress,battleRank,resolutionView,undoChanges,finalResultMessages,logClassName} from './presentation.js?v=10';
import {completedCombos,newCombos,placementComboHints,comboStyle} from './combos.js?v=5';

const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs=s=>document.querySelector(s);
const store={get(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},remove(key){try{localStorage.removeItem(key);}catch{}}};
let mode='setup',setupTab='local',game=null,state=null,myId='human',boardId='human',session=null,stream=null;
let cleanupDrag=null;
const refreshmentService=createRefreshments(updateRefreshment);
const refreshments=refreshmentService.servings;
const mobileLayout=()=>window.matchMedia('(max-width:760px)').matches;
let mobileOverviewCompact=true,mobileGalleryScroll=0,mobileHandScroll=0,mobilePlaybackFocus=null,mobileLogsOpen=false;
const tutorialText=text=>mobileLayout()?text.replace('手札のカードを「＋」にドラッグ、またはカードを選んで「＋」を押します。','手札を横にスワイプしてカードを選び、王国の「＋」をタップします。'):text;
function mobileJump(target){
 if(!mobileLayout())return;
 requestAnimationFrame(()=>{updateTutorialDock();qs(target)?.scrollIntoView({block:'start',behavior:'instant'});});
}
let moves=[],discard=new Set(),selected=null,draftKey='',busy=false,connection='';
let playback=null,pendingView=null,playTimer=null,autoPlay=store.get('magnolia-auto-play',false),notice=null,noticeTimer=null;
let placementCelebration=null;
let visualGameKey=null,visualPlaybackActive=false,visualValues=new Map(),visualDeltas=new Map(),latestLogKey='';
function updateVisualValues(players){
 const key=globalState().gameId??game;if(key!==visualGameKey){visualGameKey=key;visualValues.clear();visualDeltas.clear();latestLogKey='';}
 // Switching from the placement preview to replay is a view reset, not a resource loss.
 if(visualPlaybackActive!==!!playback){visualPlaybackActive=!!playback;visualValues.clear();visualDeltas.clear();}
 const now=Date.now();
 for(const p of players){const values={vp:p.vp,gold:p.gold,tech:p.tech,faith:p.faith,power:power(p),units:p.board.length};
 const before=visualValues.get(p.id);if(before)for(const stat of Object.keys(values))if(values[stat]!==before[stat])visualDeltas.set(`${p.id}:${stat}`,{delta:values[stat]-before[stat],until:now+1800});visualValues.set(p.id,values);}
}
function deltaHTML(p,stat,inline=false){const d=visualDeltas.get(`${p.id}:${stat}`);return d&&d.until>Date.now()?`<span class="stat-delta ${inline?'participant-delta':''} ${d.delta>0?'gain':'loss'}" aria-label="${d.delta>0?'増加':'減少'} ${Math.abs(d.delta)}">${d.delta>0?'+':''}${d.delta}</span>`:'';}
function operationHTML(own){
 const event=playback?globalState().resolution.events[playback.index]:null;
 const title=event?`${event.playerId?globalState().players.find(p=>p.id===event.playerId)?.name??'全員':'全員'}の${PHASE_NAMES[event.phase]??'処理'}`:busy?'処理中…':own.ready?'ほかの参加者を待っています':state.phase==='draw'?'あなたの手札交換':state.phase==='place'?'あなたの配置':state.phase==='ended'?'対戦終了':'ラウンド完了';
 const text=event?'中央の案内で、効果と増減を確認してください。':own.ready?'あなたの操作は確定済みです。':state.phase==='draw'?'交換したいカードを選び、交換を確定します。':state.phase==='place'?`最大2枚。現在 ${moves.length}/2枚を仮配置しています。`:'結果を確認して次へ進みましょう。';
 return `<section class="operation-banner ${event||own.ready?'waiting':'your-turn'}" aria-label="現在の操作"><div><span class="operation-tag">${event?'処理を確認':own.ready?'待機中':'現在の操作'}</span><strong>${esc(title)}</strong><p>${esc(text)}</p></div><button id="operationButton" class="primary" hidden></button></section>`;
}
const seenResolutions=new Set();
const seenFinalResults=new Set();
let finalResultTimer=null;
function clearFinalResults(){clearTimeout(finalResultTimer);qs("#finalResultNotice").hidden=true;}
function announceFinalResults(){
 if(state.phase!=="ended"||playback)return;
 const key=state.gameId||state.resolution?.id||`${mode}:${state.room||""}:${state.round}`;
 if(seenFinalResults.has(key))return;seenFinalResults.add(key);
 const messages=finalResultMessages(state.players,myId),host=qs("#finalResultNotice");
 function next(){
  if(mode==="setup"||state.phase!=="ended"){clearFinalResults();return;}
  const item=messages.shift();if(!item){host.hidden=true;return;}
  host.hidden=false;host.className=`final-result-notice ${item.winner?"champion":""} ${item.own?"your-result":""}`;
  host.innerHTML=`<div class="result-ornament" aria-hidden="true">${item.winner?"✦ 👑 ✦":"✦"}</div><p>${item.own?"あなたの最終結果":"最終結果"} · ${item.total}人対戦</p><h2>${esc(item.name)} · ${item.rank}位</h2><h3>${esc(item.title)}</h3><p>${esc(item.message)}</p><strong>${item.vp} VP</strong>`;
  host.style.animation="none";void host.offsetWidth;host.style.animation="";
  finalResultTimer=setTimeout(next,item.winner?4800:3600);
 }next();
}
const initialParams=new URLSearchParams(location.search);
const defaultServer=location.hostname==='papertrashpaper.github.io'?'https://magnolia-82c3.onrender.com':location.origin;
let connecting=false,recovering=false,reconnectTimer=null,recoveryGeneration=0;
let reviewRound=null,reviewOpen=false,backupSaved=true;
let setup={additionalObjectives:false,name:store.get('magnolia-name','あなた'),total:4,cpuCount:0,cpuDifficulty:store.get('magnolia-cpu-difficulty','normal'),cpuDifficulties:store.get('magnolia-cpu-seats',[]),server:initialParams.get('server')||store.get('magnolia-server',defaultServer),room:initialParams.get('room')||'',warVP:[5,3,0,0,0]};
if(initialParams.get('room'))setupTab='online';
function toast(text){qs('#toast').textContent=text;qs('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>qs('#toast').classList.remove('show'),4500);}
function moneyWarning(){
 const host=qs('#actionWarning');host.textContent='お金がたりない！';host.classList.add('show');
 clearTimeout(moneyWarning.timer);moneyWarning.timer=setTimeout(()=>host.classList.remove('show'),2200);
}
function bonusText(b){return Object.entries(b).map(([s,n])=>`${n}${{gold:'金',tech:'技術点',faith:'信仰点',vp:'VP'}[s]}`).join(' ＋ ');}
function scheduleReplay(){clearTimeout(playTimer);if(!playback||qs('#tutorialHandbookDialog').open||qs('#objectiveMailDialog').open)return;const drawing=state.resolution.events[playback.index].phase==='draw';if(mode==='local'&&game?.tutorial&&tutorialFeedback(state.resolution,playback.index,game.tutorialChapter??0,myId))return;if(drawing||autoPlay)playTimer=setTimeout(advanceReplay,drawing?1050:3200);}
function advanceReplay(){
 if(!playback)return;clearTimeout(playTimer);
 if(++playback.index>=state.resolution.events.length){
  playback=null;boardId=myId;
  if(pendingView){const next=pendingView;pendingView=null;applyView(next);}else render();
  return;
 }
 const event=state.resolution.events[playback.index];if(event.playerId)boardId=event.playerId;
 render();scheduleReplay();
}
function showNotice(title,changes,note,combos=[]){
 clearTimeout(noticeTimer);
 // Three-card bonuses happen on placement; explain those in the draft.
 if(mode==='local'&&game?.tutorial){
  const bonus=changes.some(c=>/の(種族|職業)ボーナス/.test(c.source))||(game.tutorialChapter===2&&currentDraft().board.length===9);
  const learning=bonus&&!title.includes('取り消し')?tutorialPlacementFeedback(state.players.find(p=>p.id===myId),moves,game.tutorialChapter??0):null;
  notice=learning?{title,changes,note,learning,combos}:null;render();return;
 }
 notice={title,changes,note,combos};renderCenter();
}
function changeHTML(c){const lv=levelChangeSentence(c);return `<li class="${c.delta>0?'gain':'loss'}">${esc(changeSentence(c))}${lv?`<small class="level-change">${esc(lv)}</small>`:''}</li>`;}
function summaryHTML(summary){return `<div class="phase-summary">${summary.map(p=>`<div><b>${esc(p.name)}</b><span>${p.changes.length?p.changes.map(c=>`${{gold:'お金',tech:'技術',faith:'信仰',vp:'VP'}[c.stat]} ${c.before} → ${c.after} (${c.delta>0?'+':''}${c.delta})${['tech','faith'].includes(c.stat)?` · Lv.${level(c.before)} → Lv.${level(c.after)}`:''}`).join(' ／ '):'増減なし'}</span></div>`).join('')}</div>`;}
function celebratingCombos(p){
 if(playback){
  const event=state.resolution.events[playback.index];
  if(event.phase!=='place'||!event.card||event.playerId!==p.id)return [];
  const before=resolutionView({...state,you:myId},playback.index-1).players.find(q=>q.id===p.id);
  return newCombos(before,p);
 }
 return p.id===myId&&placementCelebration?completedCombos(p).filter(c=>placementCelebration.includes(c.key)):[];
}
function comboParticlesHTML(){return `<span class="combo-particles" aria-hidden="true">${Array.from({length:8},(_,i)=>`<i style="--spark-x:${[12,78,34,88,20,60,45,72][i]}%;--spark-y:${[82,65,92,35,45,78,25,90][i]}%;--spark-delay:${-i*.37}s;--spark-stagger:${i*.045}s"></i>`).join('')}</span>`;}
function comboCardDecoration(p,cell,mini=false){
 const groups=completedCombos(p).filter(g=>g.cells.some(c=>c.x===cell.x&&c.y===cell.y));
 const fresh=celebratingCombos(p).some(g=>g.cells.some(c=>c.x===cell.x&&c.y===cell.y));
 const types=[...new Set(groups.map(g=>g.type))];
 return {style:comboStyle(groups),classes:types.map(t=>'combo-'+t).join(' ')+(fresh?' combo-celebrate':''),keys:groups.map(g=>g.key).join(' '),label:groups.map(g=>g.label+'3枚揃い').join('、'),html:groups.length?`${comboParticlesHTML()}<span class="combo-card-marks ${mini?'mini-combo-marks':''}" aria-hidden="true">${[...new Map(groups.map(g=>[`${g.type}:${g.value}`,g])).values()].map(g=>`<span class="combo-mark ${g.type}" style="${comboStyle([g])}">${mini?(g.type==='race'?RACES:JOBS)[g.value]:g.label}</span>`).join('')}</span>`:''};
}
function comboLedgerHTML(p){
 const groups=completedCombos(p),achievements=objectiveAchievementsHTML(p);if(!groups.length&&!achievements)return '';
 const actual=state.players.find(q=>q.id===p.id)?.bonuses??[];
 return `<div class="combo-ledger">${groups.length?'<b>✦ 3枚揃い</b>':'<b>✉ 追加目標達成</b>'}<div>${groups.map(g=>`<button class="combo-chip ${g.type}" style="${comboStyle([g])}" data-combo="${g.key}" data-combo-player="${p.id}" title="${esc(g.cells.map(c=>CARD[c.card].name).join('・'))}" aria-label="${esc(g.label)}の3枚を強調">${esc(g.label)}（${g.direction}）${!playback&&!actual.includes(g.key)?'（仮）':' ✓'}</button>`).join('')}${achievements}</div>${groups.length?'<small>名前に触れると3枚を強調します。</small>':''}</div>`;
}
function availableComboHints(p){
 if(playback||state.phase!=='place'||p.ready||moves.length>=2||busy)return [];
 return placementComboHints(p).filter(h=>tutorialHandAllowed(h.handIndex)&&tutorialCellAllowed(h.x,h.y));
}
function comboAnnouncementHTML(groups,preview){
 return groups.length?`<div class="combo-announcement" style="${comboStyle(groups)}"><strong>✦ ${preview?'仮配置で3枚揃い！':'3枚揃い成立！'} ✦</strong><div>${groups.map(g=>`<span class="combo-chip ${g.type}" style="${comboStyle([g])}">${esc(g.label)}</span>`).join('')}</div></div>`:'';
}
function logOwnerLabel(entry){const kind=logClassName(entry,myId,state.players);return kind==='log-own'?'あなた':kind==='log-other'?'他プレイヤー':'全体';}
function renderCenter(){
 const host=qs('#centerNotice');if(!host)return;
 if(mode==='setup'||(playback&&state.resolution.events[playback.index].phase==='draw')||(!playback&&!notice)){host.hidden=true;host.innerHTML='';return;}
 host.hidden=false;
 const event=playback?state.resolution.events[playback.index]:notice;
 const learning=mode==='local'&&game?.tutorial?(playback?tutorialFeedback(state.resolution,playback.index,game.tutorialChapter??0,myId):event.learning??null):null;
 const tutorialNotice=mode==='local'&&!!game?.tutorial;
 const foldNotice=mobileLayout()&&!tutorialNotice;
 host.style.left='';host.style.right='';host.style.transform='';
 host.className=`center-notice ${tutorialNotice?'tutorial-notice':''} ${playback?'resolving':'preview-notice'} ${event.battle?'battle-notice':''} ${event.playerId?logClassName(event,myId,state.players):!playback?'log-own':''}`;
 host.innerHTML=`<div class="center-message" role="status" aria-live="polite"><p class="notice-owner">${event.playerId?logOwnerLabel(event):!playback?'あなた':'全体'}の行動</p>${comboAnnouncementHTML(playback&&event.after?celebratingCombos(event.after):event.combos??[],!playback)}<p class="eyebrow">${playback?`${PHASE_NAMES[event.phase]} · ${playback.index+1}/${state.resolution.events.length}`:'仮配置'}</p><h2>${esc(event.title)}</h2>${foldNotice?'<details class="notice-details"><summary>効果・解説を表示</summary>':''}${event.battle&&!learning?battleHTML(event):''}${event.card?`<p class="source-card">${esc(CARD[event.card].name)}</p>`:''}${learning?`${tutorialLearningHTML(learning)}${event.battle?`<details class="tutorial-effect-details"><summary>戦力・順位の詳細</summary>${battleHTML(event)}</details>`:''}${event.changes.length?`<details class="tutorial-effect-details"><summary>増減の内訳</summary><ul class="change-list">${event.changes.map(changeHTML).join('')}</ul></details>`:''}`:event.summary?summaryHTML(event.summary):event.changes.length?`<ul class="change-list">${event.changes.map(changeHTML).join('')}</ul>`:`<p class="muted">${event.battle?'戦力を比べて順位を決定します。同戦力は同順位です。':event.playerId?'この処理によるお金・技術・信仰・VPの増減はありません。':'全員の処理を順番に確認します。'}</p>`}${learning&&playback?'<button id="tutorialShowLog" class="quiet tutorial-log-link">発動した履歴を見る</button>':''}${event.note?`<p class="muted small">${esc(event.note)}</p>`:''}${foldNotice?'</details>':''}</div>${playback?`<div class="replay-controls"><button id="autoReplayButton" aria-pressed="${autoPlay}">${autoPlay?'自動再生を停止':'自動再生（ゆっくり）'}</button><button id="advanceReplayButton" class="primary">${learning&&game?.tutorial?'解説を閉じて次へ':playback.index===state.resolution.events.length-1?'確認を終える':'次の処理'}</button></div>`:'<button id="closeNoticeButton" class="quiet notice-close" aria-label="増減メッセージを閉じる">解説を閉じる</button>'}`;
 if(qs('#tutorialShowLog'))qs('#tutorialShowLog').onclick=()=>{mobileLogsOpen=true;const fold=qs('.log-fold');if(fold)fold.open=true;tutorialScrollTo(qs('.logs .tutorial-log-active')??qs('.log-panel'));};
 if(qs('#advanceReplayButton'))qs('#advanceReplayButton').onclick=advanceReplay;
 if(qs('#autoReplayButton'))qs('#autoReplayButton').onclick=()=>{autoPlay=!autoPlay;store.set('magnolia-auto-play',autoPlay);renderCenter();scheduleReplay();};
 if(qs('#closeNoticeButton'))qs('#closeNoticeButton').onclick=()=>{clearTimeout(noticeTimer);notice=null;if(mode==='local'&&game?.tutorial)render();else renderCenter();};
}
const LEVEL_RANGES=['0','1〜2','3〜6','7〜14','15'];
function metersHTML(p){
 return `<div class="level-meters">${['tech','faith'].map(stat=>{
  const n=p[stat],m=levelProgress(n),name=stat==='tech'?'技術':'信仰';
  return `<div class="level-meter ${stat}" role="meter" aria-label="${esc(p.name)}の${name}点とレベル" aria-valuemin="0" aria-valuemax="15" aria-valuenow="${n}" aria-valuetext="${n}点、レベル${m.level}${m.next===null?'、上限':`、次のレベルは${m.next}点`}"><div class="meter-heading"><b>${name} ${n}点</b><span><span class="meter-current-label">現在 </span>Lv.${m.level}</span></div><div class="meter-track point-progress" aria-hidden="true"><span class="meter-fill" style="width:${m.percent}%"></span>${[0,1,3,7,15].map((points,i)=>`<i class="meter-tick" style="left:${i*25}%" title="${points}点：Lv.${i}"></i>`).join('')}<i class="meter-current-position" style="left:${m.percent}%" title="現在 ${n}点"></i></div><div class="level-scale">${LEVEL_RANGES.map((range,i)=>`<span class="level-stage ${i===m.level?'current':i<m.level?'reached':''}" ${i===m.level?'aria-current="step"':''}><b>Lv.${i}</b><small>${range}点</small></span>`).join('')}</div><small>${m.next===null?'上限：Lv.4・15点':`次は ${m.next}点でLv.${m.level+1}（あと${m.remaining}点）`}</small></div>`;
 }).join('')}</div>`;
}
function handBacksHTML(p,event){
 const count=playback?p.handCount:(p.hand?.length??p.handCount),animation=event?.playerId===p.id?event.handAnimation:null;
 return `<div class="public-hand" aria-label="${esc(p.name)}の手札${count}枚"><span>手札 ${count}枚</span><div class="hand-backs">${Array.from({length:5},(_,i)=>{
  const leaving=animation?.type==='discard'&&i>=animation.to&&i<animation.from,entering=animation?.type==='refill'&&i>=animation.from&&i<animation.to;
  return `<span class="back-slot ${i<count||leaving?'filled':''} ${leaving?'back-leaving':entering?'back-entering':''}" style="--card-delay:${Math.max(0,i-(animation?.type==='discard'?animation.to:animation?.from??0))*65}ms">${i<count||leaving?'<img src="assets/card-back.png" alt="裏向きの手札">':''}</span>`;
 }).join('')}</div></div>`;
}
function isCombatant(p,cell){return !p.board.some(c=>c.x===cell.x&&c.y<cell.y)||CARD[cell.card].effects.some(e=>e.phase==='alwaysPower');}
function warStanding(p){const players=resolutionView({...state,you:myId},playback.index).players.map(q=>({...q,power:power(q)}));return battleRank(players,{power:power(p)});}
function battleHTML(event){
 const view=resolutionView({...state,you:myId},playback.index);
 return `<div class="battle-arena" aria-label="各王国の戦争演出"><p class="battle-caption">前線と射手が参戦 · 演出によって王国のカードは失われません</p><div class="battle-armies" style="--players:${view.players.length}">${view.players.map(p=>{
  const army=event.battle.find(a=>a.id===p.id),fighters=p.board.filter(c=>isCombatant(p,c));
  return `<div class="battle-army ${army.rank===1?'battle-winner':'battle-defeated'}"><b class="army-banner"><span aria-hidden="true">⚑</span> ${esc(p.name)}</b><span class="army-power">戦力 ${army.power}</span><div class="army-units">${fighters.length?fighters.map((c,i)=>`<img src="${CARD[c.card].image}" alt="${CARD[c.card].name}" style="--unit-delay:${i*60}ms">`).join(''):'<span class="empty-army">配置なし</span>'}<span class="battle-impact" aria-hidden="true">⚔</span></div><strong class="army-result">戦争 ${army.rank}位${army.rank===1?' 👑':''}</strong></div>`;
 }).join('')}</div></div>`;
}
function miniKingdom(p,active){
 const b=bounds(p.board),width=b.maxX-b.minX+1;let html='';
 for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){
  const cell=p.board.find(c=>c.x===x&&c.y===y),combo=cell?comboCardDecoration(p,cell,true):null;
  html+=cell?`<button data-card="${cell.card}" data-combo-player="${p.id}" data-combo-keys="${combo.keys}" style="${combo.style}" class="mini-card ${combo.classes} ${!p.board.some(c=>c.x===x&&c.y<y)?'frontline':'rearline'} ${active&&cell===p.board.at(-1)?'just-placed':''} ${playback&&state.resolution.events[playback.index].phase==='war'&&isCombatant(p,cell)?`war-combatant ${warStanding(p)===1?'war-survivor':'war-fallen'} ${state.resolution.events[playback.index].battle?'war-clash':'war-settled'}`:''}" aria-label="${esc(p.name)}の${CARD[cell.card].name}の詳細${combo.label?`、${combo.label}`:''}"><img src="${CARD[cell.card].image}" alt="${CARD[cell.card].name}">${combo.html}${!p.board.some(c=>c.x===x&&c.y<y)?'<span class="mini-front-label" aria-hidden="true">⚑</span>':''}</button>`:'<span class="mini-empty"></span>';
 }
 return p.board.length?`<div class="mini-board" style="grid-template-columns:repeat(${width},var(--mini-width,40px))">${html}</div>`:'<span class="muted small">まだ配置なし</span>';
}
function kingdomGallery(view,draft){
 const players=view.players.map(p=>p.id===myId&&!playback?draft:p),event=playback?state.resolution.events[playback.index]:null;
 return `<section id="kingdomOverview" class="kingdom-overview ${mobileOverviewCompact?'mobile-overview-compact':''}" aria-label="全員の王国"><div class="overview-label"><b>全員の王国</b><span class="desktop-overview-hint">現在順位はVP順 ／ 上側が前方 ／ ⚑ 金色の枠が前線</span><span class="mobile-only">横にスワイプして全員を確認</span><button id="mobileOverviewToggle" class="mobile-only quiet" aria-expanded="${!mobileOverviewCompact}">${mobileOverviewCompact?'王国を広げる':'王国を小さく'}</button></div><div class="kingdom-gallery" style="--players:${players.length}">${players.map(p=>`<article class="kingdom-mini ${event?.playerId===p.id?'processing':''} ${p.id===myId?'my-kingdom':''}"><button class="kingdom-name" data-player="${p.id}"><b>${esc(p.name)}</b><span class="rank-badge">${scoreRank(players,p)}位</span></button><div class="kingdom-values"><b>${p.vp} VP</b><span>${p.gold}金</span><span class="power-value">戦力 ${power(p)}</span></div>${metersHTML(p)}<div class="mini-arena">${miniKingdom(p,event?.playerId===p.id&&event.phase==='place'&&!!event.card)}</div>${handBacksHTML(p,event)}${event?.phase==='war'?`<span class="war-placement">戦争 ${warStanding(p)}位</span>`:''}${event?.playerId===p.id?'<span class="processing-label">処理中</span>':p.id===myId&&moves.length&&!playback?`<span class="processing-label">${p.ready?'配置確定済み':'仮配置を含む'}</span>`:''}</article>`).join('')}</div><nav class="mobile-navigation mobile-only" aria-label="対戦中の移動"><button data-mobile-jump="board">自分の王国</button><button data-mobile-jump="hand">手札・操作</button></nav></section>`;
}
function showCard(id){
 const c=CARD[id];if(!c)return;
 qs('#detailBody').innerHTML=`<div class="detail-layout"><img src="${c.image}" alt="${esc(c.name)}"><div><p class="eyebrow">${RACES[c.race]} / ${JOBS[c.job]}</p><h2>${c.name}</h2><p>コスト <b>${c.cost}金</b>　基本戦力 <b>${c.power}</b></p><ul>${c.effects.map(e=>`<li>${effectText(e)}</li>`).join('')}</ul><h3>配置ボーナス</h3><p>種族：${bonusText(RACE_BONUS[c.race])}<br>職業：${bonusText(JOB_BONUS[c.job])}</p><p class="muted small">収録枚数：${c.copies}枚</p></div></div>`;
 qs('#detailDialog').showModal();
}
qs('#catalogBody').innerHTML=CARDS.map(c=>`<button data-card="${c.id}" aria-label="${c.name}の詳細"><img src="${c.image}" alt="${c.name}" loading="lazy"><span>${c.copies}枚</span></button>`).join('');
qs('#catalogBody').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)showCard(b.dataset.card);});
qs('#catalogButton').onclick=()=>qs('#catalogDialog').showModal();qs('#rulesButton').onclick=()=>qs('#rulesDialog').showModal();
for(const button of document.querySelectorAll('.dialog-close'))button.onclick=()=>button.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});

function cpuSettings(){return Array.from({length:setup.total-1},(_,i)=>setupTab==='online'&&i>=setup.cpuCount?setup.cpuDifficulty:(setup.cpuDifficulties[i]??setup.cpuDifficulty));}
function cpuStrengthFields(){
 const count=setupTab==='online'?setup.cpuCount:setup.total-1;
 const seats=Array.from({length:count},(_,i)=>setup.cpuDifficulties[i]??setup.cpuDifficulty);
 const values=setupTab==='online'?[...seats,setup.cpuDifficulty]:seats;
 const common=values.every(d=>d===values[0])?values[0]:'mixed';
 const options=value=>Object.entries(CPU_LEVELS).map(([key,name])=>`<option value="${key}" ${value===key?'selected':''}>${name}</option>`).join('');
 return `<fieldset class="cpu-strength-settings"><legend>CPUの強さ</legend><label class="cpu-strength-all">${count?'全CPUまとめて':'空席を補充するCPU'}<select id="difficultyInput">${common==='mixed'?'<option value="mixed" selected disabled>個別設定中</option>':''}${options(common)}</select></label>${count?`<div class="cpu-strength-seats">${seats.map((value,i)=>`<label>CPU ${i+1}<select data-cpu-seat="${i}" aria-label="CPU ${i+1}の強さ">${options(value)}</select></label>`).join('')}</div>${setupTab==='online'?`<p class="muted small cpu-strength-hint">追加の空席は「${CPU_LEVELS[setup.cpuDifficulty]}」のCPUで補充します。</p>`:''}`:'<p class="muted small cpu-strength-hint">開始時に空席があれば、この強さのCPUで補充します。</p>'}<p class="muted small cpu-strength-guide">弱い：気ままに配置 ／ 普通：バランス重視<br>強い：配置順と組み合わせを比較 ／ 凄腕：相手の行動と次ラウンドを予測<br>覇王：未知の手札も予測し、3ラウンドを比較</p></fieldset>`;
}
function presenceText(p){
 p=(pendingView??state)?.players?.find(q=>q.id===p.id)??p;
 if(p.cpu)return `CPU・${CPU_LEVELS[normalizeCPU(p.cpuDifficulty)]} · ${p.ready?'確定':['draw','place'].includes((pendingView??state)?.phase)?'思考中':'結果確認'}`;
 if(mode==='online'&&!state?.presence?.find(x=>x.id===p.id)?.connected)return '切断中・再接続待ち';
 return p.ready?'確定済み':state?.phase==='lobby'?'接続中':['draw','place'].includes(state?.phase)?'考え中':'結果を確認中';
}
function waitingHTML(){
 if(mode!=='online')return '';
 const live=pendingView??state;
 const waiting=live.players.filter(p=>!p.cpu&&!p.ready&&['draw','place'].includes(live.phase));
 return `<section class="waiting-banner" aria-live="polite"><b>${waiting.length?`確定待ち：${waiting.map(p=>esc(p.name)).join('・')}`:'全員の行動が確定しています'}</b><span>${live.players.filter(p=>!p.cpu).map(p=>`${esc(p.name)}：${presenceText(p)}`).join(' ／ ')}</span><small>${backupSaved?'対戦はブラウザに自動保存済み。最後の操作から7日間、同じブラウザから復元できます。':'ブラウザに保存できません。空き容量や保存設定を確認してください。'}</small></section>`;
}
function reviewHTML(){
 const reviews=state.roundReviews??[];if(!reviews.length)return '';
 const selected=reviews.find(r=>r.round===reviewRound)??reviews.at(-1);
 return `<details class="panel round-review" ${reviewOpen?'open':''}><summary>ラウンドの振り返り · R${selected.round}</summary><label>振り返るラウンド<select id="reviewRound">${reviews.map(r=>`<option value="${r.round}" ${r===selected?'selected':''}>ラウンド ${r.round}</option>`).join('')}</select></label><div class="review-players">${selected.players.map(p=>`<section><h3>${esc(p.name)}</h3><p>${['gold','tech','faith','vp'].map(k=>`${{gold:'お金',tech:'技術',faith:'信仰',vp:'VP'}[k]} ${p.before[k]} → ${p.after[k]}${['tech','faith'].includes(k)?`（Lv.${level(p.before[k])} → Lv.${level(p.after[k])}）`:''}`).join(' ／ ')}</p>${p.steps.map(step=>`<details><summary>${PHASE_NAMES[step.phase]??step.phase} · ${esc(step.title)}</summary>${step.changes.length?`<ul class="change-list">${step.changes.map(changeHTML).join('')}</ul>`:'<p class="muted small">資源の増減なし</p>'}</details>`).join('')}</section>`).join('')}</div></details>`;
}
function warFields(){return `<div class="war-fields">${Array.from({length:setup.total},(_,i)=>`<label>${i+1}位<input data-war="${i}" type="number" min="0" max="50" value="${setup.warVP[i]??0}" aria-label="${i+1}位の戦争VP"></label>`).join('')}</div>`;}
function renderSetup(){
 const saved=store.get('magnolia-local');
 const oldSession=store.get('magnolia-session');
 app.innerHTML=`<section class="setup"><div class="tavern-welcome"><span class="inn-emblem" aria-hidden="true">✦</span><div><p class="inn-sign">THE AMBER LANTERN</p><h2>琥珀の灯亭</h2><p>灯りの下、今宵もひとつの王国が生まれる。</p></div><span class="inn-emblem" aria-hidden="true">✦</span></div><div class="setup-head"><div><p class="eyebrow">旅人たちの卓</p><h1>対戦を始める</h1></div><span class="muted small">2〜5人</span></div><div class="tabs"><button data-tab="local" class="${setupTab==='local'?'active':''}">CPU対戦</button><button data-tab="online" class="${setupTab==='online'?'active':''}">オンライン対戦</button></div><div class="tutorial-entry"><div><b>初めての旅人へ</b><span>画像つきの導入で基本を知り、基本3章と追加目標の練習へ。光るカードと場所が次の操作を案内します。</span></div><div class="tutorial-entry-actions"><button id="tutorialButton">チュートリアルで遊ぶ</button><button id="objectiveTutorialButton">追加目標を練習する</button></div></div><div class="setup-grid"><section class="panel"><h2>${setupTab==='local'?'CPUと遊ぶ':'部屋を作る・参加する'}</h2><label>プレイヤー名<input id="nameInput" maxlength="20" value="${esc(setup.name)}"></label>${setupTab==='online'?`<label style="margin-top:18px">対戦サーバーURL<input id="serverInput" type="url" placeholder="https://……onrender.com" value="${esc(setup.server)}"></label><p class="muted small" style="margin:8px 0">接続先は設定済みです。そのまま部屋を作成できます。</p>`:''}<div class="fields"><label>合計人数<select id="totalInput">${[2,3,4,5].map(n=>`<option value="${n}" ${setup.total===n?'selected':''}>${n}人${setupTab==='local'?`（あなた＋CPU${n-1}人）`:''}</option>`).join('')}</select></label>${setupTab==='online'?`<label>CPU用に確保する席<select id="cpuInput">${Array.from({length:setup.total},(_,i)=>`<option value="${i}" ${setup.cpuCount===i?'selected':''}>${i}席</option>`).join('')}</select></label>`:''}</div>${cpuStrengthFields()}<label class="objective-option"><input id="objectivesInput" type="checkbox" ${setup.additionalObjectives?'checked':''}>追加目標を使う（12枚からランダムに4枚）</label><p class="small muted">先に条件を達成すると各3VP。同時達成は全員が得点します。</p><h3>戦争で獲得するVP</h3>${warFields()}<p class="muted small" style="margin:10px 0">同点は同順位。次の順位は飛ばします。</p><button id="createButton" class="primary">${setupTab==='local'?'CPU対戦を開始':'部屋を作成'}</button>${setupTab==='local'&&saved?'<button id="resumeLocal" style="width:100%;margin-top:10px">前回のCPU対戦を再開</button>':''}${setupTab==='online'?`<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)"><label>部屋番号<input id="roomInput" placeholder="例：A1B2C3" maxlength="6" value="${esc(setup.room)}" style="text-transform:uppercase"></label><button id="joinButton" style="width:100%;margin-top:12px">部屋に参加</button>${oldSession?'<button id="resumeOnline" style="width:100%;margin-top:10px">前回の部屋に再接続</button>':''}</div>`:''}<div id="formError" class="form-error" role="alert"></div></section><aside class="panel"><h2>ラウンドの流れ</h2><ul class="mini-sequence"><li><span>01</span><div><b>手札を交換</b><br>捨てるカードを選び、5枚まで補充。</div></li><li><span>02</span><div><b>最大2枚を配置</b><br>上下左右につなげて、王国を広げる。</div></li><li><span>03</span><div><b>戦争・発展・収入・VP</b><br>全員の確定後に、自動で計算。</div></li></ul><div class="note">誰かが40VP、または9体配置したラウンドで終了。残金も得点に加わります。</div><p class="muted small" style="margin:18px 0 0">説明書の収録枚数に準拠した41種類・102枚です。各カードは1〜3枚。カード一覧で個別の枚数を確認できます。</p></aside></div></section>`;
 qs('#objectivesInput').onchange=e=>setup.additionalObjectives=e.target.checked;
 qs('#tutorialButton').onclick=()=>openTutorialIntro();
 qs('#objectiveTutorialButton').onclick=()=>startTutorial(3);
 qs('#nameInput').oninput=e=>{setup.name=e.target.value;store.set('magnolia-name',setup.name);};
 qs('#difficultyInput').onchange=e=>{setup.cpuDifficulty=e.target.value;setup.cpuDifficulties=Array(setup.total-1).fill(setup.cpuDifficulty);store.set('magnolia-cpu-difficulty',setup.cpuDifficulty);store.set('magnolia-cpu-seats',setup.cpuDifficulties);renderSetup();};
 for(const el of document.querySelectorAll('[data-cpu-seat]'))el.onchange=e=>{setup.cpuDifficulties[Number(el.dataset.cpuSeat)]=e.target.value;store.set('magnolia-cpu-seats',setup.cpuDifficulties);renderSetup();};
 qs('#totalInput').onchange=e=>{setup.total=Number(e.target.value);setup.cpuCount=Math.min(setup.cpuCount,setup.total-1);setup.warVP=setup.total===2?[4,0]:[5,3,0,0,0];renderSetup();};
 for(const el of document.querySelectorAll('[data-war]'))el.oninput=e=>setup.warVP[Number(el.dataset.war)]=Number(e.target.value);
 for(const el of document.querySelectorAll('[data-tab]'))el.onclick=()=>{setupTab=el.dataset.tab;renderSetup();};
 qs('#createButton').onclick=()=>setupTab==='local'?startLocal():connectRoom('create');
 if(qs('#resumeLocal'))qs('#resumeLocal').onclick=()=>{game=saved;mode='local';myId='human';boardId=myId;draftKey='';applyView(publicView(game,myId));};
 if(qs('#serverInput'))qs('#serverInput').oninput=e=>setup.server=e.target.value;
 if(qs('#cpuInput'))qs('#cpuInput').onchange=e=>{setup.cpuCount=Number(e.target.value);renderSetup();};
 if(qs('#roomInput'))qs('#roomInput').oninput=e=>setup.room=e.target.value.toUpperCase();
 if(qs('#joinButton'))qs('#joinButton').onclick=()=>connectRoom('join');
 if(qs('#resumeOnline'))qs('#resumeOnline').onclick=()=>resumeOnline(oldSession);
}

function tutorialTaskNow(){
 if(mode!=='local'||!game?.tutorial||playback)return null;
 if(game.tutorialChapter===3&&state.phase==='place'){const read=game.tutorialLettersRead??[],kind=!read.includes('own')?'own':!read.includes('rivals')?'rivals':null;if(kind)return {handIndex:-1,canConfirm:false,target:`[data-objective-mail="${kind}"]`,purpose:kind==='own'?'青い手紙で、自分の数値が条件にどれだけ近づいたかを確認します。':'赤い手紙で、相手がどの目標に近づいているかを確認します。',text:`盤面左上の${kind==='own'?'青':'赤'}い手紙を押して、案内を読みましょう。`};}
 const draft=currentDraft();return tutorialTask(game.tutorialChapter??0,state.phase,draft.hand,moves.length,[...discard]);
}
function tutorialNoticeOpen(){return mode==='local'&&game?.tutorial&&!!notice&&!playback;}
function tutorialHandAllowed(index){if(tutorialNoticeOpen())return false;const task=tutorialTaskNow();return !task||task.handIndex===index;}
function tutorialCellAllowed(x,y){const task=tutorialTaskNow();return !task||tutorialPlacementAllowed(task,task.handIndex,x,y);}
let tutorialSlide=0,tutorialHandFocusKey=null,tutorialEffectFocusKey=null;
function openTutorialIntro(index=0){
 tutorialSlide=index;const slide=TUTORIAL_SLIDES[index];
 const image=id=>`<img src="${CARD[id].image}" alt="${esc(CARD[id].name)}">`;
 const pair=(ids)=>`<div class="intro-cards">${ids.map(id=>`<figure>${image(id)}<figcaption>${esc(CARD[id].name)}</figcaption></figure>`).join('')}</div>`;
 const flow=active=>`<ol class="intro-round-flow">${['draw','place','war','develop','income','vp'].map((phase,i)=>`<li ${phase===active?'aria-current="step"':''}><span>${i+1}</span><b>${PHASE_NAMES[phase]}</b></li>`).join('')}</ol>`;
 const lessonCards=(ids,notes)=>`<div class="intro-effect-examples">${ids.map((id,i)=>`<figure>${image(id)}<figcaption><b>${esc(CARD[id].name)}</b><span>${esc(notes[i])}</span></figcaption></figure>`).join('')}</div>`;
 const front=()=>`<div class="intro-front"><strong>↑ 前方 ／ 各縦列の一番上が前線</strong><div class="intro-column-labels"><span>縦列1</span><span>縦列2</span><span>縦列3</span></div><div class="intro-stair-board">${Array.from({length:9},(_,i)=>{const x=i%3,y=Math.floor(i/3),card=TUTORIAL_FRONTLINE.find(c=>c.x===x&&c.y===y);if(!card)return '<div class="intro-stair-empty" aria-hidden="true"></div>';const front=!TUTORIAL_FRONTLINE.some(c=>c.x===x&&c.y<y);return `<figure class="${front?'intro-stair-front':'intro-stair-rear'}">${image(card.card)}<figcaption>${front?'⚑ 前線':'後方'}</figcaption></figure>`;}).join('')}</div><span>金色の枠の3枚が参戦。横に一直線でなくても前線です。</span></div>`;
 const visual={
  welcome:'<div class="intro-landscape"><span>MAGNOLIA</span><b>冒険者の宿・琥珀の灯亭</b></div>',
  kingdom:`<div class="intro-kingdom">${['human_knight','elf_mistic','dwarf_pugilist','human_marchant','dwarf_cook','elf_saint'].map(image).join('')}</div><p class="intro-caption">仲間を並べて、あなたの王国へ</p>`,
  flow:`${flow()}<p class="intro-caption">終了しなければ、①ドローへ戻ります</p>`,
  draw:`${lessonCards(['demon_storm','human_marchant'],['9金：今は5金。交換する？','1金：今から配置できる'])}<p class="intro-caption">捨てるカードを選ぶ → 手札を5枚へ</p>`,
  placement:`${pair(['human_marchant','dwarf_cook'])}<div class="intro-phase-list"><span>1枚目：行商に1金</span><span>2枚目：料理人に2金</span></div><p class="intro-caption">5金から2枚配置すると、残り2金</p>`,
  front:front(),
  develop:lessonCards(['dwarf_cook','elf_saint'],['発展：技術＋1','発展：信仰＋1']),
  income:`${lessonCards(['human_marchant'],['収入：＋1金'])}<div class="intro-equation">基本3金 ＋ 行商1金 ＝ <b>4金</b></div>`,
  scoring:lessonCards(['dwarf_cook','elf_follower'],['VP：技術Lv. × 1VP','VP：信仰Lv. × 1VP']),
  effects:`${lessonCards(['elf_follower'],['配置時：信仰＋2 ／ VP：信仰Lv. × 1VP'])}<div class="intro-phase-list"><span>配置時 → 置いた瞬間だけ</span><span>VP → 毎ラウンド</span></div>`,
  levels:`${pair(['elf_artist','elf_mistic'])}<div class="intro-thresholds">${[['0',0],['1〜2',1],['3〜6',2],['7〜14',3],['15',4]].map(([point,lv])=>`<span><b>${point}点</b>Lv.${lv}</span>`).join('')}</div><p class="intro-caption">芸術家：技術Lv.×2 VP ／ 神秘家：信仰Lv.×2の追加戦力</p>`,
  practice:`${pair(['human_marchant','dwarf_cook'])}<p class="intro-caption">最初の練習：行商と料理人の小さな王国</p>`
 }[slide.kind];
 qs('#tutorialIntroBody').innerHTML=`<div class="intro-heading"><p class="eyebrow">${esc(slide.section)} · ${index+1} / ${TUTORIAL_SLIDES.length}</p><h2 id="tutorialIntroTitle">${esc(slide.title)}</h2></div><div class="intro-content"><div class="intro-visual">${slide.phase?flow(slide.phase):''}${visual}</div><p class="intro-description">${esc(slide.text)}</p></div><div class="intro-footer"><button id="introBack" ${index===0?'disabled':''}>戻る</button><div class="intro-dots" aria-label="スライド ${index+1} / ${TUTORIAL_SLIDES.length}">${TUTORIAL_SLIDES.map((_,i)=>`<span class="${i===index?'active':''}"></span>`).join('')}</div><button id="introNext" class="primary">${index===TUTORIAL_SLIDES.length-1?'盤面で練習を始める':'次へ'}</button></div>`;
 qs('#introBack').onclick=()=>openTutorialIntro(tutorialSlide-1);
 qs('#introNext').onclick=()=>{if(tutorialSlide<TUTORIAL_SLIDES.length-1)openTutorialIntro(tutorialSlide+1);else{qs('#tutorialIntroDialog').close();startTutorial();}};
 const dialog=qs('#tutorialIntroDialog');if(!dialog.open)dialog.showModal();qs('.intro-content').scrollTop=0;qs('#introNext').focus({preventScroll:true});
}
function startTutorial(chapter=0){
 clearTimeout(playTimer);clearTimeout(noticeTimer);clearFinalResults();playback=null;pendingView=null;notice=null;
 game=tutorialGame(setup.name,chapter);tutorialHandFocusKey=null;tutorialEffectFocusKey=null;autoPlay=false;fillCPU(game,submit);mode='local';myId='human';boardId=myId;draftKey='';state=null;moves=[];selected=null;seenResolutions.clear();seenFinalResults.clear();tutorialDockCollapsed=mobileLayout();
 applyView(publicView(game,myId));requestAnimationFrame(()=>qs('.tutorial-guide')?.scrollIntoView({block:'start',behavior:'instant'}));
}
function tutorialGuideNow(){
 const replayPhase=playback?state.resolution.events[playback.index].phase:null;
 const guide=tutorialGuide({chapter:game?.tutorialChapter??0,phase:state.phase,moves:moves.length,replayPhase});
 const event=playback?state.resolution.events[playback.index]:null;
 guide.personal=event?tutorialPhaseOutcome({events:[event]},replayPhase,myId):[];
 guide.learning=playback?tutorialFeedback(state.resolution,playback.index,game.tutorialChapter??0,myId):null;
 return guide;
}
function tutorialFinishControls(){
 const chapter=game.tutorialChapter??0;
 return `<div class="tutorial-finish-actions">${chapter<TUTORIAL_CHAPTERS.length-1?'<button data-tutorial-next class="primary">次の章を練習する</button>':'<button data-tutorial-play class="primary">通常のCPU対戦を始める</button>'}<button data-tutorial-retry>この章をもう一度</button><button data-tutorial-menu class="quiet">メニューへ戻る</button></div>`;
}
function tutorialBrief(guide){
 if(guide.done)return (game.tutorialChapter??0)<TUTORIAL_CHAPTERS.length-1?'この章の練習は完了です。下のボタンで次の章へ進めます。':'練習は完了です。下のボタンから通常対戦を始められます。';
 if(guide.step<=2)return tutorialTaskNow()?.text??guide.text;
 const phase=state.resolution.events[playback.index].phase;
 return {place:'代金を払ってから配置時効果・ボーナスを処理します。「次の処理」で確認しましょう。',war:'金色の前線の戦力を比べ、戦争順位に応じたVPを得ます。',develop:'発展効果で技術・信仰が増えます。レベルの変化も見てみましょう。',income:'基本3金に、カードの収入を加えます。',vp:'カードのVP効果を処理します。発展後のレベルを使います。',final:'残金3金につき1VPを加え、最終VPで勝敗を決めます。'}[phase]??guide.text;
}
function openTutorialHandbook(topic=0){
 const dialog=qs('#tutorialHandbookDialog');clearTimeout(playTimer);
 const active=mode==='local'&&game?.tutorial;
 const lesson=active?TUTORIAL_CHAPTERS[game.tutorialChapter??0]:null,guide=active?tutorialGuideNow():null;
 const sections=[...(active?[{key:'lesson',title:'この章の説明',paragraphs:[lesson.intro,lesson.goal,guide.text,...(guide.learning?.paragraphs??guide.personal)]}]:[]),...(active&&!playback&&state.phase==='place'?[{key:'hints',title:'今の盤面を見るヒント',paragraphs:tutorialObservation(currentDraft(),state.players.filter(p=>p.id!==myId))}]:[]),...TUTORIAL_REFERENCE.map((t,i)=>({...t,key:String(i)}))];
 const selected=sections.find(t=>t.key===String(topic))??sections[0];
 qs('#tutorialHandbookBody').innerHTML=`<div class="handbook-layout"><nav class="handbook-topics" aria-label="解説の項目">${sections.map(t=>`<button data-handbook-topic="${t.key}" ${t===selected?'aria-current="page"':''}>${esc(t.title)}</button>`).join('')}</nav><article class="handbook-reading" tabindex="0"><h3>${esc(selected.title)}</h3>${selected.key==='2'?'<table class="tutorial-level-table"><thead><tr><th>点数</th><th>レベル</th></tr></thead><tbody><tr><td>0</td><td>Lv.0</td></tr><tr><td>1〜2</td><td>Lv.1</td></tr><tr><td>3〜6</td><td>Lv.2</td></tr><tr><td>7〜14</td><td>Lv.3</td></tr><tr><td>15</td><td>Lv.4</td></tr></tbody></table>':''}${selected.paragraphs.map(t=>`<p>${esc(t)}</p>`).join('')}${selected.key==='lesson'?'<p class="muted small">各章は独立した例題です。章を切り替えると、その章の初期盤面から始まります。</p>':''}</article></div>`;
 for(const el of document.querySelectorAll('[data-handbook-topic]'))el.onclick=()=>openTutorialHandbook(el.dataset.handbookTopic);
 if(!dialog.open)dialog.showModal();
}
qs('#tutorialHandbookButton').onclick=()=>openTutorialHandbook();
qs('#tutorialHandbookDialog').addEventListener('close',()=>scheduleReplay());
function tutorialLearningHTML(learning,compact=false){
 if(!learning)return '';
 const card=CARD[learning.card];return `<div class="tutorial-learning ${compact?'compact':''}">${card?`<img src="${card.image}" alt="${esc(card.name)}">`:''}<div><b>${esc(learning.title)}</b>${(compact?learning.paragraphs.slice(0,1):learning.paragraphs).map(text=>`<p>${esc(text)}</p>`).join('')}</div></div>`;
}
function tutorialHTML(){
 if(mode!=='local'||!game?.tutorial)return '';
 const chapter=game.tutorialChapter??0,guide=tutorialGuideNow();
 return `<section class="panel tutorial-guide tutorial-compact" aria-label="チュートリアル"><div class="tutorial-top"><span class="eyebrow">第${chapter+1}章 / ${TUTORIAL_CHAPTERS.length} · 各章1ラウンド</span><button data-tutorial-menu class="quiet">練習を終了</button></div><nav class="tutorial-chapters" aria-label="練習する章">${TUTORIAL_CHAPTERS.map((c,i)=>`<button data-tutorial-chapter="${i}" ${chapter===i?'aria-current="step"':''}>${i+1}. ${c.title.split('：')[0]}</button>`).join('')}</nav>${!playback?`<div class="tutorial-current" aria-live="polite"><h2>${esc(guide.title)}</h2><p>${esc(tutorialBrief(guide))}</p></div>`:''}<div class="tutorial-reading-links"><button data-tutorial-read="lesson" class="quiet">この章の説明</button>${state.phase==='place'&&!playback?'<button data-tutorial-read="hints" class="quiet">盤面を見るヒント</button>':''}<button data-tutorial-read="0" class="quiet">解説集</button></div></section>`;
}
function startLocal(){
 try{
  const seats=[{id:'human',name:setup.name.trim()||'あなた',cpu:false},...Array.from({length:setup.total-1},(_,i)=>({id:`cpu-${i}`,name:`CPU ${i+1}`,cpu:true,cpuDifficulty:setup.cpuDifficulties[i]??setup.cpuDifficulty}))];
  game=newGame(seats,{additionalObjectives:setup.additionalObjectives,warVP:setup.warVP,cpuDifficulty:setup.cpuDifficulty,cpuDifficulties:cpuSettings()});fillCPU(game,submit);mode='local';myId='human';boardId=myId;draftKey='';applyView(publicView(game,myId));
 }catch(e){qs('#formError').textContent=e.message;}
}
function validateServer(value){
 const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('対戦サーバーのURLを確認してください。');
 if(location.protocol==='https:'&&url.protocol!=='https:')throw Error('HTTPSの対戦サーバーURLを使用してください。');
 return url.origin;
}
async function request(server,route,body){
 const res=await fetch(`${server}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const result=await res.json();if(!res.ok)throw Error(result.error||'接続に失敗しました。');return result;
}
async function connectRoom(action){
 if(connecting)return;connecting=true;
 const error=qs('#formError');error.textContent='サーバーに接続しています…休止中の場合は起動に1分ほどかかります。';
 for(const button of document.querySelectorAll('#createButton,#joinButton'))button.disabled=true;
 try{
  const server=validateServer(setup.server);store.set('magnolia-server',server);
  const health=await fetch(`${server}/health`,{signal:AbortSignal.timeout(120000)});
  if(!health.ok)throw Error('サーバーの起動を確認できません。少し待って再度お試しください。');
  const data=await request(server,action,{name:setup.name,room:setup.room,total:setup.total,cpuCount:setup.cpuCount,settings:{additionalObjectives:setup.additionalObjectives,warVP:setup.warVP,cpuDifficulty:setup.cpuDifficulty,cpuDifficulties:cpuSettings()}});
  session={server,room:data.state.room,token:data.token,id:data.id};store.set('magnolia-session',session);mode='online';myId=session.id;boardId=myId;draftKey='';applyView(data.state);openStream();
 }catch(e){error.textContent=e.name==='TypeError'?'サーバーに接続できません。URLとサーバーの稼働状態を確認してください。':e.name==='TimeoutError'?'サーバーの起動に時間がかかっています。少し待って再度お試しください。':e.message;}
 finally{connecting=false;for(const button of document.querySelectorAll('#createButton,#joinButton'))button.disabled=false;}
}
async function resumeOnline(previous){
 if(recovering)return;recovering=true;const generation=recoveryGeneration;
 try{session=previous;connection='保存した対戦に再接続中…';updateConnection();
 const health=await fetch(`${session.server}/health`,{signal:AbortSignal.timeout(120000)});if(!health.ok)throw Error('サーバーを起動できません。');
 const res=await fetch(`${session.server}/api/state?${new URLSearchParams({room:session.room,token:session.token})}`,{signal:AbortSignal.timeout(20000)});let data=await res.json();
 if(generation!==recoveryGeneration)return;const backup=store.get(backupKey());
 if(!res.ok&&!backup)throw Error(data.error);
 if(backup){data=await request(session.server,'restore',{room:session.room,token:session.token,backup});if(!res.ok)toast('保存した対戦を復元しました。');}
 if(generation!==recoveryGeneration)return;mode='online';myId=session.id;boardId=myId;draftKey='';applyView(data);openStream();}catch(e){if(qs('#formError'))qs('#formError').textContent=e.message;toast(e.message);}finally{recovering=false;}
}
function backupKey(){return `magnolia-backup:${session?.server}:${session?.room}`;}
function openStream(){
 stream?.close();clearTimeout(reconnectTimer);connection='接続中';
 stream=new EventSource(`${session.server}/api/stream?${new URLSearchParams({room:session.room,token:session.token})}`);
 stream.onopen=()=>{clearTimeout(reconnectTimer);connection='接続済み';updateConnection();};
 stream.onmessage=e=>{connection='接続済み';applyView(JSON.parse(e.data));};
 stream.onerror=()=>{connection='再接続中… 操作は復帰後に続けられます';updateConnection();clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>{if(mode==='online')resumeOnline(session);},3500);};
}
function updateConnection(){const el=qs('#connection');if(el){el.textContent=connection;el.className=`connection ${connection==='接続済み'?'connected':'error'}`;}}
async function remote(route,extra={}){
 if(connection!=='接続済み'){toast('再接続が完了してから操作してください。');return;}
 if(busy)return;busy=true;render();
 try{const data=await request(session.server,route,{room:session.room,token:session.token,gameId:state.gameId,...extra});applyView(data);}catch(e){toast(e.message);}finally{busy=false;render();}
}
function applyView(view){
 if(mode==='online'&&view.backup){const saved=store.set(backupKey(),view.backup);if(backupSaved&&!saved)toast('ブラウザの空き容量が不足しているため、対戦を保存できません。');backupSaved=saved;}
 if(mode==='online'&&view.presence){state&&(state.presence=view.presence);pendingView&&(pendingView.presence=view.presence);}
 if(state?.gameId&&view.gameId&&state.gameId!==view.gameId){clearTimeout(playTimer);clearTimeout(noticeTimer);playback=null;pendingView=null;notice=null;seenResolutions.clear();boardId=myId;clearFinalResults();}
 if(playback&&view.resolution?.id!==playback.id){pendingView=view;return;}
 state=view;const key=`${mode}:${view.room||''}:${view.gameId||''}:${view.round||0}:${view.phase}`;
 if(key!==draftKey){placementCelebration=null;draftKey=key;moves=[];discard=new Set();selected=null;}
 if(view.phase==='place'&&view.ownOrder?.moves)moves=structuredClone(view.ownOrder.moves);
 if(mode==='local'&&!game?.tutorial)store.set('magnolia-local',game);
 if(view.resolution?.events.length&&!seenResolutions.has(view.resolution.id)){seenResolutions.add(view.resolution.id);playback={id:view.resolution.id,index:0};notice=null;clearTimeout(noticeTimer);scheduleReplay();}
 render();
}
function returnSetup(){placementCelebration=null;qs("#beerPourRig").classList.remove("is-pouring");clearFinalResults();seenFinalResults.clear();recoveryGeneration++;cleanupDrag?.();cleanupDrag=null;clearTimeout(playTimer);clearTimeout(noticeTimer);playback=null;pendingView=null;notice=null;seenResolutions.clear();stream?.close();clearTimeout(reconnectTimer);stream=null;mode='setup';game=null;state=null;moves=[];selected=null;draftKey='';renderSetup();renderCenter();}
function renderLobby(){
 app.innerHTML=`<section class="setup"><div class="setup-head"><h1>参加者を待っています</h1><button id="backButton" class="quiet">戻る</button></div><div class="setup-grid"><section class="panel"><p class="muted small">部屋番号</p><div class="room-code">${esc(state.room)}</div><div id="connection" class="connection">${connection}</div><ul class="lobby-members">${state.players.map(p=>`<li><b>${esc(p.name)}${p.id===myId?'（あなた）':''}</b><span>${presenceText(p)}</span><span class="muted small">${p.id===state.hostId?'部屋主':'参加者'}</span></li>`).join('')}${Array.from({length:state.total-state.players.length},()=>'<li class="muted">空席<span class="small">開始時にCPUで補充</span></li>').join('')}</ul><div class="room-actions"><button id="shareButton">招待リンクをコピー</button>${myId===state.hostId?`<button id="startOnline" class="primary" ${busy?'disabled':''}>${state.players.length<state.total?'空席をCPUで埋めて開始':'ゲーム開始'}</button>`:'<span class="muted small">部屋主が開始するまでお待ちください。</span>'}</div></section><aside class="panel"><h2>部屋の設定</h2><p>合計 ${state.total}人</p><p>CPUの強さ：${(state.settings.cpuDifficulties??[state.settings.cpuDifficulty]).map(d=>CPU_LEVELS[normalizeCPU(d)]).join(' / ')}</p><p class="small muted">保存した対戦には同じブラウザの「前回の部屋に再接続」から戻れます。</p><p>追加目標：${state.settings.additionalObjectives?'使用（4枚）':'なし'}</p><p>戦争VP：${state.settings.warVP.map((n,i)=>`${i+1}位 ${n}VP`).join(' / ')}</p><div class="note">ゲーム開始後は新しい参加者は入れません。切断時は同じブラウザで「前回の部屋に再接続」を選べます。</div></aside></div></section>`;
 qs('#backButton').onclick=returnSetup;qs('#shareButton').onclick=copyInvite;if(qs('#startOnline'))qs('#startOnline').onclick=()=>remote('start');updateConnection();
}
async function copyInvite(){
 const url=new URL(location.href);url.search='';url.searchParams.set('room',session.room);url.searchParams.set('server',session.server);url.hash='';
 try{await navigator.clipboard.writeText(url.href);toast('招待リンクをコピーしました。');}catch{toast(`部屋番号：${session.room} ／ サーバー：${session.server}`);}
}
function currentDraft(){if(playback)return resolutionView({...state,you:myId},playback.index).players.find(p=>p.id===myId);const p=state.players.find(p=>p.id===myId);if(state.phase==='place')return previewPlacement(p,p.ready?(state.ownOrder?.moves||moves):moves).player;return p;}
function refreshmentsHTML(){
 return `<div class="tavern-refreshments" aria-label="卓のパンとビール">${['bread','beer'].map(kind=>`<button class="tavern-prop ${kind}" data-refreshment="${kind}" aria-label="${servingLabel(kind,refreshments[kind])}" ${refreshments[kind]===3?'disabled':''}><span class="refreshment-previous refreshment-sprite" style="--stage:3" aria-hidden="true"></span><span class="refreshment-sprite serving-current" style="--stage:${refreshments[kind]}" aria-hidden="true"></span><span class="bite-fragment" aria-hidden="true"></span><span class="drink-ripple" aria-hidden="true"></span></button>`).join('')}</div>`;
}
function positionBeerPour(){
 const button=qs('[data-refreshment="beer"]'),rig=qs('#beerPourRig');if(!button||!rig)return;
 const rect=button.getBoundingClientRect();rig.style.left=`${rect.left+rect.width*.17}px`;rig.style.top=`${rect.top+rect.width*.05}px`;rig.style.width=`${rect.width*2.1}px`;
}
window.addEventListener('scroll',()=>{if(qs('#beerPourRig')?.classList.contains('is-pouring'))positionBeerPour();},{passive:true});
window.addEventListener('resize',positionBeerPour);
function updateRefreshment(kind,served=false){
 const button=qs(`[data-refreshment="${kind}"]`);if(!button)return;
 if(kind==='beer'){const rig=qs('#beerPourRig');rig.classList.remove('is-pouring');if(served){positionBeerPour();void rig.offsetWidth;rig.classList.add('is-pouring');}}
 button.disabled=refreshments[kind]===3;button.setAttribute('aria-label',servingLabel(kind,refreshments[kind]));
 button.querySelector('.serving-current').style.setProperty('--stage',refreshments[kind]);
 button.classList.remove('taking-serving','fresh-serving');void button.offsetWidth;button.classList.add(served?'fresh-serving':'taking-serving');
}
function enjoyRefreshment(kind){refreshmentService.take(kind);}
function boardHTML(p,interactive){
 const hints=interactive?availableComboHints(p):[];
 const cells=interactive?legalCells(p.board):[];const b=matBounds(p.board,cells);const width=b.maxX-b.minX+1;
 let content='';for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){
  const card=p.board.find(c=>c.x===x&&c.y===y),legal=cells.some(c=>c.x===x&&c.y===y);
  const matching=hints.filter(h=>h.x===x&&h.y===y&&(selected===null||h.handIndex===selected));
  if(card){const combo=comboCardDecoration(p,card);const planned=moves.findIndex(m=>m.x===x&&m.y===y);const front=!p.board.some(c=>c.x===x&&c.y<y);
   content+=`<button data-combo-player="${p.id}" data-combo-keys="${combo.keys}" style="${combo.style}" class="cell ${combo.classes} ${front?'frontline':'rearline'} ${!playback&&p.id===myId&&state.phase==='place'&&planned>=0?(state.players.find(q=>q.id===myId).ready?'committed':'planned'):''}" data-card="${card.card}" aria-label="${CARD[card.card].name}の詳細${combo.label?`、${combo.label}`:''}"><img src="${CARD[card.card].image}" alt="${CARD[card.card].name}">${combo.html}${!playback&&p.id===myId&&state.phase==='place'&&planned>=0?`<span class="number">${state.players.find(q=>q.id===myId).ready?'確定':'仮'} ${planned+1}</span>`:''}${front?'<span class="front-label">⚑ 前線 · 戦争に参戦</span>':''}</button>`;
  }else if(legal)content+=`<button data-combo-hints="${hints.filter(h=>h.x===x&&h.y===y).map(h=>h.handIndex).join(',')}" style="${comboStyle(matching.flatMap(h=>h.combos))}" class="cell candidate ${matching.length?'combo-candidate':''} ${selected!==null?'can-place':''} ${tutorialTaskNow()&&tutorialCellAllowed(x,y)?'tutorial-required':''}" data-cell="${x},${y}" ${moves.length>=2||busy||!tutorialCellAllowed(x,y)?'disabled':''} aria-label="${x},${y}に配置${matching.length?'、3枚揃い可能':''}">${comboParticlesHTML()}<span style="font-size:1.6rem">＋</span><span class="combo-target-label">✦ 3枚揃い</span></button>`;
  else content+='<div class="cell void" aria-hidden="true"></div>';
 }
 return `<div class="board-table">${objectiveMailboxHTML()}<div class="board-wrap"><div class="board" style="grid-template-columns:repeat(${width},minmax(0,1fr));${width===1?'max-width:140px':width===2?'max-width:300px':''}">${content}</div>${!p.board.length?'<div class="empty-help">最初のカードはここへ。<br>次から上下左右に広げられます。</div>':''}</div>${refreshmentsHTML()}</div>${comboLedgerHTML(p)}`;
}
function statsHTML(p){return `<div class="status-grid">${[['vp','勝利点',p.vp,'VP'],['gold','お金',p.gold,'金'],['power','戦力',power(p),''],['tech','技術',p.tech,`Lv.${level(p.tech)}`],['faith','信仰',p.faith,`Lv.${level(p.faith)}`]].map(([stat,label,value,unit])=>`<div class="stat ${stat}" data-stat="${stat}"><span>${label}</span><strong>${value}<em>${unit}</em></strong>${deltaHTML(p,stat)}</div>`).join('')}</div>`;}
function actionHTML(p){
 if(playback&&state.resolution.events[playback.index].phase==='draw')return '<div class="action-panel replay-hint">手札を交換・補充しています…</div>';
 if(playback)return `<div class="action-panel replay-hint">全員の処理を順番に確認しています。中央の「次の処理」で進めてください。</div>`;
 if(mode==='local'&&game?.tutorial&&['round','ended'].includes(state.phase))return `<div class="action-panel"><p>この章の練習は完了です。次の例題へ進むか、同じ盤面でもう一度試せます。</p>${tutorialFinishControls()}</div>`;
 if(state.phase==='ended')return `<div class="action-panel">${mode==='online'?(myId===state.hostId?`<button id="rematchButton" class="primary" ${busy?'disabled':''}>同じ部屋で再対戦</button>`:'<p class="muted">部屋主が再対戦を開始できます。この部屋でお待ちください。</p>'):'<button id="newButton">新しい対戦へ</button>'}</div>`;
 if(state.phase==='round')return `<div class="action-panel"><div class="action-buttons">${mode==='local'||myId===state.hostId?`<button id="nextButton" class="primary" ${busy?'disabled':''}>次のラウンドへ</button>`:'<span class="muted">部屋主が次のラウンドへ進めます。</span>'}</div></div>`;
 const own=state.players.find(x=>x.id===myId),locked=own.ready;
 const title=state.phase==='draw'?'捨てるカードを選ぶ':'配置するカードを選ぶ';
 const help=state.phase==='draw'?'選択したカードを捨て、手札を5枚まで補充します。':mobileLayout()?'カードを上下にドラッグして「＋」へ配置。カードを選んで「＋」をタップしても配置できます。最大2枚です。':'カードを王国の「＋」へドラッグして配置。カードを選んで「＋」を押しても配置できます。最大2枚です。';
 const hand=state.phase==='place'?p.hand:own.hand,hints=availableComboHints(p);
 const comboHands=new Set(hints.map(h=>h.handIndex));
 return `<section id="handActions" class="action-panel"><div class="action-title"><div><h2>${title}</h2><span class="muted small">${state.phase==='place'?`${moves.length}/2枚`:`${discard.size}枚交換`}</span></div><div class="placement-gold" aria-live="polite"><span>現在のお金${state.phase==='place'&&moves.length?(locked?'（配置確定後）':'（仮配置後）'):''}</span><strong>${p.gold}<small>金</small></strong></div></div>${!tutorialTaskNow()?`<p class="muted small">${locked?(state.phase==='place'?'配置確定済み。自分の配置を表示しています。ほかの参加者を待っています。':'確定済み。ほかの参加者を待っています。'):help}</p>`:''}${tutorialTaskNow()?.purpose?`<div class="tutorial-purpose tutorial-action-purpose"><b>この操作の目的</b><p>${esc(tutorialTaskNow().purpose)}</p><p>${esc(tutorialTaskNow().text)}</p></div>`:''}${hints.length?`<p class="combo-help">✦ 光っているカードと配置先で3枚揃い！ カードを選ぶと、そのカードの配置先が光ります。</p>`:''}<div class="hand">${hand.map((id,i)=>`<div class="hand-entry"><button style="${comboStyle(hints.filter(h=>h.handIndex===i).flatMap(h=>h.combos))}" class="hand-card ${comboHands.has(i)?'combo-available':''} ${selected===i?'selected':''} ${tutorialTaskNow()&&tutorialHandAllowed(i)?'tutorial-required':''} ${discard.has(i)&&state.phase==='draw'?'discard':''}" data-hand="${i}" data-draggable="${state.phase==='place'&&!locked&&!busy&&moves.length<2&&tutorialHandAllowed(i)&&CARD[id].cost<=p.gold}" data-drag-blocked="${state.phase==='place'&&!locked&&!busy&&moves.length<2&&tutorialHandAllowed(i)&&CARD[id].cost>p.gold?'money':''}" ${locked||busy||!tutorialHandAllowed(i)?'disabled':''} aria-label="${CARD[id].name}${comboHands.has(i)?'、3枚揃い可能':''}${state.phase==='draw'&&discard.has(i)?'、捨てる対象':''}" aria-pressed="${state.phase==='draw'?discard.has(i):selected===i}"><img src="${CARD[id].image}" draggable="false" alt="${CARD[id].name}">${comboHands.has(i)?`${comboParticlesHTML()}<span class="combo-hand-label">✦ 3枚揃い</span>`:''}${state.phase==='place'&&CARD[id].cost>p.gold?'<span class="afford">お金不足</span>':''}</button><div class="card-quick-values"><span>コスト <b>${CARD[id].cost}</b>金</span><span>基本戦力 <b>${CARD[id].power}</b></span></div><button class="hand-card-details quiet" data-card="${id}" aria-label="${esc(CARD[id].name)}の詳細"><span>${esc(CARD[id].name)}</span><small>${CARD[id].cost}金 · 詳細</small></button></div>`).join('')}</div>${!tutorialTaskNow()&&state.phase==='place'&&selected!==null&&hand[selected]?`<div class="selected-info"><button class="selected-art" data-card="${hand[selected]}" aria-label="${esc(CARD[hand[selected]].name)}を拡大"><img src="${CARD[hand[selected]].image}" alt="${esc(CARD[hand[selected]].name)}"></button><div><strong>${CARD[hand[selected]].name}</strong>　${CARD[hand[selected]].cost}金 / 戦力${CARD[hand[selected]].power}<p>${CARD[hand[selected]].effects.map(effectText).join('<br>')}</p><button class="quiet" data-card="${hand[selected]}" style="padding:4px 8px">カードを拡大・詳細</button></div></div>`:''}${!tutorialTaskNow()?`<div class="hand-info">${state.phase==='place'?`配置しない枠の報酬：${2-moves.length}金（配置処理後に獲得）`:mobileLayout()?'手札は横にスワイプできます。配置時はカードを上下にドラッグ。「詳細」で効果を確認。':'カードの画像を長押し・右クリックすると詳細を表示できます。'}</div>`:''}<div class="action-buttons">${state.phase==='place'?`<button id="undoButton" ${!moves.length||locked||busy||tutorialNoticeOpen()?'disabled':''}>最後の配置を戻す</button>`:`<button id="clearDiscard" ${!discard.size||locked||busy?'disabled':''}>選択を解除</button>`}<button id="confirmButton" class="primary" ${locked||busy||tutorialNoticeOpen()||(tutorialTaskNow()&&!tutorialTaskNow().canConfirm)?'disabled':''}>${locked?'全員の確定を待っています':state.phase==='draw'?(discard.size?'交換を確定':'交換せず補充'):moves.length?`${moves.length}枚の配置を確定`:'配置せず2金を獲得'}</button></div></section>`;
}
function resultsHTML(){
 if(!['round','ended'].includes(state.phase))return '';
 const ended=state.phase==='ended';const winner=state.players.filter(p=>state.winners.includes(p.id)).map(p=>esc(p.name)).join('・');
 return `<section class="results"><h2>${ended?`優勝：${winner}`:`ラウンド${state.round}の結果`}</h2>${ended?'<p class="small muted">残ったお金による得点を加算した最終結果です。</p>':''}<table class="score-table"><thead><tr><th>プレイヤー</th><th>戦力 / 順位</th><th>戦争VP</th><th>${ended?'最終VP':'現在VP'}</th></tr></thead><tbody>${[...state.players].sort((a,b)=>ended?b.vp-a.vp:a.rank-b.rank).map(p=>`<tr><td>${esc(p.name)}</td><td>${p.power} / ${p.rank}位</td><td>${p.warVP}</td><td><b>${p.vp}</b></td></tr>`).join('')}</tbody></table></section>`;
}
function placeAt(handIndex,x,y){
 const own=state?.players.find(p=>p.id===myId);
 if(playback||state?.phase!=='place'||boardId!==myId||!own||own.ready||busy||moves.length>=2)return;
 if(tutorialNoticeOpen()){toast('先に「解説を閉じる」を押して、次の操作へ進みましょう。');return;}
 const task=tutorialTaskNow();if(task&&!tutorialPlacementAllowed(task,handIndex,x,y)){toast(task.text);return;}
 const draft=currentDraft(),card=CARD[draft.hand[handIndex]];
 if(card&&card.cost>draft.gold){moneyWarning();return;}
 try{const proposed=[...moves,{handIndex,x,y}];const result=previewPlacement(own,proposed),placed=result.placed.at(-1);placementCelebration=newCombos(draft,result.player).map(g=>g.key);moves=proposed;selected=null;render();showNotice(`${own.name}が${CARD[placed.card].name}を仮配置`,placed.steps,'予定の増減です。確定前なら取り消せます。',newCombos(draft,result.player));}catch(e){toast(e.message);}
}
let objectiveAlertCache={key:null,alerts:{own:[],rivals:[]}};
function displayedObjectiveView(){return playback?resolutionView({...state,you:myId},playback.index):state;}
function currentObjectiveAlerts(){
 const view=displayedObjectiveView(),draft=currentDraft();
 const key=JSON.stringify([view.phase,view.players,draft,view.objectives,moves.length,!!playback]);
 if(key!==objectiveAlertCache.key)objectiveAlertCache={key,alerts:objectiveAlerts(view,myId,draft,{playback:!!playback})};
 return objectiveAlertCache.alerts;
}
function mailIcon(){return `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M3 13L32 2l29 11v30H3Z" fill="currentColor" opacity=".35"/><rect x="5" y="13" width="54" height="30" rx="3" fill="#f7e7b8" stroke="currentColor" stroke-width="3"/><path d="M6 14l26 19 26-19M6 42l17-15m35 15L41 27" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="32" cy="32" r="6" fill="currentColor"/></svg>`;}
function objectiveMailboxHTML(){
 const alerts=currentObjectiveAlerts();if(!alerts.own.length&&!alerts.rivals.length)return '';
 return `<div class="objective-mailbox" aria-label="追加目標の手紙">${[['own','青',alerts.own.length,'達成できそうな目標'],['rivals','赤',alerts.rivals.length,'相手が達成しそうな目標']].filter(([, ,count])=>count).map(([kind,color,count,label])=>`<button class="objective-mail ${kind}" data-objective-mail="${kind}" aria-label="${color}い手紙：${label} ${count}件" title="${label}">${mailIcon()}<span class="mail-count">${count}</span></button>`).join('')}</div>`;
}
function objectiveAchievementsHTML(p){
 const goals=(displayedObjectiveView().objectives??[]).filter(g=>g.claimedBy?.includes(p.id));
 return goals.map(g=>`<span class="objective-achievement ${playback&&state.resolution.events[playback.index]?.objectiveId===g.id?'fresh':''}" aria-label="追加目標達成：${esc(OBJECTIVE[g.id].title)}、${OBJECTIVE[g.id].vp}VP獲得"><span aria-hidden="true">✉</span> ${esc(OBJECTIVE[g.id].title)} 達成 <b>＋${OBJECTIVE[g.id].vp}VP</b></span>`).join('');
}
function objectivesHTML(view){
 if(!view.objectives?.length)return '';
 return `<section class="objective-panel" aria-label="追加目標"><div class="objective-heading"><b>追加目標</b><span>各3VP・先着（同時達成は全員）</span></div><div class="objective-grid">${view.objectives.map(goal=>{
  const o=OBJECTIVE[goal.id];if(!o)return '';
  const claimed=goal.claimedBy?.length;
  return `<article class="objective-card letter-card ${claimed?'claimed':''}" aria-label="${esc(o.title)}、${o.vp}VP、${claimed?'達成済み':'未達成'}"><img src="assets/objective-letter.svg" alt="" aria-hidden="true"><div class="letter-content"><small>${OBJECTIVE_PHASES[o.phase]}${o.exact?'・ちょうど':''}</small><b class="letter-title">${esc(o.title)}</b><span class="letter-award">${o.vp}<small>VP</small></span><span class="letter-achievers">${claimed?`達成：${goal.claimedBy.map(id=>esc(view.players.find(p=>p.id===id)?.name??id)).join('・')}`:'未達成'}</span></div></article>`;
 }).join('')}</div></section>`;
}
function openObjectiveMail(kind){
 const alerts=currentObjectiveAlerts(),entries=kind==='own'?alerts.own:alerts.rivals;
 if(!entries.length)return;
 clearTimeout(playTimer);
 const title=kind==='own'?'青い手紙 — あなたが狙える目標':'赤い手紙 — 相手が近づいている目標';
 qs('#objectiveMailTitle').textContent=title;

 qs('#objectiveMailBody').innerHTML=`<div class="mail-reading ${kind}">${entries.map(entry=>`<article><h3>${esc(entry.o.title)} <span>＋${entry.o.vp}VP</span></h3><p class="mail-phase">${OBJECTIVE_PHASES[entry.o.phase]}</p>${kind==='own'?`<p><b>${entry.progress.met?'条件を満たしています（判定待ち）':'達成まであと少し'}</b></p><p>${esc(entry.progress.detail)}</p><p>現在の数値での進捗です。指定フェイズ終了時に条件を満たしているか確認します。</p>`:`<ul>${entry.players.map(p=>`<li><b>${esc(p.name)}</b>：${p.progress.met?'条件を満たしています（判定待ち）':'あと少し'}<br>${esc(p.progress.detail)}</li>`).join('')}</ul>`}</article>`).join('')}<p class="mail-reading-note">${kind==='own'?'仮配置中は、その時点の数値を表示します。所持金は未配置枠の報酬を加え、指定フェイズ終了時の金額で判定します。':'相手の公開盤面だけで判断しています。非公開の手札による次の配置は断定できません。'}先に達成された目標は得点できません。同じ判定時の達成は全員が得点します。</p></div>`;
 if(game?.tutorial&&game.tutorialChapter===3){game.tutorialLettersRead??=[];if(!game.tutorialLettersRead.includes(kind))game.tutorialLettersRead.push(kind);}
 qs('#objectiveMailDialog').showModal();
}
qs('#objectiveMailDialog').addEventListener('close',()=>{render();const target=tutorialTaskNow()?.target;if(target)qs(target)?.focus({preventScroll:true});scheduleReplay();});
function renderGame(){
 app.classList.toggle('tutorial-reading-effect',mode==='local'&&!!game?.tutorial&&!!playback);
 if(mobileLayout()){mobileGalleryScroll=qs('.kingdom-gallery')?.scrollLeft??mobileGalleryScroll;mobileHandScroll=qs('.hand')?.scrollLeft??mobileHandScroll;}
 const state=playback?resolutionView({...globalState(),you:myId},playback.index):globalState();
 const draft=currentDraft();const own=state.players.find(p=>p.id===myId);const viewed=boardId===myId?draft:state.players.find(p=>p.id===boardId)||draft;
 const editing=!playback&&boardId===myId&&state.phase==='place'&&!own.ready;
 updateVisualValues(state.players.map(p=>p.id===myId?draft:p));
 const displayLogs=game?.tutorial&&playback?[...state.logs,...tutorialTrace(globalState().resolution,playback.index,myId)]:state.logs;
 app.innerHTML=`<div class="game-head"><div><p class="eyebrow">${mode==='online'?`部屋 ${state.room}`:'CPU対戦'}</p><h1>ラウンド ${state.round}${state.phase==='ended'&&!playback?' — 終了':''}</h1></div><div style="display:flex;align-items:center;gap:12px">${mode==='online'?`<span id="connection" class="connection">${connection}</span>`:''}<button id="backButton" class="quiet">対戦メニュー</button></div></div>${tutorialHTML()}${operationHTML(own)}${waitingHTML()}<div class="phase-strip">${['draw','place','war','develop','income','vp'].map((phase,i)=>`<span class="${state.phase===phase?'active':''}">${i+1}. ${PHASE_NAMES[phase]}</span>`).join('')}</div>${objectivesHTML(state,draft)}${kingdomGallery(state,draft)}${playback?'':resultsHTML()}${reviewHTML()}<div class="game-layout"><section id="playerBoard" class="panel play-panel ${boardId===myId?'own-board':'other-board'}"><div class="board-heading"><b>${esc(viewed.name)} · 現在${scoreRank(state.players,viewed)}位の王国${!playback&&state.phase==='place'&&boardId===myId&&moves.length?(own.ready?'（配置確定済み）':'（配置予定）'):''}</b><span>前方 ↑ ／ ${viewed.board.length}/9体 ／ 戦力 ${power(viewed)}</span></div>${statsHTML(viewed)}${metersHTML(viewed)}${editing&&selected!==null?`<div class="mobile-selected-card mobile-only"><b>${esc(CARD[draft.hand[selected]].name)}</b><span>配置する「＋」をタップ</span><button id="mobileCancelSelection" class="quiet">選択を解除</button></div>`:''}${boardHTML(viewed,editing)}${boardId!==myId?'<div class="action-buttons"><button id="myBoardButton">自分の王国に戻る</button></div>':actionHTML(draft)}</section><aside><section class="panel players-panel"><h2>参加者</h2>${state.players.map(p=>p.id===myId?draft:p).map(p=>`<button class="player-row ${p.id===boardId?'active':''}" data-player="${p.id}"><span class="row-head"><strong>${esc(p.name)} · ${scoreRank(state.players,p)}位</strong><span class="player-type">${presenceText(p)}</span></span><span class="details participant-values"><span>${p.vp} VP${deltaHTML(p,'vp',true)}</span> ／ <span>${p.gold}金${deltaHTML(p,'gold',true)}</span> ／ <span>${p.board.length}体${deltaHTML(p,'units',true)}</span> ／ <span>戦力 ${power(p)}${deltaHTML(p,'power',true)}</span><br><span>技術 ${p.tech}（Lv.${level(p.tech)}）${deltaHTML(p,'tech',true)}</span>・<span>信仰 ${p.faith}（Lv.${level(p.faith)}）${deltaHTML(p,'faith',true)}</span></span></button>`).join('')}</section><section class="panel log-panel"><h2>履歴</h2><details class="log-fold" ${!mobileLayout()||mobileLogsOpen?'open':''}><summary>履歴を開く <span>${displayLogs.length}件</span></summary><div class="log-legend"><span class="own">青：あなた</span><span class="other">赤茶：他プレイヤー</span></div><ul class="logs">${displayLogs.length?[...displayLogs].reverse().slice(0,60).map((l,i)=>`<li class="${i===0?'latest-log':''} ${logClassName(l,myId,state.players)} ${playback&&l.eventIndex===playback.index?'tutorial-log-active':''}"><span class="log-owner">${logOwnerLabel(l)}</span>${i===0?'<span class="latest-log-label">最新</span>':''}<b>R${l.round}</b>${playback&&l.eventIndex===playback.index?'<span class="tutorial-log-tag">いま発動した効果</span>':''} ${esc(l.message)}</li>`).join(''):'<li>手札を交換して、王国づくりを始めましょう。</li>'}</ul></details><p class="muted small" style="margin:14px 0 0">山札 ${state.deckCount}枚 ／ 捨て札 ${state.discardCount}枚</p></section></aside></div>`;
 if(mobileLayout()){
  const gallery=qs('.kingdom-gallery');gallery.scrollLeft=mobileGalleryScroll;
  if(qs('.hand'))qs('.hand').scrollLeft=mobileHandScroll;
  const task=tutorialTaskNow(),taskKey=task?`${game.tutorialChapter}:${state.phase}:${moves.length}`:null;
  if(taskKey!==tutorialHandFocusKey&&task?.handIndex>=0){const hand=qs('.hand'),card=qs(`[data-hand="${task.handIndex}"]`);if(hand&&card){hand.scrollLeft+=card.getBoundingClientRect().left-hand.getBoundingClientRect().left-(hand.clientWidth-card.clientWidth)/2;mobileHandScroll=hand.scrollLeft;}}
  tutorialHandFocusKey=taskKey;
  const event=playback?globalState().resolution.events[playback.index]:null;
  const focus=event?.playerId?`${state.round}:${playback.index}`:null;
  if(focus&&focus!==mobilePlaybackFocus){
   const card=[...gallery.children].find(el=>el.querySelector('[data-player]')?.dataset.player===event.playerId);
   if(card)gallery.scrollLeft+=card.getBoundingClientRect().left-gallery.getBoundingClientRect().left;
  }
  mobilePlaybackFocus=focus;
 }
 qs('#mobileOverviewToggle').onclick=()=>{mobileOverviewCompact=!mobileOverviewCompact;render();};
 for(const button of document.querySelectorAll('[data-mobile-jump]'))button.onclick=()=>{boardId=myId;render();mobileJump(button.dataset.mobileJump==='hand'?'#handActions':'#playerBoard');};
 if(qs('#mobileCancelSelection'))qs('#mobileCancelSelection').onclick=()=>{selected=null;render();};
 for(const el of document.querySelectorAll('[data-tutorial-chapter]'))el.onclick=()=>startTutorial(Number(el.dataset.tutorialChapter));
 for(const el of document.querySelectorAll('[data-tutorial-next]'))el.onclick=()=>startTutorial((game.tutorialChapter??0)+1);
 for(const el of document.querySelectorAll('[data-tutorial-retry]'))el.onclick=()=>startTutorial(game.tutorialChapter??0);
 for(const el of document.querySelectorAll('[data-tutorial-menu]'))el.onclick=returnSetup;
 for(const el of document.querySelectorAll('[data-tutorial-play]'))el.onclick=()=>{returnSetup();startLocal();};
 for(const el of document.querySelectorAll('[data-tutorial-read]'))el.onclick=()=>openTutorialHandbook(el.dataset.tutorialRead);
 if(mode==='local'&&game?.tutorial){const guide=tutorialGuideNow();if(tutorialTaskNow()?.target||guide.target)qs(tutorialTaskNow()?.target??guide.target)?.classList.add('tutorial-focus');if(guide.learning?.card)qs(`#playerBoard [data-card="${guide.learning.card}"]`)?.classList.add('tutorial-source-card');}
 qs('#backButton').onclick=returnSetup;
 for(const button of document.querySelectorAll('[data-objective-mail]'))button.onclick=()=>openObjectiveMail(button.dataset.objectiveMail);
 for(const button of document.querySelectorAll('[data-refreshment]'))button.onclick=()=>enjoyRefreshment(button.dataset.refreshment);
 if(qs('.round-review'))qs('.round-review').ontoggle=e=>{reviewOpen=e.target.open;};
 if(qs('#reviewRound'))qs('#reviewRound').onchange=e=>{reviewRound=Number(e.target.value);reviewOpen=true;render();};
 for(const el of document.querySelectorAll('[data-player]'))el.onclick=()=>{boardId=el.dataset.player;render();};
 for(const el of document.querySelectorAll('#app [data-card]'))el.onclick=()=>showCard(el.dataset.card);
 for(const el of document.querySelectorAll('[data-cell]'))el.onclick=()=>{
  if(selected===null)return;const[x,y]=el.dataset.cell.split(',').map(Number);placeAt(selected,x,y);
 };
 for(const chip of document.querySelectorAll('[data-combo]')){
  const highlight=active=>{for(const card of document.querySelectorAll('[data-combo-keys]'))if(card.dataset.comboPlayer===chip.dataset.comboPlayer&&card.dataset.comboKeys.split(' ').includes(chip.dataset.combo))card.classList.toggle('combo-inspecting',active);};
  chip.onpointerenter=()=>highlight(true);chip.onpointerleave=()=>highlight(false);chip.onfocus=()=>highlight(true);chip.onblur=()=>highlight(false);chip.onclick=()=>highlight(true);
 }
 if(!cleanupDrag)cleanupDrag=bindCardDrag(app,placeAt,moneyWarning,index=>{
  const handIndex=index??selected;
  for(const cell of app.querySelectorAll('[data-combo-hints]')){const [x,y]=cell.dataset.cell.split(',').map(Number),matching=availableComboHints(currentDraft()).filter(h=>h.x===x&&h.y===y&&(handIndex===null||h.handIndex===handIndex));cell.classList.toggle('combo-candidate',!!matching.length);cell.style.cssText=comboStyle(matching.flatMap(h=>h.combos));}
 });
 for(const el of document.querySelectorAll('[data-hand]')){
  const index=Number(el.dataset.hand);el.onclick=()=>{
   if(!tutorialHandAllowed(index))return;
   if(state.phase==='draw'){discard.has(index)?discard.delete(index):discard.add(index);}else{if(CARD[draft.hand[index]].cost>draft.gold){moneyWarning();return;}selected=selected===index?null:index;}render();if(state.phase==='place'&&selected!==null)mobileJump('.mobile-selected-card');
  };
  el.oncontextmenu=e=>{e.preventDefault();showCard((state.phase==='place'?draft:own).hand[index]);};
 }
 if(qs('#myBoardButton'))qs('#myBoardButton').onclick=()=>{boardId=myId;render();};
 if(qs('#undoButton'))qs('#undoButton').onclick=()=>{const before=currentDraft();const removed=before.board.at(-1);placementCelebration=null;moves.pop();selected=null;const after=currentDraft();render();showNotice(`${own.name}の${CARD[removed.card].name}の仮配置を取り消しました`,undoChanges(before,after),'このカードによる増加をキャンセルし、配置コストも元に戻しました。');};
 if(qs('#clearDiscard'))qs('#clearDiscard').onclick=()=>{discard.clear();render();};
 if(qs('#rematchButton'))qs('#rematchButton').onclick=()=>remote('rematch');
 if(qs('#confirmButton'))qs('#confirmButton').onclick=confirmAction;
 if(qs('#nextButton'))qs('#nextButton').onclick=()=>mode==='online'?remote('next'):localNext();
 if(qs('#newButton'))qs('#newButton').onclick=returnSetup;
 if(qs('.log-fold'))qs('.log-fold').ontoggle=e=>{if(mobileLayout())mobileLogsOpen=e.currentTarget.open;};
 const operationTarget=qs('#myBoardButton')??qs('#confirmButton')??qs('#nextButton')??qs('#newButton')??qs('#rematchButton');
 const operationButton=qs('#operationButton');if(operationTarget&&operationButton){operationButton.hidden=false;operationButton.textContent=operationTarget.textContent;operationButton.disabled=operationTarget.disabled;operationButton.onclick=()=>operationTarget.click();}
 const newest=displayLogs.at(-1),logKey=newest?`${state.round}:${displayLogs.length}:${newest.message}`:'';if(logKey&&latestLogKey&&logKey!==latestLogKey)qs('.latest-log')?.classList.add('log-arrived');latestLogKey=logKey;
 for(const el of document.querySelectorAll('.stat-delta'))setTimeout(()=>el.remove(),1800);
 updateConnection();renderCenter();announceFinalResults();
}
async function confirmAction(){
 if(playback)return;
 if(tutorialNoticeOpen()){toast('先に「解説を閉じる」を押して、次の操作へ進みましょう。');return;}
 const task=tutorialTaskNow();if(task&&!task.canConfirm){toast(task.text);return;}
 const order=state.phase==='draw'?{discard:[...discard]}:{moves:structuredClone(moves)};
 if(mode==='online'){await remote('action',{phase:state.phase,round:state.round,order});return;}
 if(busy)return;busy=true;render();await new Promise(resolve=>setTimeout(resolve,30));
 try{submit(game,myId,order);if(['draw','place'].includes(game.phase))fillCPU(game,submit);applyView(publicView(game,myId));}catch(e){toast(e.message);}finally{busy=false;render();}
}
function localNext(){if(playback)return;try{nextRound(game);fillCPU(game,submit);applyView(publicView(game,myId));}catch(e){toast(e.message);}}
function tutorialScrollTo(target){
 if(!target)return;
 const overview=qs('#kingdomOverview'),offset=overview&&getComputedStyle(overview).position==='sticky'?overview.getBoundingClientRect().height+18:18;
 target.style.scrollMarginTop=`${offset}px`;
 target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function focusTutorialEffect(){
 if(mode!=='local'||!game?.tutorial||!playback)return;
 const event=state.resolution.events[playback.index],learning=tutorialFeedback(state.resolution,playback.index,game.tutorialChapter??0,myId);
 if(!learning)return;
 const positive=event.changes.filter(c=>c.delta>0),changes=positive.length?positive:event.changes;
 for(const change of changes)qs(`#playerBoard [data-stat="${change.stat}"]`)?.classList.add('tutorial-stat-changed');
 const primary=changes.find(c=>learning.card&&c.source.startsWith(CARD[learning.card].name))??changes[0];
 const key=`${state.resolution.id}:${playback.index}`;
 if(primary&&key!==tutorialEffectFocusKey){tutorialEffectFocusKey=key;requestAnimationFrame(()=>tutorialScrollTo(qs(`#playerBoard [data-stat="${primary.stat}"]`)));}
}
function globalState(){return state;}
// The original guide keeps its place; a compact copy follows the player only
// while its top is clipped. Re-rendering a card must keep this copy up to date.
let tutorialDockCollapsed=false,tutorialDockFrame=null,tutorialDockHeight=0;
function updateTutorialDock(){
 const overview=qs('.kingdom-overview');
 if(mobileLayout())document.documentElement.style.setProperty('--mobile-overview-height',overview&&getComputedStyle(overview).position==='sticky'?`${Math.ceil(overview.getBoundingClientRect().height)}px`:'0px');
 const dock=qs('#tutorialDock'),original=qs('.tutorial-guide');
 const active=mode==='local'&&game?.tutorial&&original&&!playback&&!tutorialNoticeOpen();
 const visible=active&&original.getBoundingClientRect().top<0;
 dock.hidden=!visible;
 if(visible){
  const guide=tutorialGuideNow();
  const html=`<div class="tutorial-dock-top"><b>第${(game.tutorialChapter??0)+1}章 · ${esc(guide.title)}</b><button id="toggleTutorialDock" class="quiet" aria-expanded="${!tutorialDockCollapsed}">${tutorialDockCollapsed?'助言を開く':'小さくする'}</button></div>${tutorialDockCollapsed?'':`<p>${esc(tutorialTaskNow()?.purpose??guide.learning?.paragraphs[0]??guide.personal?.[0]??tutorialBrief(guide))}</p><button id="tutorialReadMore" class="quiet">詳しい解説へ</button>`}`;
  if(dock.innerHTML!==html)dock.innerHTML=html;
  if(qs('#tutorialReadMore'))qs('#tutorialReadMore').onclick=()=>openTutorialHandbook('lesson');
  qs('#toggleTutorialDock').onclick=()=>{tutorialDockCollapsed=!tutorialDockCollapsed;updateTutorialDock();};
 }else if(!active){tutorialDockCollapsed=mobileLayout();dock.innerHTML='';}
 const height=visible?Math.ceil(dock.getBoundingClientRect().height)+24:0;
 document.documentElement.style.setProperty('--tutorial-dock-height',`${height}px`);
 // Opening the advice can otherwise cover a button that was already in view.
 // Reserve room once when it grows, rather than moving the view on every scroll.
 if(height>tutorialDockHeight){
  const controls=qs('.action-buttons'),rect=controls?.getBoundingClientRect();
  if(rect&&rect.top>0&&rect.bottom<=window.innerHeight&&rect.bottom>window.innerHeight-height)
   window.scrollBy({top:rect.bottom-(window.innerHeight-height)+12,behavior:'instant'});
 }
 tutorialDockHeight=height;
}
function scheduleTutorialDock(){
 if(tutorialDockFrame!==null)return;
 tutorialDockFrame=requestAnimationFrame(()=>{tutorialDockFrame=null;updateTutorialDock();});
}
window.addEventListener('scroll',scheduleTutorialDock,{passive:true});
window.addEventListener('resize',scheduleTutorialDock);
new MutationObserver(scheduleTutorialDock).observe(app,{childList:true});
function render(){if(mode==='setup')renderSetup();else if(state.phase==='lobby')renderLobby();else renderGame();updateTutorialDock();focusTutorialEffect();}
render();
