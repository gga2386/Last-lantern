// ===== Isometric renderer with lighting and fog of war =====
const TW=64, TH=32, WALLH=22;
const R={cv:null,ctx:null,cam:{x:0,y:0,z:1},dirty:true,imgs:{},tileCache:{},portraitCache:{},floaters:[],anim:null,hl:{reach:null,targets:null,area:null,path:null,sel:null},vis:null,t0:performance.now()};
function loadImg(k,src){ const im=new Image(); im.src=src; im.onload=()=>{R.dirty=true;}; R.imgs[k]=im; return im; }
['undead','goblinoid','beast','fiend','dragon','aberration','humanoid'].forEach(k=>loadImg(k,'assets/m_'+k+'.jpg'));
function initRender(cv){ R.cv=cv; R.ctx=cv.getContext('2d'); resizeCanvas(); window.addEventListener('resize',()=>{resizeCanvas();}); requestAnimationFrame(frame); }
function resizeCanvas(){ if(!R.cv) return; const dpr=Math.min(2,window.devicePixelRatio||1); const r=R.cv.getBoundingClientRect(); R.cv.width=Math.max(1,Math.round(r.width*dpr)); R.cv.height=Math.max(1,Math.round(r.height*dpr)); R.dpr=dpr; R.dirty=true; }
function isoX(x,y){ return (x-y)*TW/2; } function isoY(x,y){ return (x+y)*TH/2; }
function toScreen(x,y){ const z=R.cam.z; return [ (isoX(x,y)-R.cam.x)*z + R.cv.width/R.dpr/2, (isoY(x,y)-R.cam.y)*z + R.cv.height/R.dpr/2 ]; }
function toTile(px,py){ const z=R.cam.z; const wx=(px-R.cv.width/R.dpr/2)/z+R.cam.x, wy=(py-R.cv.height/R.dpr/2)/z+R.cam.y;
  const fx=(wx/(TW/2)+wy/(TH/2))/2, fy=(wy/(TH/2)-wx/(TW/2))/2; return [Math.floor(fx+0.5),Math.floor(fy+0.5)]; }
