import { useState, useRef, useEffect } from "react";
import { apiPost } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User } from "lucide-react";

const CHIPS = [
  "Which leads need follow-up?",
  "Show my overdue invoices.",
  "Which leads came from Google?",
  "Which deals are close to being won?",
  "Show this month's revenue.",
  "Draft a follow-up message for a new lead.",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your CRM assistant. Ask me anything about your leads, deals, invoices or clients." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const { reply } = await apiPost("/ai/chat", { message: msg });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't process that right now." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-up h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" />AI Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">Powered by GPT-5.4, grounded in your CRM data.</p>
      </div>

      <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="ai-messages">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${m.role === "user" ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-white" : "bg-slate-100 text-slate-800"}`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="flex gap-3"><div className="h-8 w-8 rounded-lg bg-primary text-white grid place-items-center"><Sparkles className="h-4 w-4" /></div><div className="rounded-2xl px-4 py-3 bg-slate-100"><span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" /><span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.15s]" /><span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.3s]" /></span></div></div>}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button key={c} onClick={() => send(c)} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-primary hover:text-primary transition-colors" data-testid="ai-chip">{c}</button>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about your CRM…" data-testid="ai-input" />
          <Button onClick={() => send()} disabled={loading} data-testid="ai-send-button"><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}
