import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const id=process.env.LIE_DETECTOR_DATABASE_ID;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw Error('Set LIE_DETECTOR_DATABASE_ID in Cloudflare build variables.');
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
config.d1_databases=[{binding:'DB',database_name:'lie-detector-db',database_id:id,migrations_dir:'./migrations'}];
fs.writeFileSync('wrangler.deploy.json',JSON.stringify(config,null,2));
for(const args of [['d1','migrations','apply','DB','--remote','--config','wrangler.deploy.json'],['deploy','--config','wrangler.deploy.json']]){
 const child=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,CI:'true'}});
 if(child.error)throw child.error;if(child.status!==0)process.exit(child.status||1);
}
