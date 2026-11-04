// ===== Exploration: expeditions, movement, traps, secrets, interactions =====
function startExpedition(kind,ref){
  const party=activeParty(); if(!party.length){ toast('Choose a party at the Barracks first.'); return false; }
  let region,theme,floors,boss=null,name;
  if(kind==='story'){ const ch=STORY[ref]; region=ch.region; theme=ch.theme; floors=ch.floors; boss=ch.boss; name=ch.n; }
  else { const R0=REGIONS[ref]; region=ref; theme=pick(R0.theme); floors=2; name=R0.n; }
  const RG=REGIONS[region]; const pl=partyLevel(); const lvl=Math.max(1,Math.round((pl+clamp(pl,RG.lvl[0],RG.lvl[1]))/2));
  G.run={kind,ref,region,theme,floor:1,floors,lvl,tier:clamp(Math.floor((lvl+1)/3),0,4),boss,name,map:null,leader:party[0].id,pack:[],gold:0,xp:0,log:[],kills:[],objectiveDone:false,grace:G.tavern.shrine>=3,buffs:{},rests:0,noise:0,trail:[],sneak:false,startDay:G.day};
  for(const h of party){ h.status=h.status==='fallen'?'ok':h.status; if(h.hp<=0) h.hp=1; h.fx=(h.fx||[]).filter(f=>f.persist&&f.id!=='drained'); h.x=null; h.y=null; h.reaction=true; h.deathS={s:0,f:0}; }
  if(G.buffs&&G.buffs.ale){ party.forEach(h=>h.tempHp=5); G.buffs.ale=false; }
  // take supplies from stash: potions & rations automatically? (player loads pack in UI) — default kit
  if(G.packPlan){ for(const it of G.packPlan) G.run.pack.push(it); G.packPlan=[]; }
  logJournal('The party sets out for '+name+'.');
  if(RG.lore) unlockCodex('reg_'+region);
  enterFloor(); return true; }
function questOptsFor(floor,floors){ const o={}; const last=floor>=floors;
  for(const q of G.quests.active){ const d=SIDE_QUESTS[q.id]; if(!d) continue; if(d.region!=='any'&&d.region!==G.run.region) continue;
    if(d.type==='collect'&&d.item==='oathkeeper'&&q.progress<d.count&&last) o.questItem={qid:q.id,item:'oathkeeper',n:'Oathkeeper, the Ironjaw clan hammer'};
    if(d.type==='rescue'&&q.progress<d.count&&last) o.rescue=q.id; }
  return o; }
function enterFloor(){ const r=G.run; const last=r.floor>=r.floors; const qo=questOptsFor(r.floor,r.floors); const oldEnts=r.map?r.map.ents:[];
  r.map=genDungeon(Object.assign({theme:r.theme,floor:r.floor,floors:r.floors,tier:r.tier,boss:last?r.boss:null,lvl:r.lvl},qo));
  r.rests=0; r.noise=0; r.daylight=null; r.lightBonus=0; r.passtrace=false; r.trail=[];
  const party=activeParty(); const s=r.map.start; let i=0;
  for(const h of party){ h.x=null; } for(const h of party){ if(h.status==='fallen') { h.x=null; continue; } h.x=s.x; h.y=s.y; placeNear(h,s.x,s.y); i++; }
  carryMinions(oldEnts,s);
  G.screen='dungeon'; UI.showDungeon(); computeVis(); centerOn(s.x,s.y,true);
  log('— '+r.name+', floor '+r.floor+' of '+r.floors+' —','sys');
  if(r.floor===1&&r.kind==='story'){ UI.story(STORY[r.ref].n,STORY[r.ref].intro); }
  passiveScan(); autosave(); }
function leader(){ const p=activeParty().filter(h=>h.status!=='fallen'&&h.x!=null&&h.hp>0); return p.find(h=>h.id===G.run.leader)||p[0]; }
// ---------- tap handling ----------
async function onTapDungeon(tx,ty){ if(!G.run||!G.run.map||G.busy) return; const map=G.run.map; if(tx<0||ty<0||tx>=map.w||ty>=map.h) return;
  if(UI.targeting){ UI.targetTap(tx,ty); return; }
  if(G.combat){ const c=G.combat.cur; if(!c||!(c.isHero||c.ally)||!G.combat.endTurn) return; if(c.ally){ await minionTap(c,tx,ty); return; } await combatTap(c,tx,ty); return; }
  // select hero
  const h=activeParty().find(h=>h.x===tx&&h.y===ty&&h.status!=='fallen'); const stT=tileAt(map,tx,ty); if(h&&h.id===G.run.leader&&(stT===T.UP||stT===T.DOWN)){ await interact(null,tx,ty); return; } if(h){ G.run.leader=h.id; UI.refreshParty(); R.dirty=true; toast(h.name+' leads.'); return; }
  if(!map.explored[ty*map.w+tx]) return;
  const ents=entsAt(map,tx,ty); const L=leader(); if(!L) return;
  const inter=ents.find(e=>isInteractable(e)); const tile=tileAt(map,tx,ty);
  if(inter||tile===T.LOCKED||tile===T.DOWN||tile===T.UP){ if(dist2(L.x,L.y,tx,ty)<=1&&!(tile===T.DOWN||tile===T.UP)){ await interact(inter,tx,ty); return; }
    if((tile===T.DOWN||tile===T.UP)&&L.x===tx&&L.y===ty){ await interact(null,tx,ty); return; }
    const goal=(tile===T.DOWN||tile===T.UP)?[tx,ty]:adjacentReachable(L,tx,ty); if(!goal) { toast('No path.'); return; } const ok=await walkTo(L,goal[0],goal[1]); if(ok&&!G.combat&&(dist2(L.x,L.y,tx,ty)<=1)) await interact(inter,tx,ty); return; }
  if(tile===T.DOOR){ if(dist2(L.x,L.y,tx,ty)<=1&&(L.x===tx||L.y===ty)){ setTile(map,tx,ty,T.DOOROPEN); addNoise(0.2); log('The door creaks open.'); computeVis(); R.dirty=true; return; } if(!await walkTo(L,tx,ty)) toast('No path.'); return; }
  if(walkable(tile)) await walkTo(L,tx,ty); }
