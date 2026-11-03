// ===== Character sheet, equipment, level-up, journal, credits =====
const ACC_SLOTS=['ring1','ring2','amulet','cloak','belt','boots','gloves','head','trinket'];
const SLOT_NAME={main:'Main hand',off:'Off hand',ranged:'Ranged',armor:'Armor',ring1:'Ring',ring2:'Ring',amulet:'Amulet',cloak:'Cloak',belt:'Belt',boots:'Boots',gloves:'Gloves',head:'Head',trinket:'Trinket'};
function canEquipAny(it){ return ['weapon','armor','shield','acc','wand'].includes(it.kind); }
function slotsFor(h,it){ if(it.kind==='weapon'){ const w=WEAPONS[it.base]; if(w.p.includes('ranged')) return ['ranged']; const s=['main']; if(w.p.includes('light')) s.push('off'); if(w.p.includes('thrown')) s.push('ranged'); return s; }
  if(it.kind==='shield') return ['off']; if(it.kind==='armor') return ['armor']; if(it.slot==='ring') return ['ring1','ring2']; return [it.slot||'trinket']; }
function equipItem(h,it,src,slot){ const slots=slotsFor(h,it); slot=slot||(slots.find(s=>!h.eq[s])||slots[0]); const i=src.indexOf(it); if(i>=0) src.splice(i,1);
  if(h.eq[slot]) stackAdd(src,h.eq[slot]); h.eq[slot]=it;
  if(slot==='main'&&WEAPONS[it.base]&&WEAPONS[it.base].p.includes('two')&&h.eq.off){ stackAdd(src,h.eq.off); h.eq.off=null; }
  if(slot==='off'&&h.eq.main&&WEAPONS[h.eq.main.base]&&WEAPONS[h.eq.main.base].p.includes('two')){ stackAdd(src,h.eq.main); h.eq.main=null; }
  if(it.kind==='weapon'&&!weaponProf(h,it.base)) toast(h.name+' is not proficient with '+WEAPONS[it.base].n+'.');
  if(it.kind==='armor'&&!armorProf(h,ARMORS[it.base].type)) toast(h.name+' is not proficient in '+ARMORS[it.base].type+' armor (disadvantage, no spells).');
  h._fcache=null; h.hp=Math.min(h.hp,heroMaxHP(h)); }
