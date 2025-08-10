import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { ConversationMessage } from "@shared/schema";

export default function ConversationView({
  conversationId,
  messages,
  onSendMessage,
  isLoading,
}: {
  conversationId: string;
  messages: ConversationMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}) {
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  function dayKey(d: Date) {
    return d.toDateString();
  }
  function formatTime(d: Date) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const grouped = useMemo(() => {
    const acc: Record<string, ConversationMessage[]> = {};
    sorted.forEach((m) => {
      const k = dayKey(new Date(m.createdAt));
      (acc[k] ||= []).push(m);
    });
    return acc;
  }, [sorted]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (content) {
      onSendMessage(content);
      setNewMessage("");
    }
  };

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Conversation</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {sorted.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No messages yet. Start the conversation.</p>
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
                        {message.isFromAI ? "AI" : "You"}
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
      </CardContent>
    </Card>
  );
}
