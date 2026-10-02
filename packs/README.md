# packs: 他人の走った地図を足す手順
1. `packs/yuuki/` を丸ごとコピーして `packs/<あなたの名前>/` にする
2. 中の `pack.json`（名前・ホーム・中心座標・週の目標）を書き換え、`runs.json` を自分の走行ログ（Stravaの activities 形式）に差し替える。`"sample": true` は消す
3. `index.html` 冒頭の `const PACK='yuuki'` を `'<あなたの名前>'` に変える（`engine/sw.js` の SHELL にある packs パスも合わせる）
