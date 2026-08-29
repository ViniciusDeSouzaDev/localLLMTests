'use strict';
/* ================= UI ================= */
function show(sel, on){ $(sel).classList.toggle('hidden', !on); }

function showToast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>el.classList.add('hidden'), 2600);
}

function fmtTime(sec){
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
function refreshStats(){
  $('#menuBest').textContent = 'S'+save.rl.bestStage+' • '+save.rl.bestPipes+'p';
  $('#menuTotal').textContent = save.total;
  $('#menuTime').textContent = fmtTime(save.playTime);
   $('#muteBtn').textContent = save.muted ? 'OFF' : 'SND';
  const s = skinById(save.selected);
  $('#menuPower').textContent = T('power') + ': ' + (s.power ? s.powerName + ' — ' + s.powerDesc : T('none'));
}

function refreshPowerTag(){
  const s = skinById(save.selected);
  let txt = s.power ? s.powerName.toUpperCase() : T('noPower');
  if(shield > 0) txt += ' • ' + T('shieldReady');
  if(revive > 0) txt += ' • ' + T('rebornReady');
  $('#powerTag').textContent = txt;
}

function refreshComboTag(){
  const parts = [];
  if(feverT > 0) parts.push(T('fever'));
  if(combo >= 1) parts.push('x' + Math.min(combo+1,4) + ' ' + T('combo'));
  $('#comboTag').textContent = parts.join('  ');
}

const canHover = matchMedia('(hover:hover)').matches;
let tipCard = null, suppressClick = false;
const tooltip = $('#tooltip');
function showTip(card, name, desc){
  tipCard = card;
  tooltip.innerHTML = `<span class="ttName">${name.toUpperCase()}</span><br>${desc}`;
  const r = card.getBoundingClientRect();
  tooltip.style.left = clamp(r.left + r.width/2, 115, innerWidth-115) + 'px';
  tooltip.style.top = (r.top > 120 ? r.top - 8 : r.bottom + 10) + 'px';
  tooltip.classList.add('show');
}
function hideTip(){ tooltip.classList.remove('show'); tipCard = null; }

function buildShop(){
  hideTip();
  const grid = $('#skinGrid');
  grid.innerHTML = '';
  for(const s of SKINS){
    const unlocked = s.id === 'alien' ? !!save.punishmentCleared : save.unlocked.includes(s.id);
    const card = document.createElement('div');
    card.className = 'skinCard' + (unlocked ? '' : ' locked') + (save.selected===s.id ? ' selected' : '');
    const cv = document.createElement('canvas');
    cv.width = 80; cv.height = 80;
    const c2 = cv.getContext('2d');
    c2.setTransform(1.45,0,0,1.45,40,40);
    drawBirdPreview(c2, s);
    const name = document.createElement('div'); name.className='skinName'; name.textContent = s.name;
    const pow = document.createElement('div'); pow.className='skinPower';
    pow.textContent = s.power ? s.powerName : T('noPowerDesc');
    const req = document.createElement('div'); req.className='skinReq';
    req.textContent = unlocked ? (save.selected===s.id ? T('selected') : T('tapToWear')) : (s.id === 'alien' ? T('alienReq') : T('unlockAt').replace('{n}', s.unlock));
    card.append(cv, name, pow, req);
    if(canHover){
      card.addEventListener('mouseenter', () => showTip(card, s.name, s.power ? s.powerName + ' — ' + s.powerDesc : T('noPowerDesc')));
      card.addEventListener('mouseleave', hideTip);
    } else {
      card.addEventListener('touchstart', () => {
        if(tipCard === card) hideTip();
        else { showTip(card, s); suppressClick = true; setTimeout(()=>suppressClick=false, 400); }
      }, { passive:true });
    }
    card.addEventListener('click', () => {
      if(suppressClick){ suppressClick = false; return; }
      AudioFX.init(); AudioFX.click();
      if(!unlocked){
        if(s.id === 'alien'){ showToast(T('alienReq')); return; }
        if(save.total >= s.unlock){ save.unlocked.push(s.id); persist(); buildShop(); }
        else { showToast(T('reachUnlock').replace('{n}', s.unlock).replace('{s}', s.name)); }
        return;
      }
      save.selected = s.id; persist();
      buildShop(); refreshStats();
    });
    grid.appendChild(card);
  }
}

function drawBirdPreview(c, s){
  c.save();
  if(s.ghost) c.globalAlpha = 0.75;
  drawBirdBody(c, s, 0.5, 0, true);
  c.restore();
}

function drawMenuBird(){
  const cv = $('#menuBird'), c2 = cv.getContext('2d');
  c2.clearRect(0,0,100,100);
  c2.save(); c2.translate(50,50); c2.scale(1.6,1.6);
  const s = skinById(save.selected);
  const wing = Math.sin(t*6)*0.5+0.5;
  if(s.ghost) c2.globalAlpha = 0.75;
  drawBirdBody(c2, s, wing, t, true);
  c2.restore();
}

function drawSkinPrev(){
  const cv = $('#skinPrev'), c2 = cv.getContext('2d');
  c2.clearRect(0,0,56,56);
  c2.save(); c2.translate(28,28); c2.scale(0.85,0.85);
  const s = skinById(save.selected);
  const wing = Math.sin(t*6)*0.5+0.5;
  if(s.ghost) c2.globalAlpha = 0.75;
  drawBirdBody(c2, s, wing, t, true);
  c2.restore();
}

/* ================= input ================= */
function primaryAction(){
  AudioFX.init();
  if(AudioFX.ctx && AudioFX.ctx.state === 'suspended') AudioFX.ctx.resume();
  if(paused) return;
  if(state === 'menu') startGame();
  else if(state === 'ready' || state === 'play') flap();
  else if(state === 'dead' && overShown) startGame();
}
document.addEventListener('pointerdown', () => AudioFX.init(), true);
canvas.addEventListener('pointerdown', e => { e.preventDefault(); primaryAction(); });
addEventListener('keydown', e => {
  if(e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); primaryAction(); }
  else if(e.code === 'KeyP') togglePause();
  else if(e.code === 'KeyM') toggleMute();
  else if(e.code === 'KeyH') openHelp();
  else if(e.code === 'Escape') closeHelp();
});
function pauseable(){
  return ['play','ready','draft','map','shop','victory','chest'].includes(state);
}
function syncPauseBtn(){
  const on = pauseable();
  const b = $('#pauseBtn');
  const d = on ? '' : 'none';
  if(b.style.display !== d) b.style.display = d;
}
function togglePause(){
  if(!pauseable()) return;
  paused = !paused;
  show('#pauseOverlay', paused);
  $('#pauseBtn').textContent = paused ? 'GO' : 'II';
}
function toggleMute(){
  save.muted = !save.muted;
  AudioFX.muted = save.muted;
  AudioFX.applyMute();
  persist(); refreshStats();
}
$('#muteBtn').addEventListener('click', () => { AudioFX.init(); toggleMute(); });
$('#pauseBtn').addEventListener('click', () => { AudioFX.init(); togglePause(); });
function buildHelp(){
  const list = items => items.map(i=>`<p class="hint">${i.icon ? i.icon + ' ' : ''}<b>${i.name}</b> — ${i.desc}</p>`).join('');
  $('#helpBody').innerHTML =
    `<p class="hint">${T('menuHint')}</p>` +
    `<h3>${T('upgrades')}</h3>` + list(CARDS) +
    `<h3>${T('relics')}</h3>` + list(RELICS) +
    `<h3>${T('pipesH')}</h3>` +
    `<p class="hint"><b>${T('mover')}</b> — ${T('moverDesc')}</p>` +
    `<p class="hint"><b>${T('elevator')}</b> — ${T('elevatorDesc')}</p>` +
    `<p class="hint"><b>${T('spear')}</b> — ${T('spearDesc')}</p>` +
    `<p class="hint"><b>${T('hammer')}</b> — ${T('hammerDesc')}</p>` +
    `<p class="hint"><b>${T('axe')}</b> — ${T('axeDesc')}</p>` +
    `<p class="hint"><b>${T('serpent')}</b> — ${T('serpentDesc')}</p>` +
    `<h3>${T('mapNodes')}</h3>` + Object.values(nodeNames()).map(v=>`<p class="hint">${v}</p>`).join('') +
    `<h3>${T('merchantH')}</h3>` +
    `<p class="hint"><b>${T('heal')}</b> — ${T('healDesc')}</p><p class="hint"><b>${T('coinOffer')}</b> — ${T('coinDesc')}</p><p class="hint"><b>${T('rerollOffer')}</b> — ${T('rerollDesc')}</p>` +
    `<h3>${T('skinPowers')}</h3>` + SKINS.filter(s=>s.power).map(s=>`<p class="hint"><b>${s.name}</b> — ${s.powerDesc}</p>`).join('') +
    `<p class="hint">${T('feverNote')}</p>`;
}
let helpOpen = false, helpWasPaused = false;
function openHelp(){
  if(helpOpen) return;
  helpOpen = true;
  helpWasPaused = paused;
  if(pauseable()){ paused = true; show('#pauseOverlay', false); }
  buildHelp();
  show('#help', true);
}
function closeHelp(){
  if(!helpOpen) return;
  helpOpen = false;
  show('#help', false);
  if(pauseable()){
    paused = helpWasPaused;
    show('#pauseOverlay', paused);
    $('#pauseBtn').textContent = paused ? 'GO' : 'II';
  }
}
function toMenu(){
  closeHelp();
  paused = false;
  $('#pauseBtn').textContent = 'II';
  show('#pauseOverlay', false);
  show('#hud', false);
  show('#draft', false); show('#map', false); show('#merchant', false); show('#chest', false); show('#victory', false); show('#gameover', false);
  resetRun();
  state = 'menu';
  AudioFX.stopMusic();
  refreshStats();
  show('#menu', true);
}
$('#pauseResume').addEventListener('click', () => { AudioFX.click(); togglePause(); });
$('#pauseHelp').addEventListener('click', () => { AudioFX.click(); openHelp(); });
$('#pauseMenu').addEventListener('click', () => { AudioFX.click(); toMenu(); });
$('#helpBtn').addEventListener('click', () => { AudioFX.init(); AudioFX.click(); openHelp(); });
$('#langBR').addEventListener('click', () => { AudioFX.init(); AudioFX.click(); if(lang !== 'pt'){ lang = 'pt'; save.lang = lang; persist(); applyLang(); buildShop(); } });
  $('#langUS').addEventListener('click', () => { AudioFX.init(); AudioFX.click(); if(lang !== 'en'){ lang = 'en'; save.lang = lang; persist(); applyLang(); buildShop(); } });
