import { Suspense } from "react";
import ChatPageClient from "@/components/chat/ChatPageClient";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageClient />
    </Suspense>
  );
}