function centerOn(x,y,instant){ const tx=isoX(x,y), ty=isoY(x,y); if(instant){ R.cam.x=tx; R.cam.y=ty; } else { R.camTarget={x:tx,y:ty}; } R.dirty=true; }
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
function shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255; r=clamp(Math.round(r*f),0,255); g=clamp(Math.round(g*f),0,255); b=clamp(Math.round(b*f),0,255); return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
// pre-rendered floor tile with stone texture
function floorTile(theme,variant,kind){
  const key=theme+'|'+variant+'|'+kind; if(R.tileCache[key]) return R.tileCache[key];
  const th=THEMES[theme]; const c=document.createElement('canvas'); c.width=TW; c.height=TH; const g=c.getContext('2d');
  g.beginPath(); g.moveTo(TW/2,0); g.lineTo(TW,TH/2); g.lineTo(TW/2,TH); g.lineTo(0,TH/2); g.closePath(); g.save(); g.clip();
  const base=th.floor[variant%th.floor.length]; g.fillStyle=base; g.fillRect(0,0,TW,TH);
  // flagstone pattern
  let seed=variant*9301+theme.length*49297; const rr=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  for(let i=0;i<14;i++){ g.fillStyle=hexA(rr()<0.5?'#000000':'#ffffff',0.03+rr()*0.05); const x=rr()*TW,y=rr()*TH; g.beginPath(); g.ellipse(x,y,4+rr()*10,2+rr()*5,0,0,7); g.fill(); }
  g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=1;
  if(kind==='stone'){ g.beginPath(); g.moveTo(TW/4,TH/4); g.lineTo(TW*3/4,TH*3/4); g.moveTo(TW*3/4,TH/4); g.lineTo(TW/4,TH*3/4); g.stroke(); }
  if(kind==='water'){ g.fillStyle='rgba(20,40,50,0.75)'; g.fillRect(0,0,TW,TH); g.strokeStyle='rgba(140,170,180,0.25)'; for(let i=0;i<3;i++){ g.beginPath(); g.ellipse(TW/2+(rr()-0.5)*20,TH/2+(rr()-0.5)*8,8+rr()*6,2,0,0,7); g.stroke(); } }
  if(kind==='rubble'){ for(let i=0;i<7;i++){ g.fillStyle=shade(th.wall,0.8+rr()*0.6); g.beginPath(); g.ellipse(rr()*TW,rr()*TH,2+rr()*4,1.5+rr()*2,0,0,7); g.fill(); } }
  if(variant%5===0&&kind==='stone'){ g.strokeStyle='rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(TW*0.3,TH*0.5); g.lineTo(TW*0.45,TH*0.4); g.lineTo(TW*0.55,TH*0.6); g.stroke(); }
  g.restore(); g.strokeStyle='rgba(0,0,0,0.45)'; g.beginPath(); g.moveTo(TW/2,0); g.lineTo(TW,TH/2); g.lineTo(TW/2,TH); g.lineTo(0,TH/2); g.closePath(); g.stroke();
  R.tileCache[key]=c; return c;
}
function diamond(g,x,y,fill,stroke,lw){ g.beginPath(); g.moveTo(x,y-TH/2); g.lineTo(x+TW/2,y); g.lineTo(x,y+TH/2); g.lineTo(x-TW/2,y); g.closePath(); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=lw||1; g.stroke(); } }
function drawWall(g,x,y,th,dim){
  const h=WALLH, top=shade(th.wallTop,dim), l=shade(th.wall,dim*0.85), r=shade(th.wall,dim*0.65);
  g.beginPath(); g.moveTo(x-TW/2,y); g.lineTo(x,y+TH/2); g.lineTo(x,y+TH/2-h); g.lineTo(x-TW/2,y-h); g.closePath(); g.fillStyle=l; g.fill();
  g.beginPath(); g.moveTo(x+TW/2,y); g.lineTo(x,y+TH/2); g.lineTo(x,y+TH/2-h); g.lineTo(x+TW/2,y-h); g.closePath(); g.fillStyle=r; g.fill();
  g.beginPath(); g.moveTo(x,y-TH/2-h); g.lineTo(x+TW/2,y-h); g.lineTo(x,y+TH/2-h); g.lineTo(x-TW/2,y-h); g.closePath(); g.fillStyle=top; g.fill();
  g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=1; g.stroke();
  // brick lines
  g.strokeStyle='rgba(0,0,0,0.25)'; g.beginPath(); for(let i=1;i<3;i++){ const yy=y-h+i*h/3; g.moveTo(x-TW/2,yy); g.lineTo(x,yy+TH/2); g.lineTo(x+TW/2,yy); } g.stroke();
}
function drawDoor(g,x,y,map,tx,ty,kind,dim){
  const horiz=walkable(tileAt(map,tx-1,ty))||walkable(tileAt(map,tx+1,ty)); // passage runs along x
  g.save(); g.translate(x,y);
  const col=kind===T.LOCKED?'#4a2c18':'#6b4423'; const h=WALLH+6;
  if(kind===T.DOOROPEN){ g.globalAlpha=0.9; }
  g.fillStyle=shade(col,dim); g.strokeStyle='#1a0f08'; g.lineWidth=1.5;
  g.beginPath();
  if(!horiz){ g.moveTo(-TW/4,-TH/4); g.lineTo(TW/4,TH/4); g.lineTo(TW/4,TH/4-h); g.lineTo(-TW/4,-TH/4-h); }
  else { g.moveTo(TW/4,-TH/4); g.lineTo(-TW/4,TH/4); g.lineTo(-TW/4,TH/4-h); g.lineTo(TW/4,-TH/4-h); }
  g.closePath();
  if(kind!==T.DOOROPEN){ g.fill(); g.stroke(); g.strokeStyle=shade('#8a8a8a',dim); g.beginPath(); g.moveTo(-TW/4,-h*0.5-(horiz?-TH/4:TH/4)*0); g.stroke();
    // iron bands
    g.fillStyle=shade('#2a2a2a',dim); g.fillRect(-3,-h+4,6,3); g.fillRect(-3,-h/2,6,3);
    if(kind===T.LOCKED){ g.fillStyle='#c9a227'; g.beginPath(); g.arc(0,-h/2+8,4,0,7); g.fill(); g.fillStyle='#000'; g.fillRect(-1,-h/2+7,2,4); }
  } else { g.strokeStyle=shade(col,dim); g.lineWidth=3; g.stroke(); }
  g.restore();
}
function drawStairs(g,x,y,up,dim){
  for(let i=0;i<4;i++){ diamond(g,x,y+i*2-(up?0:-2),null,null); }
  g.save(); g.translate(x,y);
  for(let i=0;i<4;i++){ const s=1-i*0.2; g.fillStyle=shade(up?'#7a6a50':'#2a2520',dim*(up?1-i*0.15:0.6+i*0.1)); g.beginPath(); g.moveTo(0,-TH/2*s); g.lineTo(TW/2*s,0); g.lineTo(0,TH/2*s); g.lineTo(-TW/2*s,0); g.closePath(); g.fill(); g.strokeStyle='rgba(0,0,0,0.5)'; g.stroke(); }
  if(up){ const t=(performance.now()-R.t0)/600; g.fillStyle='rgba(255,210,120,'+(0.25+0.15*Math.sin(t))+')'; g.beginPath(); g.ellipse(0,0,TW/3,TH/3,0,0,7); g.fill(); }
  else { g.fillStyle='rgba(0,0,0,0.6)'; g.beginPath(); g.ellipse(0,0,TW/6,TH/6,0,0,7); g.fill(); }
  g.restore();
}
// ===== procedural hero portrait =====
function heroPortrait(h,size){
  const a=h.app||{}; const key=h.id+'|'+JSON.stringify(a)+'|'+h.race+'|'+h.cls+'|'+size+'|'+(h.dragon||'');
  if(R.portraitCache[key]) return R.portraitCache[key];
  const c=document.createElement('canvas'); c.width=size; c.height=size; const g=c.getContext('2d'); const s=size/100;
  g.scale(s,s);
  const skin=h.race==='dragonborn'?({red:'#8a2a1a',blue:'#2a4a8a',green:'#2a6a3a',black:'#2a2a2a',white:'#c8d0d8',gold:'#b8902a',silver:'#9aa0a8',brass:'#a07a3a',bronze:'#8a6a2a',copper:'#9a5a3a'}[h.dragon]||'#8a2a1a'):h.race==='tiefling'?(['#9b4b4b','#7a3a5a','#a0674a','#c7b3d6'][a.skin%4]):APPEAR.skin[a.skin||0];
  const hair=APPEAR.hair[a.hair||0], eyes=APPEAR.eyes[a.eyes||0], cloak=APPEAR.cloak[a.cloak||0], ring=APPEAR.ring[a.ring||0];
  // background
  const bg=g.createRadialGradient(50,40,5,50,50,70); bg.addColorStop(0,shade(cloak,2.2)); bg.addColorStop(1,'#0b0806'); g.fillStyle=bg; g.fillRect(0,0,100,100);
  // emblem faint
  g.globalAlpha=0.18; g.fillStyle='#e8d9b0'; g.font='bold 60px serif'; g.textAlign='center'; g.fillText({Skull:'☠',Sun:'☀',Moon:'☾',Sword:'⚔',Rose:'✿',Raven:'⚚',Flame:'♨',Eye:'◉'}[APPEAR.emblem[a.emblem||0]]||'✦',50,62); g.globalAlpha=1;
  // shoulders / cloak
  g.fillStyle=cloak; g.beginPath(); g.moveTo(8,100); g.quadraticCurveTo(14,68,50,64); g.quadraticCurveTo(86,68,92,100); g.fill();
  g.fillStyle=shade(cloak,1.4); g.beginPath(); g.moveTo(40,66); g.lineTo(50,82); g.lineTo(60,66); g.fill();
  // class hint at shoulder
  const armor={fighter:'#8a8a90',paladin:'#c0c0c8',cleric:'#9a9aa0',barbarian:'#6b4a2a',ranger:'#3b4a2a',rogue:'#2a2a2a',necromancer:'#cfc6ad'}[h.cls];
  if(armor){ g.fillStyle=armor; g.beginPath(); g.ellipse(22,84,14,9,-0.3,0,7); g.ellipse(78,84,14,9,0.3,0,7); g.fill(); }
  if(h.cls==='necromancer'){ g.fillStyle='#1a1410'; g.font='bold 11px serif'; g.textAlign='center'; g.fillText('☠',22,88); g.fillText('☠',78,88); g.fillStyle='rgba(120,220,140,0.35)'; g.beginPath(); g.arc(50,90,6,0,7); g.fill(); }
  // neck & head
  g.fillStyle=shade(skin,0.85); g.fillRect(43,56,14,12);
  // ears
  const elfEar=['highelf','halfelf'].includes(h.race), gnome=h.race==='gnome';
  g.fillStyle=skin;
  if(elfEar){ g.beginPath(); g.moveTo(30,42); g.lineTo(16,28); g.lineTo(32,50); g.fill(); g.beginPath(); g.moveTo(70,42); g.lineTo(84,28); g.lineTo(68,50); g.fill(); }
  else { g.beginPath(); g.ellipse(30,44,4,6,0,0,7); g.ellipse(70,44,4,6,0,0,7); g.fill(); }
  // face
  const fw=h.race==='halforc'||h.race==='hilldwarf'?22:gnome||h.race==='halfling'?19:20;
  g.beginPath(); if(h.race==='dragonborn'){ g.ellipse(50,42,fw,22,0,0,7); } else g.ellipse(50,42,fw,24,0,0,7); g.fill();
  if(h.race==='dragonborn'){ g.fillStyle=shade(skin,0.8); g.beginPath(); g.ellipse(50,52,12,9,0,0,7); g.fill(); g.strokeStyle=shade(skin,0.6); for(let i=0;i<4;i++){ g.beginPath(); g.arc(50,30+i*4,10,3.6,5.8); g.stroke(); } g.fillStyle=shade(skin,1.3); g.beginPath(); g.moveTo(34,24); g.lineTo(26,8); g.lineTo(40,22); g.moveTo(66,24); g.lineTo(74,8); g.lineTo(60,22); g.fill(); }
  // shading
  const fg=g.createLinearGradient(30,20,70,60); fg.addColorStop(0,'rgba(255,220,170,0.15)'); fg.addColorStop(1,'rgba(0,0,0,0.3)'); g.fillStyle=fg; g.beginPath(); g.ellipse(50,42,fw,24,0,0,7); g.fill();
  // hair (back/top)
  const hs=APPEAR.hairStyle[a.hairStyle||0];
  g.fillStyle=hair;
  if(h.race!=='dragonborn'){
    if(hs==='Long'||hs==='Braided'||hs==='Tied Back'){ g.beginPath(); g.moveTo(28,40); g.quadraticCurveTo(26,74,36,72); g.lineTo(36,40); g.fill(); g.beginPath(); g.moveTo(72,40); g.quadraticCurveTo(74,74,64,72); g.lineTo(64,40); g.fill(); }
    if(hs!=='Bald'){ g.beginPath(); g.ellipse(50,28,fw+2,hs==='Wild'?16:12,0,Math.PI,0); g.fill(); if(hs==='Wild'){ for(let i=0;i<7;i++){ g.beginPath(); g.moveTo(30+i*6.5,20); g.lineTo(28+i*7,8+(i%2)*4); g.lineTo(36+i*6.5,20); g.fill(); } } if(hs==='Mohawk'){ g.fillRect(46,6,8,18); } if(hs==='Topknot'){ g.beginPath(); g.arc(50,12,6,0,7); g.fill(); } if(hs==='Braided'){ g.fillRect(63,50,4,20); } }
  }
  // horns
  if(h.race==='tiefling'){ g.fillStyle='#2a1a1a'; g.beginPath(); g.moveTo(36,24); g.quadraticCurveTo(24,6,34,2); g.quadraticCurveTo(30,14,42,22); g.fill(); g.beginPath(); g.moveTo(64,24); g.quadraticCurveTo(76,6,66,2); g.quadraticCurveTo(70,14,58,22); g.fill(); }
  // eyes
  g.fillStyle='#f2ead8'; g.beginPath(); g.ellipse(42,42,4.5,2.6,0,0,7); g.ellipse(58,42,4.5,2.6,0,0,7); g.fill();
  g.fillStyle=h.race==='tiefling'?'#c9a227':eyes; g.beginPath(); g.arc(42,42,2.2,0,7); g.arc(58,42,2.2,0,7); g.fill();
  g.strokeStyle=shade(hair,0.8); g.lineWidth=1.8; g.beginPath(); g.moveTo(36,37); g.lineTo(47,36); g.moveTo(53,36); g.lineTo(64,37); g.stroke();
  // nose & mouth
  g.strokeStyle=shade(skin,0.6); g.lineWidth=1.2; g.beginPath(); g.moveTo(50,44); g.lineTo(48,51); g.lineTo(51,52); g.stroke();
  g.beginPath(); g.moveTo(44,57); g.quadraticCurveTo(50,59,56,57); g.stroke();
  if(h.race==='halforc'){ g.fillStyle='#efe6d0'; g.beginPath(); g.moveTo(43,58); g.lineTo(44,52); g.lineTo(46,58); g.moveTo(54,58); g.lineTo(56,52); g.lineTo(57,58); g.fill(); }
  // beard
  const bd=APPEAR.beard[a.beard||0]; g.fillStyle=hair;
  if(bd==='Stubble'){ g.globalAlpha=0.35; g.beginPath(); g.ellipse(50,56,15,9,0,0,Math.PI); g.fill(); g.globalAlpha=1; }
  if(bd==='Short Beard'){ g.beginPath(); g.moveTo(32,48); g.quadraticCurveTo(50,74,68,48); g.quadraticCurveTo(50,60,32,48); g.fill(); }
  if(bd==='Long Beard'||bd==='Forked'){ g.beginPath(); g.moveTo(31,46); g.quadraticCurveTo(38,86,50,88); g.quadraticCurveTo(62,86,69,46); g.quadraticCurveTo(50,62,31,46); g.fill(); if(bd==='Forked'){ g.fillStyle=cloak; g.beginPath(); g.moveTo(47,88); g.lineTo(50,74); g.lineTo(53,88); g.fill(); } }
  if(bd==='Moustache'||bd==='Long Beard'||bd==='Short Beard'||bd==='Forked'){ g.fillStyle=hair; g.beginPath(); g.ellipse(45,54,6,2.2,0.2,0,7); g.ellipse(55,54,6,2.2,-0.2,0,7); g.fill(); }
  // marks
  const mk=APPEAR.marks[a.marks||0]; g.lineWidth=1.5;
  if(mk==='Left Scar'){ g.strokeStyle='#7a3a3a'; g.beginPath(); g.moveTo(37,32); g.lineTo(44,52); g.stroke(); }
  if(mk==='Right Scar'){ g.strokeStyle='#7a3a3a'; g.beginPath(); g.moveTo(63,32); g.lineTo(56,52); g.stroke(); }
  if(mk==='War Paint'){ g.fillStyle='rgba(150,20,20,0.6)'; g.fillRect(34,40,32,4); }
  if(mk==='Tattoo'){ g.strokeStyle='rgba(30,60,90,0.8)'; g.beginPath(); g.arc(60,50,4,0,5); g.stroke(); g.beginPath(); g.moveTo(40,30); g.lineTo(44,34); g.lineTo(40,38); g.stroke(); }
  if(mk==='Eyepatch'){ g.fillStyle='#111'; g.beginPath(); g.ellipse(58,42,6,5,0,0,7); g.fill(); g.strokeStyle='#111'; g.beginPath(); g.moveTo(30,34); g.lineTo(70,46); g.stroke(); }
  if(mk==='Freckles'){ g.fillStyle='rgba(120,60,30,0.6)'; for(let i=0;i<8;i++){ g.beginPath(); g.arc(40+((i*7)%20),47+(i%3),0.9,0,7); g.fill(); } }
  if(mk==='Burn'){ g.fillStyle='rgba(120,40,30,0.45)'; g.beginPath(); g.ellipse(40,48,9,7,0.4,0,7); g.fill(); }
  // headwear
  const hw=APPEAR.headwear[a.headwear||0];
  if(hw==='Hood'){ g.fillStyle=cloak; g.beginPath(); g.moveTo(22,70); g.quadraticCurveTo(16,6,50,6); g.quadraticCurveTo(84,6,78,70); g.lineTo(70,66); g.quadraticCurveTo(74,22,50,20); g.quadraticCurveTo(26,22,30,66); g.fill(); }
  if(hw==='Iron Helm'||hw==='Horned Helm'){ g.fillStyle='#7a7a82'; g.beginPath(); g.ellipse(50,30,fw+3,16,0,Math.PI,0); g.fill(); g.fillRect(48,28,4,20); g.fillStyle='#55555c'; g.fillRect(27,28,46,5); if(hw==='Horned Helm'){ g.fillStyle='#e8dcc0'; g.beginPath(); g.moveTo(28,28); g.quadraticCurveTo(10,20,14,4); g.quadraticCurveTo(20,18,34,24); g.fill(); g.beginPath(); g.moveTo(72,28); g.quadraticCurveTo(90,20,86,4); g.quadraticCurveTo(80,18,66,24); g.fill(); } }
  if(hw==='Circlet'){ g.strokeStyle=ring; g.lineWidth=2.5; g.beginPath(); g.ellipse(50,28,fw,5,0,0,Math.PI); g.stroke(); g.fillStyle='#7fd'; g.beginPath(); g.arc(50,33,2,0,7); g.fill(); }
  if(hw==='Wide Hat'){ g.fillStyle='#2a2018'; g.beginPath(); g.ellipse(50,24,36,7,0,0,7); g.fill(); g.beginPath(); g.moveTo(34,24); g.lineTo(38,4); g.lineTo(62,4); g.lineTo(66,24); g.fill(); g.fillStyle=ring; g.fillRect(36,18,28,3); }
  if(hw==='Bandana'){ g.fillStyle=shade(cloak,1.8); g.beginPath(); g.ellipse(50,26,fw+1,8,0,Math.PI,0); g.fill(); g.fillRect(70,22,10,4); }
  if(hw==='Crown of Thorns'){ g.strokeStyle='#3a2a1a'; g.lineWidth=2; for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(30+i*5.7,26); g.lineTo(32+i*5.7,18); g.stroke(); } g.beginPath(); g.ellipse(50,26,fw,3,0,0,7); g.stroke(); }
  // frame
  g.strokeStyle=ring; g.lineWidth=4; g.strokeRect(2,2,96,96);
  const vg=g.createRadialGradient(50,50,30,50,50,75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)'); g.fillStyle=vg; g.fillRect(0,0,100,100);
  R.portraitCache[key]=c; return c;
}
function monsterPortrait(m,size){
  const key='m|'+m.id+'|'+size; if(R.portraitCache[key]) return R.portraitCache[key];
  const im=R.imgs[m.art]||R.imgs.humanoid; if(!im.complete||!im.naturalWidth) return null;
  const c=document.createElement('canvas'); c.width=size; c.height=size; const g=c.getContext('2d');
  g.drawImage(im,0,0,size,size); if(m.tint){ g.globalCompositeOperation='color'; g.fillStyle=hexA(m.tint,0.55); g.fillRect(0,0,size,size); g.globalCompositeOperation='source-over'; }
  if(m.boss){ g.strokeStyle='#c9a227'; g.lineWidth=size/14; g.strokeRect(0,0,size,size); }
  R.portraitCache[key]=c; return c;
}
function tokenImg(c){ return c.isHero?heroPortrait(c,96):monsterPortrait(MONSTERS[c.mid],96); }
function drawToken(g,c,x,y,opts){
  opts=opts||{}; const m=c.isHero?null:MONSTERS[c.mid]; const big=m&&(m.size==='L'||m.size==='H'); const r=(big?22:16)*(m&&m.size==='H'?1.25:1);
  const lift=opts.lift||0; const yy=y-r-6-lift;
  // base
  g.fillStyle='rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(x,y+2,r*1.1,r*0.5,0,0,7); g.fill();
  const ring=c.isHero?'#c9a227':c.ally?'#3fae5a':(m.boss?'#e0b040':'#8b1a1a'); g.fillStyle=shade(ring,0.6); g.beginPath(); g.ellipse(x,y,r*1.0,r*0.46,0,0,7); g.fill(); g.strokeStyle=ring; g.lineWidth=2; g.stroke();
  // stem
  g.fillStyle='#1a120c'; g.fillRect(x-2,yy+r-2,4,y-(yy+r)+2);
  // portrait disc
  g.save(); g.beginPath(); g.arc(x,yy,r,0,7); g.closePath(); g.fillStyle='#000'; g.fill(); g.clip();
  const img=tokenImg(c); if(img) g.drawImage(img,x-r,yy-r,r*2,r*2);
  if(c.hp<=0||c.status==='fallen'){ g.fillStyle='rgba(60,0,0,0.6)'; g.fillRect(x-r,yy-r,r*2,r*2); }
  g.restore();
  g.lineWidth=opts.active?3.5:2.2; g.strokeStyle=opts.active?'#ffd37a':ring; g.beginPath(); g.arc(x,yy,r,0,7); g.stroke();
  if(opts.active){ const t=(performance.now()-R.t0)/300; g.strokeStyle='rgba(255,211,122,'+(0.4+0.3*Math.sin(t))+')'; g.lineWidth=2; g.beginPath(); g.arc(x,yy,r+4,0,7); g.stroke(); R.anim=true; }
  if(opts.target){ g.strokeStyle='#ff4a3a'; g.lineWidth=3; g.setLineDash([4,3]); g.beginPath(); g.arc(x,yy,r+5,0,7); g.stroke(); g.setLineDash([]); }
  // hp bar
  const max=c.isHero?heroMaxHP(c):c.hpMax; const pct=clamp(c.hp/max,0,1); const bw=r*2;
  g.fillStyle='rgba(0,0,0,0.75)'; g.fillRect(x-bw/2,yy+r+2,bw,5); g.fillStyle=pct>0.5?'#5a9a3a':pct>0.25?'#c9a227':'#b02a1a'; g.fillRect(x-bw/2+1,yy+r+3,(bw-2)*pct,3);
  if(c.tempHp>0){ g.fillStyle='#6aa0d0'; g.fillRect(x-bw/2+1,yy+r+3,Math.min(bw-2,(bw-2)*c.tempHp/max),1.5); }
  // condition pips
  const conds=(c.fx||[]).filter(e=>CONDITIONS[e.id]).slice(0,4);
  conds.forEach((e,i)=>{ g.fillStyle={poisoned:'#5a9a3a',prone:'#8a6a3a',frightened:'#7d3cb5',paralyzed:'#3a7ad0',stunned:'#e0c040',restrained:'#a05a20',blessed:'#ffe08a',baned:'#5a2a5a',raging:'#c02a1a',hasted:'#5ad0e0',charmed:'#e06ab0',blinded:'#333',invisible:'#aaf',marked:'#ff4a3a',outlined:'#d0a0ff',dodging:'#9ab',hidden:'#556',asleep:'#88a',slowed:'#558',incapacitated:'#a33',sanctuary:'#fff',unconscious:'#600',grappled:'#a85'}[e.id]||'#aaa'; g.beginPath(); g.arc(x-r+4+i*7,yy-r+2,3,0,7); g.fill(); g.strokeStyle='#000'; g.lineWidth=1; g.stroke(); });
  if(c.isHero&&c.hp<=0&&c.status!=='fallen'){ g.fillStyle='#fff'; g.font='bold 10px sans-serif'; g.textAlign='center'; g.fillText('✚'+(c.deathS?c.deathS.s:0)+' ✖'+(c.deathS?c.deathS.f:0),x,yy-r-4); }
}
function drawObject(g,e,x,y,dim,th){
  g.save(); g.translate(x,y); const k=e.kind;
  const wood=shade('#6b4423',dim), dark=shade('#2a1a10',dim), stone=shade(th.accent||'#777',dim), iron=shade('#555',dim);
  const box=(w,d,h,top,left,right)=>{ g.fillStyle=left; g.beginPath(); g.moveTo(-w,0); g.lineTo(0,d); g.lineTo(0,d-h); g.lineTo(-w,-h); g.fill(); g.fillStyle=right; g.beginPath(); g.moveTo(w,0); g.lineTo(0,d); g.lineTo(0,d-h); g.lineTo(w,-h); g.fill(); g.fillStyle=top; g.beginPath(); g.moveTo(0,-d-h); g.lineTo(w,-h); g.lineTo(0,d-h); g.lineTo(-w,-h); g.fill(); g.strokeStyle='rgba(0,0,0,0.5)'; g.stroke(); };
  if(e.type==='chest'){ if(e.opened){ box(14,7,8,dark,shade(wood,0.8),shade(wood,0.6)); } else { box(14,7,12,shade(wood,1.2),wood,shade(wood,0.7)); g.fillStyle=shade('#c9a227',dim); g.fillRect(-2,-8,4,5); if(e.rich){ g.strokeStyle=shade('#c9a227',dim); g.lineWidth=1.5; g.strokeRect(-12,-14,24,2); } } }
  else if(k==='barrel'||k==='urn'){ if(e.broken){ g.fillStyle=wood; g.fillRect(-8,-3,6,3); g.fillRect(2,-2,7,2); } else { const col=k==='urn'?stone:wood; g.fillStyle=shade(col,0.8); g.beginPath(); g.ellipse(0,0,9,4.5,0,0,Math.PI); g.lineTo(-9,-18); g.ellipse(0,-18,9,4.5,0,Math.PI,0,true); g.fill(); g.fillStyle=col; g.beginPath(); g.ellipse(0,-18,9,4.5,0,0,7); g.fill(); g.strokeStyle=iron; g.beginPath(); g.ellipse(0,-6,9.5,4.5,0,0,Math.PI); g.stroke(); } }
  else if(k==='crate'){ if(e.broken){ g.fillStyle=wood; g.fillRect(-9,-3,18,3);} else box(11,5.5,14,shade(wood,1.1),wood,shade(wood,0.7)); }
  else if(k==='bones'||k==='corpse'){ g.fillStyle=shade('#d8ccb0',dim); for(let i=0;i<5;i++){ g.save(); g.rotate(i*1.2); g.fillRect(-7,-1,14,2.4); g.restore(); } g.beginPath(); g.arc(5,-3,3.5,0,7); g.fill(); if(k==='corpse'){ g.fillStyle=shade('#3b2a1e',dim); g.beginPath(); g.ellipse(-3,0,10,4,0.3,0,7); g.fill(); g.fillStyle=shade('#8a8a8a',dim); g.fillRect(4,-2,12,2); } }
  else if(k==='shelf'){ box(14,7,30,shade(wood,1.1),wood,shade(wood,0.65)); g.fillStyle=shade('#7a2a2a',dim); for(let i=0;i<3;i++){ g.fillRect(-12+i*1,-26+i*9,9,5); } g.fillStyle=shade('#2a4a6a',dim); g.fillRect(-5,-17,5,6); }
  else if(k==='coffin'||k==='sarcophagus'){ const col=k==='coffin'?wood:stone; box(15,6,9,shade(col,1.15),col,shade(col,0.7)); g.strokeStyle=shade('#c9a227',dim*0.8); g.beginPath(); g.moveTo(-6,-12); g.lineTo(6,-12); g.moveTo(0,-15); g.lineTo(0,-9); g.stroke(); }
  else if(k==='statue'){ g.fillStyle=shade(stone,0.8); g.fillRect(-9,-8,18,8); g.fillStyle=stone; g.beginPath(); g.moveTo(-6,-8); g.lineTo(-5,-34); g.lineTo(5,-34); g.lineTo(6,-8); g.fill(); g.beginPath(); g.arc(0,-38,5,0,7); g.fill(); g.fillStyle=shade(stone,0.7); g.fillRect(-9,-30,4,12); }
  else if(k==='brazier'||k==='candles'){ if(k==='brazier'){ g.fillStyle=iron; g.fillRect(-1.5,-16,3,16); g.beginPath(); g.ellipse(0,-16,9,4,0,0,Math.PI); g.fill(); }
    if(!e.out){ const t=(performance.now()-R.t0)/120; const fy=k==='brazier'?-18:-6; for(let i=0;i<(k==='candles'?3:1);i++){ const ox=k==='candles'?(i-1)*6:0; if(k==='candles'){ g.fillStyle=shade('#e8dcc0',dim); g.fillRect(ox-1.5,-6,3,6); } g.fillStyle='rgba(255,160,40,0.9)'; g.beginPath(); g.ellipse(ox,fy-4+Math.sin(t+i)*1,k==='candles'?2:5,k==='candles'?4:9+Math.sin(t*1.3)*2,0,0,7); g.fill(); g.fillStyle='rgba(255,240,170,0.9)'; g.beginPath(); g.ellipse(ox,fy-2,k==='candles'?1:2.5,k==='candles'?2:4,0,0,7); g.fill(); } R.anim=true; } }
  else if(k==='rocks'){ g.fillStyle=stone; g.beginPath(); g.ellipse(-4,-4,9,7,0,0,7); g.fill(); g.fillStyle=shade(stone,0.8); g.beginPath(); g.ellipse(6,-2,6,4,0,0,7); g.fill(); }
  else if(k==='mushrooms'){ for(let i=0;i<4;i++){ const ox=(i-1.5)*5, h=6+i%2*4; g.fillStyle=shade('#d8d0b0',dim); g.fillRect(ox-1,-h,2,h); g.fillStyle=shade(e.used?'#555':'#9ab0a0',dim); g.beginPath(); g.ellipse(ox,-h,4,2.5,0,Math.PI,0); g.fill(); } if(!e.used){ g.fillStyle='rgba(150,255,200,0.12)'; g.beginPath(); g.arc(0,-6,12,0,7); g.fill(); } }
  else if(k==='web'){ g.strokeStyle='rgba(220,220,220,0.5)'; g.lineWidth=0.8; for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(0,-8); g.lineTo(Math.cos(i*0.8)*18,-8+Math.sin(i*0.8)*9); g.stroke(); } g.beginPath(); g.ellipse(0,-8,8,4,0,0,7); g.ellipse(0,-8,14,7,0,0,7); g.stroke(); }
  else if(k==='puddle'){ g.fillStyle='rgba(10,20,25,0.8)'; g.beginPath(); g.ellipse(0,0,18,8,0,0,7); g.fill(); g.strokeStyle='rgba(120,150,160,0.3)'; g.stroke(); }
  else if(k==='reeds'){ g.strokeStyle=shade('#5a6a3a',dim); g.lineWidth=1.5; for(let i=0;i<6;i++){ g.beginPath(); g.moveTo((i-3)*3,0); g.lineTo((i-3)*4+2,-14-i%3*3); g.stroke(); } }
  else if(k==='pillar'){ g.fillStyle=shade(stone,0.75); g.fillRect(-8,-44,16,44); g.fillStyle=stone; g.fillRect(-8,-44,8,44); g.fillStyle=shade(stone,1.2); g.beginPath(); g.ellipse(0,-44,10,5,0,0,7); g.fill(); }
  else if(k==='anvil'){ g.fillStyle=iron; g.fillRect(-4,-10,8,10); g.fillStyle=shade('#777',dim); g.beginPath(); g.moveTo(-12,-14); g.lineTo(14,-14); g.lineTo(8,-10); g.lineTo(-8,-10); g.fill(); }
  else if(k==='pew'){ box(16,5,7,shade(wood,1.1),wood,shade(wood,0.7)); g.fillStyle=shade(wood,0.8); g.fillRect(-16,-18,3,12); }
  else if(k==='altar'){ box(14,7,12,shade('#c8c0b0',dim),shade('#8a8478',dim),shade('#6a6458',dim)); g.fillStyle=e.used?'#333':'rgba(200,40,40,0.8)'; g.fillRect(-6,-22,12,2); if(!e.used){ g.fillStyle='rgba(255,200,120,0.25)'; g.beginPath(); g.arc(0,-20,14,0,7); g.fill(); } }
  else if(k==='fountain'){ g.fillStyle=stone; g.beginPath(); g.ellipse(0,0,16,8,0,0,7); g.fill(); g.fillStyle=e.used?'#222':'rgba(60,120,160,0.85)'; g.beginPath(); g.ellipse(0,-2,12,5.5,0,0,7); g.fill(); g.fillStyle=stone; g.fillRect(-2,-18,4,16); }
  else if(k==='lever'){ g.fillStyle=iron; g.fillRect(-6,-6,12,6); g.strokeStyle=iron; g.lineWidth=2; g.beginPath(); g.moveTo(0,-4); g.lineTo(e.used?8:-8,-16); g.stroke(); }
  else { g.fillStyle=stone; g.beginPath(); g.arc(0,-6,6,0,7); g.fill(); }
  // interactable sparkle
  if(e.type==='obj'&&!e.used&&OBJ_INFO[k]&&OBJ_INFO[k].act&&!e.broken&&dim>0.6){ const t=(performance.now()-R.t0)/500; g.fillStyle='rgba(255,220,140,'+(0.35+0.25*Math.sin(t+e.x))+')'; g.beginPath(); g.arc(10,-26,2,0,7); g.fill(); R.anim=true; }
  g.restore();
}
function drawTrapMark(g,e,x,y){ g.save(); g.translate(x,y); g.strokeStyle=e.disarmed?'rgba(140,140,140,0.7)':'rgba(255,60,40,0.9)'; g.lineWidth=2; diamond(g,0,0,e.disarmed?'rgba(60,60,60,0.3)':'rgba(160,20,10,0.35)',g.strokeStyle,1.5); g.fillStyle=g.strokeStyle; g.font='bold 14px serif'; g.textAlign='center'; g.fillText(e.disarmed?'✓':'⚠',0,5); g.restore(); }
function drawObstacle(g,e,x,y,dim){ g.save(); g.translate(x,y); const k=e.ob;
  if(k==='chasm'||k==='ledge'){ diamond(g,0,0,'#050302','rgba(0,0,0,0.9)'); g.strokeStyle=shade('#5a4a3a',dim); g.beginPath(); g.moveTo(-TW/2,0); g.lineTo(-8,4); g.lineTo(0,-3); g.lineTo(TW/2,0); g.stroke(); }
  else if(k==='rubble'){ for(let i=0;i<9;i++){ g.fillStyle=shade('#6a6458',dim*(0.7+(i%3)*0.15)); g.beginPath(); g.ellipse(((i*7)%26)-13,-((i*5)%16),5+(i%3)*2,4,0,0,7); g.fill(); } }
  else if(k==='flood'){ diamond(g,0,0,'rgba(20,50,70,0.9)','rgba(80,140,170,0.5)'); }
  else if(k==='ward'){ const t=(performance.now()-R.t0)/400; g.fillStyle='rgba(120,160,255,'+(0.25+0.1*Math.sin(t))+')'; g.fillRect(-TW/3,-40,TW*2/3,40); g.strokeStyle='rgba(180,200,255,0.8)'; g.strokeRect(-TW/3,-40,TW*2/3,40); R.anim=true; }
  else if(k==='thorns'){ g.strokeStyle=shade('#3a4a2a',dim); g.lineWidth=2; for(let i=0;i<10;i++){ g.beginPath(); g.moveTo((i-5)*5,0); g.quadraticCurveTo((i-5)*3,-20,(i%2?1:-1)*12,-28+(i%3)*4); g.stroke(); } }
  g.fillStyle='#ffd37a'; g.font='bold 12px serif'; g.textAlign='center'; g.fillText('!',0,-44);
  g.restore(); }
