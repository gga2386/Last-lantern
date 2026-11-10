// ===== Combat: attacks, spells, turns, monster AI =====
const MON_SPELL={inflict:'inflictwounds',hold:'holdperson',heal:'curewounds',charm:'charmperson',cone:'coneofcold',lightning:'lightningbolt'};
function cantripTier(c){ const l=c.isHero?c.level:Math.max(1,Math.ceil(mdef(c).cr*2)); return l>=11?3:l>=5?2:1; }
// ---------- weapon profiles ----------
function isMonkWeapon(base){ if(!base) return true; const w=WEAPONS[base]; return base==='shortsword'||(w.cat==='simple'&&!w.p.includes('two')&&!w.p.includes('heavy')&&!w.p.includes('ranged')); }
function weaponProfile(h,it,mode){
  const F=heroFeatures(h), tog=h.tog||{};
  if(!it){ // unarmed
    const ma=F.has('martialArts'); const ab=ma&&abilMod(h,'dex')>abilMod(h,'str')?'dex':'str'; const mod=abilMod(h,ab);
    const p={id:'unarmed',n:'Unarmed Strike',ab,hit:mod+profFor(h.level),dmg:ma?martialDie(h):'1',dmgB:mod,dt:'bludgeoning',reach:1,melee:true,magical:F.has('kiStrikes'),crit:20,extra:[],light:true,unarmed:true};
    if(hasFx(h,'emberfists')) p.extra.push({d:'1d6',dt:'fire'}); if(hasFx(h,'raging')) p.dmgB+=rageBonus(h);
    return p;
  }
  const w=WEAPONS[it.base]; const fx=itemFx(it); const ranged=w.p.includes('ranged'); const thrown=mode==='thrown';
  let ab='str'; if(ranged) ab='dex'; else if(w.p.includes('finesse')&&abilMod(h,'dex')>abilMod(h,'str')) ab='dex';
  if(F.has('martialArts')&&isMonkWeapon(it.base)&&abilMod(h,'dex')>abilMod(h,ab)) ab='dex';
  if(h.pactBlade&&abilMod(h,'cha')>abilMod(h,ab)&&!ranged) ab='cha';
  if(hasFx(h,'shillelagh')&&(it.base==='club'||it.base==='quarterstaff')) ab=abilMod(h,'wis')>abilMod(h,ab)?'wis':ab;
  const mod=abilMod(h,ab); const prof=weaponProf(h,it.base)||(h.pactBlade&&!ranged);
  let hit=mod+(prof?profFor(h.level):0)+(it.plus||0)+(fx.hit||0);
  const twoHand=!h.eq.off; let d=(w.vd&&twoHand)?w.vd:w.d; if(hasFx(h,'shillelagh')&&(it.base==='club'||it.base==='quarterstaff')) d='1d8';
  if(F.has('martialArts')&&isMonkWeapon(it.base)&&avgDice(martialDie(h))>avgDice(d)) d=martialDie(h);
  let dmgB=(mode==='off'&&!(h.style==='twf'||h.style2==='twf'))?Math.min(0,mod):mod; dmgB+=(it.plus||0)+(fx.dmg||0);
  const style=s=>h.style===s||h.style2===s;
  if((ranged||thrown)&&style('archery')) hit+=2;
  if(!ranged&&!thrown&&style('dueling')&&!w.p.includes('two')&&!(h.eq.off&&h.eq.off.kind==='weapon')) dmgB+=2;
  if(!ranged&&!thrown&&hasFx(h,'raging')&&ab==='str') dmgB+=rageBonus(h);
  if(hasFx(h,'magicweapon')){ hit+=1; dmgB+=1; } const ew=getFx(h,'elemweapon');
  const sw=getFx(h,'sacredweapon'); if(sw) hit+=Math.max(1,abilMod(h,'cha'));
  const extra=[]; if(fx.extra) extra.push({d:fx.extra,dt:fx.extraType||w.dt}); if(ew){ hit+=1; extra.push({d:'1d4',dt:'fire'}); }
  if(hasFx(h,'divinefavor')) extra.push({d:'1d4',dt:'radiant'});
  if(hasFx(h,'emberfists')&&F.has('martialArts')&&isMonkWeapon(it.base)) extra.push({d:'1d6',dt:'fire'});
  const power=tog.power&&((hasFeat(h,'cleaver')&&w.p.includes('heavy')&&!ranged)||(hasFeat(h,'deadeye')&&ranged));
  if(power){ hit-=5; dmgB+=10; }
  let crit=20; if(F.has('improvedCrit')) crit=19; if(fx.crit) crit=Math.min(crit,fx.crit);
  const reach=w.p.includes('reach')?2:1;
  return {id:it.uid,item:it,n:itemName(it),ab,hit,dmg:d,dmgB,dt:fx.dtOverride||w.dt,reach,melee:!(ranged||thrown),ranged:ranged||thrown,r:w.r||0,lr:w.lr||0,magical:!!(it.plus||it.magic||fx.magical||h.pactBlade||hasFx(h,'magicweapon')||ew),silvered:!!it.silvered,crit,extra,vs:fx.vs||null,finesse:w.p.includes('finesse'),heavy:w.p.includes('heavy'),light:w.p.includes('light'),gwf:style('gwf')&&w.p.includes('two')&&!ranged,critBonus:fx.critBonus||0,lifesteal:fx.lifesteal||0,vorpal:fx.vorpal,power,thrown,mode};
}
function rageBonus(h){ return h.level>=9?3:2; }
function heroAttackOptions(h){
  const ws=getFx(h,'wildshape'); if(ws){ const b=BEASTS[ws.beast]; return [{id:'beast',n:b.atk.n+' ('+b.n+')',hit:b.atk.hit,dmg:b.atk.dmg,dmgB:0,dt:b.atk.dt,reach:1,melee:true,crit:20,extra:[]}]; }
  const out=[]; const m=h.eq.main;
  if(m&&WEAPONS[m.base]&&!WEAPONS[m.base].p.includes('ranged')) out.push(weaponProfile(h,m,'main')); else if(!m) out.push(weaponProfile(h,null,'unarmed'));
  if(m&&WEAPONS[m.base]&&WEAPONS[m.base].p.includes('ranged')) out.push(weaponProfile(h,m,'main'));
  const r=h.eq.ranged; if(r&&WEAPONS[r.base]) out.push(weaponProfile(h,r,WEAPONS[r.base].p.includes('ranged')?'ranged':'thrown'));
  return out;
}
function monAttackProfile(m,a){ const md=mdef(m); const ranged=a.r>2; return {id:a.n,n:a.n,hit:a.hit,dmg:a.dmg,dmgB:0,dt:a.dt,reach:ranged?0:a.r,melee:!ranged,ranged,r:ranged?a.r:0,lr:ranged?(a.lr||a.r):0,magical:md.cr>=4||!!md.boss,crit:20,extra:a.bonus?[{d:a.bonus,dt:a.bonusType||a.dt}]:[],atk:a}; }
function inRange(att,tgt,p){ const d=dist(att,tgt); if(p.melee) return d<=p.reach; return d<=p.lr&&los(G.run.map,att.x,att.y,tgt.x,tgt.y); }
// ---------- advantage ----------
function attackAdvantage(att,tgt,p,spellAtk){
  let adv=0,dis=0; const why=[];
  const d=dist(att,tgt);
  if(hasFx(att,'hidden')||hasFx(att,'invisible')){ adv++; why.push('unseen'); }
  if(hasFx(tgt,'invisible')&&!(att.isHero&&equippedItems(att).some(i=>itemFx(i).seeInvis))){ dis++; why.push('invisible target'); }
  if(hasFx(att,'poisoned')){ dis++; why.push('poisoned'); } if(hasFx(att,'blinded')){ dis++; why.push('blinded'); }
  if(hasFx(att,'restrained')) dis++; if(hasFx(att,'prone')) dis++;
  if(hasFx(att,'frightened')) { dis++; why.push('frightened'); }
  if(hasFx(tgt,'restrained')||hasFx(tgt,'paralyzed')||hasFx(tgt,'stunned')||hasFx(tgt,'unconscious')||hasFx(tgt,'asleep')||hasFx(tgt,'blinded')){ adv++; why.push('helpless target'); }
  if(hasFx(tgt,'outlined')){ adv++; why.push('outlined'); }
  if(hasFx(tgt,'prone')){ if(d<=1) {adv++; why.push('prone');} else dis++; }
  if(hasFx(tgt,'dodging')&&!incapacitated(tgt)){ dis++; why.push('dodging'); }
  if(hasFx(tgt,'blur')) dis++;
  if(hasFx(tgt,'reckless')) { adv++; why.push('reckless'); }
  if(att.isHero&&att.tog&&att.tog.reckless&&p&&p.melee&&p.ab==='str'&&heroFeatures(att).has('reckless')){ adv++; why.push('reckless'); }
  if(hasFx(att,'warcry')){ adv++; remFx(att,'warcry'); why.push('war cry'); }
  if(hasFx(att,'helped')){ adv++; remFx(att,'helped'); why.push('help'); }
  const ts=getFx(att,'truestrike'); if(ts&&ts.tgt===cUid(tgt)){ adv++; remFx(att,'truestrike'); why.push('true strike'); }
  if(hasFx(att,'mocked')){ dis++; remFx(att,'mocked'); }
  const cur=getFx(att,'cursed'); if(cur&&cur.src===cUid(tgt)) dis++;
  if(p&&p.ranged&&!spellAtk&&d>p.r&&!(att.isHero&&hasFeat(att,'deadeye'))) { dis++; why.push('long range'); }
  if(p&&(p.ranged||spellAtk==='r')&&adjacentFoes(att).length) { dis++; why.push('enemy adjacent'); }
  if(!att.isHero){ const md=mdef(att); if((md.traits||[]).includes('packTactics')&&combatMonsters().some(o=>o!==att&&alive(o)&&!incapacitated(o)&&dist(o,tgt)<=1)) { adv++; why.push('pack tactics'); }
    if(hasFx(tgt,'protevil')&&['undead','fiend','aberration','fey','elemental'].includes(md.type)) dis++;
    if((md.traits||[]).includes('sunlight')&&G.run.daylight) dis++;
    if(tgt.isHero){ for(const h of activeParty()){ if(h!==tgt&&alive(h)&&!incapacitated(h)&&(h.style==='protection'||h.style2==='protection')&&shieldOf(h)&&dist(h,tgt)<=1&&h.reaction){ dis++; h.reaction=false; log(h.name+' interposes a shield (Protection).','good'); break; } } }
    if(G.combat&&G.combat.round===1&&(md.traits||[]).includes('assassinate')) adv++;
  }
  if(att.isHero&&tgt&&!tgt.isHero&&(att.favored||[]).includes(cType(tgt))&&false) adv++;
  if(att.isHero&&hasFeat(att,'grappler')&&hasFx(tgt,'grappled')) adv++;
  return {net:advNet(adv,dis),adv,dis,why};
}
// ---------- the attack ----------
async function doAttack(att,tgt,p,opts){
  opts=opts||{}; const md=att.isHero?null:mdef(att);
  if(hasFx(tgt,'sanctuary')&&!opts.spell){ const s=doSave(att,'wis',getFx(tgt,'sanctuary').dc||13,{magic:1}); await DICE.flush(); if(!s.ok){ log(cName(att)+' cannot bring itself to attack '+cName(tgt)+' (Sanctuary).'); return {hit:false}; } }
  const A=attackAdvantage(att,tgt,p,opts.spell?opts.spellAtk:null);
  const lucky=att.isHero&&RACES[att.race].lucky; let r=d20(A.net,lucky);
  let bonus=p.hit; const ex=extraDie(att,'atk'); bonus+=ex.b; if(att.isHero) bonus+=injuryMod(att,'atk');
  if(att.isHero&&p.ranged&&injuryMod(att,'rangedDis')&&A.net>=0&&!r.adv){ r=d20(-1,lucky); }
  if(att.isHero&&injuryMod(att,'strAtkDis')&&p.ab==='str'&&A.net>=0&&!r.adv){ r=d20(-1,lucky); }
  let total=r.r+bonus; let ac=cAC(tgt);
  let crit=r.r>=(p.crit||20); let hit=crit||(r.r!==1&&total>=ac);
  // reactions of defender
  if(hit&&!crit&&tgt.isHero&&tgt.reaction&&!incapacitated(tgt)&&(heroSpells(tgt).includes('shield'))&&hasSlot(tgt,1)&&total<ac+5){ spendSlot(tgt,1); tgt.reaction=false; addFx(tgt,{id:'shieldspell',rounds:1}); log(tgt.name+' casts Shield! (+5 AC)','good'); ac+=5; hit=false; }
  if(hit&&!crit&&tgt.isHero){ const bard=activeParty().find(h=>alive(h)&&!incapacitated(h)&&h.reaction&&heroFeatures(h).has('cuttingWords')&&h.res&&h.res.insp>0&&h.x!=null&&dist(h,tgt)<=12); if(bard){ const red=rollDice(inspDie(bard)).total; if(total-red<ac){ bard.res.insp--; bard.reaction=false; total-=red; hit=false; log(bard.name+' uses Cutting Words (-'+red+')!','good'); } } }
  if(hit&&!crit&&typeof ARC_defReact==='function'&&ARC_defReact(att,tgt,total,ac)) hit=false;
  if(hit&&!crit&&!tgt.isHero&&tgt.reaction!==false&&(mdef(tgt).traits||[]).includes('parry')&&p.melee&&total<ac+3){ tgt.reaction=false; hit=false; log(cName(tgt)+' parries!','m'); }
  if(!hit&&att.isHero&&att.res&&att.res.luck>0&&ac-total<=8&&r.r!==1){ att.res.luck--; const r2=d20(0,lucky); r=r2; total=r2.r+bonus; crit=r2.r>=(p.crit||20); hit=crit||(r2.r!==1&&total>=ac); log(att.name+' spends a Lucky Star point: reroll '+r2.r+'.'); }
  if(hit&&tgt.isHero&&equippedItems(tgt).some(i=>itemFx(i).noCrit)) crit=false;
  if(hit&&!crit&&(hasFx(tgt,'paralyzed')||hasFx(tgt,'unconscious')||hasFx(tgt,'asleep'))&&dist(att,tgt)<=1) crit=true;
  const advTxt=A.net>0?' (adv: '+A.why.join(', ')+')':A.net<0?' (disadv)':'';
  const txt=cName(att)+' → '+cName(tgt)+' · '+p.n+': '+diceTxt(r)+' '+fmtMod(bonus)+' = '+total+' vs AC '+ac+(crit?' — CRITICAL!':hit?' — hit':' — miss')+advTxt;
  if(att.isHero&&typeof DICE!=='undefined') await DICE.reveal(diceRec(att,'atk',p.n+' → '+cName(tgt),r,bonus,total,ac,hit,{dcLbl:'AC',crit,okTxt:'Hit',failTxt:'Miss',note:advTxt.replace(/^ \(|\)$/g,'')}));
  UI.roll(txt,hit?(crit?'crit':'hit'):'miss'); log(txt,hit?'hit':'miss');
  remFx(att,'hidden'); if(hasFx(att,'invisible')&&!getFx(att,'invisible').greater) remFx(att,'invisible');
  if(!hit){ floater(tgt.x,tgt.y,'miss','#ccc'); await sleep(350); return {hit:false}; }
  // damage
  let dmg=rollDice(p.dmg,{crit,gwf:p.gwf}).total+p.dmgB; const parts=[[dmg,p.dt]];
  for(const e of (p.extra||[])) parts.push([rollDice(e.d,{crit}).total,e.dt]);
  if(p.vs){ const ty=cType(tgt); if(p.vs[ty]) parts.push([rollDice(p.vs[ty],{crit}).total,p.dt==='slashing'||p.dt==='piercing'||p.dt==='bludgeoning'?'radiant':p.dt]); }
  if(crit&&p.critBonus) parts[0][0]+=p.critBonus;
  if(crit&&p.vorpal){ if(!tgt.isHero&&!mdef(tgt).boss){ parts.push([tgt.hp,'slashing']); log('The Vorpal blade beheads '+cName(tgt)+'!','good'); } else parts.push([rollDice('6d8').total,'slashing']); }
  if(att.isHero){
    const F=heroFeatures(att), ts=G.combat?G.combat.ts:null;
    if(crit&&F.has('brutal')&&p.melee) parts[0][0]+=rollDice(p.dmg).total;
    if(crit&&RACES[att.race].savage&&p.melee) parts[0][0]+=rollDice(p.dmg).total;
    // sneak attack
    if(F.has('sneak')&&ts&&!ts.sneak&&(p.finesse||p.ranged)&&!opts.spell){ const allyAdj=activeParty().some(h=>h!==att&&alive(h)&&!incapacitated(h)&&dist(h,tgt)<=1); const dark=F.has('shadowStrike')&&!tileVisible(tgt.x,tgt.y);
      if((A.net>0||(allyAdj&&A.net>=0)||(dark&&A.net>=0))){ ts.sneak=true; let sd=sneakDice(att); const s=rollDice(sd+'d6',{crit}).total+(opts.fromHiding&&F.has('vanish')?die(6):0); parts.push([s,p.dt]); log('Sneak Attack! +'+s,'good'); } }
    // favored enemy
    if((att.favored||[]).includes(cType(tgt))) parts[0][0]+=2;
    if(ts&&!ts.colossus&&F.has('colossus')&&tgt.hp<cMaxHP(tgt)){ ts.colossus=true; parts.push([rollDice('1d8',{crit}).total,p.dt]); }
    if(ts&&!ts.dstrike&&F.has('divineStrike')&&!opts.spell){ ts.dstrike=true; parts.push([rollDice('1d8',{crit}).total,'radiant']); }
    if(ts&&!ts.astrike&&F.has('arcaneStrike')&&!opts.spell){ ts.astrike=true; parts.push([rollDice('1d6',{crit}).total,'force']); }
    if(typeof ARC_heroHit==='function') ARC_heroHit(att,tgt,p,opts,parts,crit,ts,F);
    const hm=getFx(tgt,'huntersmark'); if(hm&&hm.src===att.id) parts.push([rollDice('1d6',{crit}).total,p.dt]);
    const dm=getFx(tgt,'deathmark'); if(dm&&dm.src===att.id&&ts&&!ts.dmark){ ts.dmark=true; parts.push([rollDice('1d6',{crit}).total,'necrotic']); }
    if(getFx(tgt,'vigilbrand')) parts.push([rollDice('1d8',{crit}).total,'radiant']);
    const curse=getFx(tgt,'cursed'); if(curse&&curse.src===att.id) parts.push([rollDice('1d8',{crit}).total,'necrotic']);
    if(hasFx(att,'poisonblade')&&!opts.spell){ remFx(att,'poisonblade'); parts.push([rollDice('2d6',{crit}).total,'poison']); const s=doSave(tgt,'con',8+profFor(att.level)+abilMod(att,'dex'),{cond:'poisoned'}); await DICE.flush(); if(!s.ok) applyCond(tgt,'poisoned',2,att); }
    // smite
    if(p.melee&&!opts.spell&&att.tog&&att.tog.smite&&F.has('smite')){ const sl=lowestSlot(att); if(sl){ spendSlot(att,sl); let n=Math.min(5,1+sl); if(isUndeadOrFiend(tgt)) n++; const s=rollDice(n+'d8',{crit}).total; parts.push([s,'radiant']); log(att.name+' channels a Divine Smite (level '+sl+' slot): +'+s+' radiant!','good'); } }
    // stunning strike
    if(p.melee&&att.tog&&att.tog.stun&&F.has('stunning')&&att.res.ki>0&&ts&&!ts.stunTried){ ts.stunTried=true; att.res.ki--; const s=doSave(tgt,'con',8+profFor(att.level)+abilMod(att,'wis'),{}); await DICE.flush(); log('Stunning Strike: '+s.txt); if(!s.ok) applyCond(tgt,'stunned',1,att); }
    if(opts.flurry&&F.has('openHand')){ const s=doSave(tgt,'dex',8+profFor(att.level)+abilMod(att,'wis'),{}); await DICE.flush(); if(!s.ok){ applyCond(tgt,'prone',-1,att); log(cName(tgt)+' is knocked prone (Open Hand).'); } }
  } else {
    const tr=md.traits||[]; const ts=G.combat&&G.combat.ts;
    if(tr.includes('brute')&&p.melee) parts[0][0]+=rollDice(p.dmg.replace(/[+-]\d+$/,'')).total;
    if(tr.includes('martialAdvantage')&&ts&&!ts.ma&&combatMonsters().some(o=>o!==att&&alive(o)&&dist(o,tgt)<=1)){ ts.ma=true; parts.push([rollDice('2d6',{crit}).total,p.dt]); }
    if(tr.includes('sneak4')&&ts&&!ts.sneak&&A.net>0){ ts.sneak=true; parts.push([rollDice('4d6',{crit}).total,p.dt]); }
    if(tr.includes('surpriseAttack')&&G.combat&&G.combat.round===1&&ts&&!ts.sa){ ts.sa=true; parts.push([rollDice('2d6').total,p.dt]); }
  }
  let total2=0; for(const [d,dt] of parts){ total2+=dealDamage(tgt,d,dt,att,{magical:p.magical,silvered:!!p.silvered,crit,attack:true,ranged:p.ranged,melee:p.melee,dt,spell:opts.spell}); if(!alive(tgt)&&!downed(tgt)) break; }
  if(p.lifesteal&&att.isHero) healC(att,p.lifesteal);
  if(att.isHero&&heroFeatures(att).has('vampiric')&&p.melee&&G.combat&&!G.combat.ts.vamp){ G.combat.ts.vamp=true; healC(att,Math.min(att.level,Math.floor(total2/2))); }
  // monster on-hit riders
  if(!att.isHero&&p.atk&&(alive(tgt))){ const a=p.atk;
    if(a.prone){ const s=doSave(tgt,'str',a.prone,{}); await DICE.flush(); if(!s.ok){ applyCond(tgt,'prone',-1,att); log(cName(tgt)+' is knocked prone.','bad'); } }
    if(a.poison){ const s=doSave(tgt,'con',a.poison.dc,{cond:'poisoned',dt:'poison'}); await DICE.flush(); log(s.txt); if(!s.ok){ if(a.poison.dmg) dealDamage(tgt,rollDice(a.poison.dmg).total,'poison',att,{}); if(a.poison.cond||!a.poison.dmg) applyCond(tgt,'poisoned',a.poison.rounds||3,att); } else if(a.poison.dmg&&!a.poison.noHalf) dealDamage(tgt,Math.floor(rollDice(a.poison.dmg).total/2),'poison',att,{}); }
    if(a.paralyze&&alive(tgt)&&!(tgt.isHero&&tgt.race==='highelf')){ const s=doSave(tgt,'con',a.paralyze.dc,{cond:'paralyzed'}); await DICE.flush(); log(s.txt); if(!s.ok) applyCond(tgt,'paralyzed',2,att,{save:{a:'con',dc:a.paralyze.dc}}); }
    if(a.grapple){ applyCond(tgt,'grappled',-1,att,{save:{a:'str',dc:a.grapple}}); }
    if(a.web){ const s=doSave(tgt,'dex',a.web,{}); await DICE.flush(); if(!s.ok) applyCond(tgt,'restrained',-1,att,{save:{a:'str',dc:a.web}}); }
    if(a.strDrain){ addFx(tgt,{id:'weakened',rounds:-1,persist:1}); tgt.tmpStrDrain=(tgt.tmpStrDrain||0)+die(4); log(cName(tgt)+' feels their strength drain away.','bad'); }
    if(a.drain||a.maxDrain){ healC(att,Math.floor(total2/2)); if(a.maxDrain&&tgt.isHero){ addFx(tgt,{id:'drained',rounds:-1,persist:1,amt:(getFx(tgt,'drained')||{amt:0}).amt+Math.floor(total2/2)}); } }
    if(a.curse&&tgt.isHero){ addFx(tgt,{id:'cursed',rounds:-1,persist:1,src:'curse'}); log(cName(tgt)+' is cursed!','bad'); }
    if(a.disease&&tgt.isHero){ const s=doSave(tgt,'con',a.disease.dc||12,{cond:'disease'}); await DICE.flush(); if(!s.ok&&!condImmune(tgt,'disease')){ addFx(tgt,{id:'diseased',rounds:-1,persist:1}); log(cName(tgt)+' contracts a disease (disadvantage on checks until cured).','bad'); } }
  }
  // retaliation auras
  if(p.melee&&tgt.isHero&&alive(tgt)){ const F=heroFeatures(tgt); if(hasFx(tgt,'raging')&&F.has('smoulder')) dealDamage(att,rageBonus(tgt),'fire',tgt,{}); if(F.has('ashCloak')) dealDamage(att,die(6),'fire',tgt,{}); if(F.has('multiDefense')) addFx(tgt,{id:'multidef',rounds:1}); }
  if(typeof ARC_retaliate==='function') ARC_retaliate(att,tgt,p);
  if(p.melee&&!tgt.isHero&&(mdef(tgt).traits||[]).includes('heatedBody')&&alive(att)) dealDamage(att,rollDice('2d6').total,'fire',tgt,{});
  // hellish rebuke (tiefling racial or spell)
  if(tgt.isHero&&alive(tgt)&&tgt.reaction&&!incapacitated(tgt)&&alive(att)&&dist(att,tgt)<=12){ let used=false;
    if(tgt.res&&tgt.res.hellish>0){ tgt.res.hellish--; used=true; } else if(heroSpells(tgt).includes('hellishrebuke')&&tgt.cls==='warlock'&&hasSlot(tgt,1)){ spendSlot(tgt,lowestSlot(tgt)); used=true; }
    if(used){ tgt.reaction=false; const s=doSave(att,'dex',spellDC(tgt),{magic:1}); await DICE.flush(); const dmg=rollDice('2d10').total; log(tgt.name+' casts Hellish Rebuke! '+s.txt,'good'); dealDamage(att,s.ok?Math.floor(dmg/2):dmg,'fire',tgt,{spell:1}); } }
  await sleep(380);
  return {hit:true,crit,dmg:total2};
}
// ---------- slots ----------
function hasSlot(h,l){ if(!h.isHero) return true; for(let i=l;i<=5;i++) if((h.slots[i]||0)>0) return true; return false; }
function lowestSlot(h,min){ for(let i=min||1;i<=5;i++) if((h.slots[i]||0)>0) return i; return 0; }
function spendSlot(h,l){ if(!h.isHero) return; if(h.slots[l]>0) h.slots[l]--; }
// ---------- area helpers ----------
function areaTiles(sp,caster,px,py){
  const a=sp.area; const out=[]; const map=G.run.map; if(!a) return out;
  if(a.sh==='r'||a.sh==='cube'){ for(let y=py-a.sz;y<=py+a.sz;y++) for(let x=px-a.sz;x<=px+a.sz;x++){ if(dist2(x,y,px,py)<=a.sz&&walkable(tileAt(map,x,y))&&los(map,px,py,x,y)) out.push([x,y]); } }
  else if(a.sh==='self'){ for(let y=caster.y-a.sz;y<=caster.y+a.sz;y++) for(let x=caster.x-a.sz;x<=caster.x+a.sz;x++){ if((x!==caster.x||y!==caster.y)&&walkable(tileAt(map,x,y))&&los(map,caster.x,caster.y,x,y)) out.push([x,y]); } }
  else if(a.sh==='cone'){ const dx=px-caster.x, dy=py-caster.y; const L=Math.hypot(dx,dy)||1; const ux=dx/L, uy=dy/L;
    for(let y=caster.y-a.sz;y<=caster.y+a.sz;y++) for(let x=caster.x-a.sz;x<=caster.x+a.sz;x++){ const vx=x-caster.x, vy=y-caster.y; const d=Math.hypot(vx,vy); if(d===0||d>a.sz+0.5) continue; const cos=(vx*ux+vy*uy)/d; if(cos>=0.7&&walkable(tileAt(map,x,y))&&los(map,caster.x,caster.y,x,y)) out.push([x,y]); } }
  else if(a.sh==='line'){ const dx=px-caster.x, dy=py-caster.y; const L=Math.hypot(dx,dy)||1; for(let i=1;i<=a.sz;i++){ const x=Math.round(caster.x+dx/L*i), y=Math.round(caster.y+dy/L*i); if(opaque(tileAt(map,x,y))) break; if(!out.some(t=>t[0]===x&&t[1]===y)) out.push([x,y]); } }
  return out;
}
function creaturesIn(tiles){ const set=new Set(tiles.map(([x,y])=>x+','+y)); const all=[...activeParty().filter(h=>h.x!=null&&h.status!=='fallen'),...G.run.map.ents.filter(e=>e.type==='mon'&&e.hp>0)]; return all.filter(c=>set.has(c.x+','+c.y)); }
function isFoe(a,b){ return partySide(a)!==partySide(b); }
// ---------- spells ----------
function spellDmgDice(c,sp,slot){
  let d=sp.dmg; if(!d) return null;
  if(sp.l===0&&sp.cs) d=scaleDice(d,cantripTier(c)+(c.isHero&&sp.dt==='necrotic'&&heroFeatures(c).has('deathsEmbrace')?1:0));
  if(sp.up&&slot>sp.l){ d=d+'+'+scaleDice(sp.up,slot-sp.l); }
  return d;
}
function spellDmgBonus(c,sp,dt){ if(!c.isHero) return 0; const F=heroFeatures(c); let b=0;
  if(F.has('empoweredEvo')&&sp.s==='Evocation') b+=abilMod(c,'int');
  if(F.has('elemAffinity')&&DRAGON_ANCESTRY[c.dragon||'red']===dt) b+=abilMod(c,'cha');
  if(F.has('wither')&&dt==='necrotic') b+=abilMod(c,'cha');
  if(F.has('reaperTouch')&&dt==='necrotic') b+=Math.max(0,abilMod(c,'int'));
  if(F.has('potentSpell')&&sp.l===0&&c.cls==='cleric') b+=abilMod(c,'wis');
  return b; }
