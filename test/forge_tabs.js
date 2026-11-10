// FORGE_TABS_V1 — Disassemble and Craft never list equipped gear; Upgrade does.
// Run: node test/forge_tabs.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/tavern.js'), 'utf8');
if (!src.includes('FORGE_TABS_V1')) { console.error('FAIL: marker missing'); process.exit(1); }
const help = fs.readFileSync(path.join(root, 'js/help.js'), 'utf8');
if (!/Disassemble/.test(help) || !/Upgrade reforges/.test(help)) { console.error('FAIL: Help does not describe the forge benches'); process.exit(1); }

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
context.G = { homebrew: [], roster: [], party: [], stash: [], gold: 0, rep: {}, tavern: { forge: 2, market: 0, infirmary: 0, library: 0, barracks: 0, shrine: 0 }, perks: {}, settings: {}, run: null, quests: { active: [], done: [] }, story: { ch: 0, done: [] }, journal: [] };
vm.createContext(context);
const files = ['js/data_core.js','js/data_classes.js','js/data_spells.js','js/data_monsters.js','js/data_items.js','js/data_world.js','js/rules.js','js/heroes.js','js/ui.js','js/sheet.js','js/tavern.js'];
try {
  vm.runInContext('function showScreen(){ SCREEN = arguments[1]; }\nfunction saveGame(){ SAVES++; }\nfunction toast(m){ TOASTS.push(m); }\nvar SCREEN=null,SAVES=0,TOASTS=[];\n' + files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n'), context, { filename: 'forge-bundle.js' });
} catch (e) { console.error('FAIL load', e.stack || e); process.exit(1); }

const result = vm.runInContext(`
(function(){
  const fails = [];
  const fail = m => fails.push(m);
  portraitEl = function(h){ const n = document.createElement('span'); n.className = 'prof-ico'; n.appendChild(document.createTextNode(h.name)); return n; };
  function walkText(n, acc){ if(!n) return acc; if(n.nodeType===3) acc.push(n.text); (n.children||[]).forEach(c=>walkText(c,acc)); return acc; }
  function buttons(n, acc){ if(!n) return acc; if(n.tagName==='BUTTON') acc.push(n); (n.children||[]).forEach(c=>buttons(c,acc)); return acc; }
  const hero = newHeroShell(); hero.name = 'Tor Greaves'; hero.cls = 'fighter'; hero.id = 'tor'; hero.eq = {}; hero.isHero = true;
  const worn = makeItem('longsword'); worn.uid = 'worn-sword'; hero.eq.main = worn;
  const stashSword = makeItem('mace'); stashSword.uid = 'stash-mace';
  const plate = makeItem('plate'); plate.uid = 'stash-plate';
  G.roster = [hero]; G.party = ['tor']; G.stash = [stashSword, plate, makeItem('iron',{qty:10}), makeItem('arcane',{qty:4})]; G.gold = 800; G.tavern.forge = 2; G.perks = {};
  const loose = forgeLoose().map(it=>it.uid);
  const wornIds = forgeWorn().map(w=>w.it.uid);
  if (loose.includes('worn-sword')) fail('loose list contains an equipped item');
  if (!wornIds.includes('worn-sword')) fail('worn list missed the equipped sword');
  if (!loose.includes('stash-mace') || !loose.includes('stash-plate')) fail('stash gear missing from loose list');
  forgeTab = 'disassemble'; forgeScreen();
  let text = walkText(SCREEN, []).join('\\n');
  if (!/Disassemble/.test(text) || !/Salvage/.test(text)) fail('disassemble tab missing salvage');
  if (/Tor Greaves/.test(text) || /Longsword/.test(text)) fail('disassemble showed equipped gear');
  if (/Upgrade to/.test(text) || /Enchant/.test(text)) fail('disassemble showed upgrade actions');
  const salvageBtn = buttons(SCREEN, []).find(b => /Salvage/.test(walkText(b,[]).join('')));
  if (!salvageBtn) fail('no salvage button');
  else salvageBtn.listeners.click[0]({stopPropagation(){}});
  if (G.stash.includes(stashSword)) fail('salvage did not remove the mace');
  if (hero.eq.main !== worn) fail('salvage stole the equipped sword');
  if (!G.stash.some(it=>it.base==='iron' && (it.qty||1)>=11)) fail('salvage did not return iron');
  forgeTab = 'craft'; forgeScreen();
  text = walkText(SCREEN, []).join('\\n');
  if (/Tor Greaves/.test(text) || /Longsword/.test(text) || /Plate Armor/.test(text)) fail('craft showed gear');
  if (!/No recipes/.test(text)) fail('craft tab missing empty state');
  forgeTab = 'upgrade'; forgeScreen();
  text = walkText(SCREEN, []).join('\\n');
  if (!/Equipped/.test(text) || !/Tor Greaves/.test(text) || !/Longsword/.test(text)) fail('upgrade missing equipped group');
  if (!/Plate Armor/.test(text)) fail('upgrade missing stash plate');
  if (/Salvage/.test(text)) fail('upgrade still offers salvage');
  function rowWith(name){
    function has(n){ return walkText(n,[]).join(' ').indexOf(name)>=0; }
    function find(n){
      if(!n||!n.children) return null;
      if(String(n.className||'').indexOf('gear-row')>=0 && has(n)) return n;
      for(const c of n.children){ const r=find(c); if(r) return r; }
      return null;
    }
    return find(SCREEN);
  }
  const plateRow = rowWith('Plate Armor');
  if(!plateRow) fail('plate row missing on upgrade');
  const up = plateRow && buttons(plateRow, []).find(b => /Upgrade to \\+1/.test(walkText(b,[]).join('')));
  const ench = buttons(SCREEN, []).find(b => /Enchant affix/.test(walkText(b,[]).join('')));
  if (!up || !ench) fail('upgrade/enchant actions missing');
  const beforeGold = G.gold;
  up.listeners.click[0]({stopPropagation(){}});
  if (plate.plus !== 1) fail('upgrade did not add +1, plus='+plate.plus);
  if (!(G.gold < beforeGold)) fail('upgrade did not spend gold');
  if (hero.eq.main !== worn) fail('upgrade disturbed equipped sword');
  if (forgeTab !== 'upgrade') fail('tab was not remembered');
  document.getElementById('forge-craft').listeners.click[0]({stopPropagation(){}});
  if (forgeTab !== 'craft') fail('craft tab click did not stick');
  if (!document.getElementById('forge-mats') || !document.getElementById('forge-gold')) fail('materials or gold missing');
  return {fails};
})()
`, context);
if (errors.length) { console.error('FAIL console'); errors.forEach(e => console.error(' -', e)); process.exit(1); }
if (!result || result.fails.length) { console.error('FAIL'); (result?result.fails:['no result']).forEach(f => console.error(' -', f)); process.exit(1); }
console.log('OK FORGE_TABS_V1');
console.log('Disassemble/Craft hide equipped gear; Upgrade shows it; salvage and +1 upgrade still work');
