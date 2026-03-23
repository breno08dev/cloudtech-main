import { Sun, Moon, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/40 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 print:hidden transition-all duration-300">
      
      {/* Lado Esquerdo: Gatilho do Menu */}
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-colors" />
        {/* Espaço reservado para um futuro título de página ou Breadcrumb */}
      </div>
      
      {/* Lado Direito: Ações e Tema */}
      <div className="flex items-center gap-3">
        
        {/* Ícone de Notificações (Apenas UI Premium) */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
          title="Notificações"
        >
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
          <Bell className="h-5 w-5" />
        </Button>

        {/* Separador Visual */}
        <div className="h-5 w-[1px] bg-border/60 mx-1 hidden sm:block"></div>

        {/* Alternador de Tema */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          title="Alternar Tema"
          className="rounded-full hover:bg-primary/10 transition-colors"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5 text-slate-600 hover:text-primary transition-colors" />
          ) : (
            <Sun className="h-5 w-5 text-amber-400 hover:text-amber-300 transition-colors" />
          )}
        </Button>

      </div>
    </header>
  );
}