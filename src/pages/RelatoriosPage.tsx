import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, TrendingUp, DollarSign, Wrench, ShoppingCart, Loader2, Calendar } from "lucide-react";

type Periodo = "7d" | "30d" | "ano" | "custom";

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  
  const hojeFormatoInput = new Date().toISOString().split('T')[0];
  const [dataInicioCustom, setDataInicioCustom] = useState<string>(hojeFormatoInput);
  const [dataFimCustom, setDataFimCustom] = useState<string>(hojeFormatoInput);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["relatorios_financeiros", periodo, dataInicioCustom, dataFimCustom],
    queryFn: async () => {
      let dataInicio = new Date();
      let dataFim = new Date(); 
      dataFim.setHours(23, 59, 59, 999);
      
      if (periodo === "7d") {
        dataInicio.setDate(dataInicio.getDate() - 7);
      } else if (periodo === "30d") {
        dataInicio.setDate(dataInicio.getDate() - 30);
      } else if (periodo === "ano") {
        dataInicio.setFullYear(dataInicio.getFullYear() - 1);
      } else if (periodo === "custom") {
        if (dataInicioCustom) dataInicio = new Date(`${dataInicioCustom}T00:00:00`);
        if (dataFimCustom) dataFim = new Date(`${dataFimCustom}T23:59:59`);
      }

      const isoInicio = dataInicio.toISOString();
      const isoFim = dataFim.toISOString();

      // 1. Busca Vendas PDV (Estas acontecem na hora, então usamos created_at)
      const { data: vendas, error: errVendas } = await supabase
        .from("vendas")
        .select("valor_total, created_at")
        .gte("created_at", isoInicio)
        .lte("created_at", isoFim);
      if (errVendas) throw errVendas;

      // 2. Busca Ordens de Serviço (Faturadas)
      // CORREÇÃO CRÍTICA: Filtra por 'data_finalizacao' e EXIGE status 'entregue'
      const { data: ordens, error: errOrdens } = await supabase
        .from("ordens_servico")
        .select("valor_total, data_finalizacao, status")
        .eq("status", "entregue")
        .gte("data_finalizacao", isoInicio)
        .lte("data_finalizacao", isoFim);
      if (errOrdens) throw errOrdens;

      // --- PROCESSAMENTO DOS DADOS ---
      const totalVendas = (vendas || []).reduce((acc, v) => acc + Number(v.valor_total), 0);
      const totalOrdens = (ordens || []).reduce((acc, o) => acc + Number(o.valor_total), 0);
      const faturamentoTotal = totalVendas + totalOrdens;
      const qtdTransacoes = (vendas?.length || 0) + (ordens?.length || 0);
      const ticketMedio = qtdTransacoes > 0 ? faturamentoTotal / qtdTransacoes : 0;

      const historicoMap = new Map<string, { data: string; pdv: number; os: number; total: number }>();
      
      const difMeses = (dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const agruparPorMes = periodo === "ano" || difMeses > 3;

      const formatador = agruparPorMes 
        ? new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
        : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

      const iterador = new Date(dataInicio);
      while (iterador <= dataFim) {
        const chave = formatador.format(iterador);
        if (!historicoMap.has(chave)) historicoMap.set(chave, { data: chave, pdv: 0, os: 0, total: 0 });
        if (agruparPorMes) iterador.setMonth(iterador.getMonth() + 1);
        else iterador.setDate(iterador.getDate() + 1);
      }

      vendas?.forEach(v => {
        const chave = formatador.format(new Date(v.created_at));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.pdv += Number(v.valor_total);
          historicoMap.get(chave)!.total += Number(v.valor_total);
        }
      });

      ordens?.forEach(o => {
        // CORREÇÃO: Coloca a receita no gráfico no dia em que a OS foi ENTREGUE
        if (!o.data_finalizacao) return; 
        const chave = formatador.format(new Date(o.data_finalizacao));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.os += Number(o.valor_total);
          historicoMap.get(chave)!.total += Number(o.valor_total);
        }
      });

      return {
        kpis: {
          faturamentoTotal, ticketMedio, totalVendas, totalOrdens,
          qtdVendas: vendas?.length || 0,
          qtdOrdens: ordens?.length || 0,
        },
        graficoEvolucao: Array.from(historicoMap.values()),
        graficoDistribuicao: [
          { name: "Vendas Balcão (PDV)", value: totalVendas, color: "hsl(var(--chart-1))" },
          { name: "Serviços (OS)", value: totalOrdens, color: "hsl(var(--chart-2))" },
        ]
      };
    }
  });

  if (isError) {
    return <div className="flex justify-center items-center h-[50vh] text-destructive">Erro ao carregar relatórios financeiros.</div>;
  }

  const { kpis, graficoEvolucao, graficoDistribuicao } = data || { 
    kpis: { faturamentoTotal: 0, ticketMedio: 0, totalVendas: 0, totalOrdens: 0, qtdVendas: 0, qtdOrdens: 0 }, 
    graficoEvolucao: [], graficoDistribuicao: [] 
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header Premium com Filtros de Data */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-card p-5 rounded-3xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            Inteligência Financeira
          </h1>
          <p className="text-muted-foreground mt-1 ml-1">Acompanhe o faturamento real (Vendas e OS Entregues).</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-3">
          {periodo === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <Input 
                  type="date" 
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input 
                  type="date" 
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/50"
                />
              </div>
            </div>
          )}

          <div className="w-full sm:w-56">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Período de Análise</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-12 rounded-xl bg-background border-border/50 shadow-sm font-medium">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="ano">Últimos 12 meses</SelectItem>
                <SelectItem value="custom" className="font-semibold text-primary">Personalizado...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        </div>
      ) : (
        <>
          {/* Linha 1: KPIs (Key Performance Indicators) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-primary-foreground/80 font-medium text-sm">Receita Líquida Real</p>
                    <p className="text-3xl font-black tracking-tight">R$ {kpis.faturamentoTotal.toFixed(2)}</p>
                  </div>
                  <div className="bg-primary-foreground/20 p-2 rounded-xl"><DollarSign className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-medium text-sm">Ticket Médio</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">R$ {kpis.ticketMedio.toFixed(2)}</p>
                  </div>
                  <div className="bg-primary/10 p-2 rounded-xl"><TrendingUp className="h-6 w-6 text-primary" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-medium text-sm">OS Entregues</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">R$ {kpis.totalOrdens.toFixed(2)}</p>
                    <p className="text-xs font-medium text-muted-foreground/70">{kpis.qtdOrdens} ordens finalizadas</p>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl"><Wrench className="h-6 w-6 text-amber-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-medium text-sm">Vendas Balcão</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">R$ {kpis.totalVendas.toFixed(2)}</p>
                    <p className="text-xs font-medium text-muted-foreground/70">{kpis.qtdVendas} PDVs finalizados</p>
                  </div>
                  <div className="bg-emerald-500/10 p-2 rounded-xl"><ShoppingCart className="h-6 w-6 text-emerald-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Linha 2: Gráficos Detalhados */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico Principal: Evolução de Receita */}
            <Card className="lg:col-span-2 rounded-3xl border-border/50 shadow-sm bg-card">
              <CardHeader className="border-b border-border/40 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-bold">Evolução de Entradas (Caixa)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-6">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graficoEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `R$${value}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Entrada R$"]}
                        labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico Secundário: Distribuição de Receita */}
            <Card className="rounded-3xl border-border/50 shadow-sm bg-card flex flex-col">
              <CardHeader className="border-b border-border/40 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-bold">Origem das Receitas</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center items-center">
                {kpis.faturamentoTotal === 0 ? (
                  <div className="text-center text-muted-foreground space-y-2">
                    <BarChart3 className="h-12 w-12 mx-auto opacity-20" />
                    <p className="font-medium">Sem faturamento no período</p>
                    <p className="text-sm opacity-70">Nenhuma venda ou OS finalizada.</p>
                  </div>
                ) : (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={graficoDistribuicao}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={8}
                        >
                          {graficoDistribuicao.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}