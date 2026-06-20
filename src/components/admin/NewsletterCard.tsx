import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Eye, Users } from "lucide-react";

function yesterdayBRT(): string {
  const nowBrt = new Date(Date.now() - 3 * 3600 * 1000);
  nowBrt.setUTCDate(nowBrt.getUTCDate() - 1);
  return nowBrt.toISOString().slice(0, 10);
}

export default function NewsletterCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<string>(yesterdayBRT());
  const [testEmail, setTestEmail] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !testEmail) setTestEmail(user.email);
  }, [user]);

  const run = async (kind: "test" | "preview" | "all") => {
    if (kind === "all") {
      if (!confirm("Enviar newsletter para TODOS os usuários cadastrados?")) return;
      if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return;
    }
    setLoading(kind);
    try {
      const body: any = { date };
      if (kind === "test") body.testEmail = testEmail;
      if (kind === "preview") body.dryRun = true;

      const { data, error } = await supabase.functions.invoke("send-daily-newsletter", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (kind === "preview") {
        const w = window.open("", "_blank");
        if (w) { w.document.write(data.html); w.document.close(); }
        toast({ title: "Pré-visualização aberta", description: `Assunto: ${data.subject}` });
      } else if (kind === "test") {
        toast({ title: "Teste enviado!", description: `${data.sent} enviado, ${data.failed} falhou.` });
      } else {
        toast({
          title: "Newsletter enviada!",
          description: `${data.sent}/${data.recipients} enviados. Falhas: ${data.failed}.`,
          variant: data.failed > 0 ? "destructive" : "default",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message ?? "Falha no envio", variant: "destructive" });
    }
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> NEWSLETTER DIÁRIA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nl-date">Data de referência (BRT)</Label>
            <Input id="nl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nl-email">E-mail para teste</Label>
            <Input id="nl-email" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => run("preview")} disabled={loading !== null}>
            <Eye className="h-4 w-4 mr-2" /> {loading === "preview" ? "Gerando..." : "Pré-visualizar"}
          </Button>
          <Button variant="outline" onClick={() => run("test")} disabled={loading !== null || !testEmail}>
            <Send className="h-4 w-4 mr-2" /> {loading === "test" ? "Enviando..." : "Enviar teste"}
          </Button>
          <Button onClick={() => run("all")} disabled={loading !== null}>
            <Users className="h-4 w-4 mr-2" /> {loading === "all" ? "Enviando..." : "Enviar para todos"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Envio automático todo dia às 07:00 (BRT) com o resumo do dia anterior.
        </p>
      </CardContent>
    </Card>
  );
}
