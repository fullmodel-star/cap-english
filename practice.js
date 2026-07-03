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
function wordify(txt){if(!txt)return '';return txt.replace(/([A-Za-z][A-Za-z'-]*)/g,m=>{
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
  document.getElementById('prWrongN').textContent=Object.keys(wrongBook).length;
  const box=document.getElementById('pr-cats');box.innerHTML='';
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
  idx=0;answers=new Array(Q.length).fill(null);renderQ();prShow('quiz');
}
function prWrong(){
  const ids=Object.keys(wrongBook);if(!ids.length){toast('目前沒有錯題 🎉');return}
  Q=ids.map(id=>ALLMAP[id]).filter(Boolean);curCat=null;redo=true;
  idx=0;answers=new Array(Q.length).fill(null);renderQ();prShow('quiz');
}
function renderQ(){
  const q=Q[idx];curCtx=isTrans(q)?q.zh:q.stem;
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
  if(k!==q.answer){wrongBook[q.id]=wrongBook[q.id]||{box:0,wrong:0};wrongBook[q.id].wrong++;wrongBook[q.id].box=0;save('cap_wrong',wrongBook)}
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
      <div class="ra">你的答案：<b style="color:${ok?'var(--ok)':'var(--no)'}">${answers[i]||'—'}. ${ua}</b>${ok?'':`　｜　正解：<b style="color:var(--ok)">${q.answer}. ${ca}</b>`}</div>
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
// 初始化
buildCats();
if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}
// 對外
window.prWrong=prWrong;
})();
