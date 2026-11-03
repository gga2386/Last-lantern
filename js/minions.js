// ===== Necromancer minions — ORIGINAL system (not SRD) =====
// Minions are monster entities on the party's side: {type:'mon', ally:true, owner:heroId, ctl:'auto'|'manual', def:{...}}
function partyMinions(){ if(!G.run||!G.run.map) return []; return G.run.map.ents.filter(e=>e.type==='mon'&&e.ally&&e.hp>0&&!e.dead); }
function minionsOf(h){ return partyMinions().filter(m=>m.owner===h.id); }
function minionOwner(m){ return (G.roster||[]).concat(activeParty()).find(h=>h.id===m.owner)||null; }
function partySide(c){ return !!(c&&(c.isHero||c.ally)); }
function freeTileNear(x,y,maxR){ const map=G.run.map; for(let r=1;r<=(maxR||4);r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue; const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=map.w||ny>=map.h) continue; if(blocksMove(map,nx,ny)||occupied(nx,ny)) continue; if(r===1&&dx&&dy&&blocksMove(map,x+dx,y)&&blocksMove(map,x,y+dy)) continue; if(!los(map,x,y,nx,ny)) continue; return [nx,ny]; } return null; }
const MINION_KINDS={skeleton:{mid:'skeleton',n:'Risen Skeleton',ic:'💀'},zombie:{mid:'zombie',n:'Risen Zombie',ic:'🧟'},ghoul:{mid:'ghoul',n:'Risen Ghoul',ic:'👹'}};
function minionDef(h,kind,slot){ const base=MONSTERS[MINION_KINDS[kind].mid]; const F=heroFeatures(h); const im=Math.max(0,abilMod(h,'int'));
  const d=JSON.parse(JSON.stringify(base)); d.n=MINION_KINDS[kind].n; d.boss=false; d.talk=null; d.minion=1; d.cr=0; d.caster=null; d.breath=null;
  const hitB=Math.max(0,profFor(h.level)-2)+(F.has('boneLegion')?1:0); const dmgB=F.has('boneBond')?im:0;
  d.atks=d.atks.map(a=>Object.assign(a,{hit:a.hit+hitB,dmg:dmgB?a.dmg+'+'+dmgB:a.dmg}));
  if(F.has('boneKnights')){ d.ac+=2; d.multi=(d.multi||1)+1; }
  d.hp=base.hp+h.level+Math.max(0,(slot||1)-1)*5+(F.has('boneBond')?h.level:0);
  return d; }
function raiseMinion(h,kind,slot){ const map=G.run.map; if(!MINION_KINDS[kind]) kind='skeleton'; const cap=Math.max(1,minionCap(h)); let mine=minionsOf(h);
  while(mine.length>=cap){ const old=mine.shift(); log(cName(old)+' crumbles as a new servant rises.','sys'); removeMinion(old); }
  const pos=freeTileNear(h.x,h.y,3); if(!pos){ toast('No room for the dead to rise.'); log('There is no room for the dead to rise.','bad'); return null; }
  const d=minionDef(h,kind,slot); const e=mkMon(d,pos[0],pos[1],'ally:'+h.id); e.def=d; e.ally=true; e.owner=h.id; e.ctl=h.minionCtl||'auto'; e.summoned=1; e.awake=true; e.kind=kind; e.reaction=true;
  map.ents.push(e);
  if(G.combat){ const C=G.combat; e.inCombat=true; e.init=(h.init||10)-0.5; const i=C.order.indexOf(h); if(i<0) C.order.push(e); else C.order.splice(i+1,0,e); }
  const K=MINION_KINDS[kind]; log(K.ic+' '+d.n+' '+(K.verb||'claws its way up')+', bound to '+h.name+' ('+e.hp+' HP).','good'); floater(e.x,e.y,K.flt||'RISEN',K.fltC||'#7fdc8a',true);
  if(!K.construct&&typeof unlockCodex==='function') unlockCodex('necromancy');
  R.dirty=true; if(G.combat) UI.refreshInit(); return e; }
