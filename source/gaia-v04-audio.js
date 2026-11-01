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
 let slapIndex=0,lastVoice=0;
 const pools=new Map();
 const available=()=>typeof Audio==='function';
 function makeMusic(){
  if(!available())return null;
  if(!music){
   music=new Audio();music.loop=true;music.preload='none';
   music.volume=.32;music.setAttribute?.('aria-hidden','true');
  }
  return music;
 }
 function selectScene(next,gesture=false){
  if(!(next in tracks))return;
  scene=next;
  if(gesture)unlocked=true;
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
  if(!enabled){
   music?.pause();
   for(const voices of pools.values())for(const a of voices)a.pause();
  }
 }
 function playFx(name,volume=.55){
  if(!enabled||!unlocked||!available()||!effects[name])return false;
  try{
   let voices=pools.get(name);
   if(!voices){
    voices=Array.from({length:2},()=>{
     const a=new Audio(effects[name]);a.preload='auto';return a;
    });
    pools.set(name,voices);
   }
   const a=voices.find(v=>v.paused||v.ended)||voices[0];
   a.volume=volume;
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
 function getState(){return {enabled,unlocked,scene,playing:!!music&&!music.paused};}
 return {selectScene,setEnabled,playFx,slap,react,getState};
})();
