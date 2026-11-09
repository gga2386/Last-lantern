// AUTO_EQUIP_V1 — does not steal another hero's gear; a wizard never receives heavy armor.
// Run: node test/auto_equip.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const sheet = fs.readFileSync(path.join(root, 'js/sheet.js'), 'utf8');
if (!sheet.includes('AUTO_EQUIP_V1')) { console.error('FAIL: AUTO_EQUIP_V1 marker missing'); process.exit(1); }
const errors = [];
const context = {
  console: { log(){}, warn(){}, info(){}, error(...a){ errors.push(a.join(' ')); } },
  Math, Date, Object, Array, Set, Map, JSON, Error, parseInt, String, Number, isNaN,
  TOASTS: []
};
context.toast = m => { context.TOASTS.push(m); };
context.G = { homebrew: [], roster: [], party: [], stash: [] };
context.UI = {};
vm.createContext(context);
const files = ['js/data_core.js','js/data_classes.js','js/data_spells.js','js/data_monsters.js','js/data_items.js','js/data_world.js','js/rules.js','js/heroes.js','js/sheet.js'];
try { vm.runInContext(files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n'), context, { filename: 'auto-bundle.js' }); }
catch (e) { console.error('FAIL load', e.stack || e); process.exit(1); }
const result = vm.runInContext(`
(function(){
  const fails = [];
  const fail = m => fails.push(m);
  function hero(name, cls, opts){
    opts = opts || {};
    const h = newHeroShell();
    h.name = name; h.cls = cls; h.race = opts.race || 'human'; h.bg = opts.bg || 'sellsword'; h.level = 1; h.sub = opts.sub || null;
    h.skills = opts.skills || []; h.feats = []; h._fcache = null; h.eq = {}; h.tools = !!(getClass(cls).tools || (BACKGROUNDS[h.bg] && BACKGROUNDS[h.bg].tools));
    if (opts.str != null) h.base.str = opts.str;
    if (opts.dex != null) h.base.dex = opts.dex;
    if (opts.con != null) h.base.con = opts.con;
    return h;
  }
  const wiz = hero('Isolde', 'wizard', {dex:14, str:8, bg:'scholar'});
  const fight = hero('Tor', 'fighter', {str:16, dex:12});
  const worn = makeItem('chainmail');
  fight.eq.armor = worn;
  const plate = makeItem('plate'), leather = makeItem('leather'), sword = makeItem('longsword'), dagger = makeItem('dagger');
  const shield = makeItem('shield'), great = makeItem('greatsword');
  const stash = [plate, leather, sword, dagger, shield, great];
  const msgW = autoEquipHero(wiz, stash);
  if (wiz.eq.armor) fail('wizard received armor '+ (wiz.eq.armor.base));
  if (wiz.eq.main && wiz.eq.main.base !== 'dagger') fail('wizard main is '+(wiz.eq.main&&wiz.eq.main.base));
  if (wiz.eq.main === sword || wiz.eq.off === shield || wiz.eq.main === great) fail('wizard took a martial weapon or shield');
  if (fight.eq.armor !== worn) fail('wizard auto-equip stole the fighter\\'s chain mail');
  if (stash.includes(worn)) fail('equipped chain mail was pulled into the stash');
  const msgF = autoEquipHero(fight, stash);
  if (fight.eq.armor !== plate) fail('fighter should take plate from the stash, got '+(fight.eq.armor&&fight.eq.armor.base));
  if (wiz.eq.main && fight.eq.main === wiz.eq.main) fail('fighter stole the wizard\\'s weapon');
  if (wiz.eq.armor) fail('fighter pass gave the wizard armor');
  if (fight.eq.main !== great) fail('strength fighter should prefer the greatsword, got '+(fight.eq.main&&fight.eq.main.base));
  if (fight.eq.off) fail('greatsword should leave the shield off-hand empty');
  if (stash.includes(plate) || stash.includes(great)) fail('equipped stash items were not removed from the pool');
  if (!/Plate Armor/.test(msgF) || !/Greatsword/.test(msgF)) fail('toast did not list new gear: '+msgF);
  const again = autoEquipHero(fight, stash);
  if (again !== 'Already best gear.') fail('second pass should be stable, got '+again);
  if (fight.eq.armor !== plate || fight.eq.main !== great) fail('second pass changed gear');
  // Strength requirement: dex fighter cannot wear plate.
  const dexF = hero('Reed', 'fighter', {str:8, dex:16});
  const plate2 = makeItem('plate'), chain2 = makeItem('chainmail'), studded = makeItem('studded'), rapier = makeItem('rapier'), sh2 = makeItem('shield'), gs2 = makeItem('greatsword');
  const pool2 = [plate2, chain2, studded, rapier, sh2, gs2];
  autoEquipHero(dexF, pool2);
  if (dexF.eq.armor && (dexF.eq.armor.base === 'plate' || dexF.eq.armor.base === 'chainmail')) fail('low-Str fighter wore '+dexF.eq.armor.base);
  if (!dexF.eq.armor || dexF.eq.armor.base !== 'studded') fail('low-Str fighter should wear studded, got '+(dexF.eq.armor&&dexF.eq.armor.base));
  if (!dexF.eq.main || dexF.eq.main.base !== 'rapier') fail('dex fighter should use the rapier, got '+(dexF.eq.main&&dexF.eq.main.base));
  if (!dexF.eq.off || dexF.eq.off.kind !== 'shield') fail('rapier should leave room for a shield');
  // Stealth: a stealth-proficient rogue skips padded armor.
  const rog = hero('Nyx', 'rogue', {dex:16, skills:['stealth']});
  const padded = makeItem('padded'), stud = makeItem('studded');
  autoEquipHero(rog, [padded, stud, makeItem('plate'), makeItem('shield')]);
  if (rog.eq.armor && rog.eq.armor.base === 'padded') fail('rogue took padded armor');
  if (!rog.eq.armor || rog.eq.armor.base !== 'studded') fail('rogue should take studded leather');
  if (rog.eq.armor && ARMORS[rog.eq.armor.base].type === 'heavy') fail('rogue wore heavy armor');
  if (rog.eq.off && rog.eq.off.kind === 'shield') fail('rogue is not shield-proficient');
  // Elven Chain is explicitly wearable without armor proficiency; plate is not.
  const wiz2 = hero('Ael', 'wizard', {dex:14, race:'highelf'});
  const chain = makeMagic('elvenchain', true), plate3 = makeItem('plate');
  autoEquipHero(wiz2, [plate3, chain, makeItem('longsword'), makeItem('dagger')]);
  if (wiz2.eq.armor === plate3) fail('elf wizard took plate');
  if (wiz2.eq.armor !== chain) fail('elf wizard should accept Elven Chain');
  if (TOASTS.some(t => /not proficient/.test(t))) fail('false proficiency warning: '+TOASTS.filter(t=>/not proficient/.test(t)).join(' | '));
  if (!wiz2.eq.main || wiz2.eq.main.base !== 'longsword') fail('high elf wizard should take the longsword from racial proficiency');
  return {fails, toasts: TOASTS.slice()};
})()
`, context);
if (errors.length) { console.error('FAIL console'); errors.forEach(e => console.error(' -', e)); process.exit(1); }
if (!result || result.fails.length) {
  console.error('FAIL');
  (result ? result.fails : ['no result']).forEach(f => console.error(' -', f));
  process.exit(1);
}
console.log('OK AUTO_EQUIP_V1');
console.log('toasts:', result.toasts.join(' | '));
