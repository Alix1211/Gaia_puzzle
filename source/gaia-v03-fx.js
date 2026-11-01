/* MoonSun Pang-inspired lightweight 2D canvas FX: beams, shockwaves and glass.
 * Independent from the 64 persistent DOM tiles; no per-frame DOM mutation.
 * Maximum 72 debris particles, capped mobile DPR, one RAF only while active. */
function createGaiaBoardFx(boardEl){
  const palette=['#efc47b','#f9d993','#ecb9e8','#9be0ee','#8cf3b3'];
  const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let box=null,canvas=null,ctx=null,raf=0,dpr=1,w=0,h=0;
  const events=[];
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  function setup(){
    if(reduce())return false;
    box=boardEl.parentElement;
    if(!box)return false;
    if(!canvas){
      canvas=document.createElement('canvas');canvas.id='boardFx';canvas.setAttribute('aria-hidden','true');
      box.append(canvas);
      // Android Chrome can composite a desynchronized 2D overlay as opaque black.
      // Standard alpha-backed canvas keeps the board visible under the FX layer.
      ctx=canvas.getContext?.('2d',{alpha:true});
    }
    if(!ctx)return false;
    const rect=box.getBoundingClientRect();
    const scale=Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.1:1.5);
    if(rect.width!==w||rect.height!==h||scale!==dpr){
      w=rect.width;h=rect.height;dpr=scale;
      canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    return true;
  }
  function tile(i){
    const cell=boardEl.children[i],r=cell?.getBoundingClientRect(),outer=box?.getBoundingClientRect();
    if(!r||!outer)return {x:w*.5,y:h*.5,size:w/8};
    return {x:r.left-outer.left+r.width/2,y:r.top-outer.top+r.height/2,size:Math.min(r.width,r.height)};
  }
  function event(duration,draw){
    if(!setup())return;
    events.push({start:now(),duration,draw});
    if(events.length>16)events.splice(0,events.length-16);
    canvas.style.visibility='visible';
    if(!raf)raf=requestAnimationFrame(frame);
  }
  function frame(time){
    raf=0;if(!ctx)return;
    ctx.clearRect(0,0,w,h);
    const live=[];
    for(const e of events){
      const p=(time-e.start)/e.duration;
      if(p<1){e.draw(ctx,Math.max(0,p));live.push(e);}
    }
    events.length=0;events.push(...live);
    if(events.length)raf=requestAnimationFrame(frame);
    else if(canvas)canvas.style.visibility='hidden';
  }
  function clear(){
    events.length=0;if(raf)cancelAnimationFrame(raf);raf=0;
    if(ctx)ctx.clearRect(0,0,w,h);
    if(canvas)canvas.style.visibility='hidden';
    box?.classList.remove('blastPulse');
  }
  function shards(cells){
    if(!setup()||!cells?.length)return;
    // Limit the material, NOT the number of matched tiles. Spread sampling over all tiles.
    const sample=cells.length>24?cells.filter((_,i)=>i%Math.ceil(cells.length/24)===0):cells;
    const pieces=[];
    for(const cell of sample){
      const p=tile(cell.index),count=3;
      for(let j=0;j<count;j++){
        const angle=Math.random()*Math.PI*2,speed=p.size*(.35+Math.random()*.6),sz=p.size*(.045+Math.random()*.046);
        pieces.push({x:p.x,y:p.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-.2*p.size,
          rot:Math.random()*5,spin:(Math.random()-.5)*6,sz,color:j===0?'#fff9d6':palette[cell.type]||'#f2d8a6'});
      }
    }
    event(480,(c,t)=>{
      c.save();c.globalCompositeOperation='lighter';
      for(const p of pieces){
        const alpha=(1-t)*.85;
        c.save();c.translate(p.x+p.vx*t,p.y+p.vy*t+p.sz*4*t*t);
        c.rotate(p.rot+p.spin*t);c.globalAlpha=alpha;c.fillStyle=p.color;
        c.beginPath();c.moveTo(0,-p.sz);c.lineTo(p.sz*.8,p.sz*.5);c.lineTo(-p.sz*.75,p.sz*.35);c.closePath();c.fill();
        c.restore();
      }
      c.restore();
    });
  }
  function laser(at,kind,large=false){
    if(!setup()||!['row','col'].includes(kind))return;
    const p=tile(at),horizontal=kind==='row';
    const first=tile(horizontal?Math.floor(at/8)*8:at%8);
    const last=tile(horizontal?Math.floor(at/8)*8+7:56+at%8);
    const x1=horizontal?first.x:first.x,y1=horizontal?p.y:first.y;
    const x2=horizontal?last.x:last.x,y2=horizontal?p.y:last.y;
    const duration=large?730:510;
    event(duration,(c,t)=>{
      const fade=Math.pow(1-t,.7),surge=Math.min(1,t*7),width=p.size*(large?.84:.39);
      c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
      const layers=[[width,.18,'#e4b45d'],[width*.46,.7,large?'#ffca7a':'#ffdb9d'],[Math.max(2,width*.12),.98,'#fffdf0']];
      for(const [weight,a,color] of layers){
        c.globalAlpha=a*fade*surge;c.strokeStyle=color;c.lineWidth=weight;
        c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
      }
      if(large){
        for(const offset of [-width*.29,width*.29]){
          c.globalAlpha=fade*.62;c.lineWidth=1.7;c.strokeStyle='#fff8cf';
          c.beginPath();c.moveTo(x1+(horizontal?0:offset),y1+(horizontal?offset:0));
          c.lineTo(x2+(horizontal?0:offset),y2+(horizontal?offset:0));c.stroke();
        }
        // Run five bright particles along the central beam without sprites or DOM overlays.
        for(let n=0;n<6;n++){
          const u=(n/6+t*1.7)%1,x=x1+(x2-x1)*u,y=y1+(y2-y1)*u;
          c.globalAlpha=fade*.95;c.fillStyle=n%2?'#fff':'#ffe4a0';
          c.beginPath();c.arc(x,y,Math.max(1.5,width*.065),0,Math.PI*2);c.fill();
        }
      }
      c.restore();
    });
  }
  function blast(at,large=false){
    if(!setup())return;
    const p=tile(at),radius=p.size*(large?3.5:2.0),duration=large?800:640;
    if(large&&box){
      box.classList.remove('blastPulse');void box.offsetWidth;box.classList.add('blastPulse');
      setTimeout(()=>box?.classList.remove('blastPulse'),360);
    }
    event(duration,(c,t)=>{
      const expand=1-Math.pow(1-Math.min(1,t*1.25),3),fade=Math.pow(1-t,1.5);
      c.save();c.globalCompositeOperation='lighter';
      c.globalAlpha=fade*(large?.42:.26);c.fillStyle='#ffd57d';
      c.beginPath();c.arc(p.x,p.y,radius*.7*expand,0,Math.PI*2);c.fill();
      for(let i=0;i<(large?3:2);i++){
        const u=Math.max(0,(t-i*.095)/(1-i*.095));
        c.globalAlpha=(1-u)*(large?.96:.72);c.strokeStyle=i===1?'#fffdf6':'#ffc86b';
        c.lineWidth=Math.max(1,p.size*(large?.12:.08)*(1-u*.7));
        c.beginPath();c.arc(p.x,p.y,p.size*.12+radius*u,0,Math.PI*2);c.stroke();
      }
      const rays=large?22:12;
      for(let i=0;i<rays;i++){
        const a=i/rays*Math.PI*2,r1=p.size*.25,r2=radius*(.3+.75*expand);
        c.globalAlpha=fade*.82;c.strokeStyle=i%3===0?'#fff9da':'#e9ac58';c.lineWidth=Math.max(1.2,p.size*.038*(1-t));
        c.beginPath();c.moveTo(p.x+Math.cos(a)*r1,p.y+Math.sin(a)*r1);
        c.lineTo(p.x+Math.cos(a)*r2,p.y+Math.sin(a)*r2);c.stroke();
      }
      c.restore();
    });
  }
  function orb(at){
    if(!setup())return;
    laser(at,'row',true);laser(at,'col',true);
    event(650,(c,t)=>{
      const p=tile(at);c.save();c.globalAlpha=(1-t)*.82;c.strokeStyle='#fff4a7';
      c.lineWidth=Math.max(1.5,p.size*.13*(1-t));c.beginPath();
      c.arc(p.x,p.y,p.size*.3+p.size*3.3*t,0,Math.PI*2);c.stroke();c.restore();
    });
  }
  return {clear,shards,laser,blast,orb};
}
