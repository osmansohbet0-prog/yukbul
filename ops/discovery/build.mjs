import fs from 'node:fs';
const root=new URL('./',import.meta.url);
const client=fs.readFileSync(new URL('client.js',root),'utf8');
const css=fs.readFileSync(new URL('discovery.css',root),'utf8');
const worker=fs.readFileSync(new URL('worker.js',root),'utf8').replace("import client from './client.txt';",'const client='+JSON.stringify(client)+';').replace("import css from './discovery.txt';",'const css='+JSON.stringify(css)+';');
fs.mkdirSync(new URL('../../.discovery-build/',root),{recursive:true});
fs.writeFileSync(new URL('../../.discovery-build/worker.mjs',root),worker);
console.log('Built existing marketplace enhancement (no dependencies or data migrations).');
