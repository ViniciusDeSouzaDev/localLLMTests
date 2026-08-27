'use strict';
/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a+(b-a)*t;
const rand = (a,b) => a+Math.random()*(b-a);
const TAU = Math.PI*2;

/* ================= save ================= */
const SAVE_KEY = 'flappyDeluxeSave';
const defaultSave = { best:0, total:0, unlocked:['classic'], selected:'classic', muted:false, mode:'rl', modeChosen:false, lang:'en', rl:{ bestStage:0, bestPipes:0 } };
let save;
try { save = Object.assign(defaultSave, JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')); }
catch(e){ save = Object.assign({}, defaultSave); }
if(!save.rl) save.rl = { bestStage:0, bestPipes:0 };
if(!save.modeChosen) save.mode = 'rl';
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }

/* ================= skins ================= */
const SKINS = [
  { id:'classic', name:'Classic', body:'#ffd93b', belly:'#fff6cf', wing:'#f2a51e', trail:'#ffe98a', unlock:0, power:null, powerName:'', powerDesc:'No power' },
  { id:'crimson', name:'Crimson', body:'#ff5d5d', belly:'#ffd9d9', wing:'#d63b3b', trail:'#ff9a9a', unlock:10, power:'feather', powerName:'Feather', powerDesc:'Lighter gravity' },
  { id:'azure',   name:'Azure',   body:'#4fc3f7', belly:'#e8f9ff', wing:'#1e93d6', trail:'#9fe0ff', unlock:25, power:'compact', powerName:'Compact', powerDesc:'Smaller hitbox' },
  { id:'jade',    name:'Jade',    body:'#5fe07a', belly:'#eaffd9', wing:'#2aa84e', trail:'#a2f5b0', unlock:50, power:'shield', powerName:'Shield', powerDesc:'4 HP + survive 1 hit per run' },
  { id:'violet',  name:'Violet',  body:'#b388ff', belly:'#f3e9ff', wing:'#8a4fd6', trail:'#d7baff', unlock:100, power:'time', powerName:'Time', powerDesc:'Pipes 20% slower' },
  { id:'golden',  name:'Golden',  body:'#ffd700', belly:'#fffbe0', wing:'#d9a400', trail:'#fff3a0', unlock:200, sparkle:true, power:'midas', powerName:'Midas', powerDesc:'Double points' },
  { id:'phantom', name:'Phantom', body:'#d7e0e6', belly:'#ffffff', wing:'#9fb3bd', trail:'#ffffff', unlock:300, ghost:true, power:'reborn', powerName:'Reborn', powerDesc:'5 HP + revive once mid-run' },
  { id:'demon', name:'Demon', body:'#4a1526', belly:'#6b2038', wing:'#2a0a14', trail:'#ff3b3b', unlock:750, demon:true, power:'compact', powerName:'Demon', powerDesc:'1 HP + tiny hitbox + starts with Vampire x2' },
  { id:'cat', name:'Cat', body:'#e8973e', belly:'#fff3e0', wing:'#c46a1e', trail:'#ffd9a0', unlock:1000, power:'hearts', powerName:'Seven Lives', powerDesc:'Starts with 7 HP' },
  { id:'rainbow', name:'Rainbow', body:null, belly:'#ffffff', wing:null, trail:null, unlock:10000, rainbow:true, power:'prism', powerName:'Prism', powerDesc:'5 HP + shield + slow pipes + x2 pts' },
  { id:'god', name:'God', body:'#fff3c4', belly:'#fffdf2', wing:'#f7c948', trail:'#fff6d6', unlock:100000, god:true, sparkle:true, power:'god', powerName:'God', powerDesc:'Never dies + faster pipes + Magnet x5' },
];
const skinById = id => SKINS.find(s=>s.id===id) || SKINS[0];

const SKIN_HP = { classic:3, crimson:3, azure:3, jade:4, violet:3, golden:3, phantom:5, demon:1, cat:7, rainbow:5, god:99 };
function powers(){
  const s = skinById(save.selected);
  const p = s.power;
  return {
    grav:   p==='feather' ? 0.85 : 1,
    radius: p==='god' ? BIRD_R * 1.5 : ((p==='compact' || p==='prism') ? 11 : BIRD_R),
    shield: p==='god' ? Infinity : ((p==='shield' || p==='prism') ? 1 : 0),
    revive: p==='reborn' ? 1 : 0,
    speed:  p==='god' ? 1.3 : (p==='time' ? 0.8 : (p==='prism' ? 0.85 : 1)),
    mult:   (p==='midas' || p==='prism') ? 2 : 1,
    maxHp:  SKIN_HP[s.id] || 3,
    god:    p==='god',
    magnet: p==='god' ? 5 : 0,
  };
}

/* ================= roguelike ================= */
let mode = 'rl';
let run = null;
let stageClearT = 0;
let pendingDraft = null;
let draftGuardT = 0;
let luckyUsed = false;
let chestReward = null;
let chestOpened = false;
let map = null;

const CARDS = [
  { id:'feather', icon:'🪶', name:'Feather',    desc:'Gravity -10%' },
  { id:'midas',   icon:'✨', name:'Midas',      desc:'+1 point per pipe' },
  { id:'shield',  icon:'🛡️', name:'Shield',     desc:'+1 shield charge' },
  { id:'vampire', icon:'🧛', name:'Vampire',    desc:'Near-miss heals 1 HP (once per stage, stacks)' },
  { id:'magnet',  icon:'🧲', name:'Magnet',     desc:'Pipes drift toward your height (stacks)' },
  { id:'greed',   icon:'🪙', name:'Greed',      desc:'+2 gold per pipe' },
  { id:'chip',    icon:'🔥', name:'Fever Chip', desc:'Fever triggers 10 pipes sooner' },
  { id:'tough',   icon:'💪', name:'Tough',      desc:'+1 max HP' },
  { id:'slow',    icon:'🐌', name:'Slow Mo',    desc:'Pipe speed -10%' },
  { id:'storm',   icon:'⚡', name:'Storm',      desc:'Fever duration x2', p2:true },
  { id:'titan',   icon:'🗡️', name:'Titan',      desc:'+1 max HP and +1 shield', p2:true },
];

const RELICS = [
  { id:'golden', icon:'🌟', name:'Golden Feather', desc:'Fever lasts 15s' },
  { id:'heart',  icon:'❤️', name:'Heart Pipe',     desc:'+1 HP at start of each stage' },
  { id:'coin',   icon:'💰', name:'Coin Magnet',    desc:'+1 gold per pipe' },
  { id:'prism',  icon:'🔮', name:'Prism Shard',    desc:'Pipes 15% slower' },
];
const RELICS2 = [
  { id:'anchor',  icon:'⚓', name:'Anchor',    desc:'Base magnet 2' },
  { id:'phoenix', icon:'🔥', name:'Phoenix',   desc:'+1 revive' },
  { id:'void',    icon:'🕳️', name:'Void Core', desc:'Fever every 15 pipes' },
  { id:'echo',    icon:'📯', name:'Echo',      desc:'Near-miss +3 gold' },
];
function relicPool(){ return (run && run.path === 2) ? RELICS2 : RELICS; }

/* ================= i18n ================= */
let lang = save.lang || 'en';
const UI_STR = {
  en: {
    play:'PLAY', skins:'SKINS', characters:'CHARACTERS', howToPlay:'HOW TO PLAY', classic:'CLASSIC', roguelike:'ROGUELIKE',
    best:'BEST', total:'TOTAL', pts:'PTS', close:'CLOSE', closeCall:'CLOSE!', gameover:'GAME OVER', score:'SCORE',
    newRecord:'NEW RECORD!', playAgain:'PLAY AGAIN', upgrade:'CHOOSE UPGRADE', pickUpgrade:'Pick 1 of 3 — it stays with you for the rest of the run',
    thePath:'THE PATH', tapNode:'Tap a glowing node', victory:'VICTORY!', ascension:'ASCENSION!',
    continueP2:'CONTINUE → PATH 2', chest:'CHEST', open:'OPEN', merchant:'MERCHANT', leave:'LEAVE', incredible:'INCREDIBLE!',
    paused:'PAUSED', resume:'RESUME', help:'HELP', mainMenu:'MAIN MENU', noMedal:'NO MEDAL',
    diamond:'DIAMOND', platinum:'PLATINUM', gold:'GOLD', silver:'SILVER', bronze:'BRONZE',
    stage:'STAGE', power:'POWER', none:'NONE', noPower:'NO POWER', noPowerDesc:'No power',
    selected:'SELECTED', tapToWear:'TAP TO WEAR', unlockAt:'Unlock at {n} pts',
    skinUnlocked:'Skin unlocked: {n}!', reachUnlock:'Reach {n} total points to unlock {s}',
    fever:'FEVER!', combo:'COMBO', shieldReady:'SHIELD READY', rebornReady:'REBORN READY',
    again:'AGAIN!', phase:'PHASE', pass:'PASS', plusHp:'+1 HP', minusHp:'-{n} HP', shieldTxt:'SHIELD', rebornTxt:'REBORN',
    stageExcl:'STAGE {n}!',
    rlStats:'PATH {p} — STAGE {s}/{r}  •  {n} PIPES  •  🪙{g}',
    victoryStats:'Stage {s} — {n} pipes — 🪙{g}  •  Victory #{v}',
    ascensionStats:'Path 2 cleared — {n} pipes — 🪙{g}  •  Ascension #{a}',
    menuHint:'SPACE / CLICK to flap &nbsp;•&nbsp; P pause &nbsp;•&nbsp; M sound &nbsp;•&nbsp; H help',
    heal:'Heal 1 HP', healDesc:'15g', shieldOffer:'Shield', shieldDesc:'+1 shield charge — 25g',
    toughOffer:'Tough', toughDesc:'+1 max HP — 30g', chipOffer:'Fever Chip', chipDesc:'Fever 10 pipes sooner — 25g',
    coinOffer:'Lucky Coin', coinDesc:'Pay 20g, gain 35g', phoenixOffer:'Phoenix', phoenixDesc:'+1 revive — 40g',
    anchorOffer:'Anchor', anchorDesc:'Base magnet 2 — 35g', rerollOffer:'Reroll Draft', rerollDesc:'10g',
    merchHint:'Buy items with gold — your current build is shown above',
    nextDraft:'Next draft preview — you pick one after leaving',
    ownedBadge:'OWNED ×{n}',
    upgrades:'UPGRADES', relics:'RELICS', pipesH:'PIPES',
    mover:'Mover', moverDesc:'gold pipe, drifts up and down',
    spear:'Spear', spearDesc:'steel pipe, bigger gap but deals 2x damage (stage 2+)',
    hammer:'Hammer', hammerDesc:'red pipe, bigger gap that slams shut and opens again (stage 3+)',
    mapNodes:'MAP NODES', merchantH:'MERCHANT', skinPowers:'SKIN POWERS',
    feverNote:'Fever: every 30 pipes, score x2 for 10s. Gold is earned per pipe and lost on death.',
    continue:'CONTINUE', plusGold:'+{n} GOLD', relicLabel:'RELIC: ',
  },
  pt: {
    play:'JOGAR', skins:'SKINS', characters:'PERSONAGENS', howToPlay:'COMO JOGAR', classic:'CLÁSSICO', roguelike:'ROGUELIKE',
    best:'RECORDE', total:'TOTAL', pts:'PTS', close:'FECHAR', closeCall:'PERTINHO!', gameover:'FIM DE JOGO', score:'PONTOS',
    newRecord:'NOVO RECORDE!', playAgain:'JOGAR DE NOVO', upgrade:'ESCOLHA MELHORAMENTO', pickUpgrade:'Escolha 1 de 3 — fica com você pelo resto da corrida',
    thePath:'O CAMINHO', tapNode:'Toque em um nó brilhante', victory:'VITÓRIA!', ascension:'ASCENSÃO!',
    continueP2:'CONTINUAR → CAMINHO 2', chest:'BAÚ', open:'ABRIR', merchant:'COMERCIANTE', leave:'SAIR', incredible:'INCRÍVEL!',
    paused:'PAUSADO', resume:'CONTINUAR', help:'AJUDA', mainMenu:'MENU PRINCIPAL', noMedal:'SEM MEDALHA',
    diamond:'DIAMANTE', platinum:'PLATINA', gold:'OURO', silver:'PRATA', bronze:'BRONZE',
    stage:'ETAPA', power:'PODER', none:'NENHUM', noPower:'SEM PODER', noPowerDesc:'Sem poder',
    selected:'SELECIONADO', tapToWear:'TOQUE PARA USAR', unlockAt:'Desbloqueie com {n} pts',
    skinUnlocked:'Personagem desbloqueado: {n}!', reachUnlock:'Alcance {n} pontos totais para desbloquear {s}',
    fever:'FEBRE!', combo:'COMBO', shieldReady:'ESCUDO PRONTO', rebornReady:'RENASCER PRONTO',
    again:'DE NOVO!', phase:'FASE', pass:'PASSOU', plusHp:'+1 PV', minusHp:'-{n} PV', shieldTxt:'ESCUDO', rebornTxt:'RENASCER',
    stageExcl:'ETAPA {n}!',
    rlStats:'CAMINHO {p} — ETAPA {s}/{r}  •  {n} CANOS  •  🪙{g}',
    victoryStats:'Etapa {s} — {n} canos — 🪙{g}  •  Vitória #{v}',
    ascensionStats:'Caminho 2 concluído — {n} canos — 🪙{g}  •  Ascensão #{a}',
    menuHint:'ESPAÇO / CLIQUE para voar &nbsp;•&nbsp; P pausa &nbsp;•&nbsp; M som &nbsp;•&nbsp; H ajuda',
    heal:'Curar 1 PV', healDesc:'15g', shieldOffer:'Escudo', shieldDesc:'+1 carga de escudo — 25g',
    toughOffer:'Resistência', toughDesc:'+1 PV máx. — 30g', chipOffer:'Chip de Febre', chipDesc:'Febre 10 canos antes — 25g',
    coinOffer:'Moeda da Sorte', coinDesc:'Pague 20g, ganhe 35g', phoenixOffer:'Fênix', phoenixDesc:'+1 renascimento — 40g',
    anchorOffer:'Âncora', anchorDesc:'Ímã base 2 — 35g', rerollOffer:'Re sortear carta', rerollDesc:'10g',
    merchHint:'Compre itens com ouro — seu build atual está acima',
    nextDraft:'Prévia da próxima carta — você escolhe ao sair',
    ownedBadge:'TEM ×{n}',
    upgrades:'MELHORAMENTOS', relics:'RELÍQUIAS', pipesH:'CANOS',
    mover:'Mover', moverDesc:'cano dourado, sobe e desce',
    spear:'Lança', spearDesc:'cano de aço, passagem maior mas causa dano 2x (etapa 2+)',
    hammer:'Martelo', hammerDesc:'cano vermelho, passagem maior que fecha e abre (etapa 3+)',
    mapNodes:'NÓS DO MAPA', merchantH:'COMERCIANTE', skinPowers:'PODERES DOS PERSONAGENS',
    feverNote:'Febre: a cada 30 canos, pontos x2 por 10s. O ouro é ganho por cano e perdido ao morrer.',
    continue:'CONTINUAR', plusGold:'+{n} OURO', relicLabel:'RELÍQUIA: ',
  },
};
