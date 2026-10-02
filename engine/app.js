// 走った地図 engine: 3画面（今日・地図・みんな）の描画と集計。packs/<PACK>/ のデータだけ読む
(()=>{
'use strict';
const DAY=864e5, R=6371008.8, RAD=Math.PI/180, WD=['日','月','火','水','木','金','土'];
const $=s=>document.querySelector(s);

// ---- 日付（日付文字列はUTC基準で扱い、端末のTZに左右されない）----
const ts=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)};
const dow=s=>new Date(ts(s)).getUTCDay();
const monday=s=>ts(s)-((dow(s)+6)%7)*DAY;
const shift=(s,n)=>new Date(ts(s)+n*DAY).toISOString().slice(0,10);
const md=t=>{const d=new Date(t);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()};
const pad=n=>String(n).padStart(2,'0');

// ---- 距離 ----
const km1=m=>(m/1000).toFixed(1);
const hav=(a,b)=>{const dp=(b[0]-a[0])*RAD,dl=(b[1]-a[1])*RAD,h=Math.sin(dp/2)**2+Math.cos(a[0]*RAD)*Math.cos(b[0]*RAD)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const plen=pl=>{let s=0;for(let i=1;i<pl.length;i++)s+=hav(pl[i-1],pl[i]);return s};
// 点pと線分ab（緯度経度）の距離[m]。pの緯度で平面に直す
const xy=(q,lat0)=>[q[1]*RAD*R*Math.cos(lat0*RAD),q[0]*RAD*R];
function dPtSeg(p,a,b){
  const P=xy(p,p[0]),A=xy(a,p[0]),B=xy(b,p[0]),vx=B[0]-A[0],vy=B[1]-A[1],l2=vx*vx+vy*vy;
  const t=l2?Math.max(0,Math.min(1,((P[0]-A[0])*vx+(P[1]-A[1])*vy)/l2)):0;
  return Math.hypot(P[0]-A[0]-t*vx,P[1]-A[1]-t*vy);
}
const dPtLines=(p,lines)=>{let m=Infinity;for(const pl of lines)for(let i=1;i<pl.length;i++)m=Math.min(m,dPtSeg(p,pl[i-1],pl[i]));return m};

// ---- 表示用の整形 ----
const paceStr=r=>{const s=Math.round(r.moving_s/(r.distance_m/1000));return `${Math.floor(s/60)}'${pad(s%60)}"`};
const timeStr=s=>s>=3600?`${Math.floor(s/3600)}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`:`${pad(Math.floor(s/60))}:${pad(s%60)}`;
const dateStr=s=>{const d=new Date(ts(s));return `${d.getUTCMonth()+1}月${d.getUTCDate()}日 ${WD[d.getUTCDay()]}曜`};
const period=h=>h<10?'朝':h<17?'昼':'夜';

// ---- 集計（画面に出す数値はすべてここ）----
function stats(runs,goal){
  const rs=[...runs].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  const latest=rs[rs.length-1], past=rs.slice(0,-1);
  const same=rs.filter(r=>r.date===shift(latest.date,-7));
  const diff=same.length?(latest.distance_m-same.reduce((s,r)=>s+r.distance_m,0))/1000:null;
  const w0=monday(latest.date);
  const weeks=[3,2,1,0].map(k=>{const a=w0-k*7*DAY,b=a+7*DAY;
    return {start:a,km:rs.filter(r=>ts(r.date)>=a&&ts(r.date)<b).reduce((s,r)=>s+r.distance_m,0)/1000}});
  const thisWeek=rs.filter(r=>ts(r.date)>=w0&&ts(r.date)<w0+7*DAY).length;
  const lines=past.map(r=>r.polyline);
  let nu=0;const pl=latest.polyline;
  for(let i=1;i<pl.length;i++)if(!lines.length||dPtLines(pl[i],lines)>=30)nu+=hav(pl[i-1],pl[i]);
  // ponytail: 未踏率はOverpassで道路網を取ってから。いまは塗った道の合計（重複は数えるだけ）
  const painted=rs.reduce((s,r)=>s+plen(r.polyline),0);
  return {rs,latest,diff,weeks,thisWeek,goal,newM:nu,paintedM:painted};
}

// ---- 画面 ----
function chart(weeks){
  const mx=Math.max(...weeks.map(w=>w.km)),step=mx<=15?5:Math.ceil(mx/3/5)*5,top=step*3,Y=v=>98-v/top*72;
  let g='<g>',ax='<g>';
  for(let i=0;i<=3;i++){const v=i*step;g+=`<line class="grid" x1="32" y1="${Y(v)}" x2="232" y2="${Y(v)}"/>`;ax+=`<text class="ax" x="26" y="${Y(v)+4}">${v}</text>`}
  let b='',lab='';
  weeks.forEach((w,i)=>{const x=40+i*52,cur=i===3,y=Y(w.km);
    b+=`<rect class="bar${cur?' cur':''}" x="${x}" y="${y.toFixed(1)}" width="28" height="${(98-y).toFixed(1)}" rx="3"/>`;
    lab+=`<text class="val${cur?' cur':''}" x="${x+14}" y="${(y-4).toFixed(1)}">${w.km.toFixed(1)}</text><text class="wk${cur?' cur':''}" x="${x+14}" y="118">${cur?'今週':md(w.start)}</text>`});
  const alt='直近4週の週間距離。'+weeks.map((w,i)=>(i===3?'今週':md(w.start)+'週')+w.km.toFixed(1)+'km').join('、');
  return `<svg class="chart" viewBox="0 0 232 124" role="img" aria-label="${alt}">${g}</g>${ax}</g>${b}${lab}</svg>`;
}

function today(S,pack){
  const r=S.latest,d=S.diff;
  let delta;
  if(d===null)delta='<p class="delta flat">先週の同じ曜日は走っていない</p>';
  else if(d>0)delta=`<p class="delta">▲ 先週の同じ曜日より +${d.toFixed(1)} km</p>`;
  else if(d<0)delta=`<p class="delta flat">▼ 先週の同じ曜日より −${(-d).toFixed(1)} km</p>`;
  else delta='<p class="delta flat">先週の同じ曜日と同じ距離</p>';
  return `<p class="m-date">${dateStr(r.date)}</p>
<p class="m-title">${pack.home} ${period(+r.start.slice(0,2))}ラン</p>
<div class="dist"><b>${km1(r.distance_m)}</b><span>km</span></div>
<div class="vals">
  <div><small>ペース /km</small><b>${paceStr(r)}</b></div>
  <div><small>心拍</small><b>${r.avg_hr}</b></div>
  <div><small>時間</small><b>${timeStr(r.moving_s)}</b></div>
</div>${delta}
<p class="chart-t">週ごとの距離 km（直近4週）</p>${chart(S.weeks)}`;
}

function map(S,pack){
  return `<p class="m-date">${pack.home}まわり</p>
<p class="m-title">走った道の地図</p>
<div class="mapbox"><div id="m" class="map" role="img" aria-label="走った道を重ねた地図"></div><div class="chip-top">今週 <span>${S.thisWeek}/${S.goal}</span>回</div></div>
<div class="panel">
  <p class="a">今日新しく塗った <b>${km1(S.newM)} km</b></p>
  <p class="b">塗った道 合計 <b>${km1(S.paintedM)} km</b></p>
  <span class="chip-next">次のルート: 未踏の道を含む 5km周回</span>
</div>`;
}

function all(S,pack,cheers){
  const tot=Object.values(cheers).reduce((a,b)=>a+b,0);
  const badge=S.diff>0?'<span class="badge">先週の自分を超えた</span>':'';
  return `<p class="m-date">公開ページ</p>
<p class="m-title">${pack.public_title}</p>
<div class="pub"><p class="pub-t">${pack.name} が ${pack.home} を <b>${km1(S.latest.distance_m)} km</b> 走った</p>
<div id="m" class="map thumb" role="img" aria-label="走った道の地図サムネイル"></div>${badge}
<p class="cheer">応援 <span id="tot">${tot}</span></p>
<div class="react">${Object.entries(cheers).map(([e,n])=>`<button type="button" data-e="${e}">${e} <span>${n}</span></button>`).join('')}</div></div>
<p class="note">ログイン不要。URLを開くだけで見られる</p>`;
}

// ---- 地図（Leaflet）----
let live=null;
function drawMap(S,pack,thumb){
  const el=$('#m');
  if(typeof L==='undefined'){el.innerHTML='<p class="note" style="padding:16px">地図の部品を読み込めませんでした（通信を確認してください）</p>';return}
  const ia=!thumb;
  live=L.map(el,{zoomControl:false,dragging:ia,touchZoom:ia,scrollWheelZoom:ia,doubleClickZoom:ia,boxZoom:ia,keyboard:ia,tap:false,zoomSnap:thumb?0:.25,zoomAnimation:false,fadeAnimation:false});
  live.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(live);
  const last=S.rs.length-1,all=[];
  S.rs.forEach((r,i)=>{const cur=i===last;all.push(...r.polyline);
    L.polyline(r.polyline,{color:'#1E4FD6',weight:cur?7:5,opacity:thumb&&!cur?.55:.9,lineCap:'round',lineJoin:'round'}).addTo(live)});
  L.circleMarker(pack.center,{radius:6,weight:3,color:'#1C1E26',fillColor:'#FFFFFF',fillOpacity:1}).addTo(live);
  live.fitBounds(L.latLngBounds(all),{padding:[24,24],animate:false});
}

// ---- 起動 ----
let S,pack,cheers;
function render(){
  const k={today:1,map:1,all:1}[location.hash.slice(1)]?location.hash.slice(1):'today';
  if(live){live.remove();live=null}
  document.querySelectorAll('.tabs a').forEach(a=>{const on=a.dataset.s===k;a.classList.toggle('on',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  const sample=S.rs.some(r=>r.sample)?'<p class="note">サンプルのデータを表示しています。実際に走った記録ではありません</p>':'';
  $('#scr').innerHTML=({today,map,all}[k])(S,pack,cheers)+sample;
  $('#scr').scrollTop=0;
  if(k!=='today')drawMap(S,pack,k==='all');
}

async function start(){
  const get=f=>fetch(`packs/${PACK}/${f}`).then(r=>{if(!r.ok)throw new Error(f);return r.json()});
  try{
    const [p,runs,c]=await Promise.all([get('pack.json'),get('runs.json'),get('cheers.json')]);
    if(!runs.length)throw new Error('empty');
    pack=p;cheers={...c};S=stats(runs,p.weekly_goal);
  }catch(e){
    $('#scr').innerHTML='<p class="m-title">データを読み込めませんでした</p><p class="note">ファイルを直接開くのではなく、公開URLか <code>python3 -m http.server</code> 経由で開いてください</p>';
    return;
  }
  // ponytail: 応援の保存はPhase2（ArtifactData か GitHub Issue）。いまは押した端末のその場の数字だけ+1
  $('#scr').addEventListener('click',e=>{
    const b=e.target.closest('.react button');if(!b)return;
    const n=b.querySelector('span');n.textContent=++cheers[b.dataset.e];$('#tot').textContent=+$('#tot').textContent+1;
  });
  addEventListener('hashchange',render);
  render();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
start();
// 検証用に集計を公開（画面の数値との突き合わせに使う）
window.HC={stats:()=>S};
})();
