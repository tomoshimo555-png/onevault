import { describe, expect, it } from "vitest";
import { analyzeNote, buildTree, extractWikiLinks, replaceWikiLinks } from "./markdown";
import type { VaultItemRecord } from "../types";

const note: VaultItemRecord = {
  id: "1",
  parentId: "folder",
  name: "テスト.md",
  path: "10_学習ノート/テスト.md",
  kind: "file",
  content: `---\ntags:\n  - 学習\naliases: [別名]\nstatus: active\n---\n# テスト\n\n[[関連ノート#見出し|表示]] #実験`,
  modified: 0,
  syncState: "clean",
};

describe("markdown compatibility", () => {
  it("extracts Obsidian metadata", () => {
    expect(analyzeNote(note)).toMatchObject({
      title: "テスト",
      tags: ["学習", "実験"],
      aliases: ["別名"],
      links: ["関連ノート"],
    });
  });

  it("rewrites only matching wiki links", () => {
    expect(replaceWikiLinks("[[旧名]] [[旧名#節|表示]] [[別名]]", "旧名", "新名"))
      .toBe("[[新名]] [[新名#節|表示]] [[別名]]");
  });

  it("builds folders before files", () => {
    const tree = buildTree([note]);
    expect(tree[0].name).toBe("10_学習ノート");
    expect(tree[0].children[0].name).toBe("テスト.md");
    expect(extractWikiLinks(note.content)).toEqual(["関連ノート"]);
  });
});
