import { I as Group, g as Box3, bt as Vector3, p as GLTFLoader, q as MeshBasicMaterial } from '../three-C6GX2F5d.js';
import roster from './roster.js';

const dragons = new WeakMap();
const sizes = { 1: 2.8, 7: 5.2, 10: 2.8, 16: 3.8, 21: 4.3, 23: 3.7, 27: 3.3, 37: 3.3 };
const flyingDragons = new Set([4, 7, 10, 13, 19, 41, 50]);
const fasterWings = new Set([7, 10]);

export function canGlideDragon(player) {
  const id = roster[player.run.startSpecies];
  return player.run.player === player && flyingDragons.has(id) && roster[player.speciesId] === id;
}


export function drawDragon(player, x, z) {
  const run = player.run;
  const modelId = roster[run.startSpecies];
  if (!modelId || roster[player.speciesId] !== modelId || run.player !== player) {
    const previous = dragons.get(run);
    if (previous?.group) previous.group.visible = false;
    return false;
  }

  let state = dragons.get(run);
  if (!state) {
    state = { group: null, disposed: false };
    dragons.set(run, state);
    loadDragon(run, state, modelId).catch(error => console.warn('Dragão 3D indisponível:', error));
  }
  if (!state.group) return false;

  const { group } = state;
  const airborne = !player.grounded && !player.diving && run.input.down('Space');
  const moving = player.speedNow > 0.6 || airborne;
  const animation = moving ? state.movement : state.idle;
  if (state.animation !== animation) {
    state.animation = animation;
    state.animationStart = run.time;
  }
  group.visible = true;
  group.position.copy(player.pos);
  group.rotation.y = Math.atan2(x, z);
  group.rotation.z = player.dead ? -1.2 : 0;
  group.scale.setScalar(player.renderScale || 1);
  const rate = fasterWings.has(modelId) ? 1.35 : 1;
  const time = animation.duration > 0 ? ((run.time - state.animationStart) * rate) % animation.duration : 0;
  for (const { target, property, interpolant } of animation.tracks) {
    target[property].fromArray(interpolant.evaluate(time));
  }
  return true;
}

async function loadDragon(run, state, modelId) {
  const url = new URL('./' + modelId + '.glb', import.meta.url);
  const gltf = await new GLTFLoader().loadAsync(url.href);
  const model = gltf.scene;
  if (state.disposed) {
    releaseModel(model);
    return;
  }
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = (sizes[modelId] ?? 4.8) / Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(scale) || scale <= 0) {
    releaseModel(model);
    return;
  }

  // The original atlas already contains highlights and shadows.
  const materials = new Map();
  model.traverse(node => {
    if (!node.isMesh) return;
    const convert = material => {
      if (!material?.map) return material;
      if (!materials.has(material)) {
        materials.set(material, new MeshBasicMaterial({
          map: material.map,
          color: material.color,
          side: material.side,
          transparent: material.transparent,
          opacity: material.opacity,
          alphaTest: material.alphaTest,
          depthWrite: material.depthWrite,
          toneMapped: false,
        }));
      }
      return materials.get(material);
    };
    node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
  });
  for (const material of materials.keys()) material.dispose();

  model.scale.multiplyScalar(scale);
  model.position.sub(new Vector3(center.x, bounds.min.y, center.z).multiplyScalar(scale));
  const group = new Group();
  group.add(model);
  group.visible = false;
  const findClip = names => names.map(name => gltf.animations.find(clip => clip.name === name)).find(Boolean);
  const idleClip = findClip(['Pairar', 'Flutuar', 'Parado']);
  const movementClip = findClip(['Correr', 'Voo rápido', 'Voar', 'Deslizar', 'Andar']);
  const idle = bindClip(model, idleClip);
  const movement = movementClip ? bindClip(model, movementClip) : idle;
  run.r.scene.add(group);
  Object.assign(state, { group, model, idle, movement });
}

function bindClip(model, clip) {
  const tracks = [];
  for (const track of clip?.tracks ?? []) {
    const split = track.name.lastIndexOf('.');
    const property = track.name.slice(split + 1);
    if (!['position', 'quaternion', 'scale'].includes(property)) continue;
    const name = track.name.slice(0, split);
    const target = model.getObjectByName(name) ?? model.getObjectByProperty('uuid', name);
    if (target?.[property]?.fromArray) {
      tracks.push({ target, property, interpolant: track.createInterpolant() });
    }
  }
  return { tracks, duration: clip?.duration ?? 0 };
}

export function disposeDragon(run) {
  const state = dragons.get(run);
  if (!state) return;
  state.disposed = true;
  state.group?.removeFromParent();
  if (state.model) releaseModel(state.model);
  dragons.delete(run);
}

function releaseModel(model) {
  const resources = new Set();
  model.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.skeleton) resources.add(node.skeleton);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}
