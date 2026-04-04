import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Camera, X } from "lucide-react";
import Layout from "@/components/Layout";

const EMOJI_OPTIONS = [
  "😎", "🤩", "😂", "🥳", "😈", "🤑", "🫡", "🤪",
  "💀", "👻", "🔥", "❤️", "💪", "👑", "⭐", "🎯",
  "🦁", "🐺", "🦅", "🐉", "🤡", "👽", "🤖", "💩",
];

export default function Auth() { // updated
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setSelectedEmoji(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const clearAvatar = () => {
    setSelectedEmoji(null);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      if (password !== confirmPassword) {
        toast({ title: "Senhas diferentes", description: "As senhas não coincidem.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else if (data.user) {
        // Upload photo or save emoji as avatar
        let avatarUrl: string | null = null;

        if (avatarFile) {
          const ext = avatarFile.name.split(".").pop();
          const path = `${data.user.id}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, avatarFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
            avatarUrl = urlData.publicUrl;
          }
        } else if (selectedEmoji) {
          avatarUrl = selectedEmoji;
        }

        if (avatarUrl) {
          await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("user_id", data.user.id);
        }

        toast({ title: "Cadastro realizado!", description: "Bem-vindo ao Bolão!" });
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle className="text-3xl">{isLogin ? "ENTRAR" : "CADASTRAR"}</CardTitle>
            <CardDescription>
              {isLogin ? "Faça login para participar do bolão" : "Crie sua conta e comece a apostar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <Input
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />

                  {/* Avatar selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Escolha seu avatar
                    </label>

                    {/* Current selection preview */}
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : selectedEmoji ? (
                          <span className="text-3xl">{selectedEmoji}</span>
                        ) : (
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Subir foto
                        </Button>
                        {(selectedEmoji || avatarPreview) && (
                          <Button type="button" variant="ghost" size="sm" onClick={clearAvatar}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* Emoji grid */}
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          className={`text-2xl p-1 rounded hover:bg-accent transition-colors ${
                            selectedEmoji === emoji ? "bg-accent ring-2 ring-primary" : ""
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Senha (mínimo 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {!isLogin && (
                <Input
                  type="password"
                  placeholder="Confirme sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
