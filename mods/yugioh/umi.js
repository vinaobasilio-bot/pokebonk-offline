import { tt as PlaneGeometry, K as Mesh, ut as ShaderMaterial, I as Group, T as ConeGeometry, ft as SphereGeometry, q as MeshBasicMaterial, _ as BoxGeometry } from './three-C6GX2F5d.js';

const duration = 30;

const runs = new WeakMap();
export const fieldCards = [
  { id:'umi', name:'Umi', types:['water'], label:'Água', colors:'vec3(.03,.31,.62),vec3(.36,.88,1.)', pattern:'water' },
  { id:'forest', name:'Forest · Floresta', types:['bug','grass','normal','fire'], label:'Inseto, Planta, Normal e Fogo', colors:'vec3(.04,.24,.08),vec3(.48,.81,.22)', pattern:'forest' },
  { id:'mountain', name:'Mountain · Montanha', types:['dragon','fairy','electric','flying'], label:'Dragão, Fada, Elétrico e Voador', colors:'vec3(.26,.22,.18),vec3(.68,.56,.42)', pattern:'mountain' },
  { id:'sogen', name:'Sogen · Pradaria', types:['fighting'], label:'Lutador', colors:'vec3(.25,.49,.08),vec3(.80,.88,.35)', pattern:'sogen' },
  { id:'yami', name:'Yami · Trevas', types:['dark','psychic','ghost'], label:'Sombrio, Psíquico e Fantasma', colors:'vec3(.09,.03,.19),vec3(.62,.18,.82)', pattern:'yami' },
  { id:'wasteland', name:'Wasteland · Terreno Devastado', types:['ground','steel','rock','ghost'], label:'Terra, Aço, Pedra e Fantasma', colors:'vec3(.32,.13,.08),vec3(.85,.55,.29)', pattern:'wasteland' },
  { id:'toon', name:'Toon World · Mundo Toon', types:[], label:'Monstros Toon', colors:'vec3(.38,.20,.69),vec3(.97,.45,.71)', pattern:'toon' },
  { id:'burning', name:'Burning Land · Terra Ardente', types:[], label:'Remove o campo ativo', colors:'vec3(.46,.06,.03),vec3(1.,.60,.08)', pattern:'burning' },
  { id:'labyrinth', name:'Labyrinth Wall · Labirinto', types:[], label:'Labirinto visual', colors:'vec3(.14,.13,.20),vec3(.69,.58,.42)', pattern:'labyrinth' },
].map(card => ({ ...card, art:new URL('./'+card.id+'.jpg', import.meta.url).href }));

const patterns = {
  forest:'clamp(.35+.25*sin(ground.x*.39+sin(ground.y*.57))+.18*sin(ground.x*3.4-ground.y*2.8),0.,1.)',
  mountain:'clamp(.3+.28*sin(ground.x*.53+ground.y*.36)+.15*sin(ground.x*2.9-ground.y*1.73)+.16*cos(ground.y*4.1+ground.x*.7),0.,1.)',
  sogen:'(.5+.5*sin(ground.x*.31+ground.y*.68-clock*.9))*.65',
  yami:'smoothstep(.25,.9,(sin(ground.x*.34+clock*.6)+cos(ground.y*.48-clock*.9))*.25+.5)',
  wasteland:'clamp(.25+.38*smoothstep(.6,.94,abs(sin(ground.x*.86+sin(ground.y*.97)*1.6)))+.16*cos(ground.y*3.3+ground.x*.7),0.,1.)',
  toon:'smoothstep(-.72,.88,sin(ground.x*.20+ground.y*.29+sin(ground.y*.44)*1.2-clock*.4))',
  burning:'smoothstep(.18,.92,sin(ground.x*.95+sin(ground.y*.56+clock*4.)+clock*2.)*.5+.5)',
  labyrinth:'(.15+.5*step(.92,max(fract(ground.x*.65),fract(ground.y*.65))))',
};

export function umiStock(id = 'umi') {
  const saved = localStorage.getItem('yugibonk.' + id + '.stock');
  const count = saved === null ? 999 : Number(saved);
  return Number.isInteger(count) ? Math.max(0, Math.min(999, count)) : 999;
}


