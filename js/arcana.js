// ===== ARCANA EXPERIMENTAL — ORIGINAL playtest content (not part of SRD 5.1) =====
// Two new classes (Lanternwright, Veilseer), five subclasses for existing classes, new homebrew features and spells.
// All names, mechanics and text here are original to The Last Lantern. Built on SRD-style mechanics.
const AE=' (Arcana Experimental)';
// ---------- features ----------
Object.assign(FEATURES,{
  // Lanternwright (Int half-caster inventor)
  lanternCraft:{n:'Lantern Craft',d:'You are proficient with tinker\'s tools, add double proficiency to tool checks, and your shuttered lantern widens the party\'s light by 2 tiles.'+AE,ae:1,pool:1},
  flareCharge:{n:'Flare Charge',d:'Bonus action gadget: hurl a charge at a foe within 6 tiles. Dex save vs your spell DC: 1d6 fire (2d6 at 5th, 3d6 at 11th) and blinded until its next turn; half damage and no blindness on a success. Uses = Int modifier (min 1), recharge on a short rest.'+AE,ae:1,kind:'bonus',pool:2},
  infuseArms:{n:'Lantern Infusion',d:'Your weapon and armor carry a captive spark: weapon attacks gain +1 to hit and damage and count as magical, and you gain +1 AC while armored.'+AE,ae:1,pool:2},
  gadgetMastery:{n:'Overclocked Gadgets',d:'Flare Charge gains one extra use and deals one extra damage die.'+AE,ae:1,pool:1},
  inventorInstinct:{n:'Inventor\'s Instinct',d:'Add your Intelligence modifier (min 1) to initiative rolls.'+AE,ae:1,pool:1},
  arcaneArmory:{n:'Arcane Armory',d:'Your Lantern Infusion improves: +2 to weapon attack and damage rolls and +2 AC while armored.'+AE,ae:1,pool:2},
  forgeCompanion:{n:'Clockwork Hound',d:'Action: assemble a Clockwork Hound beside you (one at a time, recharge on a short rest). It is a construct companion: it takes its own turn in initiative, can be commanded by hand or left on Auto, and attacks with your spell attack bonus for 1d8 + proficiency piercing. HP = 2 + 5×your level + Int modifier. It folds away when you rest or leave the dungeon.'+AE,ae:1,kind:'action',pool:4},
  ironCommand:{n:'Iron Command',d:'Bonus action: your Clockwork Hound within 12 tiles immediately makes one attack against a foe it can reach.'+AE,ae:1,kind:'bonus',pool:2},
  houndOverdrive:{n:'Overdrive Core',d:'Your Clockwork Hound gains +2 AC and makes one extra attack each turn.'+AE,ae:1},
  vitriolFlask:{n:'Vitriol Flask',d:'Action: lob a flask at a point within 6 tiles. Enemies within 1 tile of it make a Dex save vs your spell DC: 2d6 acid (3d6 at 5th, 4d6 at 9th), half on a success. Uses = proficiency bonus per long rest.'+AE,ae:1,kind:'action',pool:3},
  restorativeTonic:{n:'Restorative Tonic',d:'Bonus action: an adjacent ally (or you) drinks a tonic and regains 1d8 + Int modifier HP (2d8 at 9th). Uses = Int modifier (min 1) per long rest.'+AE,ae:1,kind:'bonus',pool:2},
  causticMastery:{n:'Caustic Mastery',d:'Add your Intelligence modifier to acid and fire damage from your spells, Vitriol Flasks and Flare Charges.'+AE,ae:1,pool:2},
  volatileReagents:{n:'Volatile Reagents',d:'Vitriol Flask gains two extra uses and deals one extra 1d6.'+AE,ae:1},
  // Veilseer (Int psion) — psi dice
  psiDice:{n:'Psi Reservoir',d:'You hold psi dice equal to twice your proficiency bonus (d6; d8 at 5th; d10 at 11th) and regain them on a short rest. Psionic features spend them.'+AE,ae:1,pool:2},
  psiWard:{n:'Mind Ward',d:'Reaction when a creature hits you: roll a psi die and add it to your AC against that attack. The die is spent only if it turns the hit into a miss.'+AE,ae:1,kind:'reaction',pool:3},
  kineticThrust:{n:'Kinetic Thrust',d:'Bonus action, 1 psi die: a foe within 6 tiles takes psi die + Int modifier force damage and must pass a Str save vs your spell DC or be hurled 2 tiles away.'+AE,ae:1,kind:'bonus',pool:3},
  innerEye:{n:'Inner Eye',d:'Add your Intelligence modifier (min 1) to Perception and Insight checks.'+AE,ae:1,pool:1},
  psiRecovery:{n:'Psionic Recovery',d:'Bonus action, once per long rest: regain psi dice equal to half your proficiency bonus (min 1) +1.'+AE,ae:1,kind:'bonus',pool:1},
  thoughtShield:{n:'Thought Bulwark',d:'Resistance to psychic damage and advantage on saves against being charmed or frightened.'+AE,ae:1,pool:2},
  kineticEdge:{n:'Kinetic Edge',d:'Once per turn when you hit with a weapon, you may spend a psi die (if you have 2 or more) to add it as force damage.'+AE,ae:1,pool:2},
  kineticBarrier:{n:'Kinetic Barrier',d:'Bonus action, 1 psi die: gain temporary HP equal to two psi die rolls + Int modifier.'+AE,ae:1,kind:'bonus',pool:2},
  gravityWell:{n:'Gravity Well',d:'Action, 2 psi dice: crush a 2-tile radius within 12 tiles. Enemies make a Str save: 4d8 force and knocked prone, half on a success.'+AE,ae:1,kind:'action',pool:3},
  dreadWhisper:{n:'Dread Whisper',d:'Bonus action, 1 psi die: a foe within 12 tiles makes a Wis save vs your spell DC or takes a psi die of psychic damage and is frightened until its next turn.'+AE,ae:1,kind:'bonus',pool:2},
  mindPierce:{n:'Splinter Mind',d:'Add your Intelligence modifier to the psychic damage of your spells.'+AE,ae:1,pool:2},
  hollowGaze:{n:'Hollow Gaze',d:'Action, 2 psi dice: a foe within 12 tiles makes a Wis save vs your spell DC or is stunned until the end of its next turn.'+AE,ae:1,kind:'action',pool:3},
  // Barbarian — Path of the Witchfire
  witchSurge:{n:'Witchfire Surge',d:'When you rage, wild magic answers (roll d4): 1 Witchfire Lash — adjacent foes take 1d8 force; 2 Shimmering Ward — +2 AC while raging; 3 Hungry Light — your weapon hits deal +1d6 radiant while raging; 4 Surge of Life — temporary HP 1d12 + level.'+AE,ae:1},
  witchSense:{n:'Witch-Sight',d:'+2 to Intelligence and Wisdom saving throws; you sense magic as a prickling on your skin.'+AE,ae:1,pool:1},
  witchCore:{n:'Volatile Core',d:'While raging, a creature that hits you in melee takes 1d6 force damage.'+AE,ae:1},
  // Fighter — Runecarver
  emberRune:{n:'Ember Rune',d:'Once per turn your weapon hit deals +1d6 fire (2d6 with Runemaster).'+AE,ae:1,pool:2},
  runeWard:{n:'Ward Rune',d:'Bonus action: gain temporary HP equal to 2d6 + your level. Rune uses: 2 per short rest (3 with Runemaster).'+AE,ae:1,kind:'bonus',pool:2},
  stoneRune:{n:'Stone Rune',d:'Action, 1 rune use: a foe within 6 tiles makes a Wis save (DC 8 + proficiency + Con) or is restrained for 2 rounds (it repeats a Str save each turn).'+AE,ae:1,kind:'action',pool:2},
  runeMaster:{n:'Runemaster',d:'Your runes carve deeper: +1 rune use and Ember Rune deals 2d6.'+AE,ae:1},
  // Druid — Circle of the Hollow Moon
  moonshroud:{n:'Moonshroud',d:'Bonus action, spend a Wild Shape use: for 10 rounds pale moonlight wraps you. Gain temporary HP 1d8 + Wis modifier, and your damaging spells deal +1d6 damage.'+AE,ae:1,kind:'bonus',pool:3},
  moonOmen:{n:'Lunar Omen',d:'While Moonshroud is active you gain +1 AC and +1 to saving throws.'+AE,ae:1},
  moonfireLance:{n:'Moonfire Lance',d:'Action, spend a Wild Shape use: a foe within 12 tiles makes a Con save vs your spell DC, taking 3d8 + Wis radiant damage (half on a success).'+AE,ae:1,kind:'action',pool:3},
  // Sorcerer — Riven Mind Bloodline
  rivenWhisper:{n:'Riven Whispers',d:'You always know the Thought Needle cantrip and the Mind Lash spell.'+AE,ae:1},
  rivenWard:{n:'Splintered Psyche',d:'Resistance to psychic damage.'+AE,ae:1,pool:1},
  rivenFlesh:{n:'Riven Flesh',d:'Bonus action, once per short rest: your body ripples with alien sinew. Gain temporary HP equal to twice your level and +1 AC for 10 rounds.'+AE,ae:1,kind:'bonus',pool:2},
  // Rogue — Whisperblade
  whisperBlades:{n:'Whisper Blades',d:'Once per turn your weapon hit deals +1d6 psychic damage as a shard of thought follows the blade.'+AE,ae:1,pool:2},
  whisperKnack:{n:'Whisper Knack',d:'+2 to Intelligence, Wisdom and Charisma skill checks you are proficient in.'+AE,ae:1,pool:1},
  veilStep:{n:'Veil Step',d:'Bonus action, once per short rest: vanish and reappear on a free tile within 6 tiles, hidden until your next turn.'+AE,ae:1,kind:'bonus',pool:2}
});
// Features offered in the homebrew pool (beyond the ones on the two new class lists)
const ARCANA_POOL=['flareCharge','lanternCraft','infuseArms','inventorInstinct','arcaneArmory','forgeCompanion','ironCommand','vitriolFlask','restorativeTonic','causticMastery','psiDice','psiWard','kineticThrust','innerEye','psiRecovery','thoughtShield','kineticEdge','kineticBarrier','gravityWell','dreadWhisper','mindPierce','hollowGaze','emberRune','runeWard','stoneRune','moonshroud','moonfireLance','rivenWard','rivenFlesh','whisperBlades','whisperKnack','veilStep','witchSense'];
// ---------- spells ----------
Object.assign(SPELLS,{
  thoughtneedle:{n:'Thought Needle',l:0,s:'Enchantment',c:'V',t:'a',r:12,tg:'enemy',sv:'int',dmg:'1d8',dt:'psychic',cs:1,ae:1,d:'A sliver of will pierces a mind: Int save or 1d8 psychic.'+AE},
  kineticshove:{n:'Kinetic Shove',l:0,s:'Evocation',c:'VL',t:'a',r:6,tg:'enemy',sv:'str',dmg:'1d6',dt:'force',cs:1,fx:'push',ae:1,d:'A fist of force: Str save or 1d6 force and pushed 2 tiles.'+AE},
  sparkcoil:{n:'Spark Coil',l:0,s:'Evocation',c:'LW',t:'a',r:12,tg:'enemy',atk:'r',dmg:'1d10',dt:'lightning',cs:1,ae:1,d:'A coiled bolt leaps from your gauntlet: ranged spell attack, 1d10 lightning.'+AE},
  mindlash:{n:'Mind Lash',l:1,s:'Enchantment',c:'V',t:'a',r:12,tg:'enemy',sv:'wis',dmg:'3d6',dt:'psychic',half:1,up:'1d6',ae:1,d:'Wis save: 3d6 psychic (half on a success).'+AE},
  ironcarapace:{n:'Iron Carapace',l:2,s:'Abjuration',c:'LV',t:'b',r:0,tg:'self',fx:'ironcarapace',ae:1,d:'Bonus action: plates of conjured iron give +2 AC for 10 rounds.'+AE},
  kineticstorm:{n:'Kinetic Storm',l:3,s:'Evocation',c:'V',t:'a',r:18,tg:'area',area:{sh:'r',sz:2},sv:'str',dmg:'6d6',dt:'force',half:1,up:'1d6',fx:'push',ae:1,d:'A 2-tile burst of churning force: Str save, 6d6 force and pushed 2 tiles (half, no push).'+AE}
});
// existing SRD spells on the new lists
const _addList=(L,ids)=>ids.forEach(id=>{ if(SPELLS[id]&&!SPELLS[id].c.includes(L)) SPELLS[id].c+=L; });
_addList('L',['acidsplash','firebolt','light','poisonspray','rayoffrost','shockinggrasp','guidance','curewounds','detectmagic','faeriefire','falselife','identify','longstrider','thunderwave','aid','blur','heatmetal','invisibility','knock','lesserrestoration','magicweapon','web','enhanceability','haste','dispelmagic','elementalweapon','revivify','daylight']);
_addList('V',['light','truestrike','bane','charmperson','command','detectmagic','shield','sleep','thunderwave','blindness','holdperson','invisibility','mistystep','shatter','suggestion','blur','dispelmagic','fear','hypnoticpattern','slow','haste','banishment','confusion','dimensiondoor','greaterinvisibility','holdmonster']);
CANTRIPS_KNOWN.L=[2,2,2,2,2,2,2,2,2,3,3,3];
CANTRIPS_KNOWN.V=[3,3,3,4,4,4,4,4,4,5,5,5];
SPELLS_KNOWN.V=[2,3,4,5,6,7,8,9,10,11,12,12];
CLASS_SPELL_LIST_NAMES.L='Lanternwright'; CLASS_SPELL_LIST_NAMES.V='Veilseer';
// ---------- classes ----------
CLASSES.lanternwright={n:'Lanternwright',hd:8,primary:['int'],saves:['con','int'],armor:['light','medium','shield'],weapons:['simple','handcrossbow'],nSkills:2,tools:true,
  skillList:['arcana','history','investigation','medicine','nature','perception','sleight'],caster:'half',halfUp:true,cast:'int',known:false,list:'L',original:true,arcana:true,
  feats:{1:['spellcasting','lanternCraft','flareCharge'],2:['infuseArms'],4:['asi'],6:['gadgetMastery'],7:['inventorInstinct'],8:['asi'],10:['arcaneArmory'],12:['asi']},
  subLvl:3,subs:{ironwright:{n:'Ironwright',src:'Arcana Experimental',feats:{3:['forgeCompanion','ironCommand'],5:['extraAttack'],9:['houndOverdrive']}},
    vitriolist:{n:'Vitriolist',src:'Arcana Experimental',feats:{3:['vitriolFlask','restorativeTonic'],5:['causticMastery'],9:['volatileReagents']}}},
  start:['mace','lightcrossbow','scalemail','shield'],desc:'A tinkerer of the Night who keeps the last lanterns burning — infusing arms with captive sparks, hurling flare charges, and building brass companions. (Arcana Experimental — original class)'};
