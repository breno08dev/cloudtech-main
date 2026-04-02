import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, TrendingUp, DollarSign, Wrench, ShoppingCart, Loader2, Calendar, Smartphone, Banknote, CreditCard, BookOpenCheck } from "lucide-react";

type Periodo = "7d" | "30d" | "ano" | "custom";

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  
  const hojeFormatoInput = new Date().toISOString().split('T')[0];
  const [dataInicioCustom, setDataInicioCustom] = useState<string>(hojeFormatoInput);
  const [dataFimCustom, setDataFimCustom] = useState<string>(hojeFormatoInput);

  const { data, isLoading, isError } = useQuery({
    // CHAVE ATUALIZADA AQUI PARA IGNORAR O CACHE ANTIGO
    queryKey: ["relatorios_financeiros_v2", periodo, dataInicioCustom, dataFimCustom],
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

      const { data: vendas, error: errVendas } = await supabase
        .from("vendas")
        .select("valor_total, created_at, forma_pagamento")
        .gte("created_at", isoInicio)
        .lte("created_at", isoFim);
      if (errVendas) throw errVendas;

      const { data: ordens, error: errOrdens } = await supabase
        .from("ordens_servico")
        .select("valor_total, data_finalizacao, status, forma_pagamento")
        .eq("status", "entregue")
        .gte("data_finalizacao", isoInicio)
        .lte("data_finalizacao", isoFim);
      if (errOrdens) throw errOrdens;

      const { data: parcelasPagas, error: errParcelas } = await supabase
        .from("crediario_parcelas")
        .select("valor_parcela, data_pagamento, forma_pagamento")
        .eq("status_pagamento", "pago")
        .gte("data_pagamento", isoInicio)
        .lte("data_pagamento", isoFim);
      if (errParcelas) throw errParcelas;

      let totalVendas = 0;
      let totalOrdens = 0;
      let totalCrediarioRecebido = 0;

      let qtdVendas = 0;
      let qtdOrdens = 0;
      let qtdParcelas = 0;

      let totalPix = 0;
      let totalDinheiro = 0;
      let totalCredito = 0;
      let totalDebito = 0;

      const processarPagamento = (forma: string, valorTotal: number) => {
        if (!forma) return;
        const f = forma.toLowerCase();
        
        if (f === 'pix') totalPix += valorTotal;
        else if (f === 'dinheiro') totalDinheiro += valorTotal;
        else if (f === 'cartao_credito' || f === 'credito') totalCredito += valorTotal;
        else if (f === 'cartao_debito' || f === 'debito') totalDebito += valorTotal;
        else if (f.includes('misto')) {
          const dinMatch = forma.match(/Din R\$([0-9.]+)/);
          if (dinMatch) totalDinheiro += parseFloat(dinMatch[1]);
          const pixMatch = forma.match(/PIX R\$([0-9.]+)/);
          if (pixMatch) totalPix += parseFloat(pixMatch[1]);
          const credMatch = forma.match(/Créd R\$([0-9.]+)/);
          if (credMatch) totalCredito += parseFloat(credMatch[1]);
          const debMatch = forma.match(/Déb R\$([0-9.]+)/);
          if (debMatch) totalDebito += parseFloat(debMatch[1]);
        } else {
          totalDinheiro += valorTotal;
        }
      };

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
        if (v.forma_pagamento === 'crediario') return;
        totalVendas += Number(v.valor_total);
        qtdVendas++;
        processarPagamento(v.forma_pagamento, Number(v.valor_total));
        const chave = formatador.format(new Date(v.created_at));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.pdv += Number(v.valor_total);
          historicoMap.get(chave)!.total += Number(v.valor_total);
        }
      });

      ordens?.forEach(o => {
        if (o.forma_pagamento === 'crediario' || !o.data_finalizacao) return;
        totalOrdens += Number(o.valor_total);
        qtdOrdens++;
        processarPagamento(o.forma_pagamento, Number(o.valor_total));
        const chave = formatador.format(new Date(o.data_finalizacao));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.os += Number(o.valor_total);
          historicoMap.get(chave)!.total += Number(o.valor_total);
        }
      });

      parcelasPagas?.forEach(p => {
        if (!p.data_pagamento) return;
        totalCrediarioRecebido += Number(p.valor_parcela);
        qtdParcelas++;
        processarPagamento(p.forma_pagamento, Number(p.valor_parcela));
        const chave = formatador.format(new Date(p.data_pagamento));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.total += Number(p.valor_parcela);
        }
      });

      const faturamentoTotal = totalVendas + totalOrdens + totalCrediarioRecebido;
      const qtdTransacoes = qtdVendas + qtdOrdens + qtdParcelas;
      const ticketMedio = qtdTransacoes > 0 ? faturamentoTotal / qtdTransacoes : 0;

      return {
        kpis: {
          faturamentoTotal, ticketMedio, totalVendas, totalOrdens, totalCrediarioRecebido,
          qtdVendas, qtdOrdens, qtdParcelas
        },
        pagamentos: {
          pix: totalPix,
          dinheiro: totalDinheiro,
          credito: totalCredito,
          debito: totalDebito
        },
        graficoEvolucao: Array.from(historicoMap.values()),
        graficoDistribuicao: [
          { name: "Vendas (À Vista)", value: totalVendas, color: "hsl(var(--chart-1))" },
          { name: "OS (À Vista)", value: totalOrdens, color: "hsl(var(--chart-2))" },
          { name: "Crediário Recebido", value: totalCrediarioRecebido, color: "#f97316" },
        ]
      };
    }
  });

  if (isError) {
    return <div className="flex justify-center items-center h-[50vh] text-destructive">Erro ao carregar relatórios financeiros.</div>;
  }

 const { 
    kpis = { faturamentoTotal: 0, ticketMedio: 0, totalVendas: 0, totalOrdens: 0, totalCrediarioRecebido: 0, qtdVendas: 0, qtdOrdens: 0, qtdParcelas: 0 }, 
    pagamentos = { pix: 0, dinheiro: 0, credito: 0, debito: 0 },
    graficoEvolucao = [], 
    graficoDistribuicao = [] 
  } = data || {};

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      {/* Header Premium com Filtros de Data */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            Inteligência Financeira
          </h1>
          <p className="text-muted-foreground mt-1 ml-1 font-medium">Acompanhe o faturamento real e a divisão dos seus recebimentos.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-3">
          {periodo === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Data Inicial</Label>
                <Input 
                  type="date" 
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-medium"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Data Final</Label>
                <Input 
                  type="date" 
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-medium"
                />
              </div>
            </div>
          )}

          <div className="w-full sm:w-56">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1.5 block">Período de Análise</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-bold text-sm">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="7d" className="font-medium">Últimos 7 dias</SelectItem>
                <SelectItem value="30d" className="font-medium">Últimos 30 dias</SelectItem>
                <SelectItem value="ano" className="font-medium">Últimos 12 meses</SelectItem>
                <SelectItem value="custom" className="font-bold text-primary">Personalizado...</SelectItem>
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
          {/* Linha 1: KPIs Principais COM PROTEÇÃO Number(x || 0) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 lg:grid-cols-3 gap-4">
            <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-primary-foreground/80 font-bold text-xs uppercase tracking-wider">Receita Líquida Real</p>
                    <p className="text-3xl font-black tracking-tight font-mono">R$ {Number(kpis.faturamentoTotal || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-primary-foreground/20 p-2.5 rounded-2xl"><DollarSign className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Ticket Médio</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.ticketMedio || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-primary/10 p-2.5 rounded-2xl"><TrendingUp className="h-6 w-6 text-primary" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">OS (À Vista)</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalOrdens || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdOrdens || 0} ordens</p>
                  </div>
                  <div className="bg-amber-500/10 p-2.5 rounded-2xl"><Wrench className="h-6 w-6 text-amber-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">Vendas (À Vista)</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalVendas || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdVendas || 0} vendas</p>
                  </div>
                  <div className="bg-emerald-500/10 p-2.5 rounded-2xl"><ShoppingCart className="h-6 w-6 text-emerald-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">Fiado Recebido</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalCrediarioRecebido || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdParcelas || 0} parcelas</p>
                  </div>
                  <div className="bg-orange-500/10 p-2.5 rounded-2xl"><BookOpenCheck className="h-6 w-6 text-orange-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* NOVA LINHA: Detalhamento por Forma de Pagamento */}
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground mb-3 ml-2 flex items-center gap-2">
              Detalhamento de Recebimentos
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <Card className="rounded-3xl border-teal-500/20 shadow-sm bg-gradient-to-br from-card to-teal-500/5 hover:border-teal-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-teal-600 font-bold text-[10px] uppercase tracking-widest">PIX</p>
                    <div className="bg-teal-500/10 p-2 rounded-xl"><Smartphone className="h-4 w-4 text-teal-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.pix || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-emerald-500/20 shadow-sm bg-gradient-to-br from-card to-emerald-500/5 hover:border-emerald-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest">Dinheiro</p>
                    <div className="bg-emerald-500/10 p-2 rounded-xl"><Banknote className="h-4 w-4 text-emerald-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.dinheiro || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-indigo-500/20 shadow-sm bg-gradient-to-br from-card to-indigo-500/5 hover:border-indigo-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest">Crédito</p>
                    <div className="bg-indigo-500/10 p-2 rounded-xl"><CreditCard className="h-4 w-4 text-indigo-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.credito || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-orange-500/20 shadow-sm bg-gradient-to-br from-card to-orange-500/5 hover:border-orange-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-orange-600 font-bold text-[10px] uppercase tracking-widest">Débito</p>
                    <div className="bg-orange-500/10 p-2 rounded-xl"><CreditCard className="h-4 w-4 text-orange-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.debito || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* Linha 3: Gráficos Detalhados */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <Card className="lg:col-span-2 rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-black">Evolução de Entradas (Caixa)</CardTitle>
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
                      <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} tickFormatter={(value) => `R$${value}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', backgroundColor: 'hsl(var(--card))' }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Entrada R$"]}
                        labelStyle={{ fontWeight: '900', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col">
              <CardHeader className="border-b border-border/30 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-black">Origem das Receitas</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center items-center">
                {kpis.faturamentoTotal === 0 ? (
                  <div className="text-center text-muted-foreground space-y-2">
                    <BarChart3 className="h-12 w-12 mx-auto opacity-20" />
                    <p className="font-bold">Sem faturamento no período</p>
                    <p className="text-xs font-medium opacity-70">Nenhuma receita à vista recebida.</p>
                  </div>
                ) : (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={graficoDistribuicao.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={8}
                        >
                          {graficoDistribuicao.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
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