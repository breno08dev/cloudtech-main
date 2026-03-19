import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Eye, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
        <Button onClick={() => navigate("/ordens/nova")}>Nova Ordem</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar OS, IMEI ou Modelo..." 
            className="pl-9" 
            value={search} 
            onChange={(e) => handleSearch(e.target.value)} 
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(OS_STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Se estiver a carregar a primeira vez e não houver dados, mostramos um loading gigante */}
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="flex justify-center items-center h-48 text-red-500">
               Erro ao carregar as ordens.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordens.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma ordem encontrada</TableCell></TableRow>
                )}
                
                {ordens.map((o: OS) => (
                  <TableRow key={o.id} className={`cursor-pointer hover:bg-muted/50 ${isFetching ? 'opacity-50' : ''}`} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{o.numero_os}</TableCell>
                    <TableCell>{o.clientes?.nome || "—"}</TableCell>
                    <TableCell>{[o.marca_aparelho, o.modelo_aparelho].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{o.imei || "—"}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">R$ {Number(o.valor_total).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Rodapé com os controlos de Paginação */}
        {!isLoading && !isError && totalCount > 0 && (
          <CardFooter className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              A mostrar {ordens.length} de {totalCount} registos
              {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm font-medium mx-2">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
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