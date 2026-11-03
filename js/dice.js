// ===== Interactive 3D dice (tap-to-roll reveal) =====
// The rules engine stays authoritative: every value shown here was already rolled by d20()/die().
// This module only animates a canvas icosahedron so that it lands on that value.
const DICE_STYLES={
  bone:{n:'Bone White',face:'#e8dfc6',edge:'#8a7550',num:'#2b1a0a'},
  obsidian:{n:'Obsidian Black',face:'#1b1a1e',edge:'#6a6470',num:'#e8e2d0'},
  blood:{n:'Blood Red',face:'#8a1010',edge:'#e0b060',num:'#f6e6c8'},
  royal:{n:'Royal Blue',face:'#1c3a8a',edge:'#d8b860',num:'#f4ecd2'},
  emerald:{n:'Emerald',face:'#0f6a3e',edge:'#c9e8a0',num:'#f2f7e6'},
  amethyst:{n:'Amethyst',face:'#5a2a8a',edge:'#e0c8ff',num:'#fff4ff'},
  gold:{n:'Gold',face:'#c9a227',edge:'#fff0b0',num:'#3a2508',metal:1},
  silver:{n:'Silver',face:'#b8bcc4',edge:'#ffffff',num:'#1e2430',metal:1},
  marbled:{n:'Marbled',face:'#dcd6ca',face2:'#5a5048',edge:'#3a3028',num:'#1e140c',marble:1},
  ember:{n:'Lantern Ember',face:'#4a1606',face2:'#ff7a18',edge:'#ffb040',num:'#ffe6a0',glow:'#ff8a20',marble:1},
  necrotic:{n:'Necrotic Green',face:'#17260f',face2:'#4aa030',edge:'#8aff6a',num:'#c8ffb0',glow:'#4aff40',marble:1},
  frost:{n:'Frost',face:'#cfe6f4',face2:'#7aa8cc',edge:'#ffffff',num:'#12365a',glow:'#a8e0ff',marble:1}
};
const DICE_DEFAULT='bone';
function diceStyleOf(c){ return (c&&c.dice&&DICE_STYLES[c.dice])?c.dice:DICE_DEFAULT; }

// ---------- geometry ----------
const D20G=(()=>{ const P=(1+Math.sqrt(5))/2; const V=[[-1,P,0],[1,P,0],[-1,-P,0],[1,-P,0],[0,-1,P],[0,1,P],[0,-1,-P],[0,1,-P],[P,0,-1],[P,0,1],[-P,0,-1],[-P,0,1]].map(v=>{ const l=Math.hypot(...v); return v.map(x=>x/l); });
  const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]); const e=d(V[0],V[1]); const F=[];
  for(let i=0;i<12;i++) for(let j=i+1;j<12;j++) for(let k=j+1;k<12;k++){ if(Math.abs(d(V[i],V[j])-e)<1e-6&&Math.abs(d(V[j],V[k])-e)<1e-6&&Math.abs(d(V[i],V[k])-e)<1e-6){
    const a=V[i],b=V[j],c=V[k]; const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]]; const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]; const cen=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];
    F.push(n[0]*cen[0]+n[1]*cen[1]+n[2]*cen[2]>0?[i,j,k]:[i,k,j]); } }
  const cenOf=f=>[0,1,2].map(ax=>(V[f[0]][ax]+V[f[1]][ax]+V[f[2]][ax])/3);
  const C=F.map(cenOf); const N=C.map(c=>{ const l=Math.hypot(...c); return c.map(x=>x/l); });
  // numbers: opposite faces sum to 21
  const num=new Array(20).fill(0); let next=1;
  for(let i=0;i<20;i++){ if(num[i]) continue; const opp=N.findIndex(n=>Math.abs(n[0]+N[i][0])<1e-6&&Math.abs(n[1]+N[i][1])<1e-6&&Math.abs(n[2]+N[i][2])<1e-6); num[i]=next; num[opp]=21-next; next++; }
  // orientation that shows face i to the viewer, number upright
  const show=num.map((_,i)=>{ const n=N[i], c=C[i], v0=V[F[i][0]]; let u=[v0[0]-c[0],v0[1]-c[1],v0[2]-c[2]]; const ul=Math.hypot(...u); u=u.map(x=>x/ul); const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
    const T=[[0,1,0],[-1,0,0],[0,0,1]], S=[u,v,n]; const R=[[0,0,0],[0,0,0],[0,0,0]]; for(let k=0;k<3;k++) for(let r=0;r<3;r++) for(let q=0;q<3;q++) R[r][q]+=T[k][r]*S[k][q]; return R; });
  return {V,F,C,N,num,show,faceOf:n=>num.indexOf(n)}; })();