function unequip(h,slot,dst){ if(!h.eq[slot]) return; stackAdd(dst,h.eq[slot]); h.eq[slot]=null; h.hp=Math.min(h.hp,heroMaxHP(h)); }
UI.sheet=function(h,back,readonly){ let tab='stats'; const inDungeon=!!G.run; const src=()=>inDungeon?G.run.pack:G.stash;
  const body=el('div',{class:'sheet'}); const tabs=['stats','gear','spells','features','look'];
  const draw=()=>{ body.innerHTML=''; const c=getClass(h.cls), s=getSub(h);
    body.appendChild(el('div',{class:'shead'},portraitEl(h,84,'big'),el('div',{class:'grow'},el('h3',null,h.name),el('div',{class:'small'},RACES[h.race].n+' '+c.n+(s?' — '+s.n:'')+' · Level '+h.level+' · '+BACKGROUNDS[h.bg].n),
      el('div',null,'HP '+Math.max(0,h.hp)+'/'+heroMaxHP(h)+' · AC '+heroAC(h)+' · Speed '+heroSpeed(h)+' ft · Init '+fmtMod(initBonus(h))+' · Prof +'+profFor(h.level)),
      el('div',{class:'xpbar'},el('div',{style:{width:clamp(h.xp/xpForNext(h.level)*100,0,100)+'%'}})),el('div',{class:'small'},'XP '+h.xp+' / '+xpForNext(h.level)),
      canLevel(h)&&!readonly&&!G.combat?btn('⬆ Level up!',()=>levelUpModal(h,draw),'big',{id:'b-levelup'}):null)));
    body.appendChild(el('div',{class:'chips'},tabs.map(t=>el('button',{class:'chip'+(t===tab?' on':''),id:'st-'+t,onclick:()=>{ tab=t; draw(); }},({stats:'Stats',gear:'Gear',spells:'Spells',features:'Features',look:'Appearance'})[t]))));
    if(tab==='stats'){ body.appendChild(el('div',{class:'abgrid'},ABIL.map(a=>el('div',{class:'abbox'},el('div',{class:'small'},a.toUpperCase()),el('b',null,abilScore(h,a)),el('div',null,fmtMod(abilMod(h,a))),el('div',{class:'small'},'save '+fmtMod(saveBonus(h,a))+(c.saves.includes(a)?'●':''))))));
      body.appendChild(el('div',{class:'skgrid'},Object.keys(SKILLS).map(sk=>el('div',{class:'sk'+(skillProf(h,sk)?' prof':'')},(h.expertise||[]).includes(sk)?'◆ ':skillProf(h,sk)?'● ':'○ ',SKILL_NAME[sk]+' '+fmtMod(skillBonus(h,sk))))));
      body.appendChild(el('div',{class:'small'},'Passive Perception '+passive(h,'perception')+' · Passive Investigation '+passive(h,'investigation')+' · Light '+lightRadius(h)+' · Darkvision '+(RACES[h.race].dv?'yes':'no')));
      if((h.injuries||[]).length) body.appendChild(el('div',{class:'card bad'},el('b',null,'Lasting injuries'),h.injuries.map(i=>{ const d=INJURIES.find(x=>x.id===i.id); return el('div',{class:'small'},d.n+': '+d.d+(d.perm?'':' ('+Math.max(0,i.days)+' days)')); })));
      if((h.fx||[]).length) body.appendChild(el('div',{class:'small'},'Effects: '+h.fx.map(f=>f.id).join(', ')));
      body.appendChild(el('div',{class:'small'},'Resources: '+Object.keys(h.res||{}).map(k=>k+' '+h.res[k]).join(' · ')+' · Hit dice '+(h.hd||0)+'/'+h.level+' · Kills '+(h.kills||0)));
      if(h.bio) body.appendChild(el('p',{class:'small'},h.bio)); }
    if(tab==='gear'){ const all=['main','off','ranged','armor',...ACC_SLOTS];
      body.appendChild(el('div',{class:'col'},all.map(sl=>{ const it=h.eq[sl]; return el('div',{class:'lrow'},el('span',{class:'slot'},SLOT_NAME[sl]),it?rarSpan(it):el('span',{class:'small'},'—'),el('span',{class:'small grow'},it?itemDesc(it).split('\n')[0]:''),it&&!readonly&&!G.combat?btn('Remove',()=>{ unequip(h,sl,src()); draw(); },'mini'):null); })));
      if(!readonly&&!G.combat){ const cand=src().filter(canEquipAny); body.appendChild(el('h3',null,(inDungeon?'Pack':'Stash')+' — equip'));
        body.appendChild(el('div',{class:'col'},cand.length?cand.map(it=>el('div',{class:'lrow'},rarSpan(it),el('span',{class:'small grow'},itemDesc(it).split('\n')[0]),slotsFor(h,it).map(sl=>btn(SLOT_NAME[sl],()=>{ equipItem(h,it,src(),sl); draw(); UI.refreshParty&&G.run&&UI.refreshParty(); },'mini',{class:'btn mini eqb'})))):el('p',{class:'small'},'Nothing to equip.'))); } }
    if(tab==='spells'){ const all=[...heroCantrips(h),...heroSpells(h)].filter(x=>SPELLS[x]); if(!all.length) body.appendChild(el('p',null,'No spells.'));
      else { body.appendChild(el('div',{class:'small'},'Spell DC '+spellDC(h)+' · attack '+fmtMod(spellAtk(h))+' · slots '+slotTxt(h)));
        body.appendChild(el('div',{class:'slist'},all.sort((a,b)=>SPELLS[a].l-SPELLS[b].l).map(x=>{ const sp=SPELLS[x]; return el('div',{class:'srow'},el('b',null,(sp.l?'L'+sp.l+' ':'◦ ')+sp.n),el('div',{class:'sd'},(sp.r?'Range '+(sp.r*5)+' ft · ':'')+(sp.conc?'Concentration · ':'')+sp.d)); }))); } }
    if(tab==='features'){ const F=[...heroFeatures(h)]; body.appendChild(el('div',{class:'slist'},F.filter(f=>FEATURES[f]).map(f=>el('div',{class:'srow'},el('b',null,FEATURES[f].n),el('div',{class:'sd'},FEATURES[f].d))),(h.feats||[]).map(f=>el('div',{class:'srow'},el('b',null,'Feat: '+FEATS[f].n),el('div',{class:'sd'},FEATS[f].d))),h.style?el('div',{class:'srow'},el('b',null,'Style: '+FIGHTING_STYLES[h.style].n),el('div',{class:'sd'},FIGHTING_STYLES[h.style].d)):null,RACES[h.race].traits.map(t=>el('div',{class:'srow'},el('div',{class:'sd'},t))),el('div',{class:'srow'},el('b',null,'Background: '+BACKGROUNDS[h.bg].n),el('div',{class:'sd'},BACKGROUNDS[h.bg].feat)))); }
    if(tab==='look'){ body.appendChild(el('div',{class:'col'},Object.keys(APPEAR).map(k=>{ const list=APPEAR[k]; const v=h.app[k]||0; const col=list[0][0]==='#'; return el('div',{class:'aprow'},el('span',null,k),readonly?null:btn('◀',()=>{ h.app[k]=(v-1+list.length)%list.length; draw(); },'mini'),col?el('span',{class:'swatch',style:{background:list[v]}}):el('span',{class:'apv'},list[v]),readonly?null:btn('▶',()=>{ h.app[k]=(v+1)%list.length; draw(); R.dirty=true; },'mini')); }),
      readonly?null:el('input',{class:'name',value:h.name,onchange:e=>{ h.name=e.target.value||h.name; }}))); } };
  draw(); UI.modal(h.name,body,{wide:true}).then(()=>{ if(G.run&&G.screen==='dungeon') UI.refreshParty(); else if(back) back(); else if(G.screen==='tavern'&&!document.querySelector('.tav .tavhead h2')) showTavern(); }); };
