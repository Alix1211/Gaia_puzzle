/* Browser controller: GaiaEngine is embedded immediately before this script. */
(() => {
 'use strict';
 const ART={
   paddle:'__PADDLE__',dildo:'__DILDO__',lips:'__LIPS__',gag:'__GAG__',heart:'__HEART__',
   poses:__ALL_MEMBER_POSES__
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
 const MEMBERS=GaiaMembers;
 const TIERS=[['ALL','전체'],['SPECIAL','특별'],['STANDARD','루키'],['SILVER','실버'],
   ['GOLD','골드'],['PLATINUM','VIP'],['DIAMOND','VVIP']];
 const CFG={perTile:3,chainBonus:.23,damagePerTile:1.35,healPerTile:4,
  energyPerTile:1.9,focusCost:60,focusMultiplier:1.65,
  hpBase:225,hpPerLevel:6,powerPerLevel:.035,maxCascade:28};
 const nextXP=level=>80+38*(level-1);
 const attackPower=level=>Math.round(100*(1+(level-1)*CFG.powerPerLevel));
 const sceneFor=index=>index===0?'one':index===1?'two':MEMBERS[index].tier==='STANDARD'||MEMBERS[index].tier==='SILVER'?'one':'two';
 const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
 const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
 const panel=$('portraitPanel'),portrait=$('portrait'),boardEl=$('board'),modal=$('modal'),modalContent=$('modalContent');
 const FX=createGaiaBoardFx(boardEl);
 const game={board:E.newBoard(),specials:Array(64).fill(null),meters:[0,0,0,0],targets:[0,0,0,0],
   memberIndex:0,trainingLevel:1,xp:0,wins:0,sound:true,bgmVolume:.32,fxVolume:1,hp:225,maxHP:225,
   energy:0,focus:false,turn:0,active:'PLAYER',locked:true,stage:'menu',selected:-1,
   totalCleared:0,lastChain:0,memberWins:Array(24).fill(0)};
 let audioCtx=null,poseTimer=null,toastTimer=null,menuChoice=0,menuFilter='ALL',press=null;
 const lineEl=$('portraitLine'),electricCanvas=$('electricCanvas');
 let lineTimer=null,lastLineKey='',lastSpokenAt=0,electricTick=0;
 // The two protagonists ALWAYS track trainer level. Other 22 members keep fixed levels.
 function memberStats(index){
  const base=MEMBERS[index];
  if(index>1)return base;
  const level=game.trainingLevel+(index===1?5:0);
  const growth=attackPower(level)/attackPower(base.level);
  const hpGrowth=(CFG.hpBase+(level-1)*CFG.hpPerLevel)/(CFG.hpBase+(base.level-1)*CFG.hpPerLevel);
  return {...base,level,goals:base.goals.map(v=>Math.max(1,Math.round(v*growth))),
    aiSkill:clamp(base.aiSkill+(level-base.level)*.0025,0,.98),aiPower:base.aiPower*hpGrowth};
 }
 function say(event,force=false){
  const now=Date.now();
  if(!force&&now-lastSpokenAt<1450)return;
  const lines=GaiaDialogues[String(MEMBERS[game.memberIndex].id)]?.[event];
  if(!lines?.length)return;
  const previous=lastLineKey.split(':')[1];
  let index=Math.floor(Math.random()*lines.length);
  if(lines.length>1&&String(index)===previous)index=(index+1)%lines.length;
  lastLineKey=event+':'+index;lastSpokenAt=now;
  lineEl.textContent=lines[index];
  lineEl.classList.add('show');
  clearTimeout(lineTimer);lineTimer=setTimeout(()=>lineEl.classList.remove('show'),2500);
 }
 try{
   const saved=JSON.parse(localStorage.getItem('gaia-royale-v02')||'{}');
   game.trainingLevel=clamp(+saved.level||1,1,99);
   game.xp=clamp(+saved.xp||0,0,99999);
   game.wins=clamp(+saved.wins||0,0,99999);
   game.sound=saved.sound!==false;
   if(Number.isFinite(+saved.bgmVolume))game.bgmVolume=clamp(+saved.bgmVolume,0,1);
   if(Number.isFinite(+saved.fxVolume))game.fxVolume=clamp(+saved.fxVolume,0,1);
   if(Array.isArray(saved.memberWins))game.memberWins=MEMBERS.map((_,i)=>clamp(+saved.memberWins[i]||0,0,99999));
 }catch(err){}
 GaiaAudio.setEnabled(game.sound);
 GaiaAudio.setVolumes(game.bgmVolume,game.fxVolume);
 function save(){try{localStorage.setItem('gaia-royale-v02',JSON.stringify({
  level:game.trainingLevel,xp:game.xp,wins:game.wins,sound:game.sound,
  bgmVolume:game.bgmVolume,fxVolume:game.fxVolume,memberWins:game.memberWins}));}catch(err){}}
 function showModal(html){modalContent.innerHTML=html;modal.classList.remove('hidden');}
 function hideModal(){modal.classList.add('hidden');}
 function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');
   clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1500);}
 function sound(kind){
  if(!game.sound||game.fxVolume<=0)return;
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
    gain.gain.setValueAtTime(vol*game.fxVolume,now+.055*k);
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
   const m=memberStats(game.memberIndex);
   $('memberName').textContent=m.name;
   $('memberRank').textContent=m.rank+' · Lv.'+m.level+(game.memberIndex<2?' (트레이너 연동)':' 권장');
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
   $('xpLabel').textContent='XP '+game.xp+' / '+nextXP(game.trainingLevel);
   $('trainerAttack').textContent='ATK '+attackPower(game.trainingLevel);
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
 function strikeLightning(){
   const c=electricCanvas,rect=panel.getBoundingClientRect();
   if(rect.width<1||rect.height<1)return;
   const dpr=Math.min(devicePixelRatio||1,1.5);
   c.width=Math.round(rect.width*dpr);c.height=Math.round(rect.height*dpr);
   const ctx=c.getContext('2d');if(!ctx)return;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   const W=rect.width,H=rect.height,token=++electricTick;
   panel.classList.remove('electroHit');void panel.offsetWidth;panel.classList.add('electroHit');
   function bolt(x1,y1,x2,y2,branch=false){
     const points=[[x1,y1]],segments=branch?5:10;
     for(let i=1;i<segments;i++){
       const t=i/segments;
       points.push([x1+(x2-x1)*t+(Math.random()-.5)*W*(branch?.11:.20),
         y1+(y2-y1)*t+(Math.random()-.5)*H*.07]);
     }
     points.push([x2,y2]);
     const trace=()=>{ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
       for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);};
     trace();ctx.strokeStyle=branch?'#29baff':'#4a9fff';ctx.lineWidth=branch?3:7;
     ctx.shadowColor='#46caff';ctx.shadowBlur=25;ctx.stroke();
     trace();ctx.strokeStyle='#e9ffff';ctx.lineWidth=branch?1.25:2.3;
     ctx.shadowColor='#eaffff';ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;
     if(!branch){
       for(const n of [3,6]){
         const p=points[n];if(!p)continue;
         bolt(p[0],p[1],p[0]+(Math.random()-.5)*W*.45,p[1]+H*(.13+Math.random()*.24),true);
       }
     }
   }
   const start=performance.now();let last=-100;
   function flash(now){
     if(token!==electricTick)return;
     const elapsed=now-start;
     if(elapsed>690){ctx.clearRect(0,0,W,H);panel.classList.remove('electroHit');return;}
     if(now-last>=45){
       last=now;ctx.clearRect(0,0,W,H);
       if(Math.random()>.14){
         ctx.fillStyle='rgba(73,166,239,.09)';ctx.fillRect(0,0,W,H);
         const count=2+(Math.random()>.62?1:0);
         for(let i=0;i<count;i++)bolt(W*(.15+.7*Math.random()),-H*.04,W*(.12+.76*Math.random()),H*(.85+.15*Math.random()));
       }
     }
     requestAnimationFrame(flash);
   }
   requestAnimationFrame(flash);
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
      const texts=['퍽!','♥','💋',null,'✚'],classes=['impact','heartfx','lipsfx','','healing'];
      if(type===3)strikeLightning();
      else{
       popup(xx,yy,texts[type],classes[type]);
       if(type!==4){panel.classList.remove('hit');void panel.offsetWidth;panel.classList.add('hit');}
      }
   };
   if(actor==='PLAYER'){
    if(type===0)vibrate(28);
    else if(type===3)sound('electric');
    else if(type===4)sound('heal');
    else sound('clear');
   }
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
    // The recorded slap/thump belongs to the tiles' enlargement/break moment.
    // Play once per cascade (not once per flying icon or per individual tile).
    sound('hit');
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
       say(depth>1?'chain':'hit',depth>1);
       if(beforeTypes.has(0))GaiaAudio.react('surprise');
       else if(depth>1)GaiaAudio.react('tired');
      }else if(beforeTypes.has(4)){
       setPose(3,1200);GaiaAudio.react('happy');
       say('heal');
      }
    }else{
      game.hp=clamp(game.hp-Math.max(3,Math.round(result.hit.length*CFG.damagePerTile*mult*memberStats(game.memberIndex).aiPower)),0,game.maxHP);
      setPose(1,1000);
      say('counter');
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
       const skill=memberStats(game.memberIndex).aiSkill;
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
     const firstClear=game.memberWins[game.memberIndex]===0;
     const xp=MEMBERS[game.memberIndex].xp+(firstClear?20:0);
     game.xp+=xp;game.wins++;game.memberWins[game.memberIndex]++;
     let ups=0;
     while(game.trainingLevel<99&&game.xp>=nextXP(game.trainingLevel)){
       game.xp-=nextXP(game.trainingLevel);game.trainingLevel++;ups++;
     }
     save();renderHUD();
     showModal('<div class="modalbrand">GAIA CITY · EXCLUSIVE WELLNESS</div><h1 class="modaltitle">SESSION COMPLETE</h1>'+
      '<p class="modaldesc">'+MEMBERS[game.memberIndex].name+' · 요구치 네 가지 달성!<br>TURN '+game.turn+' · XP +'+xp+
      (firstClear?' (첫 완료 보너스 포함)':'')+(ups?' · LEVEL UP! ATK '+attackPower(game.trainingLevel):'')+'</p>'+
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
   if(!Number.isInteger(index)||index<0||index>=MEMBERS.length)return;
   GaiaAudio.unlock();
   GaiaAudio.selectScene(sceneFor(index),true);
   game.memberIndex=index;game.targets=memberStats(index).goals.slice();game.meters=[0,0,0,0];
   game.hp=CFG.hpBase+(game.trainingLevel-1)*CFG.hpPerLevel;game.maxHP=game.hp;
   game.energy=0;game.focus=false;game.turn=0;game.active='PLAYER';game.stage='playing';
   game.locked=false;game.selected=-1;game.totalCleared=0;game.lastChain=0;
   game.board=E.newBoard();game.specials=Array(64).fill(null);
   FX.clear();
   electricTick++;panel.classList.remove('electroHit');
   lineEl.classList.remove('show');clearTimeout(lineTimer);
   hideModal();memberInfo();renderAll();toast('SESSION START · '+MEMBERS[index].name);
   say('intro',true);
 }
 function renderMenuPreview(){
   const m=memberStats(menuChoice),preview=$('memberPreview');if(!preview)return;
   preview.innerHTML='<img class="roster-hero" src="'+ART.poses[menuChoice][0]+'" alt="'+m.name+'">'+
    '<div class="roster-details"><div class="roster-rank">'+m.rank+'</div><h2>'+m.name+' <small>'+m.age+'세</small></h2>'+
    '<p class="roster-job">'+m.job+'</p><p class="roster-personality">'+m.personality+'</p>'+
    '<p class="roster-profile">'+m.profile+'</p><div class="roster-meta">'+
    '<span>권장 Lv.'+m.level+'</span><span>마조력 '+m.maso+'/10</span><span>AI '+Math.round(m.aiSkill*100)+'</span></div>'+
    '<div class="roster-goals">'+m.goals.map((v,i)=>'<div><span>'+SYMBOLS[i].name+'</span><strong>'+v+'</strong></div>').join('')+'</div>'+
    '<p class="roster-record">'+(game.memberWins[menuChoice]?'클리어 완료 · ':'미클리어 · ')+'세션 완료 '+game.memberWins[menuChoice]+'회 · 승리 XP '+m.xp+
    (m.id===2?' · 오너 특별관리 무료':m.id===1?' · 전속 세션':'')+'</p></div>';
 }
 function renderMenuRoster(){
   const visible=MEMBERS.map((_,i)=>({...memberStats(i),index:i})).filter(m=>menuFilter==='ALL'||m.tier===menuFilter);
   if(!visible.some(m=>m.index===menuChoice))menuChoice=visible[0].index;
   $('rosterTabs').innerHTML=TIERS.map(([key,label])=>'<button class="roster-tab'+
    (key===menuFilter?' active':'')+'" data-filter="'+key+'" type="button">'+label+'</button>').join('');
   const lockIcon='<span class="member-lock" aria-hidden="true"><svg viewBox="0 0 28 32"><path d="M7 13V9a7 7 0 0 1 14 0v4h-4V9a3 3 0 0 0-6 0v4Z"/><rect x="3" y="13" width="22" height="17" rx="3"/><circle cx="14" cy="21" r="2" fill="#31210a"/><path d="M14 23v3" stroke="#31210a" stroke-width="2"/></svg></span>';
   $('memberCards').innerHTML=visible.map(m=>{
    const unbeaten=game.memberWins[m.index]===0;
    return '<button class="membercard'+(m.index===menuChoice?' sel':'')+(unbeaten?' unbeaten':'')+
    '" type="button" data-member="'+m.index+'" aria-label="'+m.name+', '+(unbeaten?'미클리어':'클리어')+'"><img loading="lazy" alt="'+m.name+'" src="'+ART.poses[m.index][0]+'">'+
    (unbeaten?lockIcon:'')+
    '<span class="caption"><strong>'+m.name+'</strong><small>Lv.'+m.level+' · '+m.rank.split(' · ')[0]+'</small></span></button>';
   }).join('');
   renderMenuPreview();
 }
 function showMenu(){
   GaiaAudio.selectScene('menu');
   game.stage='menu';game.locked=true;
   electricTick++;panel.classList.remove('electroHit');lineEl.classList.remove('show');clearTimeout(lineTimer);
   showModal('<div class="modalbrand">GAIA CITY · EXCLUSIVE WELLNESS</div><h1 class="modaltitle">WELLNESS ROYALE</h1>'+
    '<p class="modaldesc">24명 회원의 요구치 네 가지를 달성하세요. 반복 세션으로 레벨·공격력·체력이 성장합니다.</p>'+
    '<div class="roster-layout"><div class="roster-left"><div class="roster-tabs" id="rosterTabs"></div>'+
    '<div class="membercards" id="memberCards"></div></div><aside class="member-preview" id="memberPreview"></aside></div>'+
    '<div class="modalactions"><button class="goldbtn primary" data-action="start">SESSION START</button>'+
    '<button class="goldbtn" data-action="rules">규칙 보기</button></div>'+
    '<p class="smallnote">트레이너 Lv.'+game.trainingLevel+' · ATK '+attackPower(game.trainingLevel)+' · '+game.wins+
    '승 · 저장 기록 유지 · 권장 레벨은 입장 제한이 아닌 난이도 안내입니다.</p>');
   renderMenuRoster();
 }
 boardEl.addEventListener('pointerdown',e=>{
   const b=e.target.closest('.tile');
   if(!b||game.locked||game.active!=='PLAYER'||game.stage!=='playing')return;
   press={index:+b.dataset.i,x:e.clientX,y:e.clientY};
   GaiaAudio.unlock();
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
  if(game.sound)GaiaAudio.selectScene(game.stage==='menu'?'menu':sceneFor(game.memberIndex),true);
  save();renderHUD();
 });
 $('restartBtn').addEventListener('click',()=>{if(game.stage==='playing')showModal('<h1 class="modaltitle">RESTART?</h1><p class="modaldesc">현재 세션의 진행을 초기화합니다.</p><div class="modalactions"><button class="goldbtn primary" data-action="retry">다시 시작</button><button class="goldbtn" data-action="resume">취소</button></div>');});
 function updateFullscreenButton(){
  const active=!!(document.fullscreenElement||document.webkitFullscreenElement),btn=$('fullscreenBtn');
  btn.textContent=active?'⤢':'⛶';btn.title=active?'전체화면 종료':'전체화면';btn.setAttribute('aria-label',btn.title);
 }
 $('fullscreenBtn').addEventListener('click',async()=>{
  try{
   if(document.fullscreenElement||document.webkitFullscreenElement){
    if(document.exitFullscreen)await document.exitFullscreen();
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
   }else if(document.documentElement.requestFullscreen){
    await document.documentElement.requestFullscreen({navigationUI:'hide'});
   }else if(document.documentElement.webkitRequestFullscreen){
    document.documentElement.webkitRequestFullscreen();
   }else toast('이 브라우저는 전체화면을 지원하지 않습니다');
  }catch(err){toast('전체화면 전환이 제한되었습니다');}
  updateFullscreenButton();
 });
 document.addEventListener('fullscreenchange',updateFullscreenButton);
 document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
 function showSettings(){
  const bgm=Math.round(game.bgmVolume*100),fx=Math.round(game.fxVolume*100);
  showModal('<div class="modalbrand">GAIA · AUDIO & RULES</div><h1 class="modaltitle">SETTINGS</h1>'+
   '<div class="audioTuning">'+
   '<label for="bgmVolume"><span>배경음악 <output id="bgmVolumeValue">'+bgm+'%</output></span>'+
   '<input id="bgmVolume" data-volume="bgm" type="range" min="0" max="100" step="1" value="'+bgm+'"></label>'+
   '<label for="fxVolume"><span>효과음 <output id="fxVolumeValue">'+fx+'%</output></span>'+
   '<input id="fxVolume" data-volume="fx" type="range" min="0" max="100" step="1" value="'+fx+'"></label></div>'+
   '<p class="modaldesc">같은 종류 3개 이상 또는 2×2 사각 4개를 연결합니다.<br>'+
   '4개=한 줄 공격 · 5개=같은 종류 전체 · 사각=3×3 · T/L=5×5<br>'+
   '특수블록을 조합하면 강한 연쇄 효과가 발동합니다.<br>'+
   'AI도 같은 판에서 매치하며, 승리하려면 네 요구치를 모두 채워야 합니다.</p>'+
   '<div class="modalactions"><button class="goldbtn primary" data-action="resume">돌아가기</button>'+
   '<button class="goldbtn" data-action="menu">회원 선택</button></div>');
 }
 $('settingsBtn').addEventListener('click',showSettings);
 modalContent.addEventListener('input',e=>{
  const kind=e.target?.dataset?.volume;
  if(kind!=='bgm'&&kind!=='fx')return;
  const value=clamp(Number(e.target.value)||0,0,100);
  if(kind==='bgm')game.bgmVolume=value/100;
  else game.fxVolume=value/100;
  const output=$(kind==='bgm'?'bgmVolumeValue':'fxVolumeValue');
  if(output)output.textContent=value+'%';
  GaiaAudio.setVolumes(game.bgmVolume,game.fxVolume);save();
 });
 modalContent.addEventListener('click',e=>{
   const filter=e.target.closest('[data-filter]');
   if(filter){menuFilter=filter.dataset.filter;renderMenuRoster();GaiaAudio.selectScene('menu',true);return;}
   const m=e.target.closest('[data-member]');
   if(m){menuChoice=+m.dataset.member;
     for(const card of $('memberCards').children)card.classList.toggle('sel',+card.dataset.member===menuChoice);
     renderMenuPreview();GaiaAudio.selectScene('menu',true);return;}
   const action=e.target.closest('[data-action]')?.dataset.action;
   if(action==='start')start(menuChoice);
   else if(action==='retry')start(game.memberIndex);
   else if(action==='next')start((game.memberIndex+1)%MEMBERS.length);
   else if(action==='menu'){showMenu();GaiaAudio.selectScene('menu',true);}
   else if(action==='resume')hideModal();
   else if(action==='rules')showSettings();
 });
 initBoard();memberInfo();renderAll();updateFullscreenButton();showMenu();
 window.GAIA_DEBUG={E,game,CFG,MEMBERS,start,move,renderBoard,attackPower,nextXP,audio:GaiaAudio};
})();
