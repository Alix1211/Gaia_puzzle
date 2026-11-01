/* GAIA ROYALE v0.4: offline soundtrack and short recorded SFX.
   Audio files are embedded as data URIs by build-gaia-v04.mjs. */
const GaiaAudio=(()=>{
 'use strict';
 const tracks={menu:'__BGM90__',one:'__BGM120__',two:'__BGM150__'};
 const effects={
  slap1:'__SLAP1__',slap2:'__SLAP2__',slap3:'__SLAP3__',
  surprise:'__REACTSURPRISE__',happy:'__REACTHAPPY__',tired:'__REACTTIRED__'
 };
 let enabled=true,unlocked=false,scene='menu',current='',music=null;
 let bgmVolume=.32,effectsVolume=1;
 let slapIndex=0,lastVoice=0;
 const pools=new Map();
 let fxContext=null,fxMaster=null,decodeStarted=false;
 const fxBuffers=new Map();
 const available=()=>typeof Audio==='function';
 function unlock(){
  unlocked=true;
  try{
   const Context=window.AudioContext||window.webkitAudioContext;
   if(!Context)return;
   if(!fxContext){
    fxContext=new Context();fxMaster=fxContext.createGain();
    fxMaster.gain.value=enabled?effectsVolume:0;fxMaster.connect(fxContext.destination);
   }
   if(fxContext.state==='suspended')fxContext.resume().catch(()=>{});
   if(!decodeStarted){
    decodeStarted=true;
    for(const [name,uri] of Object.entries(effects)){
     try{
      const raw=atob(uri.slice(uri.indexOf(',')+1));
      const bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      fxContext.decodeAudioData(bytes.buffer).then(buffer=>fxBuffers.set(name,buffer)).catch(()=>{});
     }catch(err){}
    }
   }
  }catch(err){}
 }
 function makeMusic(){
  if(!available())return null;
  if(!music){
   music=new Audio();music.loop=true;music.preload='none';
   music.volume=bgmVolume;music.setAttribute?.('aria-hidden','true');
  }
  return music;
 }
 function selectScene(next,gesture=false){
  if(!(next in tracks))return;
  scene=next;
  if(gesture)unlock();
  const player=makeMusic();
  if(!player)return;
  if(current!==scene){
   player.pause();player.src=tracks[scene];current=scene;
  }
  if(!enabled||!unlocked)return;
  try{
   const p=player.play();p?.catch?.(()=>{});
  }catch(err){}
 }
 function setEnabled(state){
  enabled=!!state;
  if(fxMaster)fxMaster.gain.value=enabled?effectsVolume:0;
  if(!enabled){
   music?.pause();
   for(const voices of pools.values())for(const a of voices)a.pause();
  }
 }
 function setVolumes(bgm,fx){
  bgmVolume=Math.max(0,Math.min(1,Number(bgm)||0));
  effectsVolume=Math.max(0,Math.min(1,Number(fx)||0));
  if(music)music.volume=bgmVolume;
  if(fxMaster)fxMaster.gain.value=enabled?effectsVolume:0;
  for(const voices of pools.values())for(const a of voices)a.volume=Math.min(1,effectsVolume*(a._baseVolume||.55));
 }
 function playFx(name,volume=.55){
  if(!enabled||!unlocked||!effects[name])return false;
  try{
   const buffer=fxBuffers.get(name);
   if(buffer&&fxContext&&fxContext.state==='running'){
    const source=fxContext.createBufferSource(),gain=fxContext.createGain();
    source.buffer=buffer;gain.gain.value=volume;
    source.connect(gain);gain.connect(fxMaster);source.start();
    return true;
   }
   if(!available())return false;
   let voices=pools.get(name);
   if(!voices){
    voices=Array.from({length:2},()=>{
     const a=new Audio(effects[name]);a.preload='auto';return a;
    });
    pools.set(name,voices);
   }
   const a=voices.find(v=>v.paused||v.ended)||voices[0];
   a._baseVolume=volume;a.volume=volume*effectsVolume;
   try{a.currentTime=0;}catch(err){}
   const p=a.play();p?.catch?.(()=>{});
   return true;
  }catch(err){return false;}
 }
 function slap(){
  slapIndex=(slapIndex+1)%3;
  playFx('slap'+(slapIndex+1),.7);
 }
 function react(name){
  const now=Date.now();
  if(now-lastVoice<4400)return;
  if(playFx(name,.32))lastVoice=now;
 }
 function getState(){return {enabled,unlocked,scene,playing:!!music&&!music.paused,bgmVolume,effectsVolume};}
 return {selectScene,setEnabled,setVolumes,unlock,playFx,slap,react,getState};
})();