function flood(run, card) {
  const radius = Number.isFinite(run.terrain.walkLim) ? run.terrain.walkLim : 100;
  const geometry = new PlaneGeometry(radius * 2, radius * 2, 128, 128);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, run.terrain.height(positions.getX(i), positions.getZ(i)) + 0.08);
  }
  geometry.computeBoundingSphere();
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { clock: { value: 0 }, spread: { value: 0 }, origin: { value: run.player.pos.clone() }, fade: { value: 1 } },
    vertexShader: 'varying vec2 ground; void main(){ground=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: card.pattern === 'water' ? 'varying vec2 ground; uniform float clock,spread,fade; uniform vec3 origin; void main(){float dist=distance(ground,origin.xz);if(dist>spread)discard;float wave=sin(ground.x*1.5+ground.y*.8-clock*3.)*.5+.5;float crest=sin(ground.x*.68+ground.y*.36-clock*1.8+sin(ground.y*.19+clock*.55)*.48);float foam=.24*smoothstep(.88,.995,crest)+1.-smoothstep(0.,2.,spread-dist);gl_FragColor=vec4(mix(vec3(.03,.31,.62),vec3(.36,.88,1.),clamp(foam*.75+wave*.15,0.,1.)),fade*(.40+foam*.13));}' : `varying vec2 ground; uniform float clock,spread,fade; uniform vec3 origin; void main(){float dist=distance(ground,origin.xz);if(dist>spread)discard;float shade=${patterns[card.pattern]};float edge=1.-smoothstep(0.,2.,spread-dist);gl_FragColor=vec4(mix(${card.colors},clamp(shade+edge*.35,0.,1.)),fade*(.48+edge*.12));}`,
  });
  const mesh = new Mesh(geometry, material);
  if (card.id !== 'umi') decorateField(run, mesh, card.id);
  run.r.scene.add(mesh);
  return mesh;
}

// Each decoration lists shape, color, scale, height, and optional tilt.
const fieldDecor = {
  mountain: [
    ['cone', 0x705c49, [1.25,2.25,1], 1.02],
    ['cone', 0xe1efff, [.43,.72,.36], 1.82],
  ],
  toon: [
    ['sphere', 0xff63b3, [.75,.34,.75], .85],
    ['cone', 0xffd38a, [.24,1,.24], .49, Math.PI],
  ],
  forest: [
    ['box', 0x5c3924, [.23,1.5,.23], .72],
    ['cone', 0x246444, [1.15,1.6,1.15], 1.35],
    ['cone', 0x438f48, [.86,1.5,.86], 1.96],
    ['cone', 0x75b952, [.58,1.2,.58], 2.48],
  ],
  sogen: [
    ['cone', 0x769d3a, [.24,.75,.20], .34, .28],
    ['cone', 0xa6c95a, [.22,.62,.18], .25, -.33],
    ['sphere', 0xffdf78, [.16,.11,.16], .61],
  ],
  yami: [
    ['cone', 0x371951, [.55,1.78,.55], .84, .19],
    ['cone', 0x9863f7, [.29,1.14,.29], .59, -.42],
    ['sphere', 0xd7a3ff, [.13,.13,.13], 1.99],
  ],
  wasteland: [
    ['box', 0x9d6240, [.86,.53,.68], .23, .19],
    ['cone', 0xc48f60, [.48,.9,.42], .54, -.27],
  ],
  burning: [
    ['cone', 0xe54b13, [.41,1.08,.41], .51, -.15],
    ['cone', 0xffc347, [.22,.7,.22], .38, .24],
  ],
  labyrinth: [
    ['box', 0x655b68, [3.9,1.0,.33], .48],
    ['box', 0xa79883, [4.05,.15,.44], 1.04],
  ],
};

function decorateField(run, surface, kind) {
  const shapes = { cone:new ConeGeometry(1,1,5), sphere:new SphereGeometry(1,10,6), box:new BoxGeometry(1,1,1) };
  const parts = fieldDecor[kind].map(([shape, color, dimensions, height, tilt = 0]) => ({
    geometry:shapes[shape],
    material:new MeshBasicMaterial({ color, toneMapped:false }),
    dimensions, height, tilt,
  }));
  const origin = surface.material.uniforms.origin.value;
  const limit = Number.isFinite(run.terrain.walkLim) ? run.terrain.walkLim : 100;
  surface.userData.fieldProps = [];
  surface.userData.fieldResources = [...Object.values(shapes), ...parts.map(part => part.material)];
  for (let i = 0; i < 28; i++) {
    const angle = i * 2.399963;
    const radius = kind === 'burning' ? 5 + (i % 7) * 2 : 11 + (i % 7) * 4.3;
    const dx = Math.cos(angle) * radius, dz = Math.sin(angle) * radius;
    const x = origin.x + (kind === 'labyrinth' ? Math.round(dx / 5) * 5 : dx);
    const z = origin.z + (kind === 'labyrinth' ? Math.round(dz / 5) * 5 : dz);
    if (Math.abs(x) > limit - 2 || Math.abs(z) > limit - 2) continue;
    const y = run.terrain.height(x, z);
    if (!Number.isFinite(y)) continue;
    const prop = new Group();
    const size = kind === 'labyrinth' ? 1 : .75 + (i % 5) * .25;
    for (const part of parts) {
      const object = new Mesh(part.geometry, part.material);
      object.scale.set(...part.dimensions).multiplyScalar(size);
      object.position.y = part.height * size;
      object.rotation.z = part.tilt;
      prop.add(object);
    }
    prop.position.set(x, y, z);
    prop.rotation.y = kind === 'labyrinth' ? (i % 2) * Math.PI / 2 : angle;
    prop.visible = false;
    surface.add(prop);
    surface.userData.fieldProps.push({ prop, radius:Math.hypot(x-origin.x,z-origin.z) });
  }
}

function clearWater(state) {
  if (!state.water) return;
  state.water.removeFromParent();
  state.water.geometry.dispose();
  for (const resource of state.water.userData.fieldResources ?? []) resource.dispose();
  state.water.material.dispose();
  state.water = null;
}

