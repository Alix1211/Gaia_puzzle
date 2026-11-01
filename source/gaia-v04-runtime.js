/* Browser controller: GaiaEngine is embedded immediately before this script. */
(() => {
 'use strict';
 const ART={
   paddle:'__PADDLE__',dildo:'__DILDO__',lips:'__LIPS__',gag:'__GAG__',heart:'__HEART__',
   poses:[
    ['__MEMBER1_0__','__MEMBER1_1__','__MEMBER1_2__','__MEMBER1_3__'],
    ['__MEMBER2_0__','__MEMBER2_1__','__MEMBER2_2__','__MEMBER2_3__']
   ]
 };
 const E=GaiaEngine;
 const SYMBOLS=[
  {key:'paddle',name:'물리 타격',short:'PHYSICAL'},
  {key:'dildo',name:'성적',short:'SENSATION'},
  {key:'lips',name:'모럴',short:'MORALE'},
  {key:'gag',name:'복종',short:'SUBMISSION'},
  {key:'heart',name:'회복',short:'RECOVERY'}
 ];
 // Every session has four gauges. Asymmetric requirements, not disabled categories.
 const MEMBERS=[
  {name:'MEMBER 01',rank:'FOUNDATION · PRIVATE A',goals:[58,42,51,38],aiSkill:.49},
  {name:'MEMBER 02',rank:'ADVANCED · PRIVATE B',goals:[72,98,58,108],aiSkill:.78}
 ];
 const CFG={perTile:3,chainBonus:.23,damagePerTile:1.35,healPerTile:4,
  energyPerTile:1.9,focusCost:60,focusMultiplier:1.65,
  hpBase:225,hpPerLevel:6,powerPerLevel:.035,maxCascade:28};
 const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
 const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
 const panel=$('portraitPanel'),portrait=$('portrait'),boardEl=$('board'),modal=$('modal'),modalContent=$('modalContent');
 const FX=createGaiaBoardFx(boardEl);
 const game={board:E.newBoard(),specials:Array(64).fill(null),meters:[0,0,0,0],targets:[0,0,0,0],
   memberIndex:0,trainingLevel:1,xp:0,wins:0,sound:true,hp:225,maxHP:225,
   energy:0,focus:false,turn:0,active:'PLAYER',locked:true,stage:'menu',selected:-1,
   totalCleared:0,lastChain:0};
 let audioCtx=null,poseTimer=null,toastTimer=null,menuChoice=0,press=null;
 try{
   const saved=JSON.parse(localStorage.getItem('gaia-royale-v02')||'{}');
   game.trainingLevel=clamp(+saved.level||1,1,99);
   game.xp=clamp(+saved.xp||0,0,99999);
   game.wins=clamp(+saved.wins||0,0,99999);
   game.sound=saved.sound!==false;
 }catch(err){}
 GaiaAudio.setEnabled(game.sound);
 function save(){try{localStorage.setItem('gaia-royale-v02',JSON.stringify({
  level:game.trainingLevel,xp:game.xp,wins:game.wins,sound:game.sound}));}catch(err){}}
 function showModal(html){modalContent.innerHTML=html;modal.classList.remove('hidden');}
 function hideModal(){modal.classList.add('hidden');}
 function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');
   clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1500);}
 function sound(kind){
  if(!game.sound)return;
  if(kind==='hit')GaiaAudio.slap();
  try{
   audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
   if(audioCtx.state==='suspended')audioCtx.resume();
   const now=audioCtx.currentTime;
   const notes=kind==='hit'?[[110,.13,'triangle',.18],[83,.09,'sawtooth',.08]]:
    kind==='laser'?[[360,.24,'sawtooth',.065],[920,.14,'triangle',.035]]:
    kind==='blast'?[[95,.26,'sawtooth',.14],[58,.30,'triangle',.07]]:
    kind==='heal'?[[520,.16,'sine',.085],[740,.24,'sine',.05]]:
    kind==='electric'?[[170,.07,'sawtooth',.1],[850,.16,'square',.03]]:
    kind==='clear'?[[620,.12,'sine',.05],[800,.17,'sine',.05]]:
    kind==='swap'?[[350,.07,'triangle',.06]]:[[470,.12,'sine',.07]];
   for(let k=0;k<notes.length;k++){
    const [freq,dur,wave,vol]=notes[k],osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(freq,now+.055*k);
    osc.frequency.exponentialRampToValueAtTime(freq*.83,now+.055*k+dur);
    gain.gain.setValueAtTime(vol,now+.055*k);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.055*k+dur);
    osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now+.055*k);osc.stop(now+.055*k+dur+.015);
   }
  }catch(err){}
 }
 function vibrate(ms){try{navigator.vibrate?.(ms);}catch(err){}}
 function setPose(pose,resetMs=0){
   clearTimeout(poseTimer);
   portrait.src=ART.poses[game.memberIndex][pose];
   if(resetMs)poseTimer=setTimeout(()=>{if(game.stage==='playing')portrait.src=ART.poses[game.memberIndex][0];},resetMs);
 }
 function memberInfo(){
   $('memberName').textContent=MEMBERS[game.memberIndex].name;
   $('memberRank').textContent=MEMBERS[game.memberIndex].rank;
   $('portraitTitle').textContent='PRIVATE MEMBER · '+String(game.memberIndex+1).padStart(2,'0');
   setPose(0);
 }
 function renderGoals(){
   $('goalRows').innerHTML=SYMBOLS.slice(0,4).map((s,i)=>{
    const v=game.meters[i],t=game.targets[i],pct=clamp(v/t*100,0,100);
    return '<div class="goal" data-kind="'+i+'"><div class="goalhead"><span>'+s.name+
     ' <span class="goalEnglish">'+s.short+'</span></span><span class="num">'+v+' / '+t+
     '</span></div><div class="goalrail"><div class="goalfill" style="width:'+pct+'%"></div></div></div>';
   }).join('');
 }
 const glyph={row:'↔',col:'↕',star:'✦',bomb:'✹',orb:'◉'};
 function initBoard(){
   boardEl.replaceChildren();
   const frag=document.createDocumentFragment();
   for(let i=0;i<64;i++){
    const b=document.createElement('button');b.type='button';b.className='tile';b.dataset.i=i;
    b.setAttribute('role','gridcell');b.setAttribute('aria-label','퍼즐 '+(i+1));
    b.innerHTML='<img draggable="false" alt=""><span class="specialBadge" aria-hidden="true"></span>';
    frag.append(b);
   }
   boardEl.append(frag);
 }
 function renderBoard(){
   const nodes=boardEl.children;
   for(let i=0;i<64;i++){
    const b=nodes[i],t=game.board[i],s=game.specials[i];
    if(t<0){b.style.visibility='hidden';continue;}
    b.style.visibility='visible';
    b.dataset.type=t;b.classList.toggle('selected',game.selected===i);
    const img=b.firstElementChild,src=ART[SYMBOLS[t].key];
    if(img.src!==src)img.src=src;
    b.title=SYMBOLS[t].name+(s?' · '+s:'');
    b.lastElementChild.textContent=s?(glyph[s]||'✦'):'';
    b.classList.toggle('specialTile',!!s);
   }
 }
 function renderHUD(){
   $('trainerLevel').textContent='Lv.'+String(game.trainingLevel).padStart(2,'0');
   $('xpLabel').textContent='XP '+game.xp+' / '+(80*game.trainingLevel);
   $('hpText').textContent=game.hp+' / '+game.maxHP;
   $('hpFill').style.width=clamp(100*game.hp/game.maxHP,0,100)+'%';
   $('energyText').textContent=Math.floor(game.energy)+' / '+CFG.focusCost;
   $('energyFill').style.width=clamp(100*game.energy/CFG.focusCost,0,100)+'%';
   $('moveLabel').textContent='TURN '+String(game.turn).padStart(2,'0')+' · BEST CHAIN ×'+game.lastChain;
   $('turnLabel').textContent=game.stage==='playing'?(game.active==='PLAYER'?'YOUR TURN':'MEMBER TURN'):'SESSION';
   $('soundBtn').textContent=game.sound?'♪':'♩';
   $('boostBtn').disabled=game.energy<CFG.focusCost||game.focus||game.locked||game.stage!=='playing';
   $('boostState').textContent=game.focus?'READY':CFG.focusCost;
   $('statuspill').textContent=game.focus?'NEXT ATTACK ×'+CFG.focusMultiplier:
     game.active==='AI'?'회원이 같은 판에서 수를 두는 중':'일렬 3개 · 사각 4개도 매치';
 }
 function renderAll(){renderBoard();renderGoals();renderHUD();}
 function popup(x,y,text,kind=''){
   const p=document.createElement('div');p.className='burst '+kind;p.textContent=text;
   p.style.left=x+'px';p.style.top=y+'px';$('fxlayer').append(p);
   const a=p.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.45)'},
      {opacity:1,transform:'translate(-50%,-80%) scale(1.25)',offset:.37},
      {opacity:0,transform:'translate(-50%,-140%) scale(.9)'}],{duration:730,easing:'ease-out'});
   a.onfinish=()=>p.remove();
 }
 function effectFly(type,actor,index){
   const source=boardEl.children[index]?.getBoundingClientRect();if(!source)return;
   const target=(actor==='PLAYER'&&type!==4?panel:$('hpFill')).getBoundingClientRect();
   const x=source.x+source.width/2,y=source.y+source.height/2;
   const tx=target.x+target.width*.55,ty=target.y+target.height*.43;
   const targetPoint=actor==='PLAYER'&&type===4?$('hpFill').getBoundingClientRect():target;
   const xx=actor==='PLAYER'&&type===4?targetPoint.x+targetPoint.width/2:tx;
   const yy=actor==='PLAYER'&&type===4?targetPoint.y+targetPoint.height/2:ty;
   const projectile=document.createElement('img');projectile.className='fly';
   projectile.src=type===1?ART.heart:ART[SYMBOLS[type].key];
   projectile.style.left=(x-23)+'px';projectile.style.top=(y-23)+'px';
   $('fxlayer').append(projectile);
   projectile.animate([{transform:'translate(0,0) scale(.55)',opacity:.95},
     {transform:'translate('+(xx-x)+'px,'+(yy-y)+'px) scale(1.15)',opacity:.92,offset:.8},
     {transform:'translate('+(xx-x)+'px,'+(yy-y)+'px) scale(.45)',opacity:0}],
     {duration:390,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>{
      projectile.remove();
      if(actor==='AI'){popup(xx,yy,'− HP','impact');return;}
      const texts=['퍽!','♥','💋','ϟ','✚'],classes=['impact','heartfx','lipsfx','electric','healing'];
      popup(xx,yy,texts[type],classes[type]);
      if(type===3){setTimeout(()=>popup(xx-18,yy+12,'ϟ','electric'),90);setTimeout(()=>popup(xx+20,yy-7,'ϟ','electric'),180);}
      if(type!==4){panel.classList.remove('hit');void panel.offsetWidth;panel.classList.add('hit');}
   };
   if(actor==='PLAYER'){
    if(type===0){sound('hit');vibrate(28);}
    else if(type===3)sound('electric');
    else if(type===4)sound('heal');
    else sound('clear');
   }else sound('hit');
 }
 function burstClear(indices){
   const light=indices.length>18 || (matchMedia('(pointer:coarse)').matches&&indices.length>12);
   for(const i of indices){const b=boardEl.children[i];if(!b)continue;
    b.classList.add(light?'quickClear':'clearing');
   }
 }
 function clearAnimations(){for(const b of boardEl.children)b.classList.remove('clearing','quickClear','selected','swapping');}
 function animateFalls(falls){
   const yStep=boardEl.children[0]?.getBoundingClientRect().height + parseFloat(getComputedStyle(boardEl).rowGap||0);
   let longest=0;
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
   for(const f of falls){
    const btn=boardEl.children[f.to],travel=(Math.floor(f.to/8)-Math.floor(f.from/8))*yStep;
    if(!btn||travel<1)continue;
    const ms=Math.min(480,185+travel*.27),delay=Math.min(95,Math.floor(Math.random()*55));
    btn.animate([{transform:'translateY('+-travel+'px)',opacity:f.from<0?.7:1},
      {transform:'translateY(0)',opacity:1}],{duration:ms,delay,easing:'cubic-bezier(.17,.79,.3,1.02)'});
    longest=Math.max(longest,ms+delay);
   }
   return longest;
 }
 function animateSwap(a,b,reverse=false){
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return wait(30);
   const A=boardEl.children[a],B=boardEl.children[b],ar=A.getBoundingClientRect(),br=B.getBoundingClientRect();
   const dx=br.x-ar.x,dy=br.y-ar.y;
   return Promise.all([
     A.animate([{transform:'translate(0,0)'},{transform:'translate('+dx+'px,'+dy+'px)'}],
       {duration:140,easing:'ease-in-out'}).finished,
     B.animate([{transform:'translate(0,0)'},{transform:'translate('+-dx+'px,'+-dy+'px)'}],
       {duration:140,easing:'ease-in-out'}).finished
   ]).catch(()=>{});
 }
 async function resolveTurn(actor,swapped){
   let depth=0,first=true,total=0;
   while(depth<CFG.maxCascade&&game.stage==='playing'){
    const match=E.scan(game.board,first&&swapped?[swapped[1],swapped[0]]:[]);
    const specialSwap=first&&swapped&&(game.specials[swapped[0]]||game.specials[swapped[1]]);
    if(!match.indices.length&&!specialSwap)break;
    const result=E.effects(game.board,game.specials,first?swapped:null,match);
    if(!result.hit.length)break;
    // MoonSun Pang-style presentation: all matched glass breaks, while special
    // source tiles fire their own beam/zoom-shock. Effects never alter rules.
    FX.shards(result.hit.map(i=>({index:i,type:game.board[i]})));
    const strongCombo=result.combos.length>0;
    for(const group of match.groups){
      for(const pattern of group.patterns){
        if((pattern.dir==='row'||pattern.dir==='col')&&pattern.indices.length>=4){
          const center=pattern.indices[Math.floor(pattern.indices.length/2)];
          FX.laser(center,pattern.dir,pattern.indices.length>=5);
        }
      }
    }
    let specialAudio='';
    for(const i of result.fired){
      const kind=game.specials[i];
      if(kind==='row'||kind==='col'){FX.laser(i,kind,strongCombo);specialAudio||='laser';}
      else if(kind==='bomb'){FX.blast(i,true);specialAudio='blast';}
      else if(kind==='star'){FX.blast(i,false);specialAudio||='blast';}
      else if(kind==='orb'){FX.orb(i);specialAudio='blast';}
    }
    if(specialAudio)sound(specialAudio);
    if(strongCombo&&result.combos.some(c=>c.includes('bomb'))){
      FX.blast(swapped?.[1]??result.fired[0]??0,true);
    }
    depth++;total+=result.hit.length;
    const beforeTypes=new Map();
    for(const i of result.hit){const t=game.board[i];if(t>=0&&!beforeTypes.has(t))beforeTypes.set(t,i);}
    const values=E.applyClear(game.board,game.specials,result);
    const mult=1+(depth-1)*CFG.chainBonus;
    if(actor==='PLAYER'){
      for(let t=0;t<4;t++){
       const amount=Math.round(values[t]*CFG.perTile*mult*(1+(game.trainingLevel-1)*CFG.powerPerLevel)*(game.focus?CFG.focusMultiplier:1));
       game.meters[t]=Math.min(game.targets[t],game.meters[t]+amount);
      }
      game.hp=clamp(game.hp+values[4]*CFG.healPerTile,0,game.maxHP);
      game.energy=clamp(game.energy+result.hit.length*CFG.energyPerTile,0,CFG.focusCost);
      if(beforeTypes.has(0)||beforeTypes.has(1)||beforeTypes.has(2)||beforeTypes.has(3)){
       setPose(depth===1?2:1,1250);
       if(beforeTypes.has(0))GaiaAudio.react('surprise');
       else if(depth>1)GaiaAudio.react('tired');
      }else if(beforeTypes.has(4)){
       setPose(3,1200);GaiaAudio.react('happy');
      }
    }else{
      game.hp=clamp(game.hp-Math.max(3,Math.round(result.hit.length*CFG.damagePerTile*mult)),0,game.maxHP);
      setPose(1,1000);
    }
    if(depth>1){popup(innerWidth*.50,innerHeight*.46,'CHAIN ×'+depth,'heartfx');sound('clear');}
    for(const [t,pos] of beforeTypes)if(t!==4||actor==='PLAYER')effectFly(t,actor,pos);
    burstClear(result.hit);renderGoals();renderHUD();
    await wait(280);
    const falls=E.gravity(game.board,game.specials);
    clearAnimations();renderBoard();
    // The image data is already replaced in each of the 64 persistent DOM cells.
    // We animate from each origin slot using the actual gravity movement metadata.
    const duration=animateFalls(falls);
    await wait(Math.max(120,duration+18));
    first=false;
   }
   game.lastChain=Math.max(game.lastChain,depth);
   game.totalCleared+=total;
   if(depth>=CFG.maxCascade){game.board=E.newBoard();game.specials.fill(null);renderBoard();toast('긴 연쇄 · 새 보드 준비');}
   if(!E.legalMoves(game.board,game.specials).length){game.board=E.newBoard();game.specials.fill(null);renderBoard();toast('NO MOVES · SHUFFLE');}
   if(depth>1)toast('CHAIN ×'+depth+' · '+total+' TILES');
   return depth;
 }
 async function move(a,b,actor){
   if(game.locked||game.stage!=='playing'||!E.adjacent(a,b))return false;
   const special=!!(game.specials[a]||game.specials[b]);
   E.swap(game.board,a,b);E.swap(game.specials,a,b);
   const match=E.scan(game.board,[b,a]);
   if(!special&&!match.indices.length){
    E.swap(game.board,a,b);E.swap(game.specials,a,b);
    await animateSwap(a,b);sound('swap');return false;
   }
   game.locked=true;game.selected=-1;renderHUD();
   // Show movement first with old sprites, then reveal their swapped contents.
   E.swap(game.board,a,b);E.swap(game.specials,a,b);
   await animateSwap(a,b);
   E.swap(game.board,a,b);E.swap(game.specials,a,b);
   sound('swap');renderBoard();
   await wait(45);
   if(actor==='PLAYER')game.turn++;
   await resolveTurn(actor,[a,b]);
   if(game.stage!=='playing')return true;
   if(game.hp<=0){finish(false);return true;}
   if(game.meters.every((v,i)=>v>=game.targets[i])){finish(true);return true;}
   if(actor==='PLAYER'){
     game.focus=false;
     game.active='AI';renderHUD();await wait(420);
     const moves=E.legalMoves(game.board,game.specials);
     if(!moves.length){game.board=E.newBoard();game.specials.fill(null);renderBoard();}
     else{
       moves.sort((x,y)=>(y.size+3*y.made+(y.special?7:0))-(x.size+3*x.made+(x.special?7:0)));
       const skill=MEMBERS[game.memberIndex].aiSkill;
       const best=Math.random()<skill?moves[0]:moves[Math.floor(Math.random()*moves.length)];
       game.locked=false;
       await move(best.a,best.b,'AI');
     }
     if(game.stage!=='playing')return true;
     game.active='PLAYER';
   }
   game.locked=false;renderAll();
   return true;
 }
 function finish(win){
   game.stage=win?'win':'lose';game.locked=true;game.active='END';
   if(win){
     setPose(3);
     const xp=26+game.memberIndex*17;game.xp+=xp;game.wins++;
     let ups=0;while(game.xp>=80*game.trainingLevel){game.xp-=80*game.trainingLevel;game.trainingLevel++;ups++;}
     save();renderHUD();
     showModal('<div class="modalbrand">GAIA CITY · EXCLUSIVE WELLNESS</div><h1 class="modaltitle">SESSION COMPLETE</h1>'+
      '<p class="modaldesc">요구 수치 네 가지 모두 충족!<br>TURN '+game.turn+' · XP +'+xp+(ups?' · LEVEL UP!':'')+'</p>'+
      '<div class="modalactions"><button class="goldbtn primary" data-action="next">NEXT MEMBER</button>'+
      '<button class="goldbtn" data-action="retry">다시 도전</button><button class="goldbtn" data-action="menu">회원 선택</button></div>');
   }else{
     setPose(1);
     showModal('<div class="modalbrand">GAIA CITY · EXCLUSIVE WELLNESS</div><h1 class="modaltitle">SESSION ENDED</h1>'+
      '<p class="modaldesc">트레이너 체력이 모두 소진됐습니다.</p><div class="modalactions">'+
      '<button class="goldbtn primary" data-action="retry">RETRY</button><button class="goldbtn" data-action="menu">회원 선택</button></div>');
   }
 }
 function start(index){
   GaiaAudio.selectScene(index===0?'one':'two',true);
   game.memberIndex=index;game.targets=MEMBERS[index].goals.slice();game.meters=[0,0,0,0];
   game.hp=CFG.hpBase+(game.trainingLevel-1)*CFG.hpPerLevel;game.maxHP=game.hp;
   game.energy=0;game.focus=false;game.turn=0;game.active='PLAYER';game.stage='playing';
   game.locked=false;game.selected=-1;game.totalCleared=0;game.lastChain=0;
   game.board=E.newBoard();game.specials=Array(64).fill(null);
   FX.clear();
   hideModal();memberInfo();renderAll();toast('SESSION START · '+MEMBERS[index].name);
 }
 function showMenu(){
   GaiaAudio.selectScene('menu');
   game.stage='menu';game.locked=true;
   showModal('<div class="modalbrand">GAIA CITY · EXCLUSIVE WELLNESS</div><h1 class="modaltitle">WELLNESS ROYALE</h1>'+
    '<p class="modaldesc">고급 웰니스 센터의 프라이빗 매치 세션<br>회원의 네 가지 요구치를 모두 채우세요.</p>'+
    '<div class="membercards">'+MEMBERS.map((m,i)=>'<button class="membercard'+(i===menuChoice?' sel':'')+'" type="button" data-member="'+i+'">'+
     '<img alt="회원 '+(i+1)+'" src="'+ART.poses[i][0]+'"><span class="caption">'+m.name+'<br>'+m.rank+'</span></button>').join('')+'</div>'+
    '<div class="modalactions"><button class="goldbtn primary" data-action="start">SESSION START</button>'+
    '<button class="goldbtn" data-action="rules">규칙 보기</button></div>'+
    '<p class="smallnote">8×8 공유 퍼즐 · 2×2 사각 · 특수블록 · 교차 폭탄 · 낙하 연쇄 · 자동 저장<br>BGM 90 / 120 / 150 BPM · 터치하면 재생</p>');
 }
 boardEl.addEventListener('pointerdown',e=>{
   const b=e.target.closest('.tile');
   if(!b||game.locked||game.active!=='PLAYER'||game.stage!=='playing')return;
   press={index:+b.dataset.i,x:e.clientX,y:e.clientY};
   try{b.setPointerCapture(e.pointerId);}catch(err){}
   if(game.sound){try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume?.();}catch(err){}}
 });
 boardEl.addEventListener('pointerup',e=>{
   if(!press)return;const {index:a,x,y}=press;press=null;
   if(game.locked||game.active!=='PLAYER'||game.stage!=='playing')return;
   const dx=e.clientX-x,dy=e.clientY-y;
   if(Math.max(Math.abs(dx),Math.abs(dy))>13){
     const b=Math.abs(dx)>Math.abs(dy)?a+(dx>0?1:-1):a+(dy>0?8:-8);
     if(E.adjacent(a,b))move(a,b,'PLAYER');return;
   }
   if(game.selected>=0&&E.adjacent(game.selected,a)){move(game.selected,a,'PLAYER');return;}
   game.selected=game.selected===a?-1:a;renderBoard();
 });
 boardEl.addEventListener('pointercancel',()=>{press=null;});
 $('boostBtn').addEventListener('click',()=>{
   if(game.locked||game.energy<CFG.focusCost||game.focus)return;
   game.energy=0;game.focus=true;renderHUD();sound('heal');toast('FOCUS BOOST · 다음 수의 공격 강화');
 });
 $('soundBtn').addEventListener('click',()=>{
  game.sound=!game.sound;GaiaAudio.setEnabled(game.sound);
  if(game.sound)GaiaAudio.selectScene(game.stage==='menu'?'menu':game.memberIndex===0?'one':'two',true);
  save();renderHUD();
 });
 $('restartBtn').addEventListener('click',()=>{if(game.stage==='playing')showModal('<h1 class="modaltitle">RESTART?</h1><p class="modaldesc">현재 세션의 진행을 초기화합니다.</p><div class="modalactions"><button class="goldbtn primary" data-action="retry">다시 시작</button><button class="goldbtn" data-action="resume">취소</button></div>');});
 $('settingsBtn').addEventListener('click',()=>showModal('<div class="modalbrand">GAME RULES</div><h1 class="modaltitle">ROYAL MATCH</h1><p class="modaldesc">'+
  '같은 종류 3개 이상 또는 2×2 사각 4개를 연결합니다.<br>4개=한 줄 공격 · 5개=같은 종류 전체 · 사각=3×3 · T/L=5×5<br>'+ 
  '특수블록 둘을 합치면 강력한 연계 효과가 발동합니다.<br>AI도 같은 판에서 매치하며, AI 매치 시 체력이 감소합니다.<br>'+ 
  '승리 조건은 네 요구치 각각 모두 충족. 하트로 HP를 회복합니다.</p>'+
  '<div class="modalactions"><button class="goldbtn primary" data-action="resume">돌아가기</button><button class="goldbtn" data-action="menu">회원 선택</button></div>'));
 modalContent.addEventListener('click',e=>{
   const m=e.target.closest('[data-member]');if(m){menuChoice=+m.dataset.member;showMenu();GaiaAudio.selectScene('menu',true);return;}
   const action=e.target.closest('[data-action]')?.dataset.action;
   if(action==='start')start(menuChoice);
   else if(action==='retry')start(game.memberIndex);
   else if(action==='next')start((game.memberIndex+1)%MEMBERS.length);
   else if(action==='menu'){showMenu();GaiaAudio.selectScene('menu',true);}
   else if(action==='resume')hideModal();
   else if(action==='rules')$('settingsBtn').click();
 });
 initBoard();memberInfo();renderAll();showMenu();
 window.GAIA_DEBUG={E,game,CFG,MEMBERS,start,move,renderBoard,audio:GaiaAudio};
})();