CLASSES.veilseer={n:'Veilseer',hd:8,primary:['int'],saves:['int','wis'],armor:['light'],weapons:['simple'],nSkills:2,
  skillList:['arcana','history','insight','intimidation','investigation','perception','persuasion'],caster:'full',cast:'int',known:true,list:'V',original:true,arcana:true,
  feats:{1:['spellcasting','psiDice','psiWard'],2:['kineticThrust','innerEye'],4:['asi'],5:['psiRecovery'],7:['thoughtShield'],8:['asi'],12:['asi']},
  subLvl:1,subs:{ironwill:{n:'Order of the Iron Will',src:'Arcana Experimental',feats:{1:['kineticEdge'],6:['kineticBarrier'],10:['gravityWell']}},
    hollowEye:{n:'Order of the Hollow Eye',src:'Arcana Experimental',feats:{1:['dreadWhisper'],6:['mindPierce'],10:['hollowGaze']}}},
  start:['quarterstaff','dagger','leather'],desc:'A seer who tore the veil behind their own eyes. Psi dice fuel kinetic blows, mind wards and whispered dread. (Arcana Experimental — original class)'};
CLASSES.barbarian.subs.witchfire={n:'Path of the Witchfire',src:'Arcana Experimental',feats:{3:['witchSurge'],6:['witchSense'],10:['witchCore']}};
CLASSES.fighter.subs.runecarver={n:'Runecarver',src:'Arcana Experimental',feats:{3:['emberRune','runeWard'],7:['stoneRune'],10:['runeMaster']}};
CLASSES.druid.subs.hollowmoon={n:'Circle of the Hollow Moon',src:'Arcana Experimental',feats:{2:['moonshroud'],6:['moonOmen'],10:['moonfireLance']}};
CLASSES.sorcerer.subs.rivenmind={n:'Riven Mind Bloodline',src:'Arcana Experimental',feats:{1:['rivenWhisper','rivenWard'],6:['rivenFlesh']}};
CLASSES.rogue.subs.whisperblade={n:'Whisperblade',src:'Arcana Experimental',feats:{3:['whisperBlades','whisperKnack'],9:['veilStep']}};
if(typeof CLASS_PRIO!=='undefined'){ CLASS_PRIO.lanternwright='int,con,dex,wis,cha,str'; CLASS_PRIO.veilseer='int,con,dex,wis,cha,str'; }
// ---------- construct companion ----------
M('clockhound','Clockwork Hound','construct',0,15,10,40,[14,14,14,6,12,4],[A('Brass Bite',4,'1d8+2','piercing')],{art:'beast',tint:'#b08a3a',immune:['poison','psychic'],condImm:['poisoned','charmed','frightened','exhaustion']});
MINION_KINDS.construct={mid:'clockhound',n:'Clockwork Hound',ic:'⚙',construct:1,verb:'clanks to life',flt:'FORGED',fltC:'#e0b050'};
(function(){ const _md=minionDef; minionDef=function(h,kind,slot){ if(!MINION_KINDS[kind]||!MINION_KINDS[kind].construct) return _md(h,kind,slot);
  const F=heroFeatures(h); const d=JSON.parse(JSON.stringify(MONSTERS.clockhound)); d.n=MINION_KINDS[kind].n; d.minion=1; d.cr=0; d.boss=false; d.talk=null;
  d.atks=d.atks.map(a=>Object.assign(a,{hit:spellAtk(h),dmg:'1d8+'+profFor(h.level)}));
  if(F.has('houndOverdrive')){ d.ac+=2; d.multi=2; }
  d.hp=2+5*h.level+Math.max(0,abilMod(h,'int')); return d; }; })();
