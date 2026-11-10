const elements = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
};
const typeNames = { normal:'Normal', fire:'Fogo', water:'Água', grass:'Planta', electric:'Elétrico', ice:'Gelo', fighting:'Lutador', poison:'Veneno', ground:'Terra', flying:'Voador', psychic:'Psíquico', bug:'Inseto', rock:'Pedra', ghost:'Fantasma', dragon:'Dragão', dark:'Sombrio', steel:'Aço', fairy:'Fada' };
const tones = { fire:'#ff8959', water:'#69c9ff', grass:'#78db9c', electric:'#ffd65d', ice:'#b0ecff', fighting:'#ff9e77', poison:'#c991f4', ground:'#d1a477', flying:'#9ca7ff', psychic:'#ff8fbf', bug:'#b6d969', rock:'#d5b285', ghost:'#bca1ff', dragon:'#9c8cff', dark:'#b19bd3', steel:'#bfcadd', fairy:'#ffa3dd' };
const mapNames = { forest:'Floresta', desert:'Deserto', coast:'Costa', glacier:'Glaciar', graveyard:'Cemitério', canela:'Ilha Canela', cave:'Caverna', encina:'Bosque de Encina', iris:'Cidade Íris' };
const label = key => mapNames[key] ?? key.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function card(monster, featured = false) {
  const title = elements('span',{className:'yb-card-name',textContent:monster.name});
  const image = elements('img',{src:monster.art,alt:'',loading:featured?'eager':'lazy',decoding:'async'});
  const frame = elements('span',{className:'yb-card-art'},image);
  const type = elements('span',{className:'yb-card-type',textContent:monster.types.map(t=>typeNames[t]??t).join(' · ')});
  const body = elements(featured?'div':'button',{className:'yb-card'+(featured?' yb-card-featured':''),...(featured?{}:{type:'button'})},title,frame,type);
  body.style.setProperty('--card-tone',tones[monster.types[0]]??'#e6b95f');
  return body;
}

