// ===== Painted dungeon tiles =====
// Seamless painted textures (assets/tex) are projected once into isometric diamonds / wall blocks and cached as
// small canvases, so the per-frame cost is one drawImage per tile (cheaper than the old path-drawn walls).
// Falls back to the procedural floorTile/drawWall until (or if) the textures fail to load.
const TEX_SRC=['flag','crack','brick','carved','cave','rock'];
const TEX={img:{},ready:0,failed:0};
const TEX_SC=2;              // cache resolution multiplier (crisp on dpr-2 phones and when zoomed)
const TEX_CELLS=4;           // 4x4 tiles span one 512px texture, so neighbouring tiles continue seamlessly
// per theme: floor textures (main, patches), wall texture, tint, decal weights [moss,blood,crack,rubble], sconce rate
const TEX_THEME={
  cellar:   {floor:['flag','crack'],wall:'brick', tint:'#7a5434',ta:0.30,br:1.00,dec:[3,2,2,2],sconce:0.10},
  crypt:    {floor:['crack','flag'],wall:'carved',tint:'#6a7080',ta:0.22,br:0.95,dec:[2,2,4,2],sconce:0.09},
  cave:     {floor:['cave','flag'], wall:'rock',  tint:'#6a5236',ta:0.22,br:1.05,dec:[3,1,1,5],sconce:0.03},
  sunken:   {floor:['crack','cave'],wall:'carved',tint:'#3c6a5a',ta:0.38,br:0.95,dec:[6,1,2,2],sconce:0.06},
  dwarven:  {floor:['flag','crack'],wall:'carved',tint:'#8a6a3a',ta:0.28,br:1.00,dec:[1,1,3,4],sconce:0.12},
  cathedral:{floor:['flag','crack'],wall:'carved',tint:'#6a2a32',ta:0.32,br:0.95,dec:[1,5,3,2],sconce:0.11}
};
(function loadTex(){ for(const k of TEX_SRC){ const im=new Image(); im.decoding='async';
  im.onload=()=>{ TEX.ready++; if(TEX.ready+TEX.failed===TEX_SRC.length){ R.tileCache={}; texReset(); } R.dirty=true; };
  im.onerror=()=>{ TEX.failed++; R.dirty=true; }; im.src='assets/tex/t_'+k+'.jpg'; TEX.img[k]=im; } })();
