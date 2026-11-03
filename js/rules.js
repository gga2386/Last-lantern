// ===== Rules engine: dice, ability scores, character math =====
let UIDC = 1;
function uid(p){ return (p||'u') + Date.now().toString(36).slice(-4) + (UIDC++).toString(36) + Math.floor(Math.random()*1296).toString(36); }
function rnd(n){ return Math.floor(Math.random()*n); }
function pick(a){ return a[rnd(a.length)]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function die(n){ return 1+rnd(n); }
function amod(s){ return Math.floor((s-10)/2); }
function fmtMod(m){ return (m>=0?'+':'')+m; }
function profFor(l){ return 2+Math.floor((Math.max(1,l)-1)/4); }
// parse "2d6+3" / "1d4+1" / "20"
function parseDice(expr){
  expr=String(expr).replace(/\s/g,''); const out={terms:[],flat:0};
  const re=/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g; let m;
  while((m=re.exec(expr))){ if(m[3]){ out.terms.push({n:(parseInt(m[2]||'1'))*(m[1]==='-'?-1:1),s:parseInt(m[3])}); } else if(m[5]) out.flat+=parseInt(m[5])*(m[4]==='-'?-1:1); }
  return out;
}
// opts: crit (double dice), gwf (reroll 1-2), max (maximize), extraDice
function rollDice(expr,opts){
  opts=opts||{}; const p=parseDice(expr); let total=p.flat; const rolls=[];
  for(const t of p.terms){ const n=Math.abs(t.n)*(opts.crit?2:1); for(let i=0;i<n;i++){ let r=opts.max?t.s:die(t.s); if(opts.gwf&&r<=2) r=die(t.s); if(opts.emp&&r<t.s/2) r=Math.max(r,die(t.s)); rolls.push(r); total+=r*Math.sign(t.n);} }
  return {total:Math.max(0,total),rolls,expr};
}
function avgDice(expr){ const p=parseDice(expr); let t=p.flat; for(const x of p.terms) t+=x.n*(x.s+1)/2; return t; }
function scaleDice(expr,mult){ const p=parseDice(expr); return p.terms.map(t=>(t.n*mult)+'d'+t.s).join('+')+(p.flat?(p.flat>0?'+':'')+p.flat:''); }
// d20 with advantage (adv>0), disadvantage (adv<0), lucky (reroll 1s)
function d20(adv,lucky){
  let a=die(20); if(lucky&&a===1) a=die(20);
  if(!adv) return {r:a,rolls:[a]};
  let b=die(20); if(lucky&&b===1) b=die(20);
  return {r:adv>0?Math.max(a,b):Math.min(a,b),rolls:[a,b],adv};
}
function advNet(advs,dis){ return (advs>0&&dis>0)?0:(advs>0?1:(dis>0?-1:0)); }

// ===== Class lookup (supports homebrew) =====
function getClass(id){ if(CLASSES[id]) return CLASSES[id]; const hb=(G&&G.homebrew||[]).find(c=>c.id===id); return hb||CLASSES.fighter; }
function getSub(h){ const c=getClass(h.cls); return (h.sub&&c.subs&&c.subs[h.sub])||null; }

// Features the hero has
function heroFeatures(h){
  if(h._fcache&&h._fcache.k===h.level+'|'+h.sub+'|'+h.cls) return h._fcache.v;
  const c=getClass(h.cls), s=getSub(h), set=new Set();
  for(let l=1;l<=h.level;l++){ (c.feats[l]||[]).forEach(f=>set.add(f)); if(s&&s.feats[l]) s.feats[l].forEach(f=>set.add(f)); }
  (h.extraFeats||[]).forEach(f=>set.add(f));
  Object.defineProperty(h,'_fcache',{value:{k:h.level+'|'+h.sub+'|'+h.cls,v:set},writable:true,enumerable:false,configurable:true});
  return set;
}
function hasF(c,f){ return c.isHero ? heroFeatures(c).has(f) : false; }
function hasFeat(h,f){ return h.isHero && (h.feats||[]).includes(f); }

// ===== Items helpers =====
function itemFx(it){ // merged effect object of an item
  if(!it) return {}; const fx={};
  const add=o=>{ for(const k in o){ const v=o[k]; if(typeof v==='number'&&typeof fx[k]==='number') fx[k]+=v; else if(Array.isArray(v)) fx[k]=(fx[k]||[]).concat(v); else if(typeof v==='object'&&v&&typeof fx[k]==='object'&&!Array.isArray(fx[k])) { fx[k]=Object.assign({},fx[k]); for(const kk in v){ fx[k][kk]=(typeof v[kk]==='number'&&typeof fx[k][kk]==='number')?fx[k][kk]+v[kk]:v[kk]; } } else fx[k]=v; } };
  if(it.magic&&MAGIC[it.magic]) add(MAGIC[it.magic].fx||{});
  (it.affixes||[]).forEach(a=>{ if(AFFIXES[a]) add(AFFIXES[a].fx); });
  return fx;
}
function equippedItems(h){ const e=h.eq||{}; return Object.keys(e).map(k=>e[k]).filter(Boolean); }
function gearFx(h){ // all equipment effects merged (not cached; cheap)
  const tot={ac:0,saves:0,checks:0,speed:0,hp:0,init:0,light:0,skill:{},saveB:{},resist:[]};
  for(const it of equippedItems(h)){
    const fx=itemFx(it); const isW=it.kind==='weapon';
    for(const k in fx){
      if(isW && ['extra','extraType','vs','crit','dmg','hit','lifesteal','critBonus','vorpal','dtOverride','magical'].includes(k)) continue;
      const v=fx[k];
      if(k==='skill'||k==='saveB'){ for(const s in v) tot[k][s]=(tot[k][s]||0)+v[s]; }
      else if(k==='resist') tot.resist=tot.resist.concat(v);
      else if(typeof v==='number'&&typeof tot[k]==='number') tot[k]+=v;
      else if(typeof v==='number'&&k.startsWith('set')) tot[k]=Math.max(tot[k]||0,v);
      else tot[k]=v;
    }
  }
  return tot;
}
function injuryMod(h,k){ let t=0; for(const i of (h.injuries||[])){ const def=INJURIES.find(x=>x.id===i.id); if(def&&def.mod[k]) t+=def.mod[k]; } return t; }

// ===== Ability scores =====
function abilScore(c,a){
  if(!c.isHero) return MONSTERS[c.mid].ab[ABIL.indexOf(a)] + (c.tmpAb&&c.tmpAb[a]||0);
  const h=c; let s=h.base[a]+(h.raceAsi&&h.raceAsi[a]||0)+(h.asi&&h.asi[a]||0);
  (h.feats||[]).forEach(f=>{ const F=FEATS[f]; if(F&&F.asi&&F.asi[a]) s+=F.asi[a]; });
  s=Math.min(20,s)+injuryMod(h,a);
  const g=gearFx(h); const set=g['set'+a[0].toUpperCase()+a.slice(1)]; if(set&&set>s) s=set;
  const fxSet=(h.fx||[]).find(e=>e.setAb&&e.setAb[a]); if(fxSet&&fxSet.setAb[a]>s) s=fxSet.setAb[a];
  if(a==='str'&&(h.fx||[]).some(e=>e.id==='giantstr')) s=Math.max(s,21);
  if(a==='str'&&h.tmpStrDrain) s=Math.max(1,s-h.tmpStrDrain);
  return s;
}
function abilMod(c,a){ return amod(abilScore(c,a)); }
function profOf(c){ if(c.isHero) return profFor(c.level); const cr=MONSTERS[c.mid].cr; return cr<5?2:cr<9?3:cr<13?4:5; }

// ===== Hero derived stats =====
function heroMaxHP(h){
  const c=getClass(h.cls); const con=abilMod(h,'con'); let hp=0;
  for(let i=0;i<h.level;i++) hp+=Math.max(1,(h.hpRolls[i]||c.hd/2+1)+con);
  const race=RACES[h.race]; if(race.hpPerLvl) hp+=h.level*race.hpPerLvl;
  const F=heroFeatures(h); if(F.has('dracRes')) hp+=h.level; if(F.has('toughness')) hp+=h.level;
  if(hasFeat(h,'hardened')) hp+=2*h.level;
  const g=gearFx(h); hp+=g.hp||0; if(g.hpPerLvl) hp+=g.hpPerLvl*h.level;
  hp+=injuryMod(h,'hpMax'); if(h.aid) hp+=h.aid; const dr=(h.fx||[]).find(e=>e.id==='drained'); if(dr) hp-=dr.amt||0;
  return Math.max(1,hp);
}
function armorOf(h){ const a=h.eq&&h.eq.armor; return a?ARMORS[a.base]:null; }
function shieldOf(h){ const s=h.eq&&h.eq.off; return (s&&s.kind==='shield')?s:null; }
function heroAC(h){
  const arm=armorOf(h), sh=shieldOf(h), F=heroFeatures(h), dex=abilMod(h,'dex'); let ac;
  if(arm){ const it=h.eq.armor; ac=arm.ac+(it.plus||0); if(arm.type==='light') ac+=dex; else if(arm.type==='medium') ac+=Math.min(2,dex); }
  else { ac=10+dex; if(F.has('udBarb')) ac=Math.max(ac,10+dex+abilMod(h,'con')); if(F.has('udMonk')&&!sh) ac=Math.max(ac,10+dex+abilMod(h,'wis')); if(F.has('dracRes')) ac=Math.max(ac,13+dex);
    if(h.fx&&h.fx.some(e=>e.id==='magearmor')) ac=Math.max(ac,13+dex);
    if(F.has('invocations')&&h.level>=2) ac=Math.max(ac,13+dex); // Armor of Shadows
  }
  if(sh) ac+=2+(sh.plus||0);
  if(arm&&h.style&&(h.style==='defense'||h.style2==='defense')) ac+=1;
  if(F.has('style2')&&arm&&h.style!=='defense') ac+=1;
  if(F.has('toughness')&&arm) ac+=1;
  if(hasFeat(h,'duelist')&&!sh&&h.eq.main&&!(WEAPONS[h.eq.main.base]||{p:[]}).p.includes('two')) ac+=1;
  const g=gearFx(h); ac+=g.ac||0; if(g.acUnarmored&&!arm&&!sh) ac+=g.acUnarmored;
  return ac;
}
function heroSpeed(h){
  const r=RACES[h.race], F=heroFeatures(h); let s=r.speed; const arm=armorOf(h);
  if(F.has('fastMove')&&!(arm&&arm.type==='heavy')) s+=10;
  if(F.has('unarmoredMove')&&!arm&&!shieldOf(h)) s+=h.level>=6?15:10;
  if(F.has('quickStep')) s+=10; if(hasFeat(h,'skirmisher')) s+=10;
  if(arm&&arm.type==='heavy'&&arm.str&&abilScore(h,'str')<arm.str) s-=10;
  const g=gearFx(h); s+=g.speed||0; if(g.speedMin) s=Math.max(s,g.speedMin);
  s+=injuryMod(h,'speed'); return Math.max(10,s);
}
function skillProf(h,sk){ // 0 none, 1 prof, 2 expertise
  if(sk==='tools') return (h.tools?1:0)+(h.expertise||[]).includes('tools')?((h.tools?1:0)+1):0;
  let p=(h.skills||[]).includes(sk)?1:0; if(p&&(h.expertise||[]).includes(sk)) p=2; return p;
}
function skillBonus(c,sk){
  if(!c.isHero){ const m=MONSTERS[c.mid]; const ab=sk==='tools'?'dex':SKILLS[sk]; let b=amod(m.ab[ABIL.indexOf(ab)]); if(m.skills&&m.skills[sk]) b=m.skills[sk]; if(sk==='perception'&&m.pp) b=m.pp-10; return b; }
  const h=c, ab=sk==='tools'?'dex':SKILLS[sk]; let b=abilMod(h,ab); const pb=profFor(h.level), F=heroFeatures(h);
  let p; if(sk==='tools'){ p=h.tools?1:0; if(p&&(h.expertise||[]).includes('tools')) p=2; } else p=skillProf(h,sk);
  if(p) b+=pb*p; else if(F.has('jack')) b+=Math.floor(pb/2); else if(F.has('remarkable')&&['str','dex','con'].includes(ab)) b+=Math.ceil(pb/2);
  const g=gearFx(h); b+=(g.skill[sk]||0)+(g.checks||0); if(sk==='tools') b+=(g.tools||0);
  b+=injuryMod(h,sk);
  return b;
}
function passive(c,sk){ let p=10+skillBonus(c,sk); if(c.isHero){ if(hasFeat(c,'keeneye')) p+=5; if(sk==='perception'){ p+=injuryMod(c,'pp'); if(heroFeatures(c).has('keenSenses')) p+=5; } } return p; }
function saveBonus(c,a){
  if(!c.isHero){ const m=MONSTERS[c.mid]; let b=amod(abilScore(c,a)); if(m.saves&&m.saves[a]!=null) b=m.saves[a]; else if(m.boss&&['con','wis','dex'].includes(a)) b+=profOf(c); return b; }
  const h=c, cls=getClass(h.cls); let b=abilMod(h,a); if(cls.saves.includes(a)) b+=profFor(h.level);
  const g=gearFx(h); b+=(g.saves||0)+(g.saveB[a]||0);
  return b;
}
function initBonus(c){
  if(!c.isHero) return abilMod(c,'dex');
  const h=c; let b=abilMod(h,'dex'); if(hasFeat(h,'watchful')) b+=5; if(heroFeatures(h).has('watcherGift')) b+=abilMod(h,'wis');
  b+=injuryMod(h,'init'); const g=gearFx(h); b+=g.init||0; return b;
}
function lightRadius(h){ let r=4; const g=gearFx(h); r+=g.light||0; if(typeof G!=='undefined'&&G.run&&G.run.lightBonus) r+=Math.min(3,G.run.lightBonus); if(heroFeatures(h).has('lanternBearer')) r*=2; return r; }
// spellcasting
function castAbil(h){ const c=getClass(h.cls); return c.cast||'int'; }
function spellDC(c){ if(!c.isHero) return (MONSTERS[c.mid].caster&&MONSTERS[c.mid].caster.dc)||10; return 8+profFor(c.level)+abilMod(c,castAbil(c)); }
function spellAtk(c){ if(!c.isHero) return (MONSTERS[c.mid].caster&&MONSTERS[c.mid].caster.hit)||3; return profFor(c.level)+abilMod(c,castAbil(c)); }
function casterLevel(h){ const c=getClass(h.cls); if(c.caster==='full') return h.level; if(c.caster==='half') return h.level>=2?Math.ceil(h.level/2):0; return 0; }
function slotMax(h){ // returns array index 1..5 => count
  const c=getClass(h.cls); const out=[0,0,0,0,0,0];
  if(c.caster==='pact'){ const [n,l]=PACT_TABLE[Math.min(12,h.level)]; out[l]=n; }
  else { const cl=casterLevel(h); const t=CASTER_TABLE[Math.min(12,cl)]||[]; t.forEach((n,i)=>{ if(i<5) out[i+1]=n; }); }
  if(hasFeat(h,'arcaneinit')) out[0]=out[0]; // handled as resource
  return out;
}
function maxSpellLevel(h){ const s=slotMax(h); for(let i=5;i>=1;i--) if(s[i]>0) return i; return 0; }
function classList(h){ return getClass(h.cls).list||null; }
function cantripsAllowed(h){ const c=getClass(h.cls); if(!c.caster) return 0; const L=c.homebrew?(c.caster==='full'?'W':c.caster==='pact'?'K':'P'):c.list; const t=CANTRIPS_KNOWN[L]; let n=t?t[Math.min(11,h.level-1)]:0; if(heroFeatures(h).has('landCantrip')) n++; if(h.pactTome) n+=3; return n; }
function spellsAllowed(h){
  const c=getClass(h.cls); if(!c.caster) return 0; const lv=h.level;
  if(c.homebrew){ const L=c.caster==='full'?'S':c.caster==='pact'?'K':'R'; return SPELLS_KNOWN[L][Math.min(11,lv-1)]+1; }
  if(c.known) return SPELLS_KNOWN[c.list][Math.min(11,lv-1)] + (heroFeatures(h).has('magicSecrets')?2:0) + (heroFeatures(h).has('addSecrets')?2:0) + (h.sub==='lore'&&lv>=6?0:0);
  const m=abilMod(h,c.cast); if(c.caster==='half') return lv<2?0:Math.max(1,m+Math.floor(lv/2)); return Math.max(1,m+lv);
}
function spellsForClass(h){ const L=classList(h); if(!L) return []; const max=maxSpellLevel(h); const F=heroFeatures(h); const any=F.has('magicSecrets')||F.has('addSecrets');
  return Object.keys(SPELLS).filter(id=>{ const s=SPELLS[id]; if(s.l===0||s.l>max) return false; if(id==='raisebones'&&F.has('graveCall')) return false; return any? true : s.c.includes(L); }); }
function cantripsForClass(h){ const L=classList(h); if(!L) return []; return Object.keys(SPELLS).filter(id=>SPELLS[id].l===0&&SPELLS[id].c.includes(L)); }
function heroCantrips(h){ const out=(h.cantrips||[]).slice(); const r=RACES[h.race]; if(r.cantrip&&!out.includes(r.cantrip)) out.push(r.cantrip); if(hasFeat(h,'arcaneinit')){ ['firebolt','light'].forEach(x=>{ if(!out.includes(x)) out.push(x); }); } return out; }
function heroSpells(h){ const out=(h.spells||[]).slice(); if(h.sub==='land'){ for(const l in CIRCLE_SPELLS) if(h.level>=+l) CIRCLE_SPELLS[l].forEach(s=>{ if(!out.includes(s)) out.push(s); }); } if(hasFeat(h,'arcaneinit')&&!out.includes('magicmissile')) out.push('magicmissile'); if(h.race==='tiefling'&&h.level>=3&&!out.includes('hellishrebuke')) out.push('hellishrebuke'); if(heroFeatures(h).has('graveCall')&&!out.includes('raisebones')) out.unshift('raisebones'); return out; }
// resources
function resMax(h){
  const F=heroFeatures(h), r={}, lv=h.level, cha=Math.max(1,abilMod(h,'cha')), pb=profFor(lv);
  if(F.has('rage')) r.rage=lv>=12?5:lv>=6?4:lv>=3?3:2;
  if(F.has('inspiration')) r.insp=cha;
  if(F.has('channel')) r.channel=lv>=6?2:1;
  if(F.has('wildShape')) r.wild=2;
  if(F.has('secondWind')) r.wind=1;
  if(F.has('actionSurge')) r.surge=1;
  if(F.has('indomitable')) r.indom=1;
  if(F.has('ki')) r.ki=lv;
  if(F.has('layOnHands')) r.loh=5*lv;
  if(F.has('divineSense')) r.dsense=1+cha;
  if(F.has('font')) r.sp=lv;
  if(F.has('arcaneRecovery')) r.arec=1;
  if(F.has('naturalRecovery')) r.nrec=1;
  if(F.has('divineIntervention')) r.dint=1;
  if(F.has('rally')) r.rally=pb;
  if(F.has('paleMastery')) r.pale=1;
  if(F.has('warcry')) r.warcry=1;
  if(F.has('wholeness')) r.whole=1;
  if(F.has('darkLuck')) r.dluck=1;
  if(F.has('mournWard')) r.mward=1;
  if(F.has('saintToll')) r.toll=1;
  if(F.has('primeval')) r.primeval=1;
  if(F.has('intimPresence')) r.intim=1;
  if(hasFeat(h,'luckystar')) r.luck=3;
  if(hasFeat(h,'medic')) r.medic=1;
  if(hasFeat(h,'arcaneinit')) r.ainit=1;
  if(RACES[h.race].breath) r.breath=1;
  if(RACES[h.race].relentless) r.relent=1;
  if(RACES[h.race].hellish) r.hellish=1;
  return r;
}
const SHORT_REST_RES=['pale','channel','wild','wind','surge','ki','warcry','dluck','toll','medic','breath','intim'];
function restoreRes(h,long){ const m=resMax(h); h.res=h.res||{}; for(const k in m){ if(long||SHORT_REST_RES.includes(k)||(k==='insp'&&heroFeatures(h).has('fontInsp'))) h.res[k]=m[k]; else if(h.res[k]==null) h.res[k]=m[k]; } }
function restoreSlots(h){ h.slots=slotMax(h).slice(); }
function sneakDice(h){ return Math.ceil(h.level/2); }
function martialDie(h){ return h.level>=11?'1d8':h.level>=5?'1d6':'1d4'; }
function inspDie(h){ return h.level>=10?'1d10':h.level>=5?'1d8':'1d6'; }
// weapon proficiency
function weaponProf(h,base){
  const c=getClass(h.cls), w=WEAPONS[base]; if(!w) return true;
  if(c.weapons.includes(w.cat)||c.weapons.includes(base)) return true;
  const r=RACES[h.race]; if(r.wprof&&r.wprof.includes(base)) return true;
  const bg=BACKGROUNDS[h.bg]; if(bg&&bg.wprof&&bg.wprof.includes(base)) return true;
  return false;
}
function armorProf(h,type){ const c=getClass(h.cls); if(type==='heavy'&&heroFeatures(h).has('heavyArmor')) return true; return c.armor.includes(type); }
function repTier(v){ let t='Neutral'; for(const [th,n] of REP_TIERS) if(v>=th) t=n; return t; }
function xpForNext(l){ return XP_LEVELS[Math.min(XP_LEVELS.length-1,l)]; }
function canLevel(h){ return h.level<MAX_LEVEL && h.xp>=XP_LEVELS[h.level]; }
