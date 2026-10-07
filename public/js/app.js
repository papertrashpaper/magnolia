import {CARDS,CARD,RACES,JOBS,RACE_BONUS,JOB_BONUS,effectText} from './cards.js';
import {newGame,submit,nextRound,publicView,previewPlacement,legalCells,bounds,power,level} from './engine.js';
import {fillCPU} from './cpu.js';

const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs=s=>document.querySelector(s);
const store={get(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}},remove(key){try{localStorage.removeItem(key);}catch{}}};
let mode='setup',setupTab='local',game=null,state=null,myId='human',boardId='human',session=null,stream=null;
let moves=[],discard=new Set(),selected=null,draftKey='',busy=false,connection='';
const initialParams=new URLSearchParams(location.search);
let setup={name:store.get('magnolia-name','あなた'),total:3,cpuCount:0,server:initialParams.get('server')||store.get('magnolia-server',location.hostname==='localhost'||location.hostname==='127.0.0.1'?location.origin:''),room:initialParams.get('room')||'',warVP:[5,3,0,0,0]};
if(initialParams.get('room'))setupTab='online';
function toast(text){qs('#toast').textContent=text;qs('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>qs('#toast').classList.remove('show'),4500);}
function bonusText(b){return Object.entries(b).map(([s,n])=>`${n}${{gold:'金',tech:'技術点',faith:'信仰点',vp:'VP'}[s]}`).join(' ＋ ');}
function showCard(id){
 const c=CARD[id];if(!c)return;
 qs('#detailBody').innerHTML=`<div class="detail-layout"><img src="${c.image}" alt="${esc(c.name)}"><div><p class="eyebrow">${RACES[c.race]} / ${JOBS[c.job]}</p><h2>${c.name}</h2><p>コスト <b>${c.cost}金</b>　基本戦力 <b>${c.power}</b></p><ul>${c.effects.map(e=>`<li>${effectText(e)}</li>`).join('')}</ul><h3>配置ボーナス</h3><p>種族：${bonusText(RACE_BONUS[c.race])}<br>職業：${bonusText(JOB_BONUS[c.job])}</p><p class="muted small">山札に${c.copies}枚（仮構成）</p></div></div>`;
 qs('#detailDialog').showModal();
}
qs('#catalogBody').innerHTML=CARDS.map(c=>`<button data-card="${c.id}" aria-label="${c.name}の詳細"><img src="${c.image}" alt="${c.name}" loading="lazy"><span>${c.copies}枚</span></button>`).join('');
qs('#catalogBody').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)showCard(b.dataset.card);});
qs('#catalogButton').onclick=()=>qs('#catalogDialog').showModal();qs('#rulesButton').onclick=()=>qs('#rulesDialog').showModal();
for(const button of document.querySelectorAll('.dialog-close'))button.onclick=()=>button.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});

