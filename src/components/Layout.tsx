import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Trophy, Home, Calendar, User, Shield, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/games", label: "Jogos", icon: Calendar },
  { to: "/ranking", label: "Ranking", icon: Trophy },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-xl sticky top-0 z-50 overflow-hidden">
        {/* Decorative accent stripe */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-secondary via-secondary/60 to-secondary" />
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-secondary/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 left-1/3 w-56 h-56 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="absolute inset-0 bg-secondary/40 blur-md rounded-full group-hover:bg-secondary/60 transition-colors" />
              <Trophy className="relative h-7 w-7 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.6)]" />
            </div>
            <span
              className="text-2xl md:text-[1.6rem] font-extrabold tracking-tight leading-none"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Bolão <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent italic">do Zap</span>
              <span className="text-primary-foreground/60 mx-1.5 font-light">·</span>
              <span className="text-secondary font-black">2026</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? "secondary" : "ghost"}
                  size="sm"
                  className={location.pathname === item.to ? "" : "text-primary-foreground hover:bg-primary-foreground/10"}
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
                  className={location.pathname === "/profile" ? "" : "text-primary-foreground hover:bg-primary-foreground/10"}
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
                  className={location.pathname === "/admin" ? "" : "text-primary-foreground hover:bg-primary-foreground/10"}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10">
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="secondary" size="sm">Entrar</Button>
              </Link>
            )}
          </nav>

          {/* Mobile menu button */}
          <button className="md:hidden text-primary-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-primary-foreground/20 px-4 pb-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
                <Button variant={location.pathname === item.to ? "secondary" : "ghost"} size="sm" className={`w-full justify-start ${location.pathname !== item.to ? "text-primary-foreground" : ""}`}>
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
            {user && (
              <Link to="/profile" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start text-primary-foreground">
                  <User className="h-4 w-4 mr-2" />
                  Perfil
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start text-primary-foreground">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <Button variant="ghost" size="sm" onClick={() => { signOut(); setMenuOpen(false); }} className="w-full justify-start text-primary-foreground">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            ) : (
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full">Entrar</Button>
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="relative bg-gradient-to-br from-primary to-primary/90 text-primary-foreground/80 py-8 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary to-transparent" />
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-secondary" />
            <span style={{ fontFamily: "'Outfit', sans-serif" }} className="font-bold tracking-wide">Bolão do Zap · 2026</span>
          </div>
          <span className="opacity-70">Feito com ⚽ pra galera do grupo</span>
        </div>
      </footer>
    </div>
  );
}
