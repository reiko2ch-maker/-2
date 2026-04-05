# 宵宿 v9

タイトル画面とゲーム画面を分離した版です。

## 置くファイル
- index.html
- play.html
- styles.css
- game.js
- README.md

## 使い方
1. index.html を開く
2. 「はじめから」を押す
3. play.html に通常リンクで遷移し、自動でゲーム開始

## 変更点
- タイトル画面の開始処理を JavaScript ボタン起動から通常リンク遷移に変更
- iPhone Safari でタイトルから進まない問題を回避しやすい構成に変更
- `play.html?continue=1` で続きからを試行