function removeMinion(m){ m.hp=0; m.dead=true; if(G.run&&G.run.map) G.run.map.ents=G.run.map.ents.filter(e=>e!==m); R.dirty=true; }
function dismissMinions(heroes,why){ if(!G.run||!G.run.map) return; const ids=new Set((heroes||activeParty()).map(h=>h.id)); const ms=partyMinions().filter(m=>ids.has(m.owner)); if(!ms.length) return; ms.forEach(removeMinion); const allC=ms.every(m=>MINION_KINDS[m.kind]&&MINION_KINDS[m.kind].construct); log((allC?'Your constructs fold away into their cases':'The bound dead collapse into dust')+(why?' ('+why+')':'')+'.','sys'); }
// exploration: minions trail behind the party
function minionsFollow(){ if(!G.run||!G.run.map||G.combat) return; const party=activeParty().filter(h=>h.x!=null&&h.status!=='fallen'); if(!party.length) return; const tail=party[party.length-1];
  for(const m of partyMinions()){ const stacked=party.some(h=>h.x===m.x&&h.y===m.y)||partyMinions().some(o=>o!==m&&o.x===m.x&&o.y===m.y); const near=Math.min(...party.map(h=>dist(h,m)));
    if(stacked||near>2){ const own=minionOwner(m); m.x=-99; m.y=-99; const p=freeTileNear(tail.x,tail.y,3)||(own&&own.x!=null?freeTileNear(own.x,own.y,4):null); if(p){ m.x=p[0]; m.y=p[1]; } else { m.x=tail.x; m.y=tail.y; } } } }
function carryMinions(oldEnts,start){ const ms=(oldEnts||[]).filter(e=>e.type==='mon'&&e.ally&&e.hp>0&&!e.dead); for(const m of ms){ m.inCombat=false; m.x=-99; m.y=-99; G.run.map.ents.push(m); const p=freeTileNear(start.x,start.y,4); if(p){ m.x=p[0]; m.y=p[1]; } else removeMinion(m); } }
// ---------- combat ----------
function minionAttackFor(m,t){ const d=dist(m,t); const atks=mdef(m).atks; const mel=atks.find(a=>a.r<=2&&d<=Math.max(1,a.r)); if(mel) return mel; return atks.find(a=>a.r>2&&d<=(a.lr||a.r)&&los(G.run.map,m.x,m.y,t.x,t.y))||null; }
async function minionTurn(m){ const C=G.combat; const own=minionOwner(m);
  if(m.ctl!=='manual'||G.autoPlay||!own){ await monsterTurn(m); return; }
  return new Promise(res=>{ C.endTurn=res; if(!G.fast) centerOn(m.x,m.y); UI.minionBar(m); }); }
async function minionStrike(m,foe,a){ const ts=G.combat.ts; ts.action=0; const n=mdef(m).multi||1; for(let i=0;i<n&&alive(foe)&&G.combat;i++){ const aa=(i>0&&minionAttackFor(m,foe))||a; await doAttack(m,foe,monAttackProfile(m,aa)); } }
async function minionTap(m,tx,ty){ const map=G.run.map, C=G.combat, ts=C.ts; const b=document.getElementById('actions');
  const foe=enemiesOf(m).find(e=>alive(e)&&e.x===tx&&e.y===ty);
  if(foe){ if(ts.action<=0){ UI.inspect(foe); return; } let a=minionAttackFor(m,foe);
    if(!a&&ts.move>0){ const mel=mdef(m).atks.filter(x=>x.r<=2); if(mel.length){ b.innerHTML=''; await approach(m,foe,Math.max(1,...mel.map(x=>x.r))); if(!G.combat) return; a=minionAttackFor(m,foe); } }
    if(!a){ toast('Out of reach.'); if(G.combat&&G.combat.cur===m) UI.minionBar(m); return; }
    b.innerHTML=''; await minionStrike(m,foe,a); if(checkCombatEnd()) return; if(G.combat&&G.combat.cur===m) UI.minionBar(m); return; }
  const k=ty*map.w+tx; if(R.hl.reach&&R.hl.reach.has(k)&&UI._reach){ const path=UI._reach.path(tx,ty); b.innerHTML=''; await moveAlong(m,path); if(G.combat&&G.combat.cur===m) UI.minionBar(m); return; }
  const who=activeParty().find(h=>h.x===tx&&h.y===ty)||partyMinions().find(e=>e.x===tx&&e.y===ty); if(who) UI.inspect(who); }