function spellTargetsValid(c,sp){ // returns 'enemy' | 'ally' | 'point' | 'self' | 'auto'
  if(['self','party'].includes(sp.tg)) return 'self'; if(sp.tg==='area') return (sp.area&&sp.area.sh==='self')?'self':'point'; if(sp.tg==='point') return 'point';
  if(sp.tg==='allies') return 'self'; if(sp.tg==='enemies') return 'self'; if(sp.tg==='ally') return 'ally'; if(sp.tg==='any') return 'any'; return 'enemy'; }
async function castSpell(c,sid,slot,target,px,py){
  const sp=SPELLS[sid]; const isH=c.isHero; slot=sp.l===0?0:Math.max(sp.l,slot||sp.l);
  const isWand=c._wandCast; c._wandCast=null;
  if(isH&&sid==='raisebones'&&c.res&&c.res.pale>0&&!isWand){ c.res.pale--; c._freeCast=true; slot=Math.max(slot,maxSpellLevel(c)); log(c.name+' calls the dead without a slot (Pale Mastery).','good'); }
  if(isH&&sp.l>0&&!isWand&&!c._freeCast){ if(getClass(c.cls).caster==='pact') slot=maxSpellLevel(c); spendSlot(c,slot); }
  c._freeCast=false;
  if(isH&&heroFeatures(c).has('arcaneWard')&&sp.l>0&&sp.s==='Abjuration'||isH&&heroFeatures(c).has('arcaneWard')&&sp.l>0){ const max=2*c.level+abilMod(c,'int'); c.wardHp=Math.min(max,(c.wardHp||0)+(c.wardHp?slot*2:max)); }
  const dc=isWand&&isWand.dc?isWand.dc:spellDC(c); const atkB=spellAtk(c);
  log('✦ '+cName(c)+' casts '+sp.n+(slot>sp.l?' (level '+slot+')':''),'spell'); UI.roll(cName(c)+' casts '+sp.n,'spell');
  if(sp.conc) startConc(c,sid);
  const concKey=sp.conc?cUid(c):null;
  const castMod=isH?abilMod(c,castAbil(c)):3;
  // healing
  if(sp.heal){ let tgts=[]; if(sp.tg==='party') tgts=allies(c).filter(a=>dist(a,c)<=sp.r||sp.ooc); else tgts=[target||c];
    tgts=tgts.slice(0,6);
    for(const t of tgts){ let amt=rollDice(sp.heal+(slot>sp.l&&sp.up?'+'+scaleDice(sp.up,slot-sp.l):''),{max:hasFx(t,'beacon')}).total+castMod; if(isH&&heroFeatures(c).has('discipleLife')) amt+=2+slot; healC(t,amt,c); }
    if(isH&&heroFeatures(c).has('blessedHealer')&&tgts.some(t=>t!==c)) healC(c,2+slot);
    await sleep(300); return; }
  // special handler
  if(sp.fx&&SPELL_FX[sp.fx]){ const r=await SPELL_FX[sp.fx](c,sp,slot,target,px,py,{dc,atkB,castMod,concKey}); if(r!=='continue'){ R.dirty=true; return; } }
  // single-target attack spells
  if(sp.atk&&target){ const p={n:sp.n,hit:atkB,dmg:spellDmgDice(c,sp,slot),dmgB:spellDmgBonus(c,sp,sp.dt),dt:sp.dt,melee:sp.atk==='m',ranged:sp.atk==='r',reach:sp.r,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]};
    const res=await doAttack(c,target,p,{spell:1,spellAtk:sp.atk}); if(res.hit&&sp.cond) applyCond(target,sp.cond,sp.cd||1,c,{conc:concKey}); return res; }
  // save-based single/multi or area
  let targets=[];
  if(sp.tg==='area'){ const tiles=sp.area.sh==='self'?areaTiles(sp,c):areaTiles(sp,c,px,py); targets=creaturesIn(tiles); if(sp.area.sh==='self') targets=targets.filter(t=>t!==c); flashArea(tiles); }
  else if(sp.tg==='enemies'){ targets=enemiesOf(c).filter(e=>dist(e,c)<=sp.r&&los(G.run.map,c.x,c.y,e.x,e.y)).sort((a,b)=>dist(a,c)-dist(b,c)).slice(0,(sp.nt||1)+(slot-sp.l)); }
  else if(target) targets=[target];
  if(sp.only==='humanoid') targets=targets.filter(t=>cType(t)==='humanoid');
  const sculpt=isH&&heroFeatures(c).has('sculpt')&&sp.s==='Evocation';
  const dmgD=spellDmgDice(c,sp,slot); const rolled=dmgD?rollDice(dmgD,{emp:isH&&c.tog&&c.tog.empower}).total+spellDmgBonus(c,sp,sp.dt):0;
  if(isH&&c.tog&&c.tog.empower){ c.tog.empower=false; }
  for(const t of targets){
    if(sculpt&&!isFoe(c,t)) continue;
    let ok=false; if(sp.sv){ const s=doSave(t,sp.sv,dc,{magic:1,cond:sp.cond,dt:sp.dt,disadv:sp.fx==='searing'&&cType(t)==='undead'}); await DICE.flush(); ok=s.ok; log(s.txt,ok?'':'hit'); if(t.isHero&&t!==c&&sp.sv==='dex'&&heroFeatures(t).has('evasion')&&sp.half){ if(ok){ log(t.name+' evades completely.','good'); continue; } } }
    if(dmgD){ let d=rolled; if(ok) d=sp.half?Math.floor(d/2):(sp.l===0&&isH&&heroFeatures(c).has('potentCantrip')?Math.floor(d/2):0); if(t.isHero&&!ok&&sp.sv==='dex'&&heroFeatures(t).has('evasion')&&sp.half) d=Math.floor(d/2); if(d>0) dealDamage(t,d,sp.dt,c,{magical:true,spell:1,ignoreRes:isH&&(heroFeatures(c).has('wither')||heroFeatures(c).has('blightedSoul'))&&sp.dt==='necrotic'}); }
    if(sp.cond&&!ok&&alive(t)){ applyCond(t,sp.cond,sp.cd||10,c,{conc:concKey,save:sp.rs?{a:sp.sv,dc}:null}); }
    if(sp.fx==='mock'&&!ok) addFx(t,{id:'mocked',rounds:1});
    if(sp.fx==='push'&&!ok) pushAway(t,c,2);
    await sleep(120);
  }
  if(sp.fx==='zone'||sp.fx==='spikezone'){ G.combat&&G.combat.zones.push({x:px,y:py,sz:sp.area?sp.area.sz:1,dmg:dmgD,dt:sp.dt,sv:sp.sv,dc,half:sp.half,owner:cUid(c),conc:concKey,rounds:10,n:sp.n}); }
  R.dirty=true; await sleep(250);
}
function flashArea(tiles){ R.hl.area=new Set(tiles.map(([x,y])=>y*G.run.map.w+x)); R.dirty=true; setTimeout(()=>{ R.hl.area=null; R.dirty=true; },G.fast?0:500); }
function pushAway(t,src,n){ const map=G.run.map; for(let i=0;i<n;i++){ const dx=Math.sign(t.x-src.x), dy=Math.sign(t.y-src.y); const nx=t.x+dx, ny=t.y+dy; if(blocksMove(map,nx,ny)||activeParty().some(h=>h.x===nx&&h.y===ny&&h!==t)) break; t.x=nx; t.y=ny; } R.dirty=true; }
const SPELL_FX={
  noheal:async(c,sp,s,t,px,py,o)=>{ if(t){ const p={n:sp.n,hit:o.atkB,dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,ranged:true,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(r.hit) addFx(t,{id:'noheal',rounds:1}); } },
  slowray:async(c,sp,s,t)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,ranged:true,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(r.hit) addFx(t,{id:'slowray',rounds:1}); },
  shock:async(c,sp,s,t)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,melee:true,reach:1,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'m'}); if(r.hit) t.reaction=false; },
  eb:async(c,sp,s,t)=>{ const n=cantripTier(c); const ag=c.isHero&&heroFeatures(c).has('invocations')?Math.max(0,abilMod(c,'cha')):0; for(let i=0;i<n;i++){ if(!alive(t)) { const nt=enemiesOf(c).filter(e=>dist(e,c)<=sp.r&&los(G.run.map,c.x,c.y,e.x,e.y))[0]; if(!nt) break; t=nt; } const p={n:'Eldritch Blast',hit:spellAtk(c),dmg:'1d10',dmgB:ag,dt:'force',ranged:true,r:24,lr:24,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(r.hit&&c.isHero&&c.level>=5&&heroFeatures(c).has('invocations')) pushAway(t,c,2); } },
  guidance:async(c,sp,s,t)=>{ addFx(t||c,{id:'guidance',rounds:10,persist:1}); log((t||c).name+' is guided (+1d4 next check).'); },
  resistance:async(c,sp,s,t)=>{ addFx(t||c,{id:'resistance',rounds:10,persist:1}); },
  light:async(c)=>{ G.run.lightBonus=(G.run.lightBonus||0)+1; addFx(c,{id:'lightspell',rounds:-1,persist:1}); log('A cold light blooms. (+1 light this floor)'); computeVis(); },
  stabilize:async(c,sp,s,t)=>{ if(t&&downed(t)){ t.deathS.s=3; log(t.name+' is stabilized.','good'); } },
  thaum:async(c)=>{ addFx(c,{id:'guidance',rounds:10,persist:1}); log('The ground trembles at '+cName(c)+'\'s voice (next check +1d4).'); },
  mock:async()=>'continue',
  shillelagh:async(c)=>{ addFx(c,{id:'shillelagh',rounds:10}); log('The druid\'s staff swells with nature\'s might.'); },
  truestrike:async(c,sp,s,t)=>{ addFx(c,{id:'truestrike',rounds:2,tgt:cUid(t)}); },
  bless:async(c,sp,s,t,px,py,o)=>{ const tg=allies(c).filter(a=>dist(a,c)<=sp.r).sort((a,b)=>dist(a,c)-dist(b,c)).slice(0,(sp.nt||3)+(s-sp.l)); tg.forEach(a=>addFx(a,{id:'blessed',rounds:10,conc:o.concKey})); log('Blessed: '+tg.map(cName).join(', '),'good'); },
  bane:async(c,sp,s,t,px,py,o)=>{ const tg=enemiesOf(c).filter(e=>dist(e,c)<=sp.r).sort((a,b)=>dist(a,c)-dist(b,c)).slice(0,(sp.nt||3)+(s-sp.l)); for(const e of tg){ const r=doSave(e,'cha',o.dc,{magic:1}); await DICE.flush(); log(r.txt); if(!r.ok) addFx(e,{id:'baned',rounds:10,conc:o.concKey}); } },
  colorspray:async(c,sp,s,t,px,py)=>{ let pool=rollDice((6+2*(s-1))+'d10').total; const tiles=areaTiles(sp,c,px,py); flashArea(tiles); const tg=creaturesIn(tiles).filter(x=>x!==c&&!hasFx(x,'unconscious')).sort((a,b)=>a.hp-b.hp); for(const x of tg){ if(x.hp>pool) break; pool-=x.hp; applyCond(x,'blinded',1,c); } },
  command:async(c,sp,s,t,px,py,o)=>{ const r=doSave(t,'wis',o.dc,{magic:1}); await DICE.flush(); log(r.txt); if(!r.ok){ applyCond(t,'incapacitated',1,c); applyCond(t,'prone',-1,c); log(cName(t)+' obeys: "Grovel!"'); } },
  detectmagic:async(c)=>{ let n=0; for(const it of G.run.pack) if(it.magic||it.affixes&&it.affixes.length||it.plus){ n++; } log('You sense '+n+' magical item(s) in your pack and the faint glow of enchantment nearby.'); G.run.map.ents.filter(e=>e.type==='chest'&&e.rich).forEach(e=>{ G.run.map.explored[e.y*G.run.map.w+e.x]=1; }); R.dirty=true; },
  divinefavor:async(c)=>{ addFx(c,{id:'divinefavor',rounds:10,conc:cUid(c)}); },
  falselife:async(c,sp,s)=>{ c.tempHp=Math.max(c.tempHp||0,rollDice('1d4+4').total+5*(s-1)); floater(c.x,c.y,'+'+c.tempHp+' temp','#8ac'); },
  guiding:async(c,sp,s,t)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,ranged:true,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(r.hit&&alive(t)) addFx(t,{id:'outlined',rounds:1}); },
  huntersmark:async(c,sp,s,t,px,py,o)=>{ addFx(t,{id:'huntersmark',rounds:60,src:cUid(c),conc:o.concKey}); addFx(t,{id:'marked',rounds:60,conc:o.concKey}); },
  magearmor:async(c,sp,s,t)=>{ addFx(t||c,{id:'magearmor',rounds:-1,persist:1}); log((t||c).name+' is wrapped in mage armor.'); },
  missile:async(c,sp,s,t)=>{ const n=3+(s-1); for(let i=0;i<n;i++){ let tt=alive(t)?t:enemiesOf(c).filter(e=>dist(e,c)<=sp.r)[0]; if(!tt) break; const d=rollDice('1d4+1').total+spellDmgBonus(c,sp,'force'); dealDamage(tt,d,'force',c,{magical:true,spell:1}); await sleep(120); } },
  protevil:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'protevil',rounds:100,conc:o.concKey}); },
  sanctuary:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'sanctuary',rounds:10,dc:o.dc}); },
  shield:async(c)=>{ addFx(c,{id:'shieldspell',rounds:1}); },
  shieldfaith:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'shieldfaith',rounds:100,conc:o.concKey}); },
  sleep:async(c,sp,s,t,px,py)=>{ let pool=rollDice((5+2*(s-1))+'d8').total; const tiles=areaTiles(sp,c,px,py); flashArea(tiles); const tg=creaturesIn(tiles).filter(x=>isFoe(c,x)&&!['undead','construct'].includes(cType(x))&&!(x.isHero&&RACES[x.race].feyAncestry)).sort((a,b)=>a.hp-b.hp); const slept=[]; for(const x of tg){ if(x.hp>pool) break; pool-=x.hp; applyCond(x,'asleep',10,c); slept.push(cName(x)); } log(slept.length?'Asleep: '+slept.join(', '):'No one succumbs to sleep.'); },
  push:async()=>'continue',
  heroism:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'heroism',rounds:10,conc:o.concKey,thp:o.castMod}); },
  identify:async(c)=>{ const it=G.run.pack.find(i=>!i.ident)||activeParty().flatMap(h=>equippedItems(h)).find(i=>!i.ident); if(it){ it.ident=true; log('Identified: '+itemName(it),'good'); } else log('Nothing to identify.'); },
  longstrider:async(c,sp,s,t)=>{ addFx(t||c,{id:'longstrider',rounds:-1,persist:1}); },
  aid:async(c,sp,s)=>{ const tg=allies(c).filter(a=>dist(a,c)<=sp.r).slice(0,3); const amt=5*(s-1); tg.forEach(a=>{ a.aid=Math.max(a.aid||0,amt); a.hp+=amt; floater(a.x,a.y,'+'+amt+' max','#8f8'); }); },
  blur:async(c,sp,s,t,px,py,o)=>{ addFx(c,{id:'blur',rounds:10,conc:o.concKey}); },
  invis:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'invisible',rounds:100,conc:o.concKey}); },
  knock:async(c)=>{ const map=G.run.map; let n=0; for(const e of map.ents){ if((e.type==='lock'&&!e.open&&dist(e,c)<=12)){ setTile(map,e.x,e.y,T.DOOROPEN); e.open=true; n++; } if(e.type==='chest'&&e.locked&&dist(e,c)<=12){ e.locked=false; n++; } } log(n?'Locks spring open with a loud knock! ('+n+')':'No locks nearby.'); if(n) addNoise(1); R.dirty=true; },
  lesserrest:async(c,sp,s,t)=>{ t=t||c; ['poisoned','blinded','paralyzed','diseased'].forEach(k=>remFx(t,k)); log(cName(t)+' is cleansed.','good'); },
  magicweapon:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'magicweapon',rounds:100,conc:o.concKey}); },
  teleport:async(c,sp,s,t,px,py)=>{ if(px==null) return; if(blocksMove(G.run.map,px,py)||activeParty().some(h=>h!==c&&h.x===px&&h.y===py)) { log('The destination is blocked.'); return; } c.x=px; c.y=py; floater(px,py,'✦','#c8f'); computeVis(); },
  zone:async()=>'continue',
  rays:async(c,sp,s,t)=>{ const n=3+(s-sp.l); for(let i=0;i<n;i++){ let tt=alive(t)?t:enemiesOf(c).filter(e=>dist(e,c)<=sp.r&&los(G.run.map,c.x,c.y,e.x,e.y))[0]; if(!tt) break; const p={n:'Scorching Ray',hit:spellAtk(c),dmg:'2d6',dmgB:spellDmgBonus(c,sp,'fire'),dt:'fire',ranged:true,r:24,lr:24,magical:true,crit:20,extra:[]}; await doAttack(c,tt,p,{spell:1,spellAtk:'r'}); } },
  spiritweapon:async(c,sp,s,t)=>{ addFx(c,{id:'spiritweapon',rounds:10,lvl:s}); log('A spectral weapon appears beside '+cName(c)+'.'); if(t){ await spiritStrike(c,t); } },
  spikezone:async()=>'continue',
  barkskin:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'barkskin',rounds:100,conc:o.concKey}); },
  findtraps:async(c)=>{ let n=0; for(const e of G.run.map.ents){ if(e.type==='trap'&&!e.found&&dist(e,c)<=14){ e.found=true; G.run.map.explored[e.y*G.run.map.w+e.x]=1; n++; } if(e.type==='chest'&&e.trap&&!e.trapFound&&dist(e,c)<=14){ e.trapFound=true; n++; } } log(n?'You sense '+n+' trap(s) nearby.':'You sense no traps nearby.','good'); R.dirty=true; },
  auto:async(c,sp,s,t,px,py,o)=>{ const d=rollDice(spellDmgDice(c,sp,s)).total; dealDamage(t,d,sp.dt,c,{magical:true,spell:1}); },
  dot:async(c,sp,s,t)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,ranged:true,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(alive(t)) addFx(t,{id:'acid',rounds:1,dot:(r.hit?'2d4':'1d4')+(s>2?'+'+(s-2)+'d4':''),dt:'acid'}); },
  enfeeble:async(c,sp,s,t,px,py,o)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:'0',dmgB:0,dt:'necrotic',ranged:true,r:sp.r,lr:sp.r,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'r'}); if(r.hit) addFx(t,{id:'enfeebled',rounds:10,conc:o.concKey}); },
  passtrace:async(c)=>{ G.run.passtrace=true; log('Shadows cling to the party (+10 Stealth this floor).','good'); },
  enhance:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'enhance',rounds:100,conc:o.concKey}); },
  dispel:async(c,sp,s,t)=>{ if(!t) return; const good=['blessed','shieldfaith','haste','hasted','barkskin','stoneskin','blur','invisible','heroism','magicweapon','sanctuary','protevil']; const bad=['baned','paralyzed','frightened','charmed','restrained','cursed','asleep','slowed','incapacitated']; const rm=isFoe(c,t)?good:bad; t.fx=(t.fx||[]).filter(e=>!rm.includes(e.id)); if(t.conc&&isFoe(c,t)) endConc(t); G.combat&&(G.combat.zones=G.combat.zones.filter(z=>dist2(z.x,z.y,t.x,t.y)>z.sz||z.owner===cUid(c))); log('Magic unravels around '+cName(t)+'.'); },
  revivify:async(c,sp,s,t)=>{ if(!t) return; if(t.status==='fallen'){ t.status='ok'; t._fallen=false; t.hp=1; t.deathS={s:0,f:0}; remFx(t,'unconscious'); log(t.name+' gasps back to life!','good'); if(t.x==null){ const p=c; t.x=p.x; t.y=p.y; placeNear(t,p.x,p.y); } } else if(t.hp<=0) healC(t,1); else log('They are not dead.'); },
  aura:async(c,sp,s,t,px,py,o)=>{ G.combat&&G.combat.zones.push({follow:cUid(c),sz:3,dmg:spellDmgDice(c,sp,s),dt:sp.dt,sv:'wis',dc:o.dc,half:1,owner:cUid(c),conc:o.concKey,rounds:100,n:sp.n,foesOnly:1}); log('Spectral guardians whirl around '+cName(c)+'.'); },
  haste:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'hasted',rounds:10,conc:o.concKey}); },
  drain:async(c,sp,s,t)=>{ const p={n:sp.n,hit:spellAtk(c),dmg:spellDmgDice(c,sp,s),dmgB:0,dt:sp.dt,melee:true,reach:1,magical:true,crit:20,extra:[]}; const r=await doAttack(c,t,p,{spell:1,spellAtk:'m'}); if(r.hit) healC(c,Math.floor(r.dmg/2)); },
  beacon:async(c,sp,s,t,px,py,o)=>{ allies(c).filter(a=>dist(a,c)<=sp.r).forEach(a=>addFx(a,{id:'beacon',rounds:10,conc:o.concKey})); },
  daylight:async(c)=>{ G.run.daylight={x:c.x,y:c.y}; log('Sunlight floods the chamber! Creatures of darkness flinch.','good'); computeVis(); },
  removecurse:async(c,sp,s,t)=>{ t=t||c; remFx(t,'cursed'); log(cName(t)+' is freed from curses.','good'); },
  elemweapon:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'elemweapon',rounds:100,conc:o.concKey}); },
  curse:async(c,sp,s,t,px,py,o)=>{ const r=doSave(t,'wis',o.dc,{magic:1}); await DICE.flush(); log(r.txt); if(!r.ok) addFx(t,{id:'cursed',rounds:100,src:cUid(c),conc:o.concKey}); },
  banish:async(c,sp,s,t,px,py,o)=>{ const r=doSave(t,'cha',o.dc,{magic:1}); await DICE.flush(); log(r.txt); if(!r.ok){ if(!t.isHero&&mdef(t).boss){ applyCond(t,'incapacitated',1,c); return; } addFx(t,{id:'banished',rounds:10,conc:o.concKey}); log(cName(t)+' vanishes to another plane!','good'); } },
  ginvis:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'invisible',rounds:10,conc:o.concKey,greater:1}); },
  stoneskin:async(c,sp,s,t,px,py,o)=>{ addFx(t||c,{id:'stoneskin',rounds:100,conc:o.concKey}); },
  deathward:async(c,sp,s,t)=>{ addFx(t||c,{id:'deathward',rounds:-1,persist:1}); },
  freedom:async(c,sp,s,t)=>{ t=t||c; ['paralyzed','restrained','grappled'].forEach(k=>remFx(t,k)); addFx(t,{id:'freedom',rounds:100,persist:1}); },
  greaterrest:async(c,sp,s,t)=>{ t=t||c; ['charmed','paralyzed','cursed','weakened','drained','diseased','poisoned','frightened'].forEach(k=>remFx(t,k)); t.tmpStrDrain=0; if(t.isHero&&t.injuries&&t.injuries.length){ const i=t.injuries.findIndex(x=>INJURIES.find(d=>d.id===x.id).sev<=1); if(i>=0){ const n=INJURIES.find(d=>d.id===t.injuries[i].id).n; t.injuries.splice(i,1); log('Greater Restoration mends '+t.name+'\'s '+n+'.','good'); } } log(cName(t)+' is restored.','good'); },
};
async function spiritStrike(c,t){ const sw=getFx(c,'spiritweapon'); if(!sw||!t) return; const p={n:'Spiritual Weapon',hit:spellAtk(c),dmg:scaleDice('1d8',1+Math.floor((sw.lvl-2)/2)),dmgB:abilMod(c,castAbil(c)),dt:'force',melee:true,reach:12,magical:true,crit:20,extra:[]}; await doAttack(c,t,p,{spell:1,spellAtk:'m'}); }
function placeNear(c,x,y){ const map=G.run.map; for(let r=0;r<5;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ const nx=x+dx, ny=y+dy; if(!blocksMove(map,nx,ny)&&!occupiedByHero(nx,ny,c)){ c.x=nx; c.y=ny; return true; } } return false; }
function occupiedByHero(x,y,except){ return activeParty().some(h=>h!==except&&h.x===x&&h.y===y&&h.status!=='fallen'); }
function occupied(x,y,except){ return occupiedByHero(x,y,except)||G.run.map.ents.some(e=>e!==except&&e.type==='mon'&&e.hp>0&&e.x===x&&e.y===y); }
function addNoise(n){ G.run.noise=(G.run.noise||0)+n; if(G.run.noise>=4&&!G.combat){ G.run.noise=0; spawnWanderers(); } }
function spawnWanderers(){ const map=G.run.map; const lead=activeParty().find(h=>h.id===G.run.leader)||activeParty()[0]; const th=THEMES[map.theme]; const lvl=map.lvl; const pool=MONSTER_LIST.filter(m=>!m.boss&&th.types.includes(m.type)&&m.cr<=Math.max(0.5,lvl/2));
  if(!pool.length) return; const m=pick(pool); let placed=0; for(let r=4;r<9&&placed<2;r++){ for(let k=0;k<20&&placed<2;k++){ const x=lead.x+rnd(2*r+1)-r, y=lead.y+rnd(2*r+1)-r; if(!blocksMove(map,x,y)&&!occupied(x,y)&&!los(map,lead.x,lead.y,x,y)){ map.ents.push(Object.assign(mkMon(m,x,y,900+rnd(99)),{awake:true,hunting:true})); placed++; } } }
  if(placed){ toast('You hear something stirring in the dark...'); log('The noise has drawn wandering '+m.n+'s!','bad'); } }
