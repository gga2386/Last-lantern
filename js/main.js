// ===== Boot, state, saves =====
const SAVE_KEY='lastlantern_save_v1', HB_KEY='lastlantern_homebrew_v1', VERSION=1;
function newState(){ const s={v:VERSION,screen:'title',roster:[],party:[],stash:[],gold:150,renown:0,day:1,homebrew:loadHomebrew(),tavern:{forge:0,infirmary:0,library:0,barracks:0,shrine:0,market:0},
  story:{ch:0,done:[]},quests:{active:[],done:[]},rep:{lantern:0,rose:0,ledger:0,thorn:0,ash:0},codex:[],journal:[],flags:{},perks:{},recruits:[],market:null,buffs:{},packPlan:[],run:null,combat:null,
  settings:{autoEnd:true,fastAnim:false,quickRolls:false},fast:false,autoPlay:false,busy:false};
  for(const f in (typeof FACTIONS!=='undefined'?FACTIONS:{})) if(s.rep[f]==null) s.rep[f]=0; return s; }
let G={roster:[],party:[],homebrew:[],settings:{},flags:{},perks:{},buffs:{},tavern:{forge:0,infirmary:0,library:0,barracks:0,shrine:0,market:0},quests:{active:[],done:[]},story:{ch:0,done:[]},rep:{},codex:[],journal:[],stash:[],recruits:[]};
function activeParty(){ return G.party.map(id=>G.roster.find(h=>h.id===id)).filter(Boolean); }
function loadHomebrew(){ try{ return JSON.parse(localStorage.getItem(HB_KEY)||'[]'); }catch(e){ return []; } }
function saveHomebrew(){ try{ localStorage.setItem(HB_KEY,JSON.stringify(G.homebrew||[])); }catch(e){} saveGame(); }
function serialize(){ const skip=new Set(['combat','fast','autoPlay','busy','screen','_pendingOutro']); return JSON.stringify(G,(k,v)=>{ if(skip.has(k)&&v!==undefined&&typeof v!=='function') return undefined; if(k==='_fcache') return undefined; if(v instanceof Set) return undefined; return v; }); }
function saveGame(){ if(!G||!G.roster||!G.roster.length) return false; if(G.combat) return false; try{ localStorage.setItem(SAVE_KEY,serialize()); return true; }catch(e){ console.warn('save failed',e.message); return false; } }
function autosave(){ saveGame(); }
function migrateHeroLook(h){ if(!h) return; if(h.sex!=='m'&&h.sex!=='f') h.sex=heroSex(h); if(!h.portrait||!portraitValid(h.portrait)) h.portrait=legacyPortraitId(h); delete h.app; }
function applyLoaded(o){ const base=newState(); const fast=G.fast, auto=G.autoPlay; G=Object.assign(base,o); G.fast=fast; G.autoPlay=auto; G.combat=null; G.busy=false; G.settings=G.settings||{}; if(G.settings.quickRolls==null) G.settings.quickRolls=false; for(const h of (G.roster||[])) if(!h.dice||(typeof DICE_STYLES!=='undefined'&&!DICE_STYLES[h.dice])) h.dice='bone';
  const hb=loadHomebrew(); for(const c of hb) if(!G.homebrew.some(x=>x.id===c.id)) G.homebrew.push(c);
  for(const h of G.roster){ h._fcache=null; migrateHeroLook(h); } for(const h of (G.recruits||[])) migrateHeroLook(h);
  if(G.run&&G.run.map){ for(const e of G.run.map.ents) if(e.type==='mon') e.inCombat=false; } if(!G.market) refreshMarket(); return true; }
function loadGame(){ const s=localStorage.getItem(SAVE_KEY); if(!s){ toast('No saved game.'); return false; } try{ applyLoaded(JSON.parse(s)); return true; }catch(e){ toast('Save is corrupt.'); return false; } }
function exportSave(){ saveGame(); const data=serialize(); const blob=new Blob([data],{type:'application/json'}); const a=el('a',{href:URL.createObjectURL(blob),download:'last-lantern-day'+G.day+'.json'}); document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); toast('Save exported.'); }
function importSave(){ const inp=el('input',{type:'file',accept:'.json,application/json',style:{display:'none'}}); inp.addEventListener('change',()=>{ const f=inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ importSaveText(r.result); }catch(e){ toast('Could not read that file.'); } }; r.readAsText(f); }); document.body.appendChild(inp); inp.click(); setTimeout(()=>inp.remove(),60000); }
function importSaveText(txt){ const o=JSON.parse(txt); if(!o||!Array.isArray(o.roster)) throw new Error('bad'); applyLoaded(o); saveGame(); UI.closeAll(); resumeGame(); toast('Save imported.'); }
function resumeGame(){ if(G.run&&G.run.map){ R.cam.z=R.cam.z||1; const L=leader(); if(typeof computeVis==='function') computeVis(); UI.showDungeon(); if(L) centerOn(L.x,L.y,true); } else showTavern(); }
UI.showTavern=()=>showTavern();
window.addEventListener('error',e=>{ console.error('Uncaught:',e.message); try{ toast('⚠ '+e.message); }catch(_){} });
window.addEventListener('unhandledrejection',e=>{ console.error('Unhandled:',e.reason&&e.reason.stack||e.reason); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) saveGame(); });
function boot(){ const cv=document.getElementById('cv'); initRender(cv); initInput(cv,(tx,ty)=>onTapDungeon(tx,ty)); G=newState(); refreshMarket();
  const pre=localStorage.getItem(SAVE_KEY); titleScreen(); document.getElementById('logtoggle').addEventListener('click',()=>{ document.getElementById('log').classList.toggle('open'); }); }
window.addEventListener('DOMContentLoaded',boot);
