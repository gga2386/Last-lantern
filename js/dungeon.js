// ===== Procedural dungeon generation =====
const T={WALL:0,FLOOR:1,DOOR:2,DOOROPEN:3,SECRET:4,DOWN:5,UP:6,LOCKED:7,WATER:8,RUBBLE:9,PIT:10};
function walkable(t){ return t===T.FLOOR||t===T.DOOROPEN||t===T.DOWN||t===T.UP||t===T.WATER||t===T.RUBBLE; }
function opaque(t){ return t===T.WALL||t===T.DOOR||t===T.SECRET||t===T.LOCKED; }
function partyLevel(){ const p=activeParty(); if(!p.length) return 1; return p.reduce((a,h)=>a+h.level,0)/p.length; }
function genDungeon(opts){ let m=null; for(let i=0;i<10;i++){ m=genDungeon0(opts); if(dungeonSolvable(m,opts)) return m; } return m; }
function dungeonSolvable(m,opts){ let s=-1,e=-1; for(let k=0;k<m.t.length;k++){ if(m.t[k]===T.UP) s=k; if(m.t[k]===T.DOWN) e=k; } if(s<0) return false;
  if(e<0){ const b=m.ents.find(x=>x.type==='mon'&&opts.boss&&(x.mid===opts.boss||x.id===opts.boss||x.key===opts.boss)); if(b) e=b.y*m.w+b.x; } if(e<0) return true;
  const ok=t=>walkable(t)||t===T.DOOR||t===T.LOCKED; const seen=new Set([s]); const q=[s]; while(q.length){ const k=q.pop(); if(k===e) return true; const x=k%m.w,y=(k/m.w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const n=(y+dy)*m.w+x+dx; if(!seen.has(n)&&ok(m.t[n])){ seen.add(n); q.push(n);} } } return seen.has(e); }
