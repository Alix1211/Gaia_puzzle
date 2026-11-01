/* Portable rebuild command for the distributed GAIA-ROYALE-v0.4 folder.
   Usage: node source/rebuild-gaia-v04.mjs
   Needs Node.js only, with the assets and audio folders next to source. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(sourceDir,'..');
const images=['paddle','dildo','lips','gag','heart','frame','bgportrait','bglandscape',
 ...Array.from({length:24},(_,i)=>i+1).flatMap(n=>[0,1,2,3].map(p=>'member'+n+'_'+p))];
const audio={
 BGM90:'bgm-menu-90.mp3',BGM120:'bgm-member1-120.mp3',BGM150:'bgm-member2-150.mp3',
 SLAP1:'slap1.mp3',SLAP2:'slap2.mp3',SLAP3:'slap3.mp3',
 REACTSURPRISE:'reaction-surprise.mp3',REACTHAPPY:'reaction-happy.mp3',REACTTIRED:'reaction-tired.mp3'
};
const tokens={};
for(const key of images){
 const bytes=await fs.readFile(path.join(root,'assets','webp',key+'.webp'));
 tokens['__'+key.toUpperCase()+'__']='data:image/webp;base64,'+bytes.toString('base64');
}
tokens.__ALL_MEMBER_POSES__=JSON.stringify(Array.from({length:24},(_,i)=>
 [0,1,2,3].map(p=>tokens['__MEMBER'+(i+1)+'_'+p+'__'])));
for(const [key,name] of Object.entries(audio)){
 const bytes=await fs.readFile(path.join(root,'audio',name));
 tokens['__'+key+'__']='data:audio/mpeg;base64,'+bytes.toString('base64');
}
let html=await fs.readFile(path.join(sourceDir,'gaia-royale-template.html'),'utf8');
const css=await fs.readFile(path.join(sourceDir,'gaia-v04-overrides.css'),'utf8');
const scripts=await Promise.all(['gaia-match-engine.js','gaia-v03-fx.js','gaia-v04-audio.js','gaia-members.js',
 'gaia-v04-runtime.js'].map(name=>fs.readFile(path.join(sourceDir,name),'utf8')));
html=html.replace('</style>',css+'\n</style>');
html=html.replace(/<script>[\s\S]*?<\/script>(?=\s*<\/body>)/,'<script>\n'+scripts.join('\n')+'\n</script>');
html=html.replaceAll('__MEMBER1__',tokens.__MEMBER1_0__);
for(const [token,value] of Object.entries(tokens))html=html.replaceAll(token,value);
if(/__[A-Z][A-Z0-9_]*__/.test(html))throw Error('Missing asset placeholder');
await fs.writeFile(path.join(root,'index.html'),html);
console.log('Rebuilt '+path.join(root,'index.html')+' ('+Buffer.byteLength(html)+' bytes)');
