"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  Copy,
  Check,
  Loader2,
  Bot,
  Paperclip,
  Mic,
  ArrowUp,
  Plus,
  History,
  Building2,
  Coins,
  StickyNote,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ContextRail,
  type SuggestedAction,
} from "@/components/assistant/context-rail";
import { TypingIndicator } from "@/components/assistant/typing-indicator";
import { useSession } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";

const H1: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h1 className="mt-2 mb-3 text-2xl font-bold" {...props} />
);
const H2: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h2 className="mt-2 mb-2 text-xl font-semibold" {...props} />
);
const H3: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h3 className="mt-2 mb-2 text-lg font-semibold" {...props} />
);
const Paragraph: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = (
  props
) => <p className="mb-3 leading-7 text-sm" {...props} />;
const UL: React.FC<React.HTMLAttributes<HTMLUListElement>> = (props) => (
  <ul className="mb-3 ml-5 list-disc space-y-1 text-sm" {...props} />
);
const OL: React.FC<React.OlHTMLAttributes<HTMLOListElement>> = (props) => (
  <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm" {...props} />
);
const LI: React.FC<React.LiHTMLAttributes<HTMLLIElement>> = (props) => (
  <li className="leading-6" {...props} />
);
const Anchor: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = (
  props
) => (
  <a
    className="underline underline-offset-2 text-primary hover:opacity-90"
    target="_blank"
    rel="noreferrer noopener"
    {...props}
  />
);
const Blockquote: React.FC<React.BlockquoteHTMLAttributes<HTMLElement>> = (
  props
) => (
  <blockquote
    className="mb-3 border-l-2 border-border pl-3 text-muted-foreground"
    {...props}
  />
);
const Code: Components["code"] = ({ children, className, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  const isInline = !match;

  if (isInline) {
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props}>
        {children}
      </code>
    );
  }
  return (
    <pre className="mb-3 w-full overflow-x-auto rounded-md bg-muted p-3">
      <code className="text-xs leading-5" {...props}>
        {children}
      </code>
    </pre>
  );
};
const HR: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => (
  <hr className="my-4 border-border" {...props} />
);
const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = (
  props
) => (
  <div className="mb-3 overflow-x-auto">
    <table className="w-full border-collapse text-sm" {...props} />
  </div>
);
const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <th
    className="border border-border bg-muted px-2 py-1 text-left"
    {...props}
  />
);
const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td className="border border-border px-2 py-1" {...props} />
);

const markdownComponents: Components = {
  h1: H1,
  h2: H2,
  h3: H3,
  p: Paragraph,
  ul: UL,
  ol: OL,
  li: LI,
  a: Anchor,
  blockquote: Blockquote,
  code: Code,
  hr: HR,
  table: Table,
  th: TH,
  td: TD,
};

type TextPart = { type?: string; text?: string };
type MaybePartsMessage = {
  display?: ReactNode;
  parts?: TextPart[];
  content?: TextPart[];
};

function getMessageText(message: MaybePartsMessage): string {
  const parts = Array.isArray(message.parts)
    ? message.parts
    : Array.isArray(message.content)
    ? message.content
    : [];
  return parts
    .filter((p) => p?.type === "text" && p.text)
    .map((p) => p.text)
    .join("\n");
}

function renderMessageContent(message: MaybePartsMessage): ReactNode {
  if (message.display) return message.display;
  const parts = Array.isArray(message.parts)
    ? message.parts
    : Array.isArray(message.content)
    ? message.content
    : [];
  return parts.map((p, idx) =>
    p?.type === "text" && p.text ? (
      <ReactMarkdown key={idx} components={markdownComponents}>
        {p.text}
      </ReactMarkdown>
    ) : null
  );
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const long = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  if (sameDay(date, today)) return `Today · ${long}`;
  if (sameDay(date, yesterday)) return `Yesterday · ${long}`;
  return long;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-muted rounded transition-colors"
      title="Copy to clipboard"
      aria-label="Copy message"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

const STORAGE_KEY = "chat-messages";

/** AI orb badge — gradient square with the assistant glyph. */
function AiOrb({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "from-brand to-chart-4 flex items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
        className
      )}
    >
      <Bot className="size-[55%]" />
    </span>
  );
}