function isInteractable(e){ if(!e) return false; return (e.type==='obj'&&OBJ_INFO[e.kind]&&OBJ_INFO[e.kind].act&&!e.used)||(e.type==='chest'&&!e.opened)||(e.type==='obstacle'&&!e.cleared)||(e.type==='prisoner'&&!e.freed)||e.type==='questitem'||e.type==='loot'||(e.type==='trap'&&e.found&&!e.disarmed&&!e.triggered)||(e.type==='mon'&&!e.ally&&e.hp>0&&!e.inCombat&&mdef(e).talk); }
function exploreBlocked(h){ const map=G.run.map; const b=heroBlocked(h); return (x,y)=>{ if(activeParty().some(o=>o!==h&&o.x===x&&o.y===y)) return false; if(G.run.map.ents.some(e=>e.ally&&e.hp>0&&e.x===x&&e.y===y)&&!blocksMove(G.run.map,x,y,false,true)) return false; return b(x,y); }; }
function adjacentReachable(L,tx,ty){ const map=G.run.map; const B=bfs(map,L.x,L.y,200,exploreBlocked(L)); let best=null,bd=1e9; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){ const x=tx+dx,y=ty+dy; const k=y*map.w+x; if(B.dist.has(k)&&B.dist.get(k)<bd){ bd=B.dist.get(k); best=[x,y]; } } return best; }
async function walkTo(L,tx,ty){ const map=G.run.map; const B=bfs(map,L.x,L.y,200,exploreBlocked(L)); const path=B.path(tx,ty); if(!path||!path.length) return false;
  G.busy=true; R.hl.path=new Set(path.map(([x,y])=>y*map.w+x)); let ok=true;
  try{ for(const [nx,ny] of path){ if(G.combat||!G.run||G.run.map!==map) { ok=false; break; }
      const t=tileAt(map,nx,ny); if(t===T.DOOR){ setTile(map,nx,ny,T.DOOROPEN); addNoise(0.2); }
      if(t===T.LOCKED||t===T.SECRET){ ok=false; break; }
      const prev=activeParty().filter(h=>h.x!=null&&h.status!=='fallen').map(h=>[h.x,h.y]);
      L.x=nx; L.y=ny; followLeader(L,prev); minionsFollow();
      computeVis(); centerOn(nx,ny); R.dirty=true;
      const tr=map.ents.find(e=>e.type==='trap'&&e.x===nx&&e.y===ny&&!e.disarmed&&!e.triggered);
      if(tr){ await triggerTrap(tr,L); ok=false; break; }
      if(passiveScan()) { ok=false; break; }
      if(await checkDetection()) { ok=false; break; }
      await sleep(85); } }
  finally{ G.busy=false; R.hl.path=null; R.dirty=true; }
  return ok; }
function followLeader(L,prevPos){ // snake follow: each follower steps into the previous position of the one ahead
  const order=activeParty().filter(h=>h.x!=null&&h.status!=='fallen'); const li=order.indexOf(L); const chain=[L,...order.filter(h=>h!==L)];
  const prevMap=new Map(order.map((h,i)=>[h,prevPos[i]]));
  for(let i=1;i<chain.length;i++){ const ahead=chain[i-1], f=chain[i]; const target=prevMap.get(ahead); if(!target) continue; if(dist(f,ahead)<=1&&!(f.x===ahead.x&&f.y===ahead.y)) continue; if(!blocksMove(G.run.map,target[0],target[1],false,true)) { f.x=target[0]; f.y=target[1]; } }
  // de-stack
  for(const f of chain.slice(1)){ if(chain.some(o=>o!==f&&o.x===f.x&&o.y===f.y)) placeNear(f,f.x,f.y); } }
// ---------- passive perception ----------
function bestPassive(sk,extra){ return Math.max(...activeParty().filter(h=>alive(h)&&h.x!=null).map(h=>passive(h,sk)+(extra?extra(h):0))); }
function passiveScan(){ const map=G.run.map; const party=activeParty().filter(h=>alive(h)&&h.x!=null); let found=false;
  for(const e of map.ents){ if(e.type==='trap'&&!e.found&&!e.triggered){ const near=party.filter(h=>dist(h,e)<=2); if(!near.length) continue; const pp=Math.max(...near.map(h=>passive(h,'perception')+(RACES[h.race].trapBonus||0)+(heroFeatures(h).has('naturalExplorer')?2:0))); if(pp>=e.det){ e.found=true; map.explored[e.y*map.w+e.x]=1; log('⚠ Spotted: '+TRAPS[e.trap].n+' (passive '+pp+' vs DC '+e.det+')','good'); toast('Trap spotted: '+TRAPS[e.trap].n); found=true; } }
    if(e.type==='secret'&&!e.found){ const near=party.filter(h=>dist(h,e)<=2); if(!near.length) continue; const pp=Math.max(...near.map(h=>Math.max(passive(h,'perception'),passive(h,'investigation'))+(RACES[h.race].dv&&RACES[h.race].trapBonus?1:0)+(RACES[h.race].n.includes('Elf')?2:0))); if(pp>=e.dc){ revealSecret(e,'passive '+pp); found=true; } }
    if(e.type==='chest'&&e.trap&&!e.trapFound){ const near=party.filter(h=>dist(h,e)<=1); if(near.length&&Math.max(...near.map(h=>passive(h,'investigation')))>=TRAPS[e.trap].det){ e.trapFound=true; log('You notice the chest is trapped ('+TRAPS[e.trap].n+').','good'); } } }
  return found; }
function revealSecret(e,why){ const map=G.run.map; e.found=true; setTile(map,e.x,e.y,T.DOOR); map.explored[e.y*map.w+e.x]=1; log('✦ A secret door is revealed! ('+why+')','good'); toast('Secret door found!'); unlockCodex('shards'); computeVis(); R.dirty=true; }
async function searchArea(){ if(G.combat) return; const L=leader(); const map=G.run.map; let n=0;
  const per=skillCheck(L,'perception',null), inv=skillCheck(L,'investigation',null); await DICE.flush(); const best=Math.max(per.total,inv.total); UI.roll(best===per.total?per.txt:inv.txt,'spell');
  for(const e of map.ents){ if(dist(e,L)>4) continue; if(e.type==='trap'&&!e.found&&best>=e.det){ e.found=true; map.explored[e.y*map.w+e.x]=1; n++; log('⚠ Found: '+TRAPS[e.trap].n,'good'); } if(e.type==='secret'&&!e.found&&best>=e.dc){ revealSecret(e,'search '+best); n++; } if(e.type==='chest'&&e.trap&&!e.trapFound&&best>=TRAPS[e.trap].det){ e.trapFound=true; n++; log('The chest nearby is trapped!','good'); } if(e.type==='mon'&&e.hidden&&best>=10+skillBonus(e,'stealth')){ e.hidden=false; n++; log('You spot a lurking '+mdef(e).n+'!','good'); } }
  if(!n) log('You search carefully but find nothing. (Perception/Investigation '+best+')'); addNoise(0.5); R.dirty=true; await checkDetection(); }