// ===================== Hero features (active) =====================
const FEAT_ACT={
  rage:{res:'rage',cost:'bonus',tg:'self',ok:h=>!hasFx(h,'raging')&&!(armorOf(h)&&armorOf(h).type==='heavy'),run:async h=>{ addFx(h,{id:'raging',rounds:10}); log(h.name+' flies into a RAGE!','good'); floater(h.x,h.y,'RAGE','#f55',true); if(heroFeatures(h).has('frenzy')) addFx(h,{id:'frenzy',rounds:10}); if(heroFeatures(h).has('pyreBurst')){ for(const e of enemiesOf(h).filter(e=>dist(e,h)<=1)) dealDamage(e,rollDice('1d6').total+rageBonus(h),'fire',h,{}); } }},
  intimPresence:{res:'intim',cost:'action',tg:'enemy',range:6,run:async(h,t)=>{ const s=doSave(t,'wis',8+profFor(h.level)+abilMod(h,'cha'),{cond:'frightened'}); await DICE.flush(); log(s.txt); if(!s.ok) applyCond(t,'frightened',3,h,{save:{a:'wis',dc:8+profFor(h.level)+abilMod(h,'cha')}}); }},
  inspiration:{res:'insp',cost:'bonus',tg:'ally',range:12,ok:(h)=>true,run:async(h,t)=>{ addFx(t,{id:'inspired',rounds:100,die:inspDie(h),persist:1}); log(h.name+' inspires '+cName(t)+' ('+inspDie(h)+').','good'); }},
  mournVerse:{res:'insp',cost:'bonus',tg:'enemy',range:6,run:async(h,t)=>{ const s=doSave(t,'wis',spellDC(h),{cond:'frightened',magic:1}); await DICE.flush(); log(s.txt); if(!s.ok) applyCond(t,'frightened',1,h); }},
  turnUndead:{res:'channel',cost:'action',tg:'none',run:async h=>turnFoes(h,['undead'])},
  turnUnholy:{res:'channel',cost:'action',tg:'none',run:async h=>turnFoes(h,['undead','fiend'])},
  preserveLife:{res:'channel',cost:'action',tg:'none',run:async h=>{ let pool=5*h.level; const al=allies(h).filter(a=>dist(a,h)<=6&&a.hp<cMaxHP(a)/2).sort((a,b)=>a.hp-b.hp); for(const a of al){ const need=Math.floor(cMaxHP(a)/2)-Math.max(0,a.hp); const g=Math.min(need,pool); if(g>0){ healC(a,g); pool-=g; } } if(pool===5*h.level) log('No ally needs Preserve Life.'); }},
  searingDawn:{res:'channel',cost:'action',tg:'none',run:async h=>{ for(const e of enemiesOf(h).filter(e=>dist(e,h)<=2)){ const s=doSave(e,'con',spellDC(h),{magic:1,disadv:cType(e)==='undead'}); await DICE.flush(); log(s.txt); const d=rollDice('2d10').total+h.level; dealDamage(e,s.ok?Math.floor(d/2):d,'radiant',h,{magical:true,spell:1}); } }},
  divineIntervention:{res:'dint',cost:'action',tg:'none',run:async h=>{ const r=die(100); if(r<=h.level){ log('Divine Intervention! ('+r+') The party is restored.','good'); for(const a of allies(h)){ healC(a,cMaxHP(a)); a.fx=(a.fx||[]).filter(e=>!['poisoned','frightened','paralyzed','charmed','cursed'].includes(e.id)); } } else { log('The heavens are silent... ('+r+')'); h.res.dint=1; } }},
  wildShape:{res:'wild',cost:'action',tg:'self',ok:h=>!hasFx(h,'wildshape'),run:async h=>{ const b=beastFor(h); addFx(h,{id:'wildshape',rounds:-1,beast:b,hp:BEASTS[b].hp}); log(h.name+' becomes a '+BEASTS[b].n+'!','good'); R.portraitCache={}; }},
  blightTouch:{cost:'bonus',tg:'enemy',range:1,run:async(h,t)=>{ const p={n:'Blight Touch',hit:spellAtk(h),dmg:'1d8',dmgB:0,dt:'necrotic',melee:true,reach:1,magical:true,crit:20,extra:[]}; const r=await doAttack(h,t,p,{spell:1,spellAtk:'m'}); if(r.hit) applyCond(t,'poisoned',1,h); }},
  secondWind:{res:'wind',cost:'bonus',tg:'self',run:async h=>{ healC(h,rollDice('1d10').total+h.level); }},
  actionSurge:{res:'surge',cost:'free',tg:'self',ok:h=>G.combat&&G.combat.ts&&!G.combat.ts.surged,run:async h=>{ G.combat.ts.action++; G.combat.ts.surged=1; log(h.name+' surges into action!','good'); }},
  rally:{res:'rally',cost:'bonus',tg:'ally',range:6,run:async(h,t)=>{ const n=rollDice('1d8').total+h.level; t.tempHp=Math.max(t.tempHp||0,n); floater(t.x,t.y,'+'+n+' temp','#8ac'); }},
  warcry:{res:'warcry',cost:'action',tg:'none',run:async h=>{ allies(h).filter(a=>dist(a,h)<=6).forEach(a=>addFx(a,{id:'warcry',rounds:10})); log(h.name+' bellows a war cry! Allies gain advantage on their next attack.','good'); }},
  wholeness:{res:'whole',cost:'action',tg:'self',run:async h=>{ healC(h,3*h.level); }},
  emberFists:{res:'ki',cost:'bonus',tg:'self',run:async h=>{ addFx(h,{id:'emberfists',rounds:1}); }},
  smokeStep:{res:'ki',n:2,cost:'bonus',tg:'point',range:6,run:async(h,t,x,y)=>{ if(blocksMove(G.run.map,x,y)||occupied(x,y,h)){ log('Blocked.'); h.res.ki+=2; return; } h.x=x; h.y=y; addFx(h,{id:'hidden',rounds:2}); floater(x,y,'smoke','#aaa'); computeVis(); }},
  divineSense:{res:'dsense',cost:'action',tg:'none',run:async h=>{ let n=0; for(const e of G.run.map.ents){ if(e.type==='mon'&&e.hp>0&&['undead','fiend','celestial'].includes(mdef(e).type)){ G.run.map.explored[e.y*G.run.map.w+e.x]=1; e.sensed=1; n++; } } log('Divine Sense: '+n+' unholy presences on this floor.','good'); }},
  layOnHands:{res:'loh',pool:1,cost:'action',tg:'ally',range:1,run:async(h,t)=>{ const need=cMaxHP(t)-Math.max(0,t.hp); const g=Math.min(need,h.res.loh+1); h.res.loh-=g-1; healC(t,g); remFx(t,'poisoned'); remFx(t,'diseased'); }},
  sacredWeapon:{res:'channel',cost:'bonus',tg:'self',run:async h=>{ addFx(h,{id:'sacredweapon',rounds:10}); }},
  vigilBrand:{res:'channel',cost:'bonus',tg:'enemy',range:6,run:async(h,t)=>{ addFx(t,{id:'vigilbrand',rounds:10}); log(cName(t)+' is branded by the Vigil.','good'); }},
  primeval:{res:'primeval',cost:'action',tg:'none',run:async h=>{ for(const e of G.run.map.ents) if(e.type==='mon'&&e.hp>0){ G.run.map.explored[e.y*G.run.map.w+e.x]=1; e.sensed=1; } log('Primeval Awareness: you sense every creature on this floor.','good'); }},
  deathmark:{cost:'bonus',tg:'enemy',range:18,run:async(h,t)=>{ addFx(t,{id:'deathmark',rounds:100,src:h.id}); }},
  poisoner:{cost:'bonus',tg:'self',run:async h=>{ addFx(h,{id:'poisonblade',rounds:10}); log(h.name+' coats a blade in venom.'); }},
  saintToll:{res:'toll',cost:'action',tg:'none',run:async h=>{ for(const e of enemiesOf(h).filter(e=>dist(e,h)<=3)){ const s=doSave(e,'wis',spellDC(h),{cond:'frightened',magic:1}); await DICE.flush(); log(s.txt); const d=rollDice('3d8').total; dealDamage(e,s.ok?Math.floor(d/2):d,'psychic',h,{magical:true}); if(!s.ok) applyCond(e,'frightened',2,h); } }},
  shadowmeld:{cost:'bonus',tg:'self',run:async h=>heroHide(h)},
};
// derived/common features as actions
function turnFoes(h,types){ const dc=spellDC(h); for(const e of enemiesOf(h).filter(e=>dist(e,h)<=6&&types.includes(cType(e)))){ const s=doSave(e,'wis',dc,{turn:1,magic:1}); log(s.txt); if(!s.ok){ const cr=mdef(e).cr; if(heroFeatures(h).has('destroyUndead')&&cr<=(h.level>=8?1:0.5)){ log(cName(e)+' is destroyed by holy power!','good'); dealDamage(e,e.hp,'radiant',h,{magical:true}); } else applyCond(e,'frightened',10,h,{turned:1}); } } }
function heroHide(h){ const r=skillCheck(h,'stealth',null,{passtrace:G.run.passtrace}); const best=Math.max(0,...enemiesOf(h).filter(e=>dist(e,h)<=12).map(e=>passive(e,'perception'))); log(r.txt+' vs passive Perception '+best); if(r.total>=best&&(!adjacentFoes(h).length||heroFeatures(h).has('vanish'))){ addFx(h,{id:'hidden',rounds:2}); log(h.name+' is hidden.','good'); return true; } log(h.name+' fails to hide.'); return false; }
function featActions(h){ const F=heroFeatures(h); const out=[];
  for(const f of F){ const a=FEAT_ACT[f]; if(!a) continue; const def=FEATURES[f]; const n=a.n||1; const have=a.res?(h.res[a.res]||0):1; out.push({id:f,n:def.n,d:def.d,cost:a.cost,tg:a.tg,range:a.range,usable:have>=n&&(!a.ok||a.ok(h)),left:a.res?have:null}); }
  if(RACES[h.race].breath&&h.res.breath>0) out.push({id:'breath',n:'Breath Weapon',d:'Dragonborn breath: 15-ft cone, Dex save, '+breathDice(h)+' '+DRAGON_ANCESTRY[h.dragon||'red']+'.',cost:'action',tg:'point',range:3,usable:true,left:h.res.breath});
  if(F.has('ki')){ out.push({id:'flurry',n:'Flurry of Blows',d:'1 ki, bonus: two unarmed strikes (after Attack).',cost:'bonus',tg:'enemy',range:1,usable:h.res.ki>=1&&G.combat&&G.combat.ts.attacked,left:h.res.ki}); out.push({id:'patient',n:'Patient Defense',d:'1 ki, bonus: Dodge.',cost:'bonus',tg:'self',usable:h.res.ki>=1,left:h.res.ki}); out.push({id:'stepwind',n:'Step of the Wind',d:'1 ki, bonus: Dash or Disengage.',cost:'bonus',tg:'self',usable:h.res.ki>=1,left:h.res.ki}); }
  if(F.has('martialArts')&&!F.has('ki')||F.has('martialArts')) out.push({id:'maBonus',n:'Martial Arts strike',d:'Bonus: one unarmed strike after attacking.',cost:'bonus',tg:'enemy',range:1,usable:G.combat&&G.combat.ts.attacked});
  if(F.has('cunning')){ out.push({id:'cDash',n:'Cunning: Dash',cost:'bonus',tg:'self',usable:true}); out.push({id:'cDis',n:'Cunning: Disengage',cost:'bonus',tg:'self',usable:true}); out.push({id:'cHide',n:'Cunning: Hide',cost:'bonus',tg:'self',usable:true}); }
  if(F.has('quickStep')) out.push({id:'cDis',n:'Quick Step: Disengage',cost:'bonus',tg:'self',usable:true});
  if(hasFx(h,'wildshape')) out.push({id:'unshape',n:'Revert form',cost:'bonus',tg:'self',usable:true});
  if(hasFx(h,'spiritweapon')) out.push({id:'spiritAtk',n:'Spiritual Weapon strike',cost:'bonus',tg:'enemy',range:12,usable:true});
  if(hasFeat(h,'medic')) out.push({id:'medic',n:'Battle Medic',d:FEATS.medic.d,cost:'action',tg:'ally',range:1,usable:(h.res.medic||0)>0,left:h.res.medic||0});
  if(F.has('sporeBloom')) out.push({id:'sporeBloom',n:FEATURES.sporeBloom.n,d:FEATURES.sporeBloom.d,cost:'reaction',tg:'none',usable:false});
  return out; }
