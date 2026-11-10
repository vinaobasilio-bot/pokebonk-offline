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
files.set('data/pokemon.json',Buffer.from(JSON.stringify(catalog)));
files.set('data/sprites.json',Buffer.from(JSON.stringify(sprites)));
for(const [key,data] of files){
  if(!/^data\/i18n\/[^/]+\.json$/.test(key))continue;
  const localized=data.toString().replace(/"([456])"\s*:\s*"(?:Charmander|Charmeleon|Charizard)"/g,(_,id:string)=>`"${id}":${JSON.stringify(dragonName)}`);
  files.set(key,Buffer.from(localized));
}
// Download the same model used by Yugibonk, pinning the exact file for this build.
try {
  const response=await fetch('https://yugibonk.com.br/assets/modelos/blue-eyes-ultimate-dragon.glb',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const model=Buffer.from(await response.arrayBuffer());
  if(sha(model)!=='42ab9135ffd90a8c19bf0f4799169e1478b07fa81e798a5f1e11165d66986090')throw new Error('Modelo 3D diferente da versão esperada');
  const playerDraw='t.push(this.pos.x,this.pos.y,this.pos.z,n,r,l,this.renderScale,';
  const runDispose='dispose(){Rr(0),this.coop?.dispose()';
  const game=contents(mainKey);
  for(const hook of [playerDraw,runDispose]){
    if(game.split(hook).length!==2)throw new Error('Ponto de integração 3D mudou no PokéBonk');
  }
  const dragonModule=await readFile('mods/yugioh/dragon-model.js');
  files.set(mainKey,Buffer.from(
    "import {drawDragon,disposeDragon} from './yugioh/dragon-model.js';\n"+
    game.replace(playerDraw,'drawDragon(this,o,s)||'+playerDraw)
        .replace(runDispose,'dispose(){disposeDragon(this);Rr(0),this.coop?.dispose()')
  ));
  files.set('assets/yugioh/dragon-model.js',dragonModule);
  files.set('assets/yugioh/blue-eyes-ultimate-dragon.glb',model);
}catch(error){
  console.warn('Modelo 3D não incluído. O jogo usará o sprite do dragão.',error);
}
files.set('version.json', Buffer.from(JSON.stringify({build:buildId,version})));
files.set('resource-audit.json',Buffer.from(JSON.stringify({contractDigest:resourceContractDigest(resourceContract)})));
files.set('offline-build.json', Buffer.from(JSON.stringify({upstreamBuild:buildId,upstreamVersion:version,offlineVersion:await offlineVersion(),sourceDigest:await sourceDigest(snapshotRoot),variant:'unlock-all',league:info.roster.length,lab:info.lab.length,items:info.items.length,achievements:info.quests.length,medals:info.biomes.filter(b=>Number.isFinite(b.size)).length*3,medalRank:info.medalRanks.length,statusIcons,reactionIcons,itemIcons,builder:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2)));
await rm(output,{recursive:true,force:true});
for (const [key,data] of files) { const target=path.join(output,key);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data); }
const entries=[...files].map(([name,data])=>({name,bytes:data.length,sha256:sha(data)})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
const cacheVersion=sha(JSON.stringify(entries));
await writeFile(path.join(output,'asset-manifest.json'),JSON.stringify({build:buildId,cacheVersion,files:entries,missingCandidates:[...new Set(missing)].sort()},null,2));
console.log(`Prepared ${files.size} files, ${(bytes/1024/1024).toFixed(1)} MiB at ${output}`);