function levelUpModal(h,after){ const c=getClass(h.cls), nl=h.level+1; const ch={hp:'avg'}; const feats=c.feats[nl]||[];
  const needSub=nl===c.subLvl&&!h.sub&&Object.keys(c.subs).length; if(needSub) ch.sub=Object.keys(c.subs)[0];
  const needAsi=feats.includes('asi'); let asiMode='asi'; if(needAsi){ const p=classPrio(h.cls); ch.asi={[p[0]]:2}; }
  const body=el('div'); const draw=()=>{ body.innerHTML=''; body.appendChild(el('p',null,h.name+' reaches level '+nl+'. New: '+(feats.filter(f=>f!=='asi').map(f=>FEATURES[f]?FEATURES[f].n:f).join(', ')||'—')+(h.sub&&c.subs[h.sub].feats[nl]?', '+c.subs[h.sub].feats[nl].map(f=>FEATURES[f].n).join(', '):'')));
    body.appendChild(el('div',{class:'chips'},['avg','roll'].map(m=>el('button',{class:'chip'+(ch.hp===m?' on':''),onclick:()=>{ ch.hp=m; draw(); }},m==='avg'?'HP: take average ('+(Math.floor(c.hd/2)+1)+')':'HP: roll d'+c.hd))));
    if(needSub){ body.appendChild(el('h3',null,'Choose a subclass')); body.appendChild(el('div',{class:'col'},Object.keys(c.subs).map(k=>el('button',{class:'chip'+(ch.sub===k?' on':''),onclick:()=>{ ch.sub=k; draw(); }},c.subs[k].n+' — '+Object.values(c.subs[k].feats).flat().map(f=>FEATURES[f]?FEATURES[f].n:f).join(', '))))); }
    if(needAsi){ body.appendChild(el('h3',null,'Ability Score Improvement or Feat'));
      body.appendChild(el('div',{class:'chips'},['asi','asi11','feat'].map(m=>el('button',{class:'chip'+(asiMode===m?' on':''),onclick:()=>{ asiMode=m; const p=classPrio(h.cls); ch.feat=null; ch.asi=null; if(m==='asi') ch.asi={[p[0]]:2}; if(m==='asi11') ch.asi={[p[0]]:1,[p[1]]:1}; if(m==='feat') ch.feat=Object.keys(FEATS).find(f=>!(h.feats||[]).includes(f)); draw(); }},({asi:'+2 to one',asi11:'+1 to two',feat:'Take a feat'})[m]))));
      if(asiMode!=='feat'){ const keys=Object.keys(ch.asi); body.appendChild(el('div',{class:'chips'},ABIL.map(a=>el('button',{class:'chip'+(keys.includes(a)?' on':''),onclick:()=>{ if(asiMode==='asi') ch.asi={[a]:2}; else { const k=Object.keys(ch.asi); if(!k.includes(a)){ k.shift(); k.push(a); } ch.asi={}; k.forEach(x=>ch.asi[x]=1); } draw(); }},ABIL_NAME[a]+' '+abilScore(h,a))))); }
      else body.appendChild(el('div',{class:'col'},Object.keys(FEATS).filter(f=>!(h.feats||[]).includes(f)).map(f=>el('button',{class:'chip'+(ch.feat===f?' on':''),onclick:()=>{ ch.feat=f; draw(); }},FEATS[f].n+' — '+FEATS[f].d)))); } };
  draw(); UI.modal('Level Up — '+h.name,body,{wide:true,buttons:[{t:'Confirm',v:1,cls:'big',fn:()=>{ applyLevelUp(h,ch); h.hp=heroMaxHP(h); saveGame&&saveGame(); toast(h.name+' is now level '+h.level+'!'); }}]}).then(v=>{ if(v) { const cv=getClass(h.cls).caster; if(cv&&!G.run) spellPrompt(h); } after&&after(); }); }
