import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, buildAuthHeaders, toApiUrl } from "@/lib/api";
import type { ChatMessage, ChatSummary, ModelEntry } from "@/lib/types";

export const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

export type LocalFile = {
  localId: string;
  file: File;
};

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  pending?: boolean;
};

export type DevSession = {
  userId: string;
  email: string;
  role: "user" | "admin";
};

export type AuthMeResponse = {
  user: { id: string; email: string; role: string };
  plan: { name: string };
  usage: { dailyCreditsUsed: number; dailyCreditLimit: number };
};

export function toUiMessages(messages: ChatMessage[]): UiMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.displayText,
  }));
}

export function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function utcDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isMimeAllowed(file: File): boolean {
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

export function loadDevSession(): DevSession | null {
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

export function saveDevSession(session: DevSession | null) {
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

export function useChatSession() {
  const [session, setSession] = useState<DevSession | null>(null);
  const [loginEmail, setLoginEmail] = useState("demo@gb-ai.local");
  const [loginRole, setLoginRole] = useState<"user" | "admin">("user");

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    return true;
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

  return {
    session,
    loginEmail,
    setLoginEmail,
    loginRole,
    setLoginRole,
    searchValue,
    setSearchValue,
    profile,
    chats,
    groupedChats,
    activeChatId,
    setActiveChatId,
    messages,
    models,
    selectedModel,
    setSelectedModel,
    input,
    setInput,
    fileInputRef,
    pendingFiles,
    isSending,
    error,
    isSignedIn,
    canCreateNewChat,
    handleNewChat,
    handleFilesSelected,
    removePendingFile,
    sendMessage,
    handleLogin,
    handleLogout,
  };
}