// Composer action chips — seed the composer with a ready-made prompt.
const ACTION_CHIPS: { label: string; icon: typeof Building2; prompt: string }[] =
  [
    {
      label: "Add hotel options",
      icon: Building2,
      prompt: "Add three hotel options with nightly rates for this trip.",
    },
    {
      label: "Estimate price in EUR",
      icon: Coins,
      prompt: "Estimate the total price of this trip in EUR, itemised.",
    },
    {
      label: "Add visa notes",
      icon: StickyNote,
      prompt: "Add the visa requirements the travellers need for this destination.",
    },
    {
      label: "Build the full proposal",
      icon: FileText,
      prompt: "Build the full proposal for this trip with flights, hotels and pricing.",
    },
  ];

// Suggested actions for the context rail — real prompts seeded into the composer.
const SUGGESTED_ACTIONS: SuggestedAction[] = [
  {
    id: "quote",
    title: "Generate a quote",
    description: "Price the current plan in EUR",
    prompt: "Generate a priced quote for the trip we've been discussing, in EUR.",
    tone: "brand",
    icon: "quote",
  },
  {
    id: "follow-up",
    title: "Draft a follow-up",
    description: "Nudge the client to confirm dates",
    prompt:
      "Draft a short, warm follow-up email asking the client to confirm the travel dates.",
    tone: "green",
    icon: "email",
  },
  {
    id: "visa",
    title: "Check visa rules",
    description: "Entry requirements for the trip",
    prompt: "Summarise the visa and entry requirements for this destination.",
    tone: "amber",
    icon: "visa",
  },
  {
    id: "flights",
    title: "Search flights",
    description: "Compare live fares for the dates",
    prompt: "Search return flights for these dates and compare the best fares.",
    tone: "violet",
    icon: "flight",
  },
];

const EMPTY_SUGGESTIONS = [
  "Find return flights Paris to Marrakech, 2 adults, 12–19 Aug, economy",
  "5-star hotels in Marrakech for 4 nights from 12 Aug, 2 guests",
  "Plan a 5-day honeymoon itinerary in Bali with a €4000 budget",
  "Summarise my current bookings",
];

