'use strict';
function circleRect(cx, cy, r, rx, ry, rw, rh){
  const nx = clamp(cx, rx, rx+rw), ny = clamp(cy, ry, ry+rh);
  const dx = cx-nx, dy = cy-ny;
  return dx*dx + dy*dy < r*r;
}

/* ================= render ================= */
function render(){
  const nf = nightFactor();
  ctx.save();
  if(shake > 0) ctx.translate(rand(-shake,shake)*0.5, rand(-shake,shake)*0.5);

  // sky
  const dayT = (t % DAY_LEN) / DAY_LEN;
  const warm = Math.exp(-Math.pow((nf-0.5)/0.28, 2)); // dawn/dusk glow
  const th = THEMES[theme];
  const top = th.skyTop[0].map((c,i) => lerp(c, th.skyTop[1][i], nf));
  const bot = th.skyBot[0].map((c,i) => lerp(c, th.skyBot[1][i], nf));
  const g = ctx.createLinearGradient(0,0,0,GROUND_Y);
  g.addColorStop(0, `rgb(${top.map(Math.round)})`);
  g.addColorStop(1, `rgb(${bot.map(Math.round)})`);
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // dawn/dusk warm overlay
  if(warm > 0.05){
    const wg = ctx.createLinearGradient(0,GROUND_Y*0.3,0,GROUND_Y);
    wg.addColorStop(0,'rgba(255,140,60,0)');
    wg.addColorStop(1,`rgba(255,140,60,${warm*0.35})`);
    ctx.fillStyle = wg; ctx.fillRect(0,0,W,GROUND_Y);
  }

  // stars
  if(nf > 0.15){
    for(const s of stars){
      const a = clamp((nf-0.15)/0.5) * (0.5 + 0.5*Math.sin(t*2.5 + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  // sun / moon
  const dayHalf = dayT < 0.5;
  const p = dayHalf ? dayT/0.5 : (dayT-0.5)/0.5;
  const cx2 = lerp(-40, W+40, p);
  const cy2 = H*0.72 - Math.sin(p*Math.PI)*H*0.52;
  const sunA = clamp(1-nf*2, 0, 1), moonA = clamp(nf*2-1, 0, 1);
  if(sunA > 0){
    ctx.save(); ctx.globalAlpha = sunA;
    ctx.shadowColor = 'rgba(255,220,90,0.9)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(cx2, cy2, 34, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if(moonA > 0){
    ctx.save(); ctx.globalAlpha = moonA;
    ctx.shadowColor = 'rgba(220,230,255,0.8)'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#f4f7ff';
    ctx.beginPath(); ctx.arc(cx2, cy2, 28, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(180,190,215,0.5)';
    ctx.beginPath(); ctx.arc(cx2-8, cy2-6, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx2+9, cy2+8, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // clouds
  for(const c of clouds){
    ctx.fillStyle = `rgba(255,255,255,${lerp(0.85,0.22,nf)})`;
    const s = c.s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 22*s, 0, TAU);
    ctx.arc(c.x+24*s, c.y-10*s, 20*s, 0, TAU);
    ctx.arc(c.x+48*s, c.y, 22*s, 0, TAU);
    ctx.arc(c.x+24*s, c.y+8*s, 20*s, 0, TAU);
    ctx.fill();
  }

  // silhouettes
  const off = (t*12) % silW;
  ctx.save();
  ctx.translate(-off, 0);
  for(const s of silhouettes){
    for(const rep of [0, silW]){
      const sx = s.x + rep;
      if(sx > W || sx + s.w < 0) continue;
      drawSilhouette(s, nf);
    }
  }
  ctx.restore();

  // ocean band
  if(theme === 'ocean'){
    const f = lerp(1, 0.5, nf);
    ctx.fillStyle = `rgb(${Math.round(45*f)},${Math.round(140*f)},${Math.round(175*f)})`;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for(let x=0; x<=W; x+=8) ctx.lineTo(x, GROUND_Y - 34 + Math.sin(x*0.05 + t*2)*5);
    ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill();
  }

  // pipes
  let fogOn = false;
  if(run && run.boss){
    const fphs = run.boss.def.phases;
    const fidx = Math.min(fphs.length-1, Math.floor(run.boss.passes * fphs.length / run.boss.max));
    fogOn = !!fphs[fidx].fog;
  }
  for(const p of pipes){
    if(run && run.boss && p.blinking) ctx.globalAlpha = 0.4 + 0.6*Math.abs(Math.sin(t*25));
    else if(fogOn && p.x > BIRD_X + 300) ctx.globalAlpha = 0.25;
    drawPipe(p, nf);
    ctx.globalAlpha = 1;
  }

  // ground
  drawGround(nf);
  drawCeiling(nf);

  // fireflies (night, city/forest)
  if((theme==='city'||theme==='forest') && nf > 0.4){
    const a = clamp((nf-0.4)/0.5);
    for(const f of fireflies){
      const gl = 0.5+0.5*Math.sin(f.p*3);
      ctx.fillStyle = `rgba(220,255,140,${a*gl*0.9})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 2.4, 0, TAU); ctx.fill();
    }
  }

  // theme particles
  if(theme === 'snow'){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for(const s of fxParts){ ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill(); }
  } else if(theme === 'desert'){
    ctx.fillStyle = 'rgba(232,204,140,0.5)';
    for(const d of fxParts) ctx.fillRect(d.x, d.y, 3, 2);
  }

  // trail
  const s = skinById(save.selected);
  for(const tr of trail){
    const a = tr.life/tr.max;
    if(s.rainbow){ ctx.fillStyle = `hsla(${(t*140 + tr.x*2)%360},90%,65%,${a*0.5})`; }
    else { ctx.globalAlpha = a*0.45; ctx.fillStyle = s.trail; }
    ctx.beginPath(); ctx.arc(tr.x, tr.y, 10*a, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // particles
  for(const p of particles){
    ctx.globalAlpha = clamp(p.life/p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // bird
  if(invuln > 0) ctx.globalAlpha = Math.sin(t*30) > 0 ? 1 : 0.35;
  drawBird(BIRD_X, bird.y, bird.rot, s, bird.wing, powers().radius/BIRD_R);
  ctx.globalAlpha = 1;

  // popups
  ctx.font = '900 26px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for(const p of popups){
    ctx.globalAlpha = clamp(p.life/p.max, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4;
    ctx.strokeText(p.txt, p.x, p.y);
    ctx.fillText(p.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // GAPLORD boss bar
  if(mode==='rl' && run && run.boss && (state==='play' || state==='ready')){
    const bx = W/2 - 110, by = 14, bw = 220, bh = 14;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx-8, by-22, bw+16, 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    const b = run.boss, phN = b.def.phases.length;
    const phIdx = Math.min(phN-1, Math.floor(b.passes * phN / b.max));
    ctx.fillText(b.def.name + (phN > 1 ? '  ' + T('phase') + ' ' + (phIdx+1) + '/' + phN : ''), W/2, by-6);
    ctx.fillStyle = '#3a1020'; ctx.fillRect(bx, by, bw, bh);
    const hpFrac = (run.boss.max - run.boss.passes) / run.boss.max;
    ctx.fillStyle = '#e23b5a'; ctx.fillRect(bx, by, bw*hpFrac, bh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for(let i=1;i<run.boss.max;i++){ ctx.beginPath(); ctx.moveTo(bx+bw*i/run.boss.max, by); ctx.lineTo(bx+bw*i/run.boss.max, by+bh); ctx.stroke(); }
  }

  // hit flash
  if(flash > 0){ ctx.fillStyle = `rgba(255,255,255,${flash*0.7})`; ctx.fillRect(0,0,W,H); }

  // fever tint
  if(feverT > 0){ ctx.fillStyle = `rgba(255,90,0,${0.12 + 0.08*Math.sin(t*12)})`; ctx.fillRect(0,0,W,H); }

  // vignette
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,`rgba(0,0,0,${0.12 + nf*0.18})`);
  ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

  ctx.restore();
}

function drawPipe(p, nf){
  const f = lerp(1, 0.45, nf);
  const topH = p.gapY - p.gap/2, botY = p.gapY + p.gap/2;
  let body, dark, light;
  if(p.boss){
    const c = (run.boss && run.boss.def.colors) ? run.boss.def.colors : [150,45,80, 90,20,50, 210,80,120];
    body = `rgb(${Math.round(c[0]*f)},${Math.round(c[1]*f)},${Math.round(c[2]*f)})`;
    dark = `rgb(${Math.round(c[3]*f)},${Math.round(c[4]*f)},${Math.round(c[5]*f)})`;
    light = `rgb(${Math.round(c[6]*f)},${Math.round(c[7]*f)},${Math.round(c[8]*f)})`;
  } else if(p.move){
    body = `rgb(${Math.round(235*f)},${Math.round(165*f)},${Math.round(65*f)})`;
    dark = `rgb(${Math.round(165*f)},${Math.round(105*f)},${Math.round(35*f)})`;
    light = `rgb(${Math.round(255*f)},${Math.round(210*f)},${Math.round(115*f)})`;
  } else if(p.hammer){
    body = `rgb(${Math.round(190*f)},${Math.round(75*f)},${Math.round(75*f)})`;
    dark = `rgb(${Math.round(130*f)},${Math.round(45*f)},${Math.round(45*f)})`;
    light = `rgb(${Math.round(235*f)},${Math.round(130*f)},${Math.round(110*f)})`;
  } else if(p.spear){
    body = `rgb(${Math.round(150*f)},${Math.round(160*f)},${Math.round(175*f)})`;
    dark = `rgb(${Math.round(95*f)},${Math.round(105*f)},${Math.round(125*f)})`;
    light = `rgb(${Math.round(205*f)},${Math.round(215*f)},${Math.round(230*f)})`;
  } else {
    body = `rgb(${Math.round(80*f)},${Math.round(190*f)},${Math.round(90*f)})`;
    dark = `rgb(${Math.round(50*f)},${Math.round(140*f)},${Math.round(60*f)})`;
    light = `rgb(${Math.round(140*f)},${Math.round(225*f)},${Math.round(130*f)})`;
  }
  const cTop = Math.max(0, labyCeilY), cBot = Math.min(GROUND_Y, labyFloorY);
  pipeRect(p.x, cTop, Math.max(0, topH - cTop), body, dark, light, true);
  pipeRect(p.x, botY, Math.max(0, cBot - botY), body, dark, light, false);
  if(p.move){
    const up = Math.cos(t*p.spd + p.phase) < 0;
    chevron(p.x+35, topH-13, up);
    chevron(p.x+35, botY+13, up);
  } else if(p.hammer){
    const danger = p.baseGap ? 1 - p.gap/p.baseGap : 0;
    ctx.save();
    ctx.shadowColor = 'rgba(255,60,40,0.9)';
    ctx.shadowBlur = 4 + danger*16;
    ctx.fillStyle = `rgba(255,${Math.round(110-70*danger)},40,${0.5+0.5*danger})`;
    ctx.fillRect(p.x-4, topH-3, 78, 3);
    ctx.fillRect(p.x-4, botY, 78, 3);
    ctx.restore();
    ctx.fillStyle = `rgba(50,8,8,${0.45+0.55*danger})`;
    for(let sx = p.x+6; sx + 12 <= p.x+70; sx += 12){
      ctx.beginPath(); ctx.moveTo(sx, topH); ctx.lineTo(sx+6, topH+10); ctx.lineTo(sx+12, topH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx, botY); ctx.lineTo(sx+6, botY-10); ctx.lineTo(sx+12, botY); ctx.closePath(); ctx.fill();
    }
  } else if(p.spear){
    ctx.fillStyle = `rgb(${Math.round(230*f)},${Math.round(70*f)},${Math.round(70*f)})`;
    for(let sx = p.x+6; sx + 14 <= p.x+70; sx += 14){
      ctx.beginPath(); ctx.moveTo(sx, topH); ctx.lineTo(sx+7, topH+13); ctx.lineTo(sx+14, topH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx, botY); ctx.lineTo(sx+7, botY-13); ctx.lineTo(sx+14, botY); ctx.closePath(); ctx.fill();
    }
  } else if(p.boss){
    const ec = (run.boss && run.boss.def.eye) || '#ff8090';
    ctx.save();
    ctx.shadowColor = ec; ctx.shadowBlur = 10;
    ctx.fillStyle = ec;
    ctx.beginPath(); ctx.arc(p.x+35, topH-10, 5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x+35, botY+10, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function chevron(x, y, up){
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  if(up){ ctx.moveTo(x, y-5); ctx.lineTo(x-7, y+4); ctx.lineTo(x+7, y+4); }
  else { ctx.moveTo(x, y+5); ctx.lineTo(x-7, y-4); ctx.lineTo(x+7, y-4); }
  ctx.closePath(); ctx.fill();
}
function pipeRect(x, y, h, body, dark, light, isTop){
  if(h <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x+70, 0);
  g.addColorStop(0, dark); g.addColorStop(0.35, light); g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, 70, h);
  // cap
  const capY = isTop ? y+h-26 : y;
  const cg = ctx.createLinearGradient(x-4, 0, x+74, 0);
  cg.addColorStop(0, dark); cg.addColorStop(0.35, light); cg.addColorStop(1, dark);
  ctx.fillStyle = cg;
  ctx.fillRect(x-4, capY, 78, 26);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  ctx.strokeRect(x-4, capY, 78, 26);
  ctx.strokeRect(x, y, 70, h);
}

function drawSilhouette(s, nf){
  const f = lerp(1, 0.45, nf);
  if(s.kind === 'dune'){
    ctx.fillStyle = `rgb(${Math.round(214*f)},${Math.round(176*f)},${Math.round(105*f)})`;
    ctx.beginPath(); ctx.ellipse(s.x + s.w/2, GROUND_Y + s.h*0.35, s.w/2, s.h, 0, Math.PI, 0); ctx.fill();
  } else if(s.kind === 'cactus'){
    ctx.fillStyle = `rgb(${Math.round(60*f)},${Math.round(120*f)},${Math.round(70*f)})`;
    ctx.fillRect(s.x, GROUND_Y - s.h, s.w*0.4, s.h);
    ctx.fillRect(s.x - s.w*0.3, GROUND_Y - s.h*0.75, s.w*0.3, s.h*0.25);
    ctx.fillRect(s.x - s.w*0.3, GROUND_Y - s.h*0.75, s.w*0.15, -s.h*0.35);
  } else if(s.kind === 'tree'){
    ctx.fillStyle = `rgb(${Math.round(46*f)},${Math.round(110*f)},${Math.round(58*f)})`;
    ctx.fillRect(s.x + s.w*0.4, GROUND_Y - s.h*0.5, s.w*0.2, s.h*0.5);
    ctx.beginPath();
    ctx.arc(s.x + s.w/2, GROUND_Y - s.h*0.55, s.w*0.5*s.r, 0, TAU);
    ctx.arc(s.x + s.w*0.15, GROUND_Y - s.h*0.3, s.w*0.4*s.r, 0, TAU);
    ctx.arc(s.x + s.w*0.85, GROUND_Y - s.h*0.3, s.w*0.4*s.r, 0, TAU);
    ctx.fill();
  } else if(s.kind === 'hill'){
    ctx.fillStyle = `rgb(${Math.round(240*f)},${Math.round(245*f)},${Math.round(252*f)})`;
    ctx.beginPath(); ctx.ellipse(s.x + s.w/2, GROUND_Y + s.h*0.4, s.w/2, s.h, 0, Math.PI, 0); ctx.fill();
  } else if(s.kind === 'island'){
    ctx.fillStyle = `rgb(${Math.round(40*f)},${Math.round(90*f)},${Math.round(100*f)})`;
    ctx.beginPath(); ctx.ellipse(s.x + s.w/2, GROUND_Y + s.h*0.5, s.w/2, s.h, 0, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillStyle = `rgb(${Math.round(lerp(120,16,nf))},${Math.round(lerp(160,22,nf))},${Math.round(lerp(190,48,nf))})`;
    ctx.fillRect(s.x, GROUND_Y - s.h, s.w, s.h);
    if(nf > 0.3){
      ctx.fillStyle = `rgba(255,214,120,${clamp((nf-0.3)/0.5)*0.9})`;
      for(const w of s.wins) ctx.fillRect(s.x+w.x, GROUND_Y-s.h+w.y, 6, 9);
    }
  }
}

function drawGround(nf){
  const f = lerp(1, 0.5, nf);
  const g = THEMES[theme].ground;
  const gy = labyFloorY;
  ctx.fillStyle = `rgb(${g[0].map(c=>Math.round(c*f))})`;
  ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = `rgb(${g[1].map(c=>Math.round(c*f))})`;
  ctx.fillRect(0, gy, W, 22);
  // moving stripes
  ctx.fillStyle = `rgba(0,0,0,${0.10 + nf*0.1})`;
  for(let x = -48 + (48 - groundX); x < W; x += 48){
    ctx.beginPath();
    ctx.moveTo(x, gy); ctx.lineTo(x+24, gy);
    ctx.lineTo(x+12, gy+22); ctx.lineTo(x-12, gy+22);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(0,0,0,${0.15 + nf*0.15})`;
  ctx.fillRect(0, gy+22, W, 4);
}

function drawCeiling(nf){
  if(labyCeilY <= 0) return;
  const f = lerp(1, 0.5, nf);
  const g = THEMES[theme].ground;
  ctx.fillStyle = `rgb(${g[0].map(c=>Math.round(c*f))})`;
  ctx.fillRect(0, 0, W, labyCeilY);
  ctx.fillStyle = `rgb(${g[1].map(c=>Math.round(c*f))})`;
  ctx.fillRect(0, labyCeilY - 22, W, 22);
  ctx.fillStyle = `rgba(0,0,0,${0.15 + nf*0.15})`;
  ctx.fillRect(0, labyCeilY - 26, W, 4);
}

function drawGlint(c, x, y, r){
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x-r, y); c.lineTo(x+r, y);
  c.moveTo(x, y-r); c.lineTo(x, y+r);
  c.stroke();
  c.restore();
}

function drawBirdBody(c, s, wing, time, shieldOn){
  const bodyC = s.rainbow ? `hsl(${(time*140)%360},85%,60%)` : s.body;
  const wingC = s.rainbow ? `hsl(${(time*140+40)%360},85%,45%)` : s.wing;

  // ---- behind-body decor ----
  if(s.id === 'violet'){
    c.save();
    c.rotate(time*0.8);
    c.strokeStyle = 'rgba(179,136,255,0.85)'; c.lineWidth = 2;
    c.setLineDash([6,5]);
    c.beginPath(); c.arc(0,0,24,0,TAU); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.moveTo(0,0); c.lineTo(0,-21); c.stroke();
    c.restore();
  }
  if(s.id === 'rainbow'){
    for(let i=0;i<5;i++){
      c.strokeStyle = `hsla(${i*70},90%,60%,0.55)`;
      c.lineWidth = 3;
      c.beginPath(); c.arc(0,0,19.5+i*2, Math.PI*0.5, Math.PI*1.5); c.stroke();
    }
  }
  if(s.id === 'phantom'){
    c.save();
    for(let i=1;i<=2;i++){
      c.globalAlpha = 0.45 - i*0.15;
      c.fillStyle = s.body;
      c.beginPath(); c.arc(-21-i*4, Math.sin(time*4+i)*3, 5-i*1.5, 0, TAU); c.fill();
    }
    c.restore();
  }
  if(s.id === 'azure'){
    c.save();
    c.strokeStyle = 'rgba(79,195,247,0.8)'; c.lineWidth = 2;
    for(let i=0;i<3;i++){
      c.globalAlpha = 0.3 + i*0.2;
      const len = 4 + ((time*90 + i*9) % 7);
      c.beginPath(); c.moveTo(-20, -6+i*6); c.lineTo(-20-len, -6+i*6); c.stroke();
    }
    c.restore();
  }
  if(s.id === 'cat'){
    c.save();
    c.strokeStyle = s.wing; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-15, 3);
    c.quadraticCurveTo(-28, 4 + Math.sin(time*3)*3, -31, -12 + Math.sin(time*2.5)*4);
    c.stroke();
    c.restore();
  }
  if(s.id === 'jade' && shieldOn){
    const r = 25 + Math.sin(time*4)*1.5;
    c.strokeStyle = 'rgba(95,224,122,0.9)'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0,0,r,0,TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0,0,r-3,-2.4,-0.7); c.stroke();
  }

  // ---- body ----
  c.fillStyle = bodyC;
  c.beginPath(); c.ellipse(0, 0, 18, 14, 0, 0, TAU); c.fill();
  c.fillStyle = s.belly;
  c.beginPath(); c.ellipse(2, 6, 11, 7, 0, 0, TAU); c.fill();
  c.save();
  c.translate(-6, 0); c.rotate(-0.4 + wing*1.1);
  c.fillStyle = wingC;
  if(s.id === 'demon'){
    c.beginPath();
    c.moveTo(0, -3);
    c.quadraticCurveTo(-8, -16, -17, -11);
    c.quadraticCurveTo(-11, -6, -13, -2);
    c.quadraticCurveTo(-8, -2, -9, 2);
    c.quadraticCurveTo(-4, 2, -4, 7);
    c.quadraticCurveTo(0, 4, 0, -3);
    c.closePath(); c.fill();
  } else {
    c.beginPath(); c.ellipse(0, -4, 10, 6.5, 0, 0, TAU); c.fill();
  }
  c.restore();
  // eye
  c.shadowBlur = 0;
  if(s.id === 'demon'){ c.shadowColor = 'rgba(255,40,40,0.9)'; c.shadowBlur = 8; }
  c.fillStyle = s.id === 'demon' ? '#ff5050' : '#fff';
  c.beginPath(); c.arc(8, -5, 6, 0, TAU); c.fill();
  c.fillStyle = s.id === 'phantom' ? 'rgba(40,60,80,0.9)' : (s.id === 'demon' ? '#2a0000' : '#222');
  c.beginPath(); c.arc(10, -5, 2.8, 0, TAU); c.fill();
  c.shadowBlur = 0;
  // beak
  c.fillStyle = '#ff9d3b';
  c.beginPath();
  if(s.id === 'azure'){ c.moveTo(14, 0); c.lineTo(27, 4); c.lineTo(14, 8); }
  else { c.moveTo(14, 1); c.lineTo(26, 4); c.lineTo(14, 8); }
  c.closePath(); c.fill();

  // ---- front decor ----
  if(s.id === 'crimson'){
    const f = (x, y, w, h, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x-w, y);
      c.quadraticCurveTo(x-w*0.4, y-h*0.7, x+Math.sin(time*8+x)*1.5, y-h);
      c.quadraticCurveTo(x+w*0.4, y-h*0.7, x+w, y);
      c.closePath(); c.fill();
    };
    f(-8, -10, 4, 10, '#ff5d5d'); f(-1, -13, 4.5, 13, '#ff9d3b'); f(6, -10, 4, 10, '#ff5d5d');
    f(-1, -12, 2.5, 8, '#ffd93b');
    f(-16, -4, 4, 9, '#ff5d5d'); f(-18, 3, 3.5, 7, '#ff9d3b');
  }
  if(s.id === 'golden'){
    c.fillStyle = '#ffd700';
    c.beginPath();
    c.moveTo(-8, -12); c.lineTo(-8, -21); c.lineTo(-4, -16); c.lineTo(0, -22); c.lineTo(4, -16); c.lineTo(8, -21); c.lineTo(8, -12);
    c.closePath(); c.fill();
    c.fillStyle = '#ff3b3b';
    c.beginPath(); c.arc(0, -16, 1.8, 0, TAU); c.fill();
    for(let i=0;i<2;i++){
      const a = time*2 + i*Math.PI;
      drawGlint(c, Math.cos(a)*23, Math.sin(a)*16, 3);
    }
  }
  if(s.id === 'rainbow'){
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, -23, 10, 3.5, 0, 0, TAU); c.stroke();
  }
  if(s.id === 'phantom'){
    drawGlint(c, Math.sin(time*3)*6, -19, 2.5);
  }
  if(s.id === 'demon'){
    c.fillStyle = s.wing;
    c.beginPath(); c.moveTo(-6, -11); c.lineTo(-11, -22); c.lineTo(-1, -14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(3, -13); c.lineTo(8, -24); c.lineTo(10, -12); c.closePath(); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(15, 8); c.lineTo(17, 15); c.lineTo(19, 8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(20, 8); c.lineTo(22, 14); c.lineTo(24, 8); c.closePath(); c.fill();
  }
  if(s.id === 'cat'){
    c.fillStyle = s.wing;
    c.beginPath(); c.moveTo(-13,-9); c.lineTo(-17,-25); c.lineTo(-3,-14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(1,-13); c.lineTo(7,-26); c.lineTo(11,-11); c.closePath(); c.fill();
    c.fillStyle = '#ffb3c0';
    c.beginPath(); c.moveTo(-11,-11); c.lineTo(-14,-21); c.lineTo(-5,-13); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(2,-13); c.lineTo(5,-22); c.lineTo(8,-12); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(15,9); c.lineTo(24,7);
    c.moveTo(15,11); c.lineTo(23,13);
    c.stroke();
  }
  if(s.id === 'god'){
    c.strokeStyle = '#ffd700'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, -26, 12, 4, 0, 0, Math.PI*2); c.stroke();
  }
}

function drawBird(x, y, rot, s, wing, scale=1){
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  if(s.ghost) ctx.globalAlpha = 0.7;
  if(rebornT > 0) ctx.globalAlpha = 0.35 + 0.25*Math.sin(t*25);
  if(s.ghost){ ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 14; }
  if(s.id === 'demon'){ ctx.shadowColor = 'rgba(255,40,40,0.7)'; ctx.shadowBlur = 12; }
  if(s.id === 'god'){ ctx.shadowColor = 'rgba(255,215,0,0.8)'; ctx.shadowBlur = 16; }
  drawBirdBody(ctx, s, wing, t, shield > 0);
  ctx.restore();
}

