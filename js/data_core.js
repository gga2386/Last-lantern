// ===== Core rules data (SRD 5.1 content + clearly-marked original content) =====
const ABIL = ['str','dex','con','int','wis','cha'];
const ABIL_NAME = {str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
const SKILLS = {
  acrobatics:'dex', animal:'wis', arcana:'int', athletics:'str', deception:'cha', history:'int', insight:'wis',
  intimidation:'cha', investigation:'int', medicine:'wis', nature:'int', perception:'wis', performance:'cha',
  persuasion:'cha', religion:'int', sleight:'dex', stealth:'dex', survival:'wis'
};
const SKILL_NAME = {acrobatics:'Acrobatics',animal:'Animal Handling',arcana:'Arcana',athletics:'Athletics',deception:'Deception',history:'History',insight:'Insight',intimidation:'Intimidation',investigation:'Investigation',medicine:'Medicine',nature:'Nature',perception:'Perception',performance:'Performance',persuasion:'Persuasion',religion:'Religion',sleight:'Sleight of Hand',stealth:'Stealth',survival:'Survival',tools:"Thieves' Tools"};
const XP_LEVELS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000];
const MAX_LEVEL = 12;
const CR_XP = {0:10,0.125:25,0.25:50,0.5:100,1:200,2:450,3:700,4:1100,5:1800,6:2300,7:2900,8:3900,9:5000,10:5900,11:7200,12:8400};
const POINT_COST = {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
const STANDARD_ARRAY = [15,14,13,12,10,8];
const DMG_TYPES = ['slashing','piercing','bludgeoning','fire','cold','lightning','thunder','acid','poison','necrotic','radiant','force','psychic'];

const RACES = {
  human:{n:'Human',asi:{str:1,dex:1,con:1,int:1,wis:1,cha:1},speed:30,traits:['Versatile: +1 to every ability score.','Extra language.'],dv:0,skills:[]},
  hilldwarf:{n:'Hill Dwarf',asi:{con:2,wis:1},speed:25,dv:12,traits:['Darkvision 60 ft.','Dwarven Resilience: advantage on saves vs poison, resistance to poison.','Dwarven Toughness: +1 HP per level.','Stonecunning: +2 to spot traps in stonework (passive).'],resist:['poison'],hpPerLvl:1,wprof:['battleaxe','handaxe','lighthammer','warhammer'],trapBonus:2},
  highelf:{n:'High Elf',asi:{dex:2,int:1},speed:30,dv:12,skills:['perception'],traits:['Darkvision 60 ft.','Keen Senses: proficiency in Perception.','Fey Ancestry: advantage vs charmed, immune to magical sleep.','Cantrip: one wizard cantrip (Fire Bolt).'],cantrip:'firebolt',wprof:['longsword','shortsword','shortbow','longbow'],feyAncestry:true},
  halfling:{n:'Lightfoot Halfling',asi:{dex:2,cha:1},speed:25,dv:0,traits:['Lucky: reroll natural 1s on attacks, checks and saves.','Brave: advantage on saves vs frightened.','Halfling Nimbleness.','Naturally Stealthy.'],lucky:true,brave:true},
  dragonborn:{n:'Dragonborn',asi:{str:2,cha:1},speed:30,dv:0,traits:['Draconic Ancestry: breath weapon (2d6, scaling) and damage resistance of your ancestry type.'],breath:true},
  gnome:{n:'Rock Gnome',asi:{int:2,con:1},speed:25,dv:12,traits:['Darkvision 60 ft.','Gnome Cunning: advantage on Int, Wis and Cha saves vs magic.',"Artificer's Lore: +2 History on magic items & devices (helps disarm magical traps)."],gnomeCunning:true,trapBonus:1},
  halfelf:{n:'Half-Elf',asi:{cha:2,dex:1,con:1},speed:30,dv:12,traits:['Darkvision 60 ft.','Fey Ancestry.','Skill Versatility: two extra skills of your choice.'],extraSkills:2,feyAncestry:true},
  halforc:{n:'Half-Orc',asi:{str:2,con:1},speed:30,dv:12,skills:['intimidation'],traits:['Darkvision 60 ft.','Menacing: proficiency in Intimidation.','Relentless Endurance: drop to 1 HP instead of 0 once per long rest.','Savage Attacks: extra weapon die on melee crits.'],relentless:true,savage:true},
  tiefling:{n:'Tiefling',asi:{cha:2,int:1},speed:30,dv:12,resist:['fire'],traits:['Darkvision 60 ft.','Hellish Resistance: resistance to fire.','Infernal Legacy: Thaumaturgy; Hellish Rebuke once per long rest from 3rd level.'],cantrip:'thaumaturgy',hellish:true}
};
const DRAGON_ANCESTRY = {black:'acid',blue:'lightning',brass:'fire',bronze:'lightning',copper:'acid',gold:'fire',green:'poison',red:'fire',silver:'cold',white:'cold'};

// Backgrounds: Acolyte is SRD; the rest are original to this game.
const BACKGROUNDS = {
  acolyte:{n:'Acolyte',src:'SRD',skills:['insight','religion'],gold:15,feat:'Shelter of the Faithful: shrine services cost 25% less.',shrineDisc:0.25},
  gravedigger:{n:'Gravedigger',src:'Original',skills:['religion','athletics'],gold:10,feat:'Grave-Hardened: advantage on saves vs being frightened by undead.',undeadBrave:true},
  sellsword:{n:'Sellsword',src:'Original',skills:['athletics','intimidation'],gold:25,feat:'Coin-Bound: earn 10% more gold from quests.',questGold:0.1},
  cutpurse:{n:'Cutpurse',src:'Original',skills:['sleight','stealth'],tools:true,gold:12,feat:"Light Fingers: proficiency with thieves' tools."},
  scholar:{n:'Hedge Scholar',src:'Original',skills:['arcana','history'],gold:10,feat:'Bookworm: lore checks discover extra codex entries.',lore:true},
  pilgrim:{n:'Pilgrim',src:'Original',skills:['insight','survival'],gold:8,feat:'Long Road: +1 hit die recovered on short rests.'},
  ratcatcher:{n:'Ratcatcher',src:'Original',skills:['perception','animal'],gold:6,feat:'Sewer Sense: +2 passive Perception to notice traps.',trapBonus:2},
  noble:{n:'Disgraced Noble',src:'Original',skills:['persuasion','history'],gold:40,feat:'Old Name: market prices 10% better.',marketDisc:0.1},
  plague:{n:'Plague Doctor',src:'Original',skills:['medicine','investigation'],gold:12,feat:'Leech Craft: injuries you tend heal one day faster.'},
  minstrel:{n:'Wandering Minstrel',src:'Original',skills:['performance','deception'],gold:14,feat:'Tavern Favourite: +1 renown per completed quest.'},
  huntsman:{n:'Huntsman',src:'Original',skills:['survival','nature'],gold:10,feat:'Tracker: surprise rounds against you are rarer (+2 to party Stealth).'},
  deserter:{n:'Deserter',src:'Original',skills:['stealth','athletics'],gold:10,feat:'Old Drills: proficiency in one martial weapon type (longsword).',wprof:['longsword']}
};

// Feats. Grappler is SRD 5.1; all others are original to this game.
const FEATS = {
  grappler:{n:'Grappler',src:'SRD',d:'Advantage on attack rolls against a creature you are grappling. (Requires Str 13)'},
  hardened:{n:'Hardened',src:'Original',d:'+1 Con. Max HP +2 per level.',asi:{con:1}},
  keeneye:{n:'Keen Eye',src:'Original',d:'+1 Wis. +5 passive Perception and Investigation (traps, secret doors).',asi:{wis:1}},
  duelist:{n:"Duelist's Poise",src:'Original',d:'+1 Dex. +1 AC while wielding a one-handed weapon and no shield.',asi:{dex:1}},
  cleaver:{n:'Reckless Cleaver',src:'Original',d:'Heavy weapon attacks: take -5 to hit for +10 damage (toggle "Power").'},
  deadeye:{n:'Deadeye',src:'Original',d:'Ranged weapon attacks: no long-range disadvantage; take -5 to hit for +10 damage (toggle "Power").'},
  medic:{n:'Battle Medic',src:'Original',d:'Action: heal an adjacent ally 1d6+4+their level once per short rest each.'},
  focus:{n:'Steady Focus',src:'Original',d:'Advantage on Constitution saves to maintain concentration.'},
  watchful:{n:'Watchful',src:'Original',d:'+5 initiative; you cannot be surprised.'},
  luckystar:{n:'Lucky Star',src:'Original',d:'3 luck points per long rest: automatically reroll a failed save or missed attack.'},
  arcaneinit:{n:'Arcane Initiate',src:'Original',d:'Learn Fire Bolt and Light cantrips plus Magic Missile (once per long rest, Int).'},
  skirmisher:{n:'Skirmisher',src:'Original',d:'+10 ft speed. Creatures you attack cannot make opportunity attacks against you this turn.'},
  ironwill:{n:'Iron Will',src:'Original',d:'+1 Wis. Advantage on saves vs frightened and charmed.',asi:{wis:1}},
  shieldwall:{n:'Shield Wall',src:'Original',d:'+1 Str. While using a shield, adjacent allies gain +1 AC.',asi:{str:1}}
};

const FIGHTING_STYLES = {
  archery:{n:'Archery',d:'+2 to ranged weapon attack rolls.'},
  defense:{n:'Defense',d:'+1 AC while wearing armor.'},
  dueling:{n:'Dueling',d:'+2 damage with a one-handed melee weapon and no other weapon.'},
  gwf:{n:'Great Weapon Fighting',d:'Reroll 1s and 2s on damage dice with two-handed melee weapons.'},
  protection:{n:'Protection',d:'Adjacent allies: attackers have disadvantage (when you hold a shield).'},
  twf:{n:'Two-Weapon Fighting',d:'Add ability modifier to off-hand attack damage.'}
};

const CONDITIONS = {
  blinded:'Auto-fail sight checks. Attacks against have advantage; its attacks have disadvantage.',
  charmed:"Can't attack the charmer.",
  frightened:"Disadvantage on checks and attacks while source is in sight; can't move closer.",
  grappled:'Speed 0.',
  incapacitated:"Can't take actions or reactions.",
  invisible:'Attacks against have disadvantage; its attacks have advantage.',
  paralyzed:'Incapacitated, auto-fails Str/Dex saves. Attacks have advantage; hits within 5 ft are crits.',
  poisoned:'Disadvantage on attack rolls and ability checks.',
  prone:'Melee attacks against have advantage, ranged have disadvantage. Its attacks have disadvantage.',
  restrained:'Speed 0. Attacks against have advantage; its attacks have disadvantage. Disadvantage on Dex saves.',
  stunned:'Incapacitated, auto-fails Str/Dex saves. Attacks against have advantage.',
  unconscious:'Incapacitated, prone. Attacks have advantage; hits within 5 ft are crits.',
  blessed:'+1d4 to attack rolls and saves.', baned:'-1d4 to attack rolls and saves.',
  dodging:'Attacks against have disadvantage; advantage on Dex saves.', hidden:'Next attack has advantage.',
  raging:'Bonus melee damage; resistance to bludgeoning, piercing and slashing.', outlined:'Attacks against have advantage.',
  marked:'Takes extra damage from the marker.', hasted:'+2 AC, double speed, extra attack.', slowed:'-2 AC, half speed.',
  asleep:'Unconscious until damaged.', sanctuary:'Attackers must pass a Wisdom save.'
};

// Lasting injuries (original content). sev: 1 minor, 2 major
const INJURIES = [
  {id:'brokenarm',n:'Broken Arm',sev:2,days:5,cost:120,d:'Disadvantage on Strength attack rolls.',mod:{strAtkDis:1}},
  {id:'crackedribs',n:'Cracked Ribs',sev:1,days:3,cost:60,d:'Max HP -5.',mod:{hpMax:-5}},
  {id:'concussion',n:'Concussion',sev:1,days:2,cost:50,d:'-2 initiative, disadvantage on Intelligence checks.',mod:{init:-2,intDis:1}},
  {id:'losteye',n:'Ruined Eye',sev:2,days:8,cost:220,d:'Disadvantage on ranged attacks; -5 passive Perception.',mod:{rangedDis:1,pp:-5}},
  {id:'knee',n:'Shattered Knee',sev:2,days:6,cost:160,d:'Speed -10 ft.',mod:{speed:-10}},
  {id:'haunted',n:'Haunted',sev:1,days:3,cost:80,d:'Disadvantage on saves vs frightened. Nightmares of the dark below.',mod:{fearDis:1}},
  {id:'deepwound',n:'Festering Wound',sev:1,days:3,cost:70,d:'-1 Constitution.',mod:{con:-1}},
  {id:'tornmuscle',n:'Torn Muscle',sev:1,days:2,cost:50,d:'-1 Strength.',mod:{str:-1}},
  {id:'scar',n:'Grim Scar',sev:1,days:0,cost:0,d:'Permanent. -1 Persuasion, +1 Intimidation. A story told in flesh.',mod:{persuasion:-1,intimidation:1},perm:true},
  {id:'shakyhands',n:'Shaking Hands',sev:1,days:2,cost:60,d:"Disadvantage on Sleight of Hand and thieves' tools.",mod:{handsDis:1}},
  {id:'lungrot',n:'Crypt Lung',sev:2,days:6,cost:150,d:'-1 Con, disadvantage on Con saves.',mod:{con:-1,conSaveDis:1}},
  {id:'mangledhand',n:'Mangled Hand',sev:2,days:7,cost:180,d:'-2 to all attack rolls.',mod:{atk:-2}}
];

const NAMES_A = ['Ald','Bren','Cael','Dorn','Edda','Fen','Garr','Hild','Isol','Jarek','Kess','Lorn','Mira','Nyx','Orsk','Perrin','Quill','Rhea','Sable','Tor','Ulric','Vey','Wren','Ysolt','Zed','Brann','Corva','Mael','Thane','Sera','Oswin','Rook','Ivo','Greta','Halv','Elsk'];
const NAMES_B = ['an','ric','wyn','a','ek','is','mund','ra','o','eth','ira','ard','ette','us','ka','grim','vald','hart','iel','ow'];
const SURNAMES = ['Ashgrave','Blackthorn','Coldwater','Duskmantle','Embervale','Grimsby','Hollowell','Ironvein','Lanternfall','Mournwood','Nightbell','Ravensmoor','Saltmarsh','Thornbury','Vane','Wolfsbane','Greaves','Holloway','Marsh','Crane'];
