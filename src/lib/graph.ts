import { getAccessToken } from "./auth";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

export interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  cTag?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { id?: string; driveId?: string; path?: string };
  lastModifiedDateTime?: string;
  deleted?: Record<string, never>;
}

interface GraphCollection<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

async function graphFetch<T>(pathOrUrl: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH_ROOT}${pathOrUrl}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const error = new Error(details?.error?.message ?? `Microsoft Graph ${response.status}`);
    Object.assign(error, { status: response.status, code: details?.error?.code });
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getAppRoot(): Promise<GraphDriveItem> {
  return graphFetch<GraphDriveItem>("/me/drive/special/approot?$select=id,name,eTag,cTag,parentReference,folder");
}

export async function listChildren(itemId: string): Promise<GraphDriveItem[]> {
  let next: string | undefined = `/me/drive/items/${encodeURIComponent(itemId)}/children?$select=id,name,size,eTag,cTag,file,folder,parentReference,lastModifiedDateTime&$top=200`;
  const items: GraphDriveItem[] = [];
  while (next) {
    const page: GraphCollection<GraphDriveItem> = await graphFetch(next);
    items.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return items;
}

export async function ensureFolder(parentId: string, name: string): Promise<GraphDriveItem> {
  const existing = (await listChildren(parentId)).find((item) => item.folder && item.name === name);
  if (existing) return existing;
  return graphFetch<GraphDriveItem>(`/me/drive/items/${encodeURIComponent(parentId)}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  });
}

export async function readText(itemId: string): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`ノートを読み込めません (${response.status})`);
  return response.text();
}

export async function writeText(itemId: string, content: string, eTag?: string): Promise<GraphDriveItem> {
  return graphFetch<GraphDriveItem>(`/me/drive/items/${encodeURIComponent(itemId)}/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...(eTag ? { "If-Match": eTag } : {}),
    },
    body: content,
  });
}

export async function createText(parentId: string, name: string, content: string): Promise<GraphDriveItem> {
  return graphFetch<GraphDriveItem>(
    `/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=fail`,
    { method: "PUT", headers: { "Content-Type": "text/markdown; charset=utf-8" }, body: content },
  );
}

export async function moveItem(itemId: string, parentId: string, name: string, eTag?: string): Promise<GraphDriveItem> {
  return graphFetch<GraphDriveItem>(`/me/drive/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(eTag ? { "If-Match": eTag } : {}) },
    body: JSON.stringify({ name, parentReference: { id: parentId } }),
  });
}

export async function deleteItem(itemId: string, eTag?: string): Promise<void> {
  await graphFetch<void>(`/me/drive/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: eTag ? { "If-Match": eTag } : {},
  });
}
