export type SyncState = "clean" | "dirty" | "queued" | "syncing" | "conflict" | "deleted" | "error";
export type ItemKind = "file" | "folder";

export interface VaultDescriptor {
  driveId: string;
  appRootItemId: string;
  vaultRootItemId: string;
  displayName: string;
  cTag?: string;
}

export interface VaultItemRecord {
  id: string;
  parentId: string;
  name: string;
  path: string;
  kind: ItemKind;
  content: string;
  eTag?: string;
  cTag?: string;
  modified: number;
  syncState: SyncState;
  size?: number;
}

export interface NoteMetadata {
  title: string;
  tags: string[];
  links: string[];
  aliases: string[];
  properties: Record<string, string | string[]>;
  headings: string[];
  wordCount: number;
}

export interface EncryptedPayload {
  version: 1;
  iv: string;
  ciphertext: string;
}

export interface CryptoEnvelope {
  id: "crypto";
  version: 1;
  salt: string;
  iterations: number;
  wrappedKey: EncryptedPayload;
  verifier: EncryptedPayload;
}

export interface StoredSecret {
  id: string;
  payload: EncryptedPayload;
  updatedAt: number;
}

export interface FolderSnapshot {
  id: string;
  cTag?: string;
  childIds: string[];
}

export interface SyncOperation {
  id: string;
  kind: "create" | "update" | "move" | "delete" | "uploadAttachment";
  itemId?: string;
  parentId?: string;
  name?: string;
  content?: string;
  baseETag?: string;
  createdAt: number;
  attempts: number;
}

export interface ConflictRecord {
  id: string;
  path: string;
  base: string;
  local: string;
  remote: string;
  createdAt: number;
  resolution?: "local" | "remote" | "both" | "merged";
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  kind: ItemKind;
  children: TreeNode[];
}
