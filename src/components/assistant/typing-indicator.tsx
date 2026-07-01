/**
 * Animated three-dot "assistant is typing" indicator. Pure presentation —
 * shown by the assistant page while a response is streaming.
 */
export function TypingIndicator() {
  return (
    <div
      className="bg-card border-border inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm border px-3.5 py-2.5 shadow-sm"
      role="status"
      aria-label="Atlas Assistant is typing"
    >
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
    </div>
  );
}
