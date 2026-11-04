// ===== UI core: DOM helpers, modals, HUD, combat controls =====
function el(tag,attrs,...kids){ const e=document.createElement(tag); if(attrs) for(const k in attrs){ const v=attrs[k]; if(v==null||v===false) continue; if(k==='class') e.className=v; else if(k==='style'&&typeof v==='object') Object.assign(e.style,v); else if(k.startsWith('on')) e.addEventListener(k.slice(2),v); else if(k==='html') e.innerHTML=v; else e.setAttribute(k,v===true?'':v); }
  for(const c of kids.flat(3)){ if(c==null||c===false) continue; e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(String(c)):c); } return e; }
const $=s=>document.querySelector(s);
function portraitEl(c,size,cls){ const dpr=Math.min(2,window.devicePixelRatio||1); const px=Math.round(size*(c.isHero?dpr:1)); const cv=el('canvas',{class:cls||'portrait',width:px,height:px,style:c.isHero&&!/\bbig\b/.test(cls||'')?{width:size+'px',height:size+'px'}:null}); const fr=/\bbig\b/.test(cls||''); const src=c.isHero?heroPortrait(c,px,fr):monsterPortrait(MONSTERS[c.mid]||c,size); if(src) cv.getContext('2d').drawImage(src,0,0,px,px); if(c.isHero){ const pid=heroPortraitId(c); if(!portraitReady(pid)) portraitImg(pid).addEventListener('load',()=>{ const s2=heroPortrait(c,px,fr); const g=cv.getContext('2d'); g.clearRect(0,0,px,px); g.drawImage(s2,0,0,px,px); },{once:true}); return cv; } else { const im=R.imgs[(MONSTERS[c.mid]||{}).art]; if(im) im.addEventListener('load',()=>{ const s2=monsterPortrait(MONSTERS[c.mid],size); if(s2) cv.getContext('2d').drawImage(s2,0,0); },{once:true}); } return cv; }
function btn(label,fn,cls,attrs){ return el('button',Object.assign({class:'btn '+(cls||''),onclick:e=>{ e.stopPropagation(); fn&&fn(e); }},attrs||{}),label); }
function rarSpan(it){ return el('span',{class:'iname',style:{color:RARITY[it.rar||'common'].c}},itemName(it)+((it.qty||1)>1?' ×'+it.qty:'')); }
const UI={ targeting:null, logOpen:false,
  // ---------- modals ----------
  modal(title,body,opts){ opts=opts||{}; return new Promise(res=>{ const wrap=el('div',{class:'modal-wrap'+(opts.wide?' wide':'')}); const close=v=>{ wrap.remove(); res(v); };
      const m=el('div',{class:'modal'},el('div',{class:'mhead'},el('h2',null,title),opts.noClose?null:btn('✕',()=>close(null),'x')),el('div',{class:'mbody'},body),opts.buttons?el('div',{class:'mfoot'},opts.buttons.map(b=>btn(b.t,()=>{ if(b.fn){ const r=b.fn(); if(r===false) return; } close(b.v); },b.cls))):null);
      wrap.appendChild(m); wrap.addEventListener('click',e=>{ if(e.target===wrap&&!opts.noClose) close(null); }); document.getElementById('modals').appendChild(wrap); UI._close=close; if(opts.onOpen) opts.onOpen(m,close); }); },
  choice(title,text,options,art){ if(G.autoChoice){ const v=typeof G.autoChoice==='function'?G.autoChoice(title,options):options.filter(o=>!o.dis)[0].v; return Promise.resolve(v); } return new Promise(res=>{ const body=el('div',{class:'choice'},art?el('img',{class:'chart',src:'assets/m_'+art+'.jpg'}):null,el('p',{class:'ctext'},text),el('div',{class:'copts'},options.map(o=>btn(o.t,()=>{ wrap.remove(); res(o.v); },'opt'+(o.dis?' dis':''),o.dis?{disabled:true}:null))));
      const wrap=el('div',{class:'modal-wrap'},el('div',{class:'modal'},el('div',{class:'mhead'},el('h2',null,title)),el('div',{class:'mbody'},body))); document.getElementById('modals').appendChild(wrap); }); },
  // ---------- visual-novel dialogue (talk to an NPC) ----------
  // One persistent full-bleed scene per NPC: backdrop + portrait + parchment panel. Reused across dialogue nodes (no flicker); removed by closeVN / showScreen.
  dialogue(id,text,options){ if(G.autoChoice){ const v=typeof G.autoChoice==='function'?G.autoChoice(NPCS[id].n,options):options.filter(o=>!o.dis)[0].v; return Promise.resolve(v); }
    const n=NPCS[id]; const loc=(typeof NPC_ART!=='undefined'&&NPC_ART[id])||null; const host=document.getElementById('modals');
    let w=document.getElementById('vn'); if(w&&w.dataset.npc!==id){ w.remove(); w=null; }
    if(!w){ const fb=el('div',{class:'vnav',style:{background:n.col||'#553'}},n.n[0]);
      const img=el('img',{class:'vnpimg',alt:n.n,decoding:'async',loading:'lazy',src:npcPortraitSrc(id),onerror:()=>{ img.remove(); fig.classList.add('noimg'); fig.appendChild(fb); },onload:()=>fig.classList.add('ok')});
      const fig=el('div',{class:'vnfig'},img);
      w=el('div',{id:'vn',class:'vn-wrap loc-'+(loc||'none'),'data-npc':id,style:locBgStyle(loc)},el('div',{class:'vnbg'}),fig,
        el('div',{class:'vnpanel'},el('div',{class:'vnname'},el('b',null,n.n),el('span',{class:'vnrole'},n.role||'')),el('div',{class:'vntext'}),el('div',{class:'vnopts'})));
      host.insertBefore(w,host.firstChild); }
    else w.classList.remove('busy');
    const tx=w.querySelector('.vntext'); tx.textContent=text; tx.classList.remove('in'); void tx.offsetWidth; tx.classList.add('in'); tx.scrollTop=0;
    const ob=w.querySelector('.vnopts'); ob.innerHTML='';
    return new Promise(res=>{ options.forEach(o=>ob.appendChild(btn(o.t,()=>{ if(w.classList.contains('busy')) return; w.classList.add('busy'); res(o.v); },'opt vnopt'+(o.dis?' dis':''),o.dis?{disabled:true}:null))); }); },
  closeVN(){ const w=document.getElementById('vn'); if(w) w.remove(); },
  closeAll(){ document.getElementById('modals').innerHTML=''; },
  story(title,text){ return UI.modal(title,el('div',{class:'story'},String(text).split('\n').map(p=>el('p',null,p))),{buttons:[{t:'Continue',v:1}]}); },
  toast(msg){ const t=el('div',{class:'toast'},msg); document.getElementById('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),G.fast?50:2600); setTimeout(()=>t.remove(),G.fast?100:3200); },
  roll(txt,kind){ const d=document.getElementById('dice'); if(!d) return; d.className='dice show '+(kind||''); d.innerHTML=''; d.appendChild(el('span',{class:'d20'},'🎲')); d.appendChild(el('span',null,txt)); clearTimeout(UI._rt); UI._rt=setTimeout(()=>d.className='dice',G.fast?200:2600); },
  addLog(msg,cls){ const L=document.getElementById('logbody'); if(!L) return; L.appendChild(el('div',{class:'ll '+(cls||'')},msg)); while(L.childNodes.length>120) L.removeChild(L.firstChild); L.scrollTop=L.scrollHeight; const last=document.getElementById('loglast'); if(last) last.textContent=msg; },
  // ---------- dungeon HUD ----------
  showDungeon(){ G.screen='dungeon'; document.getElementById('screen').classList.add('hidden'); document.getElementById('hud').classList.remove('hidden'); document.getElementById('cv').classList.remove('hidden'); resizeCanvas(); UI.refreshParty(); UI.exploreBar(); UI.refreshTop(); R.dirty=true; document.getElementById('logbody').innerHTML=''; (G.run.log||[]).slice(-30).forEach(l=>UI.addLog(l.t,l.c)); },
  refreshTop(){ const t=document.getElementById('floorinfo'); if(!t||!G.run) return; t.textContent=G.run.name+' · Floor '+G.run.floor+'/'+G.run.floors+' · 💰'+G.run.gold; },
  refreshParty(){ if(!G.run) return; const s=document.getElementById('party'); if(!s) return; s.innerHTML='';
    for(const h of activeParty()){ const max=heroMaxHP(h); const pct=clamp(h.hp/max,0,1); const cur=G.combat&&G.combat.cur===h; const lead=!G.combat&&G.run.leader===h.id;
      const c=el('div',{class:'pcard'+(cur?' cur':'')+(lead?' lead':'')+(h.hp<=0?' down':'')+(h.status==='fallen'?' fallen':''),onclick:()=>{ if(!G.combat&&h.status!=='fallen'){ G.run.leader=h.id; UI.refreshParty(); centerOn(h.x,h.y); R.dirty=true; } else UI.sheet(h); },ondblclick:()=>UI.sheet(h)},
        portraitEl(h,44,'pp'),el('div',{class:'pinfo'},el('div',{class:'pn'},h.name.split(' ')[0]+(canLevel(h)?' ⬆':'')),el('div',{class:'hpbar'},el('div',{class:'hpfill',style:{width:(pct*100)+'%',background:pct>0.5?'#5a9a3a':pct>0.25?'#c9a227':'#a32020'}})),el('div',{class:'hpt'},h.status==='fallen'?'FALLEN':h.hp<=0?('☠ '+h.deathS.s+'✓ '+h.deathS.f+'✗'):(h.hp+'/'+max+(h.tempHp?' +'+h.tempHp:'')+' · AC '+cAC(h)))));
      c.appendChild(btn('📜',()=>UI.sheet(h),'mini')); s.appendChild(c); }
    UI.refreshTop(); if(G.combat&&G.combat.cur&&G.combat.cur.isHero&&G.combat.endTurn) UI.combatBar(G.combat.cur); },
  exploreBar(){ const b=document.getElementById('actions'); b.innerHTML=''; const sneak=G.run.sneak;
    const add=(ic,t,fn,cls,id)=>b.appendChild(el('button',{class:'abtn '+(cls||''),id:id||null,onclick:e=>{ e.stopPropagation(); fn(); }},el('span',{class:'ai'},ic),el('span',{class:'al'},t)));
    add(sneak?'🌑':'👣',sneak?'Sneaking':'Sneak',()=>{ G.run.sneak=!G.run.sneak; toast(G.run.sneak?'Sneaking: the party moves quietly (group Stealth vs passive Perception).':'Walking normally.'); UI.exploreBar(); },sneak?'on':'','b-sneak');
    add('🔍','Search',()=>searchArea(),'','b-search');
    add('🔥','Rest',()=>shortRest(),'','b-rest');
    add('✨','Spells',()=>UI.exploreSpells(),'','b-spells');
    add('🎒','Pack',()=>UI.inventory(),'','b-pack');
    add('📖','Journal',()=>UI.journal(),'','b-journal');
    add('☰','Menu',()=>UI.dungeonMenu(),'','b-menu'); },
  dungeonMenu(){ UI.modal('Menu',el('div',{class:'col'},
      btn('💾 Save game',()=>{ saveGame(); toast('Saved.'); }),btn('📤 Export save file',()=>exportSave()),
      btn('🔍 Zoom in',()=>{ R.cam.z=clamp(R.cam.z*1.25,0.45,2.6); R.dirty=true; }),btn('🔎 Zoom out',()=>{ R.cam.z=clamp(R.cam.z/1.25,0.45,2.6); R.dirty=true; }),
      btn('🎯 Center on party',()=>{ const L=leader(); if(L) centerOn(L.x,L.y); }),
      btn('📜 Credits & License',()=>UI.credits()),
      btn('🏚 Abandon expedition (return to tavern)',async()=>{ UI.closeAll(); const ok=await UI.choice('Abandon?','Flee back to the Last Lantern? You keep what you carry.',[{t:'Flee home',v:'y'},{t:'Stay',v:'n'}]); if(ok==='y'){ if(G.combat){ toast('You cannot flee mid-combat without a Writ of Return.'); return; } returnToTavern(false); } },'danger')),{}); },
  exploreSpells(){ const party=activeParty().filter(h=>alive(h)&&h.x!=null); const rows=[];
    for(const h of party){ const list=[...heroCantrips(h),...heroSpells(h)].filter(s=>SPELLS[s]&&(SPELLS[s].ooc||SPELLS[s].heal||['findtraps','knock','light','detectmagic','identify','longstrider','magearmor','aid','passtrace','guidance','lesserrest','greaterrest','removecurse','revivify','daylight','falselife','invis','enhance','freedom','deathward','teleport','stabilize'].includes(SPELLS[s].fx)));
      if(!list.length) continue; rows.push(el('h3',null,h.name+' · slots '+slotTxt(h)));
      rows.push(el('div',{class:'grid2'},list.map(s=>{ const sp=SPELLS[s]; const ok=sp.l===0||hasSlot(h,sp.l); return btn((sp.l?'L'+sp.l+' ':'◦ ')+sp.n,async()=>{ UI.closeAll(); await UI.castOutOfCombat(h,s); },ok?'':'dis',ok?{title:sp.d}:{disabled:true}); }))); }
    if(!rows.length) rows.push(el('p',null,'No one in the party knows utility or healing spells usable outside combat.'));
    UI.modal('Cast a spell (exploration)',el('div',null,rows),{wide:true}); },
  async castOutOfCombat(h,s){ const sp=SPELLS[s]; let t=null,px=null,py=null; const tk=spellTargetsValid(h,sp);
    if(tk==='ally'||tk==='any'||(tk==='enemy'&&sp.heal)){ t=await UI.pickHero('Target for '+sp.n,activeParty().filter(x=>x.status!=='fallen'||sp.fx==='revivify')); if(!t) return; if(dist(t,h)>Math.max(1,sp.r)&&sp.r<=1){ /* touch: walk adjacent automatically */ } }
    else if(tk==='point'){ toast('Use this spell in combat or tap a target tile.'); if(sp.fx!=='teleport') return; }
    else if(tk==='enemy'){ toast('No enemies in sight.'); return; }
    let slot=sp.l; if(sp.l>0){ slot=lowestSlot(h,sp.l); if(!slot){ toast('No spell slots.'); return; } }
    await castSpell(h,s,slot,t||h,px,py); UI.refreshParty(); },
  pickHero(title,list){ return new Promise(res=>{ const body=el('div',{class:'grid2'},list.map(h=>btn(el('span',null,portraitEl(h,32,'pp'),' '+h.name+' ('+Math.max(0,h.hp)+'/'+heroMaxHP(h)+')'),()=>{ wrap.remove(); res(h); },'opt')),btn('Cancel',()=>{ wrap.remove(); res(null); },'opt')); const wrap=el('div',{class:'modal-wrap'},el('div',{class:'modal'},el('div',{class:'mhead'},el('h2',null,title)),el('div',{class:'mbody'},body))); document.getElementById('modals').appendChild(wrap); }); },
  // ---------- combat ----------
  enterCombat(){ document.getElementById('hud').classList.add('combat'); UI.refreshInit(); UI.refreshParty(); const b=document.getElementById('actions'); b.innerHTML=''; b.appendChild(el('div',{class:'wait'},'⚔ Combat begins...')); },
  exitCombat(){ document.getElementById('hud').classList.remove('combat'); const i=document.getElementById('init'); if(i) i.innerHTML=''; UI.clearTargeting(); R.hl.reach=null; R.hl.targets=null; if(G.run&&G.screen==='dungeon') UI.exploreBar(); UI.refreshParty(); },
  refreshInit(){ const i=document.getElementById('init'); if(!i||!G.combat) return; i.innerHTML=''; i.appendChild(el('span',{class:'rnd'},'R'+Math.max(1,G.combat.round)));
    for(const c of G.combat.order){ if(!c.isHero&&c.hp<=0) continue; const e=el('div',{class:'ini'+(G.combat.cur===c?' cur':'')+(c.isHero?' hero':c.ally?' hero ally':' foe'),onclick:()=>{ if(c.x!=null) centerOn(c.x,c.y); UI.inspect(c); }},portraitEl(c,30,'ip'),el('div',{class:'ihp',style:{width:(clamp(c.hp/cMaxHP(c),0,1)*100)+'%'}})); i.appendChild(e); } },
  inspect(c){ if(c.isHero){ UI.sheet(c); return; } const md=mdef(c); const known=G.bestiary&&G.bestiary[md.id];
    const fx=(c.fx||[]).map(f=>f.id).join(', ');
    UI.modal(md.n,el('div',{class:'inspect'},portraitEl(c,96,'big'),el('div',null,el('p',null,md.type+' · CR '+md.cr+(md.size?' · '+md.size:'')),el('p',null,'HP '+c.hp+'/'+c.hpMax+' · AC '+cAC(c)+' · Speed '+md.spd+' ft'),el('p',null,'Attacks: '+md.atks.map(a=>a.n+' (+'+a.hit+', '+a.dmg+' '+a.dt+')').join('; ')),
      md.resist?el('p',null,'Resists: '+md.resist.join(', ')):null,md.immune?el('p',null,'Immune: '+md.immune.join(', ')):null,md.vuln?el('p',null,'Vulnerable: '+md.vuln.join(', ')):null,(md.traits||[]).length?el('p',null,'Traits: '+md.traits.join(', ')):null,fx?el('p',null,'Conditions: '+fx):null))); },
  heroTurn(h){ UI.refreshParty(); UI.refreshInit(); UI.combatBar(h); },
  combatBar(h){ const C=G.combat, ts=C.ts; const b=document.getElementById('actions'); b.innerHTML='';
    // reach highlight
    const map=G.run.map; const B=bfs(map,h.x,h.y,Math.max(0,ts.move),heroBlocked(h)); R.hl.reach=new Set([...B.dist.keys()].filter(k=>B.dist.get(k)>0)); UI._reach=B;
    const foes=enemiesOf(h).filter(alive); const opts=heroAttackOptions(h); const canAtk=ts.action>0||ts.attacksLeft>0;
    R.hl.targets=new Set(foes.filter(f=>opts.some(p=>inRange(h,f,p)))); R.dirty=true;
    const status=el('div',{class:'tstat'},el('b',null,h.name),el('span',null,'Move '+ts.move+(ts.attacksLeft?' · Attacks '+ts.attacksLeft:'')),el('span',{class:'pips'},el('i',{class:ts.action>0?'on':''},'A'),el('i',{class:ts.bonus>0?'on':''},'B'),el('i',{class:h.reaction?'on':''},'R')));
    b.appendChild(status);
    const add=(ic,t,fn,ok,id,tip)=>b.appendChild(el('button',{class:'abtn'+(ok?'':' dis'),id:id||null,title:tip||'',onclick:e=>{ e.stopPropagation(); if(ok) fn(); }},el('span',{class:'ai'},ic),el('span',{class:'al'},t)));
    opts.forEach((p,i)=>add(p.melee?'⚔':'🏹',p.n.length>14?p.n.slice(0,13)+'…':p.n,()=>UI.beginTarget({kind:'attack',p,h}),canAtk,'b-atk'+i,'+'+p.hit+' to hit, '+p.dmg+(p.dmgB?fmtMod(p.dmgB):'')+' '+p.dt));
    if(canOffhand(h)&&ts.attacked&&ts.bonus>0) add('🗡','Off-hand',()=>UI.beginTarget({kind:'offhand',h,p:weaponProfile(h,h.eq.off,'off')}),true,'b-off');
    if(hasFx(h,'frenzy')&&ts.attacked&&ts.bonus>0) add('🩸','Frenzy',()=>UI.beginTarget({kind:'frenzy',h,p:opts[0]}),true);
    const spells=[...heroCantrips(h),...heroSpells(h)].filter(s=>SPELLS[s]); if(spells.length) add('✨','Spells',()=>UI.spellMenu(h),ts.action>0||ts.bonus>0,'b-spells');
    const feats=featActions(h).filter(f=>f.cost!=='reaction'); if(feats.length) add('⚜','Abilities',()=>UI.featMenu(h,feats),true,'b-feats');
    const wands=equippedItems(h).filter(i=>i.kind==='wand'&&i.charges>0); wands.forEach(w=>add('🪄',MAGIC[w.magic].n.split(' ').slice(-1)[0],()=>{ h._wandCast={dc:MAGIC[w.magic].dc,item:w}; w.charges--; UI.beginSpell(h,MAGIC[w.magic].cast,SPELLS[MAGIC[w.magic].cast].l,true); },ts.action>0));
    add('🧪','Items',()=>UI.itemMenu(h),ts.action>0||(heroFeatures(h).has('fastHands')&&ts.bonus>0),'b-items');
    add('🛡','Dodge',()=>{ doDodge(h); UI.combatBar(h); },ts.action>0,'b-dodge');
    add('💨','Dash',()=>{ doDash(h); UI.combatBar(h); },ts.action>0,'b-dash');
    add('↩','Disengage',()=>{ doDisengage(h); UI.combatBar(h); },ts.action>0,'b-dis');
    add('🤝','Help',()=>UI.beginTarget({kind:'help',h}),ts.action>0,'b-help');
    add('🌑','Hide',()=>{ ts.action--; heroHide(h); UI.combatBar(h); },ts.action>0,'b-hide');
    const tog=h.tog=h.tog||{}; const F=heroFeatures(h);
    if(F.has('reckless')) add(tog.reckless?'☑':'☐','Reckless',()=>{ tog.reckless=!tog.reckless; UI.combatBar(h); },true);
    if(hasFeat(h,'cleaver')||hasFeat(h,'deadeye')) add(tog.power?'☑':'☐','Power -5/+10',()=>{ tog.power=!tog.power; UI.combatBar(h); },true);
    if(F.has('smite')) add(tog.smite?'☑':'☐','Smite next',()=>{ tog.smite=!tog.smite; UI.combatBar(h); },hasSlot(h,1),'b-smite');
    if(F.has('stunning')) add(tog.stun?'☑':'☐','Stun (1 ki)',()=>{ tog.stun=!tog.stun; UI.combatBar(h); },h.res.ki>0);
    if(F.has('metamagic')) add(tog.empower?'☑':'☐','Empower (1sp)',()=>{ if(!tog.empower&&h.res.sp>0){ h.res.sp--; tog.empower=true; } else if(tog.empower){ tog.empower=false; h.res.sp++; } UI.combatBar(h); },h.res.sp>0||tog.empower);
    add('🤖','Auto',async()=>{ UI.clearTargeting(); b.innerHTML=''; await autoHeroTurn(h); endHeroTurn(); },true,'b-auto');
    add('⏭','End Turn',()=>endHeroTurn(),true,'b-end'); },
  clearTargeting(){ UI.targeting=null; R.hl.area=null; R.hl.sel=null; R.dirty=true; const t=document.getElementById('tgthint'); if(t) t.classList.add('hidden'); },
  hint(msg){ const t=document.getElementById('tgthint'); t.innerHTML=''; t.appendChild(el('span',null,msg)); t.appendChild(btn('Cancel',()=>{ UI.clearTargeting(); if(G.combat&&G.combat.cur&&G.combat.cur.isHero) UI.combatBar(G.combat.cur); },'mini')); t.classList.remove('hidden'); },
  beginTarget(t){ const h=t.h; UI.targeting=t; let valid=[];
    if(t.kind==='attack'||t.kind==='offhand'||t.kind==='frenzy') valid=enemiesOf(h).filter(f=>alive(f)&&inRange(h,f,t.p));
    else if(t.kind==='help') valid=allies(h).filter(a=>a!==h&&dist(a,h)<=1);
    t.valid=valid; R.hl.targets=new Set(valid); R.dirty=true;
    if(!valid.length&&(t.kind==='attack'||t.kind==='offhand'||t.kind==='frenzy')){ UI.hint('No target in range — tap an enemy to move closer & attack.'); return; }
    UI.hint(t.kind==='help'?'Tap an adjacent ally to help.':'Tap a highlighted enemy to attack with '+t.p.n+'.'); if(valid.length===1&&G.autoTarget) UI.targetTap(valid[0].x,valid[0].y); },
  async targetTap(tx,ty){ const t=UI.targeting; if(!t) return; const h=t.h; const map=G.run.map;
    const at=[...activeParty(),...map.ents.filter(e=>e.type==='mon'&&e.hp>0)].find(c=>c.x===tx&&c.y===ty&&(c.isHero?c.status!=='fallen':true));
    if(t.kind==='attack'||t.kind==='offhand'||t.kind==='frenzy'){ if(!at||at.isHero) return; if(!t.valid.includes(at)){ if(t.p.melee&&G.combat.ts.move>0){ const ok=await UI.moveAdjacent(h,at,t.p.reach); if(!ok||!inRange(h,at,t.p)){ toast('Out of reach.'); return; } } else { toast('Out of range.'); return; } }
      UI.clearTargeting(); document.getElementById('actions').innerHTML=''; if(t.kind==='attack') await heroAttack(h,at,t.p); else if(t.kind==='offhand') await offhandAttack(h,at); else await frenzyAttack(h,at); UI.afterAction(h); return; }
    if(t.kind==='help'){ if(!at||!at.isHero||!t.valid.includes(at)) return; UI.clearTargeting(); doHelp(h,at); UI.afterAction(h); return; }
    if(t.kind==='spell'||t.kind==='feat'||t.kind==='item'){ const tg=t.tg; let target=null; 
      if(tg==='enemy'){ if(!at||!isFoe(h,at)) { toast('Tap an enemy.'); return; } target=at; }
      else if(tg==='ally'){ if(!at||!at.isHero) { toast('Tap an ally.'); return; } target=at; }
      else if(tg==='any'){ if(!at){ toast('Tap a creature.'); return; } target=at; }
      if(t.range!=null&&tg!=='point'&&dist2(h.x,h.y,tx,ty)>Math.max(1,t.range)){ toast('Out of range ('+t.range*5+' ft).'); return; }
      if(tg!=='point'&&target&&!target.isHero&&!los(map,h.x,h.y,tx,ty)){ toast('No line of sight.'); return; }
      if(tg==='point'){ if(dist2(h.x,h.y,tx,ty)>Math.max(1,t.range||12)){ toast('Out of range.'); return; } if(t.area){ const tiles=t.area.sh==='self'?areaTiles({area:t.area},h):areaTiles({area:t.area},h,tx,ty); const key=tx+','+ty; if(UI._areaKey!==key){ UI._areaKey=key; R.hl.area=new Set(tiles.map(([x,y])=>y*map.w+x)); R.dirty=true; UI.hint('Tap again to confirm '+(t.label||'')+' here ('+creaturesIn(tiles).length+' creatures).'); return; } UI._areaKey=null; } }
      UI.clearTargeting(); document.getElementById('actions').innerHTML=''; await t.go(target,tx,ty); UI.afterAction(h); } },
  async moveAdjacent(h,t,reach){ const B=UI._reach||bfs(G.run.map,h.x,h.y,G.combat.ts.move,heroBlocked(h)); const map=G.run.map; let best=null,bd=1e9; for(const [k,d] of B.dist){ const x=k%map.w,y=(k/map.w)|0; if(dist2(x,y,t.x,t.y)<=reach&&d<=G.combat.ts.move&&d<bd){ bd=d; best=[x,y]; } } if(!best) return false; if(best[0]===h.x&&best[1]===h.y) return true; const path=B.path(best[0],best[1]); UI.clearTargeting(); document.getElementById('actions').innerHTML=''; await moveAlong(h,path); return alive(h)&&!!G.combat; },
  afterAction(h){ if(!G.combat||G.combat.cur!==h||!G.combat.endTurn) return; if(!alive(h)){ endHeroTurn(); return; } UI.combatBar(h); UI.refreshParty(); UI.refreshInit(); const ts=G.combat.ts; if(G.settings.autoEnd&&ts.action<=0&&ts.attacksLeft<=0&&ts.bonus<=0&&ts.move<=0) endHeroTurn(); },
  spellMenu(h){ const ts=G.combat.ts; const list=[...heroCantrips(h),...heroSpells(h)].filter(s=>SPELLS[s]); const rows=list.map(s=>{ const sp=SPELLS[s]; const cost=sp.t==='b'?'bonus':sp.t==='r'?'reaction':'action'; const can=(cost==='action'?ts.action>0:cost==='bonus'?ts.bonus>0:false)&&(sp.l===0||hasSlot(h,sp.l))&&(sp.fx!=='ossuary'||minionsOf(h).length>0);
      return el('div',{class:'srow'+(can?'':' dis')},btn((sp.l?'L'+sp.l:'◦')+' '+sp.n,()=>{ UI.closeAll(); UI.chooseSlot(h,s); },'opt',can?null:{disabled:true}),el('div',{class:'sd'},(cost==='bonus'?'[Bonus] ':cost==='reaction'?'[Reaction] ':'')+(sp.conc?'[Conc] ':'')+sp.d)); });
    UI.modal('Spells — '+h.name+' · DC '+spellDC(h)+' · Atk '+fmtMod(spellAtk(h))+' · Slots '+slotTxt(h),el('div',{class:'slist'},rows),{wide:true}); },
  chooseSlot(h,s){ const sp=SPELLS[s]; if(sp.l===0||!sp.up&&!['bless','bane','sleep','colorspray','missile','aid','rays','spiritweapon','falselife','raiseMinion'].includes(sp.fx)&&!sp.heal&&!sp.up){ UI.beginSpell(h,s,sp.l?lowestSlot(h,sp.l):0); return; }
    const opts=[]; for(let l=sp.l;l<=5;l++) if((h.slots[l]||0)>0) opts.push({t:'Level '+l+' slot ('+h.slots[l]+' left)',v:l}); if(opts.length===1){ UI.beginSpell(h,s,opts[0].v); return; }
    UI.choice(sp.n,'Cast with which slot? Higher slots strengthen the spell.',[...opts,{t:'Cancel',v:null}]).then(l=>{ if(l) UI.beginSpell(h,s,l); }); },
  beginSpell(h,s,slot,wand){ const sp=SPELLS[s]; const tk=spellTargetsValid(h,sp); const ts=G.combat.ts; const spend=()=>{ if(sp.t==='b') ts.bonus--; else ts.action--; };
    const go=async(t,x,y)=>{ spend(); await castSpell(h,s,slot,t,x,y); checkCombatEnd(); };
    if(tk==='self'){ document.getElementById('actions').innerHTML=''; (async()=>{ await go(h,h.x,h.y); UI.afterAction(h); })(); return; }
    UI.targeting={kind:'spell',h,tg:tk==='point'?'point':tk,range:sp.r,area:sp.area,label:sp.n,go};
    const valid=tk==='enemy'?enemiesOf(h).filter(e=>alive(e)&&dist(e,h)<=Math.max(1,sp.r)&&los(G.run.map,h.x,h.y,e.x,e.y)):tk==='ally'?allies(h).filter(a=>dist(a,h)<=Math.max(1,sp.r)):[];
    R.hl.targets=new Set(valid); R.dirty=true; UI.hint(tk==='point'?'Tap where to cast '+sp.n+' (range '+sp.r*5+' ft).':tk==='ally'?'Tap an ally for '+sp.n+'.':'Tap a target for '+sp.n+'.'); },
  featMenu(h,feats){ const ts=G.combat.ts; UI.modal('Abilities — '+h.name,el('div',{class:'slist'},feats.map(f=>{ const can=f.usable&&(f.cost==='action'?ts.action>0:f.cost==='bonus'?ts.bonus>0:true);
      return el('div',{class:'srow'+(can?'':' dis')},btn(f.n+(f.left!=null?' ('+f.left+')':''),()=>{ UI.closeAll(); UI.beginFeat(h,f); },'opt',can?null:{disabled:true}),el('div',{class:'sd'},'['+f.cost+'] '+(f.d||(FEATURES[f.id]||{}).d||''))); })),{wide:true}); },
  beginFeat(h,f){ const go=async(t,x,y)=>{ await useFeat(h,f.id,t,x,y); }; if(f.tg==='self'||f.tg==='none'){ document.getElementById('actions').innerHTML=''; (async()=>{ await go(h); UI.afterAction(h); })(); return; }
    UI.targeting={kind:'feat',h,tg:f.tg,range:f.range,area:f.id==='breath'?{sh:'cone',sz:3}:null,label:f.n,go}; UI.hint('Choose a target for '+f.n+'.'); },
  itemMenu(h){ const items=G.run.pack.filter(i=>GEAR[i.base]&&GEAR[i.base].use||i.kind==='scroll'&&i.spell); if(!items.length){ toast('Nothing usable in the pack.'); return; }
    UI.modal('Use an item',el('div',{class:'slist'},items.map(it=>el('div',{class:'srow'},btn(itemName(it)+((it.qty||1)>1?' ×'+it.qty:''),()=>{ UI.closeAll(); UI.beginItem(h,it); },'opt'),el('div',{class:'sd'},itemDesc(it)))))); },
  beginItem(h,it){ if(it.kind==='scroll'&&it.spell){ const sp=SPELLS[it.spell]; const cls=getClass(h.cls); const L=cls.list; if(!(L&&sp.c.includes(L))&&!heroFeatures(h).has('magicSecrets')){ const r=skillCheck(h,'arcana',10+sp.l); log(r.txt); if(!r.ok){ consumeItem(it); G.combat.ts.action--; log('The scroll crumbles uselessly.','bad'); UI.afterAction(h); return; } }
      h._freeCast=true; consumeItem(it); UI.beginSpell(h,it.spell,sp.l); return; }
    const u=GEAR[it.base].use; if(u.throwDmg){ UI.targeting={kind:'item',h,tg:'enemy',range:4,go:async t=>{ await useItemCombat(h,it,t); }}; UI.hint('Tap an enemy to throw '+GEAR[it.base].n+'.'); return; }
    if(u.fx==='return'||u.fx==='torch'){ (async()=>{ await useItemCombat(h,it,h); UI.afterAction(h); })(); return; }
    UI.targeting={kind:'item',h,tg:'ally',range:1,go:async t=>{ await useItemCombat(h,it,t); }}; R.hl.targets=new Set(allies(h).filter(a=>dist(a,h)<=1)); R.dirty=true; UI.hint('Tap yourself or an adjacent ally.'); },
  // ---------- results ----------
  lootPopup(title,items,gold){ if(G.fast) return; const body=el('div',{class:'loot'},gold?el('div',{class:'gold'},'💰 '+gold+' gold'):null,items.map(it=>el('div',{class:'lrow'},rarSpan(it),el('div',{class:'sd'},itemDesc(it).split('\n')[0]))));
    UI.modal(title,body,{buttons:[{t:'Take all',v:1}]}); },
  bossVictory(){ const r=G.run; if(!r) return; const ch=r.kind==='story'?STORY[r.ref]:null; UI.story('Victory',ch?ch.outro+'\n\nReturn to the stairs up (or burn a Writ of Return) to bring word to the Last Lantern.':'The master of this place is slain.'); },
  tpkScreen(){ UI.modal('The Lantern Gutters',el('div',{class:'story'},el('p',null,'Darkness closes over the party. But the Wardens of the Last Lantern do not abandon their own: cloaked figures drag your broken bodies back to the tavern.'),el('p',null,'No one is lost forever — but every hero will carry scars, and half your gold and your pack are gone.')),{noClose:true,buttons:[{t:'Return to the tavern',v:1,fn:()=>{ returnToTavern(false); }}]}); },
  returnSummary(s){ if(G.fast) return; UI.modal('Back at the Last Lantern',el('div',{class:'story'},el('p',null,'Gold: '+s.gold+' · Items: '+s.items+' · XP earned: '+s.xp+' · Foes slain: '+s.kills),s.lines.map(l=>el('p',null,l))),{buttons:[{t:'Continue',v:1}]}).then(()=>{ if(G._pendingOutro){ const ch=G._pendingOutro; G._pendingOutro=null; const nx=STORY[STORY.indexOf(ch)+1]; UI.story(ch.n+' — Complete',ch.outro+(nx?'\n\nNext: '+nx.n+'. Find it on the World Map.':'\n\nThe Pale Throne is broken. The Night begins, slowly, to lift. (You may keep exploring the realm.)')); } }); },
};
function slotTxt(h){ const s=h.slots||[]; const m=slotMax(h); const parts=[]; for(let l=1;l<=5;l++) if(m[l]) parts.push('L'+l+':'+(s[l]||0)+'/'+m[l]); return parts.join(' ')||'—'; }
// combat taps on the map when no targeting mode is active
async function combatTap(h,tx,ty){ const map=G.run.map; const foe=map.ents.find(e=>e.type==='mon'&&!e.ally&&e.hp>0&&e.inCombat&&e.x===tx&&e.y===ty); const minion=map.ents.find(e=>e.ally&&e.hp>0&&e.x===tx&&e.y===ty); if(minion&&!foe){ UI.inspect(minion); return; }
  const ts=G.combat.ts;
  if(foe){ const opts=heroAttackOptions(h); const can=ts.action>0||ts.attacksLeft>0; if(!can){ UI.inspect(foe); return; }
    let p=opts.find(p=>inRange(h,foe,p)&&p.melee)||opts.find(p=>inRange(h,foe,p)); 
    if(!p){ const m=opts.find(p=>p.melee); if(m&&ts.move>0){ const ok=await UI.moveAdjacent(h,foe,m.reach); if(ok&&inRange(h,foe,m)) p=m; else { UI.afterAction(h); return; } } else { toast('Out of range.'); return; } }
    document.getElementById('actions').innerHTML=''; await heroAttack(h,foe,p); UI.afterAction(h); return; }
  const ally=activeParty().find(o=>o.x===tx&&o.y===ty); if(ally){ UI.sheet(ally); return; }
  const k=ty*map.w+tx; if(R.hl.reach&&R.hl.reach.has(k)){ const path=UI._reach.path(tx,ty); document.getElementById('actions').innerHTML=''; await moveAlong(h,path); UI.afterAction(h); } }