function m3mul(A,B){ const R=[[0,0,0],[0,0,0],[0,0,0]]; for(let i=0;i<3;i++) for(let j=0;j<3;j++) R[i][j]=A[i][0]*B[0][j]+A[i][1]*B[1][j]+A[i][2]*B[2][j]; return R; }
function m3axis(ax,a){ const [x,y,z]=ax, c=Math.cos(a), s=Math.sin(a), t=1-c; return [[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]]; }
function m3v(M,v){ return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]]; }
function shadeHex(hex,k){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; if(k<1){ r*=k; g*=k; b*=k; } else { const t=k-1; r+=(255-r)*t; g+=(255-g)*t; b+=(255-b)*t; } return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')'; }
const DICE_PAT={};
function dicePattern(g,key){ g._dpat=g._dpat||{}; if(g._dpat[key]) return g._dpat[key]; if(DICE_PAT[key]) return (g._dpat[key]=g.createPattern(DICE_PAT[key],'repeat')); const st=DICE_STYLES[key]; const c=document.createElement('canvas'); c.width=c.height=96; const x=c.getContext('2d');
  x.clearRect(0,0,96,96); x.strokeStyle=st.face2; x.lineCap='round'; let s=key.length*977;
  const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(let i=0;i<9;i++){ x.globalAlpha=0.25+rnd()*0.45; x.lineWidth=1+rnd()*4; x.beginPath(); let px=rnd()*96, py=rnd()*96; x.moveTo(px,py); for(let k=0;k<5;k++){ px+=(rnd()-0.5)*50; py+=(rnd()-0.5)*50; x.quadraticCurveTo(px+(rnd()-.5)*30,py+(rnd()-.5)*30,px,py); } x.stroke(); }
  DICE_PAT[key]=c; return (g._dpat[key]=g.createPattern(c,'repeat')); }
// draw one d20 at (cx,cy) radius rad with rotation M
function drawD20(g,cx,cy,rad,M,styleKey,opts){ opts=opts||{}; const st=DICE_STYLES[styleKey]||DICE_STYLES[DICE_DEFAULT]; const L=[-0.35,0.55,0.76];
  const P=D20G.V.map(v=>m3v(M,v)); const proj=p=>{ const k=1/(1-p[2]*0.18); return [cx+p[0]*rad*k,cy-p[1]*rad*k]; }; const S=P.map(proj);
  if(st.glow&&!opts.noGlow){ g.save(); const gr=g.createRadialGradient(cx,cy,rad*0.4,cx,cy,rad*1.6); gr.addColorStop(0,st.glow+'88'); gr.addColorStop(1,st.glow+'00'); g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,rad*1.6,0,7); g.fill(); g.restore(); }
  const faces=[]; for(let i=0;i<20;i++){ const n=m3v(M,D20G.N[i]); if(n[2]<=0.02) continue; faces.push([i,n]); } faces.sort((a,b)=>a[1][2]-b[1][2]);
  g.lineJoin='round';
  for(const [i,n] of faces){ const f=D20G.F[i]; const lam=Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]); let k=0.42+0.7*lam; if(st.metal) k=0.35+0.95*Math.pow(lam,1.6);
    g.beginPath(); g.moveTo(S[f[0]][0],S[f[0]][1]); g.lineTo(S[f[1]][0],S[f[1]][1]); g.lineTo(S[f[2]][0],S[f[2]][1]); g.closePath();
    g.fillStyle=shadeHex(st.face,k); g.fill();
    if(st.marble){ g.save(); g.clip(); g.globalAlpha=0.55*(0.6+0.4*lam); g.fillStyle=dicePattern(g,styleKey); g.translate(i*13,i*7); g.fillRect(-200,-200,600,600); g.restore(); }
    if(st.metal&&lam>0.9){ g.fillStyle='rgba(255,255,255,'+((lam-0.9)*3).toFixed(2)+')'; g.fill(); }
    g.strokeStyle=st.edge; g.globalAlpha=0.85; g.lineWidth=Math.max(1,rad*0.035); g.stroke(); g.globalAlpha=1;
    // number
    const c=proj(m3v(M,D20G.C[i])), v0=S[f[0]]; const dx=v0[0]-c[0], dy=v0[1]-c[1]; const ang=Math.atan2(dx,-dy); const fz=n[2];
    if(fz>0.25){ const nm=D20G.num[i]; g.save(); g.translate(c[0],c[1]); g.rotate(ang); g.scale(1,0.55+0.45*fz); g.globalAlpha=Math.min(1,(fz-0.25)*2.2);
      g.fillStyle=st.num; g.font='bold '+Math.round(rad*(nm>9?0.36:0.42))+'px Georgia,serif'; g.textAlign='center'; g.textBaseline='middle';
      if(st.glow){ g.shadowColor=st.glow; g.shadowBlur=rad*0.15; }
      g.fillText(String(nm),0,rad*0.03); if(nm===6||nm===9){ g.fillRect(-rad*0.1,rad*0.2,rad*0.2,Math.max(1,rad*0.035)); } g.restore(); } }
}
// static preview canvas (thumbnail)
function diceThumb(styleKey,size,val){ const dpr=Math.min(2,window.devicePixelRatio||1); const c=document.createElement('canvas'); c.width=c.height=Math.round(size*dpr); c.style.width=c.style.height=size+'px'; c.className='dthumb';
  const g=c.getContext('2d'); g.scale(dpr,dpr); const M=m3mul(m3axis([0.6,0.8,0],0.32),D20G.show[D20G.faceOf(val||20)]); drawD20(g,size/2,size/2,size*0.36,M,styleKey); return c; }

