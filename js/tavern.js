// ===== The Last Lantern: tavern hub & services =====
const ROSTER_CAP=[6,9,12,16];
function repDisc(f){ const v=G.rep[f]||0; return v>=50?0.25:v>=25?0.15:v>=10?0.08:0; }
function showTavern(){ G.run=null; G.combat=null; G.screen='tavern'; UI.closeAll(); const p=activeParty(); const T=G.tavern;
  const tile=(ic,t,sub,fn,id,lock)=>el('button',{class:'ttile'+(lock?' lock':''),id,onclick:()=>{ if(lock){ toast(lock); return; } fn(); }},el('span',{class:'ti'},ic),el('span',{class:'tt'},t),el('span',{class:'ts'},sub||''));
  const chap=STORY[G.story.ch]; const done=G.story.done.length>=STORY.length;
  showScreen('tavern',el('div',{class:'tav'},
    el('div',{class:'tavhead'},el('h1',null,'The Last Lantern'),el('div',{class:'res'},el('span',null,'💰 '+G.gold),el('span',null,'⭐ Renown '+G.renown),el('span',null,'☾ Day '+G.day))),
    el('div',{class:'tavparty'},p.length?p.map(h=>el('div',{class:'tp',onclick:()=>UI.sheet(h)},portraitEl(h,52,'pp'),el('div',null,el('b',null,h.name.split(' ')[0]+(canLevel(h)?' ⬆':'')),el('div',{class:'small'},'Lv'+h.level+' '+getClass(h.cls).n),(h.injuries||[]).length?el('div',{class:'small bad'},'🩹'+h.injuries.length):null))):el('p',null,'No one in the party. Visit the Roster.'),btn('Manage party',()=>rosterScreen(),'mini',{id:'b-roster'})),
    el('div',{class:'objective'},done?'The Pale Throne has fallen. The realm is yours to explore.':'Chapter '+(G.story.ch+1)+': '+chap.n+' — '+REGIONS[chap.region].n+' (Lv '+chap.lvl+'+)'),
    el('div',{class:'tgrid'},
      tile('🗺','World Map','Embark',()=>worldMap(),'t-map'),
      tile('🍺','Patrons','Talk & quests',()=>patrons(),'t-npc'),
      tile('📋','Quest Board',G.quests.active.length+' active',()=>questBoard(),'t-quests'),
      tile('🧑‍🤝‍🧑','Roster',G.roster.length+'/'+ROSTER_CAP[T.barracks],()=>rosterScreen(),'t-roster'),
      tile('🪖','Recruit',G.recruits.length+' waiting',()=>recruitScreen(),'t-recruit'),
      tile('⚖','Market',TAVERN_UPGRADES.market.d[T.market].split(':')[0],()=>marketScreen(),'t-market'),
      tile('⚒','Forge',T.forge?TAVERN_UPGRADES.forge.d[T.forge].split(':')[0]:'Not built',()=>forgeScreen(),'t-forge',T.forge?null:'Build the Forge in Upgrades.'),
      tile('🩹','Infirmary','Treat injuries',()=>infirmaryScreen(),'t-inf'),
      tile('🕯','Shrine','Blessings',()=>shrineScreen(),'t-shrine'),
      tile('📚','Library',T.library?'Identify & study':'A shelf of books',()=>libraryScreen(),'t-lib'),
      tile('🏗','Upgrades','Improve the Lantern',()=>upgradeScreen(),'t-up'),
      tile('📦','Stash',G.stash.length+' items',()=>stashScreen(),'t-stash'),
      tile('📖','Journal','Quests, codex, factions',()=>UI.journal(),'t-journal'),
      tile('🛏','Rest','Pass a day',()=>{ advanceDays(1); toast('A day passes. Injuries mend; the market restocks.'); saveGame(); showTavern(); },'t-rest'),
      tile('💾','Save / Load','Export, import',()=>saveMenu(),'t-save'),
      tile('🛠','Homebrew','Class builder',()=>homebrewList(()=>showTavern()),'t-hb'),
      tile('❓','Help','How to play',()=>UI.help(),'t-help'),
      tile('📜','Credits','SRD license',()=>UI.credits(),'t-credits')))); }
// ---------- roster / party ----------
function rosterScreen(){ const cap=ROSTER_CAP[G.tavern.barracks];
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Roster ('+G.roster.length+'/'+cap+') · Party '+G.party.length+'/6'),btn('Back',showTavern,'',{id:'b-back'})),
    el('div',{class:'col'},G.roster.map(h=>{ const inP=G.party.includes(h.id); return el('div',{class:'card hrow'+(inP?' inparty':'')},portraitEl(h,56,'pp'),el('div',{class:'grow'},el('b',null,h.name),el('div',{class:'small'},RACES[h.race].n+' '+getClass(h.cls).n+(getSub(h)?' ('+getSub(h).n+')':'')+' · Lv '+h.level+' · XP '+h.xp+'/'+xpForNext(h.level)),(h.injuries||[]).length?el('div',{class:'small bad'},h.injuries.map(i=>INJURIES.find(d=>d.id===i.id).n).join(', ')):null),
      btn(inP?'Remove':'Add to party',()=>{ if(inP) G.party=G.party.filter(x=>x!==h.id); else if(G.party.length<6) G.party.push(h.id); else toast('Party is full (6).'); rosterScreen(); },'mini',{id:'rp-'+h.id}),btn('Sheet',()=>UI.sheet(h,()=>rosterScreen()),'mini'),
      btn('Dismiss',async()=>{ const ok=await UI.choice('Dismiss '+h.name+'?','They will leave the Lantern forever. Their equipment goes to the stash.',[{t:'Dismiss',v:1},{t:'Keep',v:0}]); if(ok){ for(const k in h.eq) if(h.eq[k]) G.stash.push(h.eq[k]); G.roster=G.roster.filter(x=>x!==h); G.party=G.party.filter(x=>x!==h.id); rosterScreen(); } },'mini danger')); }),
      G.roster.length<cap?btn('✦ Create a new hero (100 gold)',()=>{ if(G.gold<100&&G.roster.length>0){ toast('Not enough gold.'); return; } creator({cancel:()=>rosterScreen(),onDone:h=>{ if(G.roster.length>0) G.gold-=100; G.roster.push(h); if(G.party.length<6) G.party.push(h.id); saveGame(); rosterScreen(); }}); },'big',{id:'b-newhero'}):el('p',null,'Roster full — upgrade the Barracks.')))); }