// ===== main frame =====
function frame(){
  requestAnimationFrame(frame);
  if(R.camTarget){ R.cam.x+=(R.camTarget.x-R.cam.x)*0.18; R.cam.y+=(R.camTarget.y-R.cam.y)*0.18; if(Math.abs(R.camTarget.x-R.cam.x)<0.5&&Math.abs(R.camTarget.y-R.cam.y)<0.5){ R.cam.x=R.camTarget.x; R.cam.y=R.camTarget.y; R.camTarget=null; } R.dirty=true; }
  if(R.floaters.length) R.dirty=true;
  if(!R.dirty&&!R.anim) return; R.dirty=false; R.anim=false;
  if(!G.run||!G.run.map||!R.cv||G.screen!=='dungeon') return;
  draw();
}
function draw(){
  const g=R.ctx, map=G.run.map, th=THEMES[map.theme]; const dpr=R.dpr, z=R.cam.z;
  g.setTransform(1,0,0,1,0,0); g.fillStyle='#070504'; g.fillRect(0,0,R.cv.width,R.cv.height);
  g.setTransform(dpr*z,0,0,dpr*z,(R.cv.width/2)-R.cam.x*dpr*z,(R.cv.height/2)-R.cam.y*dpr*z);
  const vis=R.vis||new Set(); const W=map.w;
  // visible bounds
  const [ax,ay]=toTile(0,0),[bx,by]=toTile(R.cv.width/dpr,0),[cx,cy]=toTile(0,R.cv.height/dpr),[dx,dy]=toTile(R.cv.width/dpr,R.cv.height/dpr);
  const minX=clamp(Math.min(ax,bx,cx,dx)-2,0,W-1), maxX=clamp(Math.max(ax,bx,cx,dx)+2,0,W-1), minY=clamp(Math.min(ay,by,cy,dy)-2,0,map.h-1), maxY=clamp(Math.max(ay,by,cy,dy)+3,0,map.h-1);
  // entity index
  const entIdx={}; for(const e of map.ents){ (entIdx[e.y*W+e.x]=entIdx[e.y*W+e.x]||[]).push(e); }
  const heroIdx={}; for(const h of activeParty()){ if(h.x!=null&&h.status!=='fallen') heroIdx[h.y*W+h.x]=h; }
  const cur=G.combat&&G.combat.cur; const hl=R.hl;
  for(let d=minX+minY; d<=maxX+maxY; d++){
    for(let x=Math.max(minX,d-maxY); x<=Math.min(maxX,d-minY); x++){
      const y=d-x; const i=y*W+x; if(!map.explored[i]) continue;
      const t=map.t[i]; const sx=isoX(x,y), sy=isoY(x,y); const isVis=vis.has(i); const dim=isVis?1:0.45;
      if(t===T.WALL||t===T.SECRET){ drawWall(g,sx,sy,th,dim*0.9); continue; }
      const kind=t===T.WATER?'water':t===T.RUBBLE?'rubble':'stone';
      g.drawImage(floorTile(map.theme,(x*7+y*13)%11,kind),sx-TW/2,sy-TH/2);
      if(!isVis){ diamond(g,sx,sy,'rgba(5,3,2,0.55)'); }
      if(t===T.DOWN||t===T.UP) drawStairs(g,sx,sy,t===T.UP,dim);
      // highlights
      if(hl.reach&&hl.reach.has(i)) diamond(g,sx,sy,'rgba(90,150,230,0.22)','rgba(140,190,255,0.5)');
      if(hl.area&&hl.area.has(i)) diamond(g,sx,sy,'rgba(230,110,30,0.35)','rgba(255,160,60,0.7)');
      if(hl.path&&hl.path.has(i)) diamond(g,sx,sy,'rgba(255,220,120,0.3)');
      if(hl.sel===i) diamond(g,sx,sy,null,'#ffd37a',2);
      const es=entIdx[i]||[];
      for(const e of es){
        if(e.type==='trap'&&(e.found||e.triggered)&&!e.hiddenAgain) drawTrapMark(g,e,sx,sy);
      }
      if(t===T.DOOR||t===T.DOOROPEN||t===T.LOCKED) drawDoor(g,sx,sy,map,x,y,t,dim);
      for(const e of es){
        if(e.type==='obj'||e.type==='chest') drawObject(g,e,sx,sy,dim,th);
        else if(e.type==='obstacle'&&!e.cleared) drawObstacle(g,e,sx,sy,dim);
        else if(e.type==='loot'){ g.fillStyle='#6b4423'; g.beginPath(); g.ellipse(sx,sy-4,8,6,0,0,7); g.fill(); g.fillStyle='#c9a227'; g.beginPath(); g.arc(sx,sy-9,2.5,0,7); g.fill(); const t2=(performance.now()-R.t0)/400; g.fillStyle='rgba(255,220,120,'+(0.3+0.2*Math.sin(t2))+')'; g.beginPath(); g.arc(sx,sy-6,11,0,7); g.fill(); R.anim=true; }
        else if(e.type==='questitem'){ const t2=(performance.now()-R.t0)/300; g.fillStyle='rgba(120,220,255,'+(0.4+0.3*Math.sin(t2))+')'; g.beginPath(); g.arc(sx,sy-10,9,0,7); g.fill(); g.fillStyle='#fff'; g.font='bold 12px serif'; g.textAlign='center'; g.fillText('✦',sx,sy-6); R.anim=true; }
        else if(e.type==='prisoner'&&!e.freed&&isVis){ g.fillStyle='#4a3a2a'; g.beginPath(); g.ellipse(sx,sy-10,7,12,0,0,7); g.fill(); g.fillStyle='#c9b090'; g.beginPath(); g.arc(sx,sy-24,5,0,7); g.fill(); g.strokeStyle='#888'; g.lineWidth=1.5; g.beginPath(); g.moveTo(sx-8,sy-12); g.lineTo(sx+8,sy-12); g.stroke(); g.fillStyle='#ffd37a'; g.font='bold 12px serif'; g.textAlign='center'; g.fillText('?',sx,sy-34); }
        else if(e.type==='mon'&&e.hp>0&&isVis&&!e.hidden) drawToken(g,e,sx,sy,{active:cur===e,target:hl.targets&&hl.targets.has(e)});
        else if(e.type==='mon'&&e.hp<=0&&isVis){ g.fillStyle='rgba(80,10,10,0.5)'; g.beginPath(); g.ellipse(sx,sy,12,6,0,0,7); g.fill(); }
      }
      const h=heroIdx[i]; if(h) drawToken(g,h,sx,sy,{active:(cur===h)||(!G.combat&&G.run.leader===h.id),target:hl.targets&&hl.targets.has(h)});
    }
  }
  // lighting overlay
  drawLighting(g,map,vis);
  // floaters
  g.textAlign='center';
  const now=performance.now();
  R.floaters=R.floaters.filter(f=>now-f.t<1400);
  for(const f of R.floaters){ const k=(now-f.t)/1400; const sx=isoX(f.x,f.y), sy=isoY(f.x,f.y)-40-k*30; g.globalAlpha=1-k; g.font='bold '+(f.big?20:15)+'px Georgia,serif'; g.lineWidth=3; g.strokeStyle='#000'; g.strokeText(f.s,sx,sy); g.fillStyle=f.c; g.fillText(f.s,sx,sy); g.globalAlpha=1; }
}
function drawLighting(g,map,vis){
  if(!R.lc){ R.lc=document.createElement('canvas'); }
  const lc=R.lc; if(lc.width!==R.cv.width||lc.height!==R.cv.height){ lc.width=R.cv.width; lc.height=R.cv.height; }
  const l=lc.getContext('2d'); const dpr=R.dpr, z=R.cam.z;
  l.setTransform(1,0,0,1,0,0); l.globalCompositeOperation='source-over'; l.clearRect(0,0,lc.width,lc.height); l.fillStyle='rgba(8,4,2,0.72)'; l.fillRect(0,0,lc.width,lc.height);
  l.setTransform(dpr*z,0,0,dpr*z,(R.cv.width/2)-R.cam.x*dpr*z,(R.cv.height/2)-R.cam.y*dpr*z);
  l.globalCompositeOperation='destination-out';
  const t=(performance.now()-R.t0)/200; const flick=1+Math.sin(t)*0.02+Math.sin(t*2.7)*0.015;
  const lights=[];
  for(const h of activeParty()) if(h.x!=null&&h.status!=='fallen') lights.push([h.x,h.y,lightRadius(h)*TW*0.55*flick,1]);
  for(const e of map.ents) if(e.type==='obj'&&(e.kind==='brazier'||e.kind==='candles')&&!e.out&&map.explored[e.y*map.w+e.x]) lights.push([e.x,e.y,(e.kind==='brazier'?4:2.5)*TW*0.55*flick,0.9]);
  if(G.run.daylight) lights.push([G.run.daylight.x,G.run.daylight.y,8*TW*0.55,1]);
  for(const [x,y,r,a] of lights){ const sx=isoX(x,y), sy=isoY(x,y); const gr=l.createRadialGradient(sx,sy,r*0.1,sx,sy,r); gr.addColorStop(0,'rgba(0,0,0,'+a+')'); gr.addColorStop(0.6,'rgba(0,0,0,'+a*0.7+')'); gr.addColorStop(1,'rgba(0,0,0,0)'); l.fillStyle=gr; l.beginPath(); l.ellipse(sx,sy,r,r*0.6,0,0,7); l.fill(); }
  l.globalCompositeOperation='source-over';
  g.save(); g.setTransform(1,0,0,1,0,0); g.drawImage(lc,0,0);
  // warm candle tint
  g.globalCompositeOperation='soft-light'; g.fillStyle='rgba(255,150,60,0.18)'; g.fillRect(0,0,R.cv.width,R.cv.height); g.globalCompositeOperation='source-over';
  // vignette
  const vg=g.createRadialGradient(R.cv.width/2,R.cv.height/2,Math.min(R.cv.width,R.cv.height)*0.3,R.cv.width/2,R.cv.height/2,Math.max(R.cv.width,R.cv.height)*0.7); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.6)'); g.fillStyle=vg; g.fillRect(0,0,R.cv.width,R.cv.height);
  g.restore(); R.anim=true;
}
function floater(x,y,s,c,big){ R.floaters.push({x,y,s:String(s),c:c||'#fff',t:performance.now(),big}); R.dirty=true; }
// ===== field of view =====
function computeVis(){
  const map=G.run.map, W=map.w, vis=new Set();
  for(const h of activeParty()){ if(h.x==null||h.status==='fallen') continue; const rad=Math.max(lightRadius(h),RACES[h.race].dv?6:0)+2;
    for(let y=h.y-rad;y<=h.y+rad;y++) for(let x=h.x-rad;x<=h.x+rad;x++){ if(x<0||y<0||x>=W||y>=map.h) continue; if((x-h.x)*(x-h.x)+(y-h.y)*(y-h.y)>rad*rad+1) continue; if(los(map,h.x,h.y,x,y)){ vis.add(y*W+x); } } }
  // lit braziers reveal their room
  for(const e of map.ents) if(e.type==='obj'&&e.kind==='brazier'&&!e.out&&vis.has(e.y*W+e.x)){ for(let y=e.y-4;y<=e.y+4;y++) for(let x=e.x-4;x<=e.x+4;x++) if(x>=0&&y>=0&&x<W&&y<map.h&&los(map,e.x,e.y,x,y)) vis.add(y*W+x); }
  for(const i of vis){ map.explored[i]=1; }
  // also mark adjacent walls explored
  for(const i of vis){ const x=i%W,y=(i/W)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){ const j=(y+dy)*W+x+dx; if(opaque(map.t[j])) { map.explored[j]=1; vis.add(j);} } }
  R.vis=vis; R.dirty=true; return vis;
}
function tileVisible(x,y){ return R.vis&&R.vis.has(y*G.run.map.w+x); }
// ===== input: drag to pan, pinch to zoom, tap =====
function initInput(cv,onTap){
  const ptrs=new Map(); let startDist=0, startZ=1, moved=false, last=null, downAt=0;
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=false; downAt=performance.now(); last={x:e.clientX,y:e.clientY};
    if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; startDist=Math.hypot(a.x-b.x,a.y-b.y); startZ=R.cam.z; } });
  cv.addEventListener('pointermove',e=>{ if(!ptrs.has(e.pointerId)) return; const p=ptrs.get(e.pointerId); const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(startDist>0){ R.cam.z=clamp(startZ*d/startDist,0.45,2.6); R.dirty=true; } moved=true; return; }
    if(Math.hypot(e.clientX-last.x,e.clientY-last.y)>8) moved=true;
    if(moved){ R.camTarget=null; R.cam.x-=dx/R.cam.z; R.cam.y-=dy/R.cam.z; R.dirty=true; } });
  const up=e=>{ if(!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if(!moved&&ptrs.size===0&&performance.now()-downAt<600){ const r=cv.getBoundingClientRect(); const [tx,ty]=toTile(e.clientX-r.left,e.clientY-r.top); onTap(tx,ty); } if(ptrs.size<2) startDist=0; };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);});
  cv.addEventListener('wheel',e=>{ e.preventDefault(); R.cam.z=clamp(R.cam.z*(e.deltaY<0?1.1:0.9),0.45,2.6); R.dirty=true; },{passive:false});
}
