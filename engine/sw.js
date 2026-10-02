// 最小のキャッシュ: 同一オリジンのGETを「キャッシュを返しつつ裏で更新」。無くてもアプリは動く
// ponytail: 更新が1回遅れる。即時反映したくなったら CACHE 名の版を上げる
const CACHE='hashitta-0.1.0';
const SHELL=['./','index.html','engine/app.js','engine/style.css','engine/manifest.webmanifest','packs/yuuki/pack.json','packs/yuuki/runs.json','packs/yuuki/cheers.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
