## Adicionar toggle de dark mode

**1. `src/main.tsx`**
- Importar `ThemeProvider` de `next-themes`
- Envolver `<App />` com `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`

**2. `src/components/Layout.tsx`**
- Adicionar imports: `useTheme` de `next-themes` e `Moon`, `Sun` de `lucide-react`
- Dentro do componente: `const { theme, setTheme } = useTheme();`
- No nav desktop, inserir botão de toggle (ghost, icon, com ícones Sun/Moon animados via classes dark:) imediatamente antes do botão Entrar/Sair

CSS de dark mode já está em `index.css` — sem alterações.