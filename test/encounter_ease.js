// Deterministic regression for ENCOUNTER_EASE_V1.
// Run: node test/encounter_ease.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dungeonSrc = fs.readFileSync(path.join(root, 'js/dungeon.js'), 'utf8');
if (!dungeonSrc.includes('ENCOUNTER_EASE_V1')) {
  console.error('FAIL: js/dungeon.js is missing the ENCOUNTER_EASE_V1 marker');
  process.exit(1);
}
const core = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'js/combat.js'), 'utf8');
const heroes = fs.readFileSync(path.join(root, 'js/heroes.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const explore = fs.readFileSync(path.join(root, 'js/explore.js'), 'utf8');
if (!core.includes('G.combat.xp+=(CR_XP[m.cr]||10)*(m.boss?2:1)')) {
  console.error('FAIL: on-kill XP rule changed');
  process.exit(1);
}
if (combat.includes('ENCOUNTER_EASE') || heroes.includes('ENCOUNTER_EASE') || explore.includes('ENCOUNTER_EASE')) {
  console.error('FAIL: ease leaked into heroes, combat, or expedition flow');
  process.exit(1);
}
if (main.includes('genDungeon') || !explore.includes('r.map=genDungeon(')) {
  console.error('FAIL: map generation is not limited to enterFloor');
  process.exit(1);
}

const files = ['js/rules.js', 'js/data_core.js', 'js/data_monsters.js', 'js/data_world.js', 'js/dungeon.js'];
const src = 'var PARTY=[];\nfunction activeParty(){ return PARTY; }\n' + files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');

const context = { console, Math, Date, Object, Array, Set, Map, JSON, Error, parseInt, String, Number, isNaN, Math };
vm.createContext(context);
vm.runInContext(src, context, { filename: 'last-lantern-bundle.js' });

const result = vm.runInContext(`
(function(){
  const fails = [];
  function fail(m){ fails.push(m); }
  function oldBudget(pc,lvl,floor,roll){
    const MED=[50,100,150,250,500,600,750,900,1100,1200,1600,2000];
    return pc*MED[clamp(Math.round(lvl)-1,0,11)]*(0.5+roll*0.45)*(1+(floor-1)*0.1);
  }
  if(ENCOUNTER_EASE_V1!==0.9) fail('ease constant is '+ENCOUNTER_EASE_V1);
  const rolls=[];
  for(let i=0;i<=20;i++) rolls.push(i/20);
  for(const pc of [1,2,3,4,6]) for(const lvl of [1,2,3,4,5,6,8,10,12,12.4]) for(const floor of [1,2,3,4]) for(const roll of rolls){
    const oldB=oldBudget(pc,lvl,floor,roll);
    const hist=encounterXpBudget(pc,lvl,floor,roll,1);
    const eased=encounterXpBudget(pc,lvl,floor,roll,ENCOUNTER_EASE_V1);
    if(hist!==oldB) fail('historical budget drifted pc='+pc+' lvl='+lvl+' floor='+floor+' roll='+roll);
    if(eased!==oldB*0.9) fail('eased budget is not 90% pc='+pc+' lvl='+lvl+' floor='+floor+' roll='+roll+' got='+eased+' want='+(oldB*0.9));
    if(encounterXpBudget(pc,lvl,floor,roll)!==eased) fail('default ease is not ENCOUNTER_EASE_V1');
  }
  // Party-level and floor scaling stay in the base: the ratio is exactly 0.9 at every level and floor.
  const b1=encounterXpBudget(4,1,1,0.25,1), e1=encounterXpBudget(4,1,1,0.25);
  const b8=encounterXpBudget(4,8,3,0.25,1), e8=encounterXpBudget(4,8,3,0.25);
  if(e1/b1!==0.9 || e8/b8!==0.9) fail('scaling ratio is not flat 0.9');
  if(b8<=b1) fail('higher level did not raise the historical budget');
  const goblins=[1,2,3,4].map(()=>({mid:'goblin'}));
  if(regularGroupKeep(goblins,400)!==4) fail('historical keep on four goblins');
  if(regularGroupKeep(goblins,400*0.9)!==3) fail('90% budget did not drop the goblin tail');
  if(encounterAdjustedXp([50,50,50])>=encounterAdjustedXp([50,50,50,50])) fail('dropping the tail did not lower adjusted XP');

  function mulberry(seed){
    let a=seed>>>0;
    return function(){
      a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  const bossIds=new Set(Object.keys(MONSTERS).filter(id=>MONSTERS[id].boss));
  function slimMon(e){ return {mid:e.mid,hp:e.hp,hpMax:e.hpMax,x:e.x,y:e.y,group:e.group}; }
  function rewardSig(map){
    const bosses=map.ents.filter(e=>e.type==='mon'&&bossIds.has(e.mid)).map(slimMon);
    const bossGroups=new Set(bosses.map(e=>e.group));
    const minions=map.ents.filter(e=>e.type==='mon'&&bossGroups.has(e.group)&&!bossIds.has(e.mid)).map(slimMon);
    const rest=map.ents.filter(e=>e.type!=='mon').map(e=>{
      const o={type:e.type,x:e.x,y:e.y};
      for(const k of ['rich','locked','dc','trap','kind','reward','qid','n','item','gold','ob','bump','det','dis']) if(e[k]!==undefined) o[k]=e[k];
      return o;
    });
    return JSON.stringify({tiles:map.t.join(','), seed:map.seed, start:map.start, down:map.down, bossRoom:map.bossRoom, bosses, minions, rest});
  }
  function regularXp(map){
    const bossGroups=new Set(map.ents.filter(e=>e.type==='mon'&&bossIds.has(e.mid)).map(e=>e.group));
    const by=new Map();
    for(const e of map.ents){ if(e.type!=='mon'||bossGroups.has(e.group)) continue; const xp=CR_XP[MONSTERS[e.mid].cr]||10; if(!by.has(e.group)) by.set(e.group,[]); by.get(e.group).push(xp); }
    let total=0;
    for(const xs of by.values()) total+=encounterAdjustedXp(xs);
    return {total, by};
  }
  function gen(seed, ease, pc, opts){
    PARTY=Array.from({length:pc},()=>({}));
    Math.random=mulberry(seed);
    return genDungeon(Object.assign({}, opts, {encounterEase:ease}));
  }
  function regularMids(map){
    const bossGroups=new Set(map.ents.filter(e=>e.type==='mon'&&bossIds.has(e.mid)).map(e=>e.group));
    const by=new Map();
    for(const e of map.ents){ if(e.type!=='mon'||bossGroups.has(e.group)) continue; if(!by.has(e.group)) by.set(e.group,[]); by.get(e.group).push(e.mid); }
    return by;
  }
  const cases=[];
  for(const pc of [1,3,4]) for(const lvl of [1,3,5,8]) for(const floor of [1,2]){
    const last=floor>=2;
    cases.push({pc, opts:{theme: floor===2?'crypt':'cellar', floor, floors:2, tier:Math.min(4,Math.floor((lvl+1)/3)), boss:last?'ratking':null, lvl, questItem:last?{qid:'q',item:'oathkeeper',n:'Oathkeeper'}:null, rescue:last?'q':null}});
  }
  let histXp=0, easeXp=0, reduced=0, compared=0;
  for(let seed=1; seed<=12; seed++){
    for(const c of cases){
      const a=gen(seed, 1, c.pc, c.opts);
      const b=gen(seed, 0.9, c.pc, c.opts);
      compared++;
      if(rewardSig(a)!==rewardSig(b)) fail('boss/reward/layout diverged seed='+seed+' pc='+c.pc+' lvl='+c.opts.lvl+' floor='+c.opts.floor);
      for(const e of b.ents) if(e.type==='mon'&&bossIds.has(e.mid)){
        const tpl=MONSTERS[e.mid];
        if(e.hp!==tpl.hp||e.hpMax!==tpl.hp) fail('boss hp scaled '+e.mid);
      }
      const boss=b.ents.find(e=>e.type==='mon'&&e.mid==='ratking');
      if(c.opts.boss){
        if(!boss) fail('missing boss seed='+seed);
        else {
          const minions=b.ents.filter(e=>e.type==='mon'&&e.group===boss.group&&e.mid!=='ratking');
          const want=Math.min(4,Math.max(1,c.pc-2));
          if(minions.length!==want) fail('minion count '+minions.length+' != '+want+' seed='+seed+' pc='+c.pc);
          for(const m of minions){ const tpl=MONSTERS[m.mid]; if(m.hp!==tpl.hp||m.hpMax!==tpl.hp) fail('minion hp scaled '+m.mid); }
        }
      } else if(boss) fail('boss spawned before the last floor');
      const am=regularMids(a), bm=regularMids(b);
      for(const [gid,mids] of bm){
        const prev=am.get(gid);
        if(!prev) fail('eased group was not in the historical roll');
        else if(prev.slice(0,mids.length).join(',')!==mids.join(',')) fail('eased group is not a prefix of the historical roll');
        else if(mids.length>prev.length) fail('eased group grew');
      }
      const ra=regularXp(a), rb=regularXp(b);
      histXp+=ra.total; easeXp+=rb.total;
      if(rb.total<ra.total-1e-6) reduced++;
      if(rb.total>ra.total+1e-6) fail('eased regular XP rose seed='+seed+' pc='+c.pc+' lvl='+c.opts.lvl+' '+rb.total+'>'+ra.total);
    }
  }
  if(!reduced) fail('no generated floor had a lower regular-encounter budget outcome');
  const ratio=easeXp/histXp;
  return {fails, compared, reduced, histXp, easeXp, ratio, ease:ENCOUNTER_EASE_V1};
})()
`, context);

if (!result || result.fails.length) {
  console.error('FAIL');
  for (const f of (result && result.fails) || ['no result']) console.error(' - ' + f);
  process.exit(1);
}
console.log('OK ENCOUNTER_EASE_V1=' + result.ease);
console.log('budget checks: historical formula * 0.9 for every pc/level/floor/roll');
console.log('map checks: ' + result.compared + ' seeded floors, bosses/minions/chests/traps/quest rewards identical');
console.log('regular adjusted XP ' + Math.round(result.histXp) + ' -> ' + Math.round(result.easeXp) + ' (ratio ' + result.ratio.toFixed(4) + ', floors reduced ' + result.reduced + '/' + result.compared + ')');
