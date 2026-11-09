// DUNGEON_SETTINGS_V1 — dungeon Menu exposes Quick rolls, and turning it off restores tap-to-roll.
// Run: node test/dungeon_settings.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
if (!ui.includes('DUNGEON_SETTINGS_V1') || !ui.includes("id:'set-quickrolls'")) {
  console.error('FAIL: DUNGEON_SETTINGS_V1 marker or #set-quickrolls missing from dungeon menu');
  process.exit(1);
}
const help = fs.readFileSync(path.join(root, 'js/help.js'), 'utf8');
if (!/Menu in the dungeon/.test(help)) {
  console.error('FAIL: Help does not mention turning Quick rolls off from the dungeon Menu');
  process.exit(1);
}

const ids = {};
function makeNode(tag){
  const n = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], style: {}, attrs: {}, listeners: {}, className: '',
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(k, fn){ (this.listeners[k] = this.listeners[k] || []).push(fn); },
    setAttribute(k, v){ this.attrs[k] = v; if (k === 'id') ids[v] = this; },
    getAttribute(k){ return this.attrs[k]; },
    remove(){},
    getBoundingClientRect(){ return {top:0,bottom:0,height:0,left:0,right:0,width:0}; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    classList: { contains(){ return false; }, add(){}, remove(){}, toggle(){} },
    offsetParent: null
  };
  return n;
}
const modals = makeNode('div');
ids.modals = modals;
const documentMock = {
  createElement: makeNode,
  createTextNode(t){ return { nodeType: 3, text: String(t), children: [] }; },
  getElementById(id){ return ids[id] || null; },
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  documentElement: { style: { setProperty(){} } },
  body: makeNode('body')
};
const errors = [];
const context = {
  console: { log(){}, warn(){}, info(){}, error(...a){ errors.push(a.map(String).join(' ')); } },
  Math, Date, Object, Array, Set, Map, JSON, Error, parseInt, String, Number, isNaN,
  document: documentMock, innerWidth: 412, innerHeight: 915,
  getComputedStyle(){ return { display: 'none' }; },
  ResizeObserver: class { observe(){} },
  MutationObserver: class { observe(){} },
  addEventListener(){},
  setTimeout(){ return 0; },
  clearTimeout(){},
  performance: { now(){ return 0; } },
  requestAnimationFrame(){ return 0; }
};
context.window = context;
context.G = { settings: { autoEnd: true, fastAnim: false, quickRolls: true }, fast: false, autoPlay: false, autoChoice: null, combat: null, run: { leader: 'h' } };
vm.createContext(context);
try {
  vm.runInContext('function autoHeroTurn(){ return Promise.resolve(); }\n' + fs.readFileSync(path.join(root, 'js/dice.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'), context, { filename: 'settings-bundle.js' });
} catch (e) {
  console.error('FAIL load', e.stack || e);
  process.exit(1);
}

const result = vm.runInContext(`
(function(){
  const fails = [];
  const fail = m => fails.push(m);
  UI.dungeonMenu();
  const box = document.getElementById('set-quickrolls');
  if (!box) fail('dungeon Menu has no #set-quickrolls checkbox');
  else {
    if (box.attrs.type !== 'checkbox') fail('quick rolls control is not a checkbox');
    const label = box.parentNode || null;
  }
  const texts = [];
  (function walk(n){ if (!n) return; if (n.nodeType === 3) texts.push(n.text); (n.children||[]).forEach(walk); })(document.getElementById('modals'));
  const blob = texts.join(' ');
  for (const s of ['Auto-end turn when out of actions','Fast animations','Quick rolls (skip the tap-to-roll dice animation)','Abandon expedition']) {
    if (blob.indexOf(s) < 0) fail('menu missing: '+s);
  }
  const abandonAt = blob.indexOf('Abandon expedition');
  const quickAt = blob.indexOf('Quick rolls');
  if (quickAt < 0 || abandonAt < quickAt) fail('Quick rolls is not before Abandon expedition');
  if (!box.listeners.change || !box.listeners.change.length) fail('checkbox has no change handler');
  else box.listeners.change[0]({ target: { checked: false } });
  if (G.settings.quickRolls !== false) fail('unchecking did not set quickRolls false, got '+G.settings.quickRolls);
  const hero = { isHero: true, dice: 'bone', name: 'Tor' };
  if (DICE.wanted(hero) !== true) fail('DICE.wanted should be true for a hero after Quick rolls is off');
  G.settings.quickRolls = true;
  if (DICE.wanted(hero) !== false) fail('DICE.wanted should be false while Quick rolls is on');
  return { fails };
})()
`, context);

if (errors.length) {
  console.error('FAIL console errors');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
if (!result || result.fails.length) {
  console.error('FAIL');
  (result ? result.fails : ['no result']).forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('OK DUNGEON_SETTINGS_V1');
console.log('dungeon Menu shows Quick rolls; unchecking sets quickRolls false; DICE.wanted is true for a hero');