function breathDice(h){ return (h.level>=16?5:h.level>=11?4:h.level>=6?3:2)+'d6'; }
async function useFeat(h,id,t,x,y){ const ts=G.combat?G.combat.ts:null; const spend=c=>{ if(!ts) return; if(c==='action') ts.action--; else if(c==='bonus') ts.bonus--; };
  const a=FEAT_ACT[id];
  if(a){ if(a.res) h.res[a.res]-=(a.n||1); spend(a.cost); await a.run(h,t,x,y); }
  else if(id==='breath'){ h.res.breath--; spend('action'); const dt=DRAGON_ANCESTRY[h.dragon||'red']; const sp={area:{sh:'cone',sz:3}}; const tiles=areaTiles(sp,h,x,y); flashArea(tiles); const d=rollDice(breathDice(h)).total; for(const e of creaturesIn(tiles).filter(e=>e!==h)){ const s=doSave(e,'dex',8+abilMod(h,'con')+profFor(h.level),{}); await DICE.flush(); log(s.txt); dealDamage(e,s.ok?Math.floor(d/2):d,dt,h,{}); } }
  else if(id==='medic'){ h.res.medic--; spend('action'); healC(t,rollDice('1d6+4').total+(t.level||1)); }
  else if(id==='flurry'){ h.res.ki--; spend('bonus'); const p=weaponProfile(h,null,'unarmed'); for(let i=0;i<2;i++){ if(!alive(t)) break; await doAttack(h,t,p,{flurry:1}); } }
  else if(id==='maBonus'){ spend('bonus'); await doAttack(h,t,weaponProfile(h,null,'unarmed')); }
  else if(id==='patient'){ h.res.ki--; spend('bonus'); addFx(h,{id:'dodging',rounds:1}); }
  else if(id==='stepwind'){ h.res.ki--; spend('bonus'); ts.move+=cSpeedTiles(h); addFx(h,{id:'disengaged',rounds:1}); }
  else if(id==='cDash'){ spend('bonus'); ts.move+=cSpeedTiles(h); }
  else if(id==='cDis'){ spend('bonus'); addFx(h,{id:'disengaged',rounds:1}); }
  else if(id==='cHide'){ spend('bonus'); heroHide(h); }
  else if(id==='unshape'){ spend('bonus'); remFx(h,'wildshape'); }
  else if(id==='spiritAtk'){ spend('bonus'); await spiritStrike(h,t); }
  UI.refreshParty(); R.dirty=true; checkCombatEnd(); }
