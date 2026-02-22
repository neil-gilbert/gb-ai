"use client";

import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  LogIn,
  LogOut,
  Paperclip,
  Search,
  Send,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildAuthHeaders, toApiUrl } from "@/lib/api";
import type { ChatMessage, ChatSummary, ModelEntry } from "@/lib/types";

const EXAMPLE_PROMPTS = [
  "Draft a launch email for a new subscription tier",
  "Summarize this policy document in simple language",
  "Create a 7-day onboarding plan for first-time users",
  "Help me choose a model for image + document tasks",
];

const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE_BYTES = 1024 * 1024;

type LocalFile = {
  localId: string;
  file: File;
};

type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  pending?: boolean;
};

type DevSession = {
  userId: string;
  email: string;
  role: "user" | "admin";
};

type AuthMeResponse = {
  user: { id: string; email: string; role: string };
  plan: { name: string };
  usage: { dailyCreditsUsed: number; dailyCreditLimit: number };
};

function toUiMessages(messages: ChatMessage[]): UiMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.displayText,
  }));
}

function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function utcDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function isMimeAllowed(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "webp", "gif", "pdf", "txt", "md", "docx"].includes(ext);
}

function streamChunks(raw: string): string[] {
  const events = raw.split("\n\n");
  return events.filter(Boolean);
}

function loadDevSession(): DevSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const userId = window.localStorage.getItem("hyoka_dev_user_id");
  const email = window.localStorage.getItem("hyoka_dev_email");
  const role = (window.localStorage.getItem("hyoka_dev_role") as "user" | "admin" | null) ?? "user";

  if (!userId || !email) {
    return null;
  }

  return { userId, email, role };
}

function saveDevSession(session: DevSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem("hyoka_dev_user_id");
    window.localStorage.removeItem("hyoka_dev_email");
    window.localStorage.removeItem("hyoka_dev_role");
    return;
  }

  window.localStorage.setItem("hyoka_dev_user_id", session.userId);
  window.localStorage.setItem("hyoka_dev_email", session.email);
  window.localStorage.setItem("hyoka_dev_role", session.role);
}