function mount(run) {
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;right:16px;top:35%;z-index:30;width:118px;color:#e5fcff;background:#082944ed;border:1px solid #70defa;border-radius:14px;padding:8px;text-align:center;box-shadow:0 4px 24px #001a45a0;font:700 13px system-ui';
  const image = document.createElement('img');

  image.style.cssText = 'width:65px;border-radius:4px;display:block;margin:0 auto 5px';
  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText = 'width:100%;background:#9cecff;color:#072842;border:0;border-radius:8px;padding:6px 3px;font:inherit;cursor:pointer';
  const status = document.createElement('div');
  status.style.cssText = 'font-size:11px;margin-top:5px';
  const meter = document.createElement('div');
  meter.style.cssText = 'height:4px;margin-top:5px;border-radius:4px;background:#75f4ff;transform-origin:left';
  const selector = document.createElement('select');
  selector.setAttribute('aria-label', 'Selecionar Magia de Campo');
  selector.style.cssText = 'width:100%;margin:0 0 6px;background:#123b52;color:white;border:1px solid #70defa;border-radius:5px';
  for (const card of fieldCards) selector.add(new Option(card.name.split(' · ')[0],card.id));
  panel.append(image, selector, button, status, meter);
  document.body.append(panel);
  const state = { panel, image, selector, button, status, meter, end: -Infinity, water: null, terrain: null, card: null, seconds: duration };
  const activate = () => {
    const card = fieldCards[selector.selectedIndex];
    const stock = umiStock(card.id);
    if (run.state !== 'play' || run.paused || run.player.dead || !stock || (run.time < state.end && card.id !== 'burning')) return;
    clearWater(state);
    state.water = flood(run, card);
    localStorage.setItem('yugibonk.' + card.id + '.stock', String(stock - 1));
    state.terrain = run.terrain;
    state.card = card;
    state.seconds = card.id === 'burning' ? 2 : duration;
    state.end = run.time + state.seconds;
    updateUmi(run);
  };
  button.onclick = activate;
  selector.onchange = () => updateUmi(run);
  state.keydown = event => {
    if (event.repeat || event.target?.matches?.('input,textarea,[contenteditable]') || run.state !== 'play') return;
    if (event.code === 'KeyU') activate();
    if (event.code === 'KeyI') {
      selector.selectedIndex = (selector.selectedIndex + 1) % fieldCards.length;
      updateUmi(run);
    }
  };
  window.addEventListener("keydown", state.keydown);
  runs.set(run, state);
  return state;
}

export function updateUmi(run) {
  if (!run.player || !run.r?.scene) return;
  const state = runs.get(run) ?? mount(run);
  if (run.player.dead) state.end = -Infinity;
  const left = Math.max(0, state.end - run.time);
  const active = left > 0;
  if (active && state.terrain !== run.terrain) {
    clearWater(state);
    state.water = flood(run, state.card);
    state.terrain = run.terrain;
  }
  if (active && state.water) {
    const u = state.water.material.uniforms;
    u.clock.value = run.time;
    u.spread.value = (state.seconds - left) * (Number.isFinite(run.terrain.walkLim) ? run.terrain.walkLim : 100) * 2;
    u.fade.value = Math.min(1, left * 2);
    for (const { prop, radius } of state.water.userData.fieldProps ?? []) {
      const scale = Math.min(1, Math.max(0, (u.spread.value - radius) * .45), u.fade.value);
      prop.visible = scale > 0;
      prop.scale.setScalar(scale);
    }
  } else clearWater(state);
  const selected = fieldCards[state.selector.selectedIndex];
  const card = active ? state.card : selected;
  const stock = umiStock(selected.id);
  if (state.image.alt !== card.name) {
    state.image.src = card.art;
    state.image.alt = card.name;
  }
  state.button.disabled = (active && selected.id !== 'burning') || !stock || run.state !== 'play' || Boolean(run.paused);
  state.button.textContent = active && selected.id !== 'burning'
    ? card.name.split(' · ')[0] + ' · ' + Math.ceil(left) + ' s'
    : 'Usar [U] ×' + stock;
  state.status.textContent = card.label + (active && (card.types.length || card.id === 'toon') ? ' · +20% ATQ · +15% DEF' : '');
  state.meter.style.transform = 'scaleX(' + left / state.seconds + ')';
}

export function umiDamage(run, value, attacker, defender) {
  const state = runs.get(run);
  if (!state?.card || run.time >= state.end) return value;
  const { card } = state;
  const favored = types => card.id === 'toon'
    ? types === run.player.types && [32, 33, 34].includes(run.player.speciesId)
    : card.types.some(type => types?.includes(type));
  if (favored(attacker)) value *= 1.2;
  if (favored(defender)) value /= 1.15;
  return value;
}

export function disposeUmi(run) {
  const state = runs.get(run);
  if (!state) return;
  clearWater(state);
  state.panel.remove();
  window.removeEventListener("keydown", state.keydown);
  runs.delete(run);
}