// ===================== Basic actions =====================
async function heroAttack(h,t,p){ const ts=G.combat.ts;
  if(ts.attacksLeft>0) ts.attacksLeft--; else { ts.action--; ts.attacksLeft=numAttacks(h)-1; }
  ts.attacked=true; ts.lastWeapon=p.mode;
  if(p.thrown&&p.item){ /* thrown weapons return (simplified) */ }
  if(h.tog&&h.tog.reckless&&heroFeatures(h).has('reckless')&&p.melee) addFx(h,{id:'reckless',rounds:1});
  const r=await doAttack(h,t,p,{fromHiding:hasFx(h,'hidden')});
  if(h.tog&&h.tog.reckless) {}
  // frenzy bonus attack
  UI.refreshParty(); checkCombatEnd(); return r; }
function numAttacks(h){ if(hasFx(h,'wildshape')) return 1+(heroFeatures(h).has('extraAttack')?1:0); let n=1; const F=heroFeatures(h); if(F.has('extraAttack')) n=2; if(h.cls==='fighter'&&h.level>=11) n=3; if(F.has('pact')&&h.pactBlade&&h.level>=5) n=Math.max(n,2); const hb=getClass(h.cls); if(hb.homebrew&&hb.extraAttackAt&&h.level>=hb.extraAttackAt) n=Math.max(n,2); if(hasFx(h,'hasted')) n++; return n; }
function canOffhand(h){ const m=h.eq.main, o=h.eq.off; return m&&o&&o.kind==='weapon'&&WEAPONS[m.base].p.includes('light')&&WEAPONS[o.base].p.includes('light'); }
async function offhandAttack(h,t){ G.combat.ts.bonus--; await doAttack(h,t,weaponProfile(h,h.eq.off,'off')); checkCombatEnd(); }
async function frenzyAttack(h,t){ G.combat.ts.bonus--; await doAttack(h,t,heroAttackOptions(h)[0]); checkCombatEnd(); }
function doDodge(h){ G.combat.ts.action--; addFx(h,{id:'dodging',rounds:1}); log(h.name+' takes the Dodge action.'); }
function doDash(h){ G.combat.ts.action--; G.combat.ts.move+=cSpeedTiles(h); log(h.name+' dashes.'); }
function doDisengage(h){ G.combat.ts.action--; addFx(h,{id:'disengaged',rounds:1}); log(h.name+' disengages.'); }
function doHelp(h,t){ G.combat.ts.action--; addFx(t,{id:'helped',rounds:2}); log(h.name+' helps '+cName(t)+' (advantage on next attack).'); }
async function useItemCombat(h,it,t,x,y){ const ts=G.combat?G.combat.ts:null; if(ts){ if(heroFeatures(h).has('fastHands')&&ts.bonus>0) ts.bonus--; else ts.action--; }
  await useConsumable(h,it,t,x,y); checkCombatEnd(); }
