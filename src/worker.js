import { createGameHandler } from './game.js';

function roomStore(binding) {
 const db=binding.withSession('first-primary');
 return {
  async getWithMetadata(code) {
   const row=await db.prepare('SELECT payload, revision FROM rooms WHERE code = ? AND expires_at > ?').bind(code,Date.now()).first();
   return row ? {data:JSON.parse(row.payload),etag:String(row.revision)} : null;
  },
  async setJSON(code,data,options={}) {
   const payload=JSON.stringify(data),expires=Date.now()+86400000;
   if(options.onlyIfNew){const result=await db.prepare('INSERT OR IGNORE INTO rooms (code,payload,revision,expires_at) VALUES (?,?,1,?)').bind(code,payload,expires).run();return {modified:result.meta.changes===1};}
   const result=await db.prepare('UPDATE rooms SET payload = ?, revision = revision + 1, expires_at = ? WHERE code = ? AND revision = ?').bind(payload,expires,code,Number(options.onlyIfMatch)).run();
   return {modified:result.meta.changes===1};
  }
 };
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/.netlify/functions/game'){
   if(!env.DB)return new Response(JSON.stringify({error:'Room storage is not configured yet.'}),{status:503,headers:{'Content-Type':'application/json'}});
   try{return await createGameHandler(roomStore(env.DB))(request);}catch{return new Response(JSON.stringify({error:'The room service is temporarily unavailable. Please retry.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
  }
  return env.ASSETS.fetch(request);
 }
};