export function mountYugibonkMenu(app, {monsters, maps}) {
  if (!app.meta?.profile || !monsters.length || !maps.length || document.getElementById('yb-launcher')) return;
  const profile = app.meta.profile;
  let selected = monsters.find(entry=>entry.id===profile.lastSpecies) ?? monsters[0];
  let mode = 'standard';
  let launching = false;

  const layer = elements('main',{id:'yb-launcher'});
  const back = elements('button',{className:'yb-return',type:'button',textContent:'Voltar ao Yugibonk',hidden:true});
  const play = elements('button',{className:'yb-play',type:'button',textContent:'Iniciar partida'});
  const preview = elements('div',{className:'yb-preview-card'});
  const total = elements('p',{className:'yb-count'});
  const list = elements('div',{className:'yb-card-grid'});
  const search = elements('input',{type:'search',placeholder:'Buscar monstro…',ariaLabel:'Buscar monstro'});
  const types = elements('select',{ariaLabel:'Filtrar por tipo'});
  types.append(new Option('Todos os tipos',''));
  for (const type of [...new Set(monsters.flatMap(entry=>entry.types))].sort((a,b)=>(typeNames[a]??a).localeCompare(typeNames[b]??b,'pt-BR'))) types.append(new Option(typeNames[type]??type,type));

  types.value = '';

  const scenario = elements('select',{ariaLabel:'Escolher cenário'});
  for (const map of maps) scenario.append(new Option(label(map),map));
  if (maps.includes(profile.lastBiome)) scenario.value=profile.lastBiome;
  const difficulty = elements('select',{ariaLabel:'Escolher dificuldade'});
  const notice = elements('p',{className:'yb-notice',role:'status'});
  const modes = [
    elements('button',{className:'yb-mode yb-mode-duel',type:'button',innerHTML:'<strong>Jogar</strong><small>Campanha clássica</small>'}),
    elements('button',{className:'yb-mode yb-mode-survival',type:'button',innerHTML:'<strong>Sobrevivência</strong><small>Ondas sem fim</small>'}),
  ];
  function setMode(index) {
    mode=index===0?'standard':'endless';
    modes.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  }
  modes.forEach((button,index)=>button.onclick=()=>setMode(index));

  function updateDifficulty() {
    const limit = Math.min(2, Math.max(0, app.meta.biomeTier(scenario.value)));
    const current = Number(difficulty.value);
    difficulty.replaceChildren();
    for (const [index,name] of ['Normal','Difícil','Pesadelo'].entries()) {
      const option = new Option(name,String(index));
      option.disabled=index>limit;
      difficulty.append(option);
    }
    difficulty.value=String(Math.min(current,limit));
  }
  scenario.onchange=updateDifficulty;
  updateDifficulty();
  setMode(0);

  const cards=monsters.map(monster=>{
    const button=card(monster);
    button.onclick=()=>{selected=monster;updateSelection();};
    return {monster,button,query:normalize(monster.name)};
  });
  function updateSelection() {
    preview.replaceChildren(card(selected,true));
    for (const {monster,button} of cards) button.setAttribute('aria-pressed',String(monster===selected));
  }
  function filter() {
    const query=normalize(search.value.trim());
    let count=0;
    for (const entry of cards) {
      entry.button.hidden=!(entry.query.includes(query)&&(!types.value||entry.monster.types.includes(types.value)));
      if (!entry.button.hidden)count++;
    }
    total.textContent=count===1?'1 monstro encontrado':count+' monstros na seleção';
  }
  search.oninput=filter;
  types.onchange=filter;
  list.append(...cards.map(entry=>entry.button));
  updateSelection();
  filter();

  function show() {
    layer.hidden=false;
    back.hidden=true;
    play.disabled=false;
    play.textContent='Iniciar partida';
    notice.textContent='';
    updateDifficulty();
  }
  const classic=elements('button',{className:'yb-pill',type:'button',textContent:'Menu clássico'});
  classic.onclick=()=>{layer.hidden=true;back.hidden=false;};
  back.onclick=show;
  play.onclick=async()=>{
    if (launching||app.run) return;
    launching=true;
    play.disabled=true;
    play.textContent='Preparando a arena…';
    layer.hidden=true;
    back.hidden=true;
    try {
      const started=await app.startRun({species:selected.id,biome:scenario.value,tier:Number(difficulty.value),mode,boosts:[]});
      if (!started&&!app.run) back.hidden=false;
    } catch {
      show();
      notice.textContent='Não foi possível iniciar. Tente novamente.';
    } finally {launching=false;}
  };

  const nativeToMenu=app.toMenu;
  app.toMenu=function(...args) {
    const result=nativeToMenu.apply(this,args);
    show();
    return result;
  };
  const nativeOpenRun=app.openRun;
  app.openRun=async function(...args) {
    const result=await nativeOpenRun.apply(this,args);
    if(result||this.run){layer.hidden=true;back.hidden=true;}
    else if(layer.hidden){back.hidden=false;}
    return result;
  };

  layer.append(
    elements('header',{className:'yb-top'},elements('span',{className:'yb-badge',textContent:'Liga de Duelistas · Edição de teste'}),classic),
    elements('div',{className:'yb-layout'},
      elements('section',{className:'yb-setup'},
        elements('h1',{className:'yb-logo'},'Yugi',elements('span',{textContent:'bonk'})),
        elements('p',{className:'yb-kicker',textContent:'Escolha seu monstro e entre na arena'}),
        elements('div',{className:'yb-modes'},...modes),
        preview,
        elements('div',{className:'yb-settings'},elements('label',{},'Cenário',scenario),elements('label',{},'Dificuldade',difficulty)),
        play,notice),
      elements('section',{className:'yb-gallery'},
        elements('div',{className:'yb-gallery-head'},elements('div',{},elements('h2',{textContent:'Escolha seu monstro'}),total),elements('div',{className:'yb-filters'},search,types)),
        list)),
  );
  document.body.append(layer,back);
}