function refreshRecruits(){ const lvlBase=Math.max(1,Math.floor(partyLevelRoster())); const T=G.tavern.barracks; const n=3+T;
  G.recruits=Array.from({length:n},()=>{ const l=T>=2?lvlBase:T>=1?Math.max(1,lvlBase-1):Math.max(1,lvlBase-2); const h=autoHero(pick(Object.keys(CLASSES).concat((G.homebrew||[]).map(c=>c.id))),l); if(T>=3) G.stash; h.bio='A '+BACKGROUNDS[h.bg].n.toLowerCase()+' seeking the Lantern\'s shelter.'; if(T>=3){ const g=randomGear(2,{rar:'uncommon',ident:true}); if(g.kind==='weapon') h.eq.main=g; } return h; }); }
function partyLevelRoster(){ const p=activeParty(); const L=p.length?p:G.roster; if(!L.length) return 1; return L.reduce((a,h)=>a+h.level,0)/L.length; }
function recruitCost(h){ let c=40+h.level*h.level*30; c=Math.round(c*(1-repDisc('lantern'))); if(G.perks.recruitHalf) c=Math.round(c/2); return c; }
function recruitScreen(){ const cap=ROSTER_CAP[G.tavern.barracks];
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Recruits seeking work'),el('span',null,'💰 '+G.gold),btn('Back',showTavern,'',{id:'b-back'})),
    el('div',{class:'col'},G.recruits.length?G.recruits.map(h=>el('div',{class:'card hrow'},portraitEl(h,56,'pp'),el('div',{class:'grow'},el('b',null,h.name),el('div',{class:'small'},RACES[h.race].n+' '+getClass(h.cls).n+' · Lv '+h.level+' · HP '+heroMaxHP(h)+' · AC '+heroAC(h)),el('div',{class:'small'},h.bio)),
      btn('Hire ('+recruitCost(h)+'g)',()=>{ const c=recruitCost(h); if(G.roster.length>=cap){ toast('Roster full.'); return; } if(G.gold<c){ toast('Not enough gold.'); return; } G.gold-=c; G.recruits=G.recruits.filter(x=>x!==h); G.roster.push(h); if(G.party.length<6) G.party.push(h.id); logJournal(h.name+' joined the Wardens.'); saveGame(); recruitScreen(); },'mini',{class:'btn mini hire'}),btn('Sheet',()=>UI.sheet(h,()=>recruitScreen(),true),'mini'))):el('p',null,'No one today. New faces arrive every few days.')))); }
// ---------- world map ----------
function regionOpen(id){ return G.story.done.length>=REGIONS[id].unlock; }
function worldMap(){ const chap=STORY[G.story.ch]; const allDone=G.story.done.length>=STORY.length;
  const wrap=el('div',{class:'wmap'},el('img',{src:'assets/worldmap.jpg',class:'wimg'}),Object.keys(REGIONS).map(id=>{ const R0=REGIONS[id]; const open=regionOpen(id); const story=!allDone&&chap.region===id;
    return el('button',{class:'pin'+(open?'':' locked')+(story?' story':''),id:'pin-'+id,style:{left:R0.x+'%',top:R0.y+'%'},onclick:()=>open?regionPopup(id):toast('The road to '+R0.n+' is not yet known.')},el('span',{class:'pd'},story?'✦':open?'●':'🔒'),el('span',{class:'pl'},R0.n)); }));
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'The Realm of Vellmora'),btn('Back',showTavern,'',{id:'b-back'})),wrap)); }
function regionPopup(id){ const R0=REGIONS[id]; const chap=STORY[G.story.ch]; const story=G.story.done.length<STORY.length&&chap.region===id; const sq=G.quests.active.filter(q=>SIDE_QUESTS[q.id].region===id);
  UI.modal(R0.n,el('div',null,el('p',null,R0.d),el('p',{class:'small'},'Suggested levels '+R0.lvl[0]+'–'+R0.lvl[1]+' · Faction: '+(FACTIONS[R0.faction]?FACTIONS[R0.faction].n:'—')),sq.length?el('p',{class:'small'},'Quests here: '+sq.map(q=>SIDE_QUESTS[q.id].n).join(', ')):null,
    story?el('div',{class:'card'},el('b',null,'✦ Chapter '+(G.story.ch+1)+': '+chap.n),el('p',{class:'small'},chap.floors+' floors · recommended level '+chap.lvl),btn('Descend (story)',()=>{ UI.closeAll(); embark('story',G.story.ch); },'big',{id:'b-story'})):null,
    el('div',{class:'card'},el('b',null,'Explore the depths'),el('p',{class:'small'},'A random dungeon of 2–3 floors. Loot, XP and side quests.'),btn('Descend (explore)',()=>{ UI.closeAll(); embark('explore',id); },'',{id:'b-explore'})))); }
async function embark(kind,ref){ const p=activeParty(); if(!p.length){ toast('Choose a party first (Roster).'); return; }
  const rations=G.stash.filter(i=>i.base==='rations').reduce((a,i)=>a+(i.qty||1),0); const pots=G.stash.filter(i=>GEAR[i.base]&&GEAR[i.base].kind==='potion');
  const pack=await packScreen(); if(pack==null) return;
  startExpedition(kind,ref); if(G.tavern.shrine>=1&&G.buffs.blessing){ G.buffs.blessing=false; for(const h of activeParty()){ addFx(h,{id:'blessed',rounds:10,src:'shrine'}); if(G.tavern.shrine>=2) h.tempHp=Math.max(h.tempHp||0,10); } toast('The Shrine\'s blessing goes with you.'); } }
