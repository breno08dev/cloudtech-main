import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, ArrowDownCircle, ArrowUpCircle, LockKeyhole, Plus, Loader2, Calculator, CalendarDays, Trash2, FilterX, Printer, CheckCircle2, List, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function FinanceiroPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("caixa");

  // Modais de Caixa
  const [modalAbrirCaixa, setModalAbrirCaixa] = useState(false);
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [modalFecharCaixa, setModalFecharCaixa] = useState(false);

  // Modais e Filtros de Custos
  const [modalCusto, setModalCusto] = useState(false);
  const [filtroDataCusto, setFiltroDataCusto] = useState(getTodayString());
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Estado para o modal de exclusão de movimentação/venda
  const [itemCaixaToDelete, setItemCaixaToDelete] = useState<any | null>(null);

  // Formulários
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [movForm, setMovForm] = useState({ tipo: "saida", categoria: "Gerais", valor: 0, descricao: "" });
  const [custoForm, setCustoForm] = useState({ descricao: "", valor: 0, tipo: "fixo", vencimento: "" });

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // ================= 1. DADOS DO CAIXA =================
  const { data: caixaAtual, isLoading: loadingCaixa } = useQuery({
    queryKey: ["caixa_atual"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("caixas").select("*").eq("status", "aberto").maybeSingle();
      return data;
    },
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["movimentacoes_caixa", caixaAtual?.id],
    queryFn: async () => {
      if (!caixaAtual?.id) return [];
      const { data } = await (supabase as any).from("movimentacoes_caixa").select("*").eq("caixa_id", caixaAtual.id);
      return data || [];
    },
    enabled: !!caixaAtual?.id,
  });

  const { data: vendasPdv = [] } = useQuery({
    queryKey: ["vendas_caixa_atual", caixaAtual?.data_abertura],
    queryFn: async () => {
      if (!caixaAtual) return [];
      const { data } = await (supabase as any)
        .from("vendas")
        .select("id, valor_total, forma_pagamento, created_at, observacoes, clientes(nome)") // ADICIONADO: observacoes
        .gte("created_at", caixaAtual.data_abertura);
      return data || [];
    },
    enabled: !!caixaAtual?.data_abertura,
  });

  const { data: ordensServico = [] } = useQuery({
    queryKey: ["os_caixa_atual", caixaAtual?.data_abertura],
    queryFn: async () => {
      if (!caixaAtual) return [];
      const { data } = await (supabase as any)
        .from("ordens_servico")
        .select("id, numero_os, valor_total, forma_pagamento, data_finalizacao, clientes(nome)")
        .eq("status", "entregue")
        .gte("data_finalizacao", caixaAtual.data_abertura);
      return data || [];
    },
    enabled: !!caixaAtual?.data_abertura,
  });

  // ================= UNIFICAR O HISTÓRICO =================
  const historicoCaixa = useMemo(() => {
    const lista: any[] = [];
    
    // Movimentações avulsas
    movimentacoes.forEach((m: any) => lista.push({
      id: m.id,
      data: m.created_at,
      tipo: m.tipo,
      categoria: m.categoria, // Necessário para a exclusão do crediário
      origem_id: m.origem_id, // Necessário para identificar o crediário
      descricaoOriginal: m.descricao,
      descricao: m.categoria + (m.descricao ? ` - ${m.descricao}` : ''),
      cliente: '—',
      valor: Number(m.valor),
      isSaida: m.tipo === 'saida' || m.tipo === 'sangria'
    }));

    // Vendas à vista
    vendasPdv.forEach((v: any) => {
      if (v.forma_pagamento === 'crediario') return;

      // LÓGICA DE GRAVAÇÃO: Verifica se é uma gravação baseada na observação
      const isGravacao = v.observacoes === "Gravação de Copos";

      lista.push({
        id: v.id,
        data: v.created_at,
        tipo: isGravacao ? 'gravacao' : 'venda', // Aplica a tag correta
        descricao: `Pagamento: ${String(v.forma_pagamento).replace('_', ' ').toUpperCase()}`,
        cliente: v.clientes?.nome || 'Cliente Avulso',
        valor: Number(v.valor_total),
        isSaida: false
      });
    });

    // OS à vista
    ordensServico.forEach((o: any) => {
      if (o.forma_pagamento === 'crediario') return;
      lista.push({
        id: o.id,
        data: o.data_finalizacao,
        tipo: 'os',
        descricao: `OS: ${o.numero_os} • Pagamento: ${String(o.forma_pagamento).replace('_', ' ').toUpperCase()}`,
        cliente: o.clientes?.nome || 'Cliente Avulso',
        valor: Number(o.valor_total),
        isSaida: false
      });
    });

    return lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [movimentacoes, vendasPdv, ordensServico]);

  const totalEntradas = historicoCaixa.filter((h: any) => !h.isSaida).reduce((acc: number, h: any) => acc + h.valor, 0);
  const totalSaidas = historicoCaixa.filter((h: any) => h.isSaida).reduce((acc: number, h: any) => acc + h.valor, 0);
  const saldoPrevisto = (caixaAtual ? Number(caixaAtual.saldo_inicial) : 0) + totalEntradas - totalSaidas;

  // ================= GERAR PDF DO RELATÓRIO DO CAIXA =================
  const imprimirRelatorioDiario = () => {
    if (!caixaAtual) return;

    const nomeEmpresa = config?.nome_empresa || "MINHA EMPRESA";
    const dataAbertura = new Date(caixaAtual.data_abertura).toLocaleString("pt-BR");
    const dataAtual = new Date().toLocaleString("pt-BR");

    const linhasHistorico = historicoCaixa.map(h => {
      const tipo = h.isSaida ? "SAIDA" : "ENTRADA";
      const cor = h.isSaida ? "color: red;" : "color: green;";
      const sinal = h.isSaida ? "-" : "+";
      const valorStr = `${sinal} R$ ${h.valor.toFixed(2)}`;
      const hora = new Date(h.data).toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'});
      const labelAmigavel = getLabelTipo(h.tipo); // Usa a função para imprimir "Gravação" no PDF
      
      return `
        <tr>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc;">${hora}</td>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc;">${labelAmigavel.toUpperCase()}</td>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc;">${h.cliente}</td>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc; max-width: 40mm; word-wrap: break-word;">${h.descricao}</td>
          <td style="padding: 4px 0; border-bottom: 1px dotted #ccc; text-align: right; font-weight: bold; ${cor}">${valorStr}</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Caixa</title>
        <style>
          @page { margin: 10mm; size: A4 portrait; }
          body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 0; color: #000; }
          h1, h2, h3, p { margin: 0; padding: 0; line-height: 1.3; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .linha { border-bottom: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; text-align: left;}
          th { border-bottom: 1px dashed #000; padding-bottom: 4px; font-weight: bold; }
          .resumo-box { border: 1px solid #000; padding: 10px; margin-top: 15px; width: 300px; float: right; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 class="bold" style="font-size: 18px;">${nomeEmpresa}</h2>
          <p>RELATÓRIO DE FECHAMENTO / MOVIMENTAÇÃO DE CAIXA</p>
          <p>Impresso em: ${dataAtual}</p>
        </div>
        <div class="linha"></div>
        <div style="margin-bottom: 15px;">
          <p><span class="bold">Abertura do Caixa:</span> ${dataAbertura}</p>
          <p><span class="bold">Status Atual:</span> ${caixaAtual.status.toUpperCase()}</p>
        </div>
        
        <h3 class="bold">Histórico de Movimentações</h3>
        <table>
          <thead>
            <tr>
              <th>HORA</th>
              <th>TIPO</th>
              <th>CLIENTE</th>
              <th>DESCRIÇÃO / PAGAMENTO</th>
              <th class="right">VALOR</th>
            </tr>
          </thead>
          <tbody>${linhasHistorico || '<tr><td colspan="5" class="center" style="padding: 10px;">Sem movimentações</td></tr>'}</tbody>
        </table>
        
        <div style="clear: both;"></div>

        <div class="resumo-box">
          <h3 class="bold" style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;">RESUMO FINANCEIRO</h3>
          <p style="display: flex; justify-content: space-between;"><span>Fundo de Troco (Inicial):</span> <span>R$ ${Number(caixaAtual.saldo_inicial).toFixed(2)}</span></p>
          <p style="display: flex; justify-content: space-between; color: green;"><span>Total de Entradas (+):</span> <span>R$ ${totalEntradas.toFixed(2)}</span></p>
          <p style="display: flex; justify-content: space-between; color: red;"><span>Total de Saídas (-):</span> <span>R$ ${totalSaidas.toFixed(2)}</span></p>
          <div style="border-top: 1px solid #ccc; margin: 5px 0;"></div>
          <p class="bold" style="display: flex; justify-content: space-between; font-size: 14px;"><span>SALDO ATUAL EM CAIXA:</span> <span>R$ ${saldoPrevisto.toFixed(2)}</span></p>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(htmlContent); doc.close();
      setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => { document.body.removeChild(iframe); }, 2000); }, 500);
    }
  };

  // ================= 2. DADOS DOS CUSTOS =================
  const { data: custos = [], isLoading: loadingCustos } = useQuery({
    queryKey: ["custos_empresa"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("custos_empresa").select("*").order("vencimento", { ascending: true });
      return data || [];
    },
  });

  const custosFiltrados = useMemo(() => {
    if (mostrarTodos) return custos;
    if (!filtroDataCusto) return []; 
    return custos.filter((c: any) => c.vencimento && c.vencimento.startsWith(filtroDataCusto));
  }, [custos, filtroDataCusto, mostrarTodos]);


  // ================= MUTATIONS DO CAIXA =================
  const abrirCaixaMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("caixas").insert({ saldo_inicial: saldoInicial });
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Caixa Aberto!", { description: "O seu caixa foi iniciado e está pronto para receber vendas." }); 
      setModalAbrirCaixa(false); 
      queryClient.invalidateQueries({ queryKey: ["caixa_atual"] }); 
    },
  });

  const lancarMovMut = useMutation({
    mutationFn: async () => {
      if (movForm.valor <= 0) throw new Error("Valor inválido");
      const { error } = await (supabase as any).from("movimentacoes_caixa").insert({
        caixa_id: caixaAtual.id,
        tipo: movForm.tipo,
        categoria: movForm.categoria,
        valor: movForm.valor,
        descricao: movForm.descricao
      });
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Lançamento Registado", { description: "A movimentação foi adicionada ao caixa atual com sucesso." }); 
      setModalMovimentacao(false); 
      setMovForm({ tipo: "saida", categoria: "Gerais", valor: 0, descricao: "" }); 
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_caixa"] }); 
    },
    onError: (err: any) => toast.error("Erro no Lançamento", { description: err.message })
  });

  const fecharCaixaMut = useMutation({
    mutationFn: async (saldoFinal: number) => {
      const { error } = await (supabase as any).from("caixas").update({
        status: "fechado",
        data_fechamento: new Date().toISOString(),
        saldo_final_dinheiro: saldoFinal
      }).eq("id", caixaAtual.id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Caixa Encerrado", { description: "O histórico foi guardado de forma segura e o saldo foi fechado." }); 
      setModalFecharCaixa(false); 
      queryClient.invalidateQueries({ queryKey: ["caixa_atual"] }); 
    },
  });

  // MUTATION PARA EXCLUIR MOVIMENTAÇÃO E REVERTER CREDIÁRIO/GRAVAÇÃO/VENDA
  const excluirHistoricoMut = useMutation({
    mutationFn: async (item: any) => {
      const { id, tipo, categoria, origem_id, descricaoOriginal } = item;

      // ADICIONADO: Ação de exclusão para 'gravacao' funciona idêntico ao de 'venda'
      if (tipo === 'venda' || tipo === 'gravacao') {
        const { data: itens } = await (supabase as any).from('venda_itens').select('produto_id, quantidade').eq('venda_id', id);
        
        if (itens && itens.length > 0) {
          for (const item of itens) {
            const { data: prod } = await (supabase as any).from('produto_variacoes').select('estoque').eq('id', item.produto_id).single();
            if (prod) {
              await (supabase as any).from('produto_variacoes').update({ estoque: prod.estoque + item.quantidade }).eq('id', item.produto_id);
            }
          }
        }
        
        await (supabase as any).from('venda_itens').delete().eq('venda_id', id);
        const { error } = await (supabase as any).from('vendas').delete().eq('id', id);
        if (error) throw error;
        
      } else if (tipo === 'os') {
        const { error } = await (supabase as any).from('ordens_servico').update({ 
          status: 'pronto', 
          data_finalizacao: null 
        }).eq('id', id);
        if (error) throw error;
        
      } else {
        // SE FOR UM PAGAMENTO DE CREDIÁRIO, REVERTE A PARCELA!
        if (categoria === 'recebimento_crediario' && origem_id) {
          const match = descricaoOriginal?.match(/Parcela (\d+)/);
          if (match) {
            const numero_parcela = parseInt(match[1]);
            
            await (supabase as any).from('crediario_parcelas').update({
              status_pagamento: 'pendente',
              data_pagamento: null,
              forma_pagamento: null
            }).eq('crediario_id', origem_id).eq('numero_parcela', numero_parcela);
            
            await (supabase as any).from('crediarios').update({ status: 'pendente' }).eq('id', origem_id);
          }
        }
        
        const { error } = await (supabase as any).from('movimentacoes_caixa').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => { 
      toast.success("Registo removido!", { description: "O caixa foi atualizado e o saldo recalculado." }); 
      setItemCaixaToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["vendas_caixa_atual"] }); 
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_caixa"] }); 
      queryClient.invalidateQueries({ queryKey: ["os_caixa_atual"] }); 
      queryClient.invalidateQueries({ queryKey: ["crediarios"] }); 
      queryClient.invalidateQueries({ queryKey: ["relatorios_financeiros_v2"] }); 
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics_v2"] }); 
    },
    onError: (err: any) => toast.error("Erro ao excluir", { description: err.message })
  });

  // ================= MUTATIONS DE CUSTOS =================
  const salvarCustoMut = useMutation({
    mutationFn: async () => {
      if (custoForm.valor <= 0 || !custoForm.descricao) throw new Error("Preencha todos os campos obrigatórios");
      
      const payloads = [];

      if (custoForm.tipo === "fixo" && custoForm.vencimento) {
        const [anoStr, mesStr, diaStr] = custoForm.vencimento.split('-');
        let ano = Number(anoStr);
        let mes = Number(mesStr) - 1; 
        const dia = Number(diaStr);

        for (let i = 0; i < 12; i++) {
          const dataVencimento = new Date(ano, mes + i, dia);
          const anoFinal = dataVencimento.getFullYear();
          const mesFinal = String(dataVencimento.getMonth() + 1).padStart(2, '0');
          const diaFinal = String(dataVencimento.getDate()).padStart(2, '0');

          payloads.push({
            descricao: custoForm.descricao,
            valor: custoForm.valor,
            tipo: custoForm.tipo,
            vencimento: `${anoFinal}-${mesFinal}-${diaFinal}`,
            pago: false
          });
        }
      } else {
        payloads.push({
          descricao: custoForm.descricao,
          valor: custoForm.valor,
          tipo: custoForm.tipo,
          vencimento: custoForm.vencimento || null,
          pago: false
        });
      }

      const { error } = await (supabase as any).from("custos_empresa").insert(payloads);
      if (error) throw error;
    },
    onSuccess: () => { 
      if (custoForm.tipo === "fixo" && custoForm.vencimento) {
        toast.success("Despesa Recorrente Criada", { description: "O custo fixo foi projetado para os próximos 12 meses." });
      } else {
        toast.success("Despesa Adicionada", { description: "A despesa foi guardada no sistema com sucesso." });
      }
      setModalCusto(false); 
      setCustoForm({ descricao: "", valor: 0, tipo: "fixo", vencimento: "" }); 
      queryClient.invalidateQueries({ queryKey: ["custos_empresa"] }); 
    },
    onError: (err: any) => toast.error("Erro ao adicionar", { description: err.message })
  });

  const pagarCustoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("custos_empresa").update({ pago: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Conta Paga", { description: "O custo foi marcado como pago com sucesso.", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> }); 
      queryClient.invalidateQueries({ queryKey: ["custos_empresa"] }); 
    },
  });

  const excluirCustoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("custos_empresa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Custo Removido", { description: "A despesa foi permanentemente apagada do histórico." }); 
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["custos_empresa"] }); 
    },
  });

  // ADICIONADO: Cores de Badge específicas para Gravação
  const getBadgeClass = (tipo: string) => {
    switch (tipo) {
      case "venda": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "gravacao": return "bg-pink-500/10 text-pink-600 border-pink-500/20";
      case "os": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "entrada": case "reforco": return "bg-teal-500/10 text-teal-600 border-teal-500/20";
      case "saida": case "sangria": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground border-border/50";
    }
  };

  // ADICIONADO: Label amigável para Gravação
  const getLabelTipo = (tipo: string) => {
    switch (tipo) {
      case "venda": return "Venda PDV";
      case "gravacao": return "Gravação";
      case "os": return "Serviço OS";
      case "reforco": return "Reforço";
      default: return tipo;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 border border-border/40 p-6 rounded-3xl backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20"><Wallet className="h-6 w-6 text-primary" /></div>
            Gestão Financeira
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Controle o seu fluxo de caixa diário e os custos da empresa.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-card/60 border border-border/50 p-1.5 h-auto rounded-2xl shadow-sm">
          <TabsTrigger value="caixa" className="text-sm font-bold rounded-xl py-2.5 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="custos" className="text-sm font-bold rounded-xl py-2.5 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Custos da Empresa</TabsTrigger>
        </TabsList>

        {/* ================= TAB: CAIXA ================= */}
        <TabsContent value="caixa" className="space-y-6 focus-visible:outline-none">
          
          {!caixaAtual && !loadingCaixa ? (
            <Card className="rounded-3xl border-dashed border-2 border-border/60 bg-card/30 backdrop-blur-sm text-center py-20 shadow-none">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-muted p-6 rounded-full"><LockKeyhole className="h-12 w-12 text-muted-foreground" /></div>
                <h2 className="text-2xl font-black text-foreground/80">O Caixa está fechado</h2>
                <p className="text-muted-foreground">Inicie o dia abrindo o caixa para registar as movimentações e vendas.</p>
                <Button onClick={() => setModalAbrirCaixa(true)} className="mt-4 h-12 px-8 rounded-xl font-bold bg-primary shadow-lg shadow-primary/20 text-base">Abrir Caixa Agora</Button>
              </div>
            </Card>
          ) : caixaAtual ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <Card className="rounded-3xl shadow-sm border-border/40 bg-card/80 backdrop-blur-sm"><CardContent className="p-5 flex flex-col justify-center"><p className="text-muted-foreground font-semibold text-xs tracking-wider uppercase">Saldo Inicial</p><p className="text-2xl font-black font-mono mt-1">R$ {Number(caixaAtual.saldo_inicial).toFixed(2)}</p></CardContent></Card>
                <Card className="rounded-3xl shadow-sm border-border/40 bg-card/80 backdrop-blur-sm"><CardContent className="p-5 flex flex-col justify-center"><div className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4 text-emerald-500"/><p className="text-emerald-600 font-semibold text-xs tracking-wider uppercase">Entradas</p></div><p className="text-2xl font-black font-mono mt-1 text-emerald-600">R$ {totalEntradas.toFixed(2)}</p></CardContent></Card>
                <Card className="rounded-3xl shadow-sm border-border/40 bg-card/80 backdrop-blur-sm"><CardContent className="p-5 flex flex-col justify-center"><div className="flex items-center gap-2"><ArrowDownCircle className="h-4 w-4 text-red-500"/><p className="text-red-500 font-semibold text-xs tracking-wider uppercase">Saídas / Sangrias</p></div><p className="text-2xl font-black font-mono mt-1 text-red-500">R$ {totalSaidas.toFixed(2)}</p></CardContent></Card>
                <Card className="rounded-3xl shadow-sm border-none bg-primary text-primary-foreground relative overflow-hidden"><CardContent className="p-5 flex flex-col justify-center relative z-10"><p className="font-semibold text-xs tracking-wider uppercase opacity-90">Saldo Previsto</p><p className="text-3xl font-black font-mono mt-1">R$ {saldoPrevisto.toFixed(2)}</p></CardContent></Card>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 mb-2">
                <h3 className="text-lg font-bold">Histórico de Movimentações (Sessão Atual)</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={imprimirRelatorioDiario} className="h-11 rounded-xl font-bold border-border/60 bg-background text-foreground hover:bg-muted/80 transition-colors"><Printer className="h-4 w-4 mr-2"/> PDF / Relatório</Button>
                  <Button variant="outline" onClick={() => setModalMovimentacao(true)} className="h-11 rounded-xl font-bold border-border/60 bg-background hover:bg-muted/80 transition-colors"><Plus className="h-4 w-4 mr-2"/> Nova Movimentação</Button>
                  <Button variant="destructive" onClick={() => setModalFecharCaixa(true)} className="h-11 rounded-xl font-bold shadow-md hover:bg-red-600 transition-colors"><LockKeyhole className="h-4 w-4 mr-2"/> Fechar Caixa</Button>
                </div>
              </div>

              <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="font-bold py-4 text-xs uppercase tracking-wider pl-6">Horário</TableHead>
                      <TableHead className="font-bold py-4 text-xs uppercase tracking-wider">Tipo</TableHead>
                      <TableHead className="font-bold py-4 text-xs uppercase tracking-wider">Cliente</TableHead>
                      <TableHead className="font-bold py-4 text-xs uppercase tracking-wider">Detalhes</TableHead>
                      <TableHead className="font-bold py-4 text-xs uppercase tracking-wider text-right pr-6">Valor</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoCaixa.length === 0 ? (
                    
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground font-medium">Nenhuma venda ou movimentação registada nesta sessão.</TableCell></TableRow>
                    ) : (
                      historicoCaixa.map((h: any) => (
                        <TableRow key={`${h.tipo}-${h.id}`} className="border-border/20">
                          <TableCell className="font-medium text-xs text-muted-foreground pl-6">{new Date(h.data).toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}</TableCell>
                          <TableCell>
                            <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border", getBadgeClass(h.tipo))}>
                              {getLabelTipo(h.tipo)}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-sm text-foreground/90">{h.cliente}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.descricao}</TableCell>
                          <TableCell className={cn("text-right font-mono font-black text-[15px] pr-6", h.isSaida ? "text-red-500" : "text-emerald-600")}>
                            {h.isSaida ? "- " : "+ "}R$ {Number(h.valor).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setItemCaixaToDelete(h)} 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ================= TAB: CUSTOS DA EMPRESA ================= */}
        <TabsContent value="custos" className="space-y-6 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Despesas Fixas e Variáveis</h2>
              <p className="text-sm text-muted-foreground mt-1">Navegue pelas datas para visualizar ou pagar as suas contas.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex flex-col gap-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider ml-1">Visualizando a data:</Label>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={filtroDataCusto} 
                    onChange={(e) => {
                      setFiltroDataCusto(e.target.value);
                      setMostrarTodos(false);
                    }} 
                    className="h-11 rounded-xl bg-card border-border/50 text-sm font-bold text-foreground w-[160px] pr-10 shadow-sm focus-visible:ring-primary"
                  />
                  {filtroDataCusto && (
                    <Button variant="ghost" size="icon" onClick={() => setFiltroDataCusto("")} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <FilterX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5 pt-[22px]">
                <Button 
                  variant={mostrarTodos ? "default" : "outline"} 
                  onClick={() => { setMostrarTodos(true); setFiltroDataCusto(""); }} 
                  className={cn("h-11 rounded-xl font-bold shadow-sm transition-all", !mostrarTodos && "bg-background border-border/60 hover:bg-muted/80")}
                >
                  <List className="h-4 w-4 mr-2"/> Mostrar Todas
                </Button>
              </div>

              <div className="flex flex-col gap-1.5 pt-[22px]">
                <Button onClick={() => setModalCusto(true)} className="h-11 rounded-xl font-bold bg-primary shadow-lg shadow-primary/20 shrink-0 hover:bg-primary/90"><Plus className="h-4 w-4 mr-2"/> Adicionar Despesa</Button>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="font-bold py-4 pl-6 text-xs uppercase tracking-wider">Descrição</TableHead>
                  <TableHead className="font-bold py-4 text-xs uppercase tracking-wider text-center">Tipo</TableHead>
                  <TableHead className="font-bold py-4 text-xs uppercase tracking-wider text-center">Vencimento</TableHead>
                  <TableHead className="font-bold py-4 text-xs uppercase tracking-wider text-right">Valor</TableHead>
                  <TableHead className="font-bold py-4 text-xs uppercase tracking-wider text-right pr-6">Status / Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCustos ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></TableCell></TableRow>
                ) : !filtroDataCusto && !mostrarTodos ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                        <CalendarDays className="h-12 w-12 text-muted-foreground" />
                        <p className="text-sm font-bold text-muted-foreground">Selecione um dia no calendário ou clique em "Mostrar Todas".</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : custosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                       <div className="flex flex-col items-center justify-center gap-2 opacity-80">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mb-1" />
                        <p className="text-base font-bold text-foreground">Nenhuma despesa encontrada!</p>
                        {filtroDataCusto && <p className="text-xs text-muted-foreground">O dia selecionado está livre de contas.</p>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  custosFiltrados.map((c: any) => (
                    <TableRow key={c.id} className="border-border/20 group">
                      <TableCell className="font-bold text-sm text-foreground/90 pl-6">{c.descricao}</TableCell>
                      <TableCell className="text-center"><span className="bg-muted/60 border border-border/50 text-[10px] font-bold uppercase px-2 py-0.5 rounded">{c.tipo}</span></TableCell>
                      <TableCell className="text-center text-sm font-medium text-muted-foreground">{c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '—'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">R$ {Number(c.valor).toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-6 flex items-center justify-end gap-2">
                        {c.pago ? (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">Pago</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => pagarCustoMut.mutate(c.id)} className="h-8 text-xs font-bold border-border/60 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-colors">Marcar Pago</Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setItemToDelete(c.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= MODAIS ================= */}

      {/* Modal Excluir Histórico do Caixa */}
      <Dialog open={!!itemCaixaToDelete} onOpenChange={(open) => !open && setItemCaixaToDelete(null)}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6 text-center border-red-500/20 shadow-2xl">
          <div className="mx-auto bg-red-500/10 p-4 rounded-full w-fit mb-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <DialogTitle className="text-2xl font-black mb-2 text-foreground">Excluir Registo</DialogTitle>
          <p className="text-sm text-muted-foreground font-medium mb-6 px-2">
            {itemCaixaToDelete?.tipo === 'venda' || itemCaixaToDelete?.tipo === 'gravacao' ? 'A venda/gravação será apagada e os itens voltarão para o estoque.' : 
             itemCaixaToDelete?.tipo === 'os' ? 'A OS será removida do caixa atual e voltará para o status "Pronto".' :
             itemCaixaToDelete?.categoria === 'recebimento_crediario' ? 'O pagamento será cancelado e a parcela voltará a ficar pendente no crediário do cliente.' :
             'Esta movimentação será apagada permanentemente do caixa.'}
          </p>
          
          <Button 
            onClick={() => { if(itemCaixaToDelete) excluirHistoricoMut.mutate(itemCaixaToDelete); }} 
            disabled={excluirHistoricoMut.isPending} 
            variant="destructive" 
            className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
          >
            {excluirHistoricoMut.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
            Confirmar Exclusão
          </Button>
          <Button variant="ghost" onClick={() => setItemCaixaToDelete(null)} className="w-full mt-2 font-bold rounded-xl h-11 hover:bg-muted/80">Cancelar</Button>
        </DialogContent>
      </Dialog>
      
      {/* Modal Excluir Custo */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6 text-center border-red-500/20 shadow-2xl">
          <div className="mx-auto bg-red-500/10 p-4 rounded-full w-fit mb-3"><AlertCircle className="h-8 w-8 text-red-500" /></div>
          <DialogTitle className="text-2xl font-black mb-2 text-foreground">Excluir Despesa</DialogTitle>
          <p className="text-sm text-muted-foreground font-medium mb-6 px-2">Tem certeza que deseja excluir permanentemente esta despesa? Esta ação não poderá ser desfeita.</p>
          
          <Button 
            onClick={() => { if(itemToDelete) excluirCustoMut.mutate(itemToDelete); }} 
            disabled={excluirCustoMut.isPending} 
            variant="destructive" 
            className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
          >
            {excluirCustoMut.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
            Sim, Excluir Despesa
          </Button>
          <Button variant="ghost" onClick={() => setItemToDelete(null)} className="w-full mt-2 font-bold rounded-xl h-11 hover:bg-muted/80">Cancelar</Button>
        </DialogContent>
      </Dialog>

      {/* Modal Abrir Caixa */}
      <Dialog open={modalAbrirCaixa} onOpenChange={setModalAbrirCaixa}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6">
          <DialogHeader><DialogTitle className="text-xl font-black">Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold uppercase text-xs text-muted-foreground tracking-wider ml-1">Saldo Inicial / Fundo de Troco (R$)</Label>
              <Input type="number" step="0.01" min="0" value={saldoInicial || ""} onChange={(e) => setSaldoInicial(Number(e.target.value))} className="h-12 rounded-xl text-lg font-mono bg-card focus-visible:ring-primary shadow-sm" autoFocus />
            </div>
            <Button onClick={() => abrirCaixaMut.mutate()} disabled={abrirCaixaMut.isPending} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 hover:bg-primary/90">Confirmar Abertura</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Lançar Movimentação */}
      <Dialog open={modalMovimentacao} onOpenChange={setModalMovimentacao}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6">
          <DialogHeader><DialogTitle className="text-xl font-black">Nova Movimentação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Tipo</Label>
                <Select value={movForm.tipo} onValueChange={(v) => setMovForm({...movForm, tipo: v})}>
                  <SelectTrigger className="h-12 rounded-xl bg-card font-bold shadow-sm border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50">
                    <SelectItem value="saida" className="text-red-500 font-bold">Saída (Gasto)</SelectItem>
                    <SelectItem value="sangria" className="text-red-500 font-bold">Sangria (Retirada)</SelectItem>
                    <SelectItem value="entrada" className="text-emerald-500 font-bold">Entrada (Avulsa)</SelectItem>
                    <SelectItem value="reforco" className="text-emerald-500 font-bold">Reforço de Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Categoria</Label>
                <Input value={movForm.categoria} onChange={(e) => setMovForm({...movForm, categoria: e.target.value})} placeholder="Ex: Motoboy" className="h-12 rounded-xl bg-card font-medium shadow-sm border-border/60" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Valor (R$)</Label>
              <Input type="number" step="0.01" value={movForm.valor || ""} onChange={(e) => setMovForm({...movForm, valor: Number(e.target.value)})} className="h-12 rounded-xl bg-card font-mono text-lg shadow-sm border-border/60 focus-visible:ring-primary" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Descrição / Justificativa</Label>
              <Input value={movForm.descricao} onChange={(e) => setMovForm({...movForm, descricao: e.target.value})} placeholder="Opcional..." className="h-12 rounded-xl bg-card shadow-sm border-border/60" />
            </div>
            <Button onClick={() => lancarMovMut.mutate()} disabled={lancarMovMut.isPending} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 mt-4 hover:bg-primary/90">Registar Lançamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Custo Empresa */}
      <Dialog open={modalCusto} onOpenChange={setModalCusto}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6">
          <DialogHeader><DialogTitle className="text-xl font-black">Nova Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Descrição *</Label>
              <Input value={custoForm.descricao} onChange={(e) => setCustoForm({...custoForm, descricao: e.target.value})} placeholder="Ex: Conta de Luz" className="h-12 rounded-xl bg-card font-medium shadow-sm border-border/60 focus-visible:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Valor (R$) *</Label>
                <Input type="number" step="0.01" value={custoForm.valor || ""} onChange={(e) => setCustoForm({...custoForm, valor: Number(e.target.value)})} className="h-12 rounded-xl bg-card font-mono text-base shadow-sm border-border/60 focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1">Tipo</Label>
                <Select value={custoForm.tipo} onValueChange={(v) => setCustoForm({...custoForm, tipo: v})}>
                  <SelectTrigger className="h-12 rounded-xl bg-card font-bold text-xs shadow-sm border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50">
                    <SelectItem value="fixo">Fixo (Mensal)</SelectItem>
                    <SelectItem value="variavel">Variável (Avulso)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider ml-1 flex items-center gap-1"><CalendarDays className="h-3 w-3"/> Vencimento *</Label>
              <Input type="date" value={custoForm.vencimento} onChange={(e) => setCustoForm({...custoForm, vencimento: e.target.value})} className="h-12 rounded-xl bg-card text-foreground font-medium shadow-sm border-border/60 focus-visible:ring-primary" />
              {custoForm.tipo === "fixo" && (
                <p className="text-[10px] text-primary/80 font-bold mt-1 ml-1">Nota: Este custo será recriado automaticamente para os próximos 12 meses.</p>
              )}
            </div>
            <Button onClick={() => salvarCustoMut.mutate()} disabled={salvarCustoMut.isPending} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 mt-4 hover:bg-primary/90">Guardar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Fechar Caixa */}
      <Dialog open={modalFecharCaixa} onOpenChange={setModalFecharCaixa}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6 text-center border-red-500/20 shadow-2xl">
          <div className="mx-auto bg-red-500/10 p-4 rounded-full w-fit mb-2"><Calculator className="h-8 w-8 text-red-500" /></div>
          <DialogTitle className="text-2xl font-black mb-1">Encerrar Caixa</DialogTitle>
          <p className="text-sm text-muted-foreground font-medium mb-6">O saldo previsto no sistema é de <strong className="text-foreground font-mono">R$ {saldoPrevisto.toFixed(2)}</strong>.</p>
          
          <Button onClick={() => fecharCaixaMut.mutate(saldoPrevisto)} disabled={fecharCaixaMut.isPending} variant="destructive" className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors">
            Confirmar Encerramento
          </Button>
          <Button variant="ghost" onClick={() => setModalFecharCaixa(false)} className="w-full mt-2 font-bold rounded-xl h-11 hover:bg-muted/80 transition-colors">Cancelar</Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}