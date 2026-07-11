import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  File,
  FilePlus2,
  Files,
  Folder,
  FolderOpen,
  FolderPlus,
  GitFork,
  Lock,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import { demoActivePath, demoItems } from "./data/demoVault";
import { authConfigured, initializeAuth, signIn, signOut } from "./lib/auth";
import { clearLocalVault, db } from "./lib/db";
import { createCryptoEnvelope, isStrongPassphrase, unlockCryptoEnvelope } from "./lib/cryptoVault";
import { analyzeNote, buildTree, resolveBacklinks } from "./lib/markdown";
import {
  createRemoteNote,
  loadCachedVault,
  loadRemoteVault,
  persistLocalItems,
  saveRemoteNote,
} from "./lib/sync";
import type { CryptoEnvelope, TreeNode, VaultDescriptor, VaultItemRecord } from "./types";
import "./styles.css";

const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--text-primary)" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.85", overflow: "auto" },
  ".cm-content": { padding: "24px 28px 96px", caretColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--text-faint)", border: "0", paddingLeft: "8px" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(139, 108, 255, .28)" },
  ".ͼb": { color: "var(--accent-bright)" },
  ".ͼc": { color: "var(--sync)" },
  ".ͼd": { color: "#d6b5ff" },
  ".ͼe": { color: "#9db5df" },
});

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--accent-bright)", fontWeight: "700" },
  { tag: [tags.link, tags.url], color: "var(--accent-bright)", textDecoration: "underline" },
  { tag: [tags.meta, tags.processingInstruction], color: "var(--sync)" },
  { tag: [tags.string, tags.attributeValue], color: "#aebddd" },
  { tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
  { tag: [tags.keyword, tags.atom, tags.bool], color: "#c6a9ff" },
  { tag: [tags.monospace, tags.contentSeparator], color: "var(--text-secondary)" },
]);

const demoMode = new URLSearchParams(window.location.search).get("demo") === "1" || !authConfigured;

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.4 21 7.6v8.8L12 21.6 3 16.4V7.6L12 2.4Z" />
      <path d="m7.8 9.3 4.2 7.5 4.2-7.5M7.8 9.3h8.4" />
    </svg>
  );
}

