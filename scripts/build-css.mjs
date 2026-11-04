import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const htmlPath=join(root,'public/index.html');
const html=await readFile(htmlPath,'utf8');
const linkPattern=/<link\s+rel="stylesheet"\s+href="(\/static\/[a-zA-Z0-9._/-]+\.css(?:\?[^"]*)?)"\s*>/g;
const links=[...html.matchAll(linkPattern)];
if(links.length<12)throw Error('Expected all legacy CSS links before bundling; found '+links.length);
const first=links[0].index,last=links.at(-1).index+links.at(-1)[0].length;
if(html.slice(first,last).replace(new RegExp(linkPattern.source,'g'),'').trim()!=='')
 throw Error('Non-CSS markup between stylesheet links. Refusing to reorder.');
const imports=[],sources=[];
for(const match of links){
 const path=match[1].split('?')[0].replace(/^\//,'');
 if(!/^static\/[a-zA-Z0-9._/-]+\.css$/.test(path)||path.includes('..'))
  throw Error('Unexpected CSS path: '+path);
 const css=await readFile(join(root,'public',path),'utf8');
 const pattern=/@import\s+(?:url\(\s*(?:'[^']*'|"[^"]*"|[^)]*)\s*\)|'[^']*'|"[^"]*")\s*(?:[^;]*);/g;
 sources.push('/* SOURCE '+path+' */\n'+css.replace(pattern,rule=>{imports.push(rule);return '';}));
}
const payload='/* Yeohaenggil v8.8: generated stylesheet; edit individual source files. */\n'+imports.join('\n')+'\n'+sources.join('\n\n');
if(process.argv.includes('--verify')){
 console.log(JSON.stringify({links:links.length,imports:imports.length,bytes:Buffer.byteLength(payload)}));
}else{
 await writeFile(join(root,'public/static/compiled-v88.css'),payload,'utf8');
 const output=html.slice(0,first)+'<link rel="stylesheet" href="/static/compiled-v88.css?v=8.8.0">'+html.slice(last);
 await writeFile(htmlPath,output,'utf8');
 console.log('Combined '+links.length+' stylesheet files while preserving cascade order.');
}