function genDungeon0(opts){
  // opts: theme, floor, floors, tier, boss, questItem, rescue, lvl
  const W=44,H=44; const t=new Array(W*H).fill(T.WALL); const at=(x,y)=>t[y*W+x]; const set=(x,y,v)=>{ if(x>0&&y>0&&x<W-1&&y<H-1) t[y*W+x]=v; };
  const rooms=[]; let tries=0; const target=8+rnd(4);
  while(rooms.length<target&&tries<400){ tries++;
    const w=4+rnd(5), h=4+rnd(5), x=2+rnd(W-w-4), y=2+rnd(H-h-4);
    if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y)) continue;
    rooms.push({id:rooms.length,x,y,w,h,cx:x+(w>>1),cy:y+(h>>1),kind:'normal'});
  }
  rooms.forEach(r=>{ for(let yy=r.y;yy<r.y+r.h;yy++) for(let xx=r.x;xx<r.x+r.w;xx++) set(xx,yy,T.FLOOR); });
  // order rooms by a path: nearest-neighbour chain from room 0
  const order=[rooms[0]]; const left=rooms.slice(1);
  while(left.length){ const last=order[order.length-1]; left.sort((a,b)=>Math.hypot(a.cx-last.cx,a.cy-last.cy)-Math.hypot(b.cx-last.cx,b.cy-last.cy)); order.push(left.shift()); }
  const corridors=[];
  const inRoom=(px,py)=>rooms.find(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h);
  function carve(a,b){ const pts=[]; let x=a.cx,y=a.cy; const horizFirst=Math.random()<0.5;
    const stepX=()=>{ while(x!==b.cx){ x+=Math.sign(b.cx-x); pts.push([x,y]); } }; const stepY=()=>{ while(y!==b.cy){ y+=Math.sign(b.cy-y); pts.push([x,y]); } };
    if(horizFirst){ stepX(); stepY(); } else { stepY(); stepX(); }
    for(const [px,py] of pts) if(at(px,py)===T.WALL) set(px,py,T.FLOOR);
  }
  const vault = order.length>=7 && Math.random()<0.85 ? order[order.length-1] : null;
  for(let i=1;i<order.length;i++){ if(order[i]===vault) continue; carve(order[i-1],order[i]); }
  for(let k=0;k<2;k++){ const cand=order.filter(r=>r!==vault); const a=pick(cand), b=pick(cand.filter(r=>r!==a)); if(a&&b) carve(a,b); }
  if(vault){ const near=order.filter(r=>r!==vault).sort((a,b)=>Math.hypot(a.cx-vault.cx,a.cy-vault.cy)-Math.hypot(b.cx-vault.cx,b.cy-vault.cy))[0]; carve(near,vault); vault.kind='vault'; }
  const doorTiles=[];
  const isCor=(x,y)=>at(x,y)===T.FLOOR&&!inRoom(x,y);
  function flanked(x,y){ return (at(x-1,y)===T.WALL&&at(x+1,y)===T.WALL)||(at(x,y-1)===T.WALL&&at(x,y+1)===T.WALL); }
  if(vault){ // every entrance into the vault becomes a secret door
    for(let yy=vault.y-1;yy<=vault.y+vault.h;yy++) for(let xx=vault.x-1;xx<=vault.x+vault.w;xx++){ if(inRoom(xx,yy)) continue; if(isCor(xx,yy)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>inRoom(xx+dx,yy+dy)===vault)){ set(xx,yy,T.SECRET); doorTiles.push({x:xx,y:yy,kind:T.SECRET}); } }
    if(!doorTiles.length) vault.kind='treasure';
  }
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ if(!isCor(x,y)||!flanked(x,y)) continue; const adjRoom=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>inRoom(x+dx,y+dy)); if(adjRoom&&Math.random()<0.6){ set(x,y,T.DOOR); doorTiles.push({x,y,kind:T.DOOR}); } }
  const start=order[0]; start.kind='start'; const end=order.filter(r=>r.kind!=='vault').slice(-1)[0]; end.kind=opts.boss?'boss':'stairs';
  set(start.cx,start.cy,T.UP);
  const last = opts.floor>=opts.floors;
  if(!last) set(end.cx,end.cy,T.DOWN);
  // locked doors: some doors become locked
  const diffDC=10+Math.min(8,Math.floor(opts.lvl/2)+opts.floor);
  const ents=[];
  for(const d of doorTiles){ if(d.kind===T.DOOR&&Math.random()<0.18){ set(d.x,d.y,T.LOCKED); ents.push({type:'lock',x:d.x,y:d.y,dc:diffDC+rnd(3)}); } }
  for(const d of doorTiles){ if(d.kind===T.SECRET) ents.push({type:'secret',x:d.x,y:d.y,dc:12+Math.min(6,opts.floor+Math.floor(opts.lvl/3)),found:false}); }
  const free=(x,y)=>walkable(at(x,y))&&at(x,y)!==T.UP&&at(x,y)!==T.DOWN&&!ents.some(e=>e.x===x&&e.y===y);
  const roomTiles=(r,pad)=>{ const o=[]; pad=pad||0; for(let yy=r.y+pad;yy<r.y+r.h-pad;yy++) for(let xx=r.x+pad;xx<r.x+r.w-pad;xx++) if(free(xx,yy)) o.push([xx,yy]); return o; };
  const theme=THEMES[opts.theme];
  // corridor tiles list
  const corTiles=[]; for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) if(at(x,y)===T.FLOOR&&!rooms.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)) corTiles.push([x,y]);
  // traps
  const tier=opts.tier; const trapPool=Object.keys(TRAPS).filter(k=>(TRAPS[k].tier||1)<=tier+1);
  const nTraps=3+rnd(3)+Math.floor(opts.floor/2);
  for(let i=0;i<nTraps;i++){ const pool=Math.random()<0.5&&corTiles.length?corTiles:roomTiles(pick(order.filter(r=>r!==start)),1); if(!pool.length) continue; const [x,y]=pick(pool); if(!free(x,y)) continue; const tid=pick(trapPool); const tr=TRAPS[tid]; const bump=Math.floor(opts.lvl/3);
    ents.push({type:'trap',x,y,trap:tid,det:tr.det+bump,dis:tr.dis+bump,dc:tr.dc+bump,found:false,disarmed:false,triggered:false}); }
  // obstacles in corridors
  const nObs=Math.random()<0.8?1+rnd(2):0;
  for(let i=0;i<nObs&&corTiles.length;i++){ const [x,y]=pick(corTiles); if(!free(x,y)) continue; const near=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>walkable(at(x+dx,y+dy))).length; if(near!==2) continue; const ob=pick(Object.keys(OBSTACLES)); ents.push({type:'obstacle',x,y,ob,dc:0,bump:Math.floor(opts.lvl/3)+Math.floor(opts.floor/2),cleared:false}); }
  // monsters
  const lvl=opts.lvl, pc=Math.max(1,activeParty().length);
  const maxCR=Math.max(0.25,lvl<=1?0.5:lvl<=2?1:lvl<=4?lvl-1:Math.min(10,lvl-1));
  const pool=MONSTER_LIST.filter(m=>!m.boss&&theme.types.includes(m.type)&&m.cr<=maxCR&&m.cr>=Math.min(maxCR/6,1));
  const pool2=pool.length>=3?pool:MONSTER_LIST.filter(m=>!m.boss&&m.cr<=maxCR);
  let groupId=1;
  for(const r of order){
    if(r===start) continue;
    if(r.kind==='vault'||r.kind==='treasure'){ addChest(r,true); continue; }
    if(r.kind==='boss'){ const b=MONSTERS[opts.boss]; const tiles=roomTiles(r,1); const [bx,by]=tiles.length?pick(tiles):[r.cx,r.cy]; ents.push(mkMon(b,bx,by,groupId)); const minions=Math.min(4,Math.max(1,pc-2)); for(let i=0;i<minions;i++){ const m=pick(pool2.filter(m=>m.cr<=Math.max(0.5,maxCR/2)))||pool2[0]; const tl=roomTiles(r,0); if(tl.length){ const [x,y]=pick(tl); ents.push(mkMon(m,x,y,groupId)); } } groupId++; addChest(r,true); continue; }
    if(Math.random()<0.52){ // encounter
      const MED=[50,100,150,250,500,600,750,900,1100,1200,1600,2000];
      const budget=pc*MED[clamp(Math.round(lvl)-1,0,11)]*(0.5+Math.random()*0.45)*(1+(opts.floor-1)*0.1); const mult=n=>n<=1?1:n===2?1.5:n<=6?2:2.5;
      let sum=0; const tl=shuffle(roomTiles(r,0)); let n=0;
      const fit=pool2.filter(m=>(CR_XP[m.cr]||10)<=budget); const lead=fit.length?pick(fit):pool2.slice().sort((a,b)=>a.cr-b.cr)[0]; const candidates=pool2.filter(m=>m.type===lead.type||Math.random()<0.3);
      while(n<Math.min(7,pc+2)&&tl.length){ const m=n===0?lead:pick(candidates); const xp=CR_XP[m.cr]||10; if(n>0&&(sum+xp)*mult(n+1)>budget) break; const [x,y]=tl.pop(); ents.push(mkMon(m,x,y,groupId)); sum+=xp; n++; if(sum*mult(n)>budget) break; }
      groupId++;
    }
    // room content
    const tl=shuffle(roomTiles(r,1));
    if(Math.random()<0.45&&tl.length) addChest(r,false);
    const nObj=1+rnd(3); for(let i=0;i<nObj&&tl.length;i++){ const [x,y]=tl.pop(); if(!free(x,y)) continue; ents.push(mkObj(pick(theme.obj),x,y,opts)); }
    if(Math.random()<0.35&&tl.length){ const [x,y]=tl.pop(); if(free(x,y)) ents.push(mkInteract(x,y,opts)); }
  }
  function addChest(r,rich){ const tl=roomTiles(r,1); if(!tl.length) return; const [x,y]=pick(tl); const locked=Math.random()<(rich?0.7:0.35); const trapped=Math.random()<0.2; ents.push({type:'chest',x,y,rich,locked,dc:diffDC+(rich?2:0),trap:trapped?pick(['dart','gas','fireglyph','blade'].filter(k=>(TRAPS[k].tier||1)<=tier+1)):null,trapFound:false,opened:false}); }
  // quest items / prisoners
  if(opts.questItem){ const rr=pick(order.filter(r=>r!==start)); const tl2=roomTiles(rr,1); if(tl2.length){ const [x,y]=pick(tl2); ents.push({type:'questitem',x,y,qid:opts.questItem.qid,item:opts.questItem.item,n:opts.questItem.n}); } }
  if(opts.rescue||Math.random()<0.18){ const rr=pick(order.filter(r=>r!==start&&r.kind!=='vault')); const tl2=roomTiles(rr,1); if(tl2.length){ const [x,y]=pick(tl2); const p=opts.rescue?{n:'Elsa, the miller\'s daughter',reward:'quest'}:pick(PRISONERS); ents.push({type:'prisoner',x,y,n:p.n,reward:p.reward,qid:opts.rescue||null,freed:false,dc:diffDC}); } }
  // shrine/altar events
  const map={w:W,h:H,t,rooms,ents,start:{x:start.cx,y:start.cy},down:last?null:{x:end.cx,y:end.cy},theme:opts.theme,floor:opts.floor,floors:opts.floors,lvl,tier,
    explored:new Array(W*H).fill(0),seed:Math.random(),bossRoom:opts.boss?end.id:null};
  return map;
}
function mkMon(m,x,y,group){ return {type:'mon',uid:uid('m'),mid:m.id,x,y,hp:m.hp,hpMax:m.hp,group,awake:false,fx:[],alerted:false,talked:false}; }
const OBJ_INFO={
  barrel:{n:'Barrel',block:1,act:'smash'},crate:{n:'Crate',block:1,act:'smash'},bones:{n:'Pile of Bones',block:0,act:'search'},shelf:{n:'Bookshelf',block:1,act:'books'},
  coffin:{n:'Coffin',block:1,act:'coffin'},statue:{n:'Statue',block:1,act:'statue'},brazier:{n:'Brazier',block:1,act:'brazier'},urn:{n:'Funeral Urn',block:1,act:'smash'},
  rocks:{n:'Rocks',block:1,act:null},mushrooms:{n:'Pale Mushrooms',block:0,act:'mushrooms'},web:{n:'Thick Webs',block:0,act:'web'},puddle:{n:'Black Pool',block:0,act:'pool'},
  reeds:{n:'Reeds',block:0,act:null},pillar:{n:'Pillar',block:1,act:null},anvil:{n:'Old Anvil',block:1,act:'anvil'},pew:{n:'Pew',block:1,act:null},candles:{n:'Votive Candles',block:0,act:'candles'},
  altar:{n:'Altar',block:1,act:'altar'},fountain:{n:'Fountain',block:1,act:'fountain'},corpse:{n:'Fallen Adventurer',block:0,act:'corpse'},lever:{n:'Rusted Lever',block:1,act:'lever'},sarcophagus:{n:'Sealed Sarcophagus',block:1,act:'sarcophagus'}
};
function mkObj(kind,x,y,opts){ return {type:'obj',kind,x,y,used:false}; }
function mkInteract(x,y,opts){ const k=pick(['altar','fountain','corpse','corpse','sarcophagus','shelf','statue']); return {type:'obj',kind:k,x,y,used:false,dc:11+Math.min(7,Math.floor(opts.lvl/2)+opts.floor)}; }
function tileAt(map,x,y){ if(x<0||y<0||x>=map.w||y>=map.h) return T.WALL; return map.t[y*map.w+x]; }
function setTile(map,x,y,v){ map.t[y*map.w+x]=v; }
function entsAt(map,x,y){ return map.ents.filter(e=>e.x===x&&e.y===y); }
function blocksMove(map,x,y,forMon,ignAlly){
  const t=tileAt(map,x,y); if(!walkable(t)) return true;
  for(const e of map.ents){ if(e.x!==x||e.y!==y) continue;
    if(e.type==='obj'&&OBJ_INFO[e.kind]&&OBJ_INFO[e.kind].block&&!e.broken) return true;
    if(e.type==='chest') return true;
    if(e.type==='obstacle'&&!e.cleared) return true;
    if(e.type==='prisoner'&&!e.freed) return true;
    if(e.type==='mon'&&e.hp>0&&!(ignAlly&&e.ally)) return true;
  }
  return false;
}
// LOS (Bresenham)
function los(map,x0,y0,x1,y1){ let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
  while(!(x===x1&&y===y1)){ const e2=2*err; if(e2>-dy){err-=dy;x+=sx;} if(e2<dx){err+=dx;y+=sy;} if(x===x1&&y===y1) break; if(opaque(tileAt(map,x,y))) return false; }
  return true; }
