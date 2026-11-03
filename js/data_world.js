// ===== World, story, factions, NPCs, quests, traps, encounters (all ORIGINAL content) =====
const THEMES = {
 cellar:{n:'Cellar',floor:['#4a3b2e','#54432f','#3f3226'],wall:'#3a2c22',wallTop:'#5a4636',accent:'#7a5a3a',types:['beast','humanoid','ooze'],obj:['barrel','crate','barrel','bones','shelf']},
 crypt:{n:'Crypt',floor:['#3a3d42','#43464b','#34373b'],wall:'#2c2e33',wallTop:'#4d5057',accent:'#6a6e78',types:['undead','humanoid','beast'],obj:['coffin','bones','statue','brazier','urn']},
 cave:{n:'Caverns',floor:['#3d3428','#463b2d','#352d23'],wall:'#2b241c',wallTop:'#4a3e30',accent:'#5a4a36',types:['beast','humanoid','monstrosity','giant','ooze'],obj:['rocks','mushrooms','bones','web','rocks']},
 sunken:{n:'Sunken Temple',floor:['#2f3a36','#36423d','#2a332f'],wall:'#222b28',wallTop:'#3c4a44',accent:'#4a6a5a',types:['humanoid','undead','aberration','ooze','plant','beast'],obj:['puddle','statue','reeds','bones','urn']},
 dwarven:{n:'Dwarven Halls',floor:['#45403a','#4f4942','#3e3934'],wall:'#33302b',wallTop:'#5a544c',accent:'#8a6a3a',types:['construct','giant','humanoid','elemental','monstrosity'],obj:['pillar','anvil','statue','brazier','crate']},
 cathedral:{n:'Hollow Cathedral',floor:['#3e2f33','#47363a','#36292d'],wall:'#2b2023',wallTop:'#4e3a3f',accent:'#8a2a2a',types:['undead','fiend','humanoid','dragon','construct'],obj:['pew','candles','statue','brazier','coffin']}
};
const REGIONS = {
 thornwick:{n:'Thornwick Vale',lvl:[1,3],theme:['cellar','crypt'],x:47,y:70,d:'Rolling barrows and gibbet-hung crossroads around the Last Lantern tavern. The graves here have grown restless.',faction:'lantern',unlock:0},
 blackwood:{n:'The Blackwood',lvl:[2,5],theme:['cave','crypt'],x:20,y:30,d:'A forest so old its trees remember the sun. Wolves, spiders and worse hunt beneath the canopy.',faction:'thorn',unlock:1},
 mirefen:{n:'Mirefen Marshes',lvl:[3,6],theme:['sunken','cave'],x:82,y:22,d:'Black water and drowned shrines. The Mire Witch bargains with travellers, and few return.',faction:'thorn',unlock:2},
 greyspire:{n:'Greyspire Mountains',lvl:[4,8],theme:['dwarven','cave'],x:55,y:12,d:'Abandoned dwarven deep-halls where iron guardians still keep their oaths.',faction:'ledger',unlock:3},
 sunkencoast:{n:'The Sunken Coast',lvl:[6,10],theme:['sunken','crypt'],x:62,y:85,d:'Bells toll beneath the waves where the old harbor city drowned in a single night.',faction:'rose',unlock:4},
 vellmora:{n:'Vellmora, the Hollow Cathedral',lvl:[8,12],theme:['cathedral','crypt'],x:82,y:58,d:'The ruined holy city. Its cathedral sings at night, though no living throat remains.',faction:'rose',unlock:5},
 palethrone:{n:'The Pale Throne',lvl:[9,12],theme:['cathedral'],x:50,y:38,d:'The citadel at the heart of the realm, where the Choirmaster conducts the Night That Does Not End.',faction:'court',unlock:6}
};
const FACTIONS = {
 lantern:{n:'The Lantern Wardens',d:'Monster-hunters sworn to keep the last lights burning. They use the Last Lantern as their lodge. Favor: better recruits and bounty pay.'},
 rose:{n:'Order of the Ashen Rose',d:'A militant church whose god has gone silent. Favor: cheaper shrine and infirmary services.'},
 ledger:{n:'The Grey Ledger',d:'Merchants, smugglers and fences who profit from every apocalypse. Favor: better market prices and rare stock.'},
 thorn:{n:'Circle of the Thorn',d:'Druids of the Blackwood fighting the rot that spreads from the Mirefen. Favor: herbal remedies and nature lore.'},
 court:{n:'The Pallid Court',d:'Bloodless nobles who serve the Pale Choirmaster. They do not bargain with the living — usually.'}
};
const REP_TIERS = [[-99,'Hostile'],[-10,'Wary'],[0,'Neutral'],[10,'Friendly'],[25,'Honored'],[50,'Exalted']];
const STORY = [
 {id:'ch1',n:'Rats Beneath the Lantern',region:'thornwick',theme:'cellar',floors:2,boss:'ratking',lvl:1,
  intro:'Marta Grell wipes her hands on her apron. "Something is gnawing through the cellar walls — and the rats came up singing. Rats don\'t sing." Below the tavern, a sealed door bears a pale, many-mouthed sigil.',
  outro:'The Rat King collapses, and from its matted crown falls a bone token carved with the same pale sigil: a choir of open mouths. The hooded stranger by the fire watches you return. "So it begins again," he murmurs.'},
 {id:'ch2',n:"The Sexton's Bell",region:'thornwick',theme:'crypt',floors:3,boss:'sextonmorr',lvl:2,
  intro:'The stranger names himself Sable. "Old Morr the sexton rang the bell at Thornwick barrow every night for forty years. He died last winter. He still rings it. Each toll wakes another grave."',
  outro:'Morr\'s bell cracks in two. Inside the bronze is a sliver of black glass that hums when held near the throat. Sable pales. "A Choir-shard. The Pallid Court is tuning the dead like instruments."'},
 {id:'ch3',n:"Gloam's Bargain",region:'mirefen',theme:'sunken',floors:3,boss:'mirewitch',lvl:4,
  intro:'"The shards were cast in the Mirefen," Sable says. "Old Mother Gloam knows where the bells were forged. She will want something for it. Do not give her your names."',
  outro:'Dying, the witch cackles: "The Iron Warden keeps the Sunstone, little candles. Only sunlight can break the Choir. Go dig it out of Greyspire — if the mountain lets you."'},
 {id:'ch4',n:'The Greyspire Seal',region:'greyspire',theme:'dwarven',floors:4,boss:'ironwarden',lvl:5,
  intro:'Hrolf Ironjaw spits into the forge. "My grandfather\'s clan sealed the Sunstone behind the Iron Warden. Thing was built to keep everyone out. Everyone."',
  outro:'Within the Warden\'s furnace-heart lies a shard of the Sunstone, warm as a living thing. Its light makes the undead in the tavern\'s cellar shriek three miles away.'},
 {id:'ch5',n:'Bells Beneath the Waves',region:'sunkencoast',theme:'sunken',floors:4,boss:'drownedbell',lvl:7,
  intro:'Every night the drowned bells of Saltmere ring, and every night the dead walk further inland. Brother Aldous begs you: "Silence them, and the Choir loses its voice."',
  outro:'The Bellringer sinks into the black tide. In the silence you hear, far to the east, a cathedral still singing alone.'},
 {id:'ch6',n:'The Hollow Cathedral',region:'vellmora',theme:'cathedral',floors:5,boss:'youngblackdragon',bossName:'Mournscale, Wyrm of the Nave',lvl:8,
  intro:'Vellmora\'s cathedral was the heart of the Ashen Rose. Now a black wyrm nests in its nave, coiled around the Choir\'s great organ, fed on hymns and corpses.',
  outro:'With the wyrm slain, the great organ falls silent. Its pipes point like fingers toward the Pale Throne. Sable kneels. "I served him once. Vael. End it, and let me rest."'},
 {id:'ch7',n:'The Pale Throne',region:'palethrone',theme:'cathedral',floors:5,boss:'palechoirmaster',lvl:10,
  intro:'The Night That Does Not End has lasted forty days. The Sunstone shard pulses in your pack. Above the Pale Throne, the Choirmaster conducts a symphony of the dead.',
  outro:'The Sunstone blazes and Vael\'s hymn breaks into a scream. For the first time in forty days, grey dawn spills over the Vale. The Last Lantern\'s windows glow; someone is already pouring ale. The dark is not gone — it never is — but tonight, it remembers fear.'}
];
// Side quests (handcrafted)
const SIDE_QUESTS = {
 sq_moss:{n:'Grave Moss for the Infirmary',giver:'aldous',d:'Brother Aldous needs Grave Moss that grows only in the Blackwood\'s barrows. Bring back 3 bundles.',type:'collect',item:'gravemoss',count:3,region:'blackwood',reward:{gold:120,xp:300,rep:{rose:8},items:['potgreater','potgreater'],renown:1}},
 sq_hammer:{n:"Ironjaw's Inheritance",giver:'hrolf',d:'Hrolf\'s grandfather fell in the Greyspire deep-halls with the clan hammer "Oathkeeper". Recover it.',type:'collect',item:'oathkeeper',count:1,region:'greyspire',reward:{gold:200,xp:900,rep:{ledger:5},renown:2,perk:'forgeDiscount'}},
 sq_tomes:{n:'The Lost Folios',giver:'ysolde',d:'Three folios of the Vellmoran Codex were scattered across the realm. Search bookshelves in any dungeon (Investigation) to find them.',type:'collect',item:'folio',count:3,region:'any',reward:{gold:150,xp:600,renown:2,perk:'libraryXP'}},
 sq_goblins:{n:'Thin the Raiders',giver:'vey',d:'Goblinoid raiders harry the Blackwood road. Slay 8 goblins, hobgoblins or bugbears.',type:'kill',tag:'goblinoid',count:8,region:'any',reward:{gold:140,xp:400,rep:{lantern:8},renown:1,recruit:1}},
 sq_wolves:{n:'Wolves at the Door',giver:'marta',d:'Something has been taking sheep — and a shepherd. Kill 6 wolves, worgs or dire wolves.',type:'kill',tag:'wolf',count:6,region:'any',reward:{gold:90,xp:250,rep:{lantern:4},renown:1}},
 sq_ledger:{n:"The Captain's Ledger",giver:'quill',d:'A bandit captain stole a Grey Ledger account book. Find a Bandit Captain in any dungeon and recover the ledger.',type:'kill',tag:'banditcaptain',count:1,region:'any',reward:{gold:300,xp:450,rep:{ledger:12},renown:1}},
 sq_rot:{n:'Cleanse the Rot',giver:'thornelder',d:'Aberrations and oozes spread rot from the Mirefen. Destroy 6 of them.',type:'kill',tag:'rot',count:6,region:'any',reward:{gold:200,xp:700,rep:{thorn:12},renown:2,items:['potresist']}},
 sq_missing:{n:'The Miller\'s Daughter',giver:'marta',d:'Elsa, the miller\'s girl, went into the Blackwood after her brother. Find and free her (a prisoner encounter in the Blackwood).',type:'rescue',region:'blackwood',count:1,reward:{gold:100,xp:500,rep:{lantern:6},renown:2}},
 sq_undead:{n:'Lay Them to Rest',giver:'aldous',d:'Destroy 15 undead anywhere in the realm.',type:'kill',tag:'undead',count:15,region:'any',reward:{gold:250,xp:800,rep:{rose:10},renown:2,items:['holywater','holywater','holywater']}}
};
// NPC dialogue. Nodes: {t:text, o:[{t, chk:{s,dc}, ok, no, go, act, req}]}
const NPCS = {
 marta:{n:'Marta Grell',role:'Innkeeper of the Last Lantern',col:'#a0662d',
  nodes:{
   start:{t:'"Sit, warm your bones. The Lantern stays lit as long as there\'s oil and coin — and lately, I\'m short on both. What d\'you need?"',o:[{t:'Any rumors?',go:'rumor'},{t:'Tell me about this place.',go:'place'},{t:'[Persuasion DC 12] Surely a round on the house, for the heroes who keep you safe?',chk:{s:'persuasion',dc:12},ok:'drinkok',no:'drinkno',once:'m_drink'},{t:'[Insight DC 14] You keep glancing at that empty chair.',chk:{s:'insight',dc:14},ok:'chair',no:'chairno',once:'m_chair'},{t:'Any work?',act:'quests:marta'},{t:'Farewell.',go:'end'}]},
   rumor:{t:'$RUMOR',o:[{t:'Another.',go:'rumor'},{t:'Back.',go:'start'}]},
   place:{t:'"The Last Lantern\'s stood four hundred years. Wardens drank here when there were Wardens worth the name. Put coin into her and she\'ll give back — a forge, a shrine, a library. My grandmother called it the last light before the dark."',o:[{t:'Back.',go:'start'}]},
   drinkok:{t:'She laughs despite herself and pours dark ale. "One. Don\'t tell the others." (Party gains 5 temporary HP on the next expedition.)',act:'buff:ale',o:[{t:'Back.',go:'start'}]},
   drinkno:{t:'"Heroes pay like everyone else. Heroes pay double, actually — they break more chairs."',o:[{t:'Back.',go:'start'}]},
   chair:{t:'Her face hardens, then softens. "My Tomas. Went into the Pale Throne when the Night first fell. Took the old Warden blade with him." (Codex: The Empty Chair)',act:'codex:emptychair',o:[{t:'Back.',go:'start'}]},
   chairno:{t:'"Mind your own drink."',o:[{t:'Back.',go:'start'}]}
  }},
 aldous:{n:'Brother Aldous',role:'Keeper of the Shrine & Infirmary',col:'#c9a15a',
  nodes:{
   start:{t:'"The Rose still blooms, even in ash. Are you hurt, child? Or merely troubled?"',o:[{t:'[Religion DC 13] What is the Pale Choir?',chk:{s:'religion',dc:13},ok:'choir',no:'choirno',once:'a_choir'},{t:'[Medicine DC 12] Let me help with your patients.',chk:{s:'medicine',dc:12},ok:'medok',no:'medno',once:'a_med'},{t:'Any work?',act:'quests:aldous'},{t:'Farewell.',go:'end'}]},
   choir:{t:'"A heresy older than the Rose. They believe death is a song unfinished, and that the dead may be tuned to sing it. Their master, Vael, was a cantor of our order." (Codex: The Pale Choir)',act:'codex:palechoir',o:[{t:'Back.',go:'start'}]},
   choirno:{t:'"Some knowledge is a wound. Ask me again when you are stronger."',o:[{t:'Back.',go:'start'}]},
   medok:{t:'You set two bones and lance a fever. Aldous bows. "The Rose remembers kindness." (+5 Ashen Rose reputation)',act:'rep:rose:5',o:[{t:'Back.',go:'start'}]},
   medno:{t:'Your clumsy bandage makes a soldier howl. Aldous sighs and gently takes over.',o:[{t:'Back.',go:'start'}]}
  }},
 hrolf:{n:'Hrolf Ironjaw',role:'Smith of the Forge',col:'#7a1f1f',
  nodes:{
   start:{t:'"Iron doesn\'t lie, doesn\'t rot, doesn\'t come back from the grave. Mostly. Bring me scrap and coin, I\'ll make you something that bites."',o:[{t:'[Intimidation DC 14] Your prices are robbery.',chk:{s:'intimidation',dc:14},ok:'intok',no:'intno',once:'h_int'},{t:'[History DC 12] Tell me of the Greyspire clans.',chk:{s:'history',dc:12},ok:'hist',no:'histno',once:'h_hist'},{t:'Any work?',act:'quests:hrolf'},{t:'Farewell.',go:'end'}]},
   intok:{t:'Hrolf grins through his beard. "Ha! Spine. Fine — ten off the next job." (Next forge upgrade 25% cheaper)',act:'perk:forgeOnce',o:[{t:'Back.',go:'start'}]},
   intno:{t:'He sets down a hammer the size of your head. "Say that again." You do not.',o:[{t:'Back.',go:'start'}]},
   hist:{t:'"Seven clans. Six dead. The seventh — mine — sealed the Sunstone behind the Iron Warden and walked out under the sky. We swore never to go back." (Codex: The Greyspire Clans)',act:'codex:greyspire',o:[{t:'Back.',go:'start'}]},
   histno:{t:'"Bah. Read a book."',o:[{t:'Back.',go:'start'}]}
  }},
 ysolde:{n:'Ysolde the Grey',role:'Sage of the Library',col:'#2e3b5c',
  nodes:{
   start:{t:'"Knowledge is a lantern too, though it burns the hand that carries it. What would you learn?"',o:[{t:'[Arcana DC 13] How does one break a Choir-shard?',chk:{s:'arcana',dc:13},ok:'arc',no:'arcno',once:'y_arc'},{t:'[Investigation DC 15] Your ledgers don\'t add up. What are you hiding?',chk:{s:'investigation',dc:15},ok:'inv',no:'invno',once:'y_inv'},{t:'Any work?',act:'quests:ysolde'},{t:'Farewell.',go:'end'}]},
   arc:{t:'"Sound bound in glass. Only true sunlight unbinds it — and there has been none for forty days. The dwarves kept a stone that remembered the sun..." (Codex: Choir-Shards; +200 XP to party)',act:'codex:shards|xp:200',o:[{t:'Back.',go:'start'}]},
   arcno:{t:'"Come back when you\'ve read more than tavern menus."',o:[{t:'Back.',go:'start'}]},
   inv:{t:'She closes the book slowly. "I was Vael\'s student. Before. I left when he began tuning the dying." She presses a scroll into your hand. (Gain a Spell Scroll; Codex: Ysolde\'s Past)',act:'codex:ysolde|item:scroll',o:[{t:'Back.',go:'start'}]},
   invno:{t:'"The numbers are fine. Your arithmetic is not."',o:[{t:'Back.',go:'start'}]}
  }},
 vey:{n:'Captain Vey',role:'Warden-Captain of the Barracks',col:'#3b331f',
  nodes:{
   start:{t:'"Every sword I hire comes back scarred or doesn\'t come back. You want soldiers, you pay. You want my respect, you bleed."',o:[{t:'[Athletics DC 13] Arm-wrestle you for a discount.',chk:{s:'athletics',dc:13},ok:'armok',no:'armno',once:'v_arm'},{t:'[Persuasion DC 14] Tell me about the Wardens.',chk:{s:'persuasion',dc:14},ok:'wardens',no:'wardno',once:'v_ward'},{t:'Any work?',act:'quests:vey'},{t:'Farewell.',go:'end'}]},
   armok:{t:'Vey\'s arm slams the table. She blinks. "...Well. Recruitment fees halved for your next hire."',act:'perk:recruitHalf',o:[{t:'Back.',go:'start'}]},
   armno:{t:'Your knuckles crack against the oak. The barracks roars with laughter.',o:[{t:'Back.',go:'start'}]},
   wardens:{t:'"There were three hundred of us once. Now there\'s me, a few old fools, and whoever walks through that door." (Codex: The Lantern Wardens; +5 Warden reputation)',act:'codex:wardens|rep:lantern:5',o:[{t:'Back.',go:'start'}]},
   wardno:{t:'"Earn it first."',o:[{t:'Back.',go:'start'}]}
  }},
 sable:{n:'Sable',role:'The Hooded Stranger',col:'#1a1a1a',
  nodes:{
   start:{t:'The stranger by the fire does not lower his hood. "You carry the smell of the deep places. Good. The Choir is waking, and someone must stand against it."',o:[{t:'What is happening to the realm?',go:'night'},{t:'[Insight DC 15] You speak of the Choir like one who heard it.',chk:{s:'insight',dc:15},ok:'insok',no:'insno',once:'s_ins'},{t:'[Deception DC 14] Claim you are an agent of the Pallid Court.',chk:{s:'deception',dc:14},ok:'decok',no:'decno',once:'s_dec'},{t:'Farewell.',go:'end'}]},
   night:{t:'"Forty days without dawn. The dead walk because something is calling them, a song from the Pale Throne. Follow the shards. They will lead you to the singer." (Codex: The Night That Does Not End)',act:'codex:night',o:[{t:'Back.',go:'start'}]},
   insok:{t:'A long silence. "I sang with them. For a hundred years. I stopped when I remembered my daughter\'s name." His hands are very pale. (Codex: Sable)',act:'codex:sable',o:[{t:'Back.',go:'start'}]},
   insno:{t:'"Everyone has heard it, if they listen at night."',o:[{t:'Back.',go:'start'}]},
   decok:{t:'He laughs — a dry, dead sound. "Then you would know the passphrase is a hymn, not a word. Clever. Take this; it may save you from your own lies." (Gain Potion of Heroism)',act:'item:potheroism',o:[{t:'Back.',go:'start'}]},
   decno:{t:'"The Court does not smell of sweat and ale. Do not try that again — with them."',o:[{t:'Back.',go:'start'}]}
  }},
 quill:{n:'Quill',role:'Fence of the Grey Ledger',col:'#3e7b3e',
  nodes:{
   start:{t:'A thin woman counts coins without looking at them. "Everything has a price. Even you. Especially you."',o:[{t:'Show me the black market.',act:'blackmarket'},{t:'[Persuasion DC 15] Let\'s talk about a standing discount.',chk:{s:'persuasion',dc:15},ok:'discok',no:'discno',once:'q_disc'},{t:'Any work?',act:'quests:quill'},{t:'Farewell.',go:'end'}]},
   discok:{t:'"Fine. You\'re good for business." (+10 Grey Ledger reputation)',act:'rep:ledger:10',o:[{t:'Back.',go:'start'}]},
   discno:{t:'"No."',o:[{t:'Back.',go:'start'}]}
  }},
 thornelder:{n:'Elder Wenna of the Thorn',role:'Druid Envoy',col:'#24331f',
  nodes:{
   start:{t:'"The forest is dying from the roots up. Rot from the Mirefen. If you would help, the Circle remembers its friends."',o:[{t:'[Nature DC 13] What causes the rot?',chk:{s:'nature',dc:13},ok:'nat',no:'natno',once:'t_nat'},{t:'Any work?',act:'quests:thornelder'},{t:'Farewell.',go:'end'}]},
   nat:{t:'"The Choir\'s bells were cast in Mirefen bog-iron. Wherever they ring, the soil sours." (Codex: The Rot; +5 Thorn reputation)',act:'codex:rot|rep:thorn:5',o:[{t:'Back.',go:'start'}]},
   natno:{t:'"Watch the soil. It will tell you, in time."',o:[{t:'Back.',go:'start'}]}
  }}
};
const RUMORS = [
 '"They say the Blackwood spiders weave webs strong enough to hold a horse. Bring fire."',
 '"A Warden came back from the Mirefen last month with no shadow. Didn\'t notice till the lamps were lit."',
 '"Trolls in the Greyspire. Burn them or they get back up. Acid works too, if you can stand the smell."',
 '"The drowned bells only ring when the tide is out. Except they rang last night. And the tide was in."',
 '"Old crypts have pressure plates. Look for clean stones in a dirty floor — that\'s the trap."',
 '"Never open a chest that\'s breathing. I\'m serious."',
 '"Ghouls\' claws paralyze. Elves shrug it off, lucky bastards."',
 '"Hit skeletons with something heavy. Hammers, maces. Swords just rattle off."',
 '"If you hear singing in the dark, don\'t sing back."',
 '"The Grey Ledger will buy anything. Even things that scream."'
];
const CODEX = {
 necromancy:{n:'The Grave-Art',cat:'Lore',t:'Since the Night fell, the boundary between the living and the buried has worn thin. Necromancers of the Last Lantern bind the restless dead to fight for the living — a bargain the Ashen Rose calls heresy and the desperate call survival. Bound dead crumble when their master rests or leaves the dark. (Original Necromancer class)'},
 night:{n:'The Night That Does Not End',cat:'Lore',t:'Forty days ago the sun rose grey, then did not rise at all. Crops fail; the dead walk; lanterns are worth more than gold.'},
 palechoir:{n:'The Pale Choir',cat:'Lore',t:'A heresy of the Ashen Rose that holds death to be an unfinished hymn. Its cantors bind the voices of the dead into glass.'},
 shards:{n:'Choir-Shards',cat:'Lore',t:'Slivers of black glass that hum with captured voices. They animate the dead nearby. Sunlight unbinds them.'},
 emptychair:{n:'The Empty Chair',cat:'People',t:'Marta keeps a chair for her husband Tomas, who took the old Warden blade into the Pale Throne and never returned.'},
 greyspire:{n:'The Greyspire Clans',cat:'Places',t:'Seven dwarven clans once mined the Greyspire. Six fell to something in the deep. The seventh sealed the Sunstone behind the Iron Warden.'},
 ysolde:{n:"Ysolde's Past",cat:'People',t:'Ysolde was Vael\'s student before his fall. She fled when he began "tuning" the dying.'},
 wardens:{n:'The Lantern Wardens',cat:'Factions',t:'An order of monster-hunters once three hundred strong. Their lodge is the Last Lantern.'},
 sable:{n:'Sable',cat:'People',t:'A former cantor of the Pale Choir who broke free after a century. He is not entirely alive.'},
 rot:{n:'The Rot',cat:'Lore',t:'Bog-iron bells poison the land where they ring. The Circle of the Thorn fights a losing war against it.'},
 undead:{n:'Undead',cat:'Bestiary',t:'Raised by the Choir\'s song. Vulnerable to radiant power; many shrug off poison. Skeletons break under bludgeoning blows.'},
 beast:{n:'Beasts',cat:'Bestiary',t:'Starving and maddened by the endless night. Pack hunters gain advantage when allies surround prey.'},
 humanoid:{n:'Humanoids',cat:'Bestiary',t:'Bandits, cultists and raiders. Many can be reasoned with — or intimidated.'},
 fiend:{n:'Fiends',cat:'Bestiary',t:'Drawn through by the Choir\'s hymn. Resistant to many elements; holy water burns them.'},
 dragon:{n:'Dragons',cat:'Bestiary',t:'Ancient, cunning, and armed with devastating breath. Spread out to avoid being caught together.'},
 aberration:{n:'Aberrations',cat:'Bestiary',t:'Things from the deep places that should not be. Many cause madness or paralysis.'},
 ooze:{n:'Oozes',cat:'Bestiary',t:'Mindless and acidic. Some split when cut. Metal corrodes in them.'},
 construct:{n:'Constructs',cat:'Bestiary',t:'Animated by old magic. Immune to poison and fear; often resistant to mundane weapons.'},
 giant:{n:'Giants & Trolls',cat:'Bestiary',t:'Huge and brutal. Trolls regenerate unless burned with fire or acid.'},
 monstrosity:{n:'Monstrosities',cat:'Bestiary',t:'Unnatural predators: owlbears, basilisks, chimeras. Each has a trick; learn it or die.'},
 elemental:{n:'Elementals',cat:'Bestiary',t:'Living stone, fire, air and water, bound into service or wild.'},
 plant:{n:'Plants',cat:'Bestiary',t:'Rot-fed vegetation that hunts. Fire is a friend.'},
 fey:{n:'Fey',cat:'Bestiary',t:'Bargainers and tricksters. Never give them your true name.'},
 lastlantern:{n:'The Last Lantern',cat:'Places',t:'A four-hundred-year-old coaching inn at the Thornwick crossroads, now the last lodge of the Lantern Wardens.'},
 inscription1:{n:'The Choir Hymnal (fragment)',cat:'Lore',t:'"...and the voice once given shall not be taken back, for the dead owe a debt of song..."'},
 inscription2:{n:'Dwarven Warding Rune',cat:'Lore',t:'A rune of sealing: "What is kept, stays kept. What enters, stays."'},
 inscription3:{n:'Rose Litany',cat:'Lore',t:'"Ash to rose, rose to ash. The flame forgets nothing."'},
 inscription4:{n:'A Warden\'s Last Words',cat:'People',t:'Scratched into stone: "Tomas — if you read this, the blade is in the choir loft. Don\'t look at the organ."'},
 inscription5:{n:'Saltmere Tide Tables',cat:'Places',t:'The drowned city of Saltmere fell in one night when the sea rose to meet the bells.'},
 inscription6:{n:'Vael\'s Sermon',cat:'Lore',t:'"Why should the song end? Why should anything end?"'}
};
for(const r in REGIONS) CODEX['reg_'+r]={n:REGIONS[r].n,cat:'Places',t:REGIONS[r].d};
for(const f in FACTIONS) CODEX['fac_'+f]={n:FACTIONS[f].n,cat:'Factions',t:FACTIONS[f].d};
// Traps: det = Perception/Investigation DC, dis = disarm DC, sv save
const TRAPS = {
 dart:{n:'Poison Dart Plate',det:13,dis:13,dskill:'tools',sv:'dex',dc:13,dmg:'2d4',dt:'piercing',poison:'2d6',magic:0},
 pit:{n:'Hidden Pit',det:12,dis:10,dskill:'tools',sv:'dex',dc:13,dmg:'2d6',dt:'bludgeoning',fall:1,magic:0},
 spikedpit:{n:'Spiked Pit',det:14,dis:12,dskill:'tools',sv:'dex',dc:14,dmg:'2d10',dt:'piercing',fall:1,magic:0,tier:2},
 blade:{n:'Scything Blade',det:15,dis:15,dskill:'tools',sv:'dex',dc:15,dmg:'2d10',dt:'slashing',magic:0,tier:2},
 fireglyph:{n:'Fire Glyph',det:15,dis:15,dskill:'arcana',sv:'dex',dc:15,dmg:'4d6',dt:'fire',radius:2,magic:1,tier:2},
 gas:{n:'Poison Gas Vent',det:13,dis:13,dskill:'tools',sv:'con',dc:13,dmg:'3d6',dt:'poison',radius:2,cond:'poisoned',magic:0},
 collapse:{n:'Collapsing Ceiling',det:14,dis:15,dskill:'athletics',sv:'dex',dc:15,dmg:'4d6',dt:'bludgeoning',radius:1,magic:0,stone:1,tier:2},
 net:{n:'Falling Net',det:10,dis:12,dskill:'tools',sv:'dex',dc:11,dmg:'1d4',dt:'bludgeoning',cond:'restrained',magic:0},
 rune:{n:'Lightning Rune',det:14,dis:14,dskill:'arcana',sv:'dex',dc:14,dmg:'3d8',dt:'lightning',magic:1,tier:2},
 necroglyph:{n:'Choir Sigil',det:16,dis:16,dskill:'religion',sv:'wis',dc:15,dmg:'4d8',dt:'necrotic',radius:2,cond:'frightened',magic:1,tier:3}
};
const OBSTACLES = {
 chasm:{n:'Crumbling Chasm',d:'A gap in the floor drops into blackness.',opts:[{s:'athletics',dc:12,t:'Leap across',adv:'rope'},{s:'acrobatics',dc:13,t:'Balance along the ledge'}],fail:'2d6',dt:'bludgeoning'},
 rubble:{n:'Collapsed Passage',d:'Fallen stone chokes the corridor.',opts:[{s:'athletics',dc:13,t:'Heave the stones aside',adv:'crowbar'},{s:'investigation',dc:14,t:'Find the keystone to topple it safely'}],fail:'1d8',dt:'bludgeoning'},
 flood:{n:'Flooded Passage',d:'Black water fills the tunnel to the ceiling for a few yards.',opts:[{s:'athletics',dc:12,t:'Swim through',adv:'rope'},{s:'survival',dc:13,t:'Read the current'}],fail:'1d10',dt:'bludgeoning',exhaust:0},
 ward:{n:'Humming Ward',d:'A shimmering barrier of old magic crosses the hall.',opts:[{s:'arcana',dc:14,t:'Unravel the ward'},{s:'religion',dc:15,t:'Recite the counter-litany'}],fail:'2d8',dt:'force'},
 thorns:{n:'Rotting Thornwall',d:'Thick, weeping briars bar the way.',opts:[{s:'nature',dc:12,t:'Find the weak stems'},{s:'athletics',dc:14,t:'Hack through'}],fail:'2d4',dt:'piercing',poison:1},
 ledge:{n:'Narrow Ledge',d:'A crumbling ledge over a deep shaft is the only path.',opts:[{s:'acrobatics',dc:12,t:'Edge across'},{s:'athletics',dc:14,t:'Climb the wall instead',adv:'rope'}],fail:'2d6',dt:'bludgeoning'}
};
const TAVERN_UPGRADES = {
 forge:{n:'Forge',d:['Not built','Smithy: +1 weapon/armor upgrades, salvage','Runeforge: +2 upgrades, enchant affixes','Masterforge: +3 upgrades, rare affixes'],cost:[[0,0],[150,1],[600,4],[1800,10]]},
 infirmary:{n:'Infirmary',d:['Cot by the fire: injuries heal slowly','Infirmary: injuries heal 1 day faster, treatment -20%','Surgery: treatment -40%, cure 2 injuries per day','Sanatorium: treatment -60%, recover from major injuries fast'],cost:[[0,0],[120,1],[500,3],[1500,8]]},
 library:{n:'Library',d:['A shelf of books','Library: identify items, re-prepare spells, +5% XP','Scriptorium: scribe spell scrolls, +10% XP, codex lore','Archive: +15% XP, train heroes with gold'],cost:[[0,0],[100,1],[500,3],[1500,8]]},
 barracks:{n:'Barracks',d:['Roster of 6','Barracks: roster 9, better recruits','Hall of Arms: roster 12, recruits up to party level','Warden Lodge: roster 16, veteran recruits with magic gear'],cost:[[0,0],[150,1],[600,4],[1800,10]]},
 shrine:{n:'Shrine',d:['A candle and a prayer','Shrine: blessing before expeditions (Bless for first battle)','Chapel: blessing + 10 temp HP, remove curses','Cathedral of Ash: revive fallen heroes without injury once per expedition'],cost:[[0,0],[120,1],[500,3],[1500,8]]},
 market:{n:'Market Stall',d:['A peddler visits','Market: more stock','Trade Hall: uncommon magic items, sell for 60%','Grand Bazaar: rare items, sell for 75%'],cost:[[0,0],[100,1],[450,3],[1400,8]]}
};
const PRISONERS = [
 {n:'a chained Warden scout',reward:'recruit'},{n:'a weeping merchant',reward:'gold'},{n:'a half-starved acolyte',reward:'blessing'},{n:'a captured dwarf miner',reward:'map'},{n:'a ragged child',reward:'gold'}
];
