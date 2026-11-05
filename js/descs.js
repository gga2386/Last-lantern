// Creator option descriptions (original text; spell data from SRD 5.1 entries in data_spells.js)
const SKILL_DESC={
 acrobatics:'Keep your footing on ice and rubble, tumble past foes and slip free of grapples.',
 animal:'Calm, read or command beasts — soothe a hound or steady a frightened mount.',
 arcana:'Recall lore of spells, sigils, magic items and the planes; identify warded relics.',
 athletics:'Climb, jump, swim, force doors and shove or grapple enemies.',
 deception:'Lie convincingly, bluff guards and fool monsters during parley.',
 history:'Remember past wars, ruined kingdoms and the meaning of old inscriptions.',
 insight:'Read intent and spot a lie — tells you when an NPC or monster is bluffing.',
 intimidation:'Cow foes with threats; can make parleying monsters back down or flee.',
 investigation:'Search rooms for clues, find hidden switches and work out how traps function.',
 medicine:'Stabilize the dying and tend wounds; helps treat lasting injuries.',
 nature:'Know plants, beasts, terrain and weather; identify herbs and natural hazards.',
 perception:'Notice hidden foes, traps and secret doors before they find you.',
 performance:'Entertain with music, story or dance — earns coin and goodwill in town.',
 persuasion:'Win people over honestly; better prices, recruits and peaceful parleys.',
 religion:'Know gods, rites and the undead; read holy symbols and shrine wards.',
 sleight:'Pick pockets, palm objects and disarm delicate mechanisms by hand.',
 stealth:'Move unseen and unheard to sneak past or ambush enemies.',
 survival:'Track creatures, find safe paths and forage; avoid getting lost below.',
 tools:'Pick locks and disarm traps with thieves\u2019 tools.'
};
const ABIL_FULL={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
function skillDesc(s){ return SKILL_DESC[s]||'A trained skill used for ability checks.'; }
function spellMeta(id){ const s=SPELLS[id]; if(!s) return [];
  const lvl=s.l===0?'Cantrip':(['','1st','2nd','3rd'][s.l]||s.l+'th')+'-level';
  const ct={a:'1 action',b:'1 bonus action',r:'1 reaction'}[s.t]||'1 action';
  const rng=s.r===0?'Self':s.r<=1?'Touch / 5 ft':(s.r*5)+' ft ('+s.r+' tiles)';
  const roll=s.atk?(s.atk==='m'?'Melee':'Ranged')+' spell attack':s.sv?(ABIL_FULL[s.sv]||s.sv)+' save'+(s.half?' (half on success)':''):'No attack or save';
  const eff=s.dmg?s.dmg+' '+(s.dt||'')+' damage'+(s.up?' (+'+s.up+' per higher slot)':''):(s.heal?'Heals '+s.heal:'Utility / effect');
  const r=[['Level',lvl+' '+s.s],['Casting time',ct],['Range',rng],['Roll',roll],['Effect',eff]];
  if(s.area) r.push(['Area',({r:'Radius',cone:'Cone',line:'Line',cube:'Cube'}[s.area.sh]||'Area')+' '+s.area.sz+' tiles']);
  return r; }
function infoPopup(title,sub,rows,text){ const old=document.getElementById('c-info'); if(old) old.remove();
  const close=()=>w.remove();
  const w=el('div',{class:'cinfo-wrap',id:'c-info',onclick:e=>{ if(e.target===w) close(); }},
    el('div',{class:'cinfo-box'},el('h3',null,title),sub?el('div',{class:'cinfo-sub'},sub):null,
      rows&&rows.length?el('table',{class:'cinfo-t'},rows.map(r=>el('tr',null,el('th',null,r[0]),el('td',null,r[1])))):null,
      el('p',{class:'cinfo-d',id:'c-info-d'},text),el('button',{class:'chip',id:'c-info-x',onclick:close},'Close')));
  document.body.appendChild(w); }
function infoBtn(fn){ return el('span',{class:'ibtn',role:'button','aria-label':'Details',onclick:e=>{ e.stopPropagation(); e.preventDefault(); fn(); }},'i'); }
function spellInfo(id){ const s=SPELLS[id]; infoPopup(s.n,s.ae?'✧ Arcana Experimental':null,spellMeta(id),s.d); }
function skillInfo(s){ infoPopup(SKILL_NAME[s],'Ability: '+(ABIL_FULL[SKILLS[s]]||'Dexterity'),null,skillDesc(s)); }
// LEVELUP_INFO_V1 — level-up (i) popups
function featureInfo(f,sub){ const F=FEATURES[f]; infoPopup(F?F.n:f,sub||'Class feature',null,F&&F.d?F.d:'A new class feature.'); }
function subclassInfo(c,k){ const s=c.subs[k]; const rows=Object.keys(s.feats).map(l=>['Level '+l,s.feats[l].map(f=>FEATURES[f]?FEATURES[f].n:f).join(', ')]);
  const txt=Object.values(s.feats).flat().filter((f,i,a)=>a.indexOf(f)===i).map(f=>FEATURES[f]?FEATURES[f].n+': '+(FEATURES[f].d||''):f).join('\n\n');
  infoPopup(s.n,s.src==='Original'?'✧ Arcana Experimental (original)':'SRD subclass',rows,txt); }
function featInfo(f){ infoPopup(FEATS[f].n,'Feat',null,FEATS[f].d); }
function asiInfo(){ infoPopup('Ability Score Improvement','Choose one',null,'Raise one ability score by 2, or two scores by 1 each (max 20). Or take a feat instead: a special talent that grants new abilities.'); }
