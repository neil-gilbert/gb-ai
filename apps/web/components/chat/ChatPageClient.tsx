"use client";

import { useSearchParams } from "next/navigation";
import ChatWorkspace from "@/components/chat/ChatWorkspace";

export default function ChatPageClient() {
  const searchParams = useSearchParams();

  return <ChatWorkspace initialChatId={searchParams.get("chat")} />;
}
