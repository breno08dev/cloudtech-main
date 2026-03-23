import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Eye, Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OS_STATUS_MAP } from "@/lib/constants";

interface OS {
  id: string;
  numero_os: string;
  marca_aparelho: string | null;
  modelo_aparelho: string | null;
  imei: string | null;
  status: string;
  valor_total: number;
  created_at: string;
  clientes: { nome: string } | null;
}

const PAGE_SIZE = 10; // Número de ordens por página

export default function OrdensListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Quando o utilizador pesquisa ou filtra, voltamos à primeira página
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  // React Query agora com parâmetros de página, pesquisa e filtro
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["ordens_servico", page, search, statusFilter],
    queryFn: async () => {
      // 1. Iniciamos a query base e pedimos a contagem exata (para saber o total de páginas)
      let query = supabase
        .from("ordens_servico")
        .select("id, numero_os, marca_aparelho, modelo_aparelho, imei, status, valor_total, created_at, clientes(nome)", { count: "exact" });

      // 2. Aplicamos os filtros no servidor
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search) {
        // Busca textual no número da OS, modelo ou IMEI
        query = query.or(`numero_os.ilike.%${search}%,modelo_aparelho.ilike.%${search}%,imei.ilike.%${search}%`);
      }

      // 3. Calculamos o intervalo (Range) para a paginação no Supabase
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: resultData, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        ordens: (resultData as unknown as OS[]) || [],
        totalCount: count || 0,
      };
    },
    // Mantém os dados antigos no ecrã enquanto carrega a nova página (evita ecrã a piscar)
    placeholderData: keepPreviousData, 
  });

  const ordens = data?.ordens || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho Premium */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            Ordens de Serviço
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Gerencie e acompanhe o status das manutenções.</p>
        </div>
        <Button 
          onClick={() => navigate("/ordens/nova")}
          className="rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all font-semibold h-11 px-6"
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      {/* Área de Filtros e Pesquisa */}
      <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Buscar por OS, IMEI ou Modelo..." 
            className="pl-10 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary backdrop-blur-sm transition-all shadow-sm w-full" 
            value={search} 
            onChange={(e) => handleSearch(e.target.value)} 
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[220px] h-11 rounded-xl bg-card/50 border-border/50 backdrop-blur-sm shadow-sm font-medium text-foreground/80">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/50 shadow-lg">
            <SelectItem value="all" className="font-medium">Todos os Status</SelectItem>
            {Object.entries(OS_STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k} className="font-medium">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Dados (Card Premium) */}
      <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm font-medium text-muted-foreground">Carregando ordens...</p>
            </div>
          ) : isError ? (
            <div className="flex justify-center items-center h-64 text-destructive font-medium">
               Ocorreu um erro ao carregar as ordens.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 hover:bg-muted/20 border-b border-border/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold py-4">Nº OS</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">Cliente</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">Aparelho</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">IMEI</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">Status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold text-right">Total</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">Data</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12 font-medium">
                        Nenhuma ordem de serviço encontrada com estes filtros.
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {ordens.map((o: OS) => (
                    <TableRow 
                      key={o.id} 
                      className={`cursor-pointer hover:bg-muted/40 transition-colors duration-200 border-border/30 group ${isFetching ? 'opacity-50' : ''}`} 
                      onClick={() => navigate(`/ordens/${o.id}`)}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-foreground/90">{o.numero_os}</TableCell>
                      <TableCell className="font-medium text-sm text-foreground/90">{o.clientes?.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{[o.marca_aparelho, o.modelo_aparelho].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground/80">{o.imei || "—"}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-foreground/90">
                        R$ {Number(o.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Rodapé com os controlos de Paginação Premium */}
        {!isLoading && !isError && totalCount > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border/40 bg-card/40 gap-4">
            <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              A mostrar <span className="text-foreground font-bold">{ordens.length}</span> de <span className="text-foreground font-bold">{totalCount}</span> registos
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary ml-1" />}
            </div>
            
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9 border-border/60 hover:bg-muted/80 transition-colors font-medium"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <div className="flex items-center justify-center min-w-[5rem] text-sm font-semibold text-foreground/90 bg-background/50 h-9 rounded-xl border border-border/40">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9 border-border/60 hover:bg-muted/80 transition-colors font-medium"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}