function constructsOf(h){ return minionsOf(h).filter(m=>MINION_KINDS[m.kind]&&MINION_KINDS[m.kind].construct); }
// ---------- helpers ----------
function psiDie(h){ return h.level>=11?'1d10':h.level>=5?'1d8':'1d6'; }
const PSI_USERS=['psiDice','psiWard','kineticThrust','kineticEdge','kineticBarrier','gravityWell','dreadWhisper','hollowGaze','psiRecovery'];
function gadgetDice(h){ const F=heroFeatures(h); return ((h.level>=11?3:h.level>=5?2:1)+(F.has('gadgetMastery')?1:0))+'d6'; }
function flaskDice(h){ const F=heroFeatures(h); return ((h.level>=9?4:h.level>=5?3:2)+(F.has('volatileReagents')?1:0))+'d6'; }
function aeInt(h){ return Math.max(1,abilMod(h,'int')); }
function infusionBonus(h){ const F=heroFeatures(h); return F.has('arcaneArmory')?2:F.has('infuseArms')?1:0; }
// ---------- rules hooks ----------
(function(){
  const _cl=casterLevel; casterLevel=function(h){ const c=getClass(h.cls); if(c.caster==='half'&&c.halfUp) return Math.ceil(h.level/2); return _cl(h); };
  const _sa=spellsAllowed; spellsAllowed=function(h){ const c=getClass(h.cls); if(c.caster==='half'&&c.halfUp&&!c.homebrew) return Math.max(1,abilMod(h,c.cast)+Math.ceil(h.level/2)); return _sa(h); };
  const _rm=resMax; resMax=function(h){ const r=_rm(h), F=heroFeatures(h), pb=profFor(h.level);
    if(PSI_USERS.some(f=>F.has(f))) r.psi=F.has('psiDice')?2*pb:pb;
    if(F.has('psiRecovery')) r.psirec=1;
    if(F.has('flareCharge')) r.gadget=aeInt(h)+(F.has('gadgetMastery')?1:0);
    if(F.has('forgeCompanion')) r.forge=1;
    if(F.has('vitriolFlask')) r.flask=pb+(F.has('volatileReagents')?2:0);
    if(F.has('restorativeTonic')) r.tonic=aeInt(h);
    if(F.has('runeWard')||F.has('stoneRune')) r.rune=2+(F.has('runeMaster')?1:0);
    if(F.has('veilStep')) r.veil=1;
    if(F.has('rivenFlesh')) r.rflesh=1;
    if((F.has('moonshroud')||F.has('moonfireLance'))&&!r.wild) r.wild=2;
    return r; };
  SHORT_REST_RES.push('psi','gadget','forge','rune','veil','rflesh');
  const _ac=heroAC; heroAC=function(h){ let ac=_ac(h); const F=heroFeatures(h);
    if(armorOf(h)) ac+=infusionBonus(h);
    if(hasFx(h,'ironcarapace')) ac+=2; if(hasFx(h,'witchward')&&hasFx(h,'raging')) ac+=2; if(hasFx(h,'rivenflesh')) ac+=1;
    if(F.has('moonOmen')&&hasFx(h,'moonshroud')) ac+=1; return ac; };
  const _sb=saveBonus; saveBonus=function(c,a){ let b=_sb(c,a); if(!c.isHero) return b; const F=heroFeatures(c);
    if(F.has('witchSense')&&(a==='int'||a==='wis')) b+=2; if(F.has('moonOmen')&&hasFx(c,'moonshroud')) b+=1; return b; };
  const _ib=initBonus; initBonus=function(c){ let b=_ib(c); if(c.isHero&&heroFeatures(c).has('inventorInstinct')) b+=aeInt(c); return b; };
  const _sk=skillBonus; skillBonus=function(c,sk){ let b=_sk(c,sk); if(!c.isHero) return b; const F=heroFeatures(c);
    if(F.has('innerEye')&&(sk==='perception'||sk==='insight')) b+=aeInt(c);
    if(F.has('whisperKnack')&&sk!=='tools'&&['int','wis','cha'].includes(SKILLS[sk])&&skillProf(c,sk)>0) b+=2;
    if(F.has('lanternCraft')&&sk==='tools'&&c.tools&&!(c.expertise||[]).includes('tools')) b+=profFor(c.level);
    return b; };
  const _lr=lightRadius; lightRadius=function(h){ let r=_lr(h); if(heroFeatures(h).has('lanternCraft')) r+=2; return r; };
  const _hc=heroCantrips; heroCantrips=function(h){ const o=_hc(h); if(heroFeatures(h).has('rivenWhisper')&&!o.includes('thoughtneedle')) o.push('thoughtneedle'); return o; };
  const _hs=heroSpells; heroSpells=function(h){ const o=_hs(h); if(heroFeatures(h).has('rivenWhisper')&&!o.includes('mindlash')) o.push('mindlash'); return o; };
  const _res=resistMult; resistMult=function(c,dt,magical,silvered){ const m=_res(c,dt,magical,silvered); if(m===1&&c.isHero&&dt==='psychic'){ const F=heroFeatures(c); if(F.has('thoughtShield')||F.has('rivenWard')) return 0.5; } return m; };
  const _ds=doSave; doSave=function(c,a,dc,opts){ if(c&&c.isHero&&opts&&(opts.cond==='charmed'||opts.cond==='frightened')&&heroFeatures(c).has('thoughtShield')) opts=Object.assign({},opts,{adv:1}); return _ds(c,a,dc,opts); };
  const _wp=weaponProfile; weaponProfile=function(h,it,mode){ const p=_wp(h,it,mode); if(it){ const b=infusionBonus(h); if(b){ p.hit+=b; p.dmgB+=b; p.magical=true; } } return p; };
  const _sdb=spellDmgBonus; spellDmgBonus=function(c,sp,dt){ let b=_sdb(c,sp,dt); if(!c.isHero) return b; const F=heroFeatures(c);
    if(F.has('causticMastery')&&(dt==='acid'||dt==='fire')) b+=Math.max(0,abilMod(c,'int'));
    if(F.has('mindPierce')&&dt==='psychic') b+=Math.max(0,abilMod(c,'int'));
    if(hasFx(c,'moonshroud')&&sp&&sp.dmg) b+=die(6);
    return b; };
})();
// ---------- combat hooks (called from combat.js) ----------
function ARC_defReact(att,tgt,total,ac){ if(!tgt.isHero||!tgt.reaction||incapacitated(tgt)) return false; const F=heroFeatures(tgt);
  if(F.has('psiWard')&&tgt.res&&tgt.res.psi>0&&total<ac+(+psiDie(tgt).slice(2))){ const r=rollDice(psiDie(tgt)).total; if(total<ac+r){ tgt.res.psi--; tgt.reaction=false; log(tgt.name+' raises a Mind Ward (+'+r+' AC)!','good'); floater(tgt.x,tgt.y,'WARD','#b8a0ff'); return true; } }
  return false; }
