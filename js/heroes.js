// ===== Hero creation, items factory, loot =====
const CLASS_PRIO = {necromancer:'int,con,dex,wis,cha,str',barbarian:'str,con,dex,wis,cha,int',bard:'cha,dex,con,wis,int,str',cleric:'wis,con,str,dex,cha,int',druid:'wis,con,dex,int,cha,str',fighter:'str,con,dex,wis,cha,int',monk:'dex,wis,con,str,int,cha',paladin:'str,cha,con,wis,dex,int',ranger:'dex,wis,con,str,int,cha',rogue:'dex,con,int,wis,cha,str',sorcerer:'cha,con,dex,wis,int,str',warlock:'cha,con,dex,wis,int,str',wizard:'int,con,dex,wis,cha,str'};
function classPrio(cid){ if(CLASS_PRIO[cid]) return CLASS_PRIO[cid].split(','); const c=getClass(cid); const o=[...c.primary,'con','dex','wis','cha','str','int']; return [...new Set(o)]; }
function randomName(){ return pick(NAMES_A)+(Math.random()<0.5?pick(NAMES_B):'')+' '+pick(SURNAMES); }
function randomAppearance(){ return {skin:rnd(APPEAR.skin.length),hair:rnd(APPEAR.hair.length),eyes:rnd(APPEAR.eyes.length),cloak:rnd(APPEAR.cloak.length),hairStyle:rnd(APPEAR.hairStyle.length),beard:rnd(APPEAR.beard.length),headwear:rnd(APPEAR.headwear.length),marks:rnd(APPEAR.marks.length),ring:rnd(APPEAR.ring.length),emblem:rnd(APPEAR.emblem.length)}; }
function newHeroShell(){
  return {isHero:true,id:uid('h'),name:randomName(),race:'human',dragon:'red',cls:'fighter',sub:null,bg:'sellsword',level:1,xp:0,
    base:{str:10,dex:10,con:10,int:10,wis:10,cha:10},raceAsi:{},asi:{},feats:[],skills:[],expertise:[],tools:false,style:null,style2:null,favored:[],
    hpRolls:[],hp:1,tempHp:0,eq:{},cantrips:[],spells:[],slots:[0,0,0,0,0,0],res:{},injuries:[],fx:[],deathS:{s:0,f:0},status:'ok',hd:1,
    app:randomAppearance(),kills:0,bio:'',created:Date.now()};
}
function finalizeHero(h){ // after choices at level 1
  const c=getClass(h.cls); h.hpRolls=[c.hd];
  if(!h.raceAsi||!Object.keys(h.raceAsi).length) h.raceAsi=Object.assign({},RACES[h.race].asi);
  const r=RACES[h.race]; (r.skills||[]).forEach(s=>{ if(!h.skills.includes(s)) h.skills.push(s); });
  const bg=BACKGROUNDS[h.bg]; (bg.skills||[]).forEach(s=>{ if(!h.skills.includes(s)) h.skills.push(s); });
  if(bg.tools||c.tools) h.tools=true;
  if(heroFeatures(h).has('expertise')&&h.expertise.length<2) autoExpertise(h);
  if(c.subLvl<=1&&!h.sub) h.sub=Object.keys(c.subs)[0]||null;
  if(heroFeatures(h).has('fightingStyle')&&!h.style) h.style=defaultStyle(h);
  if(heroFeatures(h).has('favoredEnemy')&&!h.favored.length) h.favored=['undead'];
  if(!Object.keys(h.eq).length) giveStartGear(h);
  h.hd=h.level; restoreSlots(h); restoreRes(h,true); h.hp=heroMaxHP(h); h.status='ok'; h.deathS={s:0,f:0};
  return h;
}
function defaultStyle(h){ const c=h.cls; if(c==='ranger') return 'archery'; if(c==='paladin') return 'defense'; const w=h.eq&&h.eq.main&&WEAPONS[h.eq.main.base]; if(w&&w.p.includes('two')) return 'gwf'; return 'defense'; }
function autoExpertise(h){ const cand=h.skills.filter(s=>!h.expertise.includes(s)); if(h.tools&&!h.expertise.includes('tools')) cand.unshift('tools'); const sorted=cand.sort((a,b)=>(abilMod(h,SKILLS[b]||'dex'))-(abilMod(h,SKILLS[a]||'dex'))); h.expertise=h.expertise.concat(sorted.slice(0,2)); }
function giveStartGear(h){
  const c=getClass(h.cls); const st=c.start||['club'];
  for(const b of st){
    if(WEAPONS[b]){ const it=makeItem(b), w=WEAPONS[b]; if(w.p.includes('ranged')&&!h.eq.ranged) h.eq.ranged=it; else if(!h.eq.main&&!w.p.includes('ranged')) h.eq.main=it; else if(h.eq.main&&!h.eq.off&&w.p.includes('light')&&WEAPONS[h.eq.main.base].p.includes('light')) h.eq.off=it; else if(!h.eq.ranged&&w.p.includes('thrown')) h.eq.ranged=it; }
    else if(b==='shield'){ h.eq.off=makeItem('shield'); }
    else if(ARMORS[b]){ h.eq.armor=makeItem(b); }
  }
  // a homebrew class: pick by proficiencies
  if(c.homebrew&&!h.eq.main){ h.eq.main=makeItem(c.weapons.includes('martial')?'longsword':'mace'); if(c.armor.includes('medium')) h.eq.armor=makeItem('scalemail'); else if(c.armor.includes('light')) h.eq.armor=makeItem('leather'); if(c.armor.includes('shield')) h.eq.off=makeItem('shield'); }
}
function autoSpells(h){
  const ca=cantripsAllowed(h), pool=shuffle(cantripsForClass(h)); const dmgFirst=pool.sort((a,b)=>(SPELLS[b].dmg?1:0)-(SPELLS[a].dmg?1:0));
  while((h.cantrips||[]).length<ca&&dmgFirst.length){ const s=dmgFirst.shift(); if(!h.cantrips.includes(s)) h.cantrips.push(s); }
  const sa=spellsAllowed(h); const list=shuffle(spellsForClass(h)); const pref=['curewounds','healingword','bless','magicmissile','shield','huntersmark','guidingbolt','burninghands','sleep','scorchingray','spiritualweapon','holdperson','fireball','spiritguardians','hellishrebuke','divinefavor','thunderwave','faeriefire','entangle','moonbeam','shatter','mistystep','haste','blight','icestorm','coneofcold','masscurewounds'];
  list.sort((a,b)=>{ const ia=pref.indexOf(a), ib=pref.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
  while(h.spells.length<sa&&list.length){ const s=list.shift(); if(!h.spells.includes(s)) h.spells.push(s); }
}
function autoHero(cls,level,opts){
  opts=opts||{}; const h=newHeroShell(); h.cls=cls||pick(Object.keys(CLASSES)); h.race=opts.race||pick(Object.keys(RACES)); h.bg=opts.bg||pick(Object.keys(BACKGROUNDS));
  if(h.race==='dragonborn') h.dragon=pick(Object.keys(DRAGON_ANCESTRY));
  const prio=classPrio(h.cls); const arr=STANDARD_ARRAY.slice(); prio.forEach((a,i)=>h.base[a]=arr[i]);
  h.raceAsi=Object.assign({},RACES[h.race].asi);
  const c=getClass(h.cls); const sl=shuffle(c.skillList.filter(s=>!(BACKGROUNDS[h.bg].skills||[]).includes(s))); h.skills=sl.slice(0,c.nSkills);
  if(RACES[h.race].extraSkills){ const ex=shuffle(Object.keys(SKILLS).filter(s=>!h.skills.includes(s))); h.skills.push(...ex.slice(0,2)); }
  finalizeHero(h); autoSpells(h);
  while(h.level<(level||1)){ h.xp=Math.max(h.xp,XP_LEVELS[h.level]); applyLevelUp(h,autoLevelChoices(h)); }
  h.hp=heroMaxHP(h); restoreSlots(h); restoreRes(h,true);
  return h;
}
function autoLevelChoices(h){
  const nl=h.level+1, c=getClass(h.cls), ch={hp:'avg'};
  if(nl===c.subLvl&&!h.sub) ch.sub=pick(Object.keys(c.subs));
  const feats=(c.feats[nl]||[]); if(feats.includes('asi')){ const p=classPrio(h.cls); const a=p[0]; if(abilScore(h,a)<=18) ch.asi={[a]:2}; else ch.asi={[p[1]]:1,[p[2]]:1}; }
  return ch;
}
// Apply a level-up. ch: {hp:'avg'|'roll', sub, asi:{a:n} | feat:'id', cantrips:[], spells:[], style, favored}
function applyLevelUp(h,ch){
  const c=getClass(h.cls); const oldMax=heroMaxHP(h); h.level++; h._fcache=null;
  const roll=ch.hp==='roll'?die(c.hd):Math.floor(c.hd/2)+1; h.hpRolls.push(roll);
  if(ch.sub) h.sub=ch.sub;
  if(ch.asi){ for(const a in ch.asi) h.asi[a]=(h.asi[a]||0)+ch.asi[a]; }
  if(ch.feat) h.feats.push(ch.feat);
  if(ch.style&&!h.style) h.style=ch.style;
  const F=heroFeatures(h);
  if(F.has('fightingStyle')&&!h.style) h.style=defaultStyle(h);
  if(F.has('expertise')){ const need=(h.level>=10&&h.cls==='bard')||(h.level>=6&&h.cls==='rogue')?4:2; if(h.expertise.length<need) autoExpertise(h); }
  if(F.has('bonusProfs')&&!h._lore){ h._lore=1; const ex=shuffle(Object.keys(SKILLS).filter(s=>!h.skills.includes(s))); h.skills.push(...ex.slice(0,3)); }
  if(F.has('pactBoon')) h.pactBlade=true;
  if(F.has('favored2')&&h.favored.length<2) h.favored.push(ch.favored||'fiend');
  if(F.has('keenSenses')&&!h.skills.includes('perception')) h.skills.push('perception');
  if(ch.cantrips) ch.cantrips.forEach(s=>{ if(!h.cantrips.includes(s)) h.cantrips.push(s); });
  if(ch.spells) ch.spells.forEach(s=>{ if(!h.spells.includes(s)) h.spells.push(s); });
  if(!ch.cantrips&&!ch.spells) autoSpells(h);
  const newMax=heroMaxHP(h); h.hp=Math.min(newMax,h.hp+(newMax-oldMax)); h.hd=Math.min(h.level,(h.hd||0)+1);
  const sm=slotMax(h); h.slots=h.slots||[0,0,0,0,0,0]; for(let i=1;i<=5;i++) h.slots[i]=Math.min(sm[i],(h.slots[i]||0)+Math.max(0,sm[i]-(h._lastSlots?h._lastSlots[i]:0))); h._lastSlots=sm;
  const rm=resMax(h); h.res=h.res||{}; for(const k in rm) if(h.res[k]==null) h.res[k]=rm[k];
  logJournal(h.name+' reached level '+h.level+' ('+c.n+(getSub(h)?' — '+getSub(h).n:'')+').');
}
// ===== Items =====
function makeItem(base,opt){
  opt=opt||{}; const it={uid:uid('i'),base,plus:opt.plus||0,affixes:opt.affixes||[],rar:opt.rar||'common',ident:opt.ident!==false,qty:opt.qty||1};
  if(WEAPONS[base]){ it.kind='weapon'; it.slot='main'; }
  else if(base==='shield'){ it.kind='shield'; it.slot='off'; }
  else if(ARMORS[base]){ it.kind='armor'; it.slot='armor'; }
  else if(GEAR[base]){ it.kind=GEAR[base].kind; it.rar=GEAR[base].rar; it.stack=1; }
  else if(MATERIALS[base]){ it.kind='material'; it.stack=1; }
  else if(base==='scroll'){ it.kind='scroll'; it.spell=opt.spell||pick(Object.keys(SPELLS).filter(s=>SPELLS[s].l>=1&&SPELLS[s].l<=(opt.maxL||3))); it.rar=SPELLS[it.spell].l<=1?'common':SPELLS[it.spell].l<=3?'uncommon':'rare'; it.stack=0; }
  else if(base==='quest'){ it.kind='quest'; it.qid=opt.qid; it.qname=opt.qname; it.stack=1; }
  if(it.plus&&it.rar==='common') it.rar=it.plus>=3?'veryrare':it.plus>=2?'rare':'uncommon';
  return it;
}
function makeMagic(id,ident){
  const M=MAGIC[id]; let it;
  if(M.slot==='weapon'||M.slot==='armor'||M.slot==='shield') it=makeItem(M.base,{plus:M.plus||0});
  else { it={uid:uid('i'),base:id,kind:M.slot==='wondrous'?(M.cast?'wand':'acc'):'acc',slot:M.slot==='wondrous'?'trinket':M.slot,plus:0,affixes:[],qty:1}; }
  it.magic=id; it.rar=M.rar; it.ident=ident!==false; if(M.charges) it.charges=M.charges; return it;
}
function itemDef(it){ return WEAPONS[it.base]||ARMORS[it.base]||GEAR[it.base]||MATERIALS[it.base]||(it.magic&&MAGIC[it.magic])||{n:it.base}; }
function itemName(it){
  if(!it) return '—';
  if(it.kind==='quest') return it.qname||'Quest Item';
  if(it.kind==='scroll') return 'Scroll of '+SPELLS[it.spell].n;
  if(it.kind==='material') return MATERIALS[it.base].n;
  if(!it.ident) return 'Unidentified '+(itemDef(it).n||it.base);
  if(it.magic){ const M=MAGIC[it.magic]; return M.n+((it.plus&&it.plus>(M.plus||0))?' +'+it.plus:''); }
  const pre=(it.affixes||[]).filter(a=>AFFIXES[a].pre).map(a=>AFFIXES[a].n).join(' ');
  const suf=(it.affixes||[]).filter(a=>!AFFIXES[a].pre).map(a=>AFFIXES[a].n).join(' ');
  return (pre?pre+' ':'')+(itemDef(it).n||it.base)+(suf?' '+suf:'')+(it.plus?' +'+it.plus:'');
}
function itemValue(it){
  const d=itemDef(it); let v=d.cost||5; if(it.kind==='scroll') v=SPELLS[it.spell].l*60+25; if(it.kind==='quest') return 0;
  if(it.magic) v+=RARITY[it.rar].v*50; v+=(it.plus||0)*(it.plus||0)*220+(it.affixes||[]).length*90;
  return Math.round(v*(it.qty||1));
}
function itemDesc(it){
  const out=[]; const d=itemDef(it);
  if(it.kind==='weapon'){ const w=WEAPONS[it.base]; out.push(w.d+' '+w.dt+(w.vd?' (versatile '+w.vd+')':'')+(w.r?' · range '+w.r*5+'/'+w.lr*5+' ft':'')); out.push((w.p||[]).join(', ')+' · '+w.cat); }
  if(it.kind==='armor'){ const a=ARMORS[it.base]; out.push('AC '+(a.ac+(it.plus||0))+(a.type==='light'?' + Dex':a.type==='medium'?' + Dex (max 2)':'')+' · '+a.type+(a.str?' · Str '+a.str:'')+(a.stealthDis?' · Stealth disadvantage':'')); }
  if(it.kind==='shield') out.push('+'+(2+(it.plus||0))+' AC');
  if(it.plus) out.push('+'+it.plus+' magic bonus');
  if(it.ident){ if(it.magic) out.push(MAGIC[it.magic].d); (it.affixes||[]).forEach(a=>out.push(AFFIXES[a].n+': '+AFFIXES[a].d)); }
  else out.push('Unidentified. Identify at the Library or with the Identify spell.');
  if(GEAR[it.base]) out.push(GEAR[it.base].d);
  if(it.kind==='scroll') out.push(SPELLS[it.spell].d+' (single use)');
  if(it.kind==='material') out.push('Crafting material.');
  if(it.charges!=null) out.push('Charges: '+it.charges);
  return out.join('\n');
}
function stackAdd(list,it){ if(it.stack){ const ex=list.find(x=>x.base===it.base&&x.kind===it.kind&&x.qid===it.qid); if(ex){ ex.qty=(ex.qty||1)+(it.qty||1); return; } } list.push(it); }
// ===== Loot =====
const MAGIC_BY_RAR = {}; for(const k in MAGIC){ (MAGIC_BY_RAR[MAGIC[k].rar]=MAGIC_BY_RAR[MAGIC[k].rar]||[]).push(k); }
function rollRarity(tier){ const r=Math.random()*100; const t=[[60,85,97,100],[40,75,94,99.5],[25,60,88,98],[10,45,80,95],[5,30,70,90]][clamp(tier,0,4)];
  return r<t[0]?'common':r<t[1]?'uncommon':r<t[2]?'rare':r<t[3]?'veryrare':'legendary'; }
function randomAffixes(n,on,tier){ const pool=Object.keys(AFFIXES).filter(a=>(AFFIXES[a].on==='any'||AFFIXES[a].on===on)&&AFFIXES[a].tier<=tier+1); const out=[]; let pre=false,suf=false;
  for(const a of shuffle(pool)){ if(out.length>=n) break; const P=AFFIXES[a].pre; if(P&&pre) continue; if(!P&&suf) continue; out.push(a); if(P) pre=true; else suf=true; } return out; }
function randomGear(tier,opts){
  opts=opts||{}; const rar=opts.rar||rollRarity(tier);
  if(rar!=='common'&&Math.random()<0.45){ const pool=MAGIC_BY_RAR[rar]||MAGIC_BY_RAR.uncommon; return makeMagic(pick(pool),opts.ident!=null?opts.ident:false); }
  const isW=Math.random()<0.55; const base=isW?pick(Object.keys(WEAPONS)):pick(Object.keys(ARMORS));
  const it=makeItem(base);
  if(rar!=='common'){ const lvl={uncommon:1,rare:2,veryrare:3,legendary:3}[rar]; if(Math.random()<0.5) it.plus=Math.min(3,lvl); const n=rar==='uncommon'?1:2; it.affixes=randomAffixes(it.plus?n-1||1:n,isW?'weapon':'armor',lvl); it.rar=rar; it.ident=opts.ident!=null?opts.ident:false; }
  return it;
}
function rollLoot(tier,rich){
  const out={gold:0,items:[]}; out.gold=Math.round((10+rnd(20))*(1+tier*1.6)*(rich?2.5:1));
  if(Math.random()<(rich?0.9:0.35)) out.items.push(randomGear(tier+(rich?1:0)));
  if(Math.random()<0.4) out.items.push(makeItem(pick(tier>=2?['potgreater','potheal','potheal','antitoxin','holywater','alchfire','potresist']:['potheal','potheal','holywater','alchfire','antitoxin','rations','torch'])));
  if(Math.random()<0.15+tier*0.03) out.items.push(makeItem('scroll',{maxL:clamp(1+tier,1,5)}));
  if(rich&&Math.random()<0.4) out.items.push(randomGear(tier+1,{rar:pick(['uncommon','rare'])}));
  return out;
}
function monsterDrops(m,tier){
  const out=[]; const mats=TYPE_MATERIALS[m.type]||['iron']; if(Math.random()<0.6) out.push(Object.assign(makeItem(pick(mats)),{qty:1+(m.cr>=3?rnd(3):0)}));
  if(m.boss) { out.push(randomGear(tier+2,{rar:pick(['rare','rare','veryrare'])})); out.push(makeItem('potsuperior')); }
  else if(Math.random()<0.08+m.cr*0.02) out.push(randomGear(tier));
  return out;
}