function packScreen(){ return new Promise(res=>{ const plan=G.packPlan=G.packPlan||[];
  const usable=it=>['potion','throw','gear','scroll'].includes(it.kind)||it.kind==='wand';
  const draw=()=>{ const list=G.stash.filter(usable); body.innerHTML=''; body.appendChild(el('p',{class:'small'},'Move supplies from the stash into the expedition pack. Rations are needed for short rests.'));
    body.appendChild(el('div',{class:'twocol'},el('div',null,el('h3',null,'Stash'),gearSections(list,it=>gearRow(it,[btn('→',()=>{ moveOne(G.stash,plan,it); draw(); },'mini')]),'embark-stash')),el('div',null,el('h3',null,'Pack'),gearSections(plan,it=>gearRow(it,[btn('←',()=>{ moveOne(plan,G.stash,it); draw(); },'mini')]),'embark-pack')))); };
  const body=el('div'); draw();
  UI.modal('Expedition Pack',body,{wide:true,buttons:[{t:'Auto-pack',fn:()=>{ for(const b of ['rations','rations','potheal','potheal','torch']){ const it=G.stash.find(i=>i.base===b); if(it) moveOne(G.stash,plan,it); } draw(); return false; }},{t:'Set out!',v:1,cls:'big'}]}).then(v=>res(v)); }); }
function moveOne(from,to,it){ if(it.stack&&(it.qty||1)>1){ it.qty--; const c=Object.assign({},it,{uid:uid('i'),qty:1}); stackAdd(to,c); } else { from.splice(from.indexOf(it),1); stackAdd(to,it); } }
// ---------- patrons & dialogue ----------
function npcAvailable(id){ const n=NPCS[id]; return !n.ch||G.story.done.length>=n.ch; }
// visual-novel art: NPC portrait + location backdrop (wide for landscape, tall for portrait)
const NPC_ART={ marta:'common_room', aldous:'shrine', hrolf:'forge', ysolde:'library', vey:'barracks', sable:'common_room', quill:'market', thornelder:'common_room' };
function locSrc(loc,tall){ return 'assets/loc/'+loc+(tall?'_tall':'')+'.jpg'; }
function npcPortraitSrc(id){ return 'assets/npc/'+id+'.jpg'; }
// CSS custom props must go through the style attribute (el()'s style object uses Object.assign, which ignores --vars)
function locBgStyle(loc){ return loc?"--bgw:url('"+locSrc(loc,false)+"');--bgt:url('"+locSrc(loc,true)+"')":null; }
function patrons(){ UI.closeVN(); showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead patronshead',style:locBgStyle('common_room')},el('h2',null,'Patrons of the Lantern'),btn('Back',showTavern,'',{id:'b-back'})),
  el('div',{class:'col'},Object.keys(NPCS).filter(npcAvailable).map(id=>{ const n=NPCS[id]; return el('div',{class:'card hrow',onclick:()=>talk(id),id:'npc-'+id},el('div',{class:'npcav',style:{background:n.col||'#553'}},n.n[0],el('img',{class:'npcthumb',alt:'',loading:'lazy',decoding:'async',src:npcPortraitSrc(id),onerror:function(){ this.remove(); }})),el('div',{class:'grow'},el('b',null,n.n),el('div',{class:'small'},n.role))); })))); }
function bestSpeaker(sk){ let best=null,bb=-99; for(const h of (activeParty().length?activeParty():G.roster)){ const b=skillBonus(h,sk); if(b>bb){ bb=b; best=h; } } return best; }
async function talk(id,node){ const n=NPCS[id]; node=node||'start'; const N=n.nodes[node]; if(!N||node==='end'){ patrons(); return; }
  let text=N.t.replace('$RUMOR',pick(RUMORS));
  const opts=N.o.filter(o=>!(o.once&&G.flags[o.once])).map((o,i)=>({t:o.t,v:i,o}));
  const pickIdx=await UI.dialogue(id,text,opts.map(x=>({t:x.t,v:x.v}))); const o=opts.find(x=>x.v===pickIdx).o;
  if(o.chk){ const h=bestSpeaker(o.chk.s); G.flags[o.once]=1; const r=skillCheck(h,o.chk.s,o.chk.dc); await DICE.flush(); UI.roll(h.name+': '+r.txt,r.ok?'good':'bad'); toast(h.name+' — '+SKILL_NAME[o.chk.s]+' '+(r.ok?'success':'failure')+' ('+r.total+' vs DC '+o.chk.dc+')'); return talk(id,r.ok?o.ok:o.no); }
  if(o.once) G.flags[o.once]=1;
  if(o.act){ const more=await doAct(o.act,id); if(more) return; return talk(id,o.go||'start'); }
  if(o.go==='end'||!o.go){ patrons(); return; } return talk(id,o.go); }
async function doAct(act,npc){ for(const part of act.split('|')){ const [k,a,b]=part.split(':');
    if(k==='quests'){ await questOffers(a); return true; }
    if(k==='codex') unlockCodex(a);
    if(k==='rep'){ adjustRep(a,+b); toast(FACTIONS[a].n+' +'+b); }
    if(k==='xp'){ activeParty().forEach(h=>h.xp+=+a); toast('+'+a+' XP to the party'); }
    if(k==='item'){ const it=a==='scroll'?makeItem('scroll',{maxL:2}):makeItem(a); stackAdd(G.stash,it); toast('Received: '+itemName(it)); }
    if(k==='buff'){ if(G.gold>=5){ G.gold-=5; G.buffs[a]=true; toast('A round of ale (5g): +5 temp HP next expedition.'); } else toast('Not enough coin.'); }
    if(k==='perk'){ G.perks[a]=true; toast('Perk gained: '+({forgeOnce:'One free forge upgrade',recruitHalf:'Recruits cost half'})[a]||a); }
    if(k==='blackmarket'){ marketScreen(true); return true; } }
  saveGame(); return false; }
