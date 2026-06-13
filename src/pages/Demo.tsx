import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Home, Calendar, User, Users, Medal, MapPin, Clock, Lock, Save, Eye } from "lucide-react";
import { getFlagUrl } from "@/lib/teamFlags";

// ============ MOCK DATA (fictício, sem dados reais) ============
const mockTeams = {
  BRA: { name: "Brasil", code: "BRA" },
  ARG: { name: "Argentina", code: "ARG" },
  FRA: { name: "França", code: "FRA" },
  ESP: { name: "Espanha", code: "ESP" },
  ALE: { name: "Alemanha", code: "DEU" },
  POR: { name: "Portugal", code: "PRT" },
  ING: { name: "Inglaterra", code: "ENG" },
  ITA: { name: "Itália", code: "ITA" },
};

const mockMatches = [
  {
    id: "m1",
    phase: "Fase de Grupos",
    group_name: "Grupo A",
    match_date: "2026-06-12T17:00:00Z",
    venue: "Estádio Azteca, Cidade do México",
    status: "finished",
    home_score: 2,
    away_score: 1,
    home_team: mockTeams.BRA,
    away_team: mockTeams.ARG,
    my_prediction: { home: 2, away: 1, points: 5 },
    distribution: { home: 142, draw: 38, away: 65, total: 245 },
  },
  {
    id: "m2",
    phase: "Fase de Grupos",
    group_name: "Grupo B",
    match_date: "2026-06-13T20:00:00Z",
    venue: "MetLife Stadium, Nova York",
    status: "scheduled",
    home_score: null,
    away_score: null,
    home_team: mockTeams.FRA,
    away_team: mockTeams.ESP,
    my_prediction: { home: 1, away: 1, points: null },
    odds: { home: 2.4, draw: 3.1, away: 2.8 },
  },
  {
    id: "m3",
    phase: "Fase de Grupos",
    group_name: "Grupo C",
    match_date: "2026-06-15T18:30:00Z",
    venue: "SoFi Stadium, Los Angeles",
    status: "scheduled",
    home_score: null,
    away_score: null,
    home_team: mockTeams.ALE,
    away_team: mockTeams.POR,
    my_prediction: null,
    odds: { home: 2.6, draw: 3.3, away: 2.5 },
  },
  {
    id: "m4",
    phase: "Fase de Grupos",
    group_name: "Grupo D",
    match_date: "2026-06-11T15:00:00Z",
    venue: "AT&T Stadium, Dallas",
    status: "finished",
    home_score: 0,
    away_score: 0,
    home_team: mockTeams.ING,
    away_team: mockTeams.ITA,
    my_prediction: { home: 1, away: 0, points: 0 },
    distribution: { home: 88, draw: 102, away: 55, total: 245 },
  },
];

const mockRanking = [
  { user_id: "u1", name: "Carlos Mendes", total_points: 47, exact_scores: 5, goal_diff: 4, results_only: 6 },
  { user_id: "u2", name: "Ana Silva", total_points: 43, exact_scores: 4, goal_diff: 5, results_only: 5 },
  { user_id: "u3", name: "João Pereira", total_points: 43, exact_scores: 3, goal_diff: 6, results_only: 7 },
  { user_id: "u4", name: "Você (Demo)", total_points: 38, exact_scores: 3, goal_diff: 4, results_only: 5 },
  { user_id: "u5", name: "Mariana Costa", total_points: 35, exact_scores: 2, goal_diff: 5, results_only: 6 },
  { user_id: "u6", name: "Pedro Lima", total_points: 31, exact_scores: 2, goal_diff: 4, results_only: 5 },
  { user_id: "u7", name: "Beatriz Souza", total_points: 28, exact_scores: 1, goal_diff: 5, results_only: 4 },
  { user_id: "u8", name: "Rafael Alves", total_points: 22, exact_scores: 1, goal_diff: 3, results_only: 4 },
];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) +
    " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

