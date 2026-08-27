'use strict';
function T(k){ return (UI_STR[lang] && UI_STR[lang][k]) || UI_STR.en[k] || k; }
const DATA_ORIG = { skins:{}, cards:{}, relics:{} };
SKINS.forEach(s => DATA_ORIG.skins[s.id] = { n:s.name, p:s.powerName||'', d:s.powerDesc||'' });
CARDS.forEach(c => DATA_ORIG.cards[c.id] = { n:c.name, d:c.desc });
[...RELICS, ...RELICS2].forEach(r => DATA_ORIG.relics[r.id] = { n:r.name, d:r.desc });
const DATA_PT = {
  skins: {
    classic:{n:'Clássico',p:'',d:'Sem poder'}, crimson:{n:'Carmesim',p:'Penas',d:'Gravidade mais leve'},
    azure:{n:'Azul',p:'Compacto',d:'Hitbox menor'}, jade:{n:'Jade',p:'Escudo',d:'4 PV + sobrevive a 1 dano por corrida'},
    violet:{n:'Violeta',p:'Tempo',d:'Canos 20% mais lentos'},    golden:{n:'Dourado',p:'Pontuador',d:'Pontos em dobro'},
    phantom:{n:'Fantasma',p:'Renascido',d:'5 PV + revive uma vez na corrida'},
    demon:{n:'Demoníaco',p:'Demoníaco',d:'1 PV + hitbox minúscula + começa com Vampiro x2'},
    ninja:{n:'Ninja',p:'Rolagem',d:'1 PV + 35% de chance de rolar e evitar o dano de canos'},
    cat:{n:'Gato',p:'Sete Vidas',d:'Começa com 7 PV'},
    rainbow:{n:'Arcíris',p:'Prisma',d:'5 PV + escudo + canos lentos + x2 pts'},
    god:{n:'Deus',p:'Deus',d:'Nunca morre + canos mais rápidos + Ímã x5'},
  },
  cards: {
    feather:{n:'Penas',d:'Gravidade -10%'}, midas:{n:'Pontuador',d:'+1 ponto por cano'},
    shield:{n:'Escudo',d:'+1 carga de escudo'}, vampire:{n:'Vampiro',d:'Pertinho cura 1 PV (1x por etapa, acumulável)'},
    magnet:{n:'Ímã',d:'Canos se aproximam da sua altura (acumulável)'}, greed:{n:'Ganância',d:'+2 ouro por cano'},
    chip:{n:'Chip de Febre',d:'Febre vem 10 canos antes'}, tough:{n:'Resistência',d:'+1 PV máx.'},
    slow:{n:'Câmera Lenta',d:'Velocidade dos canos -10%'}, storm:{n:'Tempestade',d:'Duração da febre x2'},
    titan:{n:'Titã',d:'+1 PV máx. e +1 escudo'},
  },
  relics: {
    golden:{n:'Pena Dourada',d:'A febre dura 15s'}, heart:{n:'Cano de Coração',d:'+1 PV no início de cada etapa'},
    coin:{n:'Ímã de Moedas',d:'+1 ouro por cano'}, prism:{n:'Fragmento de Prisma',d:'Canos 15% mais lentos'},
    anchor:{n:'Âncora',d:'Ímã base 2'}, phoenix:{n:'Fênix',d:'+1 renascimento'},
    void:{n:'Núcleo do Vazio',d:'Febre a cada 15 canos'}, echo:{n:'Eco',d:'Pertinho +3 ouro'},
  },
};
const NODE_NAMES_PT = { stage:'Etapa — canos e ouro', boss:'Chefe — muito ouro ou LEGENDÁRIO', merchant:'Comerciante — cura, escudo, PV, chip, moedas, re sortear', chest:'Baú — recompensa misteriosa', final:'CHEFE FINAL', elite:'Elite — mini-chefe, +20g + relíquia', labyrinth:'Labirinto — paredes móveis, +25g + relíquia' };
function nodeNames(){ return lang === 'pt' ? NODE_NAMES_PT : NODE_NAMES; }
function checkI18n(){
  const diff = (en, pt, label) => {
    const onlyEn = Object.keys(en).filter(k => !(k in pt));
    const onlyPt = Object.keys(pt).filter(k => !(k in en));
    if(onlyEn.length || onlyPt.length) console.warn(`[i18n] ${label}: EN-only=[${onlyEn}] PT-only=[${onlyPt}]`);
  };
  diff(UI_STR.en, UI_STR.pt, 'UI_STR');
  diff(DATA_ORIG.skins, DATA_PT.skins, 'skins');
  diff(DATA_ORIG.cards, DATA_PT.cards, 'cards');
  diff(DATA_ORIG.relics, DATA_PT.relics, 'relics');
  diff(NODE_NAMES, NODE_NAMES_PT, 'nodes');
}
function applyLang(){
  const d = lang === 'pt' ? DATA_PT : DATA_ORIG;
  SKINS.forEach(s => { const t = d.skins[s.id]; if(t){ s.name=t.n; s.powerName=t.p; s.powerDesc=t.d; } });
  CARDS.forEach(c => { const t = d.cards[c.id]; if(t){ c.name=t.n; c.desc=t.d; } });
  [...RELICS, ...RELICS2].forEach(r => { const t = d.relics[r.id]; if(t){ r.name=t.n; r.desc=t.d; } });
  const set = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  set('#playBtn', T('play'));
   set('#lblBest', T('best')); set('#lblTotal', T('total'));
  set('#goTitle', T('gameover')); set('#lblScore', T('score')); set('#lblBest2', T('best'));
  set('#newRecord', T('newRecord')); set('#retryBtn', T('playAgain')); set('#skinsBtnOver', T('skins'));
  set('#shopTitle', T('skins')); set('#shopClose', T('close'));
  set('#draftTitle', T('upgrade')); set('#draftHint', T('pickUpgrade'));
  set('#mapTitle', T('thePath')); set('#mapHint', T('tapNode'));
  set('#continueBtn', T('continueP2')); set('#victoryBtn', T('playAgain'));
  set('#chestTitle', T('chest')); set('#chestOpen', T('open')); set('#revealBtn', T('incredible'));
  set('#merchTitle', T('merchant')); set('#merchSub', T('merchHint'));
  set('#merchHeal .dcName', T('heal')); set('#merchHeal .dcDesc', T('healDesc'));
  set('#merchShield .dcName', T('shieldOffer')); set('#merchShield .dcDesc', T('shieldDesc'));
  set('#merchTough .dcName', T('toughOffer')); set('#merchTough .dcDesc', T('toughDesc'));
  set('#merchChip .dcName', T('chipOffer')); set('#merchChip .dcDesc', T('chipDesc'));
  set('#merchCoin .dcName', T('coinOffer')); set('#merchCoin .dcDesc', T('coinDesc'));
  set('#merchPhoenix .dcName', T('phoenixOffer')); set('#merchPhoenix .dcDesc', T('phoenixDesc'));
  set('#merchAnchor .dcName', T('anchorOffer')); set('#merchAnchor .dcDesc', T('anchorDesc'));
  set('#merchReroll .dcName', T('rerollOffer')); set('#merchReroll .dcDesc', T('rerollDesc'));
  set('#merchHint', T('nextDraft')); set('#merchLeave', T('leave'));
  set('#helpTitle', T('howToPlay')); set('#helpClose', T('close')); set('#resetBtn', T('reset'));
  set('#pauseTitle', T('paused')); set('#pauseResume', T('resume')); set('#pauseHelp', T('help')); set('#pauseMenu', T('mainMenu'));
  const br = $('#langBR'), us = $('#langUS');
  if(br) br.classList.toggle('active', lang === 'pt');
  if(us) us.classList.toggle('active', lang === 'en');
  refreshStats(); refreshPowerTag(); refreshComboTag();
  if(helpOpen) buildHelp();
}