function ARC_heroHit(att,tgt,p,opts,parts,crit,ts,F){ if(!ts||opts.spell) return;
  if(F.has('kineticEdge')&&!ts.kedge&&att.res&&att.res.psi>1){ ts.kedge=true; att.res.psi--; const d=rollDice(psiDie(att),{crit}).total; parts.push([d,'force']); log('Kinetic Edge! +'+d+' force','good'); }
  if(F.has('whisperBlades')&&!ts.wblade){ ts.wblade=true; parts.push([rollDice('1d6',{crit}).total,'psychic']); }
  if(F.has('emberRune')&&!ts.erune){ ts.erune=true; parts.push([rollDice(F.has('runeMaster')?'2d6':'1d6',{crit}).total,'fire']); }
  if(hasFx(att,'witchlight')&&hasFx(att,'raging')) parts.push([rollDice('1d6',{crit}).total,'radiant']); }
function ARC_retaliate(att,tgt,p){ if(!p.melee||!tgt.isHero||!alive(tgt)||!alive(att)) return; const F=heroFeatures(tgt);
  if(F.has('witchCore')&&hasFx(tgt,'raging')) dealDamage(att,die(6),'force',tgt,{magical:true}); }
// ---------- feature actions ----------
SPELL_FX.ironcarapace=async(c)=>{ addFx(c,{id:'ironcarapace',rounds:10}); log(cName(c)+' is sheathed in conjured iron (+2 AC).','good'); floater(c.x,c.y,'+2 AC','#cfd6e0'); };
(function(){ const _r=FEAT_ACT.rage.run; FEAT_ACT.rage.run=async h=>{ await _r(h); if(!heroFeatures(h).has('witchSurge')) return; const r=die(4);
  if(r===1){ log('Witchfire Surge: a lash of witchfire!','good'); for(const e of enemiesOf(h).filter(e=>alive(e)&&dist(e,h)<=1)) dealDamage(e,die(8),'force',h,{magical:true}); }
  else if(r===2){ addFx(h,{id:'witchward',rounds:10}); log('Witchfire Surge: a shimmering ward (+2 AC).','good'); }
  else if(r===3){ addFx(h,{id:'witchlight',rounds:10}); log('Witchfire Surge: hungry light coils around your weapon.','good'); }
  else { const n=die(12)+h.level; h.tempHp=Math.max(h.tempHp||0,n); log('Witchfire Surge: a surge of life (+'+n+' temp HP).','good'); }
  floater(h.x,h.y,'WITCHFIRE','#c08aff',true); }; })();