async function questOffers(giver){ const avail=Object.keys(SIDE_QUESTS).filter(q=>SIDE_QUESTS[q].giver===giver&&!G.quests.done.includes(q));
  const opts=avail.map(q=>{ const act=G.quests.active.find(x=>x.id===q); const d=SIDE_QUESTS[q]; return {t:(act?(act.progress>=d.count?'✔ Turn in: ':'… '):'Accept: ')+d.n+(act?' ('+act.progress+'/'+d.count+')':''),v:q}; });
  if(!opts.length){ await UI.choice(NPCS[giver].n,'"Nothing more I need — for now."',[{t:'Back',v:0}]); return talk(giver); }
  const q=await UI.choice(NPCS[giver].n+' — Work',avail.map(q=>SIDE_QUESTS[q].n+': '+SIDE_QUESTS[q].d).join('\n\n'),[...opts,{t:'Back',v:null}]); if(!q) return talk(giver);
  const act=G.quests.active.find(x=>x.id===q); if(!act){ G.quests.active.push({id:q,progress:0}); logJournal('Quest accepted: '+SIDE_QUESTS[q].n+'.'); toast('Quest accepted: '+SIDE_QUESTS[q].n); saveGame(); return questOffers(giver); }
  if(act.progress>=SIDE_QUESTS[q].count){ completeQuest(q); return questOffers(giver); } toast('Not yet complete.'); return questOffers(giver); }
function completeQuest(q){ const d=SIDE_QUESTS[q], rw=d.reward; G.quests.active=G.quests.active.filter(x=>x.id!==q); G.quests.done.push(q); G.stash=G.stash.filter(i=>!(i.kind==='quest'&&i.qid===q));
  G.gold+=rw.gold||0; G.renown+=rw.renown||0; const p=activeParty().length?activeParty():G.roster; p.forEach(h=>h.xp+=Math.round((rw.xp||0)/Math.max(1,p.length))*1+Math.round((rw.xp||0)/2)); for(const f in (rw.rep||{})) adjustRep(f,rw.rep[f]); (rw.items||[]).forEach(b=>stackAdd(G.stash,makeItem(b)));
  if(rw.recruit){ const h=autoHero(pick(Object.keys(CLASSES)),Math.max(1,Math.floor(partyLevelRoster()))); h.bio='Joined after '+d.n+'.'; G.recruits.push(h); }
  if(rw.magic){ G.stash.push(randomGear(2,{rar:rw.magic,ident:true})); }
  logJournal('Quest complete: '+d.n+'.'); UI.story('Quest Complete: '+d.n,'Reward: '+(rw.gold||0)+' gold, '+(rw.xp||0)+' XP'+(rw.renown?', '+rw.renown+' renown':'')+((rw.items||[]).length?', items':'')+'.'); saveGame(); }
function questBoard(){ const act=G.quests.active.map(q=>{ const d=SIDE_QUESTS[q.id]; return el('div',{class:'card'},el('b',null,d.n),el('span',{class:'small'},' — '+NPCS[d.giver].n+' · '+(d.region==='any'?'anywhere':REGIONS[d.region].n)),el('p',{class:'small'},d.d),el('div',null,'Progress: '+q.progress+'/'+d.count),q.progress>=d.count?btn('Turn in',()=>{ completeQuest(q.id); questBoard(); },'mini'):null); });
  const offers=Object.keys(SIDE_QUESTS).filter(q=>!G.quests.done.includes(q)&&!G.quests.active.some(x=>x.id===q)&&npcAvailable(SIDE_QUESTS[q].giver)).map(q=>{ const d=SIDE_QUESTS[q]; return el('div',{class:'card'},el('b',null,d.n),el('span',{class:'small'},' — '+NPCS[d.giver].n),el('p',{class:'small'},d.d),btn('Accept',()=>{ G.quests.active.push({id:q,progress:0}); logJournal('Quest accepted: '+d.n+'.'); saveGame(); questBoard(); },'mini',{id:'qa-'+q})); });
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Quest Board'),btn('Back',showTavern,'',{id:'b-back'})),el('h3',null,'Active'),act.length?act:el('p',{class:'small'},'None.'),el('h3',null,'Notices'),offers.length?offers:el('p',{class:'small'},'The board is bare.'))); }
// ---------- market ----------
function refreshMarket(){ const L=G.tavern.market; const items=[]; const tier=Math.min(4,Math.floor(partyLevelRoster()/3));
  for(let i=0;i<4+L*2;i++){ const b=pick([...Object.keys(WEAPONS),...Object.keys(ARMORS)]); items.push(makeItem(b)); }
  for(let i=0;i<L*2;i++) items.push(randomGear(tier,{rar:L>=3?pick(['uncommon','rare']):'uncommon',ident:true}));
  for(let i=0;i<1+L;i++) items.push(makeItem('scroll',{maxL:1+L}));
  G.market={day:G.day,items}; if((G.day%3)===0||!G.recruits.length) refreshRecruits(); }
const MARKET_STAPLES=['potheal','potgreater','rations','torch','antitoxin','holywater','alchfire','healerskit','thievestools','crowbar','rope','returnwrit'];
function buyPrice(it,black){ return Math.max(1,Math.round(itemValue(Object.assign({},it,{qty:1}))*(black?1.3:1)*(1-repDisc('ledger')))); }
function sellPrice(it){ const r=[0.4,0.5,0.6,0.75][G.tavern.market]; return Math.max(1,Math.round(itemValue(Object.assign({},it,{qty:1}))*r*(it.ident===false?0.5:1)*(1+repDisc('ledger')))); }
function marketScreen(black){ if(!G.market||!G.market.items) refreshMarket(); let tab='buy';
  const draw=()=>{ const staples=MARKET_STAPLES.filter(b=>G.tavern.market>=1||!['potgreater','returnwrit'].includes(b)).map(b=>makeItem(b));
    const stock=black?Array.from({length:3},(_,i)=>G._black=G._black&&G._black.length?G._black:[randomGear(3,{rar:'rare',ident:true}),randomGear(3,{rar:'veryrare',ident:true}),makeItem('potinvis')]).flat().slice(0,3):G.market.items;
    const rowB=(it,staple)=>gearRow(it,[btn('Buy '+buyPrice(it,black)+'g',()=>{ const c=buyPrice(it,black); if(G.gold<c){ toast('Not enough gold.'); return; } G.gold-=c; const n=staple?makeItem(it.base):it; if(!staple){ const L=black?G._black:G.market.items; L.splice(L.indexOf(it),1); } stackAdd(G.stash,n); toast('Bought '+itemName(n)); draw(); },'mini buy')]);
    const rowS=it=>gearRow(it,[btn('Sell '+sellPrice(it)+'g',()=>{ G.gold+=sellPrice(it); if((it.qty||1)>1) it.qty--; else G.stash.splice(G.stash.indexOf(it),1); draw(); },'mini',{disabled:it.kind==='quest'})]);
    showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,black?'Sable\'s Black Market':'Market'),el('span',null,'💰 '+G.gold),btn('Back',showTavern,'',{id:'b-back'})),
      el('div',{class:'chips'},['buy','sell'].map(t=>el('button',{class:'chip'+(tab===t?' on':''),id:'mk-'+t,onclick:()=>{ tab=t; draw(); }},t==='buy'?'Buy':'Sell'))),
      tab==='buy'?el('div',{class:'col'},black?null:el('h3',null,'Staples'),black?null:gearSections(staples,it=>rowB(it,true),'mk-staple'),el('h3',null,black?'Rare wares':'Today\'s stock'),gearSections(stock,it=>rowB(it,false),'mk-stock')):gearSections(G.stash.filter(i=>i.kind!=='quest'),rowS,'mk-sell'))); };
  draw(); }
