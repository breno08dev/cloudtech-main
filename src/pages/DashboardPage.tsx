import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DollarSign, ShoppingCart, Wrench, AlertTriangle, TrendingUp, TrendingDown, Package, Loader2, Eye, EyeOff } from "lucide-react";

export default function Dashboard() {
  // Estado para controlar a visibilidade dos valores financeiros
  const [showValues, setShowValues] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard_metrics"],
    queryFn: async () => {
      const hoje = new Date();
      
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
      const inicioDia = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
      
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
      seteDiasAtras.setHours(0, 0, 0, 0);
      const isoSeteDias = seteDiasAtras.toISOString();

      const [
        { data: vendas },
        { data: ordens },
        { data: produtos },
        { data: itensVenda },
        { data: pecasOs }
      ] = await Promise.all([
        supabase.from("vendas").select("valor_total, created_at").gte("created_at", inicioMes),
        supabase.from("ordens_servico").select("id, valor_total, data_finalizacao, status, created_at"),
        supabase.from("produtos").select("id, nome, estoque, estoque_minimo").order("estoque", { ascending: true }),
        supabase.from("venda_itens").select("quantidade, produtos(nome)").gte("created_at", inicioMes),
        supabase.from("ordem_servico_pecas").select("quantidade, ordem_servico_id, produtos(nome)")
      ]);

      // --- 1. CÁLCULOS DOS KPIs FINANCEIROS ---
      let fatMesAtual = 0;
      let fatHoje = 0;

      vendas?.forEach(v => {
        fatMesAtual += Number(v.valor_total);
        if (v.created_at >= inicioDia) fatHoje += Number(v.valor_total);
      });

      let osEmAndamento = 0;
      const osEntreguesMesIds = new Set<string>(); 

      ordens?.forEach(o => {
        if (o.status !== "entregue" && o.status !== "cancelada") {
          osEmAndamento++;
        }
        if (o.status === "entregue" && o.data_finalizacao) {
          if (o.data_finalizacao >= inicioMes) {
            fatMesAtual += Number(o.valor_total);
            osEntreguesMesIds.add(o.id); 
          }
          if (o.data_finalizacao >= inicioDia) {
            fatHoje += Number(o.valor_total);
          }
        }
      });

      // --- ALERTA DE ESTOQUE ---
      const produtosBaixoEstoque = (produtos || [])
        .filter(p => p.estoque <= p.estoque_minimo)
        .map(p => ({ id: p.id, nome: p.nome, estoque: p.estoque }));

      // --- 2. GRÁFICO COMBINADO (ÚLTIMOS 7 DIAS) ---
      const historicoMap = new Map<string, { data: string; PDV: number; Serviços: number }>();
      const formatador = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

      for (let i = 0; i < 7; i++) {
        const d = new Date(seteDiasAtras);
        d.setDate(d.getDate() + i);
        historicoMap.set(formatador.format(d), { data: formatador.format(d), PDV: 0, Serviços: 0 });
      }

      vendas?.filter(v => v.created_at >= isoSeteDias).forEach(v => {
        const chave = formatador.format(new Date(v.created_at));
        if (historicoMap.has(chave)) historicoMap.get(chave)!.PDV += Number(v.valor_total);
      });

      ordens?.filter(o => o.status === "entregue" && o.data_finalizacao && o.data_finalizacao >= isoSeteDias).forEach(o => {
        const chave = formatador.format(new Date(o.data_finalizacao!));
        if (historicoMap.has(chave)) historicoMap.get(chave)!.Serviços += Number(o.valor_total);
      });

      // --- 3. RANKING DE PRODUTOS INTELIGENTE ---
      const rankingMap = new Map<string, number>();
      
      itensVenda?.forEach(item => {
        const nome = (item.produtos as any)?.nome || "Produto Desconhecido";
        rankingMap.set(nome, (rankingMap.get(nome) || 0) + item.quantidade);
      });
      
      pecasOs?.forEach(peca => {
        if (osEntreguesMesIds.has(peca.ordem_servico_id)) {
          const nome = (peca.produtos as any)?.nome || "Peça Desconhecida";
          rankingMap.set(nome, (rankingMap.get(nome) || 0) + peca.quantidade);
        }
      });

      const rankingArray = Array.from(rankingMap.entries()).map(([nome, quantidade]) => ({ nome, quantidade }));
      rankingArray.sort((a, b) => b.quantidade - a.quantidade);
      
      const maisVendidos = rankingArray.slice(0, 5);
      const menosVendidos = [...rankingArray].reverse().slice(0, 5);

      return {
        kpis: { fatMesAtual, fatHoje, osEmAndamento, produtosBaixoEstoque },
        graficoData: Array.from(historicoMap.values()),
        maisVendidos,
        menosVendidos
      };
    }
  });

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/60" /></div>;
  if (isError || !data) return <div className="p-8 text-center text-red-500">Erro ao carregar o dashboard.</div>;

  const { kpis, graficoData, maisVendidos, menosVendidos } = data;

  return (
    <div className="flex flex-col gap-6 pb-8">
      
      {/* Header com Botão de Ocultar Valores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do faturamento real (PDV + OS Entregues) no mês atual.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowValues(!showValues)} 
          className="rounded-xl shadow-sm bg-card hover:bg-muted"
        >
          {showValues ? <EyeOff className="h-4 w-4 mr-2 text-muted-foreground" /> : <Eye className="h-4 w-4 mr-2 text-primary" />}
          {showValues ? "Ocultar Valores" : "Mostrar Valores"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* KPI: Faturamento do Mês */}
        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex flex-col h-full">
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-primary-foreground/80 font-medium text-sm">Faturamento do Mês</p>
                <p className="text-3xl font-black tracking-tight">
                  R$ {showValues ? kpis.fatMesAtual.toFixed(2) : "••••••"}
                </p>
              </div>
              <div className="bg-primary-foreground/20 p-2 rounded-xl"><DollarSign className="h-6 w-6" /></div>
            </div>
          </CardContent>
        </Card>

        {/* KPI: Caixa de Hoje */}
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card hover:shadow-md transition-all flex flex-col h-full">
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium text-sm">Caixa de Hoje</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  R$ {showValues ? kpis.fatHoje.toFixed(2) : "••••••"}
                </p>
              </div>
              <div className="bg-emerald-500/10 p-2 rounded-xl"><ShoppingCart className="h-6 w-6 text-emerald-500" /></div>
            </div>
          </CardContent>
        </Card>

        {/* KPI: OS em Andamento */}
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card hover:shadow-md transition-all flex flex-col h-full">
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium text-sm">OS na Bancada</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{kpis.osEmAndamento} Ordens</p>
              </div>
              <div className="bg-amber-500/10 p-2 rounded-xl"><Wrench className="h-6 w-6 text-amber-500" /></div>
            </div>
          </CardContent>
        </Card>

        {/* KPI: Alerta de Estoque com Micro-Lista */}
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card hover:shadow-md transition-all flex flex-col h-full">
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium text-sm">Alerta de Estoque</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {kpis.produtosBaixoEstoque.length} <span className="text-sm font-normal text-muted-foreground tracking-normal">Itens</span>
                </p>
              </div>
              <div className="bg-red-500/10 p-2 rounded-xl"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            </div>
            
            {kpis.produtosBaixoEstoque.length > 0 && (
              <div className="mt-auto space-y-1.5 pt-2">
                {kpis.produtosBaixoEstoque.slice(0, 3).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs bg-red-500/5 px-2.5 py-1.5 rounded-lg border border-red-500/10">
                    <span className="truncate font-medium text-foreground pr-2">{p.nome}</span>
                    <span className="font-bold text-red-600 whitespace-nowrap">{p.estoque} un</span>
                  </div>
                ))}
                {kpis.produtosBaixoEstoque.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center font-medium pt-1">
                    + {kpis.produtosBaixoEstoque.length - 3} outros produtos
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO: Vendas PDV vs Serviços OS */}
        <Card className="lg:col-span-2 rounded-3xl border-border/50 shadow-sm bg-card flex flex-col">
          <CardHeader className="border-b border-border/40 pb-4 px-6 pt-6">
            <CardTitle className="text-lg font-bold">Entradas Financeiras: PDV vs OS (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-6 flex-1">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                    // Se estiver oculto, não mostra os números no eixo Y também
                    tickFormatter={(value) => showValues ? `R$${value}` : ""} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                    // Oculta os valores na caixa flutuante do gráfico
                    formatter={(value: number) => [`R$ ${showValues ? value.toFixed(2) : "••••"}`, "Valor"]}
                    labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="PDV" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="Serviços" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* RANKINGS DE PRODUTOS */}
        <div className="space-y-6">
          
          {/* Top 5 Mais Vendidos */}
          <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
            <CardHeader className="border-b border-border/40 pb-3 px-5 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Mais Vendidos (Real)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {maisVendidos.length === 0 ? (
                <div className="p-5 text-center text-sm text-muted-foreground">Nenhuma venda registada este mês.</div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {maisVendidos.map((prod, idx) => (
                    <li key={idx} className="flex justify-between items-center p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center">{idx + 1}</div>
                        <span className="font-medium text-sm line-clamp-1">{prod.nome}</span>
                      </div>
                      <span className="font-bold font-mono bg-muted px-2 py-0.5 rounded text-xs">{prod.quantidade} un</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Menos Vendidos */}
          <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
            <CardHeader className="border-b border-border/40 pb-3 px-5 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" /> Baixa Rotação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {menosVendidos.length === 0 ? (
                <div className="p-5 text-center text-sm text-muted-foreground">Dados insuficientes.</div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {menosVendidos.map((prod, idx) => (
                    <li key={idx} className="flex justify-between items-center p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-1.5 rounded-md"><Package className="h-3.5 w-3.5 text-red-500" /></div>
                        <span className="font-medium text-sm line-clamp-1">{prod.nome}</span>
                      </div>
                      <span className="font-bold font-mono text-muted-foreground text-xs">{prod.quantidade} un</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}