function TreeItem({
  node,
  depth,
  activeId,
  expanded,
  onToggle,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  activeId: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (id: string) => void;
}) {
  const isFolder = node.kind === "folder";
  const isOpen = expanded.has(node.path);
  return (
    <div className="tree-branch">
      <button
        className={`tree-row ${activeId === node.id ? "active" : ""}`}
        style={{ paddingLeft: 10 + depth * 17 }}
        onClick={() => (isFolder ? onToggle(node.path) : onOpen(node.id))}
        title={node.path}
      >
        {isFolder ? (
          <>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
          </>
        ) : (
          <>
            <span className="tree-spacer" />
            <File size={15} />
          </>
        )}
        <span>{node.name.replace(/\.md$/i, "")}</span>
      </button>
      {isFolder && isOpen &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            expanded={expanded}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
    </div>
  );
}

function MiniGraph({ title, outgoing }: { title: string; outgoing: string[] }) {
  const nodes = [...new Set(outgoing)].slice(0, 5);
  const positions = [
    [52, 21],
    [90, 55],
    [78, 92],
    [28, 92],
    [14, 55],
  ];
  return (
    <svg className="mini-graph" viewBox="0 0 104 112" role="img" aria-label="ローカルグラフ">
      {nodes.map((node, index) => (
        <g key={node}>
          <line x1="52" y1="61" x2={positions[index][0]} y2={positions[index][1]} />
          <circle cx={positions[index][0]} cy={positions[index][1]} r="4" />
          <text x={positions[index][0]} y={positions[index][1] + (positions[index][1] < 40 ? -8 : 12)}>
            {node.length > 8 ? `${node.slice(0, 8)}…` : node}
          </text>
        </g>
      ))}
      <circle className="graph-focus" cx="52" cy="61" r="6" />
      <text className="graph-title" x="52" y="79">{title.length > 10 ? `${title.slice(0, 10)}…` : title}</text>
    </svg>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
        {children}
      </section>
    </div>
  );
}

function LockScreen({
  envelope,
  onUnlocked,
  onCreated,
}: {
  envelope?: CryptoEnvelope;
  onUnlocked: (key: CryptoKey) => void;
  onCreated: (envelope: CryptoEnvelope, key: CryptoKey) => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const isSetup = !envelope;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (isSetup && (!isStrongPassphrase(pin) || pin !== confirm)) {
      setError(pin !== confirm ? "PINが一致しません" : "数字は8桁以上、文字を含む場合も8文字以上にしてください");
      return;
    }
    setWorking(true);
    try {
      if (isSetup) {
        const created = await createCryptoEnvelope(pin);
        await db.crypto.put(created.envelope);
        onCreated(created.envelope, created.key);
      } else {
        onUnlocked(await unlockCryptoEnvelope(pin, envelope));
      }
    } catch {
      setError("PINが正しくありません");
    } finally {
      setWorking(false);
    }
  }

  async function reset() {
    if (!window.confirm("端末の暗号化キャッシュを消去します。OneDriveの正本は削除されません。")) return;
    await clearLocalVault();
    window.location.reload();
  }

  return (
    <main className="gate-screen">
      <div className="gate-brand"><LogoMark size={38} /><span>OneVault</span></div>
      <section className="gate-panel">
        <div className="gate-icon"><LockKeyhole size={28} /></div>
        <p className="eyebrow">END-TO-END DEVICE PRIVACY</p>
        <h1>{isSetup ? "この端末を暗号化" : "OneVaultを解除"}</h1>
        <p>{isSetup ? "オフラインノートと検索索引を、端末専用のPINで保護します。" : "ノートを表示するには端末のPINを入力してください。"}</p>
        <form onSubmit={submit}>
          <label>PIN／パスフレーズ<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus /></label>
          {isSetup && <label>確認<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={working}>{working ? "処理中…" : isSetup ? "暗号化を有効にする" : "解除"}</button>
        </form>
        {!isSetup && <button className="text-button danger" onClick={reset}>PINを忘れたため端末キャッシュを消去</button>}
      </section>
    </main>
  );
}

function SignInScreen({ onDemo }: { onDemo: () => void }) {
  return (
    <main className="gate-screen">
      <div className="gate-brand"><LogoMark size={38} /><span>OneVault</span></div>
      <section className="gate-panel sign-in-panel">
        <div className="gate-icon"><ShieldCheck size={28} /></div>
        <p className="eyebrow">ONEDRIVE APPFOLDER ONLY</p>
        <h1>Microsoftに接続</h1>
        <p>OneVault専用のAppsフォルダだけへアクセスします。他のOneDriveファイルは読みません。</p>
        <button className="primary-button" onClick={() => void signIn()}>Microsoftアカウントで続ける</button>
        <button className="text-button" onClick={onDemo}>デモVaultを確認</button>
      </section>
    </main>
  );
}

export default function App() {
  const [envelope, setEnvelope] = useState<CryptoEnvelope>();
  const [cryptoKey, setCryptoKey] = useState<CryptoKey>();
  const [ready, setReady] = useState(demoMode);
  const [signedIn, setSignedIn] = useState(demoMode);
  const [isDemo, setIsDemo] = useState(demoMode);
  const [descriptor, setDescriptor] = useState<VaultDescriptor>();
  const [items, setItems] = useState<VaultItemRecord[]>(demoItems);
  const [activeId, setActiveId] = useState(demoItems.find((item) => item.path === demoActivePath)?.id ?? demoItems[0].id);
  const [expanded, setExpanded] = useState(new Set(["00_Inbox", "10_学習ノート", "10_学習ノート/思考法", "20_IF-THENプラン", "90_Templates"]));
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [rightOpen, setRightOpen] = useState(true);
  const [view, setView] = useState<"edit" | "read">("edit");
  const [mobilePanel, setMobilePanel] = useState<"files" | "details" | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [syncLabel, setSyncLabel] = useState("同期済み");
  const [toast, setToast] = useState("");
  const deferredQuery = useDeferredValue(query.toLocaleLowerCase("ja"));
  const saveTimer = useRef<number | undefined>(undefined);
  const hiddenAt = useRef<number | null>(null);

  const active = items.find((item) => item.id === activeId) ?? items[0];
  const metadata = active ? analyzeNote(active) : null;
  const backlinks = active ? resolveBacklinks(items, active) : [];
  const filteredItems = deferredQuery
    ? items.filter((item) => `${item.path}\n${item.content}`.toLocaleLowerCase("ja").includes(deferredQuery))
    : items;
  const tree = useMemo(() => buildTree(filteredItems), [filteredItems]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (demoMode) return;
    void db.crypto.get("crypto").then((stored) => {
      setEnvelope(stored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!cryptoKey || isDemo) return;
    void initializeAuth().then(async (account) => {
      setSignedIn(Boolean(account));
      if (!account) return;
      const cached = await loadCachedVault(cryptoKey);
      if (cached.length) {
        setItems(cached);
        setActiveId(cached[0].id);
      }
      setSyncLabel("同期中");
      try {
        const remote = await loadRemoteVault(cryptoKey);
        setItems(remote.items);
        setDescriptor(remote.descriptor);
        setActiveId((current) => remote.items.some((item) => item.id === current) ? current : remote.items[0]?.id ?? "");
        setSyncLabel("同期済み");
      } catch (error) {
        setSyncLabel("同期エラー");
        setToast((error as Error).message);
      }
    });
  }, [cryptoKey, isDemo]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 5 * 60_000 && !isDemo) {
        setCryptoKey(undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isDemo]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLocaleLowerCase() === "p" || event.key.toLocaleLowerCase() === "o") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        setNewNoteOpen(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function updateContent(content: string) {
    if (!active) return;
    const next = items.map((item) => item.id === active.id ? { ...item, content, syncState: "dirty" as const } : item);
    setItems(next);
    setSyncLabel("端末に保存中");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (isDemo || !cryptoKey || !descriptor) {
        setItems((current) => current.map((item) => item.id === active.id ? { ...item, syncState: "clean" } : item));
        setSyncLabel(isDemo ? "デモ · 保存済み" : "端末に保存済み");
        if (cryptoKey) await persistLocalItems(cryptoKey, next);
        return;
      }
      try {
        setSyncLabel("同期中");
        setItems(await saveRemoteNote(cryptoKey, active, content, next));
        setSyncLabel("同期済み");
      } catch (error) {
        setSyncLabel((error as { status?: number }).status === 412 ? "競合あり" : "送信待ち");
        showToast("変更は端末に保護されています。再同期を待っています。");
      }
    }, 850);
  }

  async function createNote() {
    const title = newTitle.trim() || "無題";
    if (isDemo || !cryptoKey || !descriptor) {
      const created: VaultItemRecord = {
        id: `local-${crypto.randomUUID()}`,
        parentId: "00_Inbox",
        name: `${title}.md`,
        path: `00_Inbox/${title}.md`,
        kind: "file",
        content: `# ${title}\n\n`,
        modified: Date.now(),
        syncState: "clean",
      };
      const next = [...items, created];
      setItems(next);
      setActiveId(created.id);
      if (cryptoKey) await persistLocalItems(cryptoKey, next);
    } else {
      setSyncLabel("同期中");
      const result = await createRemoteNote(cryptoKey, descriptor, title, items);
      setItems(result.items);
      setActiveId(result.item.id);
      setSyncLabel("同期済み");
    }
    setNewTitle("");
    setNewNoteOpen(false);
    setMobilePanel(null);
  }

  async function refresh() {
    if (isDemo || !cryptoKey) {
      showToast("デモVaultは最新です");
      return;
    }
    setSyncLabel("同期中");
    try {
      const remote = await loadRemoteVault(cryptoKey, true);
      setItems(remote.items);
      setDescriptor(remote.descriptor);
      setSyncLabel("同期済み");
    } catch (error) {
      setSyncLabel("同期エラー");
      showToast((error as Error).message);
    }
  }

  function openItem(id: string) {
    setActiveId(id);
    setMobilePanel(null);
    setSearchOpen(false);
  }

  if (!ready) return <main className="loading-screen"><LogoMark size={34} /><span>OneVaultを準備中</span></main>;
  if (!isDemo && !cryptoKey) {
    return (
      <LockScreen
        envelope={envelope}
        onUnlocked={setCryptoKey}
        onCreated={(createdEnvelope, key) => { setEnvelope(createdEnvelope); setCryptoKey(key); }}
      />
    );
  }
  if (!signedIn && !isDemo) return <SignInScreen onDemo={() => { setIsDemo(true); setSignedIn(true); setItems(demoItems); }} />;

  const outgoing = metadata?.links ?? [];
  const title = metadata?.title ?? "ノート未選択";
  const previewSource = active?.content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "[$2$1](#wiki-$1)") ?? "";

  return (
    <main className={`onevault ${rightOpen ? "" : "right-collapsed"}`}>
      <header className="window-topbar">
        <button className="brand-menu" aria-label="メニュー"><Menu size={19} /></button>
        <div className="wordmark"><LogoMark /><strong>OneVault</strong></div>
        <div className="current-title">{title}</div>
        <div className="security-state"><ShieldCheck size={17} /><span>AppFolder</span></div>
        <button className={`sync-state ${syncLabel.includes("エラー") || syncLabel.includes("競合") ? "error" : ""}`} onClick={() => void refresh()}>
          {syncLabel === "同期中" ? <RotateCw className="spin" size={17} /> : <Check size={17} />}<span>{syncLabel}</span>
        </button>
        <button className="window-control" aria-label="右パネル" onClick={() => setRightOpen((value) => !value)}><PanelRightClose size={16} /></button>
      </header>

      <aside className="icon-rail" aria-label="主要ナビゲーション">
        <div className="rail-top">
          <button className="rail-button active" title="ファイル"><Files size={18} /></button>
          <button className="rail-button" title="検索" onClick={() => setSearchOpen(true)}><Search size={19} /></button>
          <button className="rail-button" title="グラフ"><GitFork size={18} /></button>
          <button className="rail-button" title="日次ノート"><CalendarDays size={18} /></button>
          <button className="rail-button" title="ブックマーク"><Star size={18} /></button>
          <button className="rail-button" title="タグ"><Tag size={18} /></button>
        </div>
        <div className="rail-bottom">
          <button className="rail-button" title="テーマ" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}><Settings size={18} /></button>
          <button className="rail-button" title="ヘルプ"><CircleHelp size={18} /></button>
        </div>
      </aside>

      <aside className="file-explorer">
        <div className="pane-header"><span>ファイル</span><div><button title="新規ノート" onClick={() => setNewNoteOpen(true)}><Plus size={17} /></button><button title="新規フォルダ"><FolderPlus size={17} /></button></div></div>
        <div className="tree-scroll">
          {tree.map((node) => (
            <TreeItem key={node.id} node={node} depth={0} activeId={activeId} expanded={expanded} onToggle={(path) => setExpanded((current) => {
              const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next;
            })} onOpen={openItem} />
          ))}
        </div>
        <div className="vault-footer"><Lock size={13} /><span>{isDemo ? "Demo Vault" : descriptor?.displayName ?? "KnowledgeVault"}</span></div>
      </aside>

      <section className="workspace">
        <div className="mobile-topbar">
          <button onClick={() => setMobilePanel("files")}><ArrowLeft size={21} /></button>
          <span>{title}</span>
          <Lock size={16} />
          <button className="mobile-sync" onClick={() => void refresh()}><Check size={15} /><span>{syncLabel}</span></button>
          <button onClick={() => setMobilePanel("details")}><MoreHorizontal size={20} /></button>
        </div>
        <div className="tab-strip">
          <div className="note-tab active"><File size={15} /><span>{title}</span><X size={14} /></div>
          <button className="new-tab" onClick={() => setNewNoteOpen(true)}><Plus size={17} /></button>
        </div>
        <div className="editor-host">
          {view === "edit" ? (
            <CodeMirror
              value={active?.content ?? ""}
              onChange={updateContent}
              theme={theme}
              extensions={[
                markdown(),
                editorTheme,
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ "aria-label": "Markdown editor" }),
                syntaxHighlighting(markdownHighlight),
              ]}
              basicSetup={{ foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true }}
              aria-label="Markdown editor"
            />
          ) : (
            <article className="reading-view">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{previewSource}</ReactMarkdown>
            </article>
          )}
        </div>
      </section>

      <aside className={`inspector ${mobilePanel === "details" ? "mobile-open" : ""}`}>
        <div className="pane-header"><span>詳細</span><button onClick={() => { setRightOpen(false); setMobilePanel(null); }}><X size={17} /></button></div>
        <section className="inspector-section">
          <h3>プロパティ <ChevronDown size={14} /></h3>
          <dl>
            <div><dt>作成日</dt><dd>{metadata?.properties.created ?? "2026-07-11"}</dd></div>
            <div><dt>更新日</dt><dd>{metadata?.properties.updated ?? "2026-07-11"}</dd></div>
            <div><dt>タグ</dt><dd>{metadata?.tags.map((tag) => `#${tag}`).join("  ") || "—"}</dd></div>
            <div><dt>フォルダ</dt><dd>{active?.path.split("/").slice(0, -1).join("/") || "—"}</dd></div>
            <div><dt>エイリアス</dt><dd>{metadata?.aliases.join(", ") || "—"}</dd></div>
            <div><dt>状態</dt><dd>{metadata?.properties.status ?? "—"}</dd></div>
          </dl>
        </section>
        <section className="inspector-section">
          <h3>被リンク <span>{backlinks.length}</span><ChevronDown size={14} /></h3>
          <div className="link-list">{backlinks.length ? backlinks.map((item) => <button key={item.id} onClick={() => openItem(item.id)}>{analyzeNote(item).title}</button>) : <p>被リンクはありません</p>}</div>
        </section>
        <section className="inspector-section">
          <h3>発リンク <span>{outgoing.length}</span><ChevronDown size={14} /></h3>
          <div className="link-list">{outgoing.length ? outgoing.map((link) => <button key={link}>{link}</button>) : <p>発リンクはありません</p>}</div>
        </section>
        <section className="inspector-section graph-section"><h3>ローカルグラフ <ChevronDown size={14} /></h3><MiniGraph title={title} outgoing={[...outgoing, ...backlinks.map((item) => analyzeNote(item).title)]} /></section>
        {!isDemo && <button className="sign-out" onClick={() => void signOut()}>Microsoftからサインアウト</button>}
      </aside>

      <footer className="statusbar">
        <span>{active?.content.split(/\r?\n/).length ?? 0} 行</span>
        <div className="status-spacer" />
        <button className={view === "edit" ? "active" : ""} onClick={() => setView("edit")}>Markdown</button>
        <button className={view === "read" ? "active" : ""} onClick={() => setView("read")}><BookOpenText size={14} />閲覧</button>
        <span>UTF-8</span><span>LF</span><span>{metadata?.wordCount ?? 0} 文字</span>
      </footer>

      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        <button className="active" onClick={() => setMobilePanel("files")}><Files size={20} /><span>ファイル</span></button>
        <button onClick={() => setSearchOpen(true)}><Search size={20} /><span>検索</span></button>
        <button className="mobile-new" onClick={() => setNewNoteOpen(true)}><Plus size={24} /><span>新規</span></button>
        <button onClick={() => setMobilePanel("details")}><MoreHorizontal size={21} /><span>その他</span></button>
      </nav>

      <aside className={`mobile-file-sheet ${mobilePanel === "files" ? "open" : ""}`}>
        <div className="pane-header"><span>ファイル</span><button onClick={() => setMobilePanel(null)}><X size={18} /></button></div>
        <div className="sheet-search"><Search size={16} /><input placeholder="ノートを検索" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="tree-scroll">{tree.map((node) => <TreeItem key={node.id} node={node} depth={0} activeId={activeId} expanded={expanded} onToggle={(path) => setExpanded((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; })} onOpen={openItem} />)}</div>
      </aside>
      {mobilePanel && <button className="sheet-scrim" aria-label="閉じる" onClick={() => setMobilePanel(null)} />}

      {searchOpen && (
        <Modal title="クイックスイッチャー" onClose={() => setSearchOpen(false)}>
          <div className="command-search"><Search size={18} /><input autoFocus placeholder="ノート名・本文・タグを検索" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="command-results">{filteredItems.slice(0, 16).map((item) => <button key={item.id} onClick={() => openItem(item.id)}><File size={16} /><span><strong>{analyzeNote(item).title}</strong><small>{item.path}</small></span></button>)}</div>
          <footer className="command-footer"><span>↑↓ 選択</span><span>Enter 開く</span><span>Esc 閉じる</span></footer>
        </Modal>
      )}
      {newNoteOpen && (
        <Modal title="新規ノート" onClose={() => setNewNoteOpen(false)}>
          <div className="new-note-form"><label>タイトル<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createNote(); }} placeholder="無題" /></label><p><FolderOpen size={15} />00_Inbox に作成</p><button className="primary-button" onClick={() => void createNote()}><FilePlus2 size={17} />作成</button></div>
        </Modal>
      )}
      {toast && <div className="toast"><Sparkles size={16} /><span>{toast}</span></div>}
    </main>
  );
}
