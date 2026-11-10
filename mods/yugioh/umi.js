import { tt as PlaneGeometry, K as Mesh, ut as ShaderMaterial } from './three-C6GX2F5d.js';

const duration = 30;
const key = 'yugibonk.umi.stock';
const runs = new WeakMap();
const art = new URL('./umi.jpg', import.meta.url).href;

export function umiStock() {
  const saved = localStorage.getItem(key);
  const count = saved === null ? 999 : Number(saved);
  return Number.isInteger(count) ? Math.max(0, Math.min(999, count)) : 999;
}
export const umiArt = art;

function flood(run) {
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
    fragmentShader: 'varying vec2 ground; uniform float clock,spread,fade; uniform vec3 origin; void main(){float dist=distance(ground,origin.xz);if(dist>spread)discard;float wave=sin(ground.x*1.5+ground.y*.8-clock*3.)*.5+.5;float crest=sin(ground.x*.68+ground.y*.36-clock*1.8+sin(ground.y*.19+clock*.55)*.48);float foam=.24*smoothstep(.88,.995,crest)+1.-smoothstep(0.,2.,spread-dist);gl_FragColor=vec4(mix(vec3(.03,.31,.62),vec3(.36,.88,1.),clamp(foam*.75+wave*.15,0.,1.)),fade*(.40+foam*.13));}',
  });
  const mesh = new Mesh(geometry, material);
  run.r.scene.add(mesh);
  return mesh;
}

function clearWater(state) {
  if (!state.water) return;
  state.water.removeFromParent();
  state.water.geometry.dispose();
  state.water.material.dispose();
  state.water = null;
}

function mount(run) {
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;right:16px;top:35%;z-index:30;width:118px;color:#e5fcff;background:#082944ed;border:1px solid #70defa;border-radius:14px;padding:8px;text-align:center;box-shadow:0 4px 24px #001a45a0;font:700 13px system-ui';
  const image = document.createElement('img');
  image.src = art;
  image.alt = 'Umi';
  image.style.cssText = 'width:65px;border-radius:4px;display:block;margin:0 auto 5px';
  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText = 'width:100%;background:#9cecff;color:#072842;border:0;border-radius:8px;padding:6px 3px;font:inherit;cursor:pointer';
  const status = document.createElement('div');
  status.style.cssText = 'font-size:11px;margin-top:5px';
  const meter = document.createElement('div');
  meter.style.cssText = 'height:4px;margin-top:5px;border-radius:4px;background:#75f4ff;transform-origin:left';
  panel.append(image, button, status, meter);
  document.body.append(panel);
  const state = { panel, button, status, meter, end: -Infinity, water: null, terrain: null, stock: umiStock() };
  const activate = () => {
    if (run.state !== 'play' || run.paused || run.player.dead || run.time < state.end || !state.stock) return;
    const water = flood(run);
    state.stock--;
    localStorage.setItem(key, String(state.stock));
    state.water = water;
    state.terrain = run.terrain;
    state.end = run.time + duration;
    updateUmi(run);
  };
  button.onclick = activate;
  state.keydown = event => { if (event.code === "KeyU" && !event.repeat && !event.target?.matches?.("input,textarea,[contenteditable]")) activate(); };
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
    state.water = flood(run);
    state.terrain = run.terrain;
  }
  if (active && state.water) {
    const u = state.water.material.uniforms;
    u.clock.value = run.time;
    u.spread.value = (duration - left) * run.terrain.walkLim * 2;
    u.fade.value = Math.min(1, left * 2);
  } else clearWater(state);
  state.button.disabled = active || !state.stock || run.state !== 'play' || Boolean(run.paused);
  state.button.textContent = active ? 'Umi · ' + Math.ceil(left) + ' s' : 'Usar Umi [U] ×' + state.stock;
  state.status.textContent = active ? 'Água · +20% ATQ · +15% DEF' : 'Magia de Campo';
  state.meter.style.transform = 'scaleX(' + left / duration + ')';
}

export function umiDamage(run, value, attacker, defender) {
  const state = runs.get(run);
  if (!state || run.time >= state.end) return value;
  if (attacker?.includes('water')) value *= 1.2;
  if (defender?.includes('water')) value /= 1.15;
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