function aeSave(h,t,ab,dc,opts){ const s=doSave(t,ab,dc,opts||{magic:1}); log(s.txt,s.ok?'':'hit'); return s.ok; }
Object.assign(FEAT_ACT,{
  flareCharge:{res:'gadget',cost:'bonus',tg:'enemy',range:6,run:async(h,t)=>{ const ok=aeSave(h,t,'dex',spellDC(h)); let d=rollDice(gadgetDice(h)).total+(heroFeatures(h).has('causticMastery')?Math.max(0,abilMod(h,'int')):0); if(ok) d=Math.floor(d/2); log(h.name+' hurls a Flare Charge!','spell'); floater(t.x,t.y,'FLARE','#ffd070'); if(d>0) dealDamage(t,d,'fire',h,{magical:true}); if(!ok&&alive(t)) applyCond(t,'blinded',1,h); }},
  forgeCompanion:{res:'forge',cost:'action',tg:'self',ok:h=>!!G.run&&!!G.run.map&&constructsOf(h).length===0,run:async h=>{ const e=raiseMinion(h,'construct',1); if(!e) h.res.forge++; }},
  ironCommand:{cost:'bonus',tg:'enemy',range:24,ok:h=>constructsOf(h).length>0,run:async(h,t)=>{ const ms=constructsOf(h).filter(m=>dist(m,h)<=12&&!incapacitated(m)); let m=t?ms.find(m=>minionAttackFor(m,t)):null;
    if(!m){ const foes=enemiesOf(h).filter(alive); for(const mm of ms){ const tt=foes.find(f=>minionAttackFor(mm,f)); if(tt){ m=mm; t=tt; break; } } } if(!m){ log('Your hound cannot reach a foe.','bad'); return; }
    log(h.name+' commands '+cName(m)+' to strike!','spell'); await doAttack(m,t,monAttackProfile(m,minionAttackFor(m,t))); }},
  vitriolFlask:{res:'flask',cost:'action',tg:'point',range:6,run:async(h,t,x,y)=>{ const tiles=[]; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) tiles.push([x+dx,y+dy]); flashArea(tiles); log(h.name+' lobs a Vitriol Flask!','spell');
    const d0=rollDice(flaskDice(h)).total+(heroFeatures(h).has('causticMastery')?Math.max(0,abilMod(h,'int')):0);
    for(const e of creaturesIn(tiles).filter(e=>!partySide(e))){ const ok=aeSave(h,e,'dex',spellDC(h)); const d=ok?Math.floor(d0/2):d0; if(d>0) dealDamage(e,d,'acid',h,{magical:true}); } }},
  restorativeTonic:{res:'tonic',cost:'bonus',tg:'ally',range:1,run:async(h,t)=>{ t=t||h; healC(t,rollDice(h.level>=9?'2d8':'1d8').total+aeInt(h),h); }},
  kineticThrust:{res:'psi',cost:'bonus',tg:'enemy',range:6,run:async(h,t)=>{ const d=rollDice(psiDie(h)).total+Math.max(0,abilMod(h,'int')); dealDamage(t,d,'force',h,{magical:true}); if(alive(t)&&!aeSave(h,t,'str',spellDC(h))) pushAway(t,h,2); }},
  psiRecovery:{res:'psirec',cost:'bonus',tg:'self',ok:h=>(h.res.psi||0)<(resMax(h).psi||0),run:async h=>{ const n=Math.max(1,Math.floor(profFor(h.level)/2))+1; h.res.psi=Math.min(resMax(h).psi||0,(h.res.psi||0)+n); log(h.name+' gathers their mind (+'+n+' psi dice).','good'); }},
  kineticBarrier:{res:'psi',cost:'bonus',tg:'self',run:async h=>{ const n=rollDice(psiDie(h)).total+rollDice(psiDie(h)).total+Math.max(0,abilMod(h,'int')); h.tempHp=Math.max(h.tempHp||0,n); floater(h.x,h.y,'+'+n+' temp','#8ac'); }},
  gravityWell:{res:'psi',n:2,cost:'action',tg:'point',range:12,run:async(h,t,x,y)=>{ const tiles=[]; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) tiles.push([x+dx,y+dy]); flashArea(tiles); log(h.name+' opens a Gravity Well!','spell'); const d0=rollDice('4d8').total;
    for(const e of creaturesIn(tiles).filter(e=>!partySide(e))){ const ok=aeSave(h,e,'str',spellDC(h)); dealDamage(e,ok?Math.floor(d0/2):d0,'force',h,{magical:true}); if(!ok&&alive(e)) applyCond(e,'prone',-1,h); } }},
  dreadWhisper:{res:'psi',cost:'bonus',tg:'enemy',range:12,run:async(h,t)=>{ if(!aeSave(h,t,'wis',spellDC(h),{magic:1,cond:'frightened'})){ dealDamage(t,rollDice(psiDie(h)).total,'psychic',h,{magical:true}); if(alive(t)) applyCond(t,'frightened',1,h); } }},
  hollowGaze:{res:'psi',n:2,cost:'action',tg:'enemy',range:12,run:async(h,t)=>{ if(!aeSave(h,t,'wis',spellDC(h))) applyCond(t,'stunned',1,h); }},
  runeWard:{res:'rune',cost:'bonus',tg:'self',run:async h=>{ const n=rollDice('2d6').total+h.level; h.tempHp=Math.max(h.tempHp||0,n); floater(h.x,h.y,'+'+n+' temp','#8ac'); log(h.name+' traces a Ward Rune.','good'); }},
  stoneRune:{res:'rune',cost:'action',tg:'enemy',range:6,run:async(h,t)=>{ const dc=8+profFor(h.level)+abilMod(h,'con'); if(!aeSave(h,t,'wis',dc)) applyCond(t,'restrained',2,h,{save:{a:'str',dc}}); }},
  moonshroud:{res:'wild',cost:'bonus',tg:'self',ok:h=>!hasFx(h,'moonshroud')&&!hasFx(h,'wildshape'),run:async h=>{ addFx(h,{id:'moonshroud',rounds:10}); const n=die(8)+Math.max(0,abilMod(h,'wis')); h.tempHp=Math.max(h.tempHp||0,n); log(h.name+' is wrapped in pale moonlight.','good'); floater(h.x,h.y,'MOONSHROUD','#cfe0ff',true); }},
  moonfireLance:{res:'wild',cost:'action',tg:'enemy',range:12,run:async(h,t)=>{ const ok=aeSave(h,t,'con',spellDC(h)); let d=rollDice('3d8').total+Math.max(0,abilMod(h,'wis')); if(ok) d=Math.floor(d/2); dealDamage(t,d,'radiant',h,{magical:true}); }},
  rivenFlesh:{res:'rflesh',cost:'bonus',tg:'self',run:async h=>{ addFx(h,{id:'rivenflesh',rounds:10}); h.tempHp=Math.max(h.tempHp||0,2*h.level); log(h.name+'\'s flesh ripples with alien sinew.','good'); }},
  veilStep:{res:'veil',cost:'bonus',tg:'point',range:6,run:async(h,t,x,y)=>{ if(blocksMove(G.run.map,x,y)||occupied(x,y,h)){ log('Blocked.'); h.res.veil++; return; } h.x=x; h.y=y; addFx(h,{id:'hidden',rounds:2}); floater(x,y,'veil','#aab'); computeVis(); }}
});
// ---------- auto-play (Auto mode and the soak bot) ----------
async function ARC_autoTurn(h){ const C=G.combat; if(!C) return false; const F=heroFeatures(h); const A=FEAT_ACT; const map=G.run.map;
  const can=id=>F.has(id)&&A[id]&&(!A[id].res||(h.res[A[id].res]||0)>=(A[id].n||1))&&(!A[id].ok||A[id].ok(h))&&(A[id].cost==='action'?C.ts.action>0:A[id].cost==='bonus'?C.ts.bonus>0:true);
  const foes=()=>enemiesOf(h).filter(alive).sort((a,b)=>dist(a,h)-dist(b,h)); const seen=r=>foes().filter(f=>dist(f,h)<=r&&los(map,h.x,h.y,f.x,f.y));
  const cluster=(r,rad)=>{ let best=null,bn=0; for(const f of seen(r)){ const n=foes().filter(o=>dist(o,f)<=rad).length; const allyHit=activeParty().some(a=>a.x!=null&&dist(a,f)<=rad); if(!allyHit&&n>bn){ bn=n; best=f; } } return [best,bn]; };
  // bonus actions first
  if(can('psiRecovery')&&(h.res.psi||0)<=1) await useFeat(h,'psiRecovery');
  if(can('moonshroud')&&foes().length) await useFeat(h,'moonshroud');
  if(can('rivenFlesh')&&h.hp<cMaxHP(h)*0.5) await useFeat(h,'rivenFlesh');
  if(can('kineticBarrier')&&h.hp<cMaxHP(h)*0.5&&(h.res.psi||0)>2) await useFeat(h,'kineticBarrier');
  if(can('runeWard')&&h.hp<cMaxHP(h)*0.6) await useFeat(h,'runeWard');
  if(can('restorativeTonic')){ const hurt=[h,...allies(h)].filter(a=>a.hp>0&&a.x!=null&&dist(a,h)<=1&&a.hp<cMaxHP(a)*0.5)[0]; if(hurt) await useFeat(h,'restorativeTonic',hurt); }
  if(!G.combat) return true;
  // actions
  let acted=false;
  if(can('forgeCompanion')){ await useFeat(h,'forgeCompanion'); acted=true; }
  if(!acted&&can('vitriolFlask')){ const [t,n]=cluster(6,1); if(t&&n>=2){ await useFeat(h,'vitriolFlask',null,t.x,t.y); acted=true; } }
  if(!acted&&can('gravityWell')&&(h.res.psi||0)>=3){ const [t,n]=cluster(12,2); if(t&&n>=2){ await useFeat(h,'gravityWell',null,t.x,t.y); acted=true; } }
  if(!acted&&can('hollowGaze')&&(h.res.psi||0)>=3){ const t=seen(12).sort((a,b)=>b.hp-a.hp)[0]; if(t&&t.hp>15){ await useFeat(h,'hollowGaze',t); acted=true; } }
  if(!acted&&can('moonfireLance')&&hasFx(h,'moonshroud')&&(h.res.wild||0)>0){ const t=seen(12)[0]; if(t&&adjacentFoes(h).length===0){ await useFeat(h,'moonfireLance',t); acted=true; } }
  if(!acted&&can('stoneRune')){ const t=seen(6).sort((a,b)=>b.hp-a.hp)[0]; if(t&&t.hp>20){ await useFeat(h,'stoneRune',t); acted=true; } }
  if(!G.combat) return true;
  // remaining bonus actions
  if(can('ironCommand')) await useFeat(h,'ironCommand');
  if(G.combat&&can('flareCharge')){ const t=seen(6)[0]; if(t) await useFeat(h,'flareCharge',t); }
  if(G.combat&&can('kineticThrust')&&(h.res.psi||0)>2){ const t=seen(6)[0]; if(t) await useFeat(h,'kineticThrust',t); }
  if(G.combat&&can('dreadWhisper')&&(h.res.psi||0)>2){ const t=seen(12)[0]; if(t) await useFeat(h,'dreadWhisper',t); }
  if(!G.combat) return true;
  return acted&&C.ts.action<=0&&C.ts.attacksLeft<=0; }
// codex-style credit line used by the Credits screen
const ARCANA_CREDIT='Arcana Experimental: the Lanternwright and Veilseer classes, the Witchfire, Runecarver, Hollow Moon, Riven Mind and Whisperblade subclasses, their features, the Clockwork Hound and the spells Thought Needle, Kinetic Shove, Spark Coil, Mind Lash, Iron Carapace and Kinetic Storm are original playtest content for The Last Lantern. They are not part of the SRD 5.1 and are subject to change.';