// ---------- spells ----------
Object.assign(SPELL_FX,{
  raiseMinion:async(c,sp,slot)=>{ if(!c.isHero) return; let kind;
    if(slot>=3) kind='ghoul';
    else if(c._autoCast||G.autoPlay){ const mine=minionsOf(c); kind=mine.filter(m=>m.kind==='skeleton').length<=mine.filter(m=>m.kind==='zombie').length?'skeleton':'zombie'; }
    else kind=await UI.choice('Call the Restless','Which of the dead answers '+c.name+'?',[{t:'💀 Skeleton — shortsword & shortbow, nimble',v:'skeleton'},{t:'🧟 Zombie — heavy slam, hard to put down',v:'zombie'}])||'skeleton';
    c._autoCast=false; raiseMinion(c,kind,slot); await sleep(G.fast?0:300); },
  siphon:async(c,sp,s,t,px,py,o)=>{ if(!t) return; const sv=doSave(t,'con',o.dc,{magic:1,dt:'necrotic'}); log(sv.txt,sv.ok?'':'hit'); let d=rollDice(spellDmgDice(c,sp,s)).total+spellDmgBonus(c,sp,'necrotic'); if(sv.ok) d=Math.floor(d/2);
    const F=c.isHero?heroFeatures(c):new Set(); const dealt=d>0?dealDamage(t,d,'necrotic',c,{magical:true,spell:1,ignoreRes:F.has('blightedSoul')||F.has('wither')}):0; const g=Math.max(1,Math.floor((dealt||d)/2)); healC(c,g); log(cName(c)+' siphons '+g+' HP.','good'); await sleep(G.fast?0:200); },
  ossuary:async(c,sp,s,t,px,py,o)=>{ const mine=c.isHero?minionsOf(c):[]; if(!mine.length){ log('No bound minion answers the call.','bad'); return; }
    const foes=enemiesOf(c).filter(alive); let best=mine[0],bn=-1; for(const m of mine){ if(dist(m,c)>sp.r) continue; const n=foes.filter(f=>dist(f,m)<=1).length; if(n>bn){ bn=n; best=m; } }
    const tiles=[]; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) tiles.push([best.x+dx,best.y+dy]); flashArea(tiles);
    log('💥 '+cName(best)+' bursts in a storm of bone!','spell'); floater(best.x,best.y,'BURST','#e8e0c8',true);
    const d0=rollDice(spellDmgDice(c,sp,s)).total+spellDmgBonus(c,sp,'necrotic'); const F=heroFeatures(c);
    for(const f of foes.filter(f=>dist(f,best)<=1)){ const sv=doSave(f,'dex',o.dc,{magic:1}); log(sv.txt,sv.ok?'':'hit'); const d=sv.ok?Math.floor(d0/2):d0; if(d>0) dealDamage(f,d,'necrotic',c,{magical:true,spell:1,ignoreRes:F.has('blightedSoul')}); }
    removeMinion(best); UI.refreshInit(); await sleep(G.fast?0:300); }
});
// ---------- feature actions ----------
function minionStrikePair(h){ const foes=enemiesOf(h).filter(alive); for(const m of minionsOf(h)){ if(dist(m,h)>12||incapacitated(m)) continue; const t=foes.filter(f=>minionAttackFor(m,f)).sort((a,b)=>a.hp-b.hp)[0]; if(t) return [m,t]; } return null; }
FEAT_ACT.graveCommand={cost:'bonus',tg:'enemy',range:24,ok:h=>minionsOf(h).length>0,run:async(h,t)=>{ const ms=minionsOf(h).filter(m=>dist(m,h)<=12&&!incapacitated(m)); let m=t?ms.find(m=>minionAttackFor(m,t)):null; if(!m){ const p=minionStrikePair(h); if(!p){ log('No minion can reach a foe.','bad'); return; } m=p[0]; t=p[1]; }
  log(h.name+' commands '+cName(m)+' to strike!','spell'); await doAttack(m,t,monAttackProfile(m,minionAttackFor(m,t))); }};
