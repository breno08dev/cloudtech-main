import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Eye } from "lucide-react";
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

export default function OrdensListPage() {
  const [ordens, setOrdens] = useState<OS[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => { loadOrdens(); }, []);

  async function loadOrdens() {
    const { data } = await supabase
      .from("ordens_servico")
      .select("id, numero_os, marca_aparelho, modelo_aparelho, imei, status, valor_total, created_at, clientes(nome)")
      .order("created_at", { ascending: false });
    setOrdens((data as any) || []);
  }

  const filtered = ordens.filter((o) => {
    const matchSearch = [o.numero_os, o.modelo_aparelho, o.imei, o.clientes?.nome]
      .some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
        <Button onClick={() => navigate("/ordens/nova")}>Nova Ordem</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar OS, cliente, IMEI..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma ordem encontrada</TableCell></TableRow>
              )}
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ordens/${o.id}`)}>
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
        </CardContent>
      </Card>
    </div>
  );
}
