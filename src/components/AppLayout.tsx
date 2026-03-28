import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const alertShown = useRef(false);

  // Verificação em tempo real do status do caixa (sem cache longo)
  const { data: caixaAberto, isSuccess, isFetching } = useQuery({
    queryKey: ["verificar_caixa_aberto_layout"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixas")
        .select("id, status")
        .eq("status", "aberto")
        .maybeSingle();
      
      if (error) throw error;
      return data; // Retorna o objeto do caixa se aberto, ou null se não encontrar
    },
    staleTime: 0, // Garante que sempre vai buscar a informação fresca ao fazer login
    refetchOnMount: true // Força a verificação toda vez que o layout for montado
  });

  useEffect(() => {
    // Só dispara se: concluiu a busca (isSuccess), não está pegando do cache (!isFetching), 
    // o retorno for estritamente null (caixa fechado), e o alerta ainda não foi mostrado nesta sessão.
    if (isSuccess && !isFetching && caixaAberto === null && !alertShown.current) {
      alertShown.current = true; 
      
      setTimeout(() => {
        toast.warning("Atenção: O Caixa está Fechado!", {
          description: "Inicie o dia abrindo o caixa para registar suas vendas.",
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
          duration: 8000,
          action: {
            label: "Ir para Gestão",
            onClick: () => navigate("/financeiro"),
          },
        });
      }, 500);
    }
  }, [caixaAberto, isSuccess, isFetching, navigate]);

  return (
    <SidebarProvider>
      <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}