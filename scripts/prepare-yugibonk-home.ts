import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const origin='https://yugibonk.com.br';
const prefix='yugibonk-home/';
const source='mods/yugioh/menu/';
const cache=path.resolve('cache/yugibonk-home');

async function get(url:string,key:string){
  const target=path.join(cache,key);
  const previous=await readFile(target).catch(()=>null);
  if(previous?.length)return previous;
  let last:unknown;
  for(let retry=0;retry<2;retry++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(!bytes.length)throw new Error('Arquivo vazio');
      await mkdir(path.dirname(target),{recursive:true});
      await writeFile(target,bytes);
      return bytes;
    }catch(error){last=error;}
  }
  throw new Error('Falha ao baixar '+key,{cause:last});
}

export async function prepareYugibonkHome(files:Map<string,Buffer>){
  let html=await readFile(source+'original.html','utf8');
  const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match=>match[1]!);
  const external=scripts.filter(url=>url.startsWith('https://'));
  const relative=scripts.filter(url=>url.startsWith('data/')&&!['data/supabase.js','data/audio-menu.js'].includes(url));
  const encoded=(key:string)=>key.split('/').map(encodeURIComponent).join('/');
  const put=(key:string,value:Buffer)=>files.set(prefix+key,value);

  await Promise.all(relative.map(async key=>put(key,await get(origin+'/'+encoded(key),key))));
  await Promise.all(external.map(async url=>{
    const name='vendor/'+new URL(url).pathname.split('/').pop();
    put(name,await get(url,name));
    html=html.replace('src="'+url+'"','src="'+name+'"');
  }));
  // The offline home runs without the published Yugibonk account integration.
  put('data/supabase.js',Buffer.from('// Offline menu.'));
  put('data/audio-menu.js',Buffer.from('// O motor offline cuida do áudio.'));
  const data=files.get(prefix+'data/jogo-dados.js')?.toString()??'';
  const assets=new Set([...data.matchAll(/assets\/[^"'\r\n]+\.(?:glb|webp|png|jpg)/g)].map(match=>match[0]));
  assets.add('assets/cartas/verso-bloqueada.webp');
  assets.add('assets/magias/magias.json');
  const list=[...assets];
  for(let start=0;start<list.length;start+=6){
    await Promise.all(list.slice(start,start+6).map(async key=>{
      try{put(key,await get(origin+'/'+encoded(key),key));}
      catch(error){console.warn('Recurso opcional do menu indisponível:',key,String(error));}
    }));
  }
  put('home-bridge.js',await readFile(source+'home-bridge.js'));
  html=html.replace(/<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g,'');
  try{
    put('vendor/titan-one.ttf',await get('https://fonts.gstatic.com/s/titanone/v17/mFTzWbsGxbbS_J5cQcjykw.ttf','vendor/titan-one.ttf'));
    html=html.replace('</head>',"<style>@font-face{font-family:'Titan One';src:url('vendor/titan-one.ttf') format('truetype');font-display:swap}</style></head>");
  }catch(error){console.warn('Fonte opcional do logo indisponível:',String(error));}
  const policy="default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; frame-src 'none'; object-src 'none'";
  html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><script src="home-bridge.js"></script>');
  put('index.html',Buffer.from(html));
}