// ---------- auto play for necromancers ----------
async function autoNecroTurn(h){ const C=G.combat; if(!C) return false; const F=heroFeatures(h); const sp=heroSpells(h); const map=G.run.map;
  const command=async()=>{ if(F.has('graveCommand')&&C.ts.bonus>0&&G.combat){ const p=minionStrikePair(h); if(p){ C.ts.bonus--; log(h.name+' commands '+cName(p[0])+' to strike!','spell'); await doAttack(p[0],p[1],monAttackProfile(p[0],minionAttackFor(p[0],p[1]))); } } };
  if(C.ts.action>0&&sp.includes('raisebones')&&minionsOf(h).length<minionCap(h)&&(hasSlot(h,1)||(h.res&&h.res.pale>0))){
    const slot=(h.level>=7&&(h.slots[3]||0)>0)?3:(lowestSlot(h,1)||1); C.ts.action--; h._autoCast=true; await castSpell(h,'raisebones',slot,h); if(!G.combat) return true; await command(); return true; }
  const foes=enemiesOf(h).filter(alive).sort((a,b)=>dist(a,h)-dist(b,h)); if(!foes.length) return false;
  if(C.ts.action>0&&sp.includes('siphonsoul')&&hasSlot(h,2)&&h.hp<cMaxHP(h)*0.6){ const t=foes.find(f=>dist(f,h)<=6&&los(map,h.x,h.y,f.x,f.y)); if(t){ C.ts.action--; await castSpell(h,'siphonsoul',lowestSlot(h,2),t); if(G.combat) await command(); return true; } }
  if(C.ts.action>0&&sp.includes('ossuaryburst')&&hasSlot(h,3)){ const mine=minionsOf(h); const b=mine.find(m=>m.hp<m.hpMax*0.5&&foes.filter(f=>dist(f,m)<=1).length>=2); if(b){ C.ts.action--; await castSpell(h,'ossuaryburst',lowestSlot(h,3),h); return true; } }
  const cant=heroCantrips(h).filter(s=>SPELLS[s]&&SPELLS[s].dmg&&SPELLS[s].tg==='enemy'&&(SPELLS[s].atk||SPELLS[s].sv)); const adj=adjacentFoes(h).length;
  for(const s of cant.sort((a,b)=>(SPELLS[b].dt==='necrotic')-(SPELLS[a].dt==='necrotic'))){ const S=SPELLS[s]; if(adj&&S.atk==='r') continue; const t=foes.find(f=>dist(f,h)<=S.r&&los(map,h.x,h.y,f.x,f.y)); if(t&&C.ts.action>0){ await command(); C.ts.action--; await castSpell(h,s,0,t,t.x,t.y); return true; } }
  await command(); return false; }
// ---------- UI ----------
UI.minionBar=function(m){ const C=G.combat, ts=C.ts; const b=document.getElementById('actions'); b.innerHTML=''; const map=G.run.map; UI.refreshInit();
  const B=bfs(map,m.x,m.y,Math.max(0,ts.move),monBlocked(m)); R.hl.reach=new Set([...B.dist.keys()].filter(k=>B.dist.get(k)>0)); UI._reach=B;
  const foes=enemiesOf(m).filter(alive); R.hl.targets=new Set(foes.filter(f=>minionAttackFor(m,f))); R.dirty=true; const own=minionOwner(m);
  b.appendChild(el('div',{class:'tstat'},el('b',null,cName(m)),el('span',null,'HP '+m.hp+'/'+m.hpMax+' · Move '+ts.move),el('span',{class:'pips'},el('i',{class:ts.action>0?'on':''},'A'))));
  const add=(ic,t,fn,ok,id,tip)=>b.appendChild(el('button',{class:'abtn'+(ok?'':' dis'),id:id||null,title:tip||'',onclick:e=>{ e.stopPropagation(); if(ok) fn(); }},el('span',{class:'ai'},ic),el('span',{class:'al'},t)));
  const md=mdef(m); add('⚔','Attack',()=>toast('Tap a highlighted enemy to attack.'),ts.action>0,'b-matk',md.atks.map(a=>a.n+' +'+a.hit+' '+a.dmg).join('; '));
  const runAuto=async()=>{ b.innerHTML=''; R.hl.reach=null; R.hl.targets=null; await monsterTurn(m); endHeroTurn(); };
  add('🤖','Auto turn',runAuto,ts.action>0,'b-mauto','Let the minion act on its own this turn.');
  add('♾','Always Auto',()=>{ m.ctl='auto'; if(own) own.minionCtl='auto'; minionsOf(own||{id:m.owner}).forEach(x=>x.ctl='auto'); toast('Minions act on their own.'); runAuto(); },true,'b-malways');
  add('⏭','End',()=>{ R.hl.reach=null; R.hl.targets=null; endHeroTurn(); },true,'b-mend');
};
(function(){ const _cb=UI.combatBar; UI.combatBar=function(h){ _cb.call(UI,h); const ms=minionsOf(h); if(!ms.length) return; const b=document.getElementById('actions'); const man=(h.minionCtl||'auto')==='manual';
  b.appendChild(el('button',{class:'abtn',id:'b-minctl',title:'Switch between commanding your minions by hand and letting them act on their own.',onclick:e=>{ e.stopPropagation(); h.minionCtl=man?'auto':'manual'; ms.forEach(m=>m.ctl=h.minionCtl); toast('Minions: '+(h.minionCtl==='manual'?'Manual control':'Auto')); UI.combatBar(h); }},el('span',{class:'ai'},ms.every(m=>MINION_KINDS[m.kind]&&MINION_KINDS[m.kind].construct)?'⚙':'💀'),el('span',{class:'al al2'},el('small',null,ms.every(m=>MINION_KINDS[m.kind]&&MINION_KINDS[m.kind].construct)?'Companion':'Minions'),el('span',null,man?'Manual':'Auto')))); }; })();