// ---------- forge ----------
const FORGE_TABS_V1=1;
const FORGE_CRAFT_V1=1;
let forgeTab='upgrade';
function matCount(b){ return G.stash.filter(i=>i.kind==='material'&&i.base===b).reduce((a,i)=>a+(i.qty||1),0); }
function takeMat(b,n){ while(n>0){ const it=G.stash.find(i=>i.kind==='material'&&i.base===b); if(!it) return; const t=Math.min(n,it.qty||1); it.qty=(it.qty||1)-t; n-=t; if(it.qty<=0) G.stash.splice(G.stash.indexOf(it),1); } }
function forgeGear(it){ return !!(it&&['weapon','armor','shield'].includes(it.kind)); }
function forgeLoose(){ const out=[]; const take=list=>{ if(!list) return; for(const it of list) if(forgeGear(it)) out.push(it); }; take(G.stash); if(G.run) take(G.run.pack); return out; }
function forgeWorn(){ const out=[]; for(const h of (G.roster||[])) for(const k in (h.eq||{})) if(forgeGear(h.eq[k])) out.push({it:h.eq[k],hero:h,slot:k}); return out; }
function allGear(){ return forgeLoose().map(it=>({it,where:'Stash'})).concat(forgeWorn().map(w=>({it:w.it,where:w.hero.name.split(' ')[0]}))); }
function upCost(it){ const p=(it.plus||0)+1; return {gold:120*p*p,mats:{iron:2*p,...(p>=2?{arcane:p-1}:{}),...(p>=3?{essence:2}:{})}}; }
function salvageGear(it){ const n=1+(it.plus||0)+((it.affixes||[]).length); stackAdd(G.stash,makeItem('iron',{qty:1+n})); if(it.plus||(it.affixes&&it.affixes.length)||it.magic) stackAdd(G.stash,makeItem('arcane',{qty:n}));
  let i=G.stash.indexOf(it); if(i>=0){ G.stash.splice(i,1); return true; } if(G.run&&G.run.pack){ i=G.run.pack.indexOf(it); if(i>=0){ G.run.pack.splice(i,1); return true; } } return false; }
function forgeUpgrade(it){ const L=G.tavern.forge||0; if((it.plus||0)>=L) return false; const free=!!(G.perks&&G.perks.forgeOnce); const uc=upCost(it);
  if(!free){ if(G.gold<uc.gold||!Object.keys(uc.mats).every(m=>matCount(m)>=uc.mats[m])) return false; G.gold-=uc.gold; for(const m in uc.mats) takeMat(m,uc.mats[m]); } else G.perks.forgeOnce=false;
  it.plus=(it.plus||0)+1; if(it.rar==='common') it.rar='uncommon'; else if(it.plus>=2&&it.rar==='uncommon') it.rar='rare'; return true; }
