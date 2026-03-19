import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 print:hidden">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Alternar Tema">
          {theme === "light" ? <Moon className="h-5 w-5 text-slate-600" /> : <Sun className="h-5 w-5 text-amber-400" />}
        </Button>
      </div>
    </header>
  );
}