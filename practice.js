/* ===== 會考複習・練習引擎（完整題庫 / 分Unit / 即時解析）===== */
(function(){
'use strict';
const R=QDATA.reading, TRANS=QDATA.translation||[], PASS={};
QDATA.passages.forEach(p=>PASS[p.pid]=p);
const UNIT=10;
const PCATS=[
  {key:'字彙選填',icon:'🔤',types:['字彙','語意'],color:'#b79ae0'},
  {key:'難字挑戰',icon:'🔴',type:'難字',color:'#e8899f'},
  {key:'文法',icon:'🧩',type:'語法',color:'#7aa5e0'},
  {key:'閱讀',icon:'📖',type:'閱讀理解',color:'#efab6c'},
  {key:'句型翻譯',icon:'🔁',type:'TRANS',color:'#ef9bb0'},
];
const LS=localStorage;
function load(k,d){try{return JSON.parse(LS.getItem(k))||d}catch(e){return d}}
function save(k,v){LS.setItem(k,JSON.stringify(v))}
let wrongBook=load('cap_wrong',{}), markedWords=load('cap_words',{}), unitDone=load('cap_units',{});
const ALLMAP={}; R.forEach(q=>ALLMAP[q.id]=q); TRANS.forEach(q=>ALLMAP[q.id]=q);

function toast(m){let t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1400)}
function poolOf(cat){
  if(cat.type==='TRANS')return TRANS.slice();
  const types=cat.types||[cat.type];
  return R.filter(q=>types.includes(q.type)&&!q.needsImage).sort((a,b)=> b.year-a.year || a.no-b.no);
}
function unitsOf(cat){
  const p=poolOf(cat);
  if(cat.type==='閱讀理解'){ // 閱讀依文章分組，不把同一篇切到不同Unit
    const groups=[],gi={};
    p.forEach(q=>{const key=q.passageRef||q.id;if(!(key in gi)){gi[key]=groups.length;groups.push([])}groups[gi[key]].push(q)});
    const units=[];let cur=[];
    groups.forEach(g=>{if(cur.length&&cur.length+g.length>UNIT){units.push(cur);cur=[]}cur=cur.concat(g);if(cur.length>=UNIT){units.push(cur);cur=[]}});
    if(cur.length)units.push(cur);
    return units;
  }
  const u=[];for(let i=0;i<p.length;i+=UNIT)u.push(p.slice(i,i+UNIT));return u;
}
function isTrans(q){return Array.isArray(q.options)}
function optKeys(q){return isTrans(q)?q.options.map((_,i)=>String.fromCharCode(65+i)):['A','B','C','D'].filter(k=>q.options[k]!=null)}
function optText(q,k){return isTrans(q)?q.options[k.charCodeAt(0)-65]:q.options[k]}
const escH=x=>(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function wordify(txt){if(!txt)return '';txt=escH(txt);return txt.replace(/([A-Za-z][A-Za-z'-]*)/g,m=>{
  const key=m.toLowerCase();return `<span class="word${markedWords[key]?' marked':''}" data-w="${key}">${m}</span>`;});}
function bindWords(root){root.querySelectorAll('.word').forEach(s=>s.addEventListener('click',e=>{
  e.stopPropagation();const w=s.dataset.w;
  if(markedWords[w]){delete markedWords[w]}else{markedWords[w]={ctx:curCtx}}
  save('cap_words',markedWords);
  document.querySelectorAll('.word[data-w="'+w+'"]').forEach(x=>x.classList.toggle('marked',!!markedWords[w]));
  toast(markedWords[w]?('⭐ 加入生字：'+w):('移除：'+w));
}));}

/* ---- 畫面切換（練習 view 內部）---- */
const P={cats:'pr-cats',units:'pr-units',quiz:'pr-quiz',result:'pr-result'};
function prShow(s){for(const k in P)document.getElementById(P[k]).style.display=(k===s?'':'none');
  document.body.classList.toggle('quizzing', s==='quiz'||s==='result'); // 作答/總結時鎖住頂端分頁列
  window.scrollTo(0,0)}

/* ---- 類型清單 ---- */
function prWords(){
  const ks=Object.keys(markedWords);
  let h=`<div class="topbar"><button class="back" id="wbk">←</button><h2>📒 我的生字 (${ks.length})</h2></div>`;
  if(!ks.length)h+='<div class="empty">還沒有生字 ⭐<br><br>作答時<b>點題目或文章裡的英文字</b>就會加進來</div>';
  else ks.forEach(w=>{h+=`<div class="rev"><div class="rh"><b style="font-size:17px">${w}</b><button class="back" data-rm="${w}" style="margin-left:auto">移除</button></div><div class="ra">例句：${(markedWords[w].ctx||'—')}</div></div>`});
  const box=document.getElementById('pr-units');box.innerHTML=h;
  document.getElementById('wbk').onclick=()=>{prShow('cats');buildCats()};
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{delete markedWords[b.dataset.rm];save('cap_words',markedWords);prWords()});
  prShow('units');
}
function buildCats(){
  try{ document.getElementById('prWrongN').textContent=rvWrongCount(); }catch(e){ document.getElementById('prWrongN').textContent=Object.keys(wrongBook).length; }
  const box=document.getElementById('pr-cats');box.innerHTML='';
  // 📚 總複習卡（跨單元混合、診斷弱點）
  var doneN=Object.keys(unitDone).length;
  var rvb=document.createElement('div');rvb.className='prcat';rvb.style.borderLeftColor='#7aa5e0';
  rvb.innerHTML='<span class="pci">📚</span><div><h3>總複習・診斷弱點</h3><div class="pcn">'+(doneN?('把已完成的 '+doneN+' 個 Unit 混合出題，測出你真正還沒記牢的'):'先完成幾個 Unit 再來')+'</div></div><span class="arrowr">›</span>';
  rvb.onclick=function(){ if(typeof rvStartReview==='function') rvStartReview(); };box.appendChild(rvb);
  // 🔥 考前衝刺（關掉跨場次限制、把錯題快速過一遍）
  var due=0; try{ due=RV.dueCount(); }catch(e){}
  var cram=document.createElement('div');cram.className='prcat';cram.style.borderLeftColor='#e8899f';
  cram.innerHTML='<span class="pci">🔥</span><div><h3>考前衝刺</h3><div class="pcn">'+(due?('今天有 '+due+' 題該回來看・'):'')+'把所有錯題快速過一遍、不套隔天限制，標出你今天還在錯的</div></div><span class="arrowr">›</span>';
  cram.onclick=function(){ if(typeof rvCramStart==='function') rvCramStart(); };box.appendChild(cram);
  const wc=Object.keys(markedWords).length;
  const wb=document.createElement('div');wb.className='prcat';wb.style.borderLeftColor='#f5c33b';
  wb.innerHTML=`<span class="pci">📒</span><div><h3>我的生字</h3><div class="pcn">已收集 ${wc} 個字・點看複習</div></div><span class="arrowr">›</span>`;
  wb.onclick=prWords;box.appendChild(wb);
  PCATS.forEach(cat=>{
    const us=unitsOf(cat), n=poolOf(cat).length;
    let done=0;us.forEach((_,i)=>{if(unitDone[cat.key+'#'+i])done++});
    const d=document.createElement('div');d.className='prcat';d.style.borderLeftColor=cat.color;
    d.innerHTML=`<span class="pci">${cat.icon}</span><div><h3>${cat.key}</h3>
      <div class="pcn">${n} 題・${us.length} 個 Unit${done?'　✅ 已完成 '+done+'/'+us.length:''}</div></div><span class="arrowr">›</span>`;
    d.onclick=()=>openCat(cat.key);box.appendChild(d);
  });
}
function openCat(key){
  const cat=PCATS.find(c=>c.key===key);const us=unitsOf(cat);
  const box=document.getElementById('pr-units');
  let h=`<div class="topbar"><button class="back" id="pbk">←</button><h2>${cat.icon} ${cat.key}</h2></div>
    <p class="hint" style="text-align:left;color:var(--soft);font-size:13px;margin:0 0 10px">完整 ${poolOf(cat).length} 題，依序分成 ${us.length} 個 Unit</p><div class="units">`;
  us.forEach((arr,i)=>{
    const rec=unitDone[cat.key+'#'+i];
    const first=arr[0],last=arr[arr.length-1];
    const rng=(cat.type==='TRANS'||!first.year)?`第 ${i*UNIT+1}-${i*UNIT+arr.length} 題`:`${first.year}年 起・${arr.length} 題`;
    h+=`<div class="unit${rec?' finished':''}" data-c="${cat.key}" data-u="${i}">
      ${rec?'<span class="done">✔ '+rec.score+'/'+rec.total+'</span>':''}
      <h4>Unit ${i+1}</h4><div class="ur">${rng}</div></div>`;
  });
  h+='</div>';
  box.innerHTML=h;
  document.getElementById('pbk').onclick=()=>{prShow('cats');buildCats()};
  box.querySelectorAll('.unit').forEach(u=>u.onclick=()=>startUnit(u.dataset.c,+u.dataset.u));
  prShow('units');
}

/* ---- 出題 ---- */
let Q=[],idx=0,answers=[],curCat=null,curUnit=0,curCtx='',redo=false;
function startUnit(ck,ui){
  const cat=PCATS.find(c=>c.key===ck);Q=unitsOf(cat)[ui];curCat=ck;curUnit=ui;redo=false;
  idx=0;gReveal={};answers=new Array(Q.length).fill(null);renderQ();prShow('quiz');
}
function prWrong(){
  const ids=Object.keys(wrongBook);if(!ids.length){toast('目前沒有錯題 🎉');return}
  Q=ids.map(id=>ALLMAP[id]).filter(Boolean);curCat=null;redo=true;
  idx=0;gReveal={};answers=new Array(Q.length).fill(null);renderQ();prShow('quiz');
}
let gReveal={};
function grpRange(i){const pr=Q[i]&&Q[i].passageRef;if(!pr)return[i,i];let s=i,e=i;while(s>0&&Q[s-1].passageRef===pr)s--;while(e<Q.length-1&&Q[e+1].passageRef===pr)e++;return[s,e];}
function markOne(q,k){ if(k!==q.answer){ try{RV.addWrong(q.id,'mcq',q.keyPoint||q.skill||'閱讀',q.type);}catch(e){} } } // 只進 RV2 錯題本
function pickG(i,k){const[gs]=grpRange(idx);const pr=Q[gs].passageRef;if(gReveal[pr])return;answers[i]=k;renderGroup();}
function revealG(){const[gs,ge]=grpRange(idx);const pr=Q[gs].passageRef;if(gReveal[pr])return;gReveal[pr]=1;for(let i=gs;i<=ge;i++){if(answers[i]!=null)markOne(Q[i],answers[i]);}renderGroup();}
function nextGroup(){const[,ge]=grpRange(idx);if(ge+1<Q.length){idx=ge+1;renderQ();}else finish();}
function prevGroup(){const[gs]=grpRange(idx);if(gs>0){const[ps]=grpRange(gs-1);idx=ps;renderQ();}}
function renderGroup(){
  const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let[gs,ge]=grpRange(idx);if(idx!==gs)idx=gs;
  const pr=Q[gs].passageRef,p=PASS[pr],rv=!!gReveal[pr];
  let allAns=true;for(let i=gs;i<=ge;i++){if(answers[i]==null)allAns=false;}
  let qs='',correct=0;
  for(let i=gs;i<=ge;i++){const q=Q[i],picked=answers[i];
    let opts='';optKeys(q).forEach(k=>{let cls='opt';if(rv){if(k===q.answer)cls+=' ok';else if(k===picked)cls+=' no';}else if(k===picked)cls+=' sel';opts+=`<button class="${cls}" data-i="${i}" data-k="${k}"${rv?' style="pointer-events:none"':''}><span class="lab">${k}</span><span>${esc(optText(q,k))}</span></button>`;});
    let fb='';if(rv){const ok=picked===q.answer;if(ok)correct++;fb=`<div class="fb show ${ok?'good':'bad'}"><div class="kp">${ok?'✅ 答對':(picked==null?'⬜ 未作答':'❌ 答錯')}　正解：${q.answer}</div>${q.explain||'（正解如上）'}</div>`;}
    qs+=`<div class="qcard"><span class="qtag">${q.type||''}</span><div class="stem">${wordify(q.stem)}</div><div class="opts">${opts}</div>${fb}</div>`;}
  const action=rv?`<div class="fb show good"><div class="kp">📖 本篇答對 ${correct} / ${ge-gs+1} 題</div></div>`:`<button class="btn primary" id="grpChk"${allAns?'':' disabled style="opacity:.5"'} style="width:100%">✅ 對答案（整篇 ${ge-gs+1} 題）</button>`;
  document.getElementById('pr-quiz').innerHTML=`
    <div class="topbar"><button class="back" id="qbk">←</button><h2>${curCat?curCat+' Unit '+(curUnit+1):'閱讀'}</h2></div>
    <div class="prog"><i style="width:${(ge+1)/Q.length*100}%"></i></div>
    <div class="pmeta"><span>${gs+1}-${ge+1} / ${Q.length}</span><span>📖 讀完整篇、整組答完再對答案</span></div>
    <div class="passage"><div class="pg">📄 ${p.genre||'閱讀'}${p.topic?'・'+p.topic:''}</div>${wordify(p.text)}</div>
    ${qs}${action}
    <div class="btnrow" id="qbtns">${gs>0?'<button class="btn ghost" id="gprev">‹ 上一篇</button>':''}<button class="btn primary" id="gnext"${rv?'':' disabled style="opacity:.5"'}>${ge+1<Q.length?'下一篇 →':'看總結'}</button></div>`;
  const root=document.getElementById('pr-quiz');bindWords(root);
  root.querySelectorAll('.opt').forEach(o=>o.addEventListener('click',()=>pickG(+o.dataset.i,o.dataset.k)));
  const chk=document.getElementById('grpChk');if(chk)chk.onclick=revealG;
  const gn=document.getElementById('gnext');if(gn&&rv)gn.onclick=nextGroup;
  const gp=document.getElementById('gprev');if(gp)gp.onclick=prevGroup;
  document.getElementById('qbk').onclick=()=>{ if(confirm('離開這個 Unit？此次作答不保存')){ redo?(prShow('cats'),buildCats()):openCat(curCat) } };
}
function renderQ(){
  const q=Q[idx];curCtx=isTrans(q)?q.zh:q.stem;
  if(!isTrans(q)&&q.passageRef&&PASS[q.passageRef]&&!redo){return renderGroup();}
  const passage=(!isTrans(q)&&q.passageRef&&PASS[q.passageRef])?
    `<div class="passage"><div class="pg">📄 ${PASS[q.passageRef].genre||'閱讀'}${PASS[q.passageRef].topic?'・'+PASS[q.passageRef].topic:''}</div>${wordify(PASS[q.passageRef].text)}</div>`:'';
  const tag=isTrans(q)?('翻譯・'+(q.keyPoint||'')):(q.type+(q.skill&&q.skill!==q.type?'・'+q.skill:''));
  const stem=isTrans(q)?('中翻英：<b>'+q.zh+'</b>'):wordify(q.stem);
  const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let opts='';optKeys(q).forEach(k=>{opts+=`<button class="opt" data-k="${k}"><span class="lab">${k}</span><span>${esc(optText(q,k))}</span></button>`});
  const pw=(answers[idx]!=null?idx+1:idx)/Q.length*100;
  document.getElementById('pr-quiz').innerHTML=`
    <div class="topbar"><button class="back" id="qbk">←</button><h2>${redo?'錯題複習':(curCat+' Unit '+(curUnit+1))}</h2></div>
    <div class="prog"><i id="pbar" style="width:${pw}%"></i></div>
    <div class="pmeta"><span>${idx+1} / ${Q.length}</span><span>答完即時解析</span></div>
    ${passage}
    <div class="qcard"><span class="qtag">${tag}</span>${q.needsImage?'<span class="qtag" style="background:#fff3cd;color:#8a6d1a;margin-left:6px">📷 此題需搭配原卷圖片</span>':''}<div class="stem">${stem}</div>
      <div class="opts">${opts}</div><div class="fb" id="fb"></div></div>
    <div class="btnrow" id="qbtns"></div>`;
  const root=document.getElementById('pr-quiz');
  bindWords(root);
  root.querySelectorAll('.opt').forEach(o=>o.addEventListener('click',()=>pick(o.dataset.k)));
  document.getElementById('qbk').onclick=()=>{ if(confirm('離開這個 Unit？此次作答不保存')){ redo?(prShow('cats'),buildCats()):openCat(curCat) } };
  renderBtns(false);
  if(answers[idx]!=null)lockUI(answers[idx]);
}
function renderBtns(answered){
  const last=idx===Q.length-1;
  const b=document.createElement('button');b.className='btn primary';b.textContent=last?'看總結':'下一題 →';
  b.disabled=!answered&&answers[idx]==null;b.style.opacity=b.disabled?.5:1;
  b.onclick=()=>{last?finish():(idx++,renderQ())};
  const row=document.getElementById('qbtns');row.innerHTML='';row.appendChild(b);
}
function pick(k){
  if(answers[idx]!=null)return;
  answers[idx]=k;const q=Q[idx];
  if(k!==q.answer){ try{RV.addWrong(q.id,'mcq',(curCat!=null?curCat+'#'+curUnit:'wrong'),q.keyPoint||q.type);}catch(e){} } // 單一真相：只進 RV2 嚴格錯題本(不再雙寫舊 cap_wrong)
  else if(wrongBook[q.id]){ // 答對且原本是錯題 → 進級，連對2次畢業（一般練習也適用）
    wrongBook[q.id].box=(wrongBook[q.id].box||0)+1;
    if(wrongBook[q.id].box>=2){delete wrongBook[q.id];toast('這題訂正成功、畢業囉 🎓')}
    save('cap_wrong',wrongBook);
  }
  lockUI(k);renderBtns(true);
  const pb=document.getElementById('pbar');if(pb)pb.style.width=((idx+1)/Q.length*100)+'%';
}
function lockUI(k){
  const q=Q[idx],good=k===q.answer;
  document.querySelectorAll('#pr-quiz .opt').forEach(o=>{o.classList.add('dis');o.style.pointerEvents='none';
    if(o.dataset.k===q.answer)o.classList.add('ok');
    if(o.dataset.k===k&&!good)o.classList.add('no');});
  const fb=document.getElementById('fb');fb.className='fb show '+(good?'good':'bad');
  fb.innerHTML=`<div class="kp">${good?'✅ 答對了':'❌ 答錯了'}　考點：${q.keyPoint||q.type||''}</div>${q.explain||'（解析生成中）'}`;
}
function finish(){
  let correct=0;Q.forEach((q,i)=>{if(answers[i]===q.answer)correct++});
  if(!redo&&curCat!=null){unitDone[curCat+'#'+curUnit]={score:correct,total:Q.length};save('cap_units',unitDone)}
  const pct=Math.round(correct/Q.length*100);
  let h=`<div class="topbar"><button class="back" id="rbk">←</button><h2>Unit 總結</h2></div>
    <div class="scorebox"><div class="big">${correct}/${Q.length}</div>
    <div class="sub">答對 ${pct}%　${pct>=80?'太棒了！🎉':pct>=60?'不錯，繼續加油！💪':'多練幾次會更好 📚'}</div></div>
    <div class="btnrow" style="margin-bottom:16px">
      <button class="btn ghost" id="rback">回列表</button>
      <button class="btn primary" id="ragain">再做一次</button></div>
    <h3 style="font-size:16px">📋 逐題解析</h3><div id="rlist"></div>`;
  document.getElementById('pr-result').innerHTML=h;
  const rl=document.getElementById('rlist');
  Q.forEach((q,i)=>{
    const ok=answers[i]===q.answer;const ua=answers[i]?optText(q,answers[i]):'（未作答）';const ca=optText(q,q.answer);
    const d=document.createElement('div');d.className='rev';
    d.innerHTML=`<div class="rh"><span class="mark ${ok?'ok':'no'}">${ok?'✔':'✘'}</span><span>第 ${i+1} 題</span>
      <span class="qtag" style="margin-left:auto">${isTrans(q)?'翻譯':q.type}</span></div>
      <div class="rq">${isTrans(q)?('中翻英：'+q.zh):wordify(q.stem)}</div>
      <div class="ra">你的答案：<b style="color:${ok?'var(--ok)':'var(--no)'}">${answers[i]||'—'}. ${escH(ua)}</b>${ok?'':`　｜　正解：<b style="color:var(--ok)">${q.answer}. ${escH(ca)}</b>`}</div>
      <div class="rex"><div class="kp">考點：${q.keyPoint||q.type||''}</div>${q.explain||'（解析生成中）'}</div>`;
    rl.appendChild(d);
  });
  bindWords(document.getElementById('pr-result'));
  document.getElementById('rbk').onclick=()=>{redo?(prShow('cats'),buildCats()):openCat(curCat)};
  document.getElementById('rback').onclick=()=>{redo?(prShow('cats'),buildCats()):openCat(curCat)};
  document.getElementById('ragain').onclick=()=>{idx=0;answers=new Array(Q.length).fill(null);renderQ();prShow('quiz')};
  prShow('result');
}

/* ---- 掛到「練習」分頁 & 各重點頁的「去練習」按鈕 ---- */
function prReset(){prShow('cats');buildCats()}
document.querySelectorAll('[data-view="practice"]').forEach(el=>el.addEventListener('click',prReset));
const NOTE2CAT={gram:'文法',pattern:'句型翻譯',phrase:'字彙選填',vocab:'字彙選填'};
Object.keys(NOTE2CAT).forEach(v=>{
  const view=document.getElementById('v-'+v);if(!view)return;
  const sec=view.querySelector('.sec-head');if(!sec)return;
  const ck=NOTE2CAT[v];
  const note=document.createElement('div');note.className='pr-note';
  note.innerHTML=`📚 讀完這類重點了？<button>去練「${ck}」真題 →</button>`;
  note.querySelector('button').onclick=()=>{ if(typeof show==='function')show('practice'); prShow('units'); openCat(ck); };
  sec.insertAdjacentElement('afterend',note);
});
/* ================= RV2 整合：📚 總複習 + 嚴格錯題本 ================= */
var RV=new RV2().init('cap_rv2',{ topStepOf:function(){ return 2; } }); // 05 全選擇題→最難階=2(識別→再確認)
var RVMAP={};
function rvKP(q){ return q.keyPoint||q.skill||q.type||'其他'; }   // 診斷用「考點/知識點」而非流水號切塊
function rvPool(){ var pool=[],map={};
  PCATS.forEach(function(cat){ if(cat.type==='閱讀理解')return; var us=unitsOf(cat);
    us.forEach(function(arr,ui){ if(!unitDone[cat.key+'#'+ui])return;
      arr.forEach(function(q){ pool.push(q.id); map[q.id]={q:q,unit:rvKP(q),tag:cat.key}; }); }); });
  RVMAP=map; return pool; }
function rvShuf(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;} return a; }
function rvOptsHTML(q){ var ks=rvShuf(optKeys(q)),h='';
  ks.forEach(function(k){ h+='<button class="opt" data-k="'+k+'"><span class="lab">'+k+'</span><span>'+escH(optText(q,k))+'</span></button>'; }); return h; }
function rvLockOpts(sel,q,k,ok){ document.querySelectorAll(sel+' .opt').forEach(function(o){ o.style.pointerEvents='none'; if(o.dataset.k===q.answer)o.classList.add('ok'); if(o.dataset.k===k&&!ok)o.classList.add('no'); }); }
function rvUlab(u){ return u.replace('#',' U'); }

/* ---- 總複習：跨單元交錯、不看單元標籤、憑記憶（洗牌選項）---- */
var rvQ=[],rvI=0,rvRes=[],rvPicked=null;
function rvStartReview(){ var pool=rvPool();
  if(pool.length<8){ toast('先完成幾個 Unit，總複習才有題目 📚'); return; }
  RV.startSession(); rvQ=RV.buildReview(pool, Math.min(30,pool.length)); rvI=0; rvRes=[]; rvPicked=null; rvRenderQ(); prShow('quiz'); }
function rvDrill(kp){ // 立即補：跨全題庫抓同「考點」的題(不限已完成單元)，真正哪裡弱補哪裡
  var all=R.concat(TRANS).filter(function(q){ return !q.needsImage && rvKP(q)===kp; });
  if(!all.length){ toast('這個考點沒有可補的題'); return; }
  RVMAP={}; all.forEach(function(q){ RVMAP[q.id]={q:q,unit:rvKP(q),tag:kp}; });
  RV.startSession(); rvQ=rvShuf(all.map(function(q){return q.id;})).slice(0,15); rvI=0; rvRes=[]; rvPicked=null; rvRenderQ(); prShow('quiz'); }
function rvRenderQ(){ var id=rvQ[rvI],m=RVMAP[id],q=m.q; rvPicked=null;
  document.getElementById('pr-quiz').innerHTML=
    '<div class="topbar"><button class="back" id="rvbk">←</button><h2>📚 總複習</h2></div>'+
    '<div class="prog"><i style="width:'+(rvI/rvQ.length*100)+'%"></i></div>'+
    '<div class="pmeta"><span>'+(rvI+1)+' / '+rvQ.length+'</span><span>混合題・不看單元、憑記憶作答</span></div>'+
    '<div class="qcard"><span class="qtag">混合複習</span><div class="stem">'+(isTrans(q)?('中翻英：<b>'+escH(q.zh)+'</b>'):wordify(q.stem))+'</div>'+
      '<div class="opts" id="rvopts">'+rvOptsHTML(q)+'</div><div class="fb" id="rvfb"></div></div>'+
    '<div class="btnrow" id="rvbtns"></div>';
  var root=document.getElementById('pr-quiz'); bindWords(root);
  root.querySelectorAll('#rvopts .opt').forEach(function(o){ o.addEventListener('click',function(){ rvPick(o.dataset.k); }); });
  document.getElementById('rvbk').onclick=function(){ if(confirm('離開總複習？此次不保存')){ prShow('cats'); buildCats(); } }; }
function rvPick(k){ if(rvPicked!=null)return; rvPicked=k; var id=rvQ[rvI],m=RVMAP[id],q=m.q,ok=k===q.answer;
  RV.recordReview(id,m.unit,ok,m.tag); RV.tickSession(); rvRes.push({id:id,unit:m.unit,tag:m.tag,ok:ok});
  if(!ok) RV.addWrong(id,'mcq',m.unit,m.tag); RV.save();
  rvLockOpts('#rvopts',q,k,ok);
  var fb=document.getElementById('rvfb'); fb.className='fb show '+(ok?'good':'bad'); fb.innerHTML='<div class="kp">'+(ok?'✅ 答對':'❌ 答錯')+'　考點：'+(q.keyPoint||q.type||'')+'</div>'+(q.explain||'');
  var last=rvI===rvQ.length-1,b=document.createElement('button'); b.className='btn primary'; b.textContent=last?'看診斷結果':'下一題 →';
  b.onclick=function(){ if(last)rvFinishReview(); else { rvI++; rvRenderQ(); } };
  var row=document.getElementById('rvbtns'); row.innerHTML=''; row.appendChild(b); }
function rvFinishReview(){ var diag=RV.finishReview(rvRes);
  var correct=rvRes.filter(function(x){return x.ok;}).length, pct=Math.round(correct/rvRes.length*100);
  var kps={}; R.concat(TRANS).forEach(function(q){ if(!q.needsImage) kps[rvKP(q)]=1; }); var totalUnits=Object.keys(kps).length;
  var rc=RV.retainedCount(totalUnits);
  var esc2=function(s){return (s||'').replace(/'/g,'').replace(/"/g,'').replace(/</g,'');};
  var bandTxt={master:'精熟',shaky:'待加強',weak:'不熟'},bandCol={master:'#7bd36a',shaky:'#f5c33b',weak:'#e8899f'};
  var heat=diag.units.map(function(u){ return '<div style="background:'+bandCol[u.band]+';color:#1a1a1a;border-radius:8px;padding:6px 5px;text-align:center;font-size:11px;font-weight:800">'+escH(u.unit)+'<br>'+Math.round(u.r*100)+'%</div>'; }).join('');
  var weak=diag.weakUnits.map(function(u){ return '<button class="btn ghost" style="display:flex;justify-content:space-between" onclick="rvDrill(\''+esc2(u.unit)+'\')">'+bandTxt[u.band]+'：'+escH(u.unit)+' ('+Math.round(u.r*100)+'%) <span>立即補 ›</span></button>'; }).join('');
  document.getElementById('pr-result').innerHTML=
    '<div class="topbar"><button class="back" id="rvrbk">←</button><h2>📊 總複習診斷</h2></div>'+
    '<div class="scorebox"><div class="big">'+pct+'%</div><div class="sub">'+correct+'/'+rvRes.length+' 題</div></div>'+
    '<div class="rev" style="border-left:4px solid #7aa5e0"><b>這才是考試會遇到的狀態</b><br>單元練習時你可能 100%，但混合、延後、不看單元的複習只有 '+pct+'%——差距就是還沒真正記牢的部分。</div>'+
    '<div class="rev"><b>已精熟 '+rc.retained+' / '+rc.total+' 個 Unit</b>（精熟＝延後混合複習還答得對，不是當天做完就算）</div>'+
    '<h3 style="font-size:15px;margin:14px 0 6px">各 Unit 保留率</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px">'+heat+'</div>'+
    (weak?'<h3 style="font-size:15px;margin:14px 0 6px">先補這裡</h3><div class="btnrow" style="flex-direction:column;gap:8px">'+weak+'</div>':'')+
    '<div class="btnrow" style="margin-top:16px"><button class="btn ghost" id="rvback">回列表</button><button class="btn primary" id="rvagain">再一輪</button></div>';
  document.getElementById('rvrbk').onclick=document.getElementById('rvback').onclick=function(){ prShow('cats'); buildCats(); };
  document.getElementById('rvagain').onclick=rvStartReview; prShow('result'); }

/* ---- 嚴格錯題本：完整度儀表 + 難度階梯 + 跨場次才畢業 ---- */
var rwSess=[],rwI=0,rwPicked=null,rwCram=false;
function rvWrongStart(cram){ rwCram=!!cram; RV.setCram(rwCram); RV.startSession(); rwSess=RV.buildWrongSession(cram?200:40);
  if(!rwSess.length){ toast('目前沒有要複習的錯題 🎉'); RV.setCram(false); return; }
  rwI=0; rwPicked=null; rvWrongRender(); prShow('quiz'); }
function rvCramStart(){ rvWrongStart(true); }
function rvWrongRender(){ if(rwI>=rwSess.length){ return rvWrongDone(); }
  var it=rwSess[rwI],id=it.id,q=(RVMAP[id]&&RVMAP[id].q)||ALLMAP[id]; if(!q){ rwI++; return rvWrongRender(); }
  var w=RV.db.wrong[id],f=w.facets[it.facet],step=f.step;
  var cm=RV.completeness(), stepTxt=step>=2?'難度 ●● 再確認（選項已重排，位置背不了）':'難度 ●○ 先選對';
  document.getElementById('pr-quiz').innerHTML=
    '<div class="topbar"><button class="back" id="rwbk">←</button><h2>❌ 錯題複習（嚴格）</h2></div>'+
    '<div class="rev" style="border-left:4px solid #e8899f;margin-bottom:8px;display:flex;align-items:center;gap:8px"><div style="flex:1"><b>完整度 '+cm.pct+'%</b>'+(rwCram?'　🔥考前衝刺':'')+'（清除 '+cm.clearedFacets+' / '+cm.totalFacets+' 面向）<div class="prog" style="margin-top:6px"><i style="width:'+cm.pct+'%"></i></div></div><button class="back" style="font-size:12px;white-space:nowrap" onclick="rvRetire()">🗑 放生</button></div>'+
    '<div class="pmeta"><span>'+(rwI+1)+' / '+rwSess.length+'</span><span>'+stepTxt+(w.misses>=4?'　🔥頑固題':'')+'　'+(rwCram?'衝刺模式':('畢業需跨場次 '+f.streak+'/'+w.needClears))+'</span></div>'+
    '<div class="qcard"><span class="qtag">'+(q.type||q.keyPoint||'錯題')+'</span><div class="stem">'+(isTrans(q)?('中翻英：<b>'+escH(q.zh)+'</b>'):wordify(q.stem))+'</div>'+
      '<div class="opts" id="rwopts">'+rvOptsHTML(q)+'</div><div class="fb" id="rwfb"></div></div>'+
    '<div class="btnrow" id="rwbtns"></div>';
  var root=document.getElementById('pr-quiz'); bindWords(root);
  root.querySelectorAll('#rwopts .opt').forEach(function(o){ o.addEventListener('click',function(){ rvWrongPick(o.dataset.k); }); });
  document.getElementById('rwbk').onclick=function(){ if(confirm('離開錯題複習？')){ prShow('cats'); buildCats(); } }; }
function rvWrongPick(k){ if(rwPicked!=null)return; rwPicked=k; var it=rwSess[rwI],id=it.id,q=(RVMAP[id]&&RVMAP[id].q)||ALLMAP[id],ok=k===q.answer;
  rvLockOpts('#rwopts',q,k,ok);
  var fb=document.getElementById('rwfb'),row=document.getElementById('rwbtns'); row.innerHTML='';
  if(!ok){ var res=RV.gradeFacet(id,it.facet,false); RV.tickSession(); fb.className='fb show bad'; fb.innerHTML='<div class="kp">❌ '+(res.msg||'')+'</div>'+(q.explain||''); rvWrongNextBtn(); return; }
  // 自評閘門：答對後誠實選「我確定 / 用刪的」，只有「我確定」才算徹底會了(堵四選一刪去法矇混)
  fb.className='fb show good'; fb.innerHTML='<div class="kp">✅ 答對了——你是「確定」還是「用刪的/猜的」？誠實選，只有「我確定」才算徹底會了</div>'+(q.explain||'');
  var b1=document.createElement('button'); b1.className='btn primary'; b1.textContent='✅ 我確定'; b1.onclick=function(){ rvWrongConfirm(id,it,true); };
  var b2=document.createElement('button'); b2.className='btn ghost'; b2.textContent='🤔 我用刪的/猜的'; b2.onclick=function(){ rvWrongConfirm(id,it,false); };
  row.appendChild(b1); row.appendChild(b2); }
function rvWrongConfirm(id,it,confident){ var res=RV.gradeFacet(id,it.facet,true,{confident:confident}); RV.tickSession();
  var fb=document.getElementById('rwfb'); fb.innerHTML='<div class="kp">'+(res.notsure?'🤔 ':(res.graduated?'🎓 ':'✅ '))+(res.msg||'')+'</div>';
  if(res.xp){ try{ if(window.Ninja&&Ninja.gain) Ninja.gain(res.xp,'cap',{correct:1}); }catch(e){} }
  rvWrongNextBtn(); }
function rvWrongNextBtn(){ var row=document.getElementById('rwbtns'); row.innerHTML='';
  var b=document.createElement('button'); b.className='btn primary'; b.textContent=rwI>=rwSess.length-1?'完成':'下一題 →';
  b.onclick=function(){ rwI++; rwPicked=null; rvWrongRender(); }; row.appendChild(b); }
function rvRetire(){ var it=rwSess[rwI]; if(it){ RV.retireWrong(it.id); toast('已放生這題 🗑'); rwI++; rwPicked=null; rvWrongRender(); } }
function rvWrongDone(){ var cm=RV.completeness();
  document.getElementById('pr-result').innerHTML=
    '<div class="topbar"><button class="back" id="rwrbk">←</button><h2>錯題複習</h2></div>'+
    '<div class="scorebox"><div class="big">'+cm.pct+'%</div><div class="sub">完整度：已清除 '+cm.clearedFacets+' / '+cm.totalFacets+' 面向</div></div>'+
    '<div class="rev" style="border-left:4px solid #7aa5e0">這一輪推進了難度階梯。<b>畢業要跨場次</b>——今天答對的，要間隔後再答對才算數，防止當場硬背矇混。</div>'+
    '<div class="btnrow" style="margin-top:16px"><button class="btn ghost" id="rwback">回列表</button><button class="btn primary" id="rwagain">再練一輪</button></div>';
  document.getElementById('rwrbk').onclick=document.getElementById('rwback').onclick=function(){ prShow('cats'); buildCats(); };
  document.getElementById('rwagain').onclick=rvWrongStart; prShow('result'); }
function rvWrongCount(){ var n=0; Object.keys(RV.db.wrong).forEach(function(id){ if(!RV.db.wrong[id].graduated)n++; }); return n; }
window.rvStartReview=rvStartReview; window.rvDrill=rvDrill; window.rvWrongStart=rvWrongStart; window.rvWrongCount=rvWrongCount;
window.rvCramStart=rvCramStart; window.rvRetire=rvRetire;

// 初始化
buildCats();
if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}
// 對外
window.prWrong=prWrong;
})();