async function useConsumable(h,it,t,x,y){ const g=GEAR[it.base]; if(!g) return; const u=g.use||{}; t=t||h;
  consumeItem(it,h);
  if(u.heal){ let amt=rollDice(u.heal).total; if(hasFeat(h,'medic')&&it.base==='healerskit') amt+=4; healC(t,amt); log(h.name+' uses '+g.n+' on '+cName(t)+'.','good'); if(it.base==='healerskit'&&downed(t)){ t.deathS.s=3; } }
  if(u.fx){ const fx=u.fx;
    if(fx==='giantstr') addFx(t,{id:'giantstr',rounds:-1,persist:1});
    else if(fx==='heroism'){ addFx(t,{id:'heroism',rounds:10,thp:10}); t.tempHp=Math.max(t.tempHp||0,10); addFx(t,{id:'blessed',rounds:10}); }
    else if(fx==='invis') addFx(t,{id:'invisible',rounds:10});
    else if(fx==='haste') addFx(t,{id:'hasted',rounds:10});
    else if(fx==='resistall') addFx(t,{id:'resistall',rounds:-1,persist:1});
    else if(fx==='antitoxin'){ addFx(t,{id:'antitoxin',rounds:-1,persist:1}); remFx(t,'poisoned'); }
    else if(fx==='cleanse'){ ['diseased','blinded','poisoned','paralyzed'].forEach(k=>remFx(t,k)); }
    else if(fx==='firebreath'){ const f=enemiesOf(h).filter(e=>dist(e,h)<=3).sort((a,b)=>dist(a,h)-dist(b,h))[0]; if(f){ const tiles=areaTiles({area:{sh:'cone',sz:3}},h,f.x,f.y); flashArea(tiles); const d=rollDice('4d6').total; for(const v of creaturesIn(tiles).filter(v=>v!==h)){ const s=doSave(v,'dex',13,{}); await DICE.flush(); dealDamage(v,s.ok?Math.floor(d/2):d,'fire',h,{magical:true}); } } else log('No enemy close enough to burn.'); }
    else if(fx==='return'){ log('The Writ of Return flares — the party is pulled home!','good'); G.run.returned=true; setTimeout(()=>returnToTavern(true),G.fast?0:600); }
    else if(fx==='torch'){ G.run.lightBonus=(G.run.lightBonus||0)+1; computeVis(); log('Torchlight pushes back the dark.'); }
    else if(fx==='stabilize'){ if(downed(t)){ t.deathS.s=3; log(cName(t)+' is stabilized.','good'); if(hasFeat(h,'medic')) healC(t,4+die(6)); } }
    log(h.name+' uses '+g.n+(t!==h?' on '+cName(t):'')+'.'); }
  if(u.throwDmg){ const pt={x:t.x!=null?t.x:x,y:t.y!=null?t.y:y}; const tiles=[[pt.x,pt.y]]; const victims=creaturesIn(tiles);
    for(const v of victims){ if(u.vs&&!u.vs.includes(cType(v))){ log('No effect on '+cName(v)+'.'); continue; } const p={n:g.n,hit:abilMod(h,'dex')+profFor(h.level),dmg:u.throwDmg,dmgB:0,dt:u.dt,ranged:true,r:4,lr:8,magical:true,crit:20,extra:[]}; await doAttack(h,v,p,{}); if(it.base==='alchfire'&&alive(v)) addFx(v,{id:'burning',rounds:3,dot:'1d4',dt:'fire'}); } }
  UI.refreshParty(); }
function consumeItem(it,h){ const pack=G.run?G.run.pack:G.stash; const i=pack.indexOf(it); if(it.qty>1){ it.qty--; return; } if(i>=0) pack.splice(i,1); }
async function castFromScroll(h,it,t,x,y){ const ts=G.combat?G.combat.ts:null; if(ts) ts.action--; consumeItem(it,h); h._freeCast=true; await castSpell(h,it.spell,SPELLS[it.spell].l,t,x,y); checkCombatEnd(); }
// opportunity attacks during movement
async function moveAlong(c,path,opts){ opts=opts||{}; const map=G.run.map;
  for(const [nx,ny] of path){ if(!alive(c)||G.dead) return false;
    if(G.combat&&!opts.free){ // OA check: leaving reach of enemies
      if(!hasFx(c,'disengaged')&&!(c.isHero===false&&(mdef(c).traits||[]).includes('nimbleEscape')&&c._nimble)){
        for(const e of enemiesOf(c)){ if(!alive(e)||incapacitated(e)||e.reaction===false||hasFx(e,'charmed')) continue; const reach=e.isHero?(heroAttackOptions(e)[0].reach||1):Math.max(1,...mdef(e).atks.filter(a=>a.r<=2).map(a=>a.r)); if(dist(e,c)<=reach&&dist2(nx,ny,e.x,e.y)>reach){
          e.reaction=false; log(cName(e)+' makes an opportunity attack!','bad');
          const p=e.isHero?heroAttackOptions(e).find(p=>p.melee):monAttackProfile(e,mdef(e).atks.find(a=>a.r<=2)); if(p){ const r=await doAttack(e,c,p);  }
          if(!alive(c)) return false; } } } }
    c.x=nx; c.y=ny; if(c.isHero) { computeVis(); if(!G.combat) centerOn(nx,ny); }
    R.dirty=true;
    if(G.combat){ const tile=tileAt(map,nx,ny); G.combat.ts.move-=(tile===T.WATER||tile===T.RUBBLE)?2:1; if(tile===T.DOOR) setTile(map,nx,ny,T.DOOROPEN); if(c.isHero){ const tr=map.ents.find(e=>e.type==='trap'&&e.x===nx&&e.y===ny&&!e.disarmed&&!e.triggered); if(tr) { await triggerTrap(tr,c); if(!alive(c)) return false; } } }
    await sleep(G.combat?140:90);
  }
  return true; }
// ===================== Combat flow =====================
function inCombatMons(){ return G.run.map.ents.filter(e=>e.type==='mon'&&!e.ally&&e.inCombat&&e.hp>0); }
async function startCombat(trigger,opts){ opts=opts||{}; if(G.combat) { joinCombat(trigger); return; }
  const map=G.run.map; const group=new Set(); const seeds=Array.isArray(trigger)?trigger:[trigger];
  for(const s of seeds){ map.ents.filter(e=>e.type==='mon'&&!e.ally&&e.hp>0&&(e.group===s.group||e===s)).forEach(e=>group.add(e)); }
  // nearby awake creatures join
  const party=activeParty().filter(h=>h.x!=null&&h.status!=='fallen');
  for(const e of map.ents){ if(e.type==='mon'&&!e.ally&&e.hp>0&&!group.has(e)&&party.some(h=>dist(h,e)<=6&&los(map,h.x,h.y,e.x,e.y))) group.add(e); }
  group.forEach(e=>{ e.inCombat=true; e.awake=true; e.hidden=false; e.reaction=true; });
  G.combat={round:0,order:[],idx:-1,zones:[],xp:0,cur:null,ts:null,surprised:new Set(),log:[]};
  if(opts.monSurprised) group.forEach(e=>G.combat.surprised.add(e.uid));
  if(opts.heroSurprised) party.forEach(h=>{ const F=heroFeatures(h); if(!(F.has('feral')||F.has('watcherGift')||hasFeat(h,'watchful')||gearFx(h).noSurprise)) G.combat.surprised.add(h.id); });
  // initiative
  const roll=c=>{ let adv=0; if(c.isHero){ if(heroFeatures(c).has('feral')) adv=1; if(gearFx(c).initAdv) adv=1; } const r=d20(adv,c.isHero&&RACES[c.race].lucky); const b=c.isHero?initBonus(c):amod(mdef(c).ab[1]); c.init=r.r+b+(c.isHero?0.1:0)+Math.random()*0.01; return c; };
  const mins=partyMinions(); mins.forEach(m=>{ m.inCombat=true; m.reaction=true; const own=minionOwner(m); if(own&&own.x!=null&&m.x===own.x&&m.y===own.y){ const p=freeTileNear(own.x,own.y,3); if(p){ m.x=p[0]; m.y=p[1]; } } });
  G.combat.order=[...party,...mins,...group].map(roll).sort((a,b)=>b.init-a.init);
  // remark
  if(heroFeaturesAny('jack')){}
  log('⚔ Combat! Initiative: '+G.combat.order.map(c=>cName(c)+' '+Math.floor(c.init)).join(', '),'sys');
  if(opts.monSurprised) log('The enemy is caught by surprise!','good'); if(opts.heroSurprised) log('Ambush! The party is caught by surprise!','bad');
  for(const m of group){ const md=mdef(m); if((md.traits||[]).includes('horrifying')||(md.traits||[]).includes('dreadfulGlare')){ m._fear=true; } }
  // music/codex
  for(const m of group){ unlockCodex(mdef(m).type); }
  UI.enterCombat(); R.dirty=true;
  runCombat();
}
function heroFeaturesAny(f){ return activeParty().some(h=>heroFeatures(h).has(f)); }
function joinCombat(seed){ const map=G.run.map; for(const e of map.ents){ if(e.type==='mon'&&!e.ally&&e.hp>0&&!e.inCombat&&(e.group===seed.group||e===seed)){ e.inCombat=true; e.awake=true; e.hidden=false; const r=d20(0); e.init=r.r+amod(mdef(e).ab[1]); const i=G.combat.order.findIndex(c=>c.init<e.init); if(i<0) G.combat.order.push(e); else { G.combat.order.splice(i,0,e); if(i<=G.combat.idx) G.combat.idx++; } log(mdef(e).n+' joins the fight!','bad'); } } UI.refreshInit(); }
async function runCombat(){ const C=G.combat; if(!C) return;
  while(G.combat===C){
    C.idx++; if(C.idx>=C.order.length){ C.idx=0; C.round++; if(C.round===0) C.round=1; if(checkStalemate(C)) return; await roundStart(); }
    if(C.round===0){ C.round=1; await roundStart(); }
    C.order=C.order.filter(c=>c.isHero?(c.status!=='fallen'&&activeParty().includes(c)):(c.hp>0&&!c.dead)); if(C.idx>=C.order.length) continue;
    const c=C.order[C.idx]; C.cur=c; UI.refreshInit();
    if(C.surprised.has(cUid(c))&&C.round===1){ log(cName(c)+' is surprised and loses the turn.'); continue; }
    if(hasFx(c,'banished')) { tickFx(c); continue; }
    const skip=await turnStart(c); await DICE.flush(); if(G.combat!==C) return; if(checkCombatEnd()) return;
    if(!skip){ if(c.isHero) await heroTurn(c); else if(c.ally) await minionTurn(c); else await monsterTurn(c); }
    if(G.combat!==C) return; turnEnd(c); await DICE.flush(); if(checkCombatEnd()) return;
    // legendary actions: boss gets a free attack after a hero turn
    if(c.isHero){ for(const b of inCombatMons().filter(m=>(mdef(m).traits||[]).includes('legendary')&&!incapacitated(m)&&(m.leg||0)<1)){ const t=enemiesOf(b).filter(h=>alive(h)&&dist(h,b)<=1)[0]; if(t){ b.leg=(b.leg||0)+1; log(cName(b)+' uses a Legendary Action!','bad'); await doAttack(b,t,monAttackProfile(b,mdef(b).atks[0])); if(checkCombatEnd()) return; } } }
  } }
async function roundStart(){ for(const m of inCombatMons()) m.leg=0; UI.refreshInit(); }
function tickFx(c){ c.fx=(c.fx||[]).filter(e=>{ if(e.rounds>0){ e.rounds--; if(e.rounds===0) return false; } return true; }); }
async function turnStart(c){ const C=G.combat; c.reaction=true; c._nimble=false;
  C.ts={move:cSpeedTiles(c),action:1,bonus:1,attacksLeft:0,attacked:false,sneak:false};
  if(hasFx(c,'slowed')) C.ts.bonus=0;
  // durations
  const wasRaging=hasFx(c,'raging'); tickFx(c); if(wasRaging&&!hasFx(c,'raging')) log(cName(c)+'\'s rage subsides.');
  if(c.isHero&&hasFx(c,'heroism')){ const hz=getFx(c,'heroism'); c.tempHp=Math.max(c.tempHp||0,hz.thp||3); }
  // damage over time
  for(const e of (c.fx||[]).filter(e=>e.dot)) dealDamage(c,rollDice(e.dot).total,e.dt||'fire',null,{});
  // zones
  for(const z of C.zones){ const owner=[...activeParty(),...G.run.map.ents].find(x=>cUid(x)===z.owner); let inside; if(z.follow){ const f=owner; inside=f&&alive(f)&&dist(f,c)<=z.sz&&isFoe(f,c); } else inside=dist2(c.x,c.y,z.x,z.y)<=z.sz&&(!z.foesOnly||!owner||isFoe(owner,c));
    if(inside&&alive(c)){ let d=rollDice(z.dmg).total; if(z.sv){ const s=doSave(c,z.sv,z.dc,{magic:1}); await DICE.flush(); log(z.n+': '+s.txt); if(s.ok) d=z.half?Math.floor(d/2):0; } if(d) dealDamage(c,d,z.dt,owner,{magical:true,spell:1}); } }
  C.zones.forEach(z=>{ if(z.owner===cUid(c)&&z.rounds>0) z.rounds--; }); C.zones=C.zones.filter(z=>z.rounds!==0);
  // monster regen
  if(!c.isHero){ const md=mdef(c); if(md.regen&&c.hp>0&&!c._noRegen) healC(c,md.regen); c._noRegen=false; if(md.breath&&c.breathUsed&&die(6)>=md.breath.rech) c.breathUsed=false; }
  if(c.isHero&&c.hp>0&&heroFeatures(c).has('survivor')&&c.hp<cMaxHP(c)/2) healC(c,5+abilMod(c,'con'));
  // death saves
  if(downed(c)){ if(c.deathS.s>=3) return true; await deathSave(c); return true; }
  if(!alive(c)) return true;
  if(incapacitated(c)){ log(cName(c)+' is incapacitated.'); return true; }
  return false; }
