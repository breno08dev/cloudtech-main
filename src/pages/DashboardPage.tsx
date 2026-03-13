import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Wrench, CheckCircle, ShoppingCart, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface DashboardStats {
  ordensAbertas: number;
  ordensProntas: number;
  vendasDia: number;
  faturamentoMes: number;
  alertasEstoque: number;
}

interface RecentOS {
  id: string;
  numero_os: string;
  status: string;
  modelo_aparelho: string;
  created_at: string;
  clientes: { nome: string } | null;
}

const mockChartData = [
  { name: "Jan", vendas: 12, servicos: 18 },
  { name: "Fev", vendas: 19, servicos: 22 },
  { name: "Mar", vendas: 15, servicos: 25 },
  { name: "Abr", vendas: 22, servicos: 20 },
  { name: "Mai", vendas: 28, servicos: 30 },
  { name: "Jun", vendas: 25, servicos: 28 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    ordensAbertas: 0,
    ordensProntas: 0,
    vendasDia: 0,
    faturamentoMes: 0,
    alertasEstoque: 0,
  });
  const [recentOS, setRecentOS] = useState<RecentOS[]>([]);
  const [lowStock, setLowStock] = useState<{ id: string; nome: string; estoque: number; estoque_minimo: number }[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [ordensRes, prontasRes, vendasDiaRes, fatRes, recentRes, stockRes] = await Promise.all([
      supabase.from("ordens_servico").select("id", { count: "exact", head: true }).not("status", "in", '("entregue","cancelado")'),
      supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "pronto"),
      supabase.from("vendas").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
      supabase.from("vendas").select("valor_total").gte("created_at", startOfMonth),
      supabase.from("ordens_servico").select("id, numero_os, status, modelo_aparelho, created_at, clientes(nome)").order("created_at", { ascending: false }).limit(8),
      supabase.from("produtos").select("id, nome, estoque, estoque_minimo").order("estoque", { ascending: true }).limit(10),
    ]);

    const faturamento = fatRes.data?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;
    const lowStockItems = (stockRes.data || []).filter((p) => p.estoque <= p.estoque_minimo);

    setStats({
      ordensAbertas: ordensRes.count || 0,
      ordensProntas: prontasRes.count || 0,
      vendasDia: vendasDiaRes.count || 0,
      faturamentoMes: faturamento,
      alertasEstoque: lowStockItems.length,
    });
    setRecentOS((recentRes.data as any) || []);
    setLowStock(lowStockItems);
  }

  const summaryCards = [
    { title: "Ordens Abertas", value: stats.ordensAbertas, icon: Wrench, color: "text-primary" },
    { title: "Prontas p/ Entrega", value: stats.ordensProntas, icon: CheckCircle, color: "text-status-ready" },
    { title: "Vendas Hoje", value: stats.vendasDia, icon: ShoppingCart, color: "text-status-analysis" },
    { title: "Faturamento Mês", value: `R$ ${stats.faturamentoMes.toFixed(2)}`, icon: DollarSign, color: "text-status-ready" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas & Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="vendas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="servicos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ordens Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOS.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma ordem encontrada.</p>}
            {recentOS.map((os) => (
              <div key={os.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-medium">{os.numero_os}</span>
                  <span className="truncate text-muted-foreground">{os.clientes?.nome || "—"}</span>
                </div>
                <StatusBadge status={os.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-canceled" />
              Alertas de Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-destructive/5 rounded-md px-3 py-2 text-sm">
                  <span className="truncate">{p.nome}</span>
                  <span className="font-mono font-semibold text-destructive">{p.estoque}/{p.estoque_minimo}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