export default function HomePage() {
  const [session, setSession] = useState<DevSession | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("demo@gb-ai.local");
  const [loginRole, setLoginRole] = useState<"user" | "admin">("user");

  const [menuOpen, setMenuOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [profile, setProfile] = useState<AuthMeResponse | null>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<LocalFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isSignedIn = Boolean(session);
  const canCreateNewChat = messages.length > 0;

  const groupedChats = useMemo(() => {
    const groups = new Map<string, ChatSummary[]>();
    for (const chat of chats) {
      const key = utcDayKey(chat.createdAtUtc);
      const arr = groups.get(key) ?? [];
      arr.push(chat);
      groups.set(key, arr);
    }

    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [chats]);

  useEffect(() => {
    setSession(loadDevSession());
  }, []);

  const loadProfile = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      return;
    }

    try {
      const data = await apiFetch<AuthMeResponse>("/api/v1/auth/me", {});
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, [isSignedIn]);

  const loadModels = useCallback(async () => {
    if (!isSignedIn) {
      setModels([]);
      setSelectedModel("");
      return;
    }

    const data = await apiFetch<ModelEntry[]>("/api/v1/models", {});
    setModels(data);
    if (!selectedModel && data.length > 0) {
      setSelectedModel(data[0].modelKey);
    }
  }, [isSignedIn, selectedModel]);

  const loadChats = useCallback(
    async (query = "") => {
      if (!isSignedIn) {
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        return;
      }

      const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
      const data = await apiFetch<{ items: ChatSummary[] }>(`/api/v1/chats${suffix}`, {});
      setChats(data.items);
      if (!activeChatId && data.items.length > 0) {
        setActiveChatId(data.items[0].id);
      }
    },
    [activeChatId, isSignedIn],
  );

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!isSignedIn) {
        return;
      }

      const data = await apiFetch<{ items: ChatMessage[] }>(`/api/v1/chats/${chatId}/messages`, {});
      setMessages(toUiMessages(data.items));
    },
    [isSignedIn],
  );

  useEffect(() => {
    void loadProfile();
    void loadModels();
    void loadChats();
  }, [loadProfile, loadModels, loadChats]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadChats(searchValue.trim());
    }, 220);

    return () => clearTimeout(timeout);
  }, [loadChats, searchValue]);

  useEffect(() => {
    if (activeChatId) {
      void loadMessages(activeChatId);
    }
  }, [activeChatId, loadMessages]);

  async function createChat(): Promise<string> {
    const data = await apiFetch<{ id: string }>("/api/v1/chats", {
      method: "POST",
      body: {},
    });

    await loadChats(searchValue);
    return data.id;
  }

  async function handleNewChat() {
    if (!canCreateNewChat || !isSignedIn) {
      return;
    }

    const chatId = await createChat();
    setActiveChatId(chatId);
    setMessages([]);
    setPendingFiles([]);
    setInput("");
    setError(null);
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextFiles: LocalFile[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} exceeds 1MB.`);
        continue;
      }

      if (!isMimeAllowed(file)) {
        setError(`${file.name} has an unsupported file type.`);
        continue;
      }

      nextFiles.push({
        localId: `${file.name}-${crypto.randomUUID()}`,
        file,
      });
    }

    setPendingFiles((curr) => [...curr, ...nextFiles]);
  }

  function removePendingFile(localId: string) {
    setPendingFiles((curr) => curr.filter((f) => f.localId !== localId));
  }

  async function uploadAttachments(): Promise<string[]> {
    const uploadedIds: string[] = [];

    for (const item of pendingFiles) {
      const presign = await apiFetch<{ attachmentId: string; uploadUrl: string }>(
        "/api/v1/attachments/presign",
        {
          method: "POST",
          body: {
            fileName: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            sizeBytes: item.file.size,
          },
        },
      );

      const formData = new FormData();
      formData.append("file", item.file);

      const uploadResponse = await fetch(toApiUrl(presign.uploadUrl), {
        method: "PUT",
        headers: buildAuthHeaders(null),
        body: formData,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(text || "Upload failed");
      }

      await apiFetch(`/api/v1/attachments/${presign.attachmentId}/finalize`, {
        method: "POST",
      });

      uploadedIds.push(presign.attachmentId);
    }

    return uploadedIds;
  }

  async function sendMessage(seedText?: string) {
    if (!isSignedIn) {
      setError("Log in from the sidebar first.");
      return;
    }

    const trimmedText = (seedText ?? input).trim();
    if (!trimmedText || isSending || !selectedModel) {
      return;
    }

    setError(null);
    setIsSending(true);

    const optimisticUserId = crypto.randomUUID();
    const optimisticAssistantId = crypto.randomUUID();

    setMessages((curr) => [
      ...curr,
      { id: optimisticUserId, role: "user", text: trimmedText },
      { id: optimisticAssistantId, role: "assistant", text: "", pending: true },
    ]);

    if (!seedText) {
      setInput("");
    }

    try {
      const chatId = activeChatId ?? (await createChat());
      if (!activeChatId) {
        setActiveChatId(chatId);
      }

      const attachmentIds = await uploadAttachments();
      setPendingFiles([]);

      const response = await fetch(toApiUrl(`/api/v1/chats/${chatId}/messages/stream`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(null),
        },
        body: JSON.stringify({
          modelKey: selectedModel,
          text: trimmedText,
          attachmentIds,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Failed to stream response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = streamChunks(buffer);

        const endsWithSeparator = buffer.endsWith("\n\n");
        const consumableCount = endsWithSeparator ? events.length : Math.max(events.length - 1, 0);

        for (let i = 0; i < consumableCount; i += 1) {
          const event = events[i];
          const payloadLine = event
            .split("\n")
            .find((line) => line.startsWith("data:"));

          if (!payloadLine) {
            continue;
          }

          const raw = payloadLine.replace("data:", "").trim();
          if (!raw) {
            continue;
          }

          const parsed = JSON.parse(raw) as
            | { type: "assistant.delta"; text: string }
            | { type: "assistant.completed" }
            | { type: "usage.updated" }
            | { type: "error"; message: string };

          if (parsed.type === "assistant.delta") {
            setMessages((curr) =>
              curr.map((message) =>
                message.id === optimisticAssistantId
                  ? { ...message, text: `${message.text}${parsed.text}` }
                  : message,
              ),
            );
          }

          if (parsed.type === "assistant.completed") {
            setMessages((curr) =>
              curr.map((message) =>
                message.id === optimisticAssistantId ? { ...message, pending: false } : message,
              ),
            );
            void loadChats(searchValue);
            void loadProfile();
          }

          if (parsed.type === "error") {
            setError(parsed.message);
            setMessages((curr) =>
              curr.map((message) =>
                message.id === optimisticAssistantId
                  ? {
                      ...message,
                      pending: false,
                      text: message.text || `Error: ${parsed.message}`,
                    }
                  : message,
              ),
            );
          }
        }

        buffer = endsWithSeparator ? "" : events[events.length - 1] ?? "";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((curr) =>
        curr.map((m) =>
          m.id === optimisticAssistantId
            ? { ...m, pending: false, text: m.text || `Error: ${message}` }
            : m,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleLogin() {
    const base = loginEmail.trim().toLowerCase();
    if (!base) {
      return;
    }

    const nextSession: DevSession = {
      email: base,
      userId: base.replace(/[^a-z0-9]/gi, "-") || crypto.randomUUID(),
      role: loginRole,
    };

    saveDevSession(nextSession);
    setSession(nextSession);
    setShowLoginForm(false);
    setError(null);
  }

  function handleLogout() {
    saveDevSession(null);
    setSession(null);
    setProfile(null);
    setChats([]);
    setMessages([]);
    setModels([]);
    setSelectedModel("");
    setPendingFiles([]);
    setInput("");
    setError(null);
  }

  return (
    <main className={`page-shell ${menuOpen ? "" : "menu-collapsed"}`}>
      <aside className={`sidebar ${menuOpen ? "" : "sidebar-collapsed"}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="brand-stripe" aria-hidden />
            <span className="brand-wordmark">gb-ai</span>
          </div>

          <div className="side-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMenuOpen((curr) => !curr)}
              aria-label="Toggle sidebar"
            >
              {menuOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>

            <button
              type="button"
              className="side-button"
              onClick={() => {
                void handleNewChat();
              }}
              disabled={!canCreateNewChat}
              title={!canCreateNewChat ? "Start chatting first" : "Start a new chat"}
            >
              <CirclePlus size={16} className="side-button-icon" />
              <span className="side-button-label">New chat</span>
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={() => setSearchOpen((curr) => !curr)}
              aria-label="Search chats"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {searchOpen && menuOpen ? (
          <div className="sidebar-search">
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search chats"
              disabled={!isSignedIn}
            />
          </div>
        ) : null}

        <div className="chat-list">
          {groupedChats.map(([day, dayChats]) => (
            <div key={day} className="chat-day-group">
              <div className="chat-day-label">{utcDayLabel(day)}</div>
              {dayChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-item ${activeChatId === chat.id ? "active" : ""}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <div className="chat-item-title">{chat.preview || chat.title}</div>
                  <div className="chat-item-meta">{new Date(chat.updatedAtUtc).toUTCString()}</div>
                </button>
              ))}
            </div>
          ))}

          {!isSignedIn ? (
            <div style={{ padding: "10px", color: "var(--ink-soft)", fontSize: "0.82rem" }}>
              Log in to view and search your chat history.
            </div>
          ) : null}
        </div>

        <div className="sidebar-bottom">
          {isSignedIn && session ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: "0.78rem" }}>
                {profile ? `${profile.user.email} · ${profile.plan.name}` : `${session.email} · ${session.role}`}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href="/admin"
                  className="side-button"
                  style={{ textAlign: "center", padding: "8px", justifyContent: "center" }}
                >
                  <Shield size={14} className="side-button-icon" />
                  <span className="side-button-label">Admin</span>
                </a>
                <button
                  type="button"
                  className="side-button"
                  style={{ textAlign: "center", padding: "8px", justifyContent: "center" }}
                  onClick={handleLogout}
                >
                  <LogOut size={14} className="side-button-icon" />
                  <span className="side-button-label">Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                className="side-button"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
                onClick={() => setShowLoginForm((curr) => !curr)}
              >
                <UserCircle2 size={16} />
                <span className="side-button-label">Log in</span>
                <LogIn size={14} style={{ marginLeft: "auto" }} />
              </button>

              {showLoginForm ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="email@example.com"
                    style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px" }}
                  />
                  <select
                    value={loginRole}
                    onChange={(e) => setLoginRole(e.target.value === "admin" ? "admin" : "user")}
                    style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px" }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="button" className="side-button" onClick={handleLogin}>
                    Continue
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      <section className="main-frame">
        <div className="chat-scroll">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-card">
                <h1>gb-ai</h1>
                <p>Pick a prompt to start, or type your own. File uploads are limited to 1MB.</p>
                <div className="empty-grid">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="example-chip"
                      onClick={() => {
                        void sendMessage(prompt);
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="message-col">
              {messages.map((message) => (
                <div key={message.id} className={`bubble-row ${message.role === "user" ? "user" : "assistant"}`}>
                  <div className={`bubble ${message.role} ${message.pending ? "waiting" : ""}`}>{message.text || "..."}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer-box">
            <textarea
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={!isSignedIn}
            />

            <div className="composer-row">
              <div className="composer-left">
                <select
                  className="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!isSignedIn || models.length === 0}
                >
                  {models.map((model) => (
                    <option key={model.modelKey} value={model.modelKey}>
                      {model.displayName}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="attach-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isSignedIn}
                >
                  <Paperclip size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Attach
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
              </div>

              <div className="composer-right">
                <button
                  type="button"
                  className="send-button"
                  disabled={!isSignedIn || isSending || !input.trim()}
                  onClick={() => {
                    void sendMessage();
                  }}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {pendingFiles.length > 0 ? (
              <div className="file-row">
                {pendingFiles.map((item) => (
                  <span key={item.localId} className="file-chip">
                    {item.file.name}
                    <button type="button" onClick={() => removePendingFile(item.localId)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {error ? (
              <p style={{ color: "var(--danger)", marginTop: 8, fontSize: "0.82rem", marginBottom: 0 }}>{error}</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