function spellPrompt(h){ toast('New spells were chosen automatically — change them at the Library.'); }
UI.levelUp=levelUpModal;
// ---------- inventory (dungeon pack) ----------
UI.inventory=function(){ const body=el('div'); const draw=()=>{ body.innerHTML=''; const P=G.run.pack; body.appendChild(el('div',{class:'small'},'Gold carried: '+G.run.gold+' · '+P.length+' stacks'));
    body.appendChild(el('div',{class:'col'},P.length?P.map(it=>el('div',{class:'lrow'},rarSpan(it),el('span',{class:'small grow'},itemDesc(it).split('\n')[0]),
      (GEAR[it.base]&&GEAR[it.base].use&&!GEAR[it.base].use.throwDmg&&!G.combat)?btn('Use',async()=>{ const h=await UI.pickHero('Use on whom?',activeParty().filter(x=>x.status!=='fallen')); if(h){ await useConsumable(h,it,h); UI.refreshParty(); draw(); } },'mini'):null,
      it.kind==='scroll'&&!G.combat?btn('Read',async()=>{ const h=await UI.pickHero('Who reads it?',activeParty().filter(alive)); if(h){ UI.closeAll(); h._freeCast=true; consumeItem(it); await UI.castOutOfCombat(h,it.spell); } },'mini'):null,
      canEquipAny(it)&&!G.combat?btn('Equip',async()=>{ const h=await UI.pickHero('Equip on whom?',activeParty()); if(h){ equipItem(h,it,P); UI.refreshParty(); draw(); } },'mini'):null,
      it.kind!=='quest'?btn('Drop',()=>{ P.splice(P.indexOf(it),1); draw(); },'mini danger'):null)):el('p',null,'The pack is empty.'))); };
  draw(); UI.modal('Expedition Pack',body,{wide:true}); };
