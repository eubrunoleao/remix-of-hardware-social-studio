import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  { v: "spam", l: "Spam ou propaganda" },
  { v: "ofensivo", l: "Conteúdo ofensivo" },
  { v: "enganoso", l: "Informação enganosa" },
  { v: "outro", l: "Outro motivo" },
];

export function ReportDialog({ postId }: { postId: string }) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const { error } = await supabase
      .from("reports")
      .insert({ post_id: postId, reporter_id: userId!, reason, details: details.trim() || null });
    setBusy(false);
    if (error && error.code !== "23505") { toast.error("Não foi possível enviar a denúncia"); return; }
    toast.success(error ? "Você já denunciou esta publicação" : "Denúncia enviada à moderação");
    setOpen(false);
    setDetails("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto" aria-label="Denunciar">
          <Flag />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar publicação</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Motivo">
          {REASONS.map((r) => (
            <label key={r.v} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reason" checked={reason === r.v} onChange={() => setReason(r.v)} className="accent-primary" />
              {r.l}
            </label>
          ))}
          <Textarea aria-label="Detalhes" placeholder="Detalhes (opcional)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={busy}>{busy ? "Enviando…" : "Enviar denúncia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