// ---------- roll queue / reveal ----------
const DICE={ q:[], cur:null, autoDepth:0, timer:null,
  wanted(c){ if(!c||!c.isHero) return false; if(G.fast||G.autoPlay||G.autoChoice||DICE.autoDepth>0) return false; if(G.settings&&G.settings.quickRolls) return false; if(typeof document==='undefined') return false; return true; },
  // r: {who,kind,label,rolls,adv,kept,bonus,total,dc,dcLbl,ok,crit,fumble,note}
  push(rec){ if(!DICE.wanted(rec.who)) return; DICE.q.push(rec); if(!DICE.timer) DICE.timer=setTimeout(()=>{ DICE.timer=null; if(DICE.q.length) DICE.flush(); },0); },
  async flush(){ if(DICE.timer){ clearTimeout(DICE.timer); DICE.timer=null; } while(DICE.cur) await DICE.cur; if(!DICE.q.length) return; const list=DICE.q.splice(0,6); DICE.q.length=0; DICE.cur=DICE.show(list); try{ await DICE.cur; } finally { DICE.cur=null; } },
  async reveal(rec){ if(!DICE.wanted(rec.who)) return; DICE.q.push(rec); await DICE.flush(); },
  show(list){ return new Promise(res=>{
    const multi=list.length>1; const who=list[0].who; const dice=[]; // one entry per die
    list.forEach((rec,ri)=>{ const rolls=rec.rolls&&rec.rolls.length?rec.rolls:[rec.nat]; rolls.forEach((v,k)=>{ const kept=rolls.length<2||(rec.adv>0?v===Math.max(...rolls):v===Math.min(...rolls))&&rolls.indexOf(v)===k; dice.push({v,rec,ri,kept,style:diceStyleOf(rec.who)}); }); });
    const wrap=el('div',{class:'dicewrap',id:'dicebox'}); const panel=el('div',{class:'dicepanel'});
    const same=list.every(r=>r.who===who); const title=el('div',{class:'dtitle'},!multi?cName(who)+' — '+list[0].label:same?cName(who)+' — '+list.map(r=>r.label.replace(/ check$/,'')).join(' & '):(list[0].group||'Group roll')+' — '+list.length+' heroes');
    const sub=el('div',{class:'dsub'},multi?(same?'Tap once to roll both':list.map(r=>cName(r.who).split(' ')[0]).join(' · ')):((list[0].dc!=null?(list[0].dcLbl||'DC')+' '+list[0].dc+' · ':'')+'Modifier '+fmtMod(list[0].bonus)+(list[0].adv>0?' · Advantage':list[0].adv<0?' · Disadvantage':'')));
    const cv=el('canvas',{class:'dcanvas'}); const out=el('div',{class:'dout'}); const hint=el('div',{class:'dhint',id:'dice-tap'},'👆 Tap the die to roll');
    const foot=el('div',{class:'dfoot'}); const qk=el('label',{class:'dquick'},el('input',{type:'checkbox',id:'dice-quick',checked:!!(G.settings&&G.settings.quickRolls),onchange:e=>{ G.settings.quickRolls=e.target.checked; toast(e.target.checked?'Quick rolls on — dice resolve instantly.':'Tap-to-roll dice on.'); }}),' Quick rolls'); panel.append(title,sub,cv,hint,out,foot,qk); wrap.appendChild(panel); document.body.appendChild(wrap);
    const g=cv.getContext('2d'); const dpr=Math.min(2,window.devicePixelRatio||1); let W=0,H=0;
    const fit=()=>{ const r=cv.getBoundingClientRect(); W=r.width; H=r.height; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); g.setTransform(dpr,0,0,dpr,0,0); }; fit();
    const n=dice.length; const per=Math.min(W/(n+0.4),H*0.9); const rad=Math.max(22,Math.min(per*0.36,H*0.3));
    dice.forEach((d,i)=>{ d.hx=W*(i+1)/(n+1); d.ax=[Math.random()-0.5,Math.random()-0.5,Math.random()-0.5]; const l=Math.hypot(...d.ax)||1; d.ax=d.ax.map(x=>x/l); d.spin=Math.PI*(5+Math.random()*3); d.idle=m3axis([0.3,1,0.2].map(x=>x/1.06),i*1.3); d.final=D20G.show[D20G.faceOf(d.v)]; d.from=(Math.random()<.5?-1:1)*W*0.25; });
    let phase='idle', t0=performance.now(), raf=0, done=false; const DUR=G.settings&&G.settings.fastAnim?700:1250;
    const ease=t=>1-Math.pow(1-t,3);
    const frame=now=>{ if(done) return; g.clearRect(0,0,W,H); const t=phase==='roll'?Math.min(1,(now-t0)/DUR):phase==='landed'?1:0; const floorY=H*0.62+rad*0.6;
      for(const d of dice){ let M,x=d.hx,y=H*0.5,sq=1;
        if(phase==='idle'){ const a=(now-t0)/900; M=m3mul(m3axis([0.4,1,0.25].map(v=>v/1.1),a+d.hx),m3axis([1,0,0],0.5)); y=H*0.48+Math.sin(a*2.2+d.hx)*rad*0.12; }
        else { const e=ease(t); M=m3mul(m3axis(d.ax,d.spin*(1-e)),d.final); const b=Math.abs(Math.cos(t*Math.PI*3.2))*Math.pow(1-t,1.6); y=floorY-rad-b*H*0.42; x=d.hx+d.from*(1-e); if(b<0.06&&t<0.95) sq=1-0.08*(1-t); }
        // shadow
        const hgt=Math.max(0,(floorY-rad)-y); g.fillStyle='rgba(0,0,0,'+(0.45-Math.min(0.3,hgt/H)).toFixed(2)+')'; g.beginPath(); g.ellipse(x,floorY,rad*(0.95-Math.min(0.4,hgt/H)),rad*0.22,0,0,7); g.fill();
        g.save(); if(phase==='landed'&&!d.kept) g.globalAlpha=0.35; if(sq!==1){ g.translate(x,y+rad); g.scale(1/sq,sq); g.translate(-x,-(y+rad)); }
        drawD20(g,x,phase==='idle'?y:(phase==='landed'?floorY-rad:y),rad,phase==='landed'?d.final:M,d.style); g.restore();
        if(phase==='landed'&&(d.v===20||d.v===1)&&d.kept){ g.save(); g.strokeStyle=d.v===20?'rgba(255,215,110,.9)':'rgba(200,30,30,.9)'; g.lineWidth=3; g.beginPath(); g.arc(x,floorY-rad,rad*1.25+Math.sin(now/120)*3,0,7); g.stroke(); g.restore(); }
        if(phase==='landed'&&dice.length>1&&!multi){ g.fillStyle=d.kept?'#e9c76a':'#9a8a70'; g.font='bold 12px Georgia,serif'; g.textAlign='center'; g.fillText(d.kept?'KEPT':'dropped',x,floorY+16); }
        if(phase==='landed'&&multi){ g.fillStyle='#f0e2c0'; g.font='bold 12px Georgia,serif'; g.textAlign='center'; g.fillText(same?d.rec.label.replace(/ check$/,''):cName(d.rec.who).split(' ')[0],x,floorY+16); }
      }
      if(phase==='roll'&&t>=1){ land(); }
      raf=requestAnimationFrame(frame); };
    raf=requestAnimationFrame(frame);
    const finish=()=>{ if(done) return; done=true; cancelAnimationFrame(raf); wrap.classList.add('out'); setTimeout(()=>wrap.remove(),180); res(); };
    let autoT=null;
    const land=()=>{ phase='landed'; wrap.classList.add('landed'); out.innerHTML='';
      list.forEach(rec=>{ const nat=rec.nat; const row=el('div',{class:'drow '+(rec.ok===true?'good':rec.ok===false?'bad':'')});
        if(multi) row.appendChild(el('b',null,(same?rec.label.replace(/ check$/,''):cName(rec.who).split(' ')[0])+': '));
        row.appendChild(el('span',{class:'dmath'},'d20 '+(rec.rolls&&rec.rolls.length>1?'['+rec.rolls.join(', ')+'] → '+nat:'['+nat+']')+' '+fmtMod(rec.bonus)+' = ',el('b',{class:'dtot'},String(rec.total)),(rec.dc!=null?' vs '+(rec.dcLbl||'DC')+' '+rec.dc:'')));
        if(rec.ok!=null) row.appendChild(el('span',{class:'dverdict'},rec.crit?' ✦ CRITICAL HIT!':rec.ok?' ✔ '+(rec.okTxt||'Success'):' ✖ '+(rec.failTxt||'Failure')));
        if(rec.note) row.appendChild(el('div',{class:'dnote'},rec.note));
        out.appendChild(row); });
      const anyNat20=dice.some(d=>d.kept&&d.v===20), anyNat1=dice.some(d=>d.kept&&d.v===1);
      if(anyNat20){ panel.classList.add('nat20'); out.prepend(el('div',{class:'dflair crit'},'✦ NATURAL 20! ✦')); } else if(anyNat1){ panel.classList.add('nat1'); out.prepend(el('div',{class:'dflair fumble'},'☠ Natural 1 — Fumble!')); }
      hint.textContent=''; foot.appendChild(btn('Continue',finish,'big',{id:'dice-done'})); autoT=setTimeout(finish,multi?6000:4500); };
    const roll=()=>{ if(phase!=='idle') return; phase='roll'; t0=performance.now(); hint.textContent='Rolling…'; wrap.classList.add('rolling'); };
    cv.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); if(phase==='idle') roll(); else if(phase==='landed') finish(); });
    hint.addEventListener('pointerdown',e=>{ e.stopPropagation(); roll(); });
    wrap.addEventListener('pointerdown',e=>{ if(e.target===wrap){ if(phase==='idle') roll(); else if(phase==='landed') finish(); } });
    DICE._roll=roll; DICE._finish=()=>{ clearTimeout(autoT); finish(); };
  }); }
};
// helper to build a record from a d20() result
function diceRec(who,kind,label,r,bonus,total,dc,ok,extra){ return Object.assign({who,kind,label,rolls:r.rolls,adv:r.adv||0,nat:r.r,bonus,total,dc,ok},extra||{}); }
// hero auto turns (Auto button / auto-play) never ask for a tap
(function(){ const _a=autoHeroTurn; autoHeroTurn=async function(){ DICE.autoDepth++; try{ return await _a.apply(this,arguments); } finally { DICE.autoDepth--; } }; })();
// picker used by the creator and the character sheet
function dicePicker(h,redraw,readonly){ const cur=diceStyleOf(h);
  setTimeout(()=>{ const st=document.getElementById('c-dice'), b=document.getElementById('dice-'+cur); if(st&&b&&(b.offsetLeft+b.offsetWidth>st.clientWidth+st.scrollLeft||b.offsetLeft<st.scrollLeft)) st.scrollLeft=b.offsetLeft-st.offsetLeft-6; },0);
  return el('section',{class:'csec dwrap'},el('h3',null,'Dice'),el('div',{class:'dstrip',id:'c-dice'},Object.keys(DICE_STYLES).map(k=>el('button',{class:'dpick'+(k===cur?' on':''),id:'dice-'+k,title:DICE_STYLES[k].n,disabled:readonly&&k!==cur?true:null,onclick:()=>{ if(readonly) return; h.dice=k; redraw(); }},diceThumb(k,46,k===cur?20:(Object.keys(DICE_STYLES).indexOf(k)%19)+1),el('span',null,DICE_STYLES[k].n)))),
    el('div',{class:'small dsel'},'Selected: ',el('b',null,DICE_STYLES[cur].n),' ',btn('🎲 Test roll',()=>DICE.practice(h),'mini',{id:'b-dicetest'}))); }
DICE.practice=async function(h){ const r=d20(0,false); await DICE.show([diceRec(h,'practice','Practice roll',r,0,r.r,null,null)]); };
