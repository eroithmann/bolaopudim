import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Trophy,
  Home,
  Calendar,
  User,
  Shield,
  LogOut,
  Menu,
  Users,
  LogIn,
  BarChart3,
} from "lucide-react";
import BottomNav from "./BottomNav";

const navItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/games", label: "Jogos", icon: Calendar },
  { to: "/apostas", label: "Apostas da Galera", icon: Users },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/stats", label: "Stats", icon: BarChart3 },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-lg sticky top-0 z-40 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-secondary via-secondary/60 to-secondary" />
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-secondary/10 blur-2xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-secondary/40 blur-md rounded-full group-hover:bg-secondary/60 transition-colors" />
              <Trophy className="relative h-6 w-6 md:h-7 md:w-7 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.6)]" />
            </div>
            <span
              className="font-extrabold tracking-tight leading-none whitespace-nowrap"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              <span className="hidden md:inline text-xl lg:text-[1.6rem]">
                Bolão{" "}
                <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent italic">
                  do Zap
                </span>
                <span className="hidden lg:inline">
                  <span className="text-primary-foreground/60 mx-1.5 font-light">·</span>
                  <span className="text-secondary font-black">2026</span>
                </span>
              </span>
              <span className="md:hidden text-lg">
                Bolão <span className="text-secondary font-black">2026</span>
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? "secondary" : "ghost"}
                  size="sm"
                  className={
                    location.pathname === item.to
                      ? ""
                      : "text-primary-foreground hover:bg-primary-foreground/10"
                  }
                >
                  <item.icon className="h-4 w-4 mr-1" />
                  {item.label}
                </Button>
              </Link>
            ))}
            {user && (
              <Link to="/profile">
                <Button
                  variant={location.pathname === "/profile" ? "secondary" : "ghost"}
                  size="sm"
                  className={
                    location.pathname === "/profile"
                      ? ""
                      : "text-primary-foreground hover:bg-primary-foreground/10"
                  }
                >
                  <User className="h-4 w-4 mr-1" />
                  {profile?.name || "Perfil"}
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant={location.pathname === "/admin" ? "secondary" : "ghost"}
                  size="sm"
                  className={
                    location.pathname === "/admin"
                      ? ""
                      : "text-primary-foreground hover:bg-primary-foreground/10"
                  }
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="secondary" size="sm">
                  Entrar
                </Button>
              </Link>
            )}
          </nav>

          {/* Mobile: drawer só para ações secundárias */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                aria-label="Abrir menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Conta</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {user ? (
                  <>
                    <div className="px-3 py-3 rounded-md bg-muted/50 mb-2">
                      <p className="text-xs text-muted-foreground">Logado como</p>
                      <p className="font-medium truncate">
                        {profile?.name || user.email}
                      </p>
                    </div>
                    <Link to="/profile" onClick={() => setDrawerOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start">
                        <User className="h-4 w-4 mr-2" />
                        Meu perfil
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setDrawerOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">
                          <Shield className="h-4 w-4 mr-2" />
                          Admin
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        signOut();
                        setDrawerOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setDrawerOpen(false)}>
                    <Button className="w-full">
                      <LogIn className="h-4 w-4 mr-2" />
                      Entrar
                    </Button>
                  </Link>
                )}
              </div>
              <p className="mt-8 text-xs text-muted-foreground text-center">
                Use as abas inferiores para navegar 👇
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <footer className="relative bg-gradient-to-br from-primary to-primary/90 text-primary-foreground/80 py-8 overflow-hidden hidden md:block">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary to-transparent" />
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-secondary" />
            <span
              style={{ fontFamily: "'Outfit', sans-serif" }}
              className="font-bold tracking-wide"
            >
              Bolão do Zap · 2026
            </span>
          </div>
          <span className="opacity-70">Feito com ⚽ pra galera do grupo</span>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