function warFields(){return `<div class="war-fields">${Array.from({length:setup.total},(_,i)=>`<label>${i+1}位<input data-war="${i}" type="number" min="0" max="50" value="${setup.warVP[i]??0}" aria-label="${i+1}位の戦争VP"></label>`).join('')}</div>`;}
function renderSetup(){
 const saved=store.get('magnolia-local');
 const oldSession=store.get('magnolia-session');
 app.innerHTML=`<section class="setup"><div class="setup-head"><div><p class="eyebrow">王国をつくる</p><h1>対戦を始める</h1></div><span class="muted small">2〜5人</span></div><div class="tabs"><button data-tab="local" class="${setupTab==='local'?'active':''}">CPU対戦</button><button data-tab="online" class="${setupTab==='online'?'active':''}">オンライン対戦</button></div><div class="setup-grid"><section class="panel"><h2>${setupTab==='local'?'CPUと遊ぶ':'部屋を作る・参加する'}</h2><label>プレイヤー名<input id="nameInput" maxlength="20" value="${esc(setup.name)}"></label>${setupTab==='online'?`<label style="margin-top:18px">対戦サーバーURL<input id="serverInput" type="url" placeholder="https://……onrender.com" value="${esc(setup.server)}"></label><p class="muted small" style="margin:8px 0">部屋を共有する人は、同じサーバーに接続します。</p>`:''}<div class="fields"><label>合計人数<select id="totalInput">${[2,3,4,5].map(n=>`<option value="${n}" ${setup.total===n?'selected':''}>${n}人${setupTab==='local'?`（あなた＋CPU${n-1}人）`:''}</option>`).join('')}</select></label>${setupTab==='online'?`<label>CPU用に確保する席<select id="cpuInput">${Array.from({length:setup.total},(_,i)=>`<option value="${i}" ${setup.cpuCount===i?'selected':''}>${i}席</option>`).join('')}</select></label>`:''}</div><h3>戦争で獲得するVP</h3>${warFields()}<p class="muted small" style="margin:10px 0">同点は同順位。次の順位は飛ばします。</p><button id="createButton" class="primary">${setupTab==='local'?'CPU対戦を開始':'部屋を作成'}</button>${setupTab==='local'&&saved?'<button id="resumeLocal" style="width:100%;margin-top:10px">前回のCPU対戦を再開</button>':''}${setupTab==='online'?`<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)"><label>部屋番号<input id="roomInput" placeholder="例：A1B2C3" maxlength="6" value="${esc(setup.room)}" style="text-transform:uppercase"></label><button id="joinButton" style="width:100%;margin-top:12px">部屋に参加</button>${oldSession?'<button id="resumeOnline" style="width:100%;margin-top:10px">前回の部屋に再接続</button>':''}</div>`:''}<div id="formError" class="form-error" role="alert"></div></section><aside class="panel"><h2>ラウンドの流れ</h2><ul class="mini-sequence"><li><span>01</span><div><b>手札を交換</b><br>捨てるカードを選び、5枚まで補充。</div></li><li><span>02</span><div><b>最大2枚を配置</b><br>上下左右につなげて、王国を広げる。</div></li><li><span>03</span><div><b>戦争・発展・収入・VP</b><br>全員の確定後に、自動で計算。</div></li></ul><div class="note">誰かが40VP、または9体配置したラウンドで終了。残金も得点に加わります。</div><p class="muted small" style="margin:18px 0 0">各種族の王とデーモンは1枚、眼のデーモンは2枚。その他は人間・ドワーフ・エルフ・ゴブリン各3枚、ゴーレム各2枚です。</p></aside></div></section>`;
 qs('#nameInput').oninput=e=>{setup.name=e.target.value;store.set('magnolia-name',setup.name);};
 qs('#totalInput').onchange=e=>{setup.total=Number(e.target.value);setup.cpuCount=Math.min(setup.cpuCount,setup.total-1);setup.warVP=setup.total===2?[4,0]:[5,3,0,0,0];renderSetup();};
 for(const el of document.querySelectorAll('[data-war]'))el.oninput=e=>setup.warVP[Number(el.dataset.war)]=Number(e.target.value);
 for(const el of document.querySelectorAll('[data-tab]'))el.onclick=()=>{setupTab=el.dataset.tab;renderSetup();};
 qs('#createButton').onclick=()=>setupTab==='local'?startLocal():connectRoom('create');
 if(qs('#resumeLocal'))qs('#resumeLocal').onclick=()=>{game=saved;mode='local';myId='human';boardId=myId;draftKey='';applyView(publicView(game,myId));};
 if(qs('#serverInput'))qs('#serverInput').oninput=e=>setup.server=e.target.value;
 if(qs('#cpuInput'))qs('#cpuInput').onchange=e=>setup.cpuCount=Number(e.target.value);
 if(qs('#roomInput'))qs('#roomInput').oninput=e=>setup.room=e.target.value.toUpperCase();
 if(qs('#joinButton'))qs('#joinButton').onclick=()=>connectRoom('join');
 if(qs('#resumeOnline'))qs('#resumeOnline').onclick=()=>resumeOnline(oldSession);
}
function startLocal(){
 try{
  const seats=[{id:'human',name:setup.name.trim()||'あなた',cpu:false},...Array.from({length:setup.total-1},(_,i)=>({id:`cpu-${i}`,name:`CPU ${i+1}`,cpu:true}))];
  game=newGame(seats,{warVP:setup.warVP});fillCPU(game,submit);mode='local';myId='human';boardId=myId;draftKey='';applyView(publicView(game,myId));
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
 const error=qs('#formError');error.textContent='接続しています…';
 try{
  const server=validateServer(setup.server);store.set('magnolia-server',server);
  const data=await request(server,action,{name:setup.name,room:setup.room,total:setup.total,cpuCount:setup.cpuCount,settings:{warVP:setup.warVP}});
  session={server,room:data.state.room,token:data.token,id:data.id};store.set('magnolia-session',session);mode='online';myId=session.id;boardId=myId;draftKey='';applyView(data.state);openStream();
 }catch(e){error.textContent=e.name==='TypeError'?'サーバーに接続できません。URLとサーバーの稼働状態を確認してください。':e.message;}
}
async function resumeOnline(previous){
 try{session=previous;const res=await fetch(`${session.server}/api/state?${new URLSearchParams({room:session.room,token:session.token})}`,{signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok)throw Error(data.error);mode='online';myId=session.id;boardId=myId;draftKey='';applyView(data);openStream();}catch(e){if(qs('#formError'))qs('#formError').textContent=e.message;toast(e.message);}
}
function openStream(){
 stream?.close();connection='接続中';
 stream=new EventSource(`${session.server}/api/stream?${new URLSearchParams({room:session.room,token:session.token})}`);
 stream.onopen=()=>{connection='接続済み';updateConnection();};
 stream.onmessage=e=>{connection='接続済み';applyView(JSON.parse(e.data));};
 stream.onerror=()=>{connection='再接続中…';updateConnection();};
}
function updateConnection(){const el=qs('#connection');if(el){el.textContent=connection;el.className=`connection ${connection==='接続済み'?'connected':'error'}`;}}
async function remote(route,extra={}){
 if(busy)return;busy=true;render();
 try{const data=await request(session.server,route,{room:session.room,token:session.token,...extra});applyView(data);}catch(e){toast(e.message);}finally{busy=false;render();}
}
function applyView(view){
 state=view;const key=`${mode}:${view.room||''}:${view.round||0}:${view.phase}`;
 if(key!==draftKey){draftKey=key;moves=[];discard=new Set();selected=null;}
 if(mode==='local')store.set('magnolia-local',game);render();
}
function returnSetup(){stream?.close();stream=null;mode='setup';game=null;state=null;moves=[];selected=null;draftKey='';renderSetup();}
function renderLobby(){
 app.innerHTML=`<section class="setup"><div class="setup-head"><h1>参加者を待っています</h1><button id="backButton" class="quiet">戻る</button></div><div class="setup-grid"><section class="panel"><p class="muted small">部屋番号</p><div class="room-code">${esc(state.room)}</div><div id="connection" class="connection">${connection}</div><ul class="lobby-members">${state.players.map(p=>`<li><b>${esc(p.name)}${p.id===myId?'（あなた）':''}</b><span class="muted small">${p.id===state.hostId?'部屋主':'参加者'}</span></li>`).join('')}${Array.from({length:state.total-state.players.length},()=>'<li class="muted">空席<span class="small">開始時にCPUで補充</span></li>').join('')}</ul><div class="room-actions"><button id="shareButton">招待リンクをコピー</button>${myId===state.hostId?`<button id="startOnline" class="primary" ${busy?'disabled':''}>${state.players.length<state.total?'空席をCPUで埋めて開始':'ゲーム開始'}</button>`:'<span class="muted small">部屋主が開始するまでお待ちください。</span>'}</div></section><aside class="panel"><h2>部屋の設定</h2><p>合計 ${state.total}人</p><p>戦争VP：${state.settings.warVP.map((n,i)=>`${i+1}位 ${n}VP`).join(' / ')}</p><div class="note">ゲーム開始後は新しい参加者は入れません。切断時は同じブラウザで「前回の部屋に再接続」を選べます。</div></aside></div></section>`;
 qs('#backButton').onclick=returnSetup;qs('#shareButton').onclick=copyInvite;if(qs('#startOnline'))qs('#startOnline').onclick=()=>remote('start');updateConnection();
}
async function copyInvite(){
 const url=new URL(location.href);url.search='';url.searchParams.set('room',session.room);url.searchParams.set('server',session.server);url.hash='';
 try{await navigator.clipboard.writeText(url.href);toast('招待リンクをコピーしました。');}catch{toast(`部屋番号：${session.room} ／ サーバー：${session.server}`);}
}
function currentDraft(){const p=state.players.find(p=>p.id===myId);if(state.phase==='place'&&!p.ready)return previewPlacement(p,moves).player;return p;}
function boardHTML(p,interactive){
 const cells=interactive?legalCells(p.board):[];const all=[...p.board,...cells];const b=bounds(all);const width=b.maxX-b.minX+1;
 let content='';for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){
  const card=p.board.find(c=>c.x===x&&c.y===y),legal=cells.some(c=>c.x===x&&c.y===y);
  if(card){const planned=moves.findIndex(m=>m.x===x&&m.y===y);const front=!p.board.some(c=>c.x===x&&c.y<y);
   content+=`<button class="cell ${interactive&&planned>=0?'planned':''}" data-card="${card.card}" aria-label="${CARD[card.card].name}の詳細"><img src="${CARD[card.card].image}" alt="${CARD[card.card].name}">${interactive&&planned>=0?`<span class="number">${planned+1}</span>`:''}${front?'<span class="front-label">前線</span>':''}</button>`;
  }else if(legal)content+=`<button class="cell candidate ${selected!==null?'can-place':''}" data-cell="${x},${y}" ${selected===null||moves.length>=2||busy?'disabled':''} aria-label="${x},${y}に配置"><span style="font-size:1.6rem">＋</span></button>`;
  else content+='<div class="cell void" aria-hidden="true"></div>';
 }
 return `<div class="board-wrap"><div class="board" style="grid-template-columns:repeat(${width},minmax(0,1fr));${width===1?'max-width:140px':width===2?'max-width:300px':''}">${content}</div>${!p.board.length?'<div class="empty-help">最初のカードはここへ。<br>次から上下左右に広げられます。</div>':''}</div>`;
}
function statsHTML(p){return `<div class="status-grid"><div class="stat vp"><span>勝利点</span><strong>${p.vp}<em>VP</em></strong></div><div class="stat gold"><span>お金</span><strong>${p.gold}<em>金</em></strong></div><div class="stat"><span>技術</span><strong>${p.tech}<em>Lv.${level(p.tech)}</em></strong></div><div class="stat"><span>信仰</span><strong>${p.faith}<em>Lv.${level(p.faith)}</em></strong></div></div>`;}
function actionHTML(p){
 if(state.phase==='ended')return `<div class="action-panel"><button id="newButton">新しい対戦へ</button></div>`;
 if(state.phase==='round')return `<div class="action-panel"><div class="action-buttons">${mode==='local'||myId===state.hostId?`<button id="nextButton" class="primary" ${busy?'disabled':''}>次のラウンドへ</button>`:'<span class="muted">部屋主が次のラウンドへ進めます。</span>'}</div></div>`;
 const own=state.players.find(x=>x.id===myId),locked=own.ready;
 const title=state.phase==='draw'?'捨てるカードを選ぶ':'配置するカードを選ぶ';
 const help=state.phase==='draw'?'選択したカードを捨て、手札を5枚まで補充します。':'カードを選び、王国の「＋」を押して配置。最大2枚です。';
 const hand=state.phase==='place'&&!locked?p.hand:own.hand;
 return `<section class="action-panel"><div class="action-title"><h2>${title}</h2><span class="muted small">${state.phase==='place'?`${moves.length}/2枚`:`${discard.size}枚交換`}</span></div><p class="muted small">${locked?'確定済み。ほかの参加者を待っています。':help}</p><div class="hand">${hand.map((id,i)=>`<button class="hand-card ${selected===i?'selected':''} ${discard.has(i)&&state.phase==='draw'?'discard':''}" data-hand="${i}" ${locked||busy?'disabled':''} aria-label="${CARD[id].name}${state.phase==='draw'&&discard.has(i)?'、捨てる対象':''}" aria-pressed="${state.phase==='draw'?discard.has(i):selected===i}"><img src="${CARD[id].image}" alt="${CARD[id].name}">${state.phase==='place'&&CARD[id].cost>p.gold?'<span class="afford">お金不足</span>':''}</button>`).join('')}</div>${state.phase==='place'&&selected!==null&&hand[selected]?`<div class="selected-info"><strong>${CARD[hand[selected]].name}</strong>　${CARD[hand[selected]].cost}金 / 戦力${CARD[hand[selected]].power}<p>${CARD[hand[selected]].effects.map(effectText).join('<br>')}</p><button class="quiet" data-card="${hand[selected]}" style="padding:4px 8px">カードの詳細</button></div>`:''}<div class="hand-info">${state.phase==='place'?`配置しない枠の報酬：${2-moves.length}金（配置処理後に獲得）`:'カードの画像を長押し・右クリックすると詳細を表示できます。'}</div><div class="action-buttons">${state.phase==='place'?`<button id="undoButton" ${!moves.length||locked||busy?'disabled':''}>最後の配置を戻す</button>`:`<button id="clearDiscard" ${!discard.size||locked||busy?'disabled':''}>選択を解除</button>`}<button id="confirmButton" class="primary" ${locked||busy?'disabled':''}>${locked?'全員の確定を待っています':state.phase==='draw'?(discard.size?'交換を確定':'交換せず補充'):moves.length?`${moves.length}枚の配置を確定`:'配置せず2金を獲得'}</button></div></section>`;
}
function resultsHTML(){
 if(!['round','ended'].includes(state.phase))return '';
 const ended=state.phase==='ended';const winner=state.players.filter(p=>state.winners.includes(p.id)).map(p=>esc(p.name)).join('・');
 return `<section class="results"><h2>${ended?`優勝：${winner}`:`ラウンド${state.round}の結果`}</h2>${ended?'<p class="small muted">残ったお金による得点を加算した最終結果です。</p>':''}<table class="score-table"><thead><tr><th>プレイヤー</th><th>戦力 / 順位</th><th>戦争VP</th><th>${ended?'最終VP':'現在VP'}</th></tr></thead><tbody>${[...state.players].sort((a,b)=>ended?b.vp-a.vp:a.rank-b.rank).map(p=>`<tr><td>${esc(p.name)}</td><td>${p.power} / ${p.rank}位</td><td>${p.warVP}</td><td><b>${p.vp}</b></td></tr>`).join('')}</tbody></table></section>`;
}
function renderGame(){
 const draft=currentDraft();const own=state.players.find(p=>p.id===myId);const viewed=boardId===myId?draft:state.players.find(p=>p.id===boardId)||draft;
 const editing=boardId===myId&&state.phase==='place'&&!own.ready;
 app.innerHTML=`<div class="game-head"><div><p class="eyebrow">${mode==='online'?`部屋 ${state.room}`:'CPU対戦'}</p><h1>ラウンド ${state.round}${state.phase==='ended'?' — 終了':''}</h1></div><div style="display:flex;align-items:center;gap:12px">${mode==='online'?`<span id="connection" class="connection">${connection}</span>`:''}<button id="backButton" class="quiet">対戦メニュー</button></div></div><div class="phase-strip">${['ドロー','配置','戦争','発展','収入','VP'].map((s,i)=>`<span class="${state.phase==='draw'&&i===0||state.phase==='place'&&i===1||['round','ended'].includes(state.phase)&&i>=2?'active':''}">${i+1}. ${s}</span>`).join('')}</div>${resultsHTML()}<div class="game-layout"><section class="panel play-panel"><div class="board-heading"><b>${esc(viewed.name)}の王国${boardId===myId&&moves.length&&!own.ready?'（配置予定）':''}</b><span>前方 ↑ ／ ${viewed.board.length}/9体 ／ 戦力 ${power(viewed)}</span></div>${statsHTML(viewed)}${boardHTML(viewed,editing)}${boardId!==myId?'<div class="action-buttons"><button id="myBoardButton">自分の王国に戻る</button></div>':actionHTML(draft)}</section><aside><section class="panel players-panel"><h2>参加者</h2>${state.players.map(p=>`<button class="player-row ${p.id===boardId?'active':''}" data-player="${p.id}"><span class="row-head"><strong>${esc(p.name)}</strong>${p.ready?'<span class="ready">確定</span>':`<span class="player-type">${p.cpu?'CPU':p.id===myId?'あなた':'人間'}</span>`}</span><span class="details">${p.vp} VP ／ ${p.gold}金 ／ ${p.board.length}体<br>技術 ${p.tech}（Lv.${level(p.tech)}）・信仰 ${p.faith}（Lv.${level(p.faith)}）</span></button>`).join('')}</section><section class="panel log-panel"><h2>履歴</h2><ul class="logs">${state.logs.length?[...state.logs].reverse().slice(0,60).map(l=>`<li><b>R${l.round}</b> ${esc(l.message)}</li>`).join(''):'<li>手札を交換して、王国づくりを始めましょう。</li>'}</ul><p class="muted small" style="margin:14px 0 0">山札 ${state.deckCount}枚 ／ 捨て札 ${state.discardCount}枚</p></section></aside></div>`;
 qs('#backButton').onclick=returnSetup;
 for(const el of document.querySelectorAll('[data-player]'))el.onclick=()=>{boardId=el.dataset.player;render();};
 for(const el of document.querySelectorAll('#app [data-card]'))el.onclick=()=>showCard(el.dataset.card);
 for(const el of document.querySelectorAll('[data-cell]'))el.onclick=()=>{
  if(selected===null)return;const[x,y]=el.dataset.cell.split(',').map(Number);
  try{const proposed=[...moves,{handIndex:selected,x,y}];previewPlacement(own,proposed);moves=proposed;selected=null;render();}catch(e){toast(e.message);}
 };
 for(const el of document.querySelectorAll('[data-hand]')){
  const index=Number(el.dataset.hand);el.onclick=()=>{
   if(state.phase==='draw'){discard.has(index)?discard.delete(index):discard.add(index);}else selected=selected===index?null:index;render();
  };
  el.oncontextmenu=e=>{e.preventDefault();showCard((state.phase==='place'?draft:own).hand[index]);};
 }
 if(qs('#myBoardButton'))qs('#myBoardButton').onclick=()=>{boardId=myId;render();};
 if(qs('#undoButton'))qs('#undoButton').onclick=()=>{moves.pop();selected=null;render();};
 if(qs('#clearDiscard'))qs('#clearDiscard').onclick=()=>{discard.clear();render();};
 if(qs('#confirmButton'))qs('#confirmButton').onclick=confirmAction;
 if(qs('#nextButton'))qs('#nextButton').onclick=()=>mode==='online'?remote('next'):localNext();
 if(qs('#newButton'))qs('#newButton').onclick=returnSetup;
 updateConnection();
}
async function confirmAction(){
 const order=state.phase==='draw'?{discard:[...discard]}:{moves:structuredClone(moves)};
 if(mode==='online'){await remote('action',{phase:state.phase,round:state.round,order});return;}
 if(busy)return;busy=true;render();await new Promise(resolve=>setTimeout(resolve,30));
 try{submit(game,myId,order);if(['draw','place'].includes(game.phase))fillCPU(game,submit);applyView(publicView(game,myId));}catch(e){toast(e.message);}finally{busy=false;render();}
}
function localNext(){try{nextRound(game);fillCPU(game,submit);applyView(publicView(game,myId));}catch(e){toast(e.message);}}
function render(){if(mode==='setup')renderSetup();else if(state.phase==='lobby')renderLobby();else renderGame();}
render();
