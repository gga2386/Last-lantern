// GEAR_OVERHAUL_V1 — sections, counts, and proficiency portraits vs the real rules.
// Run: node test/gear_overhaul.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const rulesSrc = fs.readFileSync(path.join(root, 'js/rules.js'), 'utf8');
const sheetSrc = fs.readFileSync(path.join(root, 'js/sheet.js'), 'utf8');
if (!rulesSrc.includes('GEAR_OVERHAUL_V1') || !sheetSrc.includes('GEAR_OVERHAUL_V1')) {
  console.error('FAIL: GEAR_OVERHAUL_V1 marker missing');
  process.exit(1);
}

const errors = [];
const consoleMock = {
  log(){}, warn(){}, info(){},
  error(...a){ errors.push(a.map(String).join(' ')); }
};

function rect(){ return {top:0,bottom:20,height:20,left:0,right:20,width:20}; }
function makeNode(tag){
  const n = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], style: {}, attrs: {}, listeners: {},
    className: '', open: false,
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(k, fn){ (this.listeners[k] = this.listeners[k] || []).push(fn); },
    setAttribute(k, v){ this.attrs[k] = v; if (k === 'open') this.open = true; },
    getAttribute(k){ return this.attrs[k]; },
    remove(){},
    getBoundingClientRect: rect,
    querySelector(){ return null; },
    querySelectorAll(){ return []; }
  };
  n.classList = { contains(){ return false; }, add(){}, remove(){}, toggle(){} };
  n.offsetParent = {};
  return n;
}
const els = {};
function byId(id){
  if (!els[id]) {
    els[id] = makeNode('div');
    els[id].id = id;
    if (!['party','hud','actions','modals'].includes(id)) els[id].offsetParent = null;
  }
  return els[id];
}
const documentMock = {
  createElement: makeNode,
  createTextNode(t){ return {nodeType: 3, text: String(t), children: []}; },
  getElementById: byId,
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  documentElement: {style: {setProperty(){}}}
};