function wearerMark(h){ return el('span',{class:'wearer','data-wearer':h.id},portraitEl(h,22,'prof-ico'),el('span',null,h.name)); }
function forgeMake(rec){ let it; if(rec.magic) it=makeMagic(rec.magic,true); else if(rec.scroll) it=makeItem('scroll',{spell:rec.scroll}); else it=makeItem(rec.base); if(rec.silvered) it.silvered=true; it.ident=true; return it; }
function canCraft(rec){ if(!rec||(G.tavern.forge||0)<rec.forge||G.gold<rec.gold) return false; return Object.keys(rec.mats).every(m=>matCount(m)>=rec.mats[m]); }
function doCraft(rec){ if(!canCraft(rec)) return null; G.gold-=rec.gold; for(const m in rec.mats) takeMat(m,rec.mats[m]); const it=forgeMake(rec); stackAdd(G.stash,it); return it; }
function craftCostLine(rec){ const parts=[el('span',{class:G.gold<rec.gold?'craft-short':''},rec.gold+'g (have '+G.gold+')')]; Object.keys(rec.mats).forEach(m=>{ const have=matCount(m), need=rec.mats[m]; parts.push(' · ',el('span',{class:have<need?'craft-short':''},MATERIALS[m].n+' '+have+'/'+need)); }); return el('div',{class:'small craft-cost'},parts); }
function craftBody(){ const wrap=el('div',{class:'gearsecs',id:'forge-craft-list'});
  for(const sec of FORGE_CRAFT_SECTIONS){ const list=FORGE_RECIPES.filter(r=>r.sec===sec.id); if(!list.length) continue;
    const det=el('details',{class:'gearsec',id:'forge-sec-'+sec.id,open:true},el('summary',null,el('span',{class:'gs-n'},sec.n),el('span',{class:'gs-c'},String(list.length))));
    const body=el('div',{class:'gearsec-body'});
    for(const rec of list){ const sample=forgeMake(rec); const locked=(G.tavern.forge||0)<rec.forge; const lines=itemDesc(sample).split('\n').filter(Boolean);
      const rest=lines.slice(1).join(' '); const lock=locked?el('span',{class:'small craft-lock'},'Requires '+(FORGE_RANK[rec.forge]||'Forge')+' (Forge '+rec.forge+')'):null;
      const button=btn('Craft',()=>{ const made=doCraft(rec); if(!made){ toast(locked?'The forge is not built high enough.':'Missing gold or materials.'); return; } toast('Crafted '+itemName(made)+'.'); saveGame(); forgeScreen(); },'mini',{id:'craft-'+rec.id,disabled:!canCraft(rec)});
      body.appendChild(gearRow(sample,[button,lock],el('div',{class:'craft-extra'},rest?el('span',{class:'small gear-desc'},rest):null,craftCostLine(rec)))); }
    det.appendChild(body); wrap.appendChild(det); }
  return wrap; }
function forgeScreen(){ const L=G.tavern.forge||0; if(!['disassemble','craft','upgrade'].includes(forgeTab)) forgeTab='upgrade';
  const costTxt=c=>c.gold+'g + '+Object.keys(c.mats).map(m=>c.mats[m]+' '+MATERIALS[m].n).join(', ');
  const canPay=c=>G.gold>=c.gold&&Object.keys(c.mats).every(m=>matCount(m)>=c.mats[m]); const pay=c=>{ G.gold-=c.gold; for(const m in c.mats) takeMat(m,c.mats[m]); };
  const loose=forgeLoose(), worn=forgeWorn();
  const upBtns=it=>{ const uc=upCost(it); const free=G.perks&&G.perks.forgeOnce; const canUp=(it.plus||0)<L; const ec={gold:250,mats:{arcane:2,essence:1}}; const maxAff=L>=3?3:2;
    return [canUp?btn('Upgrade to +'+((it.plus||0)+1)+' — '+(free?'FREE (Hrolf)':costTxt(uc)),()=>{ if(!forgeUpgrade(it)){ toast('Missing gold or materials.'); return; } toast(itemName(it)+' reforged.'); saveGame(); forgeScreen(); },'mini'):null,
      L>=2&&(it.affixes||[]).length<maxAff&&!it.magic?btn('Enchant affix — '+costTxt(ec),async()=>{ if(!canPay(ec)){ toast('Missing gold or materials.'); return; } const on=it.kind==='weapon'?'weapon':'armor'; const opts=randomAffixesSafe(3,on,L>=3?3:2).filter(a=>!(it.affixes||[]).includes(a)); if(!opts.length){ toast('No affixes fit.'); return; } const a=await UI.choice('Runeforge','The runes offer three bindings. Choose one.',[...opts.map(a=>({t:AFFIXES[a].n+' — '+AFFIXES[a].d,v:a})),{t:'Cancel',v:null}]); if(!a) return; pay(ec); it.affixes=(it.affixes||[]).concat(a); if(it.rar==='common') it.rar='uncommon'; saveGame(); forgeScreen(); },'mini'):null]; };
  const tabBtn=(id,n)=>el('button',{class:'chip'+(forgeTab===id?' on':''),id:'forge-'+id,onclick:()=>{ forgeTab=id; forgeScreen(); }},n);
  let body;
  if(forgeTab==='disassemble') body=loose.length?gearSections(loose,it=>gearRow(it,[btn('Salvage',()=>{ if(!salvageGear(it)){ toast('That piece is not in the stash.'); return; } toast('Salvaged into materials.'); saveGame(); forgeScreen(); },'mini danger')]),'forge-dis'):el('p',{class:'small',id:'forge-empty'},'Nothing in the stash to break down. Gear a hero is wearing stays put.');
  else if(forgeTab==='craft') body=craftBody();
  else { const eq=worn.length?el('details',{class:'gearsec',id:'forge-equipped',open:true},el('summary',null,el('span',{class:'gs-n'},'Equipped'),el('span',{class:'gs-c'},String(worn.length))),el('div',{class:'gearsec-body'},worn.map(w=>gearRow(w.it,upBtns(w.it),wearerMark(w.hero))))):null;
    const stash=loose.length?gearSections(loose,it=>gearRow(it,upBtns(it)),'forge-up'):el('p',{class:'small'},worn.length?'Nothing waiting in the stash.':'No weapons or armor to work.');
    body=el('div',{class:'col',id:'forge-upgrade'},eq,stash); }
  showScreen('tavern',el('div',{class:'tav',id:'forge-screen'},el('div',{class:'tavhead'},el('h2',null,'The Forge — '+TAVERN_UPGRADES.forge.d[L]),btn('Back',showTavern,'',{id:'b-back'})),
    el('div',{class:'mats',id:'forge-mats'},Object.keys(MATERIALS).map(m=>el('span',{class:'mat',style:{borderColor:MATERIALS[m].c}},MATERIALS[m].n+': '+matCount(m))),el('span',{id:'forge-gold'},'💰 '+G.gold)),
    el('div',{class:'chips forge-tabs'},tabBtn('disassemble','Disassemble'),tabBtn('craft','Craft'),tabBtn('upgrade','Upgrade')),
    body)); }
