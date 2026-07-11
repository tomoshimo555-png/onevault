import type { VaultItemRecord } from "../types";

const mainNote = `---
created: 2026-07-11
updated: 2026-07-11
tags:
  - 学習
  - 改善
status: active
aliases:
  - ボトルネック改善
---
# 人生のボトルネック改善

## 現状の課題

時間が足りないのではなく、エネルギーと意思決定が分散している。
特に「何をやらないか」が曖昧で、重要なことに集中できていない。

## ボトルネックの特定

- 深掘りの時間が取れない
- 情報のインプット過多
- 体力の波による生産性のムラ

## 改善アクション

- [ ] 毎朝の最重要タスクを1つに絞る
- [ ] 週次レビューで「やらないことリスト」を更新する
- [ ] 深掘りブロック（90分）をカレンダーに固定する

参考: [[パレートの法則]]

#学習
`;

const notes: Array<[string, string]> = [
  ["00_Inbox/Obsidian運用メモ.md", "# Obsidian運用メモ\n\n断片はまずInboxへ入れる。\n\n[[人生のボトルネック改善]]"],
  ["10_学習ノート/思考法/人生のボトルネック改善.md", mainNote],
  ["10_学習ノート/思考法/パレートの法則.md", "# パレートの法則\n\n成果の大半は少数の重要な行動から生まれる。\n\n[[人生のボトルネック改善]]"],
  ["10_学習ノート/思考法/時間管理の原則.md", "# 時間管理の原則\n\n重要度と緊急度を分けて考える。\n\n[[人生のボトルネック改善]]"],
  ["20_IF-THENプラン/健康/朝の集中.md", "# 朝の集中\n\nIF 朝の作業を始めるなら THEN 最重要タスクを1つだけ開く。\n\n#習慣"],
  ["20_IF-THENプラン/学習/インプット制限.md", "# インプット制限\n\nIF 情報収集が10分を超えたら THEN 小さな実験を1つ決める。"],
  ["20_IF-THENプラン/仕事/深掘りブロック.md", "# 深掘りブロック\n\n90分は通知を切って1テーマだけに集中する。"],
  ["90_Templates/日次ノートテンプレート.md", "# {{date}}\n\n## 今日の最重要\n\n- [ ] \n\n## 証拠ログ\n"],
  ["90_Templates/会議メモテンプレート.md", "# 会議メモ\n\n## 決定\n\n## 次の行動\n"],
];

export const demoItems: VaultItemRecord[] = notes.map(([path, content], index) => ({
  id: `demo-${index + 1}`,
  parentId: path.split("/").slice(0, -1).join("/") || "root",
  name: path.split("/").at(-1) ?? path,
  path,
  kind: "file",
  content,
  modified: Date.now() - index * 43_000,
  syncState: "clean",
}));

export const demoActivePath = "10_学習ノート/思考法/人生のボトネック改善.md".replace("ボトネック", "ボトルネック");
