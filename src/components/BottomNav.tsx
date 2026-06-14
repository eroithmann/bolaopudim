import { Link, useLocation } from "react-router-dom";
import { Home, Calendar, Trophy, BarChart3, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/games", label: "Jogos", icon: Calendar },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/profile", label: "Perfil", icon: User, authOnly: true },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const visible = items.filter((i) => !i.authOnly || user);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-2px_12px_-4px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className={`grid h-16`} style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`relative flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`} />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