// ============ COMPONENTS ============

function DemoBanner() {
  return (
    <div className="bg-secondary/95 text-secondary-foreground border-b border-secondary-foreground/20">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Eye className="h-4 w-4" />
          <span>MODO DEMO — dados fictícios para demonstração</span>
        </div>
        <Link to="/auth">
          <Button size="sm" variant="default">Criar conta</Button>
        </Link>
      </div>
    </div>
  );
}

function DemoHeader({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const items = [
    { id: "home", label: "Início", icon: Home },
    { id: "games", label: "Jogos", icon: Calendar },
    { id: "apostas", label: "Apostas da Galera", icon: Users },
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "profile", label: "Meu Perfil", icon: User },
  ];
  return (
    <header className="relative bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-xl sticky top-0 z-40 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-secondary via-secondary/60 to-secondary" />
      <div className="relative max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-7 w-7 text-secondary" />
          <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Bolão <span className="text-secondary italic">do Zap</span>
            <span className="text-primary-foreground/60 mx-1.5 font-light">·</span>
            <span className="text-secondary font-black">Demo</span>
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => (
            <Button
              key={it.id}
              size="sm"
              variant={tab === it.id ? "secondary" : "ghost"}
              onClick={() => setTab(it.id)}
              className={tab === it.id ? "" : "text-primary-foreground hover:bg-primary-foreground/10"}
            >
              <it.icon className="h-4 w-4 mr-1" />
              {it.label}
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function DemoHome({ setTab }: { setTab: (t: string) => void }) {
  const next = mockMatches.find((m) => m.status === "scheduled")!;
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          PALPITE, GANHE, ZOEIRA.
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          O bolão da Copa 2026 do seu grupo do zap.
        </p>
        <div className="flex gap-3 justify-center">
          <Button size="lg" onClick={() => setTab("games")}>Ver jogos</Button>
          <Button size="lg" variant="outline" onClick={() => setTab("ranking")}>Ver ranking</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Card><CardHeader><CardTitle className="text-lg">⚽ 64 jogos</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">Da fase de grupos até a grande final em Nova York.</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">🎯 5 pts por placar exato</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">Multiplicadores crescem conforme avança o torneio.</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">🏆 Ranking ao vivo</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">Pontos calculados automaticamente após cada jogo.</CardContent></Card>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader><CardTitle>Próximo jogo</CardTitle></CardHeader>
        <CardContent>
          <DemoMatchCard match={next} />
        </CardContent>
      </Card>
    </div>
  );
}

function DemoMatchCard({ match, editable = false }: { match: typeof mockMatches[0]; editable?: boolean }) {
  const [score, setScore] = useState({ home: "", away: "" });
  return (
    <Card className={match.status === "finished" ? "border-primary/30" : ""}>
      <CardContent className="py-4 px-4 sm:px-6">
        <div className="flex justify-between items-start mb-4 text-xs text-muted-foreground">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{formatDate(match.match_date)}</span>
            {match.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue}</span>}
          </div>
          <div className="flex items-center gap-2">
            {match.group_name && <Badge variant="outline" className="text-xs">{match.group_name}</Badge>}
            {match.status === "finished" ? <Lock className="h-3 w-3" /> : <span className="flex items-center gap-1 font-mono text-[11px]"><Clock className="h-3 w-3" />2d 4h</span>}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="font-semibold text-sm sm:text-base truncate text-right">{match.home_team.name}</span>
            <img src={getFlagUrl(match.home_team.code)} alt="" className="h-7 w-10 object-cover rounded shadow-sm shrink-0" />
          </div>
          <div className="shrink-0 min-w-[60px] text-center">
            {match.status === "finished" ? (
              <span className="font-bold text-xl tabular-nums">{match.home_score} – {match.away_score}</span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">vs</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={getFlagUrl(match.away_team.code)} alt="" className="h-7 w-10 object-cover rounded shadow-sm shrink-0" />
            <span className="font-semibold text-sm sm:text-base truncate">{match.away_team.name}</span>
          </div>
        </div>

        {match.odds && (
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-[10px] uppercase tracking-wider opacity-60">Probabilidade</span>
            <span className="bg-muted px-2 py-0.5 rounded font-mono">1: {Math.round((1 / match.odds.home) * 100)}%</span>
            <span className="bg-muted px-2 py-0.5 rounded font-mono">X: {Math.round((1 / match.odds.draw) * 100)}%</span>
            <span className="bg-muted px-2 py-0.5 rounded font-mono">2: {Math.round((1 / match.odds.away) * 100)}%</span>
          </div>
        )}

        {match.distribution && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>🏠 {Math.round((match.distribution.home / match.distribution.total) * 100)}%</span>
              <span className="font-medium">{match.distribution.total} palpites</span>
              <span>{Math.round((match.distribution.away / match.distribution.total) * 100)}% 🏟️</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              <div className="bg-emerald-500" style={{ width: `${(match.distribution.home / match.distribution.total) * 100}%` }} />
              <div className="bg-gray-400" style={{ width: `${(match.distribution.draw / match.distribution.total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(match.distribution.away / match.distribution.total) * 100}%` }} />
            </div>
          </div>
        )}

        {editable && match.status !== "finished" && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Palpite:</span>
              <Input type="number" min="0" max="20" className="w-16 h-8 text-center" placeholder="0"
                value={score.home} onChange={(e) => setScore({ ...score, home: e.target.value })} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" min="0" max="20" className="w-16 h-8 text-center" placeholder="0"
                value={score.away} onChange={(e) => setScore({ ...score, away: e.target.value })} />
              <Button size="sm" className="h-8">Salvar</Button>
            </div>
          </div>
        )}

        {match.status === "finished" && match.my_prediction && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Seu palpite:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{match.my_prediction.home} – {match.my_prediction.away}</span>
              <Badge className={match.my_prediction.points && match.my_prediction.points >= 3 ? "bg-primary" : ""} variant={match.my_prediction.points === 0 ? "destructive" : "default"}>
                {match.my_prediction.points} pts
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DemoGames() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
        <Calendar className="h-8 w-8 text-primary" /> JOGOS
      </h1>
      <p className="text-muted-foreground mb-6">Dê seu palpite até 1 hora antes do início do jogo.</p>
      <div className="space-y-4">
        {mockMatches.map((m) => <DemoMatchCard key={m.id} match={m} editable />)}
      </div>
    </div>
  );
}

function DemoApostas() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" /> APOSTAS DA GALERA
      </h1>
      <p className="text-muted-foreground mb-6">Depois que os palpites travam, veja o que cada um chutou.</p>
      <Card>
        <CardHeader><CardTitle>Brasil vs Argentina — Final 2 × 1</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Jogador</TableHead><TableHead className="text-center">Palpite</TableHead><TableHead className="text-center">Pontos</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { n: "Carlos Mendes", p: "2-1", pts: 5 },
                { n: "Ana Silva", p: "2-0", pts: 2 },
                { n: "João Pereira", p: "3-2", pts: 3 },
                { n: "Você (Demo)", p: "2-1", pts: 5 },
                { n: "Mariana Costa", p: "1-1", pts: 0 },
                { n: "Pedro Lima", p: "1-0", pts: 1 },
              ].map((r) => (
                <TableRow key={r.n}>
                  <TableCell className="font-medium">{r.n}</TableCell>
                  <TableCell className="text-center font-mono">{r.p}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.pts === 0 ? "destructive" : "default"}>{r.pts} pts</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoRanking() {
  const getMedalColor = (pos: number) => pos === 0 ? "text-yellow-500" : pos === 1 ? "text-gray-400" : pos === 2 ? "text-amber-700" : "";
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
        <Trophy className="h-8 w-8 text-secondary" /> RANKING GERAL
      </h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
                <TableHead className="text-center">Exatos</TableHead>
                <TableHead className="text-center">Saldo</TableHead>
                <TableHead className="text-center">Resultados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRanking.map((e, i) => (
                <TableRow key={e.user_id} className={e.name.includes("Você") ? "bg-primary/5" : ""}>
                  <TableCell className="font-bold">
                    <span className={`flex items-center gap-1 ${getMedalColor(i)}`}>
                      {i < 3 && <Medal className="h-4 w-4" />}{i + 1}º
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-center font-bold text-primary text-lg">{e.total_points}</TableCell>
                  <TableCell className="text-center">{e.exact_scores}</TableCell>
                  <TableCell className="text-center">{e.goal_diff}</TableCell>
                  <TableCell className="text-center">{e.results_only}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoProfile() {
  const stats = { total: 38, exact: 3, partial: 4, results: 5 };
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
        <User className="h-8 w-8 text-primary" /> MEU PERFIL
      </h1>
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-xl">DADOS</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm text-muted-foreground">Email</label><p className="font-medium">demo@bolaodozap.com</p></div>
            <div><label className="text-sm text-muted-foreground">Nome</label><Input defaultValue="Você (Demo)" /></div>
            <Button className="w-full"><Save className="h-4 w-4 mr-2" />Salvar</Button>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Trophy className="h-5 w-5 text-secondary" />DESEMPENHO</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center mb-6">
              <div className="p-3 rounded-lg bg-primary/10"><span className="block text-2xl font-bold text-primary">{stats.total}</span><span className="text-xs text-muted-foreground">Total pts</span></div>
              <div className="p-3 rounded-lg bg-primary/10"><span className="block text-2xl font-bold text-primary">{stats.exact}</span><span className="text-xs text-muted-foreground">Exatos</span></div>
              <div className="p-3 rounded-lg bg-secondary/20"><span className="block text-2xl font-bold">{stats.partial}</span><span className="text-xs text-muted-foreground">Saldo</span></div>
              <div className="p-3 rounded-lg bg-muted"><span className="block text-2xl font-bold">{stats.results}</span><span className="text-xs text-muted-foreground">Resultados</span></div>
            </div>
            <h3 className="font-semibold mb-3">Meus Palpites ({mockMatches.length})</h3>
            <div className="space-y-2">
              {mockMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <span className="truncate flex-1">{m.home_team.name} vs {m.away_team.name}</span>
                  <span className="mx-2 font-medium">{m.my_prediction ? `${m.my_prediction.home} - ${m.my_prediction.away}` : "—"}</span>
                  {m.my_prediction?.points !== null && m.my_prediction?.points !== undefined && (
                    <Badge variant={m.my_prediction.points >= 3 ? "default" : m.my_prediction.points === 0 ? "destructive" : "outline"} className="text-xs">
                      {m.my_prediction.points} pts
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Demo() {
  const [tab, setTab] = useState("home");
  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner />
      <DemoHeader tab={tab} setTab={setTab} />
      {/* Mobile tabs */}
      <div className="md:hidden border-b bg-background sticky top-16 z-30">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start overflow-x-auto h-auto rounded-none bg-transparent p-0">
            <TabsTrigger value="home">Início</TabsTrigger>
            <TabsTrigger value="games">Jogos</TabsTrigger>
            <TabsTrigger value="apostas">Apostas</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <main className="flex-1">
        {tab === "home" && <DemoHome setTab={setTab} />}
        {tab === "games" && <DemoGames />}
        {tab === "apostas" && <DemoApostas />}
        {tab === "ranking" && <DemoRanking />}
        {tab === "profile" && <DemoProfile />}
      </main>
      <footer className="bg-primary text-primary-foreground/80 py-6 text-center text-sm">
        <span>Bolão do Zap · 2026 — versão demo com dados fictícios</span>
      </footer>
    </div>
  );
}
