import YAML from "yaml";
import type { NoteMetadata, TreeNode, VaultItemRecord } from "../types";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const match = content.match(frontmatterPattern);
  if (!match) return { data: {}, body: content };
  try {
    return { data: (YAML.parse(match[1]) as Record<string, unknown>) ?? {}, body: content.slice(match[0].length) };
  } catch {
    return { data: {}, body: content };
  }
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function extractWikiLinks(content: string): string[] {
  return [...content.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

export function extractTags(content: string, frontmatter: Record<string, unknown> = {}): string[] {
  const inline = [...content.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map((match) => match[1]);
  return [...new Set([...asStringList(frontmatter.tags), ...inline])].sort((a, b) => a.localeCompare(b, "ja"));
}

export function analyzeNote(item: VaultItemRecord): NoteMetadata {
  const { data, body } = parseFrontmatter(item.content);
  const headingMatches = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)];
  const fallback = item.name.replace(/\.md$/i, "");
  const title = String(data.title ?? headingMatches[0]?.[1] ?? fallback).trim();
  const properties: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) properties[key] = value.map(String);
    else if (value != null && typeof value !== "object") properties[key] = String(value);
  }
  return {
    title,
    tags: extractTags(body, data),
    links: extractWikiLinks(body),
    aliases: asStringList(data.aliases),
    properties,
    headings: headingMatches.map((match) => match[1].trim()),
    wordCount: body.replace(/\s/g, "").length,
  };
}

export function replaceWikiLinks(content: string, previousName: string, nextName: string): string {
  return content.replace(/(!?\[\[)([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?(\]\])/g, (full, open, target, heading = "", alias = "", close) => {
    return target.trim().toLocaleLowerCase("ja") === previousName.toLocaleLowerCase("ja")
      ? `${open}${nextName}${heading}${alias}${close}`
      : full;
  });
}

export function buildTree(items: VaultItemRecord[]): TreeNode[] {
  const root: TreeNode = { id: "root", name: "root", path: "", kind: "folder", children: [] };
  for (const item of [...items].sort((a, b) => a.path.localeCompare(b.path, "ja"))) {
    const parts = item.path.split("/").filter(Boolean);
    let parent = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isLeaf = index === parts.length - 1;
      let node = parent.children.find((candidate) => candidate.name === part);
      if (!node) {
        node = {
          id: isLeaf ? item.id : `folder:${path}`,
          name: part,
          path,
          kind: isLeaf ? item.kind : "folder",
          children: [],
        };
        parent.children.push(node);
      }
      parent = node;
    });
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "ja") : a.kind === "folder" ? -1 : 1));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(root.children);
  return root.children;
}

export function resolveBacklinks(items: VaultItemRecord[], target: VaultItemRecord): VaultItemRecord[] {
  const basename = target.name.replace(/\.md$/i, "").toLocaleLowerCase("ja");
  const aliases = analyzeNote(target).aliases.map((alias) => alias.toLocaleLowerCase("ja"));
  return items.filter((item) => {
    if (item.id === target.id) return false;
    return extractWikiLinks(item.content).some((link) => {
      const normalized = link.split("/").at(-1)?.replace(/\.md$/i, "").toLocaleLowerCase("ja") ?? "";
      return normalized === basename || aliases.includes(normalized);
    });
  });
}