function texOk(k){ const im=TEX.img[k]; return !!im&&im.complete&&im.naturalWidth>0; }
function texThemeReady(theme){ const tt=TEX_THEME[theme]; return !!tt&&TEX.ready+TEX.failed===TEX_SRC.length&&texOk(tt.wall)&&tt.floor.every(texOk); }
function tHash(x,y,s){ let h=(x*374761393+y*668265263+(s||0)*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
function mod(a,n){ return ((a%n)+n)%n; }
// which painted floor + decal a tile gets (stable per map position)
function tileLook(map,x,y){ const tt=TEX_THEME[map.theme]||TEX_THEME.crypt; const seed=map.seed||0;
  const zone=tHash(Math.floor(x/3),Math.floor(y/3),seed+7); const tex=zone<0.7?0:1;
  let dec=0; const r=tHash(x,y,seed+11); if(r<0.17){ const w=tt.dec, tot=w[0]+w[1]+w[2]+w[3]; let q=tHash(x,y,seed+13)*tot; for(let i=0;i<4;i++){ q-=w[i]; if(q<0){ dec=i+1; break; } } }
  return {tex,dec,v:Math.floor(tHash(x,y,seed+17)*3)}; }
// Tiles are painted on ONE scratch canvas, then copied into a few big atlas pages. Hundreds of small canvases each carry their own
// raster/GPU backing (that ballooned the renderer to GBs on long sessions); a handful of 2048² pages keeps memory flat (~16 MB/page).
const TEX_ATLAS={pages:[],n:0,scratch:null};
const TEX_SLOT_W=TW*TEX_SC+2, TEX_SLOT_H=(TH+WALLH)*TEX_SC+2, TEX_PAGE=2048, TEX_PER_ROW=Math.floor(TEX_PAGE/TEX_SLOT_W), TEX_PER_PAGE=TEX_PER_ROW*Math.floor(TEX_PAGE/TEX_SLOT_H);
function texCtx(w,h){ let c=TEX_ATLAS.scratch; if(!c){ c=TEX_ATLAS.scratch=document.createElement('canvas'); c.width=TW*TEX_SC; c.height=(TH+WALLH)*TEX_SC; }
  const g=c.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over'; g.clearRect(0,0,c.width,c.height); g.scale(TEX_SC,TEX_SC); c._w=w; c._h=h; return [c,g]; }
// copy the scratch tile into the next atlas slot; returns a sprite {img,sx,sy,sw,sh}
function texStore(c){ const A=TEX_ATLAS; const i=A.n++; const pi=Math.floor(i/TEX_PER_PAGE), j=i%TEX_PER_PAGE; let pg=A.pages[pi];
  if(!pg){ pg=A.pages[pi]=document.createElement('canvas'); pg.width=TEX_PAGE; pg.height=TEX_PAGE; }
  const sx=(j%TEX_PER_ROW)*TEX_SLOT_W+1, sy=Math.floor(j/TEX_PER_ROW)*TEX_SLOT_H+1, sw=Math.round(c._w*TEX_SC), sh=Math.round(c._h*TEX_SC);
  const g=pg.getContext('2d'); g.clearRect(sx-1,sy-1,TEX_SLOT_W,TEX_SLOT_H); g.drawImage(c,0,0,sw,sh,sx,sy,sw,sh); return {img:pg,sx,sy,sw,sh}; }
function texReset(){ R.texCache={}; TEX_ATLAS.n=0; } // atlas pages are reused (slots overwritten), never reallocated
function texBlit(g,s,dx,dy,dw,dh){ g.drawImage(s.img,s.sx,s.sy,s.sw,s.sh,dx,dy,dw,dh); }
function diamondPath(g,ox,oy){ g.beginPath(); g.moveTo(ox+TW/2,oy); g.lineTo(ox+TW,oy+TH/2); g.lineTo(ox+TW/2,oy+TH); g.lineTo(ox,oy+TH/2); g.closePath(); }
// project texture cell (cu,cv) onto the diamond whose top corner is at (ox,oy) in the current (scaled) context
function paintDiamond(g,im,cu,cv,ox,oy){ const S=im.naturalWidth/TEX_CELLS, k=(TW/2)/S; g.save(); diamondPath(g,ox,oy); g.clip();
  g.transform(k,k/2,-k,k/2,ox+TW/2,oy); g.drawImage(im,cu*S,cv*S,S,S,-0.5,-0.5,S+1,S+1); g.restore(); }
function tintLayer(g,tt,alpha){ g.save(); g.globalCompositeOperation='color'; g.globalAlpha=alpha==null?tt.ta:alpha; g.fillStyle=tt.tint; g.fillRect(-50,-80,TW+100,TH+200); g.restore(); }
function texFloorTile(map,x,y,kind){ const theme=map.theme; if(!texThemeReady(theme)) return null; if(R._texTheme!==theme){ R._texTheme=theme; texReset(); }
  const L=tileLook(map,x,y); const cu=mod(x,TEX_CELLS), cv=mod(y,TEX_CELLS); const key='f|'+L.tex+'|'+cu+'|'+cv+'|'+(kind==='stone'?L.dec+'|'+L.v:kind);
  const C=R.texCache||(R.texCache={}); if(C[key]) return C[key];
  const tt=TEX_THEME[theme], th=THEMES[theme]; const [c,g]=texCtx(TW,TH); const im=TEX.img[tt.floor[L.tex]];
  g.save(); diamondPath(g,0,0); g.clip();
  paintDiamond(g,im,cu,cv,0,0);
  // theme tint + overall darkness so tokens stay the brightest thing on the board
  tintLayer(g,tt); g.fillStyle='rgba(0,0,0,'+(0.2/(tt.br||1))+')'; g.fillRect(0,0,TW,TH);
  let seed=(x*928371+y*1237+3)>>>0; const rr=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  if(kind==='water'){ const gr=g.createLinearGradient(0,0,TW,TH); gr.addColorStop(0,'rgba(18,44,52,0.82)'); gr.addColorStop(1,'rgba(8,24,30,0.88)'); g.fillStyle=gr; g.fillRect(0,0,TW,TH);
    g.strokeStyle='rgba(150,190,200,0.28)'; g.lineWidth=0.8; for(let i=0;i<3;i++){ g.beginPath(); g.ellipse(TW/2+(rr()-0.5)*24,TH/2+(rr()-0.5)*9,7+rr()*7,1.6+rr(),0,0,7); g.stroke(); }
    g.fillStyle='rgba(200,230,240,0.10)'; g.beginPath(); g.ellipse(TW*0.38,TH*0.4,9,2.5,0,0,7); g.fill(); }
  else if(kind==='rubble'){ for(let i=0;i<9;i++){ const px=TW*0.2+rr()*TW*0.6, py=TH*0.25+rr()*TH*0.5, rx=2+rr()*4.5, ry=1.4+rr()*2.4; g.fillStyle='rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(px+1,py+1,rx,ry,0,0,7); g.fill(); g.fillStyle=shade(th.wallTop,0.75+rr()*0.5); g.beginPath(); g.ellipse(px,py,rx,ry,0,0,7); g.fill(); g.fillStyle='rgba(255,240,210,0.10)'; g.beginPath(); g.ellipse(px-rx*0.3,py-ry*0.4,rx*0.5,ry*0.4,0,0,7); g.fill(); } }
  else if(L.dec) drawDecal(g,L.dec,rr,L.v);
  g.restore();
  // grid: a dark seam with a faint warm inner bevel — subtle, but every square stays countable
  g.lineJoin='round'; g.strokeStyle='rgba(0,0,0,0.62)'; g.lineWidth=1.1; diamondPath(g,0,0); g.stroke();
  g.save(); g.translate(TW/2,TH/2); g.scale(0.94,0.94); g.translate(-TW/2,-TH/2); g.strokeStyle='rgba(255,214,150,0.11)'; g.lineWidth=0.7; diamondPath(g,0,0); g.stroke(); g.restore();
  return (C[key]=texStore(c)); }
function drawDecal(g,d,rr,v){ const cx=TW/2+(rr()-0.5)*18, cy=TH/2+(rr()-0.5)*7;
  if(d===1){ // moss creeping in from the seams
    for(let i=0;i<10;i++){ const a=rr()*6.28, r=rr()*12; g.fillStyle='rgba('+(40+rr()*30|0)+','+(70+rr()*40|0)+','+(25+rr()*20|0)+','+(0.25+rr()*0.3)+')'; g.beginPath(); g.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.5,3+rr()*5,1.5+rr()*2.5,0,0,7); g.fill(); } }
  else if(d===2){ // old blood
    g.fillStyle='rgba(70,6,8,0.55)'; g.beginPath(); g.ellipse(cx,cy,7+v*2+rr()*4,3+rr()*2,rr()*0.6-0.3,0,7); g.fill();
    g.fillStyle='rgba(95,10,12,0.5)'; for(let i=0;i<6;i++){ const a=rr()*6.28, r=8+rr()*8; g.beginPath(); g.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.5,0.8+rr()*1.6,0.6+rr()*0.9,0,0,7); g.fill(); }
    if(v===2){ g.strokeStyle='rgba(60,5,6,0.45)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(cx,cy); g.quadraticCurveTo(cx+8,cy+2,cx+16,cy+5); g.stroke(); } }
  else if(d===3){ // crack through the slab
    let px=cx-12, py=cy-3; g.strokeStyle='rgba(0,0,0,0.7)'; g.lineWidth=1; g.beginPath(); g.moveTo(px,py); for(let i=0;i<5;i++){ px+=4+rr()*3; py+=(rr()-0.4)*4; g.lineTo(px,py); } g.stroke();
    g.strokeStyle='rgba(255,230,190,0.10)'; g.beginPath(); g.moveTo(cx-12,cy-2); g.lineTo(cx+6,cy+1); g.stroke(); }
  else if(d===4){ // loose rubble & bone chips
    for(let i=0;i<6;i++){ const px=cx+(rr()-0.5)*20, py=cy+(rr()-0.5)*8, r=1+rr()*2.2; g.fillStyle='rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(px+0.8,py+0.8,r,r*0.6,0,0,7); g.fill(); g.fillStyle=rr()<0.25?'rgba(200,190,160,0.7)':'rgba(120,110,95,0.85)'; g.beginPath(); g.ellipse(px,py,r,r*0.6,0,0,7); g.fill(); } } }
// wall block sprite: left face (toward +y), right face (toward +x), top cap. Origin = (TW/2, WALLH) is the tile's top corner.
function wallSconceSide(map,x,y){ const tt=TEX_THEME[map.theme]||TEX_THEME.crypt; if(tHash(x,y,(map.seed||0)+29)>=tt.sconce) return 0; const l=walkable(tileAt(map,x,y+1)), r=walkable(tileAt(map,x+1,y)); if(l&&r) return tHash(x,y,31)<0.5?1:2; return l?1:r?2:0; }
function texWallSprite(map,x,y,dimLvl){ const theme=map.theme; if(!texThemeReady(theme)) return null; if(R._texTheme!==theme){ R._texTheme=theme; texReset(); }
  const sc=wallSconceSide(map,x,y); const cu=mod(x,TEX_CELLS), cv=mod(-y,TEX_CELLS); const key='w|'+cu+'|'+cv+'|'+dimLvl+'|'+sc+'|'+(tHash(x,y,41)<0.5?0:1);
  const C=R.texCache||(R.texCache={}); if(C[key]) return C[key];
  const tt=TEX_THEME[theme], th=THEMES[theme]; const im=TEX.img[tt.wall]; const S=im.naturalWidth/TEX_CELLS, h=WALLH, Hs=S*0.62; const dim=dimLvl?0.42:0.92;
  const [c,g]=texCtx(TW,TH+h); const ox=0, oy=h; // top corner of the floor diamond at (TW/2, h)
  const vOff=(tHash(x,y,41)<0.5?0:0.5)*S;
  const face=(a,b,e,f,cu0,shadeF)=>{ g.save(); g.beginPath(); if(b>0){ g.moveTo(e,f); g.lineTo(e+TW/2,f+TH/2); g.lineTo(e+TW/2,f+TH/2+h); g.lineTo(e,f+h); } else { g.moveTo(e,f); g.lineTo(e+TW/2,f-TH/2); g.lineTo(e+TW/2,f-TH/2+h); g.lineTo(e,f+h); } g.closePath(); g.clip();
    g.transform(a,b,0,h/Hs,e,f); g.drawImage(im,cu0*S,vOff,S,Hs,-0.5,-0.5,S+1,Hs+1); g.setTransform(TEX_SC,0,0,TEX_SC,0,0);
    tintLayer(g,tt); g.fillStyle='rgba(0,0,0,'+(1-shadeF*dim)+')'; g.fillRect(0,0,TW,TH+h);
    // ground shadow where the wall meets the floor
    const gr=g.createLinearGradient(0,f+h-8,0,f+h+TH/2); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,0.45)'); g.fillStyle=gr; g.fillRect(0,0,TW,TH+h); g.restore(); };
  // left face: from left corner (0, oy+TH/2-h) down-right to the bottom corner
  face((TW/2)/S,(TH/2)/S,ox,oy+TH/2-h,cu,0.78);
  // right face: from bottom corner up-right to the right corner
  face((TW/2)/S,-(TH/2)/S,ox+TW/2,oy+TH-h,cv,0.56);
  // top cap
  g.save(); g.translate(0,-h); diamondPath(g,ox,oy); g.clip(); g.fillStyle=shade(th.wallTop,dim*0.9); g.fillRect(0,0,TW,TH+h); g.globalAlpha=0.35; paintDiamond(g,im,cu,mod(y,TEX_CELLS),ox,oy); g.globalAlpha=1; g.fillStyle='rgba(0,0,0,'+(dimLvl?0.5:0.18)+')'; g.fillRect(0,0,TW,TH+h); g.restore();
  // crisp edges
  g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=0.9; g.beginPath(); g.moveTo(ox,oy+TH/2-h); g.lineTo(ox+TW/2,oy-h); g.lineTo(ox+TW,oy+TH/2-h); g.lineTo(ox+TW,oy+TH/2); g.lineTo(ox+TW/2,oy+TH); g.lineTo(ox,oy+TH/2); g.closePath(); g.stroke();
  g.strokeStyle='rgba(255,220,170,'+(dimLvl?0.06:0.16)+')'; g.beginPath(); g.moveTo(ox,oy+TH/2-h); g.lineTo(ox+TW/2,oy+TH-h); g.lineTo(ox+TW,oy+TH/2-h); g.moveTo(ox+TW/2,oy+TH-h); g.lineTo(ox+TW/2,oy+TH); g.stroke();
  if(sc) drawSconce(g,sc===1?ox+TW/4:ox+TW*3/4,oy+TH*0.75-h*0.55,dimLvl);
  return (C[key]=texStore(c)); }
function drawSconce(g,x,y,dimLvl){ g.save(); g.translate(x,y);
  g.fillStyle=dimLvl?'#141110':'#2a2420'; g.strokeStyle='#0a0807'; g.lineWidth=0.6; g.beginPath(); g.moveTo(-2.2,4); g.lineTo(2.2,4); g.lineTo(1.4,-1); g.lineTo(-1.4,-1); g.closePath(); g.fill(); g.stroke(); // bracket
  g.fillStyle=dimLvl?'#2b2017':'#5a3d22'; g.fillRect(-0.9,-5,1.8,4.5); // torch shaft
  if(!dimLvl){ const gr=g.createRadialGradient(0,-7,0.2,0,-7,6); gr.addColorStop(0,'rgba(255,240,180,1)'); gr.addColorStop(0.45,'rgba(255,150,40,0.9)'); gr.addColorStop(1,'rgba(255,90,0,0)'); g.fillStyle=gr; g.beginPath(); g.ellipse(0,-7.5,3.2,5,0,0,7); g.fill(); }
  else { g.fillStyle='rgba(60,40,25,0.8)'; g.beginPath(); g.ellipse(0,-6,1.4,1.8,0,0,7); g.fill(); }
  g.restore(); }
// torch-sconce light sources for the lighting pass, computed once per map (walls are static)
function mapSconces(map){ if(map._sconces&&map._sconcesTheme===map.theme) return map._sconces; const out=[];
  for(let y=0;y<map.h;y++) for(let x=0;x<map.w;x++){ const t=map.t[y*map.w+x]; if(t!==T.WALL) continue; const s=wallSconceSide(map,x,y); if(s) out.push([x+(s===2?0.6:0),y+(s===1?0.6:0)]); }
  Object.defineProperty(map,'_sconces',{value:out,writable:true,enumerable:false,configurable:true}); Object.defineProperty(map,'_sconcesTheme',{value:map.theme,writable:true,enumerable:false,configurable:true}); return out; }
// walls with no open neighbour are solid bedrock: drawn as a flat dark cap so they don't read as more floor grid
function wallIsDeep(map,x,y){ let d=map._deep; if(!d||d.length!==map.t.length){ d=new Uint8Array(map.t.length); Object.defineProperty(map,'_deep',{value:d,writable:true,enumerable:false,configurable:true}); }
  const i=y*map.w+x; if(d[i]) return d[i]===2; let open=false; for(let dy=-1;dy<=1&&!open;dy++) for(let dx=-1;dx<=1;dx++){ const t=tileAt(map,x+dx,y+dy); if(t!==T.WALL&&t!==T.SECRET){ open=true; break; } } d[i]=open?1:2; return !open; }
function texDeepTile(map,dimLvl){ const key='deep|'+map.theme+'|'+dimLvl; const C=R.texCache||(R.texCache={}); if(C[key]) return C[key]; const th=THEMES[map.theme]; const [c,g]=texCtx(TW,TH+WALLH);
  g.beginPath(); g.moveTo(TW/2,-0.6); g.lineTo(TW+0.6,TH/2); g.lineTo(TW/2,TH+0.6); g.lineTo(-0.6,TH/2); g.closePath(); g.fillStyle=shade(th.wall,dimLvl?0.22:0.34); g.fill(); return (C[key]=texStore(c)); }
