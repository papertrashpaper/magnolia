# 投資・保持・終局の比較結果

現行41種類・102枚、追加目標OFF。相手2方針×選択用4手札・検証用8手札。全226局面。数値は独立検証の仮想終局勝利シェアであり、実対戦勝率ではない。手順と事例は [GUIDE.md](GUIDE.md)、条件は [METHOD.md](METHOD.md)。

| 比較 | 局面 | 本比較 | 別配札検証 | 合算 | 合算95%区間 | 最終VP差 |
|---|---:|---:|---:|---:|---:|---:|
| 投資先行−得点先行 | 64 | -0.39pt | -3.84pt | -2.12pt | -4.10pt ～ -0.13pt | -0.67 |
| 揃い保持−入れ替え | 64 | +5.18pt | +0.91pt | +3.04pt | +0.33pt ～ +5.96pt | 0.68 |
| 今9体−延期：通常 | 34 | +4.09pt | +7.64pt | +6.28pt | 標本/層の不足 | -0.22 |
| 今9体−延期：低コスト展開 | 64 | +7.13pt | +10.22pt | +8.68pt | +5.11pt ～ +12.74pt | 1.45 |

95%区間は人数×局面生成方針の層内で局面を復元抽出する4,000回再標本化。16局面未満、または1局面しかない層がある比較は区間を表示しない。仮想手札を独立した実対戦標本とは数えない。条件別の小集計・追加2枚比較は説明用の追加集計。

全候補数2580、仮想継続61920回。12ラウンドで未終局の記録は0。未終局を勝ち/負けと仮定せず、比較には両群で検証用記録がすべて終局した局面だけを使う。代表10件の再実行が時間以外で一致した。全継続の各ラウンドで合法性と102枚の保存を確認した。

## 投資の経過

残金換算込み点は未終局では仮の換算で、終局済みのルートは最終点を保持する。両ルートのゲーム終了時期は異なり得る。

| 経過ラウンド | 投資先行 | 得点先行 |
|---|---:|---:|
| 1 | 11.23 | 12.42 |
| 2 | 17.09 | 18.05 |
| 3 | 27.96 | 28.67 |
| 4 | 35.37 | 36.02 |
| 5 | 35.69 | 36.36 |
| 6 | 35.69 | 36.36 |

## 記録の保存状況

攻略ガイド・集計・条件・再現コードは保存済み。圧縮原始記録とexamples.jsonのGitHub保存は、自動承認審査による明示許可待ち。保存されるまでは、以下の生成コマンドで原始記録を作ってから解析する。

## 再現

```sh
node scripts/run-strategic-timing.mjs --kind=investment
node scripts/run-strategic-timing.mjs --kind=investment --validation
```

```sh
node scripts/run-strategic-timing.mjs --kind=holding
node scripts/run-strategic-timing.mjs --kind=holding --validation
```

```sh
node scripts/run-strategic-timing.mjs --kind=ending
node scripts/run-strategic-timing.mjs --kind=ending --validation
```

```sh
node scripts/run-focused-ending.mjs
node scripts/run-focused-ending.mjs --validation
node scripts/extend-investment-timing.mjs
node scripts/extend-investment-timing.mjs --validation
node scripts/analyze-strategic-timing.mjs --replay
```

ローカルの全記録は各研究フォルダの圧縮分割JSONLに保存。圧縮記録だけでもハッシュを照合して再集計できる。自然に収集できなかった層と試行数は設定ファイルに記録した。低コスト展開の追加ルートを通常ルートの出現率として扱わない。将来の行動方針・有限の仮想手札・投資の共通配置への限定が残る。ゲーム内CPUは変更していない。
