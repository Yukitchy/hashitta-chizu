// ルート直下に置く理由: Service Worker の効く範囲は置いた場所の下だけ。engine/sw.js を repo ルートのページに効かせる入口
importScripts('engine/sw.js');