// ---------- detection & encounters ----------
async function checkDetection(){ const map=G.run.map; const party=activeParty().filter(h=>alive(h)&&h.x!=null);
  for(const m of map.ents){ if(m.type!=='mon'||m.ally||m.hp<=0||m.inCombat) continue; if(m.evaded&&party.every(h=>dist(h,m)>2)) continue;
    const md=mdef(m); const range=m.awake||m.hunting?7:4; const seer=party.find(h=>dist(h,m)<=range&&los(map,h.x,h.y,m.x,m.y)); if(!seer) continue;
    const vis=tileVisible(m.x,m.y);
    if(m.hidden||((md.traits||[]).some(t=>['ambusher','falseAppearance','stoneCamo','shadowStealth'].includes(t))&&!m.revealed)){ const st=10+skillBonus(m,'stealth')+(md.traits.includes('stoneCamo')?4:0); const pp=bestPassive('perception'); if(pp<st&&dist(seer,m)<=2){ m.revealed=true; await encounter(m,{ambush:true}); return true; } if(pp>=st) { m.revealed=true; m.hidden=false; } else continue; }
    if(!vis&&dist(seer,m)>2) continue;
    await encounter(m,{}); return true; }
  return false; }
async function encounter(m,opts){ const map=G.run.map; const md=mdef(m); const group=map.ents.filter(e=>e.type==='mon'&&e.hp>0&&e.group===m.group);
  if(opts.ambush){ log('Ambush! '+md.n+' strikes from hiding!','bad'); await startCombat(m,{heroSurprised:true}); return; }
  if(G.run.sneak&&!m.hunting){ // group stealth vs best passive perception
    const pp=Math.max(...group.map(e=>passive(e,'perception'))); const party=activeParty().filter(h=>alive(h)&&h.x!=null); const rolls=party.map(h=>skillCheck(h,'stealth',pp,{passtrace:G.run.passtrace,group:'Group Stealth vs passive Perception '+pp})); await DICE.flush(); const ok=rolls.filter(r=>r.ok).length>=Math.ceil(party.length/2);
    rolls.forEach(r=>log(r.txt,r.ok?'good':'bad')); UI.roll('Group Stealth vs passive Perception '+pp+': '+(ok?'UNSEEN':'SPOTTED'),ok?'hit':'miss');
    if(ok){ const ch=await UI.choice('Unseen','You spot '+group.length+' '+(group.length>1?'foes':'foe')+' ('+[...new Set(group.map(e=>mdef(e).n))].join(', ')+') who have not noticed you.',[{t:'⚔ Ambush (they are surprised)',v:'ambush'},...(md.talk&&!md.boss?[{t:'💬 Approach and talk',v:'talk'}]:[]),{t:'↩ Slip away',v:'away'}]);
      if(ch==='ambush'){ await startCombat(m,{monSurprised:true}); return; } if(ch==='away'){ group.forEach(e=>e.evaded=true); log('You slip past unseen.'); return; } if(ch==='talk'){ await parley(m,group); return; } } }
  if(md.talk&&!m.talked&&!(md.traits||[]).includes('aggressive')&&!m.hunting){ await parley(m,group); return; }
  await startCombat(m,{}); }