function turnEnd(c){ // repeat saves
  for(const e of (c.fx||[]).slice()){ if(e.save&&alive(c)){ const s=doSave(c,e.save.a,e.save.dc,{magic:1,cond:e.id}); if(s.ok){ remFx(c,e.id); log(cName(c)+' shakes off '+e.id+'. '+s.txt,'good'); } } }
  if(c.isHero&&c.tog) c.tog.smite=false;
  remFx(c,'emberfists'); if(c.isHero) remFx(c,'reckless_used');
  R.dirty=true; UI.refreshParty(); }
async function deathSave(h){ const r=d20(hasFx(h,'requiemAdv')||heroFeatures(h).has('deathless')?1:0,RACES[h.race].lucky); let t='';
  if(r.r===20){ h.hp=1; h.deathS={s:0,f:0}; remFx(h,'unconscious'); t='NATURAL 20 — '+h.name+' rises with 1 HP!'; }
  else if(r.r===1){ h.deathS.f+=2; t='natural 1 — two failures'; }
  else if(r.r>=10){ h.deathS.s++; t='success ('+h.deathS.s+'/3)'; if(h.deathS.s>=3) t+=' — stable.'; }
  else { h.deathS.f++; t='failure ('+h.deathS.f+'/3)'; }
  if(typeof DICE!=='undefined') await DICE.reveal(diceRec(h,'death','Death saving throw',r,0,r.r,10,r.r>=10,{note:t}));
  UI.roll(h.name+' death save: d20['+r.r+'] — '+t,r.r>=10?'hit':'miss'); log('☠ '+h.name+' death save: '+r.r+' — '+t,r.r>=10?'good':'bad'); checkDeath(h); UI.refreshParty(); await sleep(700); }
function heroTurn(h){ return new Promise(res=>{ G.combat.endTurn=res; if(!G.fast) centerOn(h.x,h.y); UI.heroTurn(h); if(G.autoPlay) autoHeroTurn(h).then(()=>endHeroTurn()); }); }
function endHeroTurn(){ if(!G.combat||!G.combat.endTurn) return; const f=G.combat.endTurn; G.combat.endTurn=null; UI.clearTargeting(); f(); }
function checkCombatEnd(){ if(!G.combat) return true;
  const foes=inCombatMons().filter(m=>!hasFx(m,'banished')||true); const heroesUp=activeParty().filter(h=>h.x!=null&&alive(h));
  if(foes.length===0){ endCombat(true); return true; }
  if(heroesUp.length===0){ endCombat(false); return true; }
  return false; }
// Stalemate: if neither side can reach the other (e.g. a fight that started across a locked door) and nobody's HP has changed
// for 3 full rounds, the fight breaks off instead of looping forever (no XP; the monsters stay awake where they are).
function combatSig(C){ return C.order.map(c=>c.hp+'/'+(c.tempHp||0)+'/'+(c.deathS?c.deathS.s+'.'+c.deathS.f:'')+'@'+c.x+','+c.y).join(';'); }
function sidesCutOff(){ const map=G.run.map; const heroes=activeParty().filter(h=>h.x!=null&&alive(h)); const tgt=new Set(heroes.map(h=>h.y*map.w+h.x));
  for(const e of map.ents) if(e.type==='mon'&&e.ally&&e.hp>0) tgt.add(e.y*map.w+e.x);
  const wall=(x,y)=>{ if(tgt.has(y*map.w+x)) return false; const t=tileAt(map,x,y); if(t===T.LOCKED||t===T.SECRET) return true; return map.ents.some(e=>e.x===x&&e.y===y&&(hardBlocker(e)||(e.type==='obstacle'&&!e.cleared))); };
  for(const m of inCombatMons()){ const B=bfs(map,m.x,m.y,400,wall); for(const k of tgt){ const x=k%map.w,y=(k/map.w)|0; for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) if(B.dist.has((y+dy)*map.w+x+dx)) return false; } }
  return true; }
function checkStalemate(C){ const sig=combatSig(C); if(sig!==C.stSig){ C.stSig=sig; C.stRounds=0; return false; } C.stRounds=(C.stRounds||0)+1; if(C.stRounds<3||!sidesCutOff()) return false;
  log('Neither side can reach the other. The fight breaks off.','bad'); toast('The fight breaks off');
  G.combat=null; if(C.endTurn){ const f=C.endTurn; C.endTurn=null; setTimeout(f,0); }
  for(const e of G.run.map.ents) if(e.type==='mon'){ e.inCombat=false; if(e.fx) e.fx=e.fx.filter(f=>f.persist); }
  for(const h of activeParty()){ h.fx=(h.fx||[]).filter(f=>f.persist); h.reaction=true; }
  UI.exitCombat(); computeVis(); R.dirty=true; UI.refreshParty(); autosave(); return true; }
function endCombat(win){ const C=G.combat; if(!C) return; G.combat=null; if(C.endTurn) { const f=C.endTurn; C.endTurn=null; setTimeout(f,0); }
  const party=activeParty();
  for(const e of G.run.map.ents) if(e.type==='mon'){ e.inCombat=false; if(e.fx) e.fx=e.fx.filter(f=>f.persist); }
  if(!win){ UI.exitCombat(); tpk(); return; }
  const live=party.filter(h=>h.status!=='fallen'); const xpEach=Math.round(C.xp/Math.max(1,live.length));
  for(const h of party){ h.fx=(h.fx||[]).filter(f=>f.persist); h.conc=null; h.tempHp=0; h.reaction=true; if(h.status==='fallen') continue;
    if(h.hp<=0){ h.hp=1; h.deathS={s:0,f:0}; const sev=h.deathS.f>=2?2:1; const inj=addInjury(h,sev); log(h.name+' staggers up at 1 HP'+(inj?' with a lasting injury: '+inj.n:'')+'.','bad'); if(inj) toast(h.name+': '+inj.n); }
    h.xp+=xpEach; const g=gearFx(h); if(g.regenAfter) healC(h,g.regenAfter);
    if(h.wildshape) {} }
  G.run.xp+=C.xp; log('Victory! Each hero gains '+xpEach+' XP.','good'); UI.roll('Victory! +'+xpEach+' XP each','crit');
  if(party.some(h=>canLevel(h))) toast('A hero can level up! Open their sheet.');
  UI.exitCombat(); computeVis(); R.dirty=true; UI.refreshParty(); autosave();
  if(G.run.pendingBossDone){ G.run.pendingBossDone=false; setTimeout(()=>UI.bossVictory(),G.fast?0:600); }
}
function tpk(){ if(!G.run||G.run.tpk) return; log('The party has fallen...','bad'); G.run.tpk=true; setTimeout(()=>UI.tpkScreen(),G.fast?0:900); }
function onBossKilled(m){ G.run.objectiveDone=true; G.run.bossKilled=m.mid; G.run.pendingBossDone=true; logJournal('Slain: '+mdef(m).n+'.'); const ch=STORY.find(s=>s.boss===m.mid); if(ch) unlockCodex('inscription'+Math.min(6,STORY.indexOf(ch)+1)); }
// ===================== Monster AI =====================
function chooseTarget(m,list){ const md=mdef(m); let best=null,bs=-1e9; for(const h of list){ let s=-dist(m,h)*3; if(h.hp<=0) s-=md.type==='undead'||(md.traits||[]).includes('aggressive')?5:40; s+=(1-h.hp/cMaxHP(h))*10; if(h.conc) s+=6; if(hasFx(h,'invisible')) s-=20; if(hasFx(h,'hidden')) s-=25; const ch=getFx(m,'charmed'); if(ch&&ch.src===cUid(h)) s-=100; if(s>bs){ bs=s; best=h; } } return best; }
async function monsterTurn(m){ const C=G.combat; const md=mdef(m); const tr=md.traits||[]; const map=G.run.map;
  if(!G.fast){ centerOn(m.x,m.y); await sleep(250); }
  const foes=enemiesOf(m).filter(h=>h.hp>0||(h.hp<=0&&h.status!=='fallen'));
  if(!foes.length) return;
  // frightened / turned: flee
  const fr=getFx(m,'frightened'); if(fr&&(fr.turned||Math.random()<0.6)){ const src=[...activeParty()].find(h=>h.id===fr.src)||foes[0]; await stepAway(m,src); C.ts.action=0; return; }
  // specials
  C.mturn=(C.mturn||0)+1;
  if(tr.includes('summonRats')&&C.round%3===1&&C.round>1){ summonMinions(m,'giantrat',2); }
  if(tr.includes('raiseDead')&&C.round%3===2){ summonMinions(m,'zombie',1); }
  if(tr.includes('summonSpawn')&&C.round%4===2){ summonMinions(m,MONSTERS.ghoul?'ghoul':'zombie',2); }
  if((tr.includes('horrifying')||tr.includes('dreadfulGlare'))&&!m._feared){ m._feared=true; for(const h of foes.filter(h=>alive(h)&&dist(h,m)<=6)){ const s=doSave(h,'wis',md.caster?md.caster.dc:13,{cond:'frightened'}); await DICE.flush(); log(s.txt); if(!s.ok) applyCond(h,'frightened',2,m,{save:{a:'wis',dc:13}}); } }
  if(tr.includes('wail')&&!m._wailed&&m.hp<m.hpMax*0.6){ m._wailed=true; log(md.n+' lets out a horrible WAIL!','bad'); for(const h of foes.filter(h=>alive(h)&&dist(h,m)<=6)){ const s=doSave(h,'con',13,{}); await DICE.flush(); log(s.txt); dealDamage(h,s.ok?Math.floor(rollDice('3d6').total/2):rollDice('3d6').total+6,'psychic',m,{magical:true}); } return; }
  if(tr.includes('stench')) for(const h of foes.filter(h=>alive(h)&&dist(h,m)<=1&&!hasFx(h,'stenchImm'))){ const s=doSave(h,'con',10,{cond:'poisoned'}); await DICE.flush(); if(!s.ok){ applyCond(h,'poisoned',1,m); log(cName(h)+' gags on the stench.'); } else addFx(h,{id:'stenchImm',rounds:-1}); }
  if((tr.includes('petrifyingGaze')||tr.includes('gibbering'))&&Math.random()<0.5){ const t=foes.filter(h=>alive(h)&&dist(h,m)<=6)[0]; if(t){ const s=doSave(t,tr.includes('gibbering')?'wis':'con',12,{}); await DICE.flush(); log(md.n+(tr.includes('gibbering')?' gibbers maddeningly. ':' fixes its gaze. ')+s.txt); if(!s.ok) applyCond(t,tr.includes('gibbering')?'incapacitated':'restrained',1,m); } }
  if((tr.includes('enslave')||tr.includes('luringSong'))&&Math.random()<0.3){ const t=foes.filter(h=>alive(h)&&dist(h,m)<=6&&!hasFx(h,'charmed'))[0]; if(t){ const s=doSave(t,'wis',13,{cond:'charmed',magic:1}); await DICE.flush(); log(md.n+' sings a luring dirge. '+s.txt); if(!s.ok){ applyCond(t,'charmed',3,m,{save:{a:'wis',dc:13}}); return; } } }
  // breath weapon
  if(md.breath&&!m.breathUsed){ const b=md.breath; const sp={area:{sh:b.sh||'cone',sz:b.sz||3}}; let best=null,bn=0; for(const h of foes.filter(alive)){ if(dist(h,m)>sp.area.sz) continue; const n=creaturesIn(areaTiles(sp,m,h.x,h.y)).filter(c=>c.isHero).length; if(n>bn){ bn=n; best=h; } }
    if(best&&(bn>=2||Math.random()<0.6)){ m.breathUsed=true; const tiles=areaTiles(sp,m,best.x,best.y); flashArea(tiles); log('🔥 '+md.n+' uses '+(b.n||'Breath')+'!','bad'); UI.roll(md.n+': '+(b.n||'Breath Weapon')+'!','miss'); const d=rollDice(b.dmg).total; for(const v of creaturesIn(tiles).filter(c=>c!==m)){ const s=doSave(v,b.sv||'dex',b.dc,{dt:b.dt}); await DICE.flush(); log(s.txt); let dd=s.ok?Math.floor(d/2):d; if(v.isHero&&heroFeatures(v).has('evasion')&&(b.sv||'dex')==='dex') dd=s.ok?0:Math.floor(d/2); dealDamage(v,dd,b.dt,m,{magical:true}); if(b.cond&&!s.ok) applyCond(v,b.cond,2,m); } await sleep(500); return; } }
  // spellcasting
  if(md.caster&&(m.casts==null?(m.casts=md.boss?6:3):m.casts)>0&&Math.random()<0.55){ const r=await monsterCast(m,foes); if(r) { m.casts--; return; } }
  // attacks
  const melee=md.atks.filter(a=>a.r<=2), ranged=md.atks.filter(a=>a.r>2);
  let target=chooseTarget(m,foes); if(!target) return;
  const adj=foes.filter(h=>dist(h,m)<=Math.max(1,...melee.map(a=>a.r))&&(h.hp>0||Math.random()<0.4));
  if(adj.length&&melee.length){ target=chooseTarget(m,adj); }
  else if(ranged.length&&(!melee.length||dist(target,m)>3||(tr.includes('nimbleEscape')))){ // ranged attack, maybe reposition
    const tgt=foes.filter(h=>alive(h)&&los(map,m.x,m.y,h.x,h.y)&&dist(h,m)<=ranged[0].lr).sort((a,b)=>chooseScore(m,b)-chooseScore(m,a))[0];
    if(tgt&&!adjacentFoes(m).length){ for(let i=0;i<md.multi&&alive(tgt);i++){ await doAttack(m,tgt,monAttackProfile(m,ranged[i%ranged.length])); } if(tr.includes('nimbleEscape')) { m._nimble=true; } return; }
    if(tgt&&adjacentFoes(m).length&&tr.includes('nimbleEscape')){ m._nimble=true; await stepAway(m,adjacentFoes(m)[0]); for(let i=0;i<md.multi&&alive(tgt);i++) await doAttack(m,tgt,monAttackProfile(m,ranged[0])); return; }
  }
  if(!melee.length){ await approach(m,target,ranged.length?ranged[0].r:1); return; }
  const reach=Math.max(1,...melee.map(a=>a.r));
  if(dist(target,m)>reach){ await approach(m,target,reach); if(!alive(m)) return; const near=foes.filter(h=>dist(h,m)<=reach&&(h.hp>0)); if(near.length) target=chooseTarget(m,near); }
  if(dist(target,m)<=reach&&alive(m)){ const n=md.multi||1; for(let i=0;i<n;i++){ if(!(target.hp>0||downed(target))||target.status==='fallen'){ const nt=foes.filter(h=>alive(h)&&dist(h,m)<=reach)[0]; if(!nt) break; target=nt; } const a=melee[i%melee.length]; if(a.r<dist(target,m)) continue; await doAttack(m,target,monAttackProfile(m,a)); if(!G.combat) return; }
    if(tr.includes('rampage')&&!alive(target)){ const nt=foes.filter(h=>alive(h)&&dist(h,m)<=1)[0]; if(nt) await doAttack(m,nt,monAttackProfile(m,melee[0])); } }
  else if(ranged.length){ const tgt=foes.filter(h=>alive(h)&&los(map,m.x,m.y,h.x,h.y)&&dist(h,m)<=ranged[0].lr)[0]; if(tgt) await doAttack(m,tgt,monAttackProfile(m,ranged[0])); }
}
function chooseScore(m,h){ return -dist(m,h)+(1-h.hp/cMaxHP(h))*8+(h.conc?4:0); }
async function monsterCast(m,foes){ const md=mdef(m); const map=G.run.map; const list=shuffle(md.caster.list);
  for(const s of list){ const sid=MON_SPELL[s]||s; const sp=SPELLS[sid]; if(!sp) continue;
    if(sid==='shield'){ continue; }
    if(sp.heal){ const hurt=combatMonsters().filter(o=>o.hp<o.hpMax*0.5&&dist(o,m)<=Math.max(1,sp.r)); if(!hurt.length) continue; if(dist(hurt[0],m)>1&&sp.r<=1) continue; await castSpell(m,sid,sp.l,hurt[0]); return true; }
    if(sp.fx==='aura'){ if(G.combat.zones.some(z=>z.owner===m.uid)) continue; await castSpell(m,sid,sp.l,null); return true; }
    if(sp.conc&&m.conc) continue;
    const tg=foes.filter(h=>alive(h)&&dist(h,m)<=sp.r&&los(map,m.x,m.y,h.x,h.y)); if(!tg.length) continue;
    if(sp.only==='humanoid'&&!tg.some(t=>cType(t)==='humanoid')) continue;
    if(sp.tg==='area'){ let best=null,bn=0; for(const h of tg){ const tiles=sp.area.sh==='self'?areaTiles(sp,m):areaTiles(sp,m,h.x,h.y); const cs=creaturesIn(tiles); const n=cs.filter(c=>c.isHero).length-cs.filter(c=>!c.isHero).length*2; if(n>bn){ bn=n; best=h; } } if(!best) continue; await castSpell(m,sid,sp.l,null,best.x,best.y); return true; }
    const t=tg.sort((a,b)=>chooseScore(m,b)-chooseScore(m,a))[0]; await castSpell(m,sid,sp.l,t,t.x,t.y); return true; }
  return false; }