const context = {
  console: consoleMock, Math, Date, Object, Array, Set, Map, JSON, Error, parseInt, String, Number, Boolean, isNaN,
  document: documentMock,
  innerWidth: 412, innerHeight: 915,
  getComputedStyle(){ return {display: 'block'}; },
  ResizeObserver: class { observe(){} },
  MutationObserver: class { observe(){} },
  addEventListener(){},
  setTimeout(){ return 0; },
  performance: {now(){ return 0; }},
  Image: class { set src(v){ this._src = v; } get src(){ return this._src; } addEventListener(){} },
  requestAnimationFrame(){ return 0; }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

const files = ['js/data_core.js','js/data_classes.js','js/data_spells.js','js/data_monsters.js','js/data_items.js','js/data_world.js','js/rules.js','js/heroes.js','js/ui.js','js/sheet.js'];
const src = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
try { vm.runInContext(src, context, {filename: 'gear-bundle.js'}); }
catch (e) { console.error('FAIL load', e.stack || e.message); process.exit(1); }

const result = vm.runInContext(`
(function(){
  const fails = [];
  const fail = m => fails.push(m);
  G = {homebrew:[], roster:[], party:[], stash:[], tavern:{forge:0,market:0,library:0,infirmary:0,barracks:0,shrine:0}, quests:{active:[],done:[]}, story:{ch:0,done:[]}, rep:{}, run:null};
  function makeH(o){
    const h = newHeroShell();
    h.name = o.name; h.cls = o.cls; h.race = o.race || 'human'; h.bg = o.bg || 'sellsword'; h.level = o.level || 1; h.sub = o.sub || null; h.sex = o.sex || 'm'; h._fcache = null; h.skills = []; h.feats = [];
    const c = getClass(h.cls), bg = BACKGROUNDS[h.bg];
    h.tools = o.tools != null ? o.tools : !!(c.tools || (bg && bg.tools));
    return h;
  }
  const wiz = makeH({name:'Wiz', cls:'wizard'});
  const fight = makeH({name:'Red', cls:'fighter'});
  const rog = makeH({name:'Shade', cls:'rogue'});
  const life = makeH({name:'Lumen', cls:'cleric', sub:'life'});
  const elfWiz = makeH({name:'Ael', cls:'wizard', race:'highelf'});
  const deserter = makeH({name:'Bran', cls:'wizard', bg:'deserter'});
  wiz.id='w'; fight.id='f'; rog.id='r'; life.id='l'; elfWiz.id='e'; deserter.id='d';
  const everyone = [wiz, fight, rog, life, elfWiz, deserter];
  const plate = makeItem('plate'), mail = makeItem('chainmail');
  const sword = makeItem('longsword'), bow = makeItem('shortbow'), dagger = makeItem('dagger'), great = makeItem('greatsword');
  const shield = makeItem('shield'), pot = makeItem('potheal'), tools = makeItem('thievestools'), rations = makeItem('rations');
  const quest = makeItem('quest', {qid:'q', qname:'Choir Shard'});
  const unk = makeItem('greataxe'); unk.ident = false;
  const chain = makeMagic('elvenchain', true);
  const ring = makeMagic('ringprot', true);
  function names(it){ return everyone.filter(h => heroProficientWith(h, it)).map(h => h.name).sort(); }
  function exp(it, want, label){
    const got = names(it);
    if (got.join(',') !== want.slice().sort().join(',')) fail(label + ' got [' + got + '] want [' + want + ']');
  }
  exp(plate, ['Red','Lumen'], 'plate');
  exp(mail, ['Red','Lumen'], 'chain mail');
  if (heroProficientWith(wiz, plate)) fail('wizard shown proficient with plate');
  if (!heroProficientWith(fight, plate)) fail('fighter missing from plate');
  exp(shield, ['Red','Lumen'], 'shield');
  if (heroProficientWith(wiz, shield) || heroProficientWith(rog, shield)) fail('wizard or rogue proficient with shield');
  exp(sword, ['Red','Shade','Ael','Bran'], 'longsword');
  if (heroProficientWith(wiz, sword)) fail('human wizard proficient with longsword');
  exp(dagger, ['Wiz','Red','Shade','Lumen','Ael','Bran'], 'dagger');
  exp(great, ['Red'], 'greatsword');
  exp(bow, ['Red','Shade','Ael','Lumen'], 'shortbow');
  if (heroProficientWith(wiz, bow)) fail('human wizard proficient with shortbow');
  exp(tools, ['Shade'], 'thieves tools');
  if (heroProficientWith(wiz, tools)) fail('wizard proficient with thieves tools');
  exp(chain, ['Wiz','Red','Shade','Lumen','Ael','Bran'], 'elven chain');
  if (itemProfKind(pot) || itemProfKind(rations) || itemProfKind(quest) || itemProfKind(ring)) fail('proficiency marked on a non-proficiency item');
  const stash = [sword, bow, plate, shield, pot, tools, rations, quest, unk, chain, ring];
  const counts = gearSectionCounts(stash);
  const wantC = {melee:1, ranged:1, armor:3, consume:1, worn:1, tools:2, quest:2};
  for (const k in wantC) if (counts[k] !== wantC[k]) fail('count ' + k + ' = ' + counts[k] + ' want ' + wantC[k]);
  if (gearSectionId(unk) !== 'quest' || gearSectionId(quest) !== 'quest') fail('unidentified/quest section');
  if (gearSectionId(bow) !== 'ranged' || gearSectionId(sword) !== 'melee') fail('weapon split');
  function heroPortraitId(h){ return (h.race||'human')+'_'+(h.cls||'fighter')+'_'+(h.sex||'m'); }
  function portraitSrc(pid){ return 'assets/portraits/'+pid+'.jpg'; }
  globalThis.heroPortraitId = heroPortraitId;
  globalThis.portraitSrc = portraitSrc;
  G.roster = [wiz, fight, rog]; G.party = ['w','f','r'];
  function activeParty(){ return G.party.map(id => G.roster.find(h => h.id === id)).filter(Boolean); }
  globalThis.activeParty = activeParty;
  const tree = gearSections(stash, it => gearRow(it, []), 'test');
  const secs = tree.children.filter(c => c.tagName === 'DETAILS');
  if (secs.length !== 7) fail('rendered section count ' + secs.length);
  const rendered = {};
  for (const det of secs) {
    const sum = det.children.find(c => c.tagName === 'SUMMARY');
    const nameNode = sum.children.find(c => (c.className || '').includes('gs-n'));
    const countNode = sum.children.find(c => (c.className || '').includes('gs-c'));
    const name = (nameNode.children[0] || {}).text || '';
    const count = (countNode.children[0] || {}).text || '';
    const body = det.children.find(c => (c.className || '').includes('gearsec-body'));
    rendered[name] = {count: +count, rows: body.children.length, open: det.open};
    if (+count !== body.children.length) fail(name + ' count ' + count + ' != rows ' + body.children.length);
    if (!det.open) fail(name + ' should start open');
  }
  for (const n of ['Melee Weapons','Ranged Weapons','Armor and Shields','Consumables','Wondrous and Worn','Tools and Misc','Quest and Unidentified']) {
    if (!rendered[n]) fail('missing section ' + n);
  }
  if (rendered['Armor and Shields'].count !== 3) fail('armor section count');
  if (rendered['Tools and Misc'].count !== 2) fail('tools section count');
  if (rendered['Quest and Unidentified'].count !== 2) fail('quest section count');
  function rowIcons(it){
    const row = gearRow(it, []);
    const prof = row.children[0].children.find(c => (c.className || '').includes('profs'));
    const imgs = (prof.children || []).filter(c => c.tagName === 'IMG');
    const more = (prof.children || []).find(c => (c.className || '').includes('prof-more'));
    const none = (prof.children || []).find(c => (c.className || '').includes('prof-none'));
    return {imgs: imgs.map(c => c.attrs['data-hid']), more: more && (more.children[0] || {}).text, none: !!none, src: (imgs[0] && imgs[0].attrs.src) || ''};
  }
  const plateRow = rowIcons(plate);
  if (plateRow.none || plateRow.imgs.join(',') !== 'f') fail('plate icons ' + JSON.stringify(plateRow));
  if (!String(plateRow.src).includes('fighter')) fail('plate portrait src ' + plateRow.src);
  const dartRow = rowIcons(makeItem('dart'));
  if (dartRow.imgs.slice().sort().join(',') !== 'f,r,w') fail('dart icons ' + dartRow.imgs);
  G.party = ['w'];
  const noneRow = rowIcons(plate);
  if (!noneRow.none) fail('wizard-only party should show no one proficient on plate');
  const six = [1,2,3,4,5,6].map(i => { const h = makeH({name:'F' + i, cls:'fighter', sex: i % 2 ? 'm' : 'f'}); h.id = 'p' + i; return h; });
  G.roster = six; G.party = six.map(h => h.id);
  const cap = rowIcons(sword);
  if (cap.imgs.length !== 4) fail('icon cap ' + cap.imgs.length);
  if (cap.more !== '+2') fail('overflow marker ' + cap.more);
  return {fails, rendered};
})()
`, context);

if (errors.length) {
  console.error('FAIL console errors');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
if (!result || result.fails.length) {
  console.error('FAIL');
  for (const f of (result && result.fails) || ['no result']) console.error(' - ' + f);
  process.exit(1);
}
console.log('OK GEAR_OVERHAUL_V1');
console.log('sections: ' + Object.entries(result.rendered).map(([n, v]) => n + ' ' + v.count).join(' | '));
console.log('proficiency icons match class/race/background/feat rules; cap +2 with 6 heroes; 0 console errors');
