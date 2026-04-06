import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Wrench,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  Settings,
  PlusCircle,
  List,
  LogOut,
  Banknote,
  PanelLeftClose,
  PanelLeft,
  BookOpenCheck // <-- Ícone novo para o crediário
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit3 } from "lucide-react"; 

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile, toggleSidebar, state } = useSidebar();
  
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setOpenMobile(false);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-sidebar/95 backdrop-blur-xl shadow-sm print:hidden transition-all duration-300">
      
      <SidebarHeader className={cn("p-4 border-b border-border/30 flex transition-all", isCollapsed ? "justify-center items-center" : "justify-between items-center flex-row")}>
        {!isCollapsed && (
          <Link to="/" onClick={handleLinkClick} className="flex justify-center transition-transform hover:scale-105 duration-300 overflow-hidden">
            <img
              src="/conectnewlogo.png"
              alt="Conect New"
              className="max-h-22 w-auto object-contain drop-shadow-md dark:brightness-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<span class="font-black text-xl text-primary uppercase tracking-widest">Conect New</span>');
              }}
            />
          </Link>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar} 
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title={isCollapsed ? "Expandir Menu" : "Minimizar Menu"}
        >
          {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </SidebarHeader>

      <SidebarContent className="p-2 space-y-6 mt-2 scrollbar-thin flex flex-col h-full">

        <div className="flex-1 space-y-6">
          
          {/* GRUPO 1: ATENDIMENTO */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold ml-1 mb-2 group-data-[collapsible=icon]:hidden">Atendimento</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Ordens de Serviço" className="font-medium text-foreground hover:bg-primary/5">
                    <Wrench className="h-4 w-4 text-amber-500" />
                    <span>Ordens de Serviço</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive("/ordens/nova")} className="font-medium">
                        <Link to="/ordens/nova" onClick={handleLinkClick}>
                          <PlusCircle className="h-3.5 w-3.5 mr-2" /> Abrir Nova O.S
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive("/ordens")} className="font-medium">
                        <Link to="/ordens" onClick={handleLinkClick}>
                          <List className="h-3.5 w-3.5 mr-2" /> Consultar O.S
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>

                <SidebarMenuItem className="mt-2 group-data-[collapsible=icon]:mt-0">
                  <SidebarMenuButton asChild isActive={isActive("/vendas")} tooltip="PDV / Vendas" className="font-medium hover:bg-primary/5">
                    <Link to="/vendas" onClick={handleLinkClick}>
                      <ShoppingCart className="h-4 w-4 text-emerald-500" />
                      <span>Frente de Caixa (PDV)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarMenuItem className="mt-2 group-data-[collapsible=icon]:mt-0">
           <SidebarMenuButton asChild isActive={isActive("/gravacao")} tooltip="Gravação a Laser" className="font-medium hover:bg-primary/5">
         <Link to="/gravacao" onClick={handleLinkClick}>
           <Edit3 className="h-4 w-4 text-pink-500" />
          <span>Gravação de Copos</span>
            </Link>
           </SidebarMenuButton>
            </SidebarMenuItem>

          {/* GRUPO 2: CADASTROS */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold ml-1 mb-2 group-data-[collapsible=icon]:hidden">Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/clientes")} tooltip="Clientes" className="font-medium hover:bg-primary/5">
                    <Link to="/clientes" onClick={handleLinkClick}>
                      <Users className="h-4 w-4 text-blue-500" />
                      <span>Gestão de Clientes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* NOVO MENU DE CREDIÁRIO AQUI */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/crediario")} tooltip="Crediário" className="font-medium mt-1 hover:bg-primary/5 group-data-[collapsible=icon]:mt-0">
                    <Link to="/crediario" onClick={handleLinkClick}>
                      <BookOpenCheck className="h-4 w-4 text-orange-500" />
                      <span>Crediário</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* FIM NOVO MENU DE CREDIÁRIO */}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* GRUPO 3: ADMINISTRAÇÃO */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold ml-1 mb-2 group-data-[collapsible=icon]:hidden">Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Dashboard Inicial" className="font-medium hover:bg-primary/5">
                    <Link to="/" onClick={handleLinkClick}>
                      <Home className="h-4 w-4 text-sky-500" />
                      <span>Dashboard Inicial</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/produtos")} tooltip="Estoque" className="font-medium mt-1 hover:bg-primary/5 group-data-[collapsible=icon]:mt-0">
                    <Link to="/produtos" onClick={handleLinkClick}>
                      <Package className="h-4 w-4 text-indigo-500" />
                      <span>Produtos & Estoque</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/financeiro")} tooltip="Financeiro" className="font-medium mt-1 hover:bg-primary/5 group-data-[collapsible=icon]:mt-0">
                    <Link to="/financeiro" onClick={handleLinkClick}>
                      <Banknote className="h-4 w-4 text-emerald-500" />
                      <span>Gestão Diária</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/relatorios")} tooltip="Relatórios" className="font-medium mt-1 hover:bg-primary/5 group-data-[collapsible=icon]:mt-0">
                    <Link to="/relatorios" onClick={handleLinkClick}>
                      <Wallet className="h-4 w-4 text-purple-500" />
                      <span>Inteligência Financeira</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/configuracoes")} tooltip="Configurações" className="font-medium mt-1 hover:bg-primary/5 group-data-[collapsible=icon]:mt-0">
                    <Link to="/configuracoes" onClick={handleLinkClick}>
                      <Settings className="h-4 w-4 text-slate-500" />
                      <span>Configurações da Loja</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* GRUPO 5: SAIR */}
        <div className="pt-4 mt-auto border-t border-border/30 pb-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    tooltip="Sair do Sistema"
                    className="font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors group cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    <span>Sair do Sistema</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

      </SidebarContent>
    </Sidebar>
  );
}