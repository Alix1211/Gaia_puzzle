/* GAIA Match Engine v0.2 — pure rules shared by the browser and Node tests.
   References: MoonSun Pang's square/cross/4/5 rules and MoonFlo's special combinations. */
const GaiaEngine = (() => {
  const N = 8, SIZE = 64, KINDS = 5;
  const rand = n => Math.floor(Math.random() * n);
  const rc = i => [Math.floor(i / N), i % N];
  const ix = (r, c) => r * N + c;
  const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  function adjacent(a, b) { if(a<0||b<0||a>=SIZE||b>=SIZE)return false; const [r,c]=rc(a),[y,x]=rc(b); return Math.abs(r-y)+Math.abs(c-x)===1; }
  function swap(b, a, c) { [b[a], b[c]]=[b[c], b[a]]; }

  function scan(board, preferred = []) {
    const patterns=[];
    for(let r=0;r<N;r++) for(let c=0;c<N;){
      const t=board[ix(r,c)]; let end=c+1;
      while(end<N && t>=0 && board[ix(r,end)]===t)end++;
      if(t>=0&&end-c>=3)patterns.push({dir:'row',indices:Array.from({length:end-c},(_,i)=>ix(r,c+i))});
      c=end;
    }
    for(let c=0;c<N;c++) for(let r=0;r<N;){
      const t=board[ix(r,c)]; let end=r+1;
      while(end<N && t>=0 && board[ix(end,c)]===t)end++;
      if(t>=0&&end-r>=3)patterns.push({dir:'col',indices:Array.from({length:end-r},(_,i)=>ix(r+i,c))});
      r=end;
    }
    // MoonSun Pang's 2×2 square match: meaningful even without a 3-in-a-row.
    for(let r=0;r<N-1;r++)for(let c=0;c<N-1;c++){
      const a=ix(r,c),t=board[a];
      if(t>=0&&board[a+1]===t&&board[a+N]===t&&board[a+N+1]===t)
        patterns.push({dir:'square',indices:[a,a+1,a+N,a+N+1]});
    }
    const groups=[];
    for(const p of patterns){
      let group={set:new Set(p.indices),patterns:[p]};
      // Repeat until transitive intersections are merged as well.
      let merged=true;
      while(merged){merged=false;for(let j=groups.length-1;j>=0;j--){
        if([...groups[j].set].some(x=>group.set.has(x))){
          for(const x of groups[j].set)group.set.add(x);
          group.patterns.push(...groups[j].patterns);groups.splice(j,1);merged=true;
        }
      }}
      groups.push(group);
    }
    const created=[],indices=new Set();
    for(const g of groups){
      for(const i of g.set)indices.add(i);
      const five=g.patterns.find(p=>p.dir!=='square'&&p.indices.length>=5);
      const row=g.patterns.find(p=>p.dir==='row'),col=g.patterns.find(p=>p.dir==='col');
      const four=g.patterns.find(p=>p.dir!=='square'&&p.indices.length===4);
      const square=g.patterns.find(p=>p.dir==='square');
      const kind=five?'orb':row&&col?'bomb':four?four.dir:square?'star':null;
      if(!kind)continue;
      const at=preferred.find(i=>g.set.has(i))??[...g.set][Math.floor(g.set.size/2)];
      created.push({at,kind,type:board[at]});
    }
    return {indices:[...indices],created,groups:groups.map(g=>({indices:[...g.set],patterns:g.patterns}))};
  }
  function legalMoves(board,specials=Array(SIZE).fill(null)){
    const out=[];
    for(let a=0;a<SIZE;a++)for(const b of [a+1,a+N]){
      if(!adjacent(a,b))continue;
      swap(board,a,b);const match=scan(board,[b,a]);swap(board,a,b);
      if(match.indices.length||specials[a]||specials[b])out.push({a,b,size:match.indices.length,
        special:!!(specials[a]||specials[b]),made:match.created.length});
    }
    return out;
  }
  function newBoard(){
    for(let attempts=0;attempts<100;attempts++){
      const b=Array(SIZE).fill(-1);
      for(let r=0;r<N;r++)for(let c=0;c<N;c++){
        const options=[];for(let t=0;t<KINDS;t++){
          if(c>=2&&b[ix(r,c-1)]===t&&b[ix(r,c-2)]===t)continue;
          if(r>=2&&b[ix(r-1,c)]===t&&b[ix(r-2,c)]===t)continue;
          if(r>=1&&c>=1&&b[ix(r-1,c-1)]===t&&b[ix(r-1,c)]===t&&b[ix(r,c-1)]===t)continue;
          options.push(t);
        }
        b[ix(r,c)]=options[rand(options.length)];
      }
      if(legalMoves(b).length)return b;
    }
    throw Error('failed to generate playable board');
  }
  function addLine(out,r,c,kind,half=0){
    for(let d=-half;d<=half;d++)for(let i=0;i<N;i++){
      const y=kind==='row'?r+d:i,x=kind==='row'?i:c+d;
      if(inside(y,x))out.add(ix(y,x));
    }
  }
  function addArea(out,r,c,rad){
    for(let y=r-rad;y<=r+rad;y++)for(let x=c-rad;x<=c+rad;x++)if(inside(y,x))out.add(ix(y,x));
  }
  function effects(board,specials,swapped,matched){
    const hit=new Set(matched.indices),created=new Map(matched.created.map(s=>[s.at,s]));
    const fired=new Set(),combos=[];
    if(swapped&&swapped.length===2){
      const [a,b]=swapped,sa=specials[a],sb=specials[b];
      if(sa||sb){
        hit.add(a);hit.add(b);
        if(sa&&sb){
          combos.push(sa+'+'+sb);
          if(sa==='orb'||sb==='orb'){
            for(let i=0;i<SIZE;i++)hit.add(i);
          }else if(sa==='bomb'&&sb==='bomb'){
            const [r,c]=rc(b);addArea(hit,r,c,3);
          }else if(['row','col'].includes(sa)&&['row','col'].includes(sb)){
            const [r,c]=rc(b);
            if(sa===sb){const [ar,ac]=rc(a);addLine(hit,ar,ac,sa);addLine(hit,r,c,sb);}
            else{addLine(hit,r,c,'row');addLine(hit,r,c,'col');}
          }else if(['row','col'].includes(sa)||['row','col'].includes(sb)){
            const dir=['row','col'].includes(sa)?sa:sb,[r,c]=rc(b);
            addLine(hit,r,c,dir,sa==='bomb'||sb==='bomb'?2:1);addArea(hit,r,c,1);
          }else{const [r,c]=rc(b);addArea(hit,r,c,2);}
          fired.add(a);fired.add(b);
        }else if(sa==='orb'||sb==='orb'){
          const t=sa?board[b]:board[a];
          for(let i=0;i<SIZE;i++)if(board[i]===t)hit.add(i);
        }
      }
    }
    const queue=[...hit];
    for(let q=0;q<queue.length;q++){
      const pos=queue[q],sp=specials[pos];
      if(!sp||fired.has(pos))continue;
      fired.add(pos);
      const before=hit.size,[r,c]=rc(pos);
      if(sp==='row'||sp==='col')addLine(hit,r,c,sp);
      if(sp==='star')addArea(hit,r,c,1);
      if(sp==='bomb')addArea(hit,r,c,2);
      if(sp==='orb')for(let i=0;i<SIZE;i++)if(board[i]===board[pos])hit.add(i);
      if(hit.size>before)for(const i of hit)if(!queue.includes(i))queue.push(i);
    }
    for(const at of created.keys())if(!fired.has(at))hit.delete(at);
    return {hit:[...hit],created:[...created.values()].filter(s=>!fired.has(s.at)),fired:[...fired],combos};
  }
  function applyClear(board,specials,result){
    const values=[0,0,0,0,0];
    for(const i of result.hit){if(board[i]>=0)values[board[i]]++;board[i]=-1;specials[i]=null;}
    for(const s of result.created){board[s.at]=s.type;specials[s.at]=s.kind;}
    return values;
  }
  function gravity(board,specials){
    const falls=[];
    for(let c=0;c<N;c++){
      let dest=N-1;
      for(let r=N-1;r>=0;r--){const from=ix(r,c);if(board[from]<0)continue;
        const to=ix(dest,c);if(from!==to){board[to]=board[from];specials[to]=specials[from];
          board[from]=-1;specials[from]=null;falls.push({to,from});}
        dest--;
      }
      for(let r=dest;r>=0;r--){const to=ix(r,c);board[to]=rand(KINDS);specials[to]=null;
        falls.push({to,from:ix(r-(dest+1),c)});}
    }
    return falls;
  }
  return {N,SIZE,KINDS,rc,ix,adjacent,swap,scan,legalMoves,newBoard,effects,applyClear,gravity};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=GaiaEngine;
