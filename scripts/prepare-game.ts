import {patchOfflineStorageError} from './offline-storage-error.ts';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {patchGame,inspectGame} from './patch-game.ts';
import {gameModules} from './game-modules.ts';
import {patchOptionalLookFrames} from './optional-look-frames.ts';
import {one} from './source.ts';
import {inspectIconCatalogs} from './catalog-icons.ts';
import {inspectItemIcons} from './item-icons.ts';
import {versionForBuild} from './upstream-version.ts';
import {offlineVersion,sourceDigest} from './release-source.ts';
import {readSnapshot,snapshotDirectory} from './upstream-snapshot.ts';
import {patchLiveRunAlias} from './live-run-alias.ts';
import {patchOfflineFriends} from './offline-friends.ts';
import {patchNativeOriginGate} from './native-origin.ts';
import {readResourceContract,assertReviewedInputs,assertRequiredResources,resourceContractDigest} from './resource-contract.ts';

const output=path.resolve(process.argv[2]??'build/game');
const snapshotRoot=process.argv[3]??snapshotDirectory;
const {manifest,files}=await readSnapshot(snapshotRoot);
const resourceContract=await readResourceContract();
assertReviewedInputs(files,manifest.upstreamBuild,resourceContract);
assertRequiredResources(new Set(files.keys()),resourceContract);
const contents=(key:string)=>{const data=files.get(key);if(!data)throw new Error(`Missing snapshot resource: ${key}`);return data.toString();};
const modules=gameModules(files),mainKey=modules.main.name,configKey=modules.config.name;
const main=modules.main.source,config=modules.config.source,menus=modules.menus.source,html=contents('index.html');
const info=inspectGame(main,config,menus),buildId=manifest.upstreamBuild;
const version=versionForBuild(info.configTree,buildId);
if(version!==manifest.upstreamVersion)throw new Error('Snapshot/config version mismatch');
const {statusIcons,reactionIcons}=inspectIconCatalogs(main,config,menus);
const itemIcons=inspectItemIcons(config,JSON.parse(contents('data/items.json')));
const missing=manifest.missingCandidates;
const bytes=[...files.values()].reduce((sum,value)=>sum+value.length,0);
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const patched = patchGame(main, config, await readFile('dist/runtime/local-backend.js','utf8'),modules.menuPath?{source:menus,path:modules.menuPath}:undefined);
const live=patchLiveRunAlias(patched.main,patched.menus??patched.main);
files.set(mainKey, Buffer.from(patchOfflineStorageError(patched.menus?live:patchOfflineFriends(live))));
if(patched.menus)files.set(modules.menus.name,Buffer.from(patchOptionalLookFrames(patchOfflineFriends(patched.menus))));
files.set(configKey, Buffer.from(patched.config));
const entryKey=one([...files.keys()].filter(key=>key.endsWith('.js')&&html.includes(`src="./${key}"`)),'snapshot entry module');
files.set(entryKey,Buffer.from(patchNativeOriginGate(contents(entryKey))));
const csp = "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; frame-src 'none'; object-src 'none'";
// Native packages serve all assets directly; there is no PWA or service worker.
const nativeHtml=html.replace(/<link[^>]+rel=["']manifest["'][^>]*>/g,'').replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${csp}"><script>if(!localStorage.getItem('pokebonk.lang'))localStorage.setItem('pokebonk.lang','zht');</script></head>`);
files.delete('manifest.webmanifest');
files.set('index.html',Buffer.from(nativeHtml));
for(const [key,data] of files)if(key.endsWith('.html'))files.set(key,Buffer.from(data.toString().replace(/((?:src|href)=["'])\/(?!\/)/g,'$1./').replace(/href=(["'])\.\/legal\1/g,'href=$1./legal.html$1')));
// Reskin experimental aplicado ao build gerado, depois da verificação do snapshot.
const dragonName='Dragão Supremo de Olhos Azuis';
const dragonAtlas=await readFile('mods/yugioh/dragon-atlas.png');
const dragonIcon=await readFile('mods/yugioh/dragon-icon.png');
const dragonPortrait=await readFile('mods/yugioh/dragon-portrait.png');
const catalog=JSON.parse(contents('data/pokemon.json'));
const sprites=JSON.parse(contents('data/sprites.json'));
const dragonStages=[4,5,6];
for(const id of dragonStages){
  const entry=catalog.find((pokemon:{id:number})=>pokemon.id===id);
  if(!entry||!sprites[id]||!sprites[6])throw new Error(`Estágio do dragão ausente: ${id}`);
  entry.name=dragonName;
  sprites[id]=sprites[6];
  for(const [folder,asset] of [['pmd',dragonAtlas],['pmd-shiny',dragonAtlas],['icons',dragonIcon],['portraits',dragonPortrait],['portraits-shiny',dragonPortrait]] as const){
    const key=`assets/${folder}/${id}.png`;
    if(files.has(key))files.set(key,asset);
  }
}
const models=[
  {id:1,slots:[1,2,3],name:'Kuriboh',file:'kuriboh.glb',portrait:'kuriboh',hash:'fac98d67f3d45d126c8d81c5c8d6dd9eb0326803dad20b2da02b2d999789fafb'},
  {id:4,slots:dragonStages,name:dragonName,file:'blue-eyes-ultimate-dragon.glb',portrait:null,hash:'42ab9135ffd90a8c19bf0f4799169e1478b07fa81e798a5f1e11165d66986090'},
  {id:7,slots:[7,8,9],name:'Dragão Branco de Olhos Azuis',file:'blue-eyes-white-dragon.glb',portrait:'dragao-branco',hash:'2fe9fb209591e6ba815f365dde3cc1078436657b5eaf13454fbd70e96e2819d6'},
  {id:10,slots:[10,11,12],name:'Dragão Bebê',file:'Dragao Bebe.glb',portrait:'dragao-bebe',hash:'a5bc7ba1659f487f1ce50cfa55cfe16b54eb2554f405083d526ab1f39ee3f9a3'},
  {id:13,slots:[13,14,15],name:"Maldição do Dragão",file:"curse-of-dragon.glb",portrait:'monster-13',hash:'1d176de984700ced175d1260fcdea7eae6779bd72703e44190fd619a17420ae1'},
  {id:16,slots:[16,17,18],name:"Dama-Harpia",file:"harpie-lady.glb",portrait:'monster-16',hash:'3e2f980a595cea86d77689f763e3397315b1609b424c572549fd63510830edd4'},
  {id:19,slots:[19,20],name:"Dragão de Metal",file:"metal-dragon.glb",portrait:'monster-19',hash:'6865ab32dbb42fead471ef8da20dcfb2e3d35c6147655d0a56bcb3a445012d66'},
  {id:21,slots:[21,22],name:"Gaia, o Cavaleiro Feroz",file:"Gaia.glb",portrait:'monster-21',hash:'b8dbd9e75f8fc213f4f8d51bc2a85e2b4c95585a2bc132aac3b52d23e89e28c3'},
  {id:23,slots:[23,24],name:"Maga Negra",file:"Maga Negra.glb",portrait:'monster-23',hash:'f7f3b4f29dfb06405510f031c19391ed297d29df02c70919e3a8f1890e09dd09'},
  {id:27,slots:[27,28],name:"Mago do Tempo",file:"time-wizard.glb",portrait:'monster-27',hash:'98ba4786e5763d4d2af253aa450cbdd001ecc483155508bcfc63e5130bf3cf09'},
  {id:29,slots:[29,30,31],name:"Rei Caveira",file:"summoned-skull.glb",portrait:'monster-29',hash:'f0dede6c318efffa06d10e38df20f49f4d2f8584158751d513793bc460a029b1'},
  {id:32,slots:[32,33,34],name:"Rei Caveira Toon",file:"toon-summoned-skull.glb",portrait:'monster-32',hash:'dd0eb77036adc7e66a95870686b26ed48f631a679ff9fe66e768b53f64d7f9a0'},
  {id:37,slots:[37,38],name:"Mago Negro",file:"Mago Negro.glb",portrait:'monster-37',hash:'0d48c3bfe34473b75e59450d10397476233b887db7a55d603b27fd47373a3203'},
  {id:41,slots:[41,42,169],name:"Dragão Negro de Olhos Vermelhos",file:"red-eyes-b-dragon.glb",portrait:'monster-41',hash:'c12c69dbbcfe428f702c4721b546ce31fd49d53d9ab663d2fc3120243f8a7494'},
  {id:43,slots:[43,44,45,182],name:"Soldado do Lustre Negro",file:"Soldado do Lustre Negro.glb",portrait:'monster-43',hash:'755a795770d7c7ea2a0039fd4be4a430170c081d81892787b6bbfef77db57411'},
  {id:46,slots:[46,47],name:"Mago Negro do Caos",file:"Mago Negro do Chaos.glb",portrait:'monster-46',hash:'ad7c218d3411d8c84dd04a6363329d7de5eb51b84445e3cf1bae634931a13db3'},
  {id:48,slots:[48,49],name:"Exodia, o Proibido",file:"summoned-lord-exodia.glb",portrait:'monster-48',hash:'48a4a57f6d26449e3915b1955f0f05dd67e6f9d2166e82ad04a61979834e6a47'},
  {id:50,slots:[50,51],name:"O Dragão Alado de Rá",file:"winged-dragon-of-ra.glb",portrait:'monster-50',hash:'3b125396ef1f71ac927545bdd2e7bb8e36f79418b0a2c83c405714ac911e96cd'},
];
const displayNames=new Map(dragonStages.map(id=>[id,dragonName]));
const availableModels=await Promise.all(models.map(async model=>{
  try {
    const response=await fetch(`https://yugibonk.com.br/assets/modelos/${encodeURIComponent(model.file)}`,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=Buffer.from(await response.arrayBuffer());
    if(sha(data)!==model.hash)throw new Error('Modelo 3D diferente da versão esperada');
    const portrait=model.portrait?await readFile(`mods/yugioh/${model.portrait}.png`):null;
    return {model,data,portrait};
  }catch(error){
    console.warn(`Modelo 3D indisponível: ${model.name}`,error);
    return null;
  }
}));
const activeModels:Record<number,number>={};
for(const asset of availableModels){
  if(!asset)continue;
  const {model,data,portrait}=asset;
  files.set(`assets/yugioh/${model.id}.glb`,data);
  for(const id of model.slots){
    activeModels[id]=model.id;
    displayNames.set(id,model.name);
    if(portrait){
      for(const folder of ['icons','portraits','portraits-shiny']){
        const key=`assets/${folder}/${id}.png`;
        if(files.has(key))files.set(key,portrait);
      }
    }
  }
}
for(const entry of catalog){
  const name=displayNames.get(entry.id);
  if(name)entry.name=name;
}
files.set('data/pokemon.json',Buffer.from(JSON.stringify(catalog)));
files.set('data/sprites.json',Buffer.from(JSON.stringify(sprites)));
for(const [key,data] of files){
  if(!/^data\/i18n\/[^/]+\.json$/.test(key))continue;
  const localized=JSON.parse(data.toString());
  if(!localized.pokemon)continue;
  for(const [id,name] of displayNames)localized.pokemon[id]=name;
  files.set(key,Buffer.from(JSON.stringify(localized)));
}
if(Object.keys(activeModels).length){
  const playerDraw='t.push(this.pos.x,this.pos.y,this.pos.z,n,r,l,this.renderScale,';
  const runDispose='dispose(){Rr(0),this.coop?.dispose()';
  const glide='let ae=this.types.includes(`flying`)||this.floats;';
  const glideSteer='(this.types.includes(`flying`)||this.floats)&&!this.diving&&n.down(`Space`)';
  const game=contents(mainKey);
  for(const hook of [playerDraw,runDispose,glide,glideSteer]){
    if(game.split(hook).length!==2)throw new Error('Ponto de integração 3D mudou no PokéBonk');
  }
  const dragonModule=await readFile('mods/yugioh/dragon-model.js');
  files.set(mainKey,Buffer.from(
    "import {drawDragon,disposeDragon,canGlideDragon} from './yugioh/dragon-model.js';\n"+
    game.replace(playerDraw,'drawDragon(this,o,s)||'+playerDraw)
        .replace(glide,glide.slice(0,-1)+'||canGlideDragon(this);')
        .replace(glideSteer,glideSteer.replace('||this.floats)', '||this.floats||canGlideDragon(this))'))
        .replace(runDispose,'dispose(){disposeDragon(this);Rr(0),this.coop?.dispose()')
  ));
  files.set('assets/yugioh/dragon-model.js',dragonModule);
  files.set('assets/yugioh/roster.js',Buffer.from('export default '+JSON.stringify(activeModels)+';'));
}
// Use the same field pot for paid, free and cursed pickups.
const sourcePot=await readFile('mods/yugioh/pot-of-greed.glb');
const potJsonLength=sourcePot.readUInt32LE(12);
const potGltf=JSON.parse(sourcePot.toString('utf8',20,20+potJsonLength));
const potRoot=potGltf.nodes[potGltf.scenes[potGltf.scene??0].nodes[0]];
potRoot.scale=potRoot.scale.map((value:number)=>value*2);
potRoot.translation=potRoot.translation.map((value:number)=>value*2);
// Use the original albedo without the field lights darkening it.
const unlit='KHR_materials_unlit';
potGltf.extensionsUsed=[...new Set([...(potGltf.extensionsUsed??[]),unlit])];
for(const material of potGltf.materials){
  material.extensions={...material.extensions,[unlit]:{}};
}
// The uploaded DAE uses bottom-left UVs; glTF images use top-left UVs.
const potBin=Buffer.from(sourcePot.subarray(20+potJsonLength));
const potUvs=new Set<number>();
for(const mesh of potGltf.meshes){
  for(const primitive of mesh.primitives)potUvs.add(primitive.attributes.TEXCOORD_0);
}
for(const index of potUvs){
  const accessor=potGltf.accessors[index];
  const view=potGltf.bufferViews[accessor.bufferView];
  if(accessor.type!=='VEC2'||accessor.componentType!==5126)throw new Error('UV do pote em formato inesperado');
  const start=8+(view.byteOffset??0)+(accessor.byteOffset??0)+4;
  const stride=view.byteStride??8;
  for(let i=0;i<accessor.count;i++){
    const offset=start+i*stride;
    potBin.writeFloatLE(1-potBin.readFloatLE(offset),offset);
  }
  if(accessor.min&&accessor.max){
    const min=accessor.min[1];
    accessor.min[1]=1-accessor.max[1];
    accessor.max[1]=1-min;
  }
}
function packPot(){
  const potJson=Buffer.from(JSON.stringify(potGltf));
  const potPadding=Buffer.alloc((4-potJson.length%4)%4,0x20);
  const potHeader=Buffer.from(sourcePot.subarray(0,20));
  potHeader.writeUInt32LE(sourcePot.length-potJsonLength+potJson.length+potPadding.length,8);
  potHeader.writeUInt32LE(potJson.length+potPadding.length,12);
  return Buffer.concat([potHeader,potJson,potPadding,potBin]);
}
const pot=packPot();
for(const material of potGltf.materials){
  material.pbrMetallicRoughness.baseColorFactor=[0.91,0.42,1,1];
}
const cursedPot=packPot();
for(const kind of ['chest','freechest','cursedchest']){
  const key=`assets/models/${kind}.glb`;
  if(!files.has(key))throw new Error(`Modelo do item de campo ausente: ${key}`);
  files.set(key,kind==='cursedchest'?cursedPot:pot);
}
const potRenderModule=modules.menus.name;
const potRender=contents(potRenderModule);
const potRenderHook='s=r.group;if(s&&!s.userData.sprite&&this.hullLod(s,o)';
if(potRender.split(potRenderHook).length!==2)throw new Error('Ponto de renderização dos potes mudou');
files.set(potRenderModule,Buffer.from(potRender.replace('WF(9430271,1.5,1.6,46,{near:[6,18],fadePow:.7,gain:1.4})','WF(9497855,1.25,2.3,32,{near:[6,18],fadePow:.7,gain:.8})').replace(potRenderHook,
  's=r.group;if(s&&(r.kind===`chest`||r.kind===`freechest`||r.kind===`cursedchest`)){if(r.kind===`freechest`&&!r.used&&!r.beacon){const aura=WF(9497855,1.25,2.3,32,{near:[6,18],fadePow:.7,gain:.8});aura.position.set(r.x,r.y,r.z);this.group.add(aura);r.beacon=aura}const camera=e.r.camera.position;s.rotation.y=Math.atan2(camera.x-r.x,camera.z-r.z);if(s.userData.potChildren!==s.children.length){s.userData.potChildren=s.children.length;s.traverse(node=>{if(node.material===Md)node.visible=false})}}else if(s&&!s.userData.sprite&&this.hullLod(s,o)')));
files.set('version.json', Buffer.from(JSON.stringify({build:buildId,version})));
files.set('resource-audit.json',Buffer.from(JSON.stringify({contractDigest:resourceContractDigest(resourceContract)})));
files.set('offline-build.json', Buffer.from(JSON.stringify({upstreamBuild:buildId,upstreamVersion:version,offlineVersion:await offlineVersion(),sourceDigest:await sourceDigest(snapshotRoot),variant:'unlock-all',league:info.roster.length,lab:info.lab.length,items:info.items.length,achievements:info.quests.length,medals:info.biomes.filter(b=>Number.isFinite(b.size)).length*3,medalRank:info.medalRanks.length,statusIcons,reactionIcons,itemIcons,builder:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2)));
await rm(output,{recursive:true,force:true});
for (const [key,data] of files) { const target=path.join(output,key);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data); }
const entries=[...files].map(([name,data])=>({name,bytes:data.length,sha256:sha(data)})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
const cacheVersion=sha(JSON.stringify(entries));
await writeFile(path.join(output,'asset-manifest.json'),JSON.stringify({build:buildId,cacheVersion,files:entries,missingCandidates:[...new Set(missing)].sort()},null,2));
console.log(`Prepared ${files.size} files, ${(bytes/1024/1024).toFixed(1)} MiB at ${output}`);