export default function ChatPage() {
  const { data: session, isPending } = useSession();
  const { messages, sendMessage, status, error, setMessages } = useChat({
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [setMessages]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Keep the thread scrolled to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Chat cleared");
  };

  const isStreaming = status === "streaming";

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      sendMessage({ role: "user", parts: [{ type: "text", text: trimmed }] });
      setInput("");
    },
    [isStreaming, sendMessage]
  );

  // Seed the composer with a prompt (chips + suggested actions) and focus it.
  const seedComposer = useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });
  }, []);

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const agentName = session.user?.name ?? null;

  // Group messages into day-separated blocks for the thread.
  const groups: { key: string; label: string; items: typeof messages }[] = [];
  for (const message of messages) {
    const createdAt = (message as { createdAt?: Date | string }).createdAt;
    const date = createdAt ? new Date(createdAt) : new Date();
    const key = Number.isNaN(date.getTime()) ? "unknown" : dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(message);
    } else {
      groups.push({
        key,
        label: Number.isNaN(date.getTime())
          ? "Conversation"
          : formatDayLabel(date),
        items: [message],
      });
    }
  }

  const showTyping =
    isStreaming && messages[messages.length - 1]?.role === "user";

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-[100dvh]">
      {/* ============ CONVERSATION ============ */}
      <section className="bg-background flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-border bg-card/70 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-sm sm:px-6">
          <AiOrb className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-foreground truncate text-[15px] font-semibold tracking-tight">
                Atlas Assistant
              </h1>
              <Badge
                variant="secondary"
                className="border-brand/20 bg-brand/10 text-brand h-5 gap-1 px-2 text-[10px]"
              >
                Beta
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <span className="inline-flex size-1.5 rounded-full bg-green-500 shadow-[0_0_0_3px] shadow-green-500/20" />
              Search, plan itineraries and draft proposals.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
            disabled={messages.length === 0}
          >
            <Plus className="size-4" />
            New chat
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="History (coming soon)"
            aria-label="History"
            disabled
          >
            <History className="size-4" />
          </Button>
        </header>

        {/* Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {error && (
              <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-lg border p-4">
                <p className="text-destructive text-sm">
                  Error: {error.message || "Something went wrong"}
                </p>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="py-10 text-center">
                <AiOrb className="mx-auto mb-4 size-12 rounded-xl" />
                <h2 className="text-foreground text-lg font-semibold">
                  How can I help you plan today?
                </h2>
                <p className="text-muted-foreground mx-auto mt-1 mb-6 max-w-md text-sm">
                  Ask me to find flights or hotels, build an itinerary, or draft
                  a proposal. Try one of these:
                </p>
                <div className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
                  {EMPTY_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="border-border bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring/50 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => (
                  <div key={group.key} className="space-y-6">
                    <div className="text-muted-foreground flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.06em]">
                      <span className="bg-border h-px flex-1" />
                      {group.label}
                      <span className="bg-border h-px flex-1" />
                    </div>
                    {group.items.map((message) => {
                      const isUser = message.role === "user";
                      const messageText = getMessageText(
                        message as MaybePartsMessage
                      );
                      const createdAt = (
                        message as { createdAt?: Date | string }
                      ).createdAt;
                      const cd = createdAt ? new Date(createdAt) : null;
                      const timestamp =
                        cd && !Number.isNaN(cd.getTime())
                          ? formatTimestamp(cd)
                          : null;

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3",
                            isUser && "flex-row-reverse"
                          )}
                        >
                          {isUser ? (
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="bg-secondary text-secondary-foreground text-[11px] font-semibold">
                                {initials(agentName)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <AiOrb className="size-8 shrink-0" />
                          )}

                          <div
                            className={cn(
                              "group min-w-0 max-w-[86%]",
                              isUser && "flex flex-col items-end"
                            )}
                          >
                            <div
                              className={cn(
                                "text-muted-foreground mb-1.5 flex items-center gap-2 text-[11px]",
                                isUser && "flex-row-reverse"
                              )}
                            >
                              <span className="font-medium">
                                {isUser ? "You" : "Atlas Assistant"}
                              </span>
                              {timestamp && <span>{timestamp}</span>}
                              {!isUser && messageText && (
                                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                                  <CopyButton text={messageText} />
                                </span>
                              )}
                            </div>

                            {isUser ? (
                              <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                                {renderMessageContent(
                                  message as MaybePartsMessage
                                )}
                              </div>
                            ) : (
                              <div className="text-foreground text-sm [&_.gen-card]:mt-2">
                                {renderMessageContent(
                                  message as MaybePartsMessage
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {showTyping && (
                  <div className="flex gap-3">
                    <AiOrb className="size-8 shrink-0" />
                    <div className="pt-1">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-border bg-card/70 border-t px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="mx-auto max-w-3xl">
            {/* Action chips — seed the composer */}
            <div className="mb-2.5 flex flex-wrap gap-2">
              {ACTION_CHIPS.map((chip) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => seedComposer(chip.prompt)}
                    disabled={isStreaming}
                    className="border-border bg-card text-muted-foreground hover:border-primary hover:text-primary hover:bg-accent focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Icon className="size-3.5" />
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="border-input bg-card focus-within:border-ring focus-within:ring-ring/50 flex items-end gap-2 rounded-lg border py-2 pr-2 pl-3 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Ask Atlas to draft, plan, price or research…"
                  disabled={isStreaming}
                  className="text-foreground placeholder:text-muted-foreground max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed outline-none disabled:opacity-50"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Attach (coming soon)"
                    aria-label="Attach a file"
                    disabled
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-40"
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Voice (coming soon)"
                    aria-label="Voice input"
                    disabled
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-40"
                  >
                    <Mic className="size-4" />
                  </button>
                  <Button
                    type="submit"
                    size="icon"
                    className="size-8"
                    disabled={!input.trim() || isStreaming}
                    aria-label="Send message"
                  >
                    {isStreaming ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate">
                Atlas can search flights &amp; hotels live and draft from client
                context. Always review before sending.
              </span>
              <span className="hidden shrink-0 items-center gap-1 sm:flex">
                <kbd className="border-border bg-card text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">
                  ↵
                </kbd>
                to send ·
                <kbd className="border-border bg-card text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">
                  ⇧↵
                </kbd>
                new line
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTEXT RAIL ============ */}
      <ContextRail
        agentName={agentName}
        actions={SUGGESTED_ACTIONS}
        onAction={seedComposer}
      />
    </div>
  );
}