// ---------- journal / codex / factions ----------
UI.journal=function(start){ let tab=start||'quests'; const body=el('div'); const draw=()=>{ body.innerHTML='';
    body.appendChild(el('div',{class:'chips'},['quests','journal','codex','factions'].map(t=>el('button',{class:'chip'+(tab===t?' on':''),id:'jt-'+t,onclick:()=>{ tab=t; draw(); }},t[0].toUpperCase()+t.slice(1)))));
    if(tab==='quests'){ const ch=STORY[G.story.ch]; body.appendChild(el('div',{class:'card'},el('b',null,'Main quest'),el('p',null,G.story.done.length>=STORY.length?'The Pale Throne is broken.':'Chapter '+(G.story.ch+1)+': '+ch.n+' — '+REGIONS[ch.region].n),el('p',{class:'small'},STORY.filter(s=>G.story.done.includes(s.id)).map(s=>'✔ '+s.n).join(' · '))));
      G.quests.active.forEach(q=>{ const d=SIDE_QUESTS[q.id]; body.appendChild(el('div',{class:'card'},el('b',null,d.n+' ('+q.progress+'/'+d.count+')'),el('p',{class:'small'},d.d))); });
      if(G.quests.done.length) body.appendChild(el('p',{class:'small'},'Completed: '+G.quests.done.map(q=>SIDE_QUESTS[q].n).join(', '))); }
    if(tab==='journal') body.appendChild(el('div',{class:'col'},G.journal.slice(0,80).map(j=>el('div',{class:'small'},'Day '+j.day+': '+j.t))));
    if(tab==='codex'){ const cats={}; G.codex.forEach(id=>{ const c=CODEX[id]; (cats[c.cat]=cats[c.cat]||[]).push(c); }); body.appendChild(el('p',{class:'small'},G.codex.length+'/'+Object.keys(CODEX).length+' entries'));
      for(const k in cats){ body.appendChild(el('h3',null,k)); cats[k].forEach(c=>body.appendChild(el('details',null,el('summary',null,c.n),el('p',null,c.t)))); } }
    if(tab==='factions') body.appendChild(el('div',{class:'col'},Object.keys(FACTIONS).map(f=>el('div',{class:'card'},el('b',null,FACTIONS[f].n+' — '+repTier(G.rep[f]||0)+' ('+(G.rep[f]||0)+')'),el('p',{class:'small'},FACTIONS[f].d))))); };
  draw(); UI.modal('Journal',body,{wide:true}); };
UI.credits=function(){ UI.modal('Credits & License',el('div',{class:'story'},
  el('p',null,el('b',null,'The Last Lantern'),' — an original gothic dungeon crawler. Setting, names, story and characters are original.'),
  el('p',null,'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'),
  el('p',null,'Rules implemented here are adapted and simplified from the SRD 5.1. Some subclasses, feats, backgrounds, monsters and items are original creations in the spirit of the SRD.'),
  el('p',null,el('b',null,'Original class: '),'The Necromancer — its Gravecaller and Reaper subclasses, all its class features, the bound-minion rules, and the spells Marrow Rot, Call the Restless, Siphon Soul and Ossuary Burst — is original content for this game and is not part of the SRD 5.1. It reuses SRD-style mechanics and some SRD spells (e.g. Chill Touch, False Life, Inflict Wounds, Blindness/Deafness, Vampiric Touch, Blight) and SRD monster statistics (Skeleton, Zombie, Ghoul) for its risen minions.'),
  el('p',null,el('b',null,'✧ Arcana Experimental: '),typeof ARCANA_CREDIT!=='undefined'?ARCANA_CREDIT:''),
  el('p',null,'Not affiliated with, endorsed or sponsored by Wizards of the Coast, Fantasy Flight Games, or the Descent / Terrinoth properties. Visual style is inspired by tabletop dungeon crawlers in general; no protected content is used.'),
  el('p',null,'Art: AI-generated painted illustrations (including all hero portraits) and procedural canvas rendering made for this game.')),{wide:true}); };
