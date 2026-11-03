// ===== Shared combat/exploration core: effects, checks, saves, damage =====
const sleep=ms=>new Promise(r=>setTimeout(r,G.fast?0:ms));
function mdef(c){ return c.def||MONSTERS[c.mid]; }
function cName(c){ return c.isHero?c.name:mdef(c).n; }
function cMaxHP(c){ return c.isHero?heroMaxHP(c):c.hpMax; }
function hasFx(c,id){ return (c.fx||[]).some(e=>e.id===id); }
function getFx(c,id){ return (c.fx||[]).find(e=>e.id===id); }
function addFx(c,e){ c.fx=c.fx||[]; const ex=c.fx.find(x=>x.id===e.id&&(!e.src||x.src===e.src)); if(ex){ Object.assign(ex,e); return ex; } c.fx.push(e); R.dirty=true; return e; }
function remFx(c,id,src){ c.fx=(c.fx||[]).filter(e=>!(e.id===id&&(!src||e.src===src))); R.dirty=true; }
function alive(c){ return c && c.hp>0 && c.status!=='fallen' && !c.dead; }
function downed(c){ return c.isHero && c.hp<=0 && c.status!=='fallen'; }
function onMap(c){ return c.x!=null && !hasFx(c,'banished'); }
const INCAP=['paralyzed','stunned','unconscious','asleep','incapacitated','banished'];
function incapacitated(c){ return c.hp<=0 || INCAP.some(k=>hasFx(c,k)); }
function isUndeadOrFiend(c){ return !c.isHero && ['undead','fiend'].includes(mdef(c).type); }
function cType(c){ return c.isHero?'humanoid':mdef(c).type; }
function condImmune(c,cond){
  if(!c.isHero){ const m=mdef(c); if((m.condImm||[]).includes(cond)) return true; return false; }
  const F=heroFeatures(c);
  if(cond==='charmed'||cond==='frightened'){ if(hasFx(c,'raging')&&F.has('mindless')) return true; if(paladinAura(c,cond==='charmed'?'auraDevotion':'auraCourage')) return true; if(cond==='frightened'&&hasFx(c,'heroism')) return true; }
  if((cond==='poisoned'||cond==='disease')&&(F.has('purity')||F.has('naturesWard'))) return true;
  if(cond==='paralyzed'&&hasFx(c,'freedom')) return true; if(cond==='restrained'&&hasFx(c,'freedom')) return true;
  return false;
}
function paladinAura(c,feat){ for(const h of activeParty()){ if(!alive(h)||h.x==null) continue; if(heroFeatures(h).has(feat)&&dist(h,c)<=2) return h; } return null; }
function allies(c){ if(c.isHero) return activeParty().filter(h=>h.x!=null&&h.status!=='fallen'); if(c.ally) return activeParty().filter(h=>h.x!=null&&h.status!=='fallen').concat(partyMinions()); return combatMonsters(); }
function enemiesOf(c){ if(c.isHero||c.ally) return combatMonsters().filter(alive); return activeParty().filter(h=>h.x!=null&&h.status!=='fallen'&&!hasFx(h,'banished')).concat(partyMinions().filter(m=>!hasFx(m,'banished')&&(!G.combat||m.inCombat))); }
function combatMonsters(){ if(!G.run||!G.run.map) return []; return G.run.map.ents.filter(e=>e.type==='mon'&&!e.ally&&e.hp>0&&(G.combat?e.inCombat:true)&&!hasFx(e,'banished')); }
function adjacentFoes(c){ return enemiesOf(c).filter(e=>alive(e)&&!incapacitated(e)&&dist(e,c)<=1); }
function cAC(c){
  let ac=c.isHero?heroAC(c):mdef(c).ac;
  if(hasFx(c,'shieldspell')) ac+=5; if(hasFx(c,'shieldfaith')) ac+=2; if(hasFx(c,'hasted')) ac+=2; if(hasFx(c,'slowed')) ac-=2;
  if(hasFx(c,'barkskin')) ac=Math.max(ac,16); if(hasFx(c,'multidef')) ac+=4; if(hasFx(c,'parried')) ac+=3;
  if(c.isHero){ for(const h of activeParty()){ if(h===c||!alive(h)||h.x==null) continue; if(dist(h,c)<=1){ if(heroFeatures(h).has('holdLine')) { ac+=1; break; } if(hasFeat(h,'shieldwall')&&shieldOf(h)){ ac+=1; break; } } } }
  const ws=getFx(c,'wildshape'); if(ws) ac=Math.max(ac,BEASTS[ws.beast].ac);
  return ac;
}
function cSpeedTiles(c){
  let s=c.isHero?heroSpeed(c):mdef(c).spd; if(hasFx(c,'longstrider')) s+=10; if(hasFx(c,'slowray')) s-=10;
  const ws=getFx(c,'wildshape'); if(ws) s=BEASTS[ws.beast].spd;
  if(hasFx(c,'hasted')) s*=2; if(hasFx(c,'slowed')) s=Math.floor(s/2);
  if(hasFx(c,'grappled')||hasFx(c,'restrained')) s=0;
  if(c.isHero&&c.exhaust>=2) s=Math.floor(s/2);
  return Math.max(0,Math.floor(s/5));
}
// ===== d20 tests =====
function rollD20For(c,adv,dis){ const lucky=c.isHero&&RACES[c.race].lucky; return d20(advNet(adv,dis),lucky); }
function extraDie(c,kind){ // bless/bane/guidance etc.
  let b=0, parts=[];
  if(kind!=='check'){ if(hasFx(c,'blessed')){ const r=die(4); b+=r; parts.push('bless+'+r); } if(hasFx(c,'baned')){ const r=die(4); b-=r; parts.push('bane-'+r); } }
  if(kind==='check'&&hasFx(c,'guidance')){ const r=die(4); b+=r; parts.push('guid+'+r); remFx(c,'guidance'); }
  if(kind==='save'&&hasFx(c,'resistance')){ const r=die(4); b+=r; parts.push('res+'+r); remFx(c,'resistance'); }
  const ins=getFx(c,'inspired'); if(ins&&kind!=='dmg'){ const r=rollDice(ins.die).total; b+=r; parts.push('insp+'+r); remFx(c,'inspired'); }
  return {b,parts};
}
function skillCheck(c,sk,dc,opts){
  opts=opts||{}; let adv=opts.adv?1:0, dis=0;
  if(c.isHero){ const g=gearFx(c); if(g.advSkill===sk) adv++; if(hasFx(c,'enhance')) adv++; if(sk==='stealth'){ const a=armorOf(c); if(a&&a.stealthDis&&!(c.eq.armor&&itemFx(c.eq.armor).noStealthDis)) dis++; if(heroFeatures(c).has('supremeSneak')) adv++; }
    if(SKILLS[sk]==='int'&&injuryMod(c,'intDis')) dis++; if((sk==='sleight'||sk==='tools')&&injuryMod(c,'handsDis')) dis++; if(hasFx(c,'diseased')) dis++; if(SKILLS[sk]==='str'&&hasFx(c,'raging')) adv++; if(opts.favored) adv++;
  }
  if(hasFx(c,'poisoned')||hasFx(c,'frightened')) dis++;
  if(c.exhaust>=1) dis++;
  const r=rollD20For(c,adv,dis); let bonus=skillBonus(c,sk)+(opts.bonus||0); const ex=extraDie(c,'check'); bonus+=ex.b;
  if(opts.passtrace&&sk==='stealth') bonus+=10;
  let total=r.r+bonus; let ok=dc==null?null:total>=dc; let note='';
  if(dc!=null&&!ok&&c.isHero&&c.res&&c.res.dluck>0){ const x=die(10); total+=x; c.res.dluck--; note=' (Dark One\'s Luck +'+x+')'; ok=total>=dc; }
  const txt=cName(c)+' — '+(SKILL_NAME[sk]||sk)+': '+diceTxt(r)+' '+fmtMod(bonus)+' = '+total+(dc!=null?' vs DC '+dc+(ok?' ✔ success':' ✖ failure'):'')+note;
  return {ok,total,roll:r.r,nat:r.r,txt};
}
function diceTxt(r){ return r.rolls.length>1?('d20['+r.rolls.join(',')+(r.adv>0?'↑':'↓')+']'):('d20['+r.r+']'); }
function bestHero(sk,list){ list=(list||activeParty()).filter(h=>alive(h)); return list.sort((a,b)=>skillBonus(b,sk)-skillBonus(a,sk))[0]; }
// Saving throw
function doSave(c,a,dc,opts){
  opts=opts||{}; let adv=0, dis=0;
  if(INCAP.slice(0,3).some(k=>hasFx(c,k))&&(a==='str'||a==='dex')) return {ok:false,total:0,txt:cName(c)+' automatically fails the '+a.toUpperCase()+' save.'};
  if(c.isHero){ const F=heroFeatures(c), r=RACES[c.race];
    if(a==='dex'&&F.has('dangerSense')&&!hasFx(c,'blinded')) adv++;
    if(a==='str'&&hasFx(c,'raging')) adv++;
    if(opts.cond==='poisoned'||opts.dt==='poison'){ if(r.resist&&r.resist.includes('poison')) adv++; if(hasFx(c,'antitoxin')) adv++; }
    if(opts.magic&&r.gnomeCunning&&['int','wis','cha'].includes(a)) adv++;
    if(opts.cond==='frightened'&&(r.brave||hasFeat(c,'ironwill')||F.has('grimResolve'))) adv++;
    if(opts.cond==='charmed'&&(r.feyAncestry||hasFeat(c,'ironwill'))) adv++;
    if((opts.cond==='frightened'||opts.cond==='charmed')&&activeParty().some(h=>h!==c&&alive(h)&&heroFeatures(h).has('countercharm')&&h.x!=null&&dist(h,c)<=6)) adv++;
    if(opts.magic&&equippedItems(c).some(it=>itemFx(it).magicSaveAdv)) adv++;
    if(opts.conc&&hasFeat(c,'focus')) adv++;
    if(a==='con'&&injuryMod(c,'conSaveDis')) dis++; if(opts.cond==='frightened'&&injuryMod(c,'fearDis')) dis++;
  } else { const m=mdef(c); if(opts.magic&&(m.traits||[]).includes('magicResistance')) adv++; if((opts.cond==='charmed'||opts.cond==='frightened')&&(m.traits||[]).some(t=>t==='darkDevotion'||t==='brave'||t==='feyAncestry')) adv++; if(opts.turn&&(m.traits||[]).includes('turnDefiance')) adv++; if(opts.disadv) dis++; }
  if(a==='dex'&&hasFx(c,'dodging')) adv++;
  if(a==='dex'&&hasFx(c,'restrained')) dis++;
  if(c.exhaust>=3) dis++;
  if(opts.adv) adv++;
  const r=rollD20For(c,adv,dis); let bonus=saveBonus(c,a); const ex=extraDie(c,'save'); bonus+=ex.b;
  if(c.isHero){ const p=paladinAura(c,'auraProt'); if(p) bonus+=Math.max(1,abilMod(p,'cha')); if(hasFx(c,'hasted')&&a==='dex') adv++; }
  let total=r.r+bonus, ok=total>=dc, note='';
  if(!ok&&c.isHero){
    if(c.res&&c.res.indom>0&&dc-total<=10){ const r2=rollD20For(c,0,0); c.res.indom--; total=r2.r+bonus; ok=total>=dc; note=' · Indomitable reroll '+r2.r; }
    else if(c.res&&c.res.luck>0){ const r2=rollD20For(c,0,0); c.res.luck--; total=r2.r+bonus; ok=total>=dc; note=' · Lucky Star reroll '+r2.r; }
    else if(c.res&&c.res.dluck>0&&dc-total<=6){ const x=die(10); c.res.dluck--; total+=x; ok=total>=dc; note=' · Dark Luck +'+x; }
  }
  return {ok,total,txt:cName(c)+' '+a.toUpperCase()+' save: '+diceTxt(r)+' '+fmtMod(bonus)+' = '+total+' vs DC '+dc+(ok?' ✔':' ✖')+note};
}
// resistances
function resistMult(c,dt,magical){
  if(dt==='none') return 0;
  if(c.isHero){ const F=heroFeatures(c), r=RACES[c.race]; const g=gearFx(c); let res=(r.resist||[]).concat(g.resist||[]);
    if(c.race==='dragonborn') res.push(DRAGON_ANCESTRY[c.dragon]);
    if(F.has('deathless')&&dt==='necrotic') return 0.5;
    if(hasFx(c,'raging')&&['bludgeoning','piercing','slashing'].includes(dt)) return 0.5;
    if(hasFx(c,'raging')&&F.has('ashenHide')&&(dt==='fire'||dt==='cold')) return 0.5;
    if(hasFx(c,'stoneskin')&&!magical&&['bludgeoning','piercing','slashing'].includes(dt)) return 0.5;
    if(F.has('stoneSkin')&&!magical&&['bludgeoning','piercing','slashing'].includes(dt)) return 0.5;
    if(F.has('fungalBody')&&(dt==='poison'||dt==='necrotic')) return 0.5;
    if((F.has('graveTouched')||F.has('grimResolve')||F.has('shroud'))&&dt==='necrotic') return 0.5;
    if(F.has('fiendRes')&&dt==='fire') return 0.5; if(F.has('ashCloak')&&dt==='fire') return 0.5;
    if((F.has('purity')||F.has('naturesWard'))&&dt==='poison') return 0;
    if(dt==='necrotic'&&paladinAura(c,'auraEmbers')) return 0.5;
    if(hasFx(c,'resistall')&&['fire','cold','necrotic'].includes(dt)) return 0.5;
    if(hasFx(c,'resistspell')&&getFx(c,'resistspell').dt===dt) return 0.5;
    return res.includes(dt)?0.5:1;
  }
  const m=mdef(c); const bps=['bludgeoning','piercing','slashing'].includes(dt);
  if((m.immune||[]).includes(dt)) return 0; if(bps&&!magical&&(m.immune||[]).includes('bps')) return 0;
  let mult=1; if((m.resist||[]).includes(dt)||(bps&&!magical&&(m.resist||[]).includes('bps'))) mult=0.5;
  if((m.vuln||[]).includes(dt)) mult*=2; if(hasFx(c,'stoneskin')&&bps&&!magical) mult*=0.5;
  return mult;
}
// apply damage. src may be null. opts: {magical, crit, attack:true, melee}
function dealDamage(target,amt,dt,src,opts){
  opts=opts||{}; if(!alive(target)&&!downed(target)) return 0;
  let mult=resistMult(target,dt,opts.magical); if(opts.ignoreRes&&mult===0.5) mult=1;
  if(!target.isHero&&(mdef(target).traits||[]).includes('lightningAbsorb')&&dt==='lightning'){ healC(target,Math.floor(amt)); log(cName(target)+' absorbs the lightning!','m'); return 0; }
  if(!target.isHero&&(mdef(target).traits||[]).includes('acidAbsorb')&&dt==='acid'){ healC(target,Math.floor(amt)); return 0; }
  let d=Math.floor(amt*mult);
  if(d<=0){ if(mult===0) floater(target.x,target.y,'immune','#aaa'); return 0; }
  // downed hero: damage = failed death save
  if(downed(target)){ target.deathS.f+=opts.crit?2:1; floater(target.x,target.y,'✖','#f44'); log(target.name+' suffers a death save failure.','bad'); checkDeath(target); return d; }
  // reactions: Uncanny Dodge / deflect (melee/ranged attacks)
  if(target.isHero&&opts.attack){ const F=heroFeatures(target);
    if(F.has('uncanny')&&target.reaction&&!incapacitated(target)){ d=Math.ceil(d/2); target.reaction=false; log(target.name+' uses Uncanny Dodge (half damage).','good'); }
    else if(F.has('deflect')&&opts.ranged&&target.reaction&&!incapacitated(target)){ const red=die(10)+abilMod(target,'dex')+target.level; d=Math.max(0,d-red); target.reaction=false; log(target.name+' deflects the missile (-'+red+').','good'); }
  }
  // arcane ward
  const ward=wardFor(target); if(ward&&ward.wardHp>0){ const ab=Math.min(ward.wardHp,d); ward.wardHp-=ab; d-=ab; if(ab) floater(target.x,target.y,'ward -'+ab,'#8ac'); }
  if(target.tempHp>0){ const ab=Math.min(target.tempHp,d); target.tempHp-=ab; d-=ab; }
  const ws=getFx(target,'wildshape'); if(ws&&d>0){ const ab=Math.min(ws.hp,d); ws.hp-=ab; d-=ab; if(ws.hp<=0){ remFx(target,'wildshape'); log(target.name+' is forced out of beast form.','bad'); } }
  target.hp-=d;
  const shown=Math.floor(amt*mult); floater(target.x,target.y,'-'+shown,dt==='fire'?'#ff8a3a':dt==='necrotic'?'#b07ad0':dt==='radiant'?'#ffe08a':dt==='poison'?'#7ad04a':dt==='cold'?'#8ad0ff':dt==='lightning'?'#bfe0ff':'#ff5a4a',opts.crit);
  if(hasFx(target,'asleep')) remFx(target,'asleep');
  // concentration
  if(target.conc&&d>0){ const s=doSave(target,'con',Math.max(10,Math.floor(shown/2)),{conc:1}); if(!s.ok){ log(cName(target)+' loses concentration on '+SPELLS[target.conc.spell].n+'.','bad'); endConc(target); } }
  if(src&&src.isHero&&opts.spell&&dt==='necrotic'&&shown>0&&heroFeatures(src).has('lifeSiphon')&&alive(src)){ const k=G.combat?G.combat.round+':'+G.combat.idx:'x'+Date.now(); if(src._siph!==k){ src._siph=k; const g=healC(src,Math.max(1,abilMod(src,'int'))); if(g) log(src.name+' siphons '+g+' HP (Life Siphon).','good'); } }
  if(target.hp<=0) onDrop(target,src,opts,shown);
  R.dirty=true; if(typeof UI!=='undefined') UI.refreshParty();
  return shown;
}
function wardFor(t){ if(t.isHero&&t.wardHp>0) return t; if(t.isHero){ for(const h of activeParty()){ if(h!==t&&h.wardHp>0&&heroFeatures(h).has('projWard')&&h.x!=null&&dist(h,t)<=1) return h; } } return null; }
function healC(c,amt,src){
  if(c.status==='fallen') return 0; if(hasFx(c,'noheal')){ log(cName(c)+' cannot regain HP this round.','bad'); return 0; }
  const max=cMaxHP(c); const was=c.hp; if(c.hp<0) c.hp=0; c.hp=Math.min(max,c.hp+amt); const got=c.hp-Math.max(0,was);
  if(c.isHero&&was<=0&&c.hp>0){ remFx(c,'unconscious'); c.deathS={s:0,f:0}; log(c.name+' regains consciousness!','good'); }
  if(got>0) floater(c.x,c.y,'+'+got,'#7af07a'); R.dirty=true; if(typeof UI!=='undefined') UI.refreshParty(); return got;
}
function onDrop(t,src,opts,amt){
  if(t.isHero){
    const F=heroFeatures(t);
    if(t.res&&t.res.relent>0&&t.hp>-cMaxHP(t)){ t.res.relent--; t.hp=1; log(t.name+' refuses to fall! (Relentless Endurance)','good'); return; }
    const mw=activeParty().find(h=>h!==t&&alive(h)&&h.res&&h.res.mward>0&&h.x!=null&&dist(h,t)<=6); if(mw){ mw.res.mward--; t.hp=1; log(mw.name+'\'s Mourning Ward holds '+t.name+' at 1 HP.','good'); return; }
    if(hasFx(t,'deathward')){ remFx(t,'deathward'); t.hp=1; log('Death Ward saves '+t.name+'!','good'); return; }
    if(t.hp<=-cMaxHP(t)){ t.hp=0; fallHero(t,'massive damage'); return; }
    t.hp=0; t.deathS={s:0,f:0}; t._downed=true; addFx(t,{id:'unconscious',rounds:-1}); addFx(t,{id:'prone',rounds:-1}); endConc(t); remFx(t,'raging');
    log(t.name+' falls unconscious!','bad'); floater(t.x,t.y,'DOWN','#f33',true);
    if(!G.combat) setTimeout(()=>{ if(!G.run||G.combat) return; if(activeParty().filter(h=>h.x!=null).every(h=>!alive(h))){ if(!G.run.tpk) tpk(); return; } if(t.hp<=0&&t.status!=='fallen'){ t.hp=1; remFx(t,'unconscious'); remFx(t,'prone'); const inj=addInjury(t,1); log(t.name+' is bound up by the others and staggers on at 1 HP'+(inj?' ('+inj.n+')':'')+'.','bad'); UI.refreshParty(); } },0);
    if(gearFx(t).autoStable){ t.deathS.s=3; log(t.name+' is stabilized by the Periapt.','good'); }
    const req=activeParty().find(h=>h!==t&&alive(h)&&heroFeatures(h).has('requiem')); if(req){ addFx(t,{id:'requiemAdv',rounds:-1}); if(req.res) req.res.insp=(req.res.insp||0)+1; }
    return;
  }
  // monster
  const m=mdef(t);
  if((m.traits||[]).includes('undeadFortitude')&&!opts.crit&&opts.dt!=='radiant'){ const s=doSave(t,'con',5+amt,{}); if(s.ok){ t.hp=1; log(m.n+' shrugs off death! (Undead Fortitude)','m'); return; } }
  if((m.traits||[]).includes('relentless')&&!t._relent&&amt<=14){ t._relent=1; t.hp=1; log(m.n+' keeps fighting! (Relentless)','m'); return; }
  if(t.ally){ t.hp=0; t.dead=true; endConc(t); log(m.n+' collapses into bones and grave-dust.','bad'); floater(t.x,t.y,'☠','#9c9',true); setTimeout(()=>removeMinion(t),0); return; }
  t.hp=0; t.dead=true; endConc(t); log(m.n+' is slain.','good'); floater(t.x,t.y,'☠','#ddd',true);
  if(G.combat) G.combat.xp+=(CR_XP[m.cr]||10)*(m.boss?2:1);
  G.run.kills.push(t.mid); questKill(m);
  // drops
  const drops=monsterDrops(m,G.run.tier); if(drops.length||Math.random()<0.5){ G.run.map.ents.push({type:'loot',x:t.x,y:t.y,items:drops,gold:Math.random()<0.5?Math.round((m.cr+0.5)*(5+rnd(15))):0}); }
  if(m.boss) onBossKilled(t);
  if(src&&src.ally){ const ow=minionOwner(src); if(ow&&ow.status!=='fallen') src=ow; }
  if(src&&src.isHero){ src.kills=(src.kills||0)+1; const F=heroFeatures(src);
    if(F.has('soulHarvest')){ const thp=Math.max(1,abilMod(src,'int'))+src.level; src.tempHp=Math.max(src.tempHp||0,thp); log(src.name+' harvests the fleeing soul: '+thp+' temp HP.','good'); }
    if(F.has('fiendBless')||(F.has('graveTouched')&&opts.spell)){ const thp=Math.max(1,abilMod(src,'cha'))+src.level; src.tempHp=Math.max(src.tempHp||0,thp); log(src.name+' gains '+thp+' temp HP from the kill.','good'); }
    if(F.has('bloodlust')){ healC(src,die(6)+src.level); }
  }
}
function fallHero(h,why){ h.hp=0; h.status='fallen'; h._fallen=true; remFx(h,'unconscious'); endConc(h); log('✝ '+h.name+' has fallen'+(why?' ('+why+')':'')+'. They will be carried home.','bad'); floater(h.x,h.y,'FALLEN','#f33',true);
  if(G.run&&G.run.grace&&G.tavern.shrine>=3){ G.run.grace=false; h.status='ok'; h.hp=1; h._fallen=false; h.deathS={s:0,f:0}; log('The Cathedral of Ash answers: '+h.name+' is pulled back from death!','good'); }
}
function checkDeath(h){ if(h.deathS.f>=3) fallHero(h); }
function endConc(c){ if(!c.conc) return; const k=c.conc; c.conc=null;
  const all=[...activeParty(),...(G.run&&G.run.map?G.run.map.ents.filter(e=>e.type==='mon'):[])];
  for(const x of all){ if(x.fx) x.fx=x.fx.filter(e=>e.conc!==cUid(c)); }
  if(G.combat) G.combat.zones=G.combat.zones.filter(z=>z.conc!==cUid(c));
  if(k.spell==='aid'){} R.dirty=true; }
