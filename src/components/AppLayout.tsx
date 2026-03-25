import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          {/* A classe overflow-y-auto foi devolvida para permitir que as páginas rolem para baixo */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}