import { useAuth, useUser } from "@clerk/clerk-react";
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

export type SessionUser = {
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

export function useChatSession() {
  const { isLoaded: isAuthLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const signedIn = Boolean(isSignedIn);

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

  const session = useMemo<SessionUser | null>(() => {
    if (!signedIn || !userId) {
      return null;
    }

    const email =
      user?.primaryEmailAddress?.emailAddress
      ?? user?.emailAddresses[0]?.emailAddress
      ?? profile?.user.email
      ?? `${userId}@unknown.local`;

    return {
      userId,
      email,
      role: profile?.user.role?.toLowerCase() === "admin" ? "admin" : "user",
    };
  }, [profile?.user.email, profile?.user.role, signedIn, user, userId]);

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

  const getAccessToken = useCallback(async () => {
    if (!signedIn) {
      return null;
    }

    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken, signedIn]);

  const loadProfile = useCallback(async () => {
    if (!isAuthLoaded || !signedIn) {
      setProfile(null);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setProfile(null);
      return;
    }

    try {
      const data = await apiFetch<AuthMeResponse>("/api/v1/auth/me", { token });
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, [getAccessToken, isAuthLoaded, signedIn]);

  const loadModels = useCallback(async () => {
    if (!isAuthLoaded || !signedIn) {
      setModels([]);
      setSelectedModel("");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setModels([]);
      setSelectedModel("");
      return;
    }

    const data = await apiFetch<ModelEntry[]>("/api/v1/models", { token });
    setModels(data);
    if (!selectedModel && data.length > 0) {
      setSelectedModel(data[0].modelKey);
    }
  }, [getAccessToken, isAuthLoaded, selectedModel, signedIn]);

  const loadChats = useCallback(
    async (query = "") => {
      if (!isAuthLoaded || !signedIn) {
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        return;
      }

      const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
      const data = await apiFetch<{ items: ChatSummary[] }>(`/api/v1/chats${suffix}`, { token });
      setChats(data.items);
      if (!activeChatId && data.items.length > 0) {
        setActiveChatId(data.items[0].id);
      }
    },
    [activeChatId, getAccessToken, isAuthLoaded, signedIn],
  );

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!isAuthLoaded || !signedIn) {
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const data = await apiFetch<{ items: ChatMessage[] }>(`/api/v1/chats/${chatId}/messages`, { token });
      setMessages(toUiMessages(data.items));
    },
    [getAccessToken, isAuthLoaded, signedIn],
  );

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    void loadProfile();
    void loadModels();
    void loadChats();
  }, [isAuthLoaded, loadProfile, loadModels, loadChats]);

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

  async function createChat(token: string): Promise<string> {
    const data = await apiFetch<{ id: string }>("/api/v1/chats", {
      method: "POST",
      body: {},
      token,
    });

    await loadChats(searchValue);
    return data.id;
  }

  async function handleNewChat() {
    if (!canCreateNewChat || !signedIn) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    const chatId = await createChat(token);
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

  async function uploadAttachments(token: string): Promise<string[]> {
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
          token,
        },
      );

      const formData = new FormData();
      formData.append("file", item.file);

      const uploadResponse = await fetch(toApiUrl(presign.uploadUrl), {
        method: "PUT",
        headers: buildAuthHeaders(token),
        body: formData,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(text || "Upload failed");
      }

      await apiFetch(`/api/v1/attachments/${presign.attachmentId}/finalize`, {
        method: "POST",
        token,
      });

      uploadedIds.push(presign.attachmentId);
    }

    return uploadedIds;
  }

  async function sendMessage(seedText?: string) {
    if (!signedIn) {
      setError("Sign in or create an account to start chatting.");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setError("Your session expired. Please sign in again.");
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
      const chatId = activeChatId ?? (await createChat(token));
      if (!activeChatId) {
        setActiveChatId(chatId);
      }

      const attachmentIds = await uploadAttachments(token);
      setPendingFiles([]);

      const response = await fetch(toApiUrl(`/api/v1/chats/${chatId}/messages/stream`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(token),
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

  return {
    session,
    isAuthLoaded,
    isSignedIn: signedIn,
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
    canCreateNewChat,
    handleNewChat,
    handleFilesSelected,
    removePendingFile,
    sendMessage,
  };
}
