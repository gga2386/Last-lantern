// ===== Help screen (HELP_TOPICS_V1) =====
const HELP_TOPICS=[
 {id:'level',ic:'⬆',n:'Leveling up',p:[
  'Heroes earn XP by winning fights. Each slain foe adds XP to the battle; on victory it is split evenly among the heroes still standing. Finished quests also grant XP.',
  'When a hero has enough XP, a ⬆ appears next to their name on the party card (in the dungeon and in the tavern). A toast also says "A hero can level up!" after a battle.',
  'When a hero has enough XP, a gold ⬆ Lvl button appears on their party card. Tap it to open their sheet at the Level up button. You can also open the sheet with the card\'s 📜 button; right under the HP and XP bar is the ⬆ Level up! button. Tap it, make your choices, then Confirm.',
  'The Level up! button only shows outside combat. Finish the fight first, then level up — you can do it in the dungeon or back at the tavern.',
  'Spellcasters who level up get their new spells chosen automatically. You can change them later at the Library in the tavern.',
  'Heroes can reach level 12.']},
 {id:'sheet',ic:'📜',n:'Opening the character sheet',p:[
  'In the dungeon: double-tap a hero\'s party card or tap the 📜 button on the right side of the card. Tapping a hero on the map outside combat only makes them the leader.',
  'During combat: a single tap on a party card, or tapping one of your heroes on the map, also opens their sheet.',
  'In the tavern: tap a hero\'s portrait in the party row at the top.',
  'The sheet has tabs for Stats, Gear, Spells, Features and Dice (your dice style). Lasting injuries are listed on the Stats tab.']},
 {id:'explore',ic:'👣',n:'Moving and exploring',p:[
  'Map: tap 🗺 Map in the bottom bar to see everything the party has explored on this floor: walls, doors (red = locked), stairs and where your party stands. Tap ✕ Close to return.',
  'Tap a floor tile to walk the party leader there; the others follow. Tap a door next to the leader to open it, or a door farther away to walk to it.',
  'Tap chests, objects, traps you have found, or stairs to walk over and interact. Locked doors and chests offer options such as picking the lock, a spell, or bashing it (loud).',
  'Each hero carries light; you only see what your lanterns reach. Unexplored areas stay dark.',
  'Bottom bar: 👣 Sneak (move quietly), 🔍 Search (look for traps and secrets), 🔥 Rest, ✨ Spells, 🎒 Pack, 📖 Journal and ☰ Menu.']},
 {id:'combat',ic:'⚔',n:'Combat basics',p:[
  'Combat starts when monsters notice you. Everyone acts in initiative order. On a hero\'s turn the bar shows Move left and the Action (A), Bonus (B) and Reaction pips.',
  'Tap a highlighted tile to move. Tap an enemy to attack it (the hero steps in if needed), or use the attack buttons to pick a weapon and target.',
  '✨ Spells and ⚜ Abilities open lists of what the hero can use. 🧪 Items uses potions and scrolls. 🛡 Dodge, 💨 Dash and ↩ Disengage use your action.',
  'When a roll is needed, a 3D d20 appears — tap the die to roll. Turn on the quick-rolls box under the die to skip the animation. Quick rolls can also be turned off from ☰ Menu in the dungeon (or Save / Load in the tavern), which brings the tap-to-roll dice back on the next roll.',
  '🤖 Auto lets the game play that hero\'s turn; ⏭ End Turn finishes it.',
  'A hero at 0 HP makes death saves. If they survive the battle they get back up at 1 HP — often with a lasting injury.']},
 {id:'party',ic:'🧑‍🤝‍🧑',n:'Party and leader',p:[
  'Up to 6 heroes can go on an expedition. Outside combat, a single tap on a party card (or on a hero on the map) makes that hero the leader — the one who walks and interacts.',
  'In the tavern, Roster lets you add or remove heroes from the party and create new heroes. Recruit lists heroes for hire; new faces arrive every few days.',
  'The roster size grows when you upgrade the Barracks.']},
 {id:'injury',ic:'🩹',n:'Injuries, resting and healing',p:[
  'Heroes who drop to 0 HP, fall, or are dragged home after a total party defeat can suffer lasting injuries. Some heal over days; some are permanent until treated.',
  'In the dungeon, 🔥 Rest takes a short rest: it costs one Ration, spends Hit Dice to heal and restores short-rest abilities. You can rest twice per floor, and monsters may interrupt.',
  'Returning to the tavern passes days. 🛏 Rest in the tavern passes one day: injuries mend and the market restocks.',
  'The 🩹 Infirmary treats injuries for gold; upgrading it makes healing faster and cheaper. The 🕯 Shrine offers blessings and cleanses curses and disease.']},
 {id:'town',ic:'🏮',n:'The tavern (town)',p:[
  'The Last Lantern is your base between expeditions. 🗺 World Map starts an expedition. 🍺 Patrons and 📋 Quest Board give stories and side quests.',
  '⚖ Market buys and sells gear. ⚒ Forge (once built) has three benches. Disassemble breaks stash gear into scrap and never touches anything a hero is wearing. Craft spends gold and monster materials to make gear, then puts it in the stash; recipes above your Forge level stay listed but locked. Upgrade reforges (+1) and enchants — the only bench that also lists gear a hero is wearing. 📦 Stash holds items you brought home.',
  'What the materials are for: Iron Scrap makes a dagger, a shortbow, a shield, studded leather and alchemist\'s fire. Thick Hide is worked into hide, leather and studded armor, the shortbow, and Boots of Elvenkind. Bone Dust and Wraith Ash brew healing potions and holy water. Aberrant Ichor makes antitoxin and alchemist\'s fire. Silver Ingots silver a shortsword or a longsword; a silvered blade bypasses resistance to nonmagical bludgeoning, piercing and slashing, and it is not otherwise magical. Arcane Residue and Dark Essence scribe a scroll of Magic Missile. Dragon Scale, with a little hide, is bound into Dragon Scale Mail once the forge is a Masterforge.',
  '📚 Library: identify items and change your casters\' spells. 🏗 Upgrades improves the buildings with gold and renown.']},
 {id:'save',ic:'💾',n:'Saving and continuing',p:[
  'The game saves itself after battles, rests and most tavern actions, and whenever you switch away from the browser. It cannot save in the middle of combat.',
  'You can also save by hand: ☰ Menu → Save game in the dungeon, or 💾 Save / Load in the tavern.',
  'On the title screen, ▶ Continue loads your last save. Export save file downloads a backup you can bring back with Import save.']}
];
UI.help=function(){ const box=el('div',{class:'helpbox',id:'help-box'});
  const list=()=>{ box.innerHTML=''; box.appendChild(el('p',{class:'small'},'Tap a topic to read about it.'));
    box.appendChild(el('div',{class:'col helplist'},HELP_TOPICS.map(t=>el('button',{class:'btn helptopic',id:'help-'+t.id,onclick:()=>topic(t)},el('span',{class:'hti'},t.ic),el('span',null,t.n))))); box.scrollTop=0; };
  const topic=t=>{ box.innerHTML=''; box.appendChild(el('h3',null,t.ic+' '+t.n)); t.p.forEach(x=>box.appendChild(el('p',{class:'helptext'},x)));
    box.appendChild(el('div',{class:'helpnav'},btn('← Back to topics',()=>list(),'',{id:'help-back'}),btn('Close',()=>UI.closeAll(),'',{id:'help-close'}))); const mb=box.closest('.mbody'); if(mb) mb.scrollTop=0; };
  list(); UI.modal('Help',box,{}); };
