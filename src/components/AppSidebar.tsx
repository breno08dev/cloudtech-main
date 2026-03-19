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
  CloudLightning
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
  useSidebar, // <-- IMPORTANTE: Importamos o Hook que controla o estado do menu
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar(); // Extraímos a função que fecha o menu no telemóvel

  // Função para verificar se a rota atual corresponde ao botão
  const isActive = (path: string) => location.pathname === path;

  // Função para fechar o menu ao clicar (útil principalmente no mobile)
  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  return (
    <Sidebar className="border-r border-border/50 bg-card shadow-sm print:hidden">
      
      {/* Cabeçalho da Sidebar (Logo) */}
      <SidebarHeader className="p-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl shadow-sm border border-primary/20">
            <CloudLightning className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-wider text-primary leading-none uppercase">Cloud Tech</span>
            <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1.5">Assistência & PDV</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-3 space-y-6 mt-2 scrollbar-thin">

        {/* GRUPO 1: VISÃO GERAL */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-black ml-1 mb-2">Visão Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Dashboard" className="font-semibold transition-all">
                  <Link to="/" onClick={handleLinkClick}>
                    <Home className="h-4 w-4" />
                    <span>Dashboard Inicial</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 2: ATENDIMENTO */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-black ml-1 mb-2">Atendimento</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              
              {/* Ordens de Serviço com Sub-Menu */}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Ordens de Serviço" className="font-bold text-foreground">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  <span>Ordens de Serviço</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
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

              {/* PDV */}
              <SidebarMenuItem className="mt-2">
                <SidebarMenuButton asChild isActive={isActive("/vendas")} tooltip="PDV / Vendas" className="font-semibold">
                  <Link to="/vendas" onClick={handleLinkClick}>
                    <ShoppingCart className="h-4 w-4 text-emerald-500" />
                    <span>Frente de Caixa (PDV)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 3: CADASTROS */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-black ml-1 mb-2">Cadastros & Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/produtos")} tooltip="Estoque" className="font-semibold">
                  <Link to="/produtos" onClick={handleLinkClick}>
                    <Package className="h-4 w-4 text-indigo-500" />
                    <span>Produtos & Estoque</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/clientes")} tooltip="Clientes" className="font-semibold mt-1">
                  <Link to="/clientes" onClick={handleLinkClick}>
                    <Users className="h-4 w-4 text-blue-500" />
                    <span>Gestão de Clientes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 4: ADMINISTRAÇÃO */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-black ml-1 mb-2">Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/relatorios")} tooltip="Relatórios" className="font-semibold">
                  <Link to="/relatorios" onClick={handleLinkClick}>
                    <Wallet className="h-4 w-4 text-purple-500" />
                    <span>Inteligência Financeira</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/configuracoes")} tooltip="Configurações" className="font-semibold mt-1">
                  <Link to="/configuracoes" onClick={handleLinkClick}>
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span>Configurações da Loja</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}