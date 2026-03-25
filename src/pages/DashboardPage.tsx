import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DollarSign, ShoppingCart, Wrench, AlertTriangle, TrendingUp, TrendingDown, Package, Loader2, Eye, EyeOff } from "lucide-react";

// Tipagem explícita para evitar erros do TypeScript com o Map
interface VarMapInfo {
  nomeBase: string;
  qualidade: string;
  estoque: number;
  min: number;
}

export default function DashboardPage() {
  const [showValues, setShowValues] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard_metrics_v2"],
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
        { data: produtoBases },
        { data: produtoVariacoes },
        { data: itensVenda },
        { data: pecasOs }
      ] = await Promise.all([
        supabase.from("vendas").select("id, valor_total, created_at").gte("created_at", inicioMes),
        supabase.from("ordens_servico").select("id, valor_total, data_finalizacao, status, created_at"),
        (supabase as any).from("produto_base").select("id, nome"),
        (supabase as any).from("produto_variacoes").select("id, produto_id, estoque, estoque_minimo, qualidade"),
        (supabase as any).from("venda_itens").select("produto_id, quantidade").gte("created_at", inicioMes),
        (supabase as any).from("ordem_servico_pecas").select("produto_id, quantidade, ordem_servico_id")
      ]);

      // --- MAPEAMENTO EM MEMÓRIA ---
      const baseMap = new Map<string, string>((produtoBases || []).map((b: any) => [b.id, b.nome]));
      
      // Usando a tipagem explícita VarMapInfo
      const varMap = new Map<string, VarMapInfo>((produtoVariacoes || []).map((v: any) => [
        v.id, 
        { 
          nomeBase: baseMap.get(v.produto_id) || "Produto", 
          qualidade: v.qualidade, 
          estoque: v.estoque, 
          min: v.estoque_minimo 
        }
      ]));

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
      const produtosBaixoEstoque = (produtoVariacoes || [])
        .filter((v: any) => v.estoque <= v.estoque_minimo)
        .map((v: any) => {
          const nomeBase = baseMap.get(v.produto_id) || "Produto Desconhecido";
          return { 
            id: v.id, 
            nome: `${nomeBase} (${v.qualidade})`, 
            estoque: v.estoque 
          };
        })
        .sort((a: any, b: any) => a.estoque - b.estoque);

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

      // --- 3. RANKING DE PRODUTOS ---
      const rankingMap = new Map<string, number>();
      
      itensVenda?.forEach((item: any) => {
        const info = varMap.get(item.produto_id); // info agora é tipado como VarMapInfo | undefined
        const nomeCompleto = info ? `${info.nomeBase} - ${info.qualidade}` : "Item Excluído";
        rankingMap.set(nomeCompleto, (rankingMap.get(nomeCompleto) || 0) + item.quantidade);
      });
      
      pecasOs?.forEach((peca: any) => {
        if (osEntreguesMesIds.has(peca.ordem_servico_id)) {
          const info = varMap.get(peca.produto_id);
          const nomeCompleto = info ? `${info.nomeBase} - ${info.qualidade}` : "Item Excluído";
          rankingMap.set(nomeCompleto, (rankingMap.get(nomeCompleto) || 0) + peca.quantidade);
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
  if (isError || !data) return <div className="p-8 text-center text-destructive font-medium">Erro ao carregar o dashboard. Tente recarregar a página.</div>;

  const { kpis, graficoData, maisVendidos, menosVendidos } = data;

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            Visão Geral do Negócio
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Resumo de caixa e operações ativas no mês atual.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowValues(!showValues)} 
          className="rounded-xl shadow-sm bg-background hover:bg-muted/80 border-border/60 transition-all font-medium"
        >
          {showValues ? <EyeOff className="h-4 w-4 mr-2 text-muted-foreground" /> : <Eye className="h-4 w-4 mr-2 text-primary" />}
          {showValues ? "Ocultar Valores" : "Mostrar Valores"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        
        <Card className="rounded-3xl border-none shadow-lg shadow-primary/10 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex flex-col min-h-[140px] relative overflow-hidden transition-transform hover:-translate-y-1 duration-300">
          <div className="absolute inset-0 opacity-[0.1] mix-blend-overlay pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="kpi-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#kpi-pattern)" />
            </svg>
          </div>
          <CardContent className="p-6 flex-1 flex flex-col justify-center relative z-10">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-primary-foreground/90 font-medium text-sm tracking-wide">Faturamento do Mês</p>
                <p className="text-3xl font-black tracking-tighter drop-shadow-sm">
                  R$ {showValues ? kpis.fatMesAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "••••••"}
                </p>
              </div>
              <div className="bg-background/20 backdrop-blur-md p-3 rounded-2xl shadow-inner shrink-0"><DollarSign className="h-6 w-6 text-primary-foreground" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm hover:shadow-md hover:bg-card hover:-translate-y-1 transition-all duration-300 flex flex-col min-h-[140px]">
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium text-sm tracking-wide">Caixa de Hoje</p>
                <p className="text-3xl font-black tracking-tighter text-foreground">
                  R$ {showValues ? kpis.fatHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "••••••"}
                </p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 shrink-0"><ShoppingCart className="h-6 w-6 text-emerald-500" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm hover:shadow-md hover:bg-card hover:-translate-y-1 transition-all duration-300 flex flex-col min-h-[140px]">
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium text-sm tracking-wide">OS na Bancada</p>
                <p className="text-3xl font-black tracking-tighter text-foreground flex items-baseline gap-1">
                  {kpis.osEmAndamento} <span className="text-sm font-medium text-muted-foreground tracking-normal">Ordens</span>
                </p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 shrink-0"><Wrench className="h-6 w-6 text-amber-500" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm hover:shadow-md hover:bg-card hover:-translate-y-1 transition-all duration-300 flex flex-col min-h-[140px]">
          <CardContent className="p-5 flex-1 flex flex-col h-full">
            <div className="flex justify-between items-start mb-3 shrink-0">
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium text-sm tracking-wide">Alerta de Estoque</p>
                <p className="text-2xl font-black tracking-tighter text-foreground flex items-baseline gap-1">
                  {kpis.produtosBaixoEstoque.length} <span className="text-sm font-medium text-muted-foreground tracking-normal">Itens Críticos</span>
                </p>
              </div>
              <div className="bg-red-500/10 p-2.5 rounded-2xl border border-red-500/20 shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-[40px]">
              {kpis.produtosBaixoEstoque.length === 0 && (
                <p className="text-xs text-muted-foreground">Estoque saudável.</p>
              )}
              {kpis.produtosBaixoEstoque.slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-xs bg-red-500/5 px-3 py-1.5 rounded-xl border border-red-500/10 transition-colors hover:bg-red-500/10">
                  <span className="truncate font-medium text-foreground/80 pr-2">{p.nome}</span>
                  <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap bg-red-500/10 px-1.5 py-0.5 rounded-md">{p.estoque} un</span>
                </div>
              ))}
              {kpis.produtosBaixoEstoque.length > 3 && (
                <p className="text-[10px] text-muted-foreground/70 text-center font-bold tracking-wider pt-1 uppercase">
                  + {kpis.produtosBaixoEstoque.length - 3} outros
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <Card className="xl:col-span-2 rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4 px-6 pt-6 bg-card shrink-0">
            <CardTitle className="text-base font-bold text-foreground">Entradas Financeiras: PDV vs Serviços (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-8 flex-1 bg-card/30 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }} 
                  tickFormatter={(value) => showValues ? `R$${value}` : ""} 
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`R$ ${showValues ? value.toFixed(2) : "••••"}`, "Valor"]}
                  labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '13px', fontWeight: 500 }} />
                <Bar dataKey="PDV" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="Serviços" fill="hsl(var(--status-ready))" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6 flex flex-col">
          
          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex-1 flex flex-col">
            <CardHeader className="border-b border-border/40 pb-4 px-5 pt-5 bg-card shrink-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground tracking-wide uppercase">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Mais Vendidos do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {maisVendidos.length === 0 ? (
                <div className="h-full min-h-[150px] flex items-center justify-center text-sm text-muted-foreground font-medium p-5 text-center">Nenhuma venda registada este mês.</div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {maisVendidos.map((prod, idx) => (
                    <li key={idx} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">{idx + 1}</div>
                        <span className="font-medium text-sm text-foreground/90 line-clamp-1">{prod.nome}</span>
                      </div>
                      <span className="font-bold font-mono bg-background border border-border/60 px-2.5 py-1 rounded-lg text-xs shadow-sm">{prod.quantidade} un</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex-1 flex flex-col">
            <CardHeader className="border-b border-border/40 pb-4 px-5 pt-5 bg-card shrink-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground tracking-wide uppercase">
                <TrendingDown className="h-4 w-4 text-red-500" /> Baixa Rotação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {menosVendidos.length === 0 ? (
                <div className="h-full min-h-[150px] flex items-center justify-center text-sm text-muted-foreground font-medium p-5 text-center">Dados insuficientes.</div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {menosVendidos.map((prod, idx) => (
                    <li key={idx} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-1.5 rounded-xl border border-red-500/20 group-hover:scale-110 transition-transform"><Package className="h-4 w-4 text-red-500" /></div>
                        <span className="font-medium text-sm text-foreground/80 line-clamp-1">{prod.nome}</span>
                      </div>
                      <span className="font-bold font-mono text-muted-foreground text-xs bg-background border border-border/60 px-2 py-1 rounded-lg">{prod.quantidade} un</span>
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