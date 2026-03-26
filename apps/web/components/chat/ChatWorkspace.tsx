"use client";

import { useChatSession } from "@/lib/useChatSession";
import { usePwaLifecycle } from "@/lib/usePwaLifecycle";
import { formatFirstName, getTimeOfDayGreeting } from "@/lib/greeting";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import {
  ArrowLeft,
  ArrowUp,
  Download,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  Share,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type ChatWorkspaceProps = {
  initialChatId?: string | null;
};

const markdownComponents: Components = {
  a: ({ children, href, ...props }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
};

export default function ChatWorkspace({ initialChatId }: ChatWorkspaceProps) {
  const {
    session,
    chats,
    activeChatId,
    setActiveChatId,
    messages,
    selectedModel,
    input,
    setInput,
    sendMessage,
    isSending,
    handleNewChat,
    fileInputRef,
    handleFilesSelected,
    pendingFiles,
    removePendingFile,
    error,
    guestMessageLimit,
    isGuestLimitReached,
  } = useChatSession();
  const {
    isInstallable,
    promptInstall,
    updateAvailable,
    applyUpdate,
    isOffline,
  } = usePwaLifecycle();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const sidebarPanelId = useId();
  const greeting = getTimeOfDayGreeting(currentTime.getHours());
  const firstName = session ? formatFirstName(session.email) : "";
  const greetingText = `Good ${greeting}${firstName ? ` ${firstName}` : ""}.`;
  const isEmptyState = messages.length === 0;
  const guestLimitReached = !session && isGuestLimitReached;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const refreshGreeting = () => {
      setCurrentTime(new Date());
    };

    refreshGreeting();
    const timer = window.setInterval(refreshGreeting, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (initialChatId && chats.some((chat) => chat.id === initialChatId) && activeChatId !== initialChatId) {
      setActiveChatId(initialChatId);
    }
  }, [activeChatId, chats, initialChatId, setActiveChatId]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSidebarOpen]);

  return (
    <div className="relative flex h-dvh min-h-dvh overflow-hidden bg-white font-sans text-[#0B1221] selection:bg-[#00247D] selection:text-white">
      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-slate-900/30 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside
        id={sidebarPanelId}
        className={`fixed inset-y-0 left-0 z-30 flex w-[280px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden border-r border-slate-200 bg-[rgb(237,242,244)] shadow-xl shadow-blue-900/10 transition-transform duration-300 md:relative md:inset-auto md:z-20 md:h-dvh md:w-[280px] md:max-w-none md:shadow-none ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
        } md:translate-x-0`}
      >
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#00247D] via-[#C8102E] to-[#00247D]" />

        <div className="flex h-24 items-center px-8 pt-4">
          <div className="relative h-12 w-36">
            <Image src="/LogoTransp.png" alt="gb-ai" fill className="object-contain object-left" />
          </div>
        </div>

        <div className="px-6 pb-3">
          <button
            type="button"
            onClick={() => {
              void handleNewChat();
              setIsSidebarOpen(false);
            }}
            disabled={isSending}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00247D] to-[#001B54] px-4 py-3 text-white shadow-lg shadow-blue-900/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-900/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
            <span className="text-sm font-semibold tracking-wide">New Session</span>
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00247D]/15 bg-white px-3 py-2 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#00247D]/5"
            >
              <ArrowLeft size={14} />
              <span>Hub</span>
            </Link>
            <Link
              href="/widgets"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00247D]/15 bg-white px-3 py-2 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#00247D]/5"
            >
              <Settings2 size={14} />
              <span>Setup</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-4">
          <div className="px-4 pb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Recent Activity</div>
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                setActiveChatId(chat.id);
                setIsSidebarOpen(false);
              }}
              disabled={isSending}
              className={`flex w-full items-center rounded-xl p-3 text-left transition-all duration-200 ${
                activeChatId === chat.id
                  ? "border border-blue-50 bg-white text-[#00247D] shadow-md"
                  : "text-slate-600 hover:bg-white/50 hover:text-[#00247D]"
              }`}
            >
              <div className={`mr-3 h-2 w-2 rounded-full ${activeChatId === chat.id ? "bg-[#C8102E]" : "bg-slate-300"}`} />
              <span className="truncate text-sm font-medium">{chat.title || "Untitled Chat"}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <SignedIn>
            <div className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#0B1221]">{session?.email.split("@")[0] ?? "User"}</div>
                <div className="text-[10px] font-medium text-slate-500">Authenticated</div>
              </div>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8",
                    userButtonTrigger: "focus:shadow-none",
                  },
                }}
              />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="grid grid-cols-2 gap-2">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg border border-[#00247D]/20 px-3 py-2 text-xs font-bold text-[#00247D] transition-colors hover:bg-[#00247D]/5"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg bg-[#00247D] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#001B54]"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </div>
      </aside>

      <main className="relative z-10 m-3 flex min-w-0 flex-1 flex-col overflow-hidden bg-white shadow-2xl shadow-slate-200/50 md:m-4 md:ml-0">
        <header className="flex h-20 items-center justify-between border-b border-slate-100 bg-white px-4 md:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-colors hover:text-[#00247D] md:hidden"
              aria-label="Toggle sidebar"
              aria-controls={sidebarPanelId}
              aria-expanded={isSidebarOpen}
            >
              <Menu size={16} />
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-[#F8FAFF] px-3 py-1.5 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#EEF3FF]"
              >
                <ArrowLeft size={13} />
                <span>Hub</span>
              </Link>
              <Link
                href="/widgets"
                className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-[#F8FAFF] px-3 py-1.5 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#EEF3FF]"
              >
                <Settings2 size={13} />
                <span>Setup</span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">
                <WifiOff size={12} />
                <span className="hidden sm:inline">Offline mode: browsing only</span>
                <span className="sm:hidden">Offline</span>
              </span>
            ) : null}
            {isInstallable ? (
              <button
                type="button"
                onClick={() => {
                  void promptInstall();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#00247D]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#00247D]/5"
              >
                <Download size={14} />
                <span>Install App</span>
              </button>
            ) : null}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-colors hover:text-[#00247D]"
              aria-label="Share"
            >
              <Share size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-8 scroll-smooth">
          <div className={`mx-auto max-w-3xl ${isEmptyState ? "flex h-full flex-col" : "space-y-8"}`}>
            {isEmptyState ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="relative mb-6 h-36 w-56">
                  <Image src="/LogoTransp.png" alt="gb-ai logo" fill className="object-contain drop-shadow-2xl" />
                </div>
                <h1 className="greeting-heading mb-3 text-3xl font-bold" data-text={greetingText}>
                  {greetingText}
                </h1>
                <p className="max-w-md text-lg text-slate-500">How can I help you today?</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex animate-in slide-in-from-bottom-2 fade-in duration-500 ${message.role === "user" ? "justify-end" : "w-full justify-start"}`}
                >
                  <div
                    className={`${message.role === "user" ? "max-w-[85%] rounded-2xl p-6" : "w-full px-0 py-1"} ${
                      message.role === "user"
                        ? "rounded-tr-sm bg-[#00247D] text-white shadow-lg shadow-blue-900/20"
                        : "text-[#0B1221]"
                    }`}
                  >
                    <div className="text-[15px] leading-relaxed">
                      {message.role === "assistant" ? (
                        <div className="chat-markdown">
                          {message.pending && !message.text ? (
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300" />
                              <span className="ml-1 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">Thinking</span>
                            </div>
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                              {message.text}
                            </ReactMarkdown>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.text}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {!isEmptyState ? <div ref={messagesEndRef} /> : null}
          </div>
        </div>

        {updateAvailable ? (
          <div className="px-4 pt-3 md:px-6">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-[#00247D]/15 bg-[#F8FAFC] px-4 py-2.5 text-sm text-slate-700">
              <span>New version available.</span>
              <button
                type="button"
                onClick={applyUpdate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00247D] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#001B54]"
              >
                <RefreshCw size={13} />
                <span>Refresh now</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:p-6 md:pb-6">
          <div className="group relative mx-auto max-w-3xl">
            <div className="relative flex items-end gap-3 rounded-[1.3rem] border border-white bg-white/90 p-2 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || guestLimitReached}
                className="rounded-xl p-3 text-slate-400 transition-all hover:bg-blue-50/50 hover:text-[#00247D]"
                aria-label="Attach files"
              >
                <Plus size={22} />
              </button>
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFilesSelected(e.target.files)} />

              {pendingFiles.length > 0 ? (
                <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 px-2">
                  {pendingFiles.map((file) => (
                    <div
                      key={file.localId}
                      className="flex items-center gap-1 rounded-full border border-blue-100 bg-white/90 px-3 py-1 text-[10px] font-bold text-[#00247D] shadow-sm backdrop-blur"
                    >
                      <span className="max-w-48 truncate">{file.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(file.localId)}
                        className="rounded-full p-0.5 text-[#00247D] hover:bg-blue-100"
                        aria-label={`Remove ${file.file.name}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={guestLimitReached ? "Sign in to continue chatting..." : "Message GB-AI..."}
                disabled={isSending || guestLimitReached}
                className="chat-input min-h-[52px] max-h-32 flex-1 resize-none border-none bg-transparent py-3.5 text-base text-[#0B1221] placeholder:text-slate-400 focus:ring-0"
                rows={1}
              />

              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={!input.trim() || isSending || !selectedModel || guestLimitReached}
                className="flex items-center justify-center rounded-xl bg-[#00247D] p-3 text-white shadow-md transition-all active:scale-95 hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {isSending ? <LoaderCircle size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
              </button>
            </div>

            {guestLimitReached ? (
              <div className="mt-3 rounded-2xl border border-[#00247D]/15 bg-gradient-to-br from-[#FDFEFF] via-[#F8FAFF] to-[#EEF3FF] p-4 shadow-lg shadow-[#00247D]/8">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-white p-2 text-[#00247D] shadow-sm">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-500 uppercase">Guest limit reached</p>
                    <h3 className="mt-1 text-base font-semibold text-[#0B1221]">
                      You&apos;ve used all {guestMessageLimit} complimentary messages.
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Create an account or sign in to keep this conversation going and save your history.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SignUpButton mode="modal">
                        <button
                          type="button"
                          className="rounded-xl bg-[#00247D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#001B54]"
                        >
                          Create Free Account
                        </button>
                      </SignUpButton>
                      <SignInButton mode="modal">
                        <button
                          type="button"
                          className="rounded-xl border border-[#00247D]/20 bg-white px-4 py-2 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#00247D]/5"
                        >
                          Sign In
                        </button>
                      </SignInButton>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {error && !guestLimitReached ? <p className="mt-2 text-center text-xs font-medium text-[#C8102E]">{error}</p> : null}
            {!error && isSending ? (
              <p className="mt-2 text-center text-xs font-medium text-slate-500">Sending message and waiting for response...</p>
            ) : null}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-center opacity-50">
              <Zap size={10} className="fill-[#C8102E] text-[#C8102E]" />
              <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Powered by British Intelligence</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
