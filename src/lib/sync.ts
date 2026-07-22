import type { VaultDescriptor, VaultItemRecord } from "../types";
import { getEncrypted, putEncrypted } from "./db";
import {
  createText,
  createFolder,
  ensureFolder,
  getAppRoot,
  listChildren,
  readText,
  writeText,
  type GraphDriveItem,
} from "./graph";

const VAULT_CACHE_ID = "vault:active:items";
const DESCRIPTOR_CACHE_ID = "vault:active:descriptor";
const SETTINGS_CACHE_ID = "vault:active:obsidian-settings";

export interface RemoteVaultLoad {
  descriptor: VaultDescriptor;
  items: VaultItemRecord[];
  fromCache: boolean;
  obsidianSettings: Record<string, unknown>;
}

async function walkFolder(folder: GraphDriveItem, prefix: string, output: VaultItemRecord[], settings: Record<string, unknown>) {
  const children = await listChildren(folder.id);
  for (const child of children) {
    const path = prefix ? `${prefix}/${child.name}` : child.name;
    if (child.folder) {
      output.push({
        id: child.id,
        parentId: child.parentReference?.id ?? folder.id,
        name: child.name,
        path,
        kind: "folder",
        content: "",
        eTag: child.eTag,
        cTag: child.cTag,
        modified: child.lastModifiedDateTime ? Date.parse(child.lastModifiedDateTime) : Date.now(),
        syncState: "clean",
      });
      await walkFolder(child, path, output, settings);
      continue;
    }
    const lower = child.name.toLocaleLowerCase("ja");
    if (lower.endsWith(".md")) {
      output.push({
        id: child.id,
        parentId: child.parentReference?.id ?? folder.id,
        name: child.name,
        path,
        kind: "file",
        content: await readText(child.id),
        eTag: child.eTag,
        cTag: child.cTag,
        modified: child.lastModifiedDateTime ? Date.parse(child.lastModifiedDateTime) : Date.now(),
        syncState: "clean",
        size: child.size,
      });
      continue;
    }
    if (path === ".obsidian/app.json" || path === ".obsidian/templates.json") {
      try {
        settings[path] = JSON.parse(await readText(child.id));
      } catch {
        settings[path] = {};
      }
    }
  }
}

export async function loadRemoteVault(key: CryptoKey, force = false): Promise<RemoteVaultLoad> {
  const cachedItems = await getEncrypted<VaultItemRecord[]>(key, VAULT_CACHE_ID);
  const cachedDescriptor = await getEncrypted<VaultDescriptor>(key, DESCRIPTOR_CACHE_ID);
  const cachedSettings = (await getEncrypted<Record<string, unknown>>(key, SETTINGS_CACHE_ID)) ?? {};

  const appRoot = await getAppRoot();
  const vaultName = import.meta.env.VITE_VAULT_FOLDER?.trim() || "KnowledgeVault";
  const vaultRoot = await ensureFolder(appRoot.id, vaultName);

  if (!force && cachedItems && cachedDescriptor && cachedDescriptor.cTag === appRoot.cTag) {
    return { descriptor: cachedDescriptor, items: cachedItems, fromCache: true, obsidianSettings: cachedSettings };
  }

  const items: VaultItemRecord[] = [];
  const obsidianSettings: Record<string, unknown> = {};
  await walkFolder(vaultRoot, "", items, obsidianSettings);
  const descriptor: VaultDescriptor = {
    driveId: appRoot.parentReference?.driveId ?? "me",
    appRootItemId: appRoot.id,
    vaultRootItemId: vaultRoot.id,
    displayName: vaultRoot.name,
    cTag: appRoot.cTag,
  };

  await Promise.all([
    putEncrypted(key, VAULT_CACHE_ID, items),
    putEncrypted(key, DESCRIPTOR_CACHE_ID, descriptor),
    putEncrypted(key, SETTINGS_CACHE_ID, obsidianSettings),
  ]);
  return { descriptor, items, fromCache: false, obsidianSettings };
}

export async function loadCachedVault(key: CryptoKey): Promise<VaultItemRecord[]> {
  return (await getEncrypted<VaultItemRecord[]>(key, VAULT_CACHE_ID)) ?? [];
}

export async function persistLocalItems(key: CryptoKey, items: VaultItemRecord[]): Promise<void> {
  await putEncrypted(key, VAULT_CACHE_ID, items);
}

export async function saveRemoteNote(key: CryptoKey, item: VaultItemRecord, content: string, items: VaultItemRecord[]) {
  const localItems = items.map((candidate) =>
    candidate.id === item.id ? { ...candidate, content, syncState: "syncing" as const, modified: Date.now() } : candidate,
  );
  await persistLocalItems(key, localItems);
  try {
    const remote = await writeText(item.id, content, item.eTag);
    const next = localItems.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, content, eTag: remote.eTag, cTag: remote.cTag, syncState: "clean" as const }
        : candidate,
    );
    await persistLocalItems(key, next);
    return next;
  } catch (error) {
    const status = (error as { status?: number }).status;
    const next = localItems.map((candidate) =>
      candidate.id === item.id ? { ...candidate, syncState: status === 412 ? ("conflict" as const) : ("queued" as const) } : candidate,
    );
    await persistLocalItems(key, next);
    throw error;
  }
}

export async function createRemoteNote(
  key: CryptoKey,
  descriptor: VaultDescriptor,
  title: string,
  items: VaultItemRecord[],
  folderPath = "00_Inbox",
) {
  const safeName = title.replace(/[\\/:*?"<>|]/g, " ").trim() || "無題";
  const safeFolderPath = folderPath.split("/").map((part) => part.trim()).filter(Boolean).join("/");
  let parentId = descriptor.vaultRootItemId;
  for (const part of safeFolderPath.split("/").filter(Boolean)) {
    parentId = (await ensureFolder(parentId, part)).id;
  }
  const remote = await createText(parentId, `${safeName}.md`, `# ${safeName}\n\n`);
  const created: VaultItemRecord = {
    id: remote.id,
    parentId,
    name: remote.name,
    path: safeFolderPath ? `${safeFolderPath}/${remote.name}` : remote.name,
    kind: "file",
    content: `# ${safeName}\n\n`,
    eTag: remote.eTag,
    cTag: remote.cTag,
    modified: Date.now(),
    syncState: "clean",
  };
  const next = [...items, created];
  await persistLocalItems(key, next);
  return { item: created, items: next };
}

export async function createRemoteFolder(
  key: CryptoKey,
  descriptor: VaultDescriptor,
  name: string,
  items: VaultItemRecord[],
) {
  const safeName = name.replace(/[\\/:*?"<>|]/g, " ").trim() || "新規フォルダ";
  const remote = await createFolder(descriptor.vaultRootItemId, safeName);
  const created: VaultItemRecord = {
    id: remote.id,
    parentId: descriptor.vaultRootItemId,
    name: remote.name,
    path: remote.name,
    kind: "folder",
    content: "",
    eTag: remote.eTag,
    cTag: remote.cTag,
    modified: Date.now(),
    syncState: "clean",
  };
  const next = [...items, created];
  await persistLocalItems(key, next);
  return { item: created, items: next };
}