function summonMinions(m,mid,n){ if(!MONSTERS[mid]) return; const map=G.run.map; let k=0; for(const [dx,dy] of shuffle([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])){ if(k>=n) break; const x=m.x+dx, y=m.y+dy; if(!blocksMove(map,x,y)&&!occupied(x,y)){ const e=mkMon(MONSTERS[mid],x,y,m.group); e.awake=true; e.inCombat=true; e.init=m.init-0.5; e.summoned=1; map.ents.push(e); const i=G.combat.order.indexOf(m); G.combat.order.splice(i+1,0,e); k++; } } if(k) { log(mdef(m).n+' calls forth '+k+' '+MONSTERS[mid].n+(k>1?'s':'')+'!','bad'); UI.refreshInit(); } }
// Creatures may move through a friendly creature's space (5e) but never end there: friendly tiles return 2 (see bfs).
function monBlocked(m){ const map=G.run.map; const side=!!m.ally; const heroes=new Set(activeParty().filter(h=>h.x!=null&&h.status!=='fallen').map(h=>h.y*map.w+h.x)); const friends=new Set(), foes=new Set(); for(const e of map.ents){ if(e.type==='mon'&&e.hp>0&&e!==m) (!!e.ally===side?friends:foes).add(e.y*map.w+e.x); }
  const obs=new Set(map.ents.filter(e=>e.type==='obstacle'&&!e.cleared).map(e=>e.y*map.w+e.x));
  return (x,y)=>{ const i=y*map.w+x; if(obs.has(i)) return true; if(heroes.has(i)) return side?2:true; if(foes.has(i)) return true; if(friends.has(i)) return 2; return false; }; }
// Walk the real shortest path toward a tile within `reach` of t (not straight-line closest, which can stall behind a wall).
// Returns the steps affordable this turn (ending on a tile we may stop on), or null if t can't be reached at all.
function pathToward(map,sx,sy,t,reach,sp,blocked){ const F=bfs(map,sx,sy,400,blocked); let g=null,gd=1e9;
  for(const [k,d] of F.dist){ const x=k%map.w,y=(k/map.w)|0; if(d>0&&d<gd&&dist2(x,y,t.x,t.y)<=reach){ gd=d; g=[x,y]; } } if(!g) return null;
  const p=F.path(g[0],g[1]); if(!p) return null; let end=-1; for(let i=0;i<p.length;i++){ const d=F.dist.get(p[i][1]*map.w+p[i][0]); if(d!=null&&d<=sp) end=i; }
  return end>=0?p.slice(0,end+1):null; }
async function approach(m,t,reach){ const map=G.run.map; const sp=G.combat.ts.move; if(sp<=0) return; const blocked=monBlocked(m);
  const B=bfs(map,m.x,m.y,sp+12,(x,y)=>blocked(x,y)||tileAt(map,x,y)===T.LOCKED);
  let best=null,bd=1e9; for(const [k,d] of B.dist){ const x=k%map.w, y=(k/map.w)|0; const dd=dist2(x,y,t.x,t.y); if(d<=sp&&dd<=reach&&(reach>2?los(map,x,y,t.x,t.y):true)){ const s=d+dd*0.1; if(s<bd){ bd=s; best=[x,y]; } } }
  if(!best){ const pt=pathToward(map,m.x,m.y,t,reach,sp,(x,y)=>blocked(x,y)||tileAt(map,x,y)===T.LOCKED); if(pt&&pt.length){ await moveAlong(m,pt); return; }
    // unreachable: get as close as possible
    let gd=1e9; for(const [k,d] of B.dist){ if(d>sp) continue; const x=k%map.w, y=(k/map.w)|0; const dd=dist2(x,y,t.x,t.y)*10+d; if(dd<gd){ gd=dd; best=[x,y]; } } }
  if(!best||(best[0]===m.x&&best[1]===m.y)) return;
  const path=B.path(best[0],best[1]); await moveAlong(m,path.slice(0,sp)); }
async function stepAway(m,src){ const map=G.run.map; const sp=G.combat.ts.move; const blocked=monBlocked(m); const B=bfs(map,m.x,m.y,sp,(x,y)=>blocked(x,y)); let best=null,bd=-1; for(const [k,d] of B.dist){ const x=k%map.w,y=(k/map.w)|0; const dd=dist2(x,y,src.x,src.y); if(dd>bd){ bd=dd; best=[x,y]; } } if(best) await moveAlong(m,B.path(best[0],best[1])); }
// ===================== Auto-play (tests & "Auto" button) =====================
async function autoHeroTurn(h){ const C=G.combat; const foes=()=>enemiesOf(h).filter(alive);
  // heal downed ally
  const down=allies(h).find(a=>downed(a)&&a.deathS.s<3);
  if(down){ const heal=heroSpells(h).find(s=>SPELLS[s].heal&&SPELLS[s].tg!=='party')||null; if(heal&&hasSlot(h,SPELLS[heal].l)&&dist(h,down)<=Math.max(1,SPELLS[heal].r)){ C.ts.action--; await castSpell(h,heal,lowestSlot(h,SPELLS[heal].l),down); return; } }
  { const hurt=[h,...allies(h)].filter(a=>a.hp>0&&a.hp<cMaxHP(a)*0.35&&a.x!=null).sort((a,b)=>a.hp/cMaxHP(a)-b.hp/cMaxHP(b))[0];
    if(hurt){ const heal=heroSpells(h).find(s=>SPELLS[s]&&SPELLS[s].heal&&SPELLS[s].tg!=='party'&&hasSlot(h,SPELLS[s].l)&&dist(h,hurt)<=Math.max(1,SPELLS[s].r));
      if(heal&&C.ts.action>0){ C.ts.action--; await castSpell(h,heal,lowestSlot(h,SPELLS[heal].l),hurt); if(!G.combat) return; }
      else if(hurt===h&&C.ts.action>0){ const pot=(G.run.pack||[]).find(i=>GEAR[i.base]&&GEAR[i.base].use&&GEAR[i.base].use.heal&&i.base!=='healerskit'); if(pot){ C.ts.action--; await useConsumable(h,pot,h); UI.refreshParty(); return; } } } }
  if(down&&C.ts.action>0&&dist(h,down)<=1){ const kit=(G.run.pack||[]).find(i=>i.base==='potheal')||(G.run.pack||[]).find(i=>i.base==='healerskit'); if(kit){ C.ts.action--; await useConsumable(h,kit,down); UI.refreshParty(); return; } }
  if(heroFeatures(h).has('graveCall')||(h.cls==='necromancer')){ if(await autoNecroTurn(h)) return; if(!G.combat) return; }
  if(typeof ARC_autoTurn==='function'){ if(await ARC_autoTurn(h)) return; if(!G.combat) return; }
  let opts=heroAttackOptions(h); let t=foes().sort((a,b)=>dist(a,h)-dist(b,h))[0]; if(!t) return;
  const melee=opts.find(p=>p.melee), rng=opts.find(p=>p.ranged);
  // casters use cantrip attack
  const cant=heroCantrips(h).map(s=>SPELLS[s]).find(s=>s&&(s.atk||s.sv)&&s.dmg&&s.tg==='enemy');
  if(rng&&los(G.run.map,h.x,h.y,t.x,t.y)&&dist(h,t)<=rng.lr&&!adjacentFoes(h).length&&(!melee||dist(h,t)>2)){ while(C.ts.action>0||C.ts.attacksLeft>0){ if(!alive(t)){ t=foes().filter(f=>los(G.run.map,h.x,h.y,f.x,f.y))[0]; if(!t) break; } await heroAttack(h,t,rng); if(!G.combat) return; } return; }
  if(cant&&!melee.item&&dist(h,t)<=cant.r&&los(G.run.map,h.x,h.y,t.x,t.y)){ C.ts.action--; await castSpell(h,Object.keys(SPELLS).find(k=>SPELLS[k]===cant),0,t,t.x,t.y); return; }
  if(dist(h,t)>melee.reach){ const map=G.run.map; const blocked=heroBlocked(h); const B=bfs(map,h.x,h.y,C.ts.move,blocked); let best=null,bd=1e9; for(const [k,d] of B.dist){ const x=k%map.w,y=(k/map.w)|0; const dd=dist2(x,y,t.x,t.y); if(dd<=melee.reach&&d<bd){ bd=d; best=[x,y]; } } let pt=null; if(!best) pt=pathToward(map,h.x,h.y,t,melee.reach,C.ts.move,blocked); if(pt&&pt.length) await moveAlong(h,pt); else { if(!best){ let gd=1e9; for(const [k,d] of B.dist){ const x=k%map.w,y=(k/map.w)|0; const dd=dist2(x,y,t.x,t.y); if(dd<gd){ gd=dd; best=[x,y]; } } } if(best) await moveAlong(h,B.path(best[0],best[1])); } if(!G.combat||!alive(h)) return; }
  while((C.ts.action>0||C.ts.attacksLeft>0)&&dist(h,t)<=melee.reach){ await heroAttack(h,t,melee); if(!G.combat) return; if(!alive(t)){ t=foes().filter(f=>dist(f,h)<=melee.reach)[0]; if(!t) break; } }
  if(G.combat&&C.ts.action>0) doDodge(h); }
function heroBlocked(h){ const map=G.run.map; const mons=new Set(map.ents.filter(e=>e.type==='mon'&&e.hp>0).map(e=>e.y*map.w+e.x)); const heroes=new Set(activeParty().filter(o=>o!==h&&o.x!=null&&o.status!=='fallen').map(o=>o.y*map.w+o.x)); const obs=new Set(map.ents.filter(e=>e.type==='obstacle'&&!e.cleared||(e.type==='obj'&&OBJ_INFO[e.kind]&&OBJ_INFO[e.kind].block)||e.type==='chest').map(e=>e.y*map.w+e.x)); const traps=new Set(map.ents.filter(e=>e.type==='trap'&&e.found&&!e.disarmed&&!e.triggered).map(e=>e.y*map.w+e.x));
  const allyMons=new Set(map.ents.filter(e=>e.type==='mon'&&e.ally&&e.hp>0).map(e=>e.y*map.w+e.x));
  return (x,y)=>{ const i=y*map.w+x; if(obs.has(i)||traps.has(i)||tileAt(map,x,y)===T.LOCKED||tileAt(map,x,y)===T.SECRET) return true; if(allyMons.has(i)||heroes.has(i)) return 2; return mons.has(i); }; }
