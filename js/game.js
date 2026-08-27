'use strict';
/* ================= canvas ================= */
const canvas = $('#game'), ctx = canvas.getContext('2d');
const W = 480, H = 800;
function resize(){
  const scale = Math.min(innerWidth/W, innerHeight/H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width  = (W*scale)+'px';
  canvas.style.height = (H*scale)+'px';
  canvas.width  = Math.round(W*scale*dpr);
  canvas.height = Math.round(H*scale*dpr);
  ctx.setTransform(scale*dpr, 0, 0, scale*dpr, 0, 0);
}
addEventListener('resize', resize); resize();

/* ================= world data ================= */
const GROUND_H = 110, GROUND_Y = H - GROUND_H;
const BIRD_X = 150, BIRD_R = 15;
const DAY_LEN = 120; // seconds per full day/night cycle

const stars = [];
for(let i=0;i<90;i++) stars.push({ x:Math.random()*W, y:Math.random()*H*0.55, s:rand(0.6,1.8), tw:rand(0,TAU) });

const clouds = [];
for(let i=0;i<7;i++) clouds.push({ x:Math.random()*W, y:rand(60,300), s:rand(0.6,1.4), spd:rand(8,20) });

const THEMES = {
  city:   { skyTop:[[70,150,215],[8,10,35]],   skyBot:[[140,215,255],[30,40,80]],   ground:[[224,192,132],[115,199,62]] },
  forest: { skyTop:[[95,175,150],[10,25,22]],   skyBot:[[180,228,180],[28,58,44]],   ground:[[150,118,74],[92,178,60]] },
  desert: { skyTop:[[255,185,115],[45,22,55]],  skyBot:[[255,228,165],[72,46,74]],   ground:[[232,202,132],[202,162,92]] },
  snow:   { skyTop:[[172,202,232],[16,22,42]],  skyBot:[[232,242,255],[42,52,82]],   ground:[[236,242,252],[202,216,236]] },
  ocean:  { skyTop:[[62,162,222],[10,22,52]],   skyBot:[[152,222,242],[32,52,92]],   ground:[[232,216,162],[192,172,122]] },
};
const THEME_LIST = Object.keys(THEMES);
let theme = 'city';
let silhouettes = [], silW = W*2, fxParts = [];

function setTheme(name){
  theme = name;
  silhouettes = []; fxParts = [];
  let x = 0;
  if(name === 'city'){
    while(x < W*2){
      const w = rand(42,92), h = rand(110,320);
      const wins = [];
      for(let wy=14; wy<h-10; wy+=26)
        for(let wx=6; wx<w-10; wx+=18)
          if(Math.random()<0.5) wins.push({x:wx, y:wy});
      silhouettes.push({x, w, h, wins});
      x += w + rand(4,14);
    }
  } else if(name === 'forest'){
    while(x < W*2){
      silhouettes.push({x, w:rand(34,64), h:rand(90,260), kind:'tree', r:rand(0.7,1.3)});
      x += rand(42,84);
    }
  } else if(name === 'desert'){
    while(x < W*2){
      silhouettes.push({x, w:rand(120,260), h:rand(40,110), kind:'dune'});
      x += rand(90,190);
    }
    for(let i=0;i<6;i++) silhouettes.push({x:Math.random()*W*2, w:rand(14,22), h:rand(50,90), kind:'cactus'});
    for(let i=0;i<10;i++) fxParts.push({ x:Math.random()*W, y:Math.random()*GROUND_Y*0.8, p:rand(0,TAU) });
  } else if(name === 'snow'){
    while(x < W*2){
      silhouettes.push({x, w:rand(140,300), h:rand(50,140), kind:'hill'});
      x += rand(120,240);
    }
    for(let i=0;i<40;i++) fxParts.push({ x:Math.random()*W, y:Math.random()*H, s:rand(1.5,3.5), spd:rand(25,55), drift:rand(-15,15) });
  } else if(name === 'ocean'){
    for(let i=0;i<5;i++) silhouettes.push({x:Math.random()*W*2, w:rand(60,140), h:rand(30,70), kind:'island'});
  }
  silW = Math.max(W*2, ...silhouettes.map(s => s.x + s.w));
}
function randomTheme(){
  const pool = THEME_LIST.filter(n => n !== theme);
  return pool[Math.floor(Math.random()*pool.length)];
}
setTheme('city');

const fireflies = [];
for(let i=0;i<14;i++) fireflies.push({ x:Math.random()*W, y:rand(GROUND_Y-160, GROUND_Y-20), p:rand(0,TAU) });

/* ================= game state ================= */
let state = 'menu';           // menu | ready | play | dead
let paused = false;
let t = 0;                    // global clock (drives day/night)
let bird = { y:H*0.45, vy:0, rot:0, wing:0 };
let pipes = [];
let particles = [];
let popups = [];
let trail = [];
let score = 0;
let shield = 0, revive = 0, invuln = 0, rebornT = 0, rollT = 0, rollSpin = 0, nextMoverAt = 0;
let combo = 0, feverT = 0, feverNextAt = 30;
let shake = 0, flash = 0;
let groundX = 0;
let labyFloorY = GROUND_Y, labyCeilY = -100;
let deathTimer = 0, overShown = false;
let nextMusicSwitch = 0;

function nightFactor(){
  const dayT = (t % DAY_LEN) / DAY_LEN;
  return (1 - Math.cos(TAU*dayT)) / 2;   // 0 = noon, 1 = midnight
}

function reset(){
  bird = { y:H*0.45, vy:0, rot:0, wing:0 };
  pipes = []; particles = []; popups = []; trail = [];
  score = 0; shake = 0; flash = 0;
  combo = 0; feverT = 0;
  const pw = powers();
  shield = pw.shield; revive = pw.revive + (hasRelic('phoenix') ? 1 : 0); invuln = 0; rebornT = 0; rollT = 0; rollSpin = 0;
  nextMoverAt = t + rand(10,15);
  nextMusicSwitch = t + rand(20,35);
  deathTimer = 0; overShown = false;
  if(mode === 'rl'){
    resetRun();
    const m = mods();
    shield = m.shield;
    feverNextAt = m.feverEvery;
    refreshRlHud();
  } else {
    feverNextAt = 30;
    show('#rlHud', false);
  }
  $('#score').textContent = '0';
  refreshPowerTag();
}

let themeNextAt = 10;
function startGame(){
  reset();
  setTheme('city'); themeNextAt = 10;
  state = 'ready';
  show('#menu', false); show('#gameover', false); show('#hud', true);
  if(mode === 'rl'){ map = genMap(1); showMap(); }
  if(AudioFX.ctx) AudioFX.startMusic(AudioFX.randomTrack());
}

function flap(){
  if(state === 'ready'){ state = 'play'; }
  if(state !== 'play') return;
  bird.vy = -400;
  bird.wing = 1;
  AudioFX.flap();
  for(let i=0;i<6;i++) particles.push({
    x:BIRD_X-8, y:bird.y+10, vx:rand(-60,-20), vy:rand(20,90),
    life:rand(0.25,0.45), max:0.45, size:rand(2,5), color:'rgba(255,255,255,0.8)'
  });
}

function die(){
  state = 'dead';
  shake = 14; flash = 1;
  AudioFX.hit(); AudioFX.die();
  AudioFX.stopMusic();
  const s = skinById(save.selected);
  for(let i=0;i<34;i++) particles.push({
    x:BIRD_X, y:bird.y, vx:rand(-220,220), vy:rand(-260,120),
    life:rand(0.5,1.1), max:1.1, size:rand(2,6), color:s.body || '#fff'
  });
}

function showGameover(){
  overShown = true;
  const isRecord = score > save.best;
  if(isRecord) save.best = score;
  if(mode === 'rl' && run){
    save.rl.bestStage = Math.max(save.rl.bestStage, run.stage);
    save.rl.bestPipes = Math.max(save.rl.bestPipes, run.totalPipes);
    $('#rlStats').textContent = T('rlStats').replace('{p}', run.path).replace('{s}', run.stage).replace('{r}', pathCfg().rows).replace('{n}', run.totalPipes).replace('{g}', run.gold);
    $('#rlStats').classList.remove('hidden');
  } else {
    $('#rlStats').classList.add('hidden');
  }
  persist();
  $('#finalScore').textContent = score;
  $('#bestScore').textContent = save.best;
  $('#newRecord').classList.toggle('hidden', !isRecord);
  const mm = mode === 'rl' ? 10 : 1;
  const medal =
    score>=50*mm ? {n:'diamond', c:'#7ee8f2'} :
    score>=40*mm ? {n:'platinum', c:'#cfd6dd'} :
    score>=30*mm ? {n:'gold', c:'#ffd700'} :
    score>=20*mm ? {n:'silver', c:'#c0c8d0'} :
    score>=10*mm ? {n:'bronze', c:'#cd7f32'} : null;
  const m = $('#medal');
  if(medal){
    m.textContent = T(medal.n);
    m.style.background = `radial-gradient(circle at 35% 30%, #fff, ${medal.c} 55%, rgba(0,0,0,.25))`;
  } else { m.textContent = T('noMedal'); m.style.background = 'rgba(255,255,255,.15)'; }
  show('#gameover', true);
  AudioFX.startMusic('gameover');
  checkUnlocks();
}

function checkUnlocks(){
  for(const s of SKINS){
    if(save.total >= s.unlock && !save.unlocked.includes(s.id)){
      save.unlocked.push(s.id);
      persist();
      showToast(T('skinUnlocked').replace('{n}', s.name));
      AudioFX.unlock();
      buildShop();
    }
  }
}

/* ================= update ================= */
function pipeSpeed(){
  const base = (140 + Math.min(score,40)*1.5) * (feverT > 0 ? 1.3 : 1);
  if(mode==='rl' && run) return base + 12*(run.stage-1) + (run.path === 2 ? 14 : 0);
  return base;
}
function pipeGap(){
  if(mode==='rl' && run){
    const p2 = run.path === 2;
    return Math.max(p2 ? 95 : 105, 170 - (run.stage-1)*(p2 ? 9 : 7) - score*0.3);
  }
  return Math.max(115, 160 - score*1.5);
}

function update(dt){
  t += dt;
  const nf = nightFactor();

  // clouds / fireflies
  for(const c of clouds){ c.x -= c.spd*dt; if(c.x < -160) { c.x = W+160; c.y = rand(60,300); } }
  for(const f of fireflies){ f.p += dt; f.x += Math.sin(f.p*1.3)*30*dt; f.y += Math.cos(f.p*0.9)*22*dt; }

  // theme particles
  if(theme === 'snow'){
    for(const s of fxParts){
      s.y += s.spd*dt; s.x += s.drift*dt;
      if(s.y > GROUND_Y){ s.y = -5; s.x = Math.random()*W; }
      if(s.x < -5) s.x = W+5; else if(s.x > W+5) s.x = -5;
    }
  } else if(theme === 'desert'){
    for(const d of fxParts){
      d.x -= (40 + 20*Math.sin(t*3 + d.p))*dt;
      if(d.x < -5){ d.x = W+5; d.y = Math.random()*GROUND_Y*0.8; }
    }
  }

  // particles / popups / trail
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 500*dt;
    if(p.life <= 0) particles.splice(i,1);
  }
  for(let i=popups.length-1;i>=0;i--){
    const p = popups[i]; p.life -= dt; p.y -= 40*dt;
    if(p.life <= 0) popups.splice(i,1);
  }
  for(let i=trail.length-1;i>=0;i--){ trail[i].life -= dt; if(trail[i].life<=0) trail.splice(i,1); }

  shake = Math.max(0, shake - dt*30);
  flash = Math.max(0, flash - dt*2.5);
  invuln = Math.max(0, invuln - dt);
  rollT = Math.max(0, rollT - dt);
  feverT = Math.max(0, feverT - dt);
  refreshComboTag();
  const pw = (mode==='rl' && run) ? mods() : powers();

  if(state === 'ready'){
    bird.y = H*0.45 + Math.sin(t*3)*9;
    bird.rot = Math.sin(t*3+0.5)*0.08;
    bird.wing = Math.sin(t*8)*0.5+0.5;
    groundX = (groundX + 60*dt) % 48;
  }
  else if(state === 'play'){
    if(stageClearT > 0 && rebornT <= 0){
      bird.y = H*0.45 + Math.sin(t*3)*9;
      bird.rot = Math.sin(t*3+0.5)*0.08;
      bird.wing = Math.sin(t*8)*0.5+0.5;
    } else {
      let windG = 1;
      if(run && run.boss){
        const wphs = run.boss.def.phases;
        const widx = Math.min(wphs.length-1, Math.floor(run.boss.passes * wphs.length / run.boss.max));
        if(wphs[widx].pattern === 'wind') windG = wphs[widx].g || 1.2;
      }
      bird.vy = Math.min(700, bird.vy + 1400*pw.grav*windG*dt);
      bird.y += bird.vy*dt;
      bird.rot += (clamp(bird.vy/500, -0.35, 0.9) - bird.rot)*Math.min(1, dt*8);
      bird.wing = Math.max(0, bird.wing - dt*3);
    }
    trail.push({ x:BIRD_X, y:bird.y, life:0.4, max:0.4 });

    if(rollT > 0){
      rollSpin += dt*24;
      if(Math.random() < 0.6) particles.push({
        x:BIRD_X+rand(-12,12), y:bird.y+rand(-12,12), vx:rand(-90,-30), vy:rand(-50,50),
        life:rand(0.2,0.4), max:0.4, size:rand(2,4), color:'rgba(255,71,88,0.6)'
      });
    }
    if(rebornT > 0){
      rebornT -= dt;
      if(rebornT <= 0){
        bird.y = H*0.45; bird.vy = 0; bird.rot = 0;
        invuln = 2.5; flash = 0.5;
        pipes = pipes.filter(q => q.x < BIRD_X-260 || q.x > BIRD_X+260);
        popups.push({ x:BIRD_X, y:bird.y-34, txt:T('again'), life:0.9, max:0.9 });
        AudioFX.unlock();
      }
    }

    groundX = (groundX + pipeSpeed()*pw.speed*dt) % 48;

    // stage clear pause (roguelike)
    if(stageClearT > 0){
      stageClearT -= dt;
      if(stageClearT <= 0) openDraft(rollCards());
    }

    // spawn pipes
    const last = pipes[pipes.length-1];
    if(mode==='rl' && run.boss){
      if(!pipes.some(p => p.boss)){
        const bg = pipeGap();
        pipes.push({ x:W+40, gapY:345, baseY:345, gap:bg, baseGap:bg, passed:false, boss:true, spear:run.boss.final });
      }
    } else if(stageClearT <= 0 && (!last || last.x < W - (mode==='rl' && run.path === 2 ? 193 : 240))){
      if(mode==='rl' && run.stage >= 2 && Math.random() < Math.min(0.12 + run.stage*0.04, 0.35)){
        pipes.push({ x:W+40, gapY:rand(150, GROUND_Y-150), gap:pipeGap()+40, passed:false, spear:true });
      } else if(mode==='rl' && run.stage >= 3 && Math.random() < Math.min(0.02 + run.stage*0.03, 0.35)){
        const hg = pipeGap()+40;
        pipes.push({ x:W+40, gapY:rand(150, GROUND_Y-150), gap:hg, baseGap:hg, passed:false, hammer:true, phase:rand(0,TAU), spd:rand(1.4,2.2) });
      } else if(t >= nextMoverAt){
        nextMoverAt = t + rand(10,15);
        const amp = rand(28,42), base = rand(150+amp, GROUND_Y-150-amp);
        pipes.push({ x:W+40, gapY:base, base, gap:pipeGap(), passed:false, move:true, phase:rand(0,TAU), spd:rand(0.8,1.4), amp });
      } else
        pipes.push({ x:W+40, gapY:rand(150, GROUND_Y-150), gap:pipeGap(), passed:false });
    }

    for(const p of pipes) p.x -= pipeSpeed()*pw.speed*dt;
    for(const p of pipes) if(p.move) p.gapY = p.base + Math.sin(t*p.spd + p.phase)*p.amp;
    for(const p of pipes) if(p.hammer){
      p.gap = Math.max(0, p.baseGap * (0.5 + 0.5*Math.cos(t*p.spd + p.phase)));
      if(p.gap < 10 && !p.slammed && p.x < W && p.x > -80){
        p.slammed = true;
        shake = Math.max(shake, 8);
        AudioFX.boom();
      }
      if(p.gap > p.baseGap*0.5) p.slammed = false;
    }
    labyFloorY = GROUND_Y; labyCeilY = -100;
    if(run && run.boss){
      const phs = run.boss.def.phases;
      const pidx = Math.min(phs.length-1, Math.floor(run.boss.passes * phs.length / run.boss.max));
      const pph = phs[pidx];
      if(pph.pattern === 'labyrinth'){
        if(!run.boss.labyOn){ run.boss.labyT = 0; run.boss.labyOn = true; }
        run.boss.labyT += dt;
        const s = 0.5 - 0.5*Math.cos(run.boss.labyT * (pph.spd || 2.6));
        const a = pph.amp || 240;
        labyFloorY = GROUND_Y - a*s;
        labyCeilY = a*s;
      } else run.boss.labyOn = false;
    }
    for(const p of pipes) if(p.boss && run.boss){
      const b = run.boss, ph = b.def.phases;
      const idx = Math.min(ph.length-1, Math.floor(b.passes * ph.length / b.max));
      if(idx !== b.phaseIdx){
        b.phaseIdx = idx;
        p.gap = p.baseGap; p.pulseT = 0; p.blinkTo = null;
        flash = 0.5; shake = 12; AudioFX.scream();
        popups.push({ x:BIRD_X, y:bird.y-60, txt:T('phase') + ' ' + (idx+1) + '/' + ph.length, life:1.2, max:1.2 });
      }
      const ph2 = ph[idx];
      p.blinking = false;
      p.ghostY = null;
      if(ph2.pattern === 'chase'){
        p.gapY += (bird.y - p.gapY) * Math.min(1, ph2.rate * dt);
      } else if(ph2.pattern === 'squeeze'){
        p.pulseT = (p.pulseT || 0) + dt;
        const s = 0.5 - 0.5*Math.cos(p.pulseT * ph2.spd);
        p.gap = Math.max(60, p.baseGap * (1 - 0.45*s));
        p.gapY = p.baseY + Math.sin(t*0.7)*30;
      } else if(ph2.pattern === 'zigzag'){
        p.pulseT = (p.pulseT || 0) + dt;
        p.gapY = p.baseY + (Math.asin(Math.sin(p.pulseT*ph2.spd)) * (2/Math.PI)) * (ph2.amp || 110);
      } else if(ph2.pattern === 'hunt'){
        p.pulseT = (p.pulseT || 0) + dt;
        p.gapY += (bird.y - p.gapY) * Math.min(1, (ph2.rate || 1.2) * dt);
        p.gapY += Math.sin(p.pulseT * (ph2.rate || 1.2) * 3) * (ph2.amp || 90) * dt;
        p.gapY = Math.max(70, Math.min(GROUND_Y - 70, p.gapY));
      } else if(ph2.pattern === 'pulse'){
        p.pulseT = (p.pulseT || 0) + dt;
        p.gap = Math.max(70, p.baseGap * (1 + 0.35*Math.sin(p.pulseT*ph2.spd)));
        p.gapY = p.baseY + Math.sin(t*0.9)*40;
      } else if(ph2.pattern === 'step'){
        if(p.stepT == null){ p.stepT = 0; p.stepFrom = p.gapY; p.stepTo = p.gapY; }
        p.stepT += dt;
        const siv = ph2.spd || 1.5, st = ph2.tele || 0.4;
        if(p.stepT >= siv){ p.stepT = 0; p.stepFrom = p.gapY; p.stepTo = rand(70, GROUND_Y-70); }
        const srem = siv - p.stepT;
        if(srem < st){ const k = 1 - srem/st; p.gapY = p.stepFrom + (p.stepTo - p.stepFrom)*k + Math.sin(t*30)*5*(1-k); }
        else p.gapY = p.stepFrom;
        p.ghostY = srem < st ? p.stepTo : null;
      } else if(ph2.pattern === 'mirror'){
        const mty = Math.max(70, Math.min(GROUND_Y - 70, GROUND_Y - bird.y));
        p.gapY += (mty - p.gapY) * Math.min(1, (ph2.rate || 1.0) * dt * 2);
      } else if(ph2.pattern === 'shrink'){
        p.pulseT = (p.pulseT || 0) + dt;
        p.gap = Math.max(70, p.baseGap * (1 - (ph2.rate || 0.06) * p.pulseT));
        p.gapY = p.baseY + Math.sin(t*0.5)*20;
      } else if(ph2.pattern === 'blink'){
        if(p.blinkT == null) p.blinkT = 0;
        p.blinkT += dt;
        const biv = ph2.spd || 1.2, bt = ph2.tele || 0.35;
        if(p.blinkT >= biv){ p.blinkT = 0; p.gapY = p.blinkTo != null ? p.blinkTo : rand(70, GROUND_Y-70); p.blinkTo = null; }
        p.blinking = p.blinkT > biv - bt;
        if(p.blinkTo == null) p.blinkTo = rand(70, GROUND_Y-70);
        p.ghostY = p.blinkTo;
      } else if(ph2.pattern === 'drift'){
        if(p.driftDir == null) p.driftDir = Math.random() < 0.5 ? 1 : -1;
        p.gapY += p.driftDir * (ph2.spd || 60) * dt;
        if(p.gapY < 70){ p.gapY = 70; p.driftDir = 1; }
        else if(p.gapY > GROUND_Y - 70){ p.gapY = GROUND_Y - 70; p.driftDir = -1; }
      } else if(ph2.pattern === 'labyrinth'){
        p.pulseT = (p.pulseT || 0) + dt;
        p.gapY += ((labyCeilY + labyFloorY)/2 - p.gapY) * Math.min(1, dt*2.5);
        p.gap = Math.max(70, p.baseGap * (1 + 0.3*Math.sin(p.pulseT*(ph2.bspd || 1.7))));
      } else {
        p.gapY = p.baseY + (ph2.amp ? Math.sin(t*(ph2.spd || 2.2))*ph2.amp : 0);
      }
    }
    const mag = (mode==='rl' && run ? run.upgrades.filter(u=>u==='magnet').length : 0) + pw.magnet + (hasRelic('anchor') ? 2 : 0);
    if(mag) for(const p of pipes){
      if(p.boss) continue;
      const rate = Math.min(0.3*mag, 0.9);
      if(p.move) p.base += (bird.y - p.base)*rate*dt;
      else p.gapY += (bird.y - p.gapY)*rate*dt;
    }
    while(pipes.length && pipes[0].x < -90) pipes.shift();

   // stage progression (roguelike)
    if(mode==='rl' && !run.boss && run.pipesInStage >= 18 && stageClearT <= 0){
      run.pipesInStage = 0;
      run.gold += 10;
      stageClearT = 1.2;
      pipes = [];
      flash = 0.4;
      popups.push({ x:BIRD_X, y:bird.y-50, txt:T('stageExcl').replace('{n}', run.stage), life:1.2, max:1.2 });
      AudioFX.unlock();
      refreshRlHud();
    }

    // scoring + near-miss combo
    let scored = false;
    for(const p of pipes){
      if(!p.passed && p.x + 70 < BIRD_X && rebornT <= 0){
        p.passed = true;
       if(p.boss){
          run.boss.passes++;
          const def = run.boss.def;
          if(run.boss.passes >= run.boss.max){
                const isFinal = run.boss.final;
                const isElite = run.boss.elite;
                const isLaby = run.boss.labyrinth;
                run.boss = null;
                flash = 0.5;
                AudioFX.unlock();
               if(isFinal){
                  showVictory();
                } else if(isElite || isLaby){
                  const gold = isLaby ? 25 : 20;
                  run.gold += gold;
                  const pool = isLaby ? RELICS2 : relicPool();
                  const missing = pool.filter(x => !run.relics.includes(x.id));
                  const r = missing.length ? missing[Math.floor(Math.random()*missing.length)] : null;
                  if(r) gainRelic(r.id); else run.gold += 15;
                  stageClearT = 1.5;
                   pipes = [];
                  popups.push({ x:BIRD_X, y:bird.y-50, txt:def.name + ' DEFEATED! +' + gold + 'g', life:1.5, max:1.5 });
                  popups.push({ x:BIRD_X, y:bird.y-76, txt: r ? (r.icon||'') + ' ' + r.name + '!' : '+15 gold', life:1.5, max:1.5 });
                  refreshRlHud();
                } else {
                  const pool = LEGENDS.filter(l => !run.legends.includes(l.id));
                  if(Math.random() < 0.2 && pool.length){
                    const l = pool[Math.floor(Math.random()*pool.length)];
                    run.legends.push(l.id);
                    showReveal(l.icon, legendInfo(l.id).name, legendInfo(l.id).desc, true);
                    AudioFX.legendary();
                  } else {
                    const gold = 25 + Math.floor(Math.random()*21);
                    run.gold += gold;
                    showReveal('🪙', '+' + gold + ' GOLD', '', false);
                    AudioFX.reveal();
                  }
                  stageClearT = 1.5;
                   pipes = [];
                  popups.push({ x:BIRD_X, y:bird.y-50, txt:def.name + ' DEFEATED!', life:1.5, max:1.5 });
                  refreshRlHud();
                }
             } else {
            popups.push({ x:p.x+35, y:p.gapY, txt:T('pass') + ' ' + run.boss.passes + '/' + run.boss.max, life:0.8, max:0.8 });
            AudioFX.score();
          }
          continue;
        }
        scored = true;
        const topEdge = p.gapY - p.gap/2, botEdge = p.gapY + p.gap/2;
        const clearance = Math.min(bird.y - topEdge, botEdge - bird.y) - pw.radius;
        const near = clearance < 14;
        combo = near ? combo + 1 : 0;
        const mult = Math.min(combo + 1, 4);
        const gained = (pw.mult + (pw.bonus||0)) * mult * (feverT > 0 ? 2 : 1);
        score += gained; save.total += gained;
        if(mode==='classic' && score >= themeNextAt){
          setTheme(randomTheme()); themeNextAt += 10;
          popups.push({ x:p.x+35, y:p.gapY-26, txt:theme.toUpperCase()+'!', life:0.9, max:0.9 });
        }
        $('#score').textContent = score;
        AudioFX.score();
        popups.push({ x:p.x+35, y:p.gapY, txt: near ? T('closeCall') + ' +' + gained : '+'+gained, life:0.7, max:0.7 });
        if(mode==='rl'){
          run.pipesInStage++; run.totalPipes++;
          run.gold += 1 + 2*run.upgrades.filter(u=>u==='greed').length + (near ? 2 : 0) + (hasRelic('coin') ? 1 : 0) + (near && hasRelic('echo') ? 3 : 0);
          const vampMax = run.upgrades.filter(x => x === 'vampire').length;
          if(near && run.vampUsed < vampMax && run.hp < mods().maxHp){
            run.vampUsed++; run.hp++;
            popups.push({ x:p.x+35, y:p.gapY-26, txt:T('plusHp'), life:0.7, max:0.7 });
          }
          if(near && hasLegend('bloodpact') && run.bloodUsed < 1 && run.hp < mods().maxHp){
            run.bloodUsed++;
            run.hp = Math.min(run.hp + 2, mods().maxHp);
            run.gold = Math.max(0, run.gold - 5);
            popups.push({ x:p.x+35, y:p.gapY-40, txt: lang === 'pt' ? '🩸 +2 PV -5g' : '🩸 +2 HP -5g', life:0.7, max:0.7 });
          }
          if(hasLegend('phaseshift')){
            run.phaseCount++;
            if(run.phaseCount >= 20){
              run.phaseCount = 0;
              invuln = Math.max(invuln, 3);
              popups.push({ x:p.x+35, y:p.gapY-52, txt:'🌀 PHASE SHIFT!', life:1.0, max:1.0 });
              AudioFX.reveal();
            }
          }
          refreshRlHud();
        }
        for(let i=0;i<10;i++) particles.push({
          x:p.x+35, y:p.gapY, vx:rand(-90,90), vy:rand(-140,60),
          life:rand(0.3,0.6), max:0.6, size:rand(2,4), color:'#ffd93b'
        });
        checkUnlocks();
      }
    }
    if(scored && score >= feverNextAt){
      feverNextAt += hasRelic('void') ? Math.min(15, mods().feverEvery) : mods().feverEvery;
      feverT = (hasRelic('golden') ? 15 : 10) * (hasUpgrade('storm') ? 2 : 1); flash = 0.5;
      AudioFX.startMusic(AudioFX.randomFever());
      popups.push({ x:BIRD_X, y:bird.y-50, txt:T('fever'), life:1.0, max:1.0 });
    }
    // collision (circle vs rects)
    if(rebornT <= 0 && invuln <= 0){
      for(const p of pipes){
        if(p.hit) continue;
        const topH = p.gapY - p.gap/2, botY = p.gapY + p.gap/2;
        const cTop = Math.max(0, labyCeilY), cBot = Math.min(GROUND_Y, labyFloorY);
        if(circleRect(BIRD_X, bird.y, pw.radius, p.x, cTop, 70, Math.max(0, topH - cTop)) ||
           circleRect(BIRD_X, bird.y, pw.radius, p.x, botY, 70, Math.max(0, cBot - botY))){
          if(shield > 0){
            shield--; invuln = 1.5; flash = 0.6;
            pipes.splice(pipes.indexOf(p), 1);
            popups.push({ x:BIRD_X, y:bird.y-34, txt:T('shieldTxt'), life:0.8, max:0.8 });
            AudioFX.score();
            refreshPowerTag();
            refreshRlHud();
          } else if(revive > 0){
             revive--; rebornT = 1.1;
             bird.vy = -180;
             flash = 1; shake = 8;
             popups.push({ x:BIRD_X, y:bird.y-34, txt:T('rebornTxt'), life:1.1, max:1.1 });
             AudioFX.hit(); AudioFX.die();
             refreshPowerTag();
           } else if(pw.roll > 0 && Math.random() < pw.roll){
             rollT = 0.9; rollSpin = 0; invuln = 0.9;
             bird.vy = -250;
             flash = 0.4; shake = 5;
             p.hit = true;
             popups.push({ x:BIRD_X, y:bird.y-34, txt:T('rollTxt'), life:0.9, max:0.9 });
             AudioFX.flap(); AudioFX.score();
             refreshPowerTag();
             refreshRlHud();
           } else if(mode === 'rl' && run){
            const dmg = p.spear ? 2 : 1;
            run.hp -= dmg;
            if(run.hp <= 0){
              die();
            } else {
              invuln = 2; bird.vy = -250;
              flash = 0.6; shake = 8;
              p.hit = true;
              popups.push({ x:BIRD_X, y:bird.y-34, txt:T('minusHp').replace('{n}', dmg), life:0.8, max:0.8 });
              AudioFX.hit();
              refreshRlHud();
            }
          } else {
            die();
          }
          break;
        }
      }
    }
    if(bird.y + pw.radius >= labyFloorY){ bird.y = labyFloorY - pw.radius; if(pw.god){ invuln = 1.5; bird.vy = -300; } else if(rebornT <= 0) die(); }
    if(bird.y - pw.radius < labyCeilY){ bird.y = labyCeilY + pw.radius; if(pw.god){ invuln = 1.5; bird.vy = 300; } else if(rebornT <= 0) die(); }
    else if(bird.y - pw.radius < 0){ bird.y = pw.radius; bird.vy = 0; }
  }
  else if(state === 'dead'){
    labyFloorY = GROUND_Y; labyCeilY = -100;
    bird.vy = Math.min(700, bird.vy + 1400*pw.grav*dt);
    bird.y += bird.vy*dt;
    bird.rot += (1.4 - bird.rot)*Math.min(1, dt*6);
    if(bird.y + BIRD_R >= GROUND_Y){ bird.y = GROUND_Y - BIRD_R; bird.vy = 0; }
    deathTimer += dt;
    if(deathTimer > 0.7 && !overShown) showGameover();
  }

  // music varies during the run (faster switches during fever, from the fever pool)
  if((state==='ready'||state==='play') && t >= nextMusicSwitch){
    const pool = feverT > 0 ? AudioFX.FEVER_POOL : AudioFX.POOL;
    nextMusicSwitch = t + (feverT > 0 ? rand(6,10) : rand(25,40));
    let next = pool[Math.floor(Math.random()*pool.length)];
    while(next === AudioFX.mode) next = pool[Math.floor(Math.random()*pool.length)];
    AudioFX.startMusic(next);
  }
 }

