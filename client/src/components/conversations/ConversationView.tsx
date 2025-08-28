import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { ConversationMessage } from "@shared/schema";

export interface ConversationViewProps {
  conversationId: string;
  messages: ConversationMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  /** When false, component becomes read-only preview (no composer, last N messages only) */
  allowCompose?: boolean;
  /** How many most recent messages to show in preview mode */
  previewCount?: number;
  /** Tailwind height class for the container card (e.g., h-[60vh]); defaults to h-96 */
  heightClass?: string;
}

// Wrapped props pattern to avoid sporadic ReferenceError reports for heightClass in some builds.
export default function ConversationView(props: ConversationViewProps) {
  const {
    conversationId,
    messages,
    onSendMessage,
    isLoading,
    allowCompose = true,
    previewCount = 5,
    heightClass = 'h-[75vh]',
  } = props;
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Track previous message count so we only auto-scroll on new activity, not on initial load
  const prevCountRef = useRef<number>(messages?.length || 0);
  // Use the provided height class or fallback. (Explicit default above guarantees defined value.)
  const containerHeight = heightClass;

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  // In preview mode only show the last N messages (keep chronological order)
  const visibleMessages = useMemo(
    () => (allowCompose ? sorted : sorted.slice(-previewCount)),
    [allowCompose, sorted, previewCount]
  );

  function dayKey(d: Date) {
    return d.toDateString();
  }
  function formatTime(d: Date) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const grouped = useMemo(() => {
    const acc: Record<string, ConversationMessage[]> = {};
    visibleMessages.forEach((m) => {
      const k = dayKey(new Date(m.createdAt));
      (acc[k] ||= []).push(m);
    });
    return acc;
  }, [visibleMessages]);

  useEffect(() => {
    // Auto-scroll to bottom only when composing AND after the initial render
    if (!allowCompose) return;
    const isInitial = prevCountRef.current === 0 || prevCountRef.current === visibleMessages.length;
    prevCountRef.current = visibleMessages.length;
    if (!isInitial) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allowCompose, visibleMessages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (content) {
      onSendMessage(content);
      setNewMessage("");
    }
  };

  return (
    <Card className={`${containerHeight} flex flex-col min-h-0`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Conversation</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
          {visibleMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>{allowCompose ? "No messages yet. Start the conversation." : "No conversation yet."}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([day, items]) => (
              <div key={day} className="space-y-2">
                <div className="sticky top-0 z-10 flex justify-center">
                  <span className="text-xs text-muted-foreground bg-white/80 px-2 py-0.5 rounded-md">
                    {day}
                  </span>
                </div>
                {items.map((message) => (
                  <div key={message.id} className={`flex ${message.isFromAI ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                        message.isFromAI ? "bg-gray-100 text-gray-900" : "bg-blue-500 text-white"
                      }`}
                    >
                      {/* Optional label based on available metadata */}
                      <p className="text-[10px] opacity-70 mb-0.5">
                        {message.isFromAI ? "AI" : allowCompose ? "You" : "Lead"}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">{formatTime(new Date(message.createdAt))}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
        {allowCompose ? (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 min-h-[60px] max-h-32 resize-none"
              onKeyDown={(e) => {
                const isCmdEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
                if ((e.key === "Enter" && !e.shiftKey) || isCmdEnter) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button type="submit" disabled={isLoading || !newMessage.trim()}>
              {isLoading ? "..." : "Send"}
            </Button>
          </form>
        ) : (
          <div className="border-t pt-2 mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Preview only</span>
            <Link href="/conversations" className="text-blue-600 hover:underline">Open full conversation</Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
