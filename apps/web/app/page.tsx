"use client";

import { useChatSession } from "@/lib/useChatSession";
import { ArrowUp, Plus, Settings, Share, X, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

export default function HomePage() {
  const {
    session,
    chats,
    activeChatId,
    setActiveChatId,
    messages,
    input,
    setInput,
    sendMessage,
    isSending,
    handleNewChat,
    handleLogin,
    fileInputRef,
    handleFilesSelected,
    pendingFiles,
    removePendingFile,
    error,
  } = useChatSession();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] font-sans text-[#0B1221] selection:bg-[#00247D] selection:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-[20%] -right-[10%] h-[800px] w-[800px] animate-pulse rounded-full bg-gradient-to-br from-[#00247D]/10 to-[#C8102E]/10 opacity-60 blur-3xl"
          style={{ animationDuration: "8s" }}
        />
        <div className="absolute top-[40%] -left-[10%] h-[600px] w-[600px] rounded-full bg-blue-100/40 opacity-50 blur-3xl" />
      </div>

      <aside className="relative z-20 m-4 flex w-[280px] flex-col overflow-hidden rounded-[2rem] border border-white/50 bg-white/70 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#00247D] via-[#C8102E] to-[#00247D]" />

        <div className="flex h-24 items-center px-8 pt-4">
          <div className="relative h-12 w-36">
            <Image src="/Logo-large.jpg" alt="gb-ai" fill className="object-contain object-left" />
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={() => {
              void handleNewChat();
            }}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00247D] to-[#001B54] px-4 py-3 text-white shadow-lg shadow-blue-900/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-900/30"
          >
            <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
            <span className="text-sm font-semibold tracking-wide">New Session</span>
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-4">
          <div className="px-4 pb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Recent Activity</div>
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => setActiveChatId(chat.id)}
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
          {session ? (
            <div className="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#C8102E] to-[#E34B5C] text-xs font-bold text-white shadow-md">
                {session.email[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#0B1221]">{session.email.split("@")[0]}</div>
                <div className="text-[10px] font-medium text-slate-500">Pro Plan Active</div>
              </div>
              <Settings size={16} className="text-slate-400" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleLogin()}
              className="w-full py-2 text-sm font-bold text-[#00247D] hover:underline"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>

      <main className="relative z-10 m-4 ml-0 flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/40 shadow-2xl shadow-slate-200/50 backdrop-blur-md">
        <header className="flex h-20 items-center justify-between border-b border-white/50 bg-white/30 px-8 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <span className="text-sm font-medium text-slate-600">GB-AI Model 4.0</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-colors hover:text-[#00247D]"
              aria-label="Share"
            >
              <Share size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth">
          <div className="mx-auto max-w-3xl space-y-8">
            {messages.length === 0 ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                <div className="relative mb-6 h-36 w-56">
                  <Image src="/Logo-large.jpg" alt="gb-ai logo" fill className="object-contain drop-shadow-2xl" />
                </div>
                <h1 className="mb-3 text-3xl font-bold text-[#0B1221]">Good afternoon.</h1>
                <p className="max-w-md text-lg text-slate-500">How can I help you today?</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex animate-in slide-in-from-bottom-2 fade-in duration-500 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-6 ${
                      m.role === "user"
                        ? "rounded-tr-sm bg-[#00247D] text-white shadow-lg shadow-blue-900/20"
                        : "rounded-tl-sm border border-white/80 bg-white text-[#0B1221] shadow-sm"
                    }`}
                  >
                    <div className="text-[15px] leading-relaxed">{m.text}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-6">
          <div className="group relative mx-auto max-w-3xl">
            <div className="absolute -inset-0.5 rounded-[1.5rem] bg-gradient-to-r from-[#00247D] via-[#C8102E] to-[#00247D] opacity-20 blur transition duration-500 group-focus-within:opacity-40" />
            <div className="relative flex items-end gap-3 rounded-[1.3rem] border border-white bg-white/90 p-2 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl p-3 text-slate-400 transition-all hover:bg-blue-50/50 hover:text-[#00247D]"
                aria-label="Attach files"
              >
                <Plus size={22} />
              </button>
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFilesSelected(e.target.files)} />

              {pendingFiles.length > 0 ? (
                <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2 px-2">
                  {pendingFiles.map((f) => (
                    <div
                      key={f.localId}
                      className="flex items-center gap-1 rounded-full border border-blue-100 bg-white/90 px-3 py-1 text-[10px] font-bold text-[#00247D] shadow-sm backdrop-blur"
                    >
                      <span className="max-w-48 truncate">{f.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(f.localId)}
                        className="rounded-full p-0.5 text-[#00247D] hover:bg-blue-100"
                        aria-label={`Remove ${f.file.name}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message GB-AI..."
                className="min-h-[52px] max-h-32 flex-1 resize-none border-none bg-transparent py-3.5 text-base text-[#0B1221] placeholder:text-slate-400 focus:ring-0"
                rows={1}
              />

              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={!input.trim() || isSending}
                className="flex items-center justify-center rounded-xl bg-[#00247D] p-3 text-white shadow-md transition-all active:scale-95 hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <ArrowUp size={20} strokeWidth={2.5} />
              </button>
            </div>

            {error ? <p className="mt-2 text-center text-xs font-medium text-[#C8102E]">{error}</p> : null}

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