async function parley(m,group){ const md=mdef(m); m.talked=true; group.forEach(e=>e.talked=true);
  const cr=Math.max(...group.map(e=>mdef(e).cr)); const dcP=12+Math.round(cr*1.5), dcI=11+Math.round(cr*1.5)+(group.length>2?2:0), dcD=13+Math.round(cr);
  const intro=md.boss?BOSS_TAUNTS[m.mid]||'"So. The Lantern sends its last moths."':pick(['"Halt! Turn back, or we bleed you."','"Who walks in our dark? Speak quick."','"Fresh meat, or fresh coin? Choose."','"Another band of Wardens... come to die?"']);
  const opts=[{t:'⚔ Attack!',v:'fight'}]; if(!md.boss){ opts.push({t:'[Persuasion DC '+dcP+'] Talk them down',v:'persuasion'}); opts.push({t:'[Intimidation DC '+dcI+'] Make them flee',v:'intimidation'}); opts.push({t:'[Deception DC '+dcD+'] Feign friendship, then strike',v:'deception'}); }
  const ch=await UI.choice(md.n,intro,opts,md.art);
  if(ch==='fight'||!ch){ await startCombat(m,{}); return; }
  const h=bestHero(ch); const dc=ch==='persuasion'?dcP:ch==='intimidation'?dcI:dcD; const r=skillCheck(h,ch,dc,{}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad');
  if(!r.ok){ log('They will not be swayed!','bad'); await startCombat(m,{}); return; }
  const xp=group.reduce((a,e)=>a+(CR_XP[mdef(e).cr]||10),0);
  if(ch==='persuasion'){ log('They lower their weapons and let you pass. (+'+Math.round(xp/2)+' XP shared)','good'); shareXP(Math.round(xp/2)); group.forEach(e=>{ e.peaceful=true; e.evaded=true; }); if(Math.random()<0.5){ const g=10+rnd(20)*G.run.tier; G.run.gold+=g; log('They even share a little coin and a rumor ('+g+' gp).','good'); } }
  else if(ch==='intimidation'){ log('They flee into the dark! (+'+Math.round(xp/2)+' XP)','good'); shareXP(Math.round(xp/2)); const map=G.run.map; group.forEach(e=>{ map.ents.splice(map.ents.indexOf(e),1); }); R.dirty=true; }
  else { log('They relax... and you strike!','good'); await startCombat(m,{monSurprised:true}); } }
const BOSS_TAUNTS={ratking:'"Squeak, little lanterns. My children are hungry."',sextonmorr:'"The bell tolls for all. I merely ring it early."',mirewitch:'"Come closer, darlings. The mire remembers your names."',ironwarden:'"INTRUDERS. THE SUNSTONE IS SEALED. RETREAT OR BE UNMADE."',drownedbell:'The great bell groans beneath the water. Something answers.',youngblackdragon:'"Gold, bones and fools. You will make a fine addition to my hoard."',palechoirmaster:'"Ah, the last Lantern-bearers. Sing with me. Everyone does, eventually."'};
function shareXP(x){ const live=activeParty().filter(h=>h.status!=='fallen'); const each=Math.round(x/Math.max(1,live.length)); live.forEach(h=>h.xp+=each); G.run.xp+=x; if(live.some(canLevel)) toast('A hero can level up!'); }
// ---------- traps ----------
async function triggerTrap(e,h){ const tr=TRAPS[e.trap]; e.triggered=true; e.found=true; G.run.map.explored[e.y*G.run.map.w+e.x]=1;
  log('💥 TRAP! '+tr.n+' triggers under '+cName(h)+'!','bad'); UI.roll(tr.n+'!','miss'); addNoise(1);
  const victims=tr.radius?activeParty().filter(o=>alive(o)&&o.x!=null&&dist(o,e)<=tr.radius):[h];
  for(const v of victims){ const s=doSave(v,tr.sv,e.dc,{magic:tr.magic,dt:tr.dt,cond:tr.cond}); await DICE.flush(); log(s.txt,s.ok?'good':'bad'); let d=rollDice(tr.dmg).total; if(s.ok) d=tr.fall?0:Math.floor(d/2); if(v.isHero&&heroFeatures(v).has('evasion')&&tr.sv==='dex') d=s.ok?0:Math.floor(d/2); if(d) dealDamage(v,d,tr.dt,null,{});
    if(!s.ok&&tr.poison&&alive(v)){ const p=doSave(v,'con',e.dc,{cond:'poisoned',dt:'poison'}); await DICE.flush(); if(!p.ok){ dealDamage(v,rollDice(tr.poison).total,'poison',null,{}); applyCond(v,'poisoned',10,null); } }
    if(!s.ok&&tr.cond&&alive(v)) applyCond(v,tr.cond,tr.cond==='restrained'?2:3,null,tr.cond==='restrained'?{save:{a:'str',dc:e.dc}}:{});
    if(!s.ok&&tr.fall&&alive(v)) applyCond(v,'prone',-1,null); }
  UI.refreshParty(); R.dirty=true; await sleep(500);
  if(activeParty().every(o=>!alive(o)||o.x==null)) { tpk(); } }
async function disarmTrap(e){ const tr=TRAPS[e.trap]; const party=activeParty().filter(h=>alive(h)&&h.x!=null);
  const hasTools=G.run.pack.some(i=>i.base==='thievestools')||party.some(h=>h.tools);
  const sk=tr.dskill; const opts=[];
  if(sk==='tools'){ opts.push({t:'[Thieves\' Tools DC '+e.dis+'] Disarm'+(hasTools?'':' (no tools: disadvantage)'),v:'tools'}); }
  else opts.push({t:'['+SKILL_NAME[sk]+' DC '+e.dis+'] Disarm',v:sk});
  opts.push({t:'[Athletics DC '+(e.dis+3)+'] Jam / smash it',v:'athletics'}); if(tr.magic&&party.some(h=>heroSpells(h).includes('dispelmagic'))) opts.push({t:'Cast Dispel Magic',v:'dispel'}); opts.push({t:'Leave it (walk around)',v:'leave'});
  const ch=await UI.choice(tr.n,'A '+tr.n.toLowerCase()+' lies ahead. '+(tr.magic?'Arcane sigils pulse faintly.':'Wires and pressure plates are visible now that you know where to look.'),opts);
  if(!ch||ch==='leave') return;
  if(ch==='dispel'){ const h=party.find(h=>heroSpells(h).includes('dispelmagic')&&hasSlot(h,3)); if(h){ spendSlot(h,lowestSlot(h,3)); e.disarmed=true; log(h.name+' dispels the trap.','good'); return; } }
  const skill=ch==='tools'?'tools':ch; const h=bestHero(skill,party); const dc=ch==='athletics'?e.dis+3:e.dis;
  const r=skillCheck(h,skill,dc,{adv:false,bonus:(ch==='tools'&&!hasTools)?-5:0}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad');
  if(r.ok){ e.disarmed=true; log('The trap is disarmed. (+'+(25*(1+G.run.tier))+' XP)','good'); shareXP(25*(1+G.run.tier)); if(Math.random()<0.4){ const mat=makeItem('iron'); stackAdd(G.run.pack,mat); log('Salvaged Iron Scrap from the mechanism.'); } }
  else if(r.total<=dc-5){ log('Something clicks...','bad'); await triggerTrap(e,h); }
  else log('You fail to disarm it, but nothing happens.'); R.dirty=true; }
// ---------- interactions ----------
async function interact(e,x,y){ const map=G.run.map; const t=tileAt(map,x,y); const L=leader();
  if(t===T.DOWN){ const ok=await UI.choice('Descend','Stairs lead deeper into the dark. Descend to floor '+(G.run.floor+1)+'?',[{t:'Descend',v:'y'},{t:'Not yet',v:'n'}]); if(ok==='y'){ G.run.floor++; enterFloor(); } return; }
  if(t===T.UP){ const ok=await UI.choice('Leave the dungeon','Climb back toward daylight and return to the Last Lantern?'+(G.run.objectiveDone||G.run.kind!=='story'?'':' (The chapter\'s foe still lives.)'),[{t:'Return to the tavern',v:'y'},{t:'Stay',v:'n'}]); if(ok==='y') returnToTavern(false); return; }
  if(t===T.LOCKED){ const lk=map.ents.find(q=>q.type==='lock'&&q.x===x&&q.y===y); await openLock(lk,'door',()=>{ setTile(map,x,y,T.DOOROPEN); lk.open=true; computeVis(); }); return; }
  if(!e) return;
  if(e.type==='trap') return disarmTrap(e);
  if(e.type==='chest') return openChest(e);
  if(e.type==='obstacle') return obstacle(e);
  if(e.type==='loot'){ takeLoot(e.items,e.gold,'You search the remains.'); map.ents.splice(map.ents.indexOf(e),1); R.dirty=true; return; }
  if(e.type==='questitem'){ const it=makeItem('quest',{qid:e.qid,qname:e.n}); it.qitem=e.item; stackAdd(G.run.pack,it); questProgress(e.qid,1); map.ents.splice(map.ents.indexOf(e),1); log('✦ Recovered: '+e.n+'!','good'); UI.story(e.n,'You pry it from the dust and dead hands. It hums with old oaths.'); R.dirty=true; return; }
  if(e.type==='prisoner') return freePrisoner(e);
  if(e.type==='mon'){ if(e.peaceful){ toast('They watch you warily.'); return; } return parley(e,map.ents.filter(o=>o.type==='mon'&&o.group===e.group&&o.hp>0)); }
  if(e.type==='obj') return objAction(e); }
async function openLock(lk,what,onOpen){ const party=activeParty().filter(h=>alive(h)&&h.x!=null); const hasTools=G.run.pack.some(i=>i.base==='thievestools')||party.some(h=>h.tools); const crow=G.run.pack.some(i=>i.base==='crowbar'); const dc=lk.dc;
  const knock=party.find(h=>heroSpells(h).includes('knock')&&hasSlot(h,2));
  const opts=[{t:'[Thieves\' Tools DC '+dc+'] Pick the lock'+(hasTools?'':' (no tools: -5)'),v:'pick'},{t:'[Athletics DC '+(dc+2)+'] Force it'+(crow?' (crowbar: advantage)':'')+' — noisy',v:'force'}];
  if(knock) opts.push({t:'Cast Knock ('+knock.name+')',v:'knock'}); if(what==='door') opts.push({t:'Batter it down (10 minutes, very loud, a hero takes 1d4 bruises) — always works',v:'bash'}); opts.push({t:'Leave it',v:'leave'});
  const ch=await UI.choice('Locked '+what,'The '+what+' is locked fast with old iron.',opts);
  if(ch==='bash'){ const h=bestHero('athletics',party); const d=1+rnd(4); h.hp=Math.max(1,h.hp-d); log(h.name+' batters the door off its hinges (-'+d+' HP). The din echoes through the halls!','bad'); addNoise(3); if(typeof passTime==='function') passTime(10); onOpen(); UI.refreshParty&&UI.refreshParty(); R.dirty=true; return true; }
  if(ch==='knock'){ spendSlot(knock,lowestSlot(knock,2)); log(knock.name+' casts Knock. The lock bursts open with a loud clang!','good'); addNoise(2); onOpen(); R.dirty=true; return true; }
  if(ch==='pick'){ const h=bestHero('tools',party); const r=skillCheck(h,'tools',dc,{bonus:hasTools?0:-5}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad'); if(r.ok){ onOpen(); shareXP(10*(1+G.run.tier)); R.dirty=true; return true; } if(r.nat===1){ log('Your pick snaps in the lock.','bad'); lk.dc+=2; } addNoise(0.5); return false; }
  if(ch==='force'){ const h=bestHero('athletics',party); const r=skillCheck(h,'athletics',dc+2,{adv:crow}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad'); addNoise(1.5); if(r.ok){ onOpen(); R.dirty=true; return true; } return false; }
  return false; }
async function openChest(e){ const tr=e.trap?TRAPS[e.trap]:null;
  if(tr&&e.trapFound&&!e.trapDisarmed){ const party=activeParty().filter(h=>alive(h)&&h.x!=null); const ch=await UI.choice('Trapped chest','A '+tr.n.toLowerCase()+' guards this chest.',[{t:'['+(tr.dskill==='tools'?'Thieves\' Tools':SKILL_NAME[tr.dskill])+' DC '+tr.dis+'] Disarm',v:'d'},{t:'Open it anyway',v:'o'},{t:'Leave it',v:'l'}]); if(ch==='l'||!ch) return; if(ch==='d'){ const h=bestHero(tr.dskill,party); const r=skillCheck(h,tr.dskill,tr.dis,{}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad'); if(r.ok) e.trapDisarmed=true; else if(r.total<=tr.dis-5){ await triggerTrap({trap:e.trap,x:e.x,y:e.y,dc:tr.dc},leader()); e.trapDisarmed=true; } else return; } }
  if(e.locked){ const ok=await openLock(e,'chest',()=>{ e.locked=false; }); if(!ok) return; }
  if(tr&&!e.trapDisarmed){ await triggerTrap({trap:e.trap,x:e.x,y:e.y,dc:tr.dc},leader()); e.trapDisarmed=true; }
  e.opened=true; const loot=rollLoot(G.run.tier,e.rich); takeLoot(loot.items,loot.gold,e.rich?'A heavy, iron-bound chest!':'You open the chest.'); R.dirty=true; }
function takeLoot(items,gold,title){ items=items||[]; for(const it of items) stackAdd(G.run.pack,it); if(gold) G.run.gold+=gold; const txt=(gold?gold+' gold':'')+(items.length?(gold?', ':'')+items.map(i=>itemName(i)).join(', '):''); log('💰 '+(txt||'Nothing of value.'),'good'); if(items.length||gold) UI.lootPopup(title||'Loot',items,gold); UI.refreshParty(); }
async function obstacle(e){ const ob=OBSTACLES[e.ob]; const party=activeParty().filter(h=>alive(h)&&h.x!=null); const has=k=>G.run.pack.some(i=>i.base===k);
  const opts=ob.opts.map((o,i)=>({t:'['+SKILL_NAME[o.s]+' DC '+(o.dc+e.bump)+'] '+o.t+(o.adv&&has(o.adv)?' ('+GEAR[o.adv].n+': adv)':''),v:i})); opts.push({t:'Turn back',v:'back'});
  const ch=await UI.choice(ob.n,ob.d,opts); if(ch==='back'||ch==null) return; const o=ob.opts[ch]; const dc=o.dc+e.bump;
  const results=[]; let allOk=true; const bestH=bestHero(o.s,party);
  // the best hero leads; others make the check too (group check: half must succeed) — failures take damage
  for(const h of party){ const r=skillCheck(h,o.s,dc,{adv:o.adv&&has(o.adv),bonus:h===bestH?0:0,group:ob.n+' (group check)'}); results.push([h,r]); log(r.txt,r.ok?'good':'bad'); } await DICE.flush();
  const okN=results.filter(([h,r])=>r.ok).length; const pass=okN>=Math.ceil(party.length/2);
  UI.roll(ob.n+': '+okN+'/'+party.length+' succeed — '+(pass?'the party gets through':'the party is turned back'),pass?'hit':'miss');
  for(const [h,r] of results){ if(!r.ok){ dealDamage(h,rollDice(ob.fail).total,ob.dt,null,{}); if(ob.poison){ const s=doSave(h,'con',dc,{cond:'poisoned'}); if(!s.ok) applyCond(h,'poisoned',10,null); } } } await DICE.flush();
  if(pass){ e.cleared=true; shareXP(20*(1+G.run.tier)); log('The way is clear.','good'); } R.dirty=true; UI.refreshParty(); }
async function freePrisoner(e){ const ch=await UI.choice('A prisoner','You find '+e.n+', bound in rusted chains.',[{t:'[Thieves\' Tools DC '+e.dc+'] Pick the shackles',v:'tools'},{t:'[Athletics DC '+(e.dc+2)+'] Break the chains',v:'athletics'},{t:'[Persuasion DC 10] Calm them first, then search the guards\' keys',v:'persuasion'},{t:'Leave',v:'leave'}]);
  if(!ch||ch==='leave') return; const h=bestHero(ch); const dc=ch==='tools'?e.dc:ch==='athletics'?e.dc+2:10+G.run.tier*2; const r=skillCheck(h,ch,dc,{}); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad'); if(ch==='athletics') addNoise(1);
  if(!r.ok){ log('The chains hold. Try another way.'); return; }
  e.freed=true; const map=G.run.map; map.ents.splice(map.ents.indexOf(e),1); shareXP(50*(1+G.run.tier));
  if(e.qid){ questProgress(e.qid,1); UI.story('Rescued','Elsa clutches your sleeve. "My brother... he didn\'t make it. But I knew someone would come." She will make her own way to the Last Lantern.'); }
  else if(e.reward==='recruit'){ const lvl=Math.max(1,Math.floor(partyLevel())); const rec=autoHero(pick(Object.keys(CLASSES)),lvl); rec.bio='Rescued from '+REGIONS[G.run.region].n+'.'; G.recruits.push(rec); log('The Warden scout will meet you at the tavern as a recruit (free).','good'); rec.free=true; }
  else if(e.reward==='gold'){ const g=40+rnd(60)*(1+G.run.tier); G.run.gold+=g; log('Grateful, they press '+g+' gold into your hands.','good'); }
  else if(e.reward==='blessing'){ activeParty().forEach(h=>{ if(alive(h)) healC(h,10+G.run.tier*5); }); log('The acolyte prays over your wounds.','good'); }
  else if(e.reward==='map'){ for(let i=0;i<map.t.length;i++) if(map.t[i]!==T.WALL) map.explored[i]=1; map.ents.filter(x=>x.type==='secret').forEach(s=>{ if(!s.found) revealSecret(s,'the miner\'s map'); }); log('The miner sketches this level for you, secret ways and all.','good'); }
  adjustRep('lantern',2); R.dirty=true; }
function questProgress(qid,n){ const q=G.quests.active.find(q=>q.id===qid); if(!q) return; const d=SIDE_QUESTS[qid]; q.progress=Math.min(d.count,(q.progress||0)+n); if(q.progress>=d.count) toast('Quest objective complete: '+d.n); }
function adjustRep(f,n){ G.rep[f]=(G.rep[f]||0)+n; }
async function objAction(e){ const map=G.run.map; const info=OBJ_INFO[e.kind]; const party=activeParty().filter(h=>alive(h)&&h.x!=null); const tier=G.run.tier; const dc=e.dc||12+tier;
  const quest=id=>G.quests.active.find(q=>q.id===id&&q.progress<SIDE_QUESTS[id].count);
  const simple=async(title,text,opts)=>UI.choice(title,text,opts);
  switch(info.act){
    case 'smash':{ e.used=true; e.broken=true; addNoise(0.5); if(Math.random()<0.4){ const l=rollLoot(Math.max(0,tier-1),false); takeLoot(l.items.slice(0,1),Math.round(l.gold/3),'Inside the '+info.n.toLowerCase()); } else log('You smash the '+info.n.toLowerCase()+'. Nothing but rot and splinters.'); R.dirty=true; return; }
    case 'search':{ e.used=true; const r=skillCheck(bestHero('investigation',party),'investigation',10+tier); await DICE.flush(); log(r.txt); if(r.ok){ const it=Math.random()<0.5?makeItem(pick(['bone','bone','ash'])):makeItem(pick(['potheal','torch','rations'])); takeLoot([it],rnd(10)*(1+tier),'Among the bones'); } else log('Only old bones.'); return; }
    case 'books':{ const ch=await simple(info.n,'Mouldering books, swollen with damp.',[{t:'[Investigation DC '+dc+'] Search the shelves',v:'inv'},{t:'[History DC '+(dc+1)+'] Study the titles',v:'his'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true; const sk=ch==='inv'?'investigation':'history'; const r=skillCheck(bestHero(sk,party),sk,ch==='inv'?dc:dc+1); await DICE.flush(); UI.roll(r.txt,r.ok?'hit':'miss'); log(r.txt,r.ok?'good':'bad'); if(!r.ok){ log('The pages crumble at your touch.'); return; }
      if(quest('sq_tomes')&&Math.random()<0.75){ const it=makeItem('quest',{qid:'sq_tomes',qname:'Vellmoran Folio'}); stackAdd(G.run.pack,it); questProgress('sq_tomes',1); UI.story('A Vellmoran Folio','Between two rotten ledgers: a folio bound in grey vellum, its ink still bright.'); return; }
      if(sk==='history'){ const lore=pick(['night','wardens','palechoir','shards','lastlantern','rot','greyspire']); if(!unlockCodex(lore)) { shareXP(20); log('Nothing new, but you learn something (+20 XP).'); } return; }
      takeLoot([makeItem('scroll',{maxL:clamp(1+tier,1,5)})],0,'Hidden among the books'); return; }
    case 'coffin':{ const ch=await simple(info.n,'A coffin, lid askew. Something might still be inside.',[{t:'[Athletics DC '+(dc-2)+'] Heave the lid',v:'a'},{t:'[Religion DC '+dc+'] Say the rites first, then open',v:'r'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true; const sk=ch==='a'?'athletics':'religion'; const r=skillCheck(bestHero(sk,party),sk,ch==='a'?dc-2:dc); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss');
      if(r.ok){ const l=rollLoot(tier,false); takeLoot(l.items,l.gold,'Grave goods'); if(sk==='religion') adjustRep('rose',1); } else { const pool=MONSTER_LIST.filter(m=>m.type==='undead'&&m.cr<=Math.max(0.25,G.run.lvl/3)&&!m.boss); if(pool.length){ const mm=mkMon(pick(pool),e.x,e.y,999); placeNear(mm,e.x,e.y); mm.awake=true; map.ents.push(mm); log('The dead within stirs!','bad'); await startCombat(mm,{}); } } return; }
    case 'statue':{ const ch=await simple(info.n,'A weathered statue of a forgotten Warden. Letters are carved into the plinth.',[{t:'[History DC '+dc+'] Read the inscription',v:'h'},{t:'[Investigation DC '+(dc+2)+'] Look for a mechanism',v:'i'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true; const sk=ch==='h'?'history':'investigation'; const r=skillCheck(bestHero(sk,party),sk,ch==='h'?dc:dc+2); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss');
      if(r.ok&&sk==='history'){ const n=1+Math.min(5,G.codex.filter(c=>c.startsWith('inscription')).length); if(!unlockCodex('inscription'+n)) shareXP(30); }
      else if(r.ok){ const s=map.ents.find(x=>x.type==='secret'&&!x.found); if(s){ revealSecret(s,'statue mechanism'); } else takeLoot([randomGear(tier)],0,'A hidden niche'); } return; }
    case 'brazier':{ e.out=!e.out; log(e.out?'You douse the brazier. Darkness hides you.':'You rekindle the brazier. Light floods the room.'); computeVis(); R.dirty=true; return; }
    case 'mushrooms':{ const ch=await simple(info.n,'Pale, faintly glowing fungus.',[{t:'[Nature DC '+(dc-1)+'] Harvest carefully',v:'n'},{t:'Leave',v:'l'}]); if(ch!=='n') return; e.used=true; const r=skillCheck(bestHero('nature',party),'nature',dc-1); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss');
      if(r.ok){ if(quest('sq_moss')&&G.run.region==='blackwood'){ const it=makeItem('quest',{qid:'sq_moss',qname:'Grave Moss'}); stackAdd(G.run.pack,it); questProgress('sq_moss',1); log('✦ You harvest a bundle of Grave Moss!','good'); } else { takeLoot([makeItem(pick(['potheal','antitoxin','ichor']))],0,'Alchemical fungus'); } } else { const h=party[0]; const s=doSave(h,'con',dc,{cond:'poisoned'}); await DICE.flush(); if(!s.ok){ applyCond(h,'poisoned',10,null); log('Spores! '+h.name+' is poisoned.','bad'); } } return; }
    case 'web':{ e.used=true; const r=skillCheck(bestHero('athletics',party),'athletics',dc-2); await DICE.flush(); log(r.txt); if(r.ok){ log('You tear the webs away.'); map.ents.splice(map.ents.indexOf(e),1); } else { log('The webs cling stubbornly.'); e.used=false; } R.dirty=true; return; }
    case 'pool': case 'fountain':{ const ch=await simple(info.n,e.kind==='fountain'?'A fountain of black water. Coins glint at the bottom.':'A still pool, darker than the dark around it.',[{t:'[Arcana DC '+dc+'] Study its magic',v:'a'},{t:'Drink',v:'d'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true;
      if(ch==='a'){ const r=skillCheck(bestHero('arcana',party),'arcana',dc); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss'); if(r.ok){ if(Math.random()<0.6){ party.forEach(h=>healC(h,8+tier*4)); log('A healing spring! The party drinks deep.','good'); } else { log('It is cursed — you wisely leave it be, but fish out '+(15*(1+tier))+' gold.','good'); G.run.gold+=15*(1+tier); } } return; }
      if(Math.random()<0.5){ party.forEach(h=>healC(h,6+tier*3)); log('The water is sweet and restoring.','good'); } else { const h=party[0]; dealDamage(h,rollDice((1+tier)+'d6').total,'necrotic',null,{}); log('The water burns like grave-cold!','bad'); } return; }
    case 'anvil':{ e.used=true; const r=skillCheck(bestHero('athletics',party),'athletics',dc-2); await DICE.flush(); log(r.txt); takeLoot([makeItem('iron'),makeItem('iron')],0,'Scrap iron'); return; }
    case 'candles':{ e.used=true; const ch=await simple(info.n,'Votive candles still burn here. Who lit them?',[{t:'[Religion DC '+(dc-1)+'] Pray',v:'r'},{t:'Snuff them (stealthier)',v:'s'}]); if(ch==='s'){ e.out=true; log('Darkness returns.'); computeVis(); return; } const r=skillCheck(bestHero('religion',party),'religion',dc-1); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); if(r.ok){ party.forEach(h=>addFx(h,{id:'blessed',rounds:20})); log('A faint warmth: the party is Blessed for the next fight.','good'); } return; }
    case 'altar':{ const ch=await simple(info.n,'A blackened altar, stained with old offerings.',[{t:'[Religion DC '+dc+'] Consecrate it',v:'r'},{t:'[Arcana DC '+dc+'] Drain its power',v:'a'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true; const sk=ch==='r'?'religion':'arcana'; const r=skillCheck(bestHero(sk,party),sk,dc); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss');
      if(r.ok){ if(sk==='religion'){ party.forEach(h=>{ healC(h,10+tier*5); remFx(h,'cursed'); }); adjustRep('rose',3); log('The altar is cleansed. The Rose will hear of it.','good'); } else { takeLoot([makeItem('essence'),makeItem('arcane')],0,'Distilled essence'); } } else { party.forEach(h=>{ const s=doSave(h,'wis',dc,{magic:1}); if(!s.ok) applyCond(h,'frightened',3,null); }); await DICE.flush(); log('Whispers flood your minds!','bad'); } return; }
    case 'corpse':{ const ch=await simple(info.n,'A fallen adventurer, not long dead.',[{t:'[Medicine DC '+(dc-2)+'] Examine the body',v:'m'},{t:'Loot the body',v:'l'},{t:'Leave',v:'x'}]); if(ch==='x'||!ch) return; e.used=true;
      if(ch==='m'){ const r=skillCheck(bestHero('medicine',party),'medicine',dc-2); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); if(r.ok){ const near=map.ents.filter(x=>x.type==='trap'&&!x.found&&dist(x,e)<=8); near.forEach(t=>{ t.found=true; map.explored[t.y*map.w+t.x]=1; }); log('Puncture wounds and burns: '+(near.length?'you deduce the location of '+near.length+' nearby trap(s)!':'killed by something that is gone now.'),'good'); } }
      const l=rollLoot(tier,false); takeLoot(l.items,l.gold,'The adventurer\'s pack'); if(!G.codex.includes('wardens')) unlockCodex('wardens'); return; }
    case 'lever':{ e.used=true; const s=map.ents.find(x=>x.type==='secret'&&!x.found); if(s) revealSecret(s,'lever'); else log('Somewhere, a grinding of stone.'); addNoise(1); return; }
    case 'sarcophagus':{ const ch=await simple(info.n,'A sealed sarcophagus bearing a Warden\'s seal.',[{t:'[Athletics DC '+(dc+1)+'] Force the lid',v:'a'},{t:'[Religion DC '+dc+'] Break the seal with the proper rite',v:'r'},{t:'Leave',v:'l'}]); if(ch==='l'||!ch) return; e.used=true; const sk=ch==='a'?'athletics':'religion'; const r=skillCheck(bestHero(sk,party),sk,ch==='a'?dc+1:dc); await DICE.flush(); log(r.txt,r.ok?'good':'bad'); UI.roll(r.txt,r.ok?'hit':'miss');
      if(r.ok){ const l=rollLoot(tier+1,true); takeLoot(l.items,l.gold,'The Warden\'s burial goods'); } else { const pool=MONSTER_LIST.filter(m=>m.type==='undead'&&m.cr<=Math.max(0.5,G.run.lvl/2)&&!m.boss); const mm=mkMon(pick(pool),e.x,e.y,998); placeNear(mm,e.x,e.y); mm.awake=true; map.ents.push(mm); log('The occupant rises in fury!','bad'); await startCombat(mm,{}); } return; }
  } }
// ---------- rests ----------
async function shortRest(){ if(G.combat) return; const r=G.run; const rat=r.pack.find(i=>i.base==='rations');
  if(r.rests>=2){ toast('You cannot rest again on this floor.'); return; } if(!rat){ toast('You need Rations to rest.'); return; }
  const ok=await UI.choice('Short Rest','Spend one ration and an hour resting? Heroes may spend Hit Dice to heal and recover short-rest abilities. Wandering monsters may find you.',[{t:'Rest',v:'y'},{t:'Cancel',v:'n'}]); if(ok!=='y') return;
  consumeItem(rat); r.rests++; doShortRest(activeParty().filter(h=>h.status!=='fallen'));
  if(Math.random()<0.25+0.1*r.rests){ log('Your rest is interrupted!','bad'); spawnWanderers(); await checkDetection(); } else log('The party rests for an hour.','good'); UI.refreshParty(); autosave(); }
function doShortRest(list){ dismissMinions(list,'the rest breaks the binding'); for(const h of list){ if(h.hp<=0) h.hp=1; remFx(h,'unconscious'); const c=getClass(h.cls); let hd=h.hd==null?h.level:h.hd; const songB=list.some(o=>heroFeatures(o).has('songRest'))?die(6):0;
    while(hd>0&&h.hp<heroMaxHP(h)*0.75){ hd--; let r=die(c.hd)+abilMod(h,'con'); if(hasFx(h,'hdDouble')||gearFx(h).hdDouble) r*=2; healC(h,Math.max(1,r)); } if(songB) healC(h,songB); h.hd=hd; restoreRes(h,false); if(getClass(h.cls).caster==='pact') restoreSlots(h);
    if(heroFeatures(h).has('arcaneRecovery')&&h.res.arec>0){ h.res.arec--; const n=Math.ceil(h.level/2); let left=n; for(let l=Math.min(5,maxSpellLevel(h));l>=1&&left>0;l--){ while(left>=l&&(h.slots[l]||0)<slotMax(h)[l]){ h.slots[l]++; left-=l; } } }
    if(heroFeatures(h).has('naturalRecovery')&&h.res.nrec>0){ h.res.nrec--; let left=Math.ceil(h.level/2); for(let l=Math.min(5,maxSpellLevel(h));l>=1&&left>0;l--){ while(left>=l&&(h.slots[l]||0)<slotMax(h)[l]){ h.slots[l]++; left-=l; } } } } }
function longRest(h){ if(G.run&&G.run.map) dismissMinions([h],'the rest breaks the binding'); h.hp=heroMaxHP(h); h.tempHp=0; h.hd=h.level; restoreRes(h,true); restoreSlots(h); h.fx=(h.fx||[]).filter(f=>f.id==='cursed'||f.id==='diseased'); h.deathS={s:0,f:0}; h.tmpStrDrain=0; h.aid=0; h.wardHp=0; }
// ---------- return ----------
function returnToTavern(writ){ const r=G.run; if(!r) return; if(G.combat){ G.combat=null; UI.exitCombat(); }
  const party=activeParty(); const lines=[];
  if(r.tpk){ const lost=Math.floor(r.gold/2); r.gold-=lost; const keep=r.pack.filter(i=>i.kind==='quest'); r.pack=keep; lines.push('The Wardens of the Lantern dragged your broken bodies home. You lost half your gold ('+lost+') and your pack.'); }
  for(const it of r.pack) stackAdd(G.stash,it); G.gold+=r.gold;
  for(const h of party){ if(h.status==='fallen'||r.tpk){ const inj=addInjury(h,r.tpk&&h.status!=='fallen'?2:3); h.status='ok'; h._fallen=false; lines.push(h.name+(inj?' suffers a lasting injury: '+inj.n:' recovers')+'.'); } h.x=null; h.y=null; h.fx=(h.fx||[]).filter(f=>f.id==='cursed'||f.id==='diseased'); h.conc=null; h.tempHp=0; if(h.hp<=0) h.hp=1; }
  const days=1+(r.floor>1?1:0)+(r.tpk?2:0); advanceDays(days);
  if(r.kind==='story'&&r.objectiveDone){ const ch=STORY[r.ref]; if(!G.story.done.includes(ch.id)){ G.story.done.push(ch.id); G.story.ch=Math.min(STORY.length-1,r.ref+1); G.renown+=2+r.ref; logJournal('Chapter complete: '+ch.n+'.'); lines.push('★ Chapter complete: '+ch.n+'.'); const nx=STORY[r.ref+1]; if(nx) REGIONS[nx.region]&&(G.flags['unlock_'+nx.region]=true); G._pendingOutro=ch; } }
  if(r.kind!=='story') G.renown+=0;
  logJournal('Returned to the Last Lantern with '+r.gold+' gold and '+r.pack.length+' items.'+(r.tpk?' (defeated)':''));
  const summary={gold:r.gold,items:r.pack.length,xp:r.xp,kills:r.kills.length,lines,writ};
  G.run=null; G.combat=null; G.screen='tavern'; autosave(); UI.showTavern(); UI.returnSummary(summary); }
function advanceDays(n){ for(let i=0;i<n;i++){ G.day++; for(const h of G.roster){ for(const inj of (h.injuries||[])){ inj.days-=1+(G.tavern.infirmary>=2?1:0); } const before=(h.injuries||[]).length; h.injuries=(h.injuries||[]).filter(x=>x.days>0||INJURIES.find(d=>d.id===x.id).perm); if(h.injuries.length<before){ h._fcache=null; logJournal(h.name+'\'s injury has healed.'); } longRest(h); } } refreshMarket(); }