function cUid(c){ return c.isHero?c.id:c.uid; }
function startConc(c,spell){ if(c.conc) { log(cName(c)+' drops concentration on '+SPELLS[c.conc.spell].n+'.'); endConc(c); } cUid(c); c.conc={spell}; }
function applyCond(t,cond,rounds,src,extra){ if(condImmune(t,cond)){ log(cName(t)+' is immune to '+cond+'.'); return false; } addFx(t,Object.assign({id:cond,rounds:rounds||-1,src:src?cUid(src):null},extra||{})); floater(t.x,t.y,cond,'#e0c0ff'); return true; }
// questing hooks
function questKill(m){ for(const q of (G.quests.active||[])){ const d=SIDE_QUESTS[q.id]||q.def; if(!d||d.type!=='kill') continue; const tag=d.tag; const id=m.id;
  const match= tag===m.type || tag===m.art || id===tag || (tag==='wolf'&&/wolf|worg/.test(id)) || (tag==='rot'&&['aberration','ooze'].includes(m.type)) || (tag==='goblinoid'&&m.art==='goblinoid') || (d.mid&&d.mid===id);
  if(match&&q.progress<d.count){ q.progress++; if(q.progress>=d.count) toast('Quest objective complete: '+d.n); } } }
function log(msg,cls){ if(G.run){ G.run.log.push({t:msg,c:cls||''}); if(G.run.log.length>200) G.run.log.shift(); } if(typeof UI!=='undefined') UI.addLog(msg,cls); }
function toast(msg){ if(typeof UI!=='undefined') UI.toast(msg); }
function logJournal(t){ if(!G.journal) return; G.journal.unshift({day:G.day,t}); if(G.journal.length>300) G.journal.pop(); }
function unlockCodex(id){ if(!CODEX[id]||G.codex.includes(id)) return false; G.codex.push(id); toast('📜 Codex: '+CODEX[id].n); return true; }
// wild shape beasts (SRD)
const BEASTS={ wolf:{n:'Wolf',hp:11,ac:13,spd:40,atk:{n:'Bite',hit:4,dmg:'2d4+2',dt:'piercing'},lvl:2}, bear:{n:'Brown Bear',hp:34,ac:11,spd:40,atk:{n:'Claws',hit:6,dmg:'2d6+4',dt:'slashing'},lvl:4}, direwolf:{n:'Dire Wolf',hp:37,ac:14,spd:50,atk:{n:'Bite',hit:5,dmg:'2d6+3',dt:'piercing'},lvl:6} };
function beastFor(h){ return h.level>=6?'direwolf':h.level>=4?'bear':'wolf'; }
function addInjury(h,maxSev){ const pool=INJURIES.filter(i=>i.sev<=maxSev&&!(h.injuries||[]).some(x=>x.id===i.id)); if(!pool.length) return null; const inj=pick(pool); h.injuries=h.injuries||[]; h.injuries.push({id:inj.id,days:inj.days}); h._fcache=null; logJournal(h.name+' suffered a lasting injury: '+inj.n+'.'); return inj; }