function randomAffixesSafe(n,on,t){ return shuffle(Object.keys(AFFIXES).filter(a=>(AFFIXES[a].on==='any'||AFFIXES[a].on===on)&&AFFIXES[a].tier<=t+1)).slice(0,n); }
// ---------- infirmary ----------
function treatCost(inj){ const d=INJURIES.find(x=>x.id===inj.id); return Math.round(d.cost*(1-[0,0.2,0.4,0.6][G.tavern.infirmary])*(1-repDisc('rose'))); }
function infirmaryScreen(){ const list=G.roster.filter(h=>(h.injuries||[]).length);
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Infirmary — '+TAVERN_UPGRADES.infirmary.d[G.tavern.infirmary].split(':')[0]),el('span',null,'💰 '+G.gold),btn('Back',showTavern,'',{id:'b-back'})),
    el('p',{class:'small'},'Lasting injuries mend with time (rest days) or can be treated for coin. Grim Scars are permanent.'),
    el('div',{class:'col'},list.length?list.map(h=>el('div',{class:'card'},el('b',null,h.name),h.injuries.map(inj=>{ const d=INJURIES.find(x=>x.id===inj.id); return el('div',{class:'lrow'},el('span',{class:'grow'},d.n+' — '+d.d+(d.perm?'':' ('+Math.max(0,inj.days)+' days)')),d.perm?null:btn('Treat '+treatCost(inj)+'g',()=>{ const c=treatCost(inj); if(G.gold<c){ toast('Not enough gold.'); return; } G.gold-=c; h.injuries=h.injuries.filter(x=>x!==inj); h._fcache=null; h.hp=Math.min(h.hp,heroMaxHP(h)); toast(d.n+' treated.'); saveGame(); infirmaryScreen(); },'mini')); }))):el('p',null,'No one is injured. For now.')))); }
// ---------- shrine ----------
function shrineScreen(){ const L=G.tavern.shrine; const disc=G.roster.some(h=>BACKGROUNDS[h.bg].shrineDisc)?0.25:0;
  const cost=b=>Math.round(b*(1-disc)*(1-repDisc('rose')));
  const cursed=G.roster.filter(h=>(h.fx||[]).some(f=>['cursed','diseased','drained'].includes(f.id)));
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Shrine — '+TAVERN_UPGRADES.shrine.d[L].split(':')[0]),el('span',null,'💰 '+G.gold),btn('Back',showTavern,'',{id:'b-back'})),
    el('div',{class:'col'},el('div',{class:'card'},el('b',null,'Pray for a blessing'),el('p',{class:'small'},L>=1?'The party begins the next expedition Blessed'+(L>=2?' with 10 temporary HP':'')+'.':'Build the Shrine (Upgrades) to receive blessings.'),L>=1?btn(G.buffs.blessing?'Blessing prepared ✔':'Pray ('+cost(20)+'g)',()=>{ if(G.buffs.blessing) return; if(G.gold<cost(20)){ toast('Not enough gold.'); return; } G.gold-=cost(20); G.buffs.blessing=true; saveGame(); shrineScreen(); },'mini',{id:'b-pray'}):null),
      el('div',{class:'card'},el('b',null,'Cleanse curses & disease'),cursed.length?cursed.map(h=>btn(h.name+' ('+cost(60)+'g)',()=>{ if(G.gold<cost(60)) return toast('Not enough gold.'); G.gold-=cost(60); h.fx=h.fx.filter(f=>!['cursed','diseased','drained'].includes(f.id)); saveGame(); shrineScreen(); },'mini')):el('p',{class:'small'},'No one is afflicted.')),
      el('div',{class:'card'},el('b',null,'Rite of Rebirth'),el('p',{class:'small'},'Rebuild a hero from scratch (race, class, abilities) keeping their XP. Costs 50g per level.'),G.roster.map(h=>btn(h.name+' ('+(50*h.level)+'g)',()=>{ if(G.gold<50*h.level) return toast('Not enough gold.'); const keep=h.xp, id=h.id; const shell=newHeroShell(); Object.assign(shell,{name:h.name,app:h.app,id,race:h.race,cls:h.cls,bg:h.bg}); const p=classPrio(shell.cls); p.forEach((a,i)=>shell.base[a]=STANDARD_ARRAY[i]);
        creator({hero:shell,title:'Rite of Rebirth',keepXp:keep,cancel:()=>shrineScreen(),onDone:n=>{ G.gold-=50*h.level; for(const k in h.eq) if(h.eq[k]) G.stash.push(h.eq[k]); n.injuries=h.injuries; n.eq={}; giveStartGear(n); G.roster[G.roster.indexOf(h)]=n; saveGame(); toast(n.name+' is reborn.'); shrineScreen(); }}); },'mini')))))); }