$('#helpClose').addEventListener('click', closeHelp);
$('#resetBtn').addEventListener('click', () => {
  AudioFX.init(); AudioFX.click();
  if(!confirm(T('resetWarn'))) return;
  save = Object.assign({}, defaultSave, { muted: save.muted, lang, playTime: save.playTime, rl: { bestStage:0, bestPipes:0 } });
  persist();
  buildShop(); refreshStats();
  toMenu();
  showToast(T('resetDone'));
});
 $('#revealBtn').addEventListener('click', () => { AudioFX.click(); closeReveal(); });
$('#playBtn').addEventListener('click', () => { AudioFX.init(); startGame(); });
  $('#retryBtn').addEventListener('click', () => { AudioFX.init(); startGame(); });
   $('#merchHeal').addEventListener('click', () => {
    const p = merchPrice('heal');
    if(run.gold < p || run.hp >= mods().maxHp) return;
    run.gold -= p; run.hp++; run.merchHeals = (run.merchHeals||0) + 1;
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchShield').addEventListener('click', () => {
    const p = merchPrice('shield');
    if(run.gold < p) return;
    run.gold -= p;
    gainUpgrade('shield'); shield++;
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchTough').addEventListener('click', () => {
    const p = merchPrice('tough');
    if(run.gold < p) return;
    run.gold -= p;
    gainUpgrade('tough');
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchChip').addEventListener('click', () => {
    const p = merchPrice('chip');
    if(run.gold < p) return;
    run.gold -= p;
    gainUpgrade('chip');
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchCoin').addEventListener('click', () => {
    const p = merchPrice('coin');
    if(run.gold < p || luckyUsed) return;
    luckyUsed = true;
    run.gold += 35 - p;
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchPhoenix').addEventListener('click', () => {
    const p = merchPrice('phoenix');
    if(run.gold < p || run.relics.includes('phoenix')) return;
    run.gold -= p;
    gainRelic('phoenix');
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchAnchor').addEventListener('click', () => {
    const p = merchPrice('anchor');
    if(run.gold < p || run.relics.includes('anchor')) return;
    run.gold -= p;
    gainRelic('anchor');
    AudioFX.score(); refreshMerchant(); refreshRlHud();
  });
  $('#merchReroll').addEventListener('click', () => {
    const p = merchPrice('reroll');
    if(run.gold < p) return;
    run.gold -= p; run.rerolls = (run.rerolls||0) + 1;
    pendingDraft = rollCards();
    AudioFX.click(); refreshMerchant();
  });
  $('#merchLeave').addEventListener('click', () => {
    AudioFX.click();
    show('#merchant', false);
    openDraft(pendingDraft);
  });
  $('#victoryBtn').addEventListener('click', () => {
    AudioFX.click();
    show('#victory', false);
    startGame();
  });
  $('#continueBtn').addEventListener('click', () => {
    AudioFX.click();
    show('#victory', false);
    run.path = run.path + 1;
    map = genMap(run.path);
    showMap();
  });
  $('#mapToggle').addEventListener('click', () => {
    if(!map) return;
    AudioFX.click();
    map.mini = !map.mini;
    showMap();
  });
  $('#chestBox').addEventListener('click', () => { if(!chestOpened) $('#chestOpen').click(); });
  $('#chestOpen').addEventListener('click', () => {
    if(!chestOpened){
      chestOpened = true;
      const box = $('#chestBox');
      box.classList.add('opening');
      setTimeout(() => {
        box.textContent = '🎁';
        box.classList.remove('opening');
        box.classList.add('opened');
        const r = chestReward;
        const rew = $('#chestReward');
        if(r.gold){ run.gold += r.gold; rew.textContent = T('plusGold').replace('{n}', r.gold); }
        else if(r.relic){ const rel = findRelic(r.relic); gainRelic(r.relic); rew.textContent = T('relicLabel') + (rel.icon||'') + ' ' + rel.name; }
        else { run.hp = Math.min(mods().maxHp, run.hp + 1); rew.textContent = T('plusHp'); }
        rew.classList.add('revealed');
        AudioFX.score();
        refreshRlHud();
        $('#chestOpen').textContent = T('continue');
      }, 450);
    } else {
      AudioFX.click();
      show('#chest', false);
      openDraft(rollCards());
    }
  });
 $('#skinsBtn').addEventListener('click', () => {
    AudioFX.init();
    AudioFX.click();
    buildShop();
    show('#shop', true);
  });
  $('#skinsBtnOver').addEventListener('click', () => {
    AudioFX.init();
    AudioFX.click();
    buildShop();
    show('#shop', true);
  });
$('#shopClose').addEventListener('click', () => { AudioFX.click(); hideTip(); show('#shop', false); });
 $('#skinGrid').addEventListener('scroll', hideTip);
document.addEventListener('visibilitychange', () => {
  if(document.hidden && state === 'play' && !paused) togglePause();
});

/* ================= main loop ================= */
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now - last)/1000; last = now;
  dt = Math.min(dt, 0.05);
  if(!paused) update(dt);
  syncPauseBtn();
  render();
  if(!$('#menu').classList.contains('hidden')){ drawMenuBird(); drawSkinPrev(); }
}

/* ================= boot ================= */
AudioFX.muted = save.muted;
checkI18n();
applyLang();
buildShop();
refreshStats();
requestAnimationFrame(frame);
