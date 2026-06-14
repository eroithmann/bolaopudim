import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Download, Trophy, Target, Award, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BadgeDef, PersonalStats } from "@/lib/gamification";

interface Props {
  userName: string;
  position: number | null;
  stats: PersonalStats;
  badges: BadgeDef[];
  trigger?: React.ReactNode;
}

const APP_NAME = "Bolão Pudim";
const APP_URL = "bolaopudim.lovable.app";

function buildShareText(name: string, position: number | null, stats: PersonalStats): string {
  const lines = [
    `🏆 ${name} no ${APP_NAME}`,
    "",
    position ? `📊 Posição: #${position}` : null,
    `⚽ Pontos: ${stats.totalPoints}`,
    `🎯 Placares exatos: ${stats.exactScores}`,
    `✅ Resultados certos: ${stats.winnerHits}`,
    stats.longestHitStreak >= 2 ? `🔥 Maior sequência: ${stats.longestHitStreak}` : null,
    "",
    `Entra no bolão: ${APP_URL}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export default function ShareCard({ userName, position, stats, badges, trigger }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const unlocked = badges.filter((b) => b.unlocked).slice(0, 4);
  const shareText = buildShareText(userName, position, stats);

  const generateBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0a1d12",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await generateBlob();
      if (!blob) return;
      const file = new File([blob], "bolao-pudim.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: shareText, title: APP_NAME });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "bolao-pudim.png";
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Imagem baixada!", description: "Compartilhe no seu app favorito." });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Erro ao compartilhar", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await generateBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "bolao-pudim.png";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(shareText);
    toast({ title: "Texto copiado!" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" className="w-full sm:w-auto">
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar perfil
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[420px] p-4">
        <DialogHeader>
          <DialogTitle>Compartilhar perfil</DialogTitle>
        </DialogHeader>

        {/* Card visual — 1080x1080 escalado */}
        <div className="overflow-hidden rounded-xl border">
          <div style={{ width: 1080, height: 1080, transform: "scale(0.34)", transformOrigin: "top left" }}>
            <div
              ref={cardRef}
              style={{
                width: 1080,
                height: 1080,
                background: "linear-gradient(135deg, #0a3d1f 0%, #145a30 50%, #0a1d12 100%)",
                color: "#fff",
                fontFamily: "Inter, system-ui, sans-serif",
                padding: 64,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Glow decoration */}
              <div style={{
                position: "absolute", top: -200, right: -200, width: 600, height: 600,
                borderRadius: "50%", background: "radial-gradient(circle, rgba(250,204,21,0.18) 0%, transparent 70%)",
              }} />

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 1 }}>
                <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 2, color: "#facc15" }}>
                  ⚽ BOLÃO PUDIM
                </div>
                {position && (
                  <div style={{
                    background: "#facc15", color: "#0a1d12", borderRadius: 999,
                    padding: "12px 28px", fontWeight: 900, fontSize: 36,
                  }}>
                    #{position}
                  </div>
                )}
              </div>

              {/* Name */}
              <div style={{ zIndex: 1 }}>
                <div style={{ fontSize: 28, opacity: 0.7, marginBottom: 8 }}>Apostador</div>
                <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, marginBottom: 16, wordBreak: "break-word" }}>
                  {userName}
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, zIndex: 1 }}>
                <StatBox label="PONTOS" value={String(stats.totalPoints)} accent />
                <StatBox label="PLACARES EXATOS" value={String(stats.exactScores)} />
                <StatBox label="RESULTADOS CERTOS" value={String(stats.winnerHits)} />
                <StatBox label="MAIOR SEQUÊNCIA" value={`${stats.longestHitStreak} 🔥`} />
              </div>

              {/* Badges */}
              {unlocked.length > 0 && (
                <div style={{ zIndex: 1 }}>
                  <div style={{ fontSize: 24, opacity: 0.7, marginBottom: 16, letterSpacing: 1 }}>CONQUISTAS</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {unlocked.map((b) => (
                      <div key={b.id} style={{
                        background: "rgba(250,204,21,0.15)", border: "2px solid rgba(250,204,21,0.4)",
                        borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <span style={{ fontSize: 40 }}>{b.emoji}</span>
                        <span style={{ fontSize: 22, fontWeight: 700 }}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ textAlign: "center", fontSize: 24, opacity: 0.7, zIndex: 1 }}>
                {APP_URL}
              </div>
            </div>
          </div>
          {/* Spacer to keep dialog height tied to the scaled card */}
          <div style={{ height: 1080 * 0.34, marginTop: -1080 }} aria-hidden />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Button onClick={handleShare} disabled={busy} className="text-xs">
            <Share2 className="h-4 w-4 mr-1" /> Compartilhar
          </Button>
          <Button onClick={handleDownload} disabled={busy} variant="secondary" className="text-xs">
            <Download className="h-4 w-4 mr-1" /> Baixar
          </Button>
          <Button onClick={handleCopyText} disabled={busy} variant="outline" className="text-xs">
            <Copy className="h-4 w-4 mr-1" /> Texto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "rgba(250,204,21,0.18)" : "rgba(255,255,255,0.08)",
      border: `2px solid ${accent ? "rgba(250,204,21,0.5)" : "rgba(255,255,255,0.15)"}`,
      borderRadius: 20, padding: 28,
    }}>
      <div style={{ fontSize: 20, opacity: 0.7, marginBottom: 8, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 72, fontWeight: 900, color: accent ? "#facc15" : "#fff", lineHeight: 1 }}>{value}</div>
    </div>
  );
}
