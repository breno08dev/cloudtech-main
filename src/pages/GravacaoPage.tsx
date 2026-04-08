import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit3, Plus, Trash2, Printer, Loader2, Check, ChevronsUpDown, Banknote, Smartphone, CreditCard, PieChart, BookOpenCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ItemGravacao {
  id_interno: string;
  produto: any | null;
  quantidade: number;
  valor_servico: number;
}

export default function GravacaoPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<ItemGravacao[]>([]);
  
  // Estados dos Menus de Busca (Controlados para evitar bugs de não aparecer)
  const [searchProduto, setSearchProduto] = useState("");
  const [openProduto, setOpenProduto] = useState(false);
  
  const [searchCliente, setSearchCliente] = useState("");
  const [clienteId, setClienteId] = useState("avulso");
  const [openCliente, setOpenCliente] = useState(false);
  
  const [formItem, setFormItem] = useState({ produto: null as any | null, quantidade: 1, valor_servico: "" });
  const [descontoValor, setDescontoValor] = useState<number | "">("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Estados de Pagamento
  const [valorRecebido, setValorRecebido] = useState<number | "">("");
  const [pagamentoMisto, setPagamentoMisto] = useState({ dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0 });
  const [parcelasCrediario, setParcelasCrediario] = useState(1);
  const [dataVencimentoCrediario, setDataVencimentoCrediario] = useState("");

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDataVencimentoCrediario(d.toISOString().split('T')[0]);
  }, []);

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_gravacao_frescos"],
    queryFn: async () => {
      const { data } = await supabase.from("produto_base").select("id, nome, codigo_barras_base, variacoes:produto_variacoes(id, qualidade, preco_venda, estoque, codigo_barras_especifico)");
      const flatList: any[] = [];
      data?.forEach((base: any) => {
        base.variacoes?.forEach((v: any) => {
          if (v.estoque > 0) {
            flatList.push({ 
              id: v.id, 
              nome: `${base.nome} (${v.qualidade})`, 
              preco: v.preco_venda, 
              estoque: v.estoque,
              codigo: v.codigo_barras_especifico || base.codigo_barras_base || ""
            });
          }
        });
      });
      return flatList;
    },
    refetchOnMount: true,
    staleTime: 0
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_gravacao_base"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, cpf_cnpj, telefone");
      return data || [];
    },
  });

  // BUSCA CLEAN E COM CÓDIGO DE BARRAS
  const produtosFiltrados = useMemo(() => {
    if (!searchProduto) return [];
    const s = searchProduto.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(s) || p.codigo.includes(s)).slice(0, 15);
  }, [produtos, searchProduto]);

  const clientesFiltrados = useMemo(() => {
    if (!searchCliente) return [];
    const s = searchCliente.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(s) || c.cpf_cnpj?.includes(s));
  }, [clientes, searchCliente]);

  const subtotal = useMemo(() => cart.reduce((acc, i) => acc + (((i.produto?.preco || 0) + i.valor_servico) * i.quantidade), 0), [cart]);
  const totalGeral = Math.max(0, subtotal - Number(descontoValor || 0));

  // Cálculos de Pagamento Misto
  const somaMisto = (pagamentoMisto.dinheiro || 0) + (pagamentoMisto.pix || 0) + (pagamentoMisto.cartao_credito || 0) + (pagamentoMisto.cartao_debito || 0);
  const faltaMisto = totalGeral - somaMisto;

  const getFormaPagamentoString = () => {
    if (formaPagamento !== "misto") return formaPagamento.replace('_', ' ').toUpperCase();
    
    const partes = [];
    if (pagamentoMisto.dinheiro > 0) partes.push(`Din R$${pagamentoMisto.dinheiro.toFixed(2)}`);
    if (pagamentoMisto.pix > 0) partes.push(`PIX R$${pagamentoMisto.pix.toFixed(2)}`);
    if (pagamentoMisto.cartao_credito > 0) partes.push(`Créd R$${pagamentoMisto.cartao_credito.toFixed(2)}`);
    if (pagamentoMisto.cartao_debito > 0) partes.push(`Déb R$${pagamentoMisto.cartao_debito.toFixed(2)}`);
    
    return `MISTO (${partes.join(' | ')})`;
  };

  const isCobrarDisabled = 
    cart.length === 0 || 
    (formaPagamento === 'misto' && faltaMisto > 0.01) ||
    (formaPagamento === 'crediario' && clienteId === 'avulso');

  const addItem = () => {
    if (!formItem.produto && !formItem.valor_servico) return toast.error("Selecione um produto ou defina um valor de serviço.");
    setCart([...cart, { ...formItem, id_interno: Math.random().toString(36).substr(2, 9), valor_servico: Number(formItem.valor_servico) || 0 }]);
    setFormItem({ produto: null, quantidade: 1, valor_servico: "" });
    setSearchProduto("");
  };

  const imprimirA4 = () => {
    const nomeEmpresa = config?.nome_empresa || "CLOUD TECH";
    const clienteNome = clienteId === "avulso" ? "CLIENTE AVULSO" : clientes.find(c => c.id === clienteId)?.nome || "";
    
    const rows = cart.map(item => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.quantidade}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.produto ? item.produto.nome : "Serviço de Gravação Individual"}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">R$ ${(item.produto?.preco || 0).toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">R$ ${item.valor_servico.toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">R$ ${(((item.produto?.preco || 0) + item.valor_servico) * item.quantidade).toFixed(2)}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html><head>
      <meta charset="utf-8">
      <title>Ordem de Serviço</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .totals { text-align: right; font-size: 14px; }
        .grand-total { font-size: 20px; font-weight: bold; color: #000; margin-top: 10px; }
      </style></head><body>
        <div class="header">
          <div><div class="title">${nomeEmpresa}</div><p>Ordem de Serviço - Gravação a Laser</p></div>
          <div style="text-align: right;"><p>Data: ${new Date().toLocaleDateString("pt-BR")}</p><p>Cliente: ${clienteNome}</p></div>
        </div>
        <table>
          <thead><tr style="background: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Qtd</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Descrição / Produto</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vlr. Unit</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vlr. Gravação</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Subtotal</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <p>Subtotal: R$ ${subtotal.toFixed(2)}</p>
          ${Number(descontoValor) > 0 ? `<p>Desconto: - R$ ${Number(descontoValor).toFixed(2)}</p>` : ""}
          <div class="grand-total">TOTAL A PAGAR: R$ ${totalGeral.toFixed(2)}</div>
          <p style="margin-top: 10px;">Forma de Pagamento: ${getFormaPagamentoString()}</p>
        </div>
      </body></html>
    `;

    // IMPRESSÃO INVISÍVEL (MESMO PADRÃO DO SISTEMA)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); 
      doc.write(html); 
      doc.close();

      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = () => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        };
      }

      setTimeout(() => { 
        iframe.contentWindow?.focus(); 
        iframe.contentWindow?.print(); 
      }, 500);
    }
  };

const saveMutation = useMutation({
    mutationFn: async (shouldPrint: boolean) => {
      if (cart.length === 0) throw new Error("Lista vazia");
      if (formaPagamento === "misto" && faltaMisto > 0.01) throw new Error("O valor misto não cobre o total da venda.");
      
      const pagamentoFinalString = getFormaPagamentoString();

      // 1. Registra a venda com a observação "Gravação de Copos" para destacar na Gestão Diária
      const { data: venda, error: vendaErr } = await supabase.from("vendas").insert({
        cliente_id: clienteId === "avulso" ? null : clienteId,
        valor_total: totalGeral,
        desconto: Number(descontoValor || 0),
        forma_pagamento: formaPagamento === "misto" ? pagamentoFinalString : formaPagamento,
        observacoes: "Gravação de Copos" // <--- Identificador para a Gestão Diária
      }).select("id").single();

      if (vendaErr) throw vendaErr;

      // 1.5 SE FOR CREDIÁRIO, REGISTRA A DÍVIDA E AS PARCELAS
      if (formaPagamento === "crediario") {
        if (clienteId === "avulso") throw new Error("Selecione um cliente para o crediário.");
        
        const { data: crediario, error: credErr } = await supabase.from("crediarios").insert({
          cliente_id: clienteId,
          venda_id: venda.id, // <--- IMPORTANTE: Isso garante o estorno de estoque na exclusão!
          valor_total: totalGeral,
          status: "pendente"
        }).select("id").single();

        if (credErr) throw credErr;

        const valorParcela = totalGeral / (parcelasCrediario || 1);
        const parcelasPayload = [];
        const dataBase = new Date(dataVencimentoCrediario + "T12:00:00");

        for (let i = 1; i <= parcelasCrediario; i++) {
          const dataVenc = new Date(dataBase);
          dataVenc.setMonth(dataVenc.getMonth() + (i - 1));
          parcelasPayload.push({
            crediario_id: crediario.id,
            numero_parcela: i,
            valor_parcela: valorParcela,
            data_vencimento: dataVenc.toISOString().split('T')[0],
            status_pagamento: "pendente"
          });
        }
        const { error: parcErr } = await supabase.from("crediario_parcelas").insert(parcelasPayload);
        if (parcErr) throw parcErr;
      }

      // 2. Salva os itens gravados no banco de dados para o histórico de Vendas
      const itensParaSalvar = cart
        .filter(item => item.produto) // Salva apenas se houver produto atrelado
        .map(item => ({
          venda_id: venda.id,
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: (item.produto?.preco || 0) + item.valor_servico,
          subtotal: (((item.produto?.preco || 0) + item.valor_servico) * item.quantidade)
        }));

      if (itensParaSalvar.length > 0) {
        await supabase.from("venda_itens").insert(itensParaSalvar);
      }

      // 3. Desconta o estoque dos produtos utilizados
      for (const item of cart) {
        if (item.produto) {
          const { data: v } = await supabase.from("produto_variacoes").select("estoque").eq("id", item.produto.id).single();
          if (v) {
            await supabase.from("produto_variacoes").update({ estoque: Math.max(0, v.estoque - item.quantidade) }).eq("id", item.produto.id);
          }
        }
      }
      
      return shouldPrint;
    },
    onSuccess: (print) => {
      toast.success("Gravação registrada com sucesso!");
      if (print) imprimirA4();
      
      // Limpar campos
      setCart([]);
      setIsConfirmModalOpen(false);
      setValorRecebido("");
      setDescontoValor("");
      setPagamentoMisto({ dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0 });
      setFormaPagamento("dinheiro");
      setClienteId("avulso");

      queryClient.invalidateQueries({ queryKey: ["produtos_gravacao_frescos"] });
      // Atualiza os relatórios do dashboard automaticamente
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics_v2"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_caixa"] });
    }
  });
  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in">
      <div className="flex items-center gap-3 bg-card/60 border border-border/40 p-6 rounded-[2rem] shadow-sm">
        <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20"><Edit3 className="h-6 w-6 text-primary" /></div>
        <div>
            <h1 className="text-3xl font-black">Gravação de Copos</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Adicione produtos e defina o valor do serviço de gravação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
            <div className="grid gap-4">
              <Label className="text-xs font-bold uppercase">Buscar Produto (Opcional ou Bipe o Código)</Label>
              <Popover open={openProduto} onOpenChange={setOpenProduto}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl">
                    {formItem.produto ? formItem.produto.nome : "Pesquise por nome ou código..."}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Digite o nome do produto ou código..." value={searchProduto} onValueChange={setSearchProduto} />
                    <CommandList>
                      {produtosFiltrados.length === 0 ? <CommandEmpty>Pesquise para ver resultados.</CommandEmpty> : (
                        <CommandGroup>
                          {produtosFiltrados.map(p => (
                            <CommandItem 
                              key={p.id} 
                              onSelect={() => { 
                                setFormItem({...formItem, produto: p}); 
                                setOpenProduto(false);
                                setSearchProduto(""); 
                              }} 
                              className="cursor-pointer"
                            >
                              {p.nome} - <span className="font-bold text-primary ml-auto">R$ {p.preco.toFixed(2)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase">Vlr. Gravação (R$)</Label>
                <Input type="number" step="0.01" value={formItem.valor_servico} onChange={(e) => setFormItem({...formItem, valor_servico: e.target.value})} className="h-12 rounded-xl" placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase">Qtd</Label>
                <Input type="number" min="1" value={formItem.quantidade} onChange={(e) => setFormItem({...formItem, quantidade: Number(e.target.value)})} className="h-12 rounded-xl text-center" />
              </div>
            </div>
            <Button onClick={addItem} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90"><Plus className="mr-2 h-5 w-5" /> Adicionar à Lista</Button>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm min-h-[300px]">
            <h2 className="text-sm font-black uppercase mb-4 text-muted-foreground">Itens da Sessão</h2>
            {cart.length === 0 ? <p className="text-center py-10 text-muted-foreground font-medium">Nenhum item adicionado.</p> : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id_interno} className="flex justify-between items-center p-4 bg-background border border-border/50 rounded-xl shadow-sm">
                    <div>
                      <p className="font-bold text-sm">{item.produto ? item.produto.nome : "Gravação Individual"}</p>
                      <p className="text-[11px] text-muted-foreground">Unit: R$ {(item.produto?.preco || 0).toFixed(2)} | Gravação: R$ {item.valor_servico.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-primary font-mono text-lg">R$ {(((item.produto?.preco || 0) + item.valor_servico) * item.quantidade).toFixed(2)}</span>
                      <span className="bg-muted px-2 py-1 rounded-md text-xs font-bold">Qtd: {item.quantidade}</span>
                      <Button variant="ghost" size="icon" onClick={() => setCart(cart.filter(i => i.id_interno !== item.id_interno))} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-xl space-y-4">
            <h2 className="text-sm font-black uppercase text-muted-foreground">Finalização</h2>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Cliente</Label>
              <Popover open={openCliente} onOpenChange={setOpenCliente}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 rounded-xl">
                    {clienteId === "avulso" ? "Cliente Avulso" : clientes.find(c => c.id === clienteId)?.nome}
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Nome ou CPF..." value={searchCliente} onValueChange={setSearchCliente} />
                    <CommandList>
                      {clientesFiltrados.length === 0 ? <CommandEmpty>Pesquise para selecionar.</CommandEmpty> : (
                        <CommandGroup>
                          <CommandItem onSelect={() => { setClienteId("avulso"); setOpenCliente(false); }}>Cliente Avulso</CommandItem>
                          {clientesFiltrados.map(c => (
                            <CommandItem key={c.id} onSelect={() => { setClienteId(c.id); setOpenCliente(false); }}>{c.nome}</CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Desconto (R$)</Label>
              <Input type="number" step="0.01" min="0" value={descontoValor} onChange={(e) => setDescontoValor(e.target.value ? Number(e.target.value) : "")} className="h-12 rounded-xl font-mono text-sm shadow-inner" placeholder="0.00" />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-12 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="dinheiro" className="text-sm"><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" /> Dinheiro</div></SelectItem>
                  <SelectItem value="pix" className="text-sm"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-teal-500" /> PIX</div></SelectItem>
                  <SelectItem value="cartao_credito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-indigo-500" /> Crédito</div></SelectItem>
                  <SelectItem value="cartao_debito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-500" /> Débito</div></SelectItem>
                  <SelectItem value="misto" className="text-sm bg-muted/30"><div className="flex items-center gap-2"><PieChart className="h-4 w-4 text-purple-500" /> Múltiplas (Misto)</div></SelectItem>
                  <SelectItem value="crediario" className="text-sm bg-orange-500/10"><div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-orange-600" /> Crediário / Fiado</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* BLOCO DE VALOR RECEBIDO E TROCO (DINHEIRO / PIX) */}
            {(formaPagamento === "dinheiro" || formaPagamento === "pix") && (
              <div className="grid gap-2 mt-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Valor Recebido (Para Troco)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={valorRecebido} 
                  onChange={(e) => setValorRecebido(e.target.value ? Number(e.target.value) : "")} 
                  className="h-12 rounded-xl bg-background border-border/60 font-mono text-sm shadow-inner" 
                  placeholder={`R$ ${totalGeral.toFixed(2)}`}
                />
                {Number(valorRecebido) > totalGeral && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg mt-1 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600">Troco a devolver:</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">R$ {(Number(valorRecebido) - totalGeral).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* BLOCO DE PAGAMENTO MISTO */}
            {formaPagamento === "misto" && (
              <div className="grid grid-cols-2 gap-3 mt-1 bg-background p-4 rounded-xl border border-border/50 shadow-inner">
                <div>
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Dinheiro</Label>
                  <Input type="number" min="0" step="0.01" value={pagamentoMisto.dinheiro || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, dinheiro: Number(e.target.value)})} className="h-10 mt-1 text-sm font-mono rounded-lg" placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">PIX</Label>
                  <Input type="number" min="0" step="0.01" value={pagamentoMisto.pix || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, pix: Number(e.target.value)})} className="h-10 mt-1 text-sm font-mono rounded-lg" placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Crédito</Label>
                  <Input type="number" min="0" step="0.01" value={pagamentoMisto.cartao_credito || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, cartao_credito: Number(e.target.value)})} className="h-10 mt-1 text-sm font-mono rounded-lg" placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Débito</Label>
                  <Input type="number" min="0" step="0.01" value={pagamentoMisto.cartao_debito || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, cartao_debito: Number(e.target.value)})} className="h-10 mt-1 text-sm font-mono rounded-lg" placeholder="0.00" />
                </div>
                
                <div className="col-span-2 flex justify-between items-center pt-3 mt-2 border-t border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {faltaMisto > 0.01 ? "Falta:" : faltaMisto < -0.01 ? "Troco:" : "Fechado:"}
                  </span>
                  <span className={cn("text-base font-mono font-black", faltaMisto > 0.01 ? "text-red-500" : "text-emerald-500")}>
                    R$ {Math.abs(faltaMisto).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* BLOCO DE CREDIÁRIO */}
            {formaPagamento === "crediario" && (
              <div className="grid gap-3 mt-1 bg-orange-500/10 p-4 rounded-xl border border-orange-500/20 shadow-inner">
                {clienteId === "avulso" ? (
                  <p className="text-[11px] text-red-500 font-bold flex items-center gap-1.5 p-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Selecione um cliente no topo para abrir um Crediário.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Nº Parcelas</Label>
                        <Input type="number" min="1" max="24" value={parcelasCrediario} onChange={(e) => setParcelasCrediario(Number(e.target.value))} className="h-10 mt-1 text-sm font-mono bg-background border-orange-500/30 rounded-lg" />
                      </div>
                      <div>
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">1º Vencimento</Label>
                        <Input type="date" value={dataVencimentoCrediario} onChange={(e) => setDataVencimentoCrediario(e.target.value)} className="h-10 mt-1 text-sm font-mono bg-background border-orange-500/30 rounded-lg" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-2 border-t border-orange-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor da parcela:</span>
                      <span className="text-base font-mono font-black text-orange-600">
                        R$ {(totalGeral / (parcelasCrediario || 1)).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-4 mt-2 border-t border-border/40">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">TOTAL:</span>
                <span className="text-5xl font-black text-primary font-mono tracking-tighter">R$ {totalGeral.toFixed(2)}</span>
              </div>
            </div>
            
            <Button 
              onClick={() => setIsConfirmModalOpen(true)} 
              disabled={isCobrarDisabled} 
              className={cn("w-full h-14 rounded-2xl text-lg font-bold transition-all", isCobrarDisabled ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground shadow-none" : "shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90")}
            >
              Cobrar 
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-8 text-center border-border/50 shadow-2xl bg-card">
          <DialogHeader><DialogTitle className="text-2xl font-black">Confirmar OS de Gravação</DialogTitle></DialogHeader>
          
          <div className="py-6 bg-muted/30 rounded-2xl mb-4 border border-border/40 mt-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Valor a Cobrar</p>
            <p className="text-5xl font-black text-primary font-mono tracking-tighter mt-1">R$ {totalGeral.toFixed(2)}</p>
            
            {formaPagamento === 'misto' && faltaMisto < -0.01 && (
              <p className="text-emerald-500 font-bold uppercase text-xs mt-3 inline-block bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                Troco: R$ {Math.abs(faltaMisto).toFixed(2)}
              </p>
            )}

            {(formaPagamento === "dinheiro" || formaPagamento === "pix") && Number(valorRecebido) > totalGeral && (
              <p className="text-emerald-500 font-bold uppercase text-xs mt-3 inline-block bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                Troco: R$ {(Number(valorRecebido) - totalGeral).toFixed(2)}
              </p>
            )}

            {formaPagamento === "crediario" && (
              <div className="mt-3 text-xs font-bold bg-orange-500/10 text-orange-600 px-3 py-2 rounded-lg border border-orange-500/20 inline-block">
                Registrado em {parcelasCrediario}x de R$ {(totalGeral / (parcelasCrediario || 1)).toFixed(2)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending} className="h-14 rounded-xl font-bold bg-primary hover:bg-primary/90 text-base shadow-md">
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Printer className="mr-2 h-5 w-5"/>} Finalizar e Imprimir 
            </Button>
            <Button onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending} variant="outline" className="h-14 rounded-xl font-bold text-base hover:bg-muted/50 border-border/60">
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2 h-5 w-5"/>} Apenas Finalizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}