function dist(a,b){ return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)); }
function dist2(ax,ay,bx,by){ return Math.max(Math.abs(ax-bx),Math.abs(ay-by)); }
// BFS path with 8 directions (no corner cutting through walls). occ: function(x,y)->blocked
function bfs(map,sx,sy,maxCost,blocked){
  const W=map.w, dist=new Map(), prev=new Map(); const k=(x,y)=>y*W+x; const q=[[sx,sy]]; dist.set(k(sx,sy),0);
  while(q.length){ const [x,y]=q.shift(); const d0=dist.get(k(x,y)); if(d0>=maxCost) continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx, ny=y+dy; if(dist.has(k(nx,ny))) continue;
      if(dx&&dy&&(!walkable(tileAt(map,x+dx,y))||!walkable(tileAt(map,x,y+dy)))) continue;
      if(blocked(nx,ny)) continue; const t=tileAt(map,nx,ny); const cost=(t===T.WATER||t===T.RUBBLE)?2:1;
      const nd=d0+cost; if(nd>maxCost) continue; dist.set(k(nx,ny),nd); prev.set(k(nx,ny),k(x,y)); q.push([nx,ny]);
      // re-sort small queue by distance (Dijkstra-lite)
      if(cost>1) q.sort((a,b)=>dist.get(k(a[0],a[1]))-dist.get(k(b[0],b[1])));
    }
  }
  return {dist,prev,W,path:(tx,ty)=>{ const out=[]; let c=k(tx,ty); if(!dist.has(c)) return null; while(c!==k(sx,sy)){ out.unshift([c%W,Math.floor(c/W)]); c=prev.get(c); } return out; }};
}
function roomAt(map,x,y){ return map.rooms.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h); }