// ---------- library ----------
function libraryScreen(){ const L=G.tavern.library; const unid=[...G.stash.filter(i=>i.ident===false),...G.roster.flatMap(h=>Object.values(h.eq).filter(i=>i&&i.ident===false))];
  showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Library — '+TAVERN_UPGRADES.library.d[L].split(':')[0]),el('span',null,'💰 '+G.gold),btn('Back',showTavern,'',{id:'b-back'})),
    el('div',{class:'col'},
      el('div',{class:'card'},el('b',null,'Identify items (20g)'),L<1?el('p',{class:'small'},'Requires the Library upgrade.'):unid.length?gearSections(unid,it=>gearRow(it,[btn('Identify 20g',()=>{ if(G.gold<20) return toast('Not enough gold.'); G.gold-=20; it.ident=true; UI.story('Identified',itemName(it)+'\n'+itemDesc(it)); saveGame(); libraryScreen(); },'mini')]),'lib-unid'):el('p',{class:'small'},'Nothing unidentified.')),
      el('div',{class:'card'},el('b',null,'Study spells'),el('p',{class:'small'},'Re-choose a caster\'s known/prepared spells.'),L<1?el('p',{class:'small'},'Requires the Library upgrade.'):G.roster.filter(h=>getClass(h.cls).caster).map(h=>btn(h.name,()=>spellPicker(h,()=>libraryScreen()),'mini'))),
      el('div',{class:'card'},el('b',null,'Scribe a scroll'),L<2?el('p',{class:'small'},'Requires the Scriptorium.'):G.roster.filter(h=>heroSpells(h).length).map(h=>el('div',null,el('span',{class:'small'},h.name+': '),heroSpells(h).filter(s=>SPELLS[s].l>0).slice(0,8).map(s=>{ const c=40*SPELLS[s].l*SPELLS[s].l+20; return btn(SPELLS[s].n+' '+c+'g',()=>{ if(G.gold<c) return toast('Not enough gold.'); G.gold-=c; G.stash.push(makeItem('scroll',{spell:s})); toast('Scroll scribed.'); libraryScreen(); },'mini'); })))),
      el('div',{class:'card'},el('b',null,'Train with the masters'),L<3?el('p',{class:'small'},'Requires the Archive.'):G.roster.map(h=>btn(h.name+' +250 XP (200g)',()=>{ if(G.gold<200) return toast('Not enough gold.'); G.gold-=200; h.xp+=250; libraryScreen(); },'mini'))),
      el('div',{class:'card'},el('b',null,'The Codex'),el('p',{class:'small'},G.codex.length+' of '+Object.keys(CODEX).length+' entries discovered.'),btn('Read the Codex',()=>UI.journal('codex'),'mini'))))); }
function spellPicker(h,back){ const c=getClass(h.cls); let can=heroCantrips(h).filter(s=>(h.cantrips||[]).includes(s)), sp=(h.spells||[]).slice(); const ca=cantripsAllowed(h), sa=spellsAllowed(h);
  const draw=()=>{ const cl=cantripsForClass(h), sl=spellsForClass(h);
    showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,h.name+' — Spells'),btn('Done',()=>{ h.cantrips=can; h.spells=sp; saveGame(); back(); },'',{id:'b-back'})),
      el('h3',null,'Cantrips '+can.length+'/'+ca),el('div',{class:'chips'},cl.map(s=>el('button',{class:'chip'+(can.includes(s)?' on':''),title:SPELLS[s].d,onclick:()=>{ const i=can.indexOf(s); if(i>=0) can.splice(i,1); else if(can.length<ca) can.push(s); draw(); }},SPELLS[s].n))),
      el('h3',null,'Spells '+sp.length+'/'+sa),el('div',{class:'chips'},sl.map(s=>el('button',{class:'chip'+(sp.includes(s)?' on':''),title:SPELLS[s].d,onclick:()=>{ const i=sp.indexOf(s); if(i>=0) sp.splice(i,1); else if(sp.length<sa) sp.push(s); draw(); }},'L'+SPELLS[s].l+' '+SPELLS[s].n))))); };
  draw(); }
// ---------- upgrades ----------
function upgradeScreen(){ showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Improve the Last Lantern'),el('span',null,'💰 '+G.gold+' · ⭐ '+G.renown),btn('Back',showTavern,'',{id:'b-back'})),
  el('div',{class:'col'},Object.keys(TAVERN_UPGRADES).map(k=>{ const U=TAVERN_UPGRADES[k], L=G.tavern[k]; const next=U.cost[L+1];
    return el('div',{class:'card'},el('b',null,U.n+' — level '+L),el('p',{class:'small'},U.d[L]),next?el('p',{class:'small'},'Next: '+U.d[L+1]):null,next?btn('Build ('+next[0]+'g, renown '+next[1]+')',()=>{ if(G.gold<next[0]) return toast('Not enough gold.'); if(G.renown<next[1]) return toast('Requires renown '+next[1]+'.'); G.gold-=next[0]; G.tavern[k]++; logJournal('The '+U.n+' was improved: '+U.d[G.tavern[k]].split(':')[0]+'.'); if(k==='market') refreshMarket(); saveGame(); upgradeScreen(); },'mini',{id:'up-'+k}):el('p',{class:'small'},'Fully built.')); })))); }
// ---------- stash ----------
function stashScreen(){ showScreen('tavern',el('div',{class:'tav'},el('div',{class:'tavhead'},el('h2',null,'Shared Stash ('+G.stash.length+')'),btn('Back',showTavern,'',{id:'b-back'})),
  gearSections(G.stash,it=>gearRow(it,[canEquipAny(it)?btn('Equip…',async()=>{ const h=await UI.pickHero('Equip on whom?',G.roster); if(h){ equipItem(h,it,G.stash); saveGame(); stashScreen(); } },'mini'):null]),'stash'))); }
// ---------- save/load ----------
function saveMenu(){ UI.modal('Save & Load',el('div',{class:'col'},btn('💾 Save now',()=>{ saveGame(); toast('Saved.'); }),btn('📂 Load last save',()=>{ if(loadGame()){ UI.closeAll(); showTavern(); toast('Loaded.'); } }),btn('📤 Export save file',()=>exportSave()),btn('📥 Import save file',()=>importSave()),btn('🏠 Title screen',()=>{ saveGame(); UI.closeAll(); titleScreen(); }),
  el('label',{class:'small'},el('input',{type:'checkbox',checked:G.settings.autoEnd,onchange:e=>G.settings.autoEnd=e.target.checked}),' Auto-end turn when out of actions'),
  el('label',{class:'small'},el('input',{type:'checkbox',checked:G.settings.fastAnim,onchange:e=>G.settings.fastAnim=e.target.checked}),' Fast animations'),
  el('label',{class:'small'},el('input',{type:'checkbox',id:'set-quickrolls',checked:!!G.settings.quickRolls,onchange:e=>G.settings.quickRolls=e.target.checked}),' Quick rolls (skip the tap-to-roll dice animation)'))); }
