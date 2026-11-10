// FORGE_CRAFT_V1 — recipes spend exact gold and materials, respect Forge level, and silvered blades bypass nonmagical BPS resistance only.
// Run: node test/forge_craft.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const tavern = fs.readFileSync(path.join(root, 'js/tavern.js'), 'utf8');
const help = fs.readFileSync(path.join(root, 'js/help.js'), 'utf8');
if (!tavern.includes('FORGE_CRAFT_V1')) { console.error('FAIL: marker missing'); process.exit(1); }
if (!/Craft spends gold/.test(help) || !/Iron Scrap/.test(help) || !/Dragon Scale/.test(help) || !/Silver Ingots/.test(help) || !/Aberrant Ichor/.test(help) || !/Wraith Ash/.test(help)) {
  console.error('FAIL: Help does not describe crafting materials'); process.exit(1);
}

const ids = {};
function makeNode(tag){
  const n = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], style: {}, attrs: {}, listeners: {}, className: '', text: '',
    appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
    addEventListener(k, fn){ (this.listeners[k] = this.listeners[k] || []).push(fn); },
    setAttribute(k, v){ this.attrs[k] = v; if (k === 'id') ids[v] = this; if (k === 'open') this.open = true; },
    getAttribute(k){ return this.attrs[k]; },
    remove(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    classList: { contains(){ return false; }, add(){}, remove(){} },
    getBoundingClientRect(){ return {top:0,bottom:0,height:0,left:0,right:0,width:0}; }
  };
  return n;
}
const errors = [];
const context = {
  console: { log(){}, warn(){}, info(){}, error(...a){ errors.push(a.map(String).join(' ')); } },
  Math, Date, Object, Array, Set, Map, JSON, Error, parseInt, String, Number, isNaN,
  innerWidth: 412, innerHeight: 915,
  setTimeout(){ return 0; }, clearTimeout(){},
  performance: { now(){ return 0; } }, requestAnimationFrame(){ return 0; },
  getComputedStyle(){ return { display: 'none' }; },
  ResizeObserver: class { observe(){} }, MutationObserver: class { observe(){} }, addEventListener(){}
};
context.document = {
  createElement: makeNode,
  createTextNode(t){ return { nodeType: 3, text: String(t), children: [] }; },
  getElementById(id){ return ids[id] || null; },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  documentElement: { style: { setProperty(){} } },
  body: makeNode('body')
};
context.window = context;
context.G = { homebrew: [], roster: [], party: [], stash: [], gold: 0, rep: {}, tavern: { forge: 1, market: 0, infirmary: 0, library: 0, barracks: 0, shrine: 0 }, perks: {}, settings: {}, run: null, quests: { active: [], done: [] }, story: { ch: 0, done: [] }, journal: [], fast: true };
vm.createContext(context);
const files = ['js/data_core.js','js/data_classes.js','js/data_spells.js','js/data_monsters.js','js/data_items.js','js/data_world.js','js/rules.js','js/heroes.js','js/core.js','js/combat.js','js/ui.js','js/sheet.js','js/tavern.js'];
try {
  vm.runInContext('function showScreen(){ SCREEN = arguments[1]; }\nfunction saveGame(){ SAVES++; }\nfunction toast(m){ TOASTS.push(m); }\nvar SCREEN=null,SAVES=0,TOASTS=[];\n' + files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n'), context, { filename: 'craft-bundle.js' });
} catch (e) { console.error('FAIL load', e.stack || e); process.exit(1); }

const result = vm.runInContext(`
(function(){
  const fails = [];
  const fail = m => fails.push(m);
  toast = function(m){ TOASTS.push(m); };
  portraitEl = function(h){ const n = document.createElement('span'); n.className = 'prof-ico'; n.appendChild(document.createTextNode(h.name)); return n; };
  function walkText(n, acc){ if(!n) return acc; if(n.nodeType===3) acc.push(n.text); (n.children||[]).forEach(c=>walkText(c,acc)); return acc; }
  function buttons(n, acc){ if(!n) return acc; if(n.tagName==='BUTTON') acc.push(n); (n.children||[]).forEach(c=>buttons(c,acc)); return acc; }
  function matsOf(rec){ return Object.keys(rec.mats).map(m=>makeMaterial(m,rec.mats[m])); }
  if (makeItem('hide').kind!=='armor') fail('hide armor no longer crafts as armor');
  if (makeMaterial('hide').kind!=='material' || itemName(makeMaterial('hide'))!=='Thick Hide') fail('thick hide is not a material');
  if (FORGE_RECIPES.length < 10 || FORGE_RECIPES.length > 16) fail('recipe count '+FORGE_RECIPES.length);
  const used = {};
  FORGE_RECIPES.forEach(r=>{ Object.keys(r.mats).forEach(m=>{ used[m]=(used[m]||0)+1; }); });
  Object.keys(MATERIALS).forEach(m=>{ if(!used[m]) fail('material never used: '+m); });
  const secs = {};
  FORGE_RECIPES.forEach(r=>{ secs[r.sec]=(secs[r.sec]||0)+1; });
  FORGE_CRAFT_SECTIONS.forEach(s=>{ if(!secs[s.id]) fail('empty section '+s.id); });

  for (const rec of FORGE_RECIPES){
    G.tavern.forge = rec.forge;
    G.gold = rec.gold;
    G.stash = matsOf(rec);
    const made = doCraft(rec);
    if (!made) { fail(rec.id+' did not craft'); continue; }
    if (G.gold !== 0) fail(rec.id+' gold left '+G.gold);
    Object.keys(rec.mats).forEach(m=>{ if (matCount(m)!==0) fail(rec.id+' leftover '+m+' '+matCount(m)); });
    if (!G.stash.includes(made) && !G.stash.some(it=>it.base===made.base && it.kind===made.kind && (it.spell||'')===(made.spell||'') && !!it.silvered===!!made.silvered && (it.magic||'')===(made.magic||''))) fail(rec.id+' missing from stash');
    if (rec.silvered && (!made.silvered || made.magic)) fail(rec.id+' silvered flag wrong');
    if (rec.magic && made.magic!==rec.magic) fail(rec.id+' magic id '+made.magic);
    if (rec.scroll && made.spell!==rec.scroll) fail(rec.id+' spell '+made.spell);
    if (rec.base && !rec.scroll && made.base!==rec.base) fail(rec.id+' base '+made.base);
    const expect = itemName(forgeMake(rec));
    if (itemName(made)!==expect) fail(rec.id+' name '+itemName(made));
  }

  const short = FORGE_RECIPES.find(r=>r.id==='studded');
  G.tavern.forge = 3; G.gold = short.gold; G.stash = matsOf(short);
  const iron = G.stash.find(i=>i.base==='iron'); iron.qty = short.mats.iron-1;
  const goldBefore = G.gold; const hideBefore = matCount('hide');
  if (canCraft(short) || doCraft(short)) fail('crafted studded while short on iron');
  if (G.gold!==goldBefore || matCount('hide')!==hideBefore || matCount('iron')!==short.mats.iron-1) fail('failed craft spent something');

  G.gold = short.gold-1; iron.qty = short.mats.iron;
  if (canCraft(short)) fail('crafted when short on gold');
  doCraft(short);
  if (G.gold!==short.gold-1) fail('short gold still spent');

  const high = FORGE_RECIPES.find(r=>r.id==='drakemail');
  const mid = FORGE_RECIPES.find(r=>r.id==='silver-long');
  G.tavern.forge = 1; G.gold = 9999; G.stash = matsOf(high).concat(matsOf(mid));
  if (canCraft(high) || doCraft(high)) fail('dragon mail crafted at forge 1');
  if (canCraft(mid) || doCraft(mid)) fail('silvered longsword crafted at forge 1');
  if (G.gold!==9999) fail('locked craft spent gold');
  if (matCount('scale')!==high.mats.scale || matCount('silver')!==mid.mats.silver) fail('locked craft spent materials');
  G.tavern.forge = 2;
  if (!canCraft(mid)) fail('silvered longsword locked at forge 2');
  if (canCraft(high)) fail('dragon mail open before forge 3');
  G.tavern.forge = 3;
  if (!canCraft(high)) fail('dragon mail locked at forge 3');

  const wolf = {isHero:false, hp:20, fx:[], def:{n:'Wolf', resist:['bps','cold'], immune:['poison'], vuln:[]}};
  if (resistMult(wolf,'piercing',false,false)!==0.5) fail('plain weapon did not halve vs bps');
  if (resistMult(wolf,'piercing',false,true)!==1) fail('silvered did not bypass bps resist');
  if (resistMult(wolf,'piercing',true,false)!==1) fail('magical no longer bypasses bps');
  if (resistMult(wolf,'cold',false,true)!==0.5) fail('silvered bypassed a typed resist');
  if (resistMult(wolf,'poison',false,true)!==0) fail('silvered bypassed poison immunity');
  const ghost = {isHero:false, hp:20, fx:[], def:{n:'Ghost', resist:[], immune:['bps','cold'], vuln:[]}};
  if (resistMult(ghost,'slashing',false,false)!==0) fail('bps immunity ignored');
  if (resistMult(ghost,'slashing',false,true)!==1) fail('silvered did not bypass bps immunity');
  if (resistMult(ghost,'cold',false,true)!==0) fail('silvered bypassed cold immunity');
  const skin = {isHero:false, hp:20, fx:[{id:'stoneskin'}], def:{n:'Skin', resist:[], immune:[], vuln:[]}};
  if (resistMult(skin,'slashing',false,true)!==0.5) fail('silvered bypassed stoneskin');
  if (resistMult(skin,'slashing',true,false)!==1) fail('magical no longer ignores stoneskin');

  const hero = newHeroShell(); hero.eq = {}; hero.level = 1;
  const blade = forgeMake(mid);
  const prof = weaponProfile(hero, blade);
  if (!prof.silvered) fail('weapon profile dropped silvered');
  if (prof.magical) fail('silvered weapon counted as magical');
  const plain = weaponProfile(hero, makeItem('longsword'));
  if (plain.silvered) fail('plain longsword is silvered');

  const wornHero = newHeroShell(); wornHero.name = 'Tor Greaves'; wornHero.id = 'tor'; wornHero.eq = {main: makeItem('greataxe')};
  G.roster = [wornHero]; G.party = ['tor']; G.tavern.forge = 1; G.gold = 0; G.stash = [];
  forgeTab = 'craft'; forgeScreen();
  const text = walkText(SCREEN, []).join('\\n');
  if (/Tor Greaves/.test(text) || /Greataxe/.test(text) || /Salvage/.test(text) || /Upgrade to/.test(text)) fail('craft listed equipped gear or other benches');
  if (!/Weapons/.test(text) || !/Armor & Shields/.test(text) || !/Consumables/.test(text)) fail('sections missing');
  if (!/Requires Runeforge/.test(text) || !/Requires Masterforge/.test(text)) fail('locked recipes missing their requirement');
  if (!/Iron Scrap 0\\/1/.test(text) || !/have 0/.test(text)) fail('cost line missing have/need');
  const craftBtns = FORGE_RECIPES.map(r=>document.getElementById('craft-'+r.id));
  if (craftBtns.some(b=>!b)) fail('a recipe is missing its Craft button');
  if (craftBtns.some(b=>b.attrs.disabled==null)) fail('a craft button was enabled with no gold or materials');
  G.gold = 2; G.stash = [makeMaterial('iron',1)]; forgeScreen();
  const daggerBtn = document.getElementById('craft-dagger');
  if (!daggerBtn || daggerBtn.attrs.disabled!=null) fail('dagger craft stayed disabled when paid');
  const lockedBtn = document.getElementById('craft-silver-short');
  if (!lockedBtn || lockedBtn.attrs.disabled==null) fail('silvered shortsword was clickable at forge 1');
  daggerBtn.listeners.click[0]({stopPropagation(){}});
  if (!G.stash.some(it=>it.base==='dagger'&&it.kind==='weapon')) fail('click did not stash the dagger');
  if (matCount('iron')!==0 || G.gold!==0) fail('click did not spend the dagger cost');
  if (!TOASTS.some(t=>/Crafted Dagger/.test(t))) fail('no craft toast');
  if (wornHero.eq.main.base!=='greataxe') fail('craft touched equipped gear');
  return {fails, n:FORGE_RECIPES.length};
})()
`, context);
if (errors.length) { console.error('FAIL console'); errors.forEach(e => console.error(' -', e)); process.exit(1); }
if (!result || result.fails.length) { console.error('FAIL'); (result?result.fails:['no result']).forEach(f => console.error(' -', f)); process.exit(1); }
console.log('OK FORGE_CRAFT_V1 recipes='+result.n);
