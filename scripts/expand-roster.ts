import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';

type Card={slot:number;id:number;name:string;model:string;art:string;motion:string};
type Species={id:number;family:number;name:string};
type Manifest={cards:Card[];wings:Record<string,unknown>};
const host='https://yuginimo.vinaobasilio.chatgpt.site';
const cache=path.resolve('cache/yugioh-roster');
const validModel=(b:Buffer)=>b.length>=20&&b.toString('ascii',0,4)==='glTF'&&b.readUInt32LE(4)===2&&b.readUInt32LE(8)===b.length;
const validArt=(b:Buffer)=>b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';

async function asset(url:string,valid:(b:Buffer)=>boolean){
  const target=path.join(cache,url.replace(/^\//,'').replaceAll('/','-'));
  const cached=await readFile(target).catch(()=>null);
  if(cached&&valid(cached))return cached;
  let failure:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(host+url,{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=Buffer.from(await response.arrayBuffer());
      if(!valid(data))throw new Error('Formato inválido');
      const temporary=target+'.'+process.pid+'.tmp';
      await writeFile(temporary,data);
      await rename(temporary,target);
      return data;
    }catch(error){failure=error;}
  }
  throw new Error('Não foi possível baixar '+url,{cause:failure});
}

export async function expandRoster(files:Map<string,Buffer>, catalog:Species[], league:{id:number}[], activeModels:Record<number,number>, displayNames:Map<number,string>){
  const manifest=JSON.parse(await readFile('mods/yugioh/extra-roster.json','utf8')) as Manifest;
  const starters=new Set(league.map(entry=>entry.id));
  const added=new Set(manifest.cards.map(card=>card.slot));
  if(added.size!==manifest.cards.length||manifest.cards.some(card=>!starters.has(card.slot)||activeModels[card.slot])){
    throw new Error('Mapeamento dos monstros incompatível com a Liga');
  }
  await mkdir(cache,{recursive:true});
  const motions:Record<number,string>={};
  const portraits:Record<string,string>={};
  for(const card of manifest.cards)activeModels[card.slot]=card.slot;
  for(let start=0;start<manifest.cards.length;start+=6){
    const loaded=await Promise.all(manifest.cards.slice(start,start+6).map(async card=>{
      const [model,portrait]=await Promise.all([asset(card.model,validModel),asset(card.art,validArt)]);
      return {card,model,portrait};
    }));
    for(const {card,model,portrait} of loaded){
      const species=catalog.find(entry=>entry.id===card.slot);
      if(!species)throw new Error('Espécie da Liga ausente: '+card.slot);
      const art='yugioh/'+card.slot+'.webp';
      files.set('assets/yugioh/'+card.slot+'.glb',model);
      files.set('assets/'+art,portrait);
      motions[card.slot]=card.motion;
      for(const entry of catalog){
        if(entry.id!==card.slot&&(entry.family!==species.family||starters.has(entry.id)||activeModels[entry.id]))continue;
        activeModels[entry.id]=card.slot;
        displayNames.set(entry.id,card.name);
        for(const folder of ['icons','portraits','portraits-shiny'])portraits[folder+'/'+entry.id+'.png']=art;
      }
    }
  }
  const missing=league.filter(entry=>!activeModels[entry.id]);
  if(missing.length)throw new Error('Modelos da Liga indisponíveis: '+missing.map(entry=>entry.id).join(', '));
  files.set('assets/yugioh/motions.js',Buffer.from('export const motions='+JSON.stringify(motions)+';\nexport const wings='+JSON.stringify(manifest.wings)+';'));
  console.log('Liga Yu-Gi-Oh!: '+league.length+' slots com modelos 3D.');
  return portraits;
}

