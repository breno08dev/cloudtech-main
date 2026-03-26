import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Loader2, Check, ChevronsUpDown, PackageOpen, BadgePercent, Printer, Barcode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SellableItem {
  id: string;
  produto_base_id: string;
  nome: string;
  qualidade: string;
  com_aro: boolean;
  preco_venda: number;
  preco_lojista: number; 
  estoque: number;
  codigo_barras: string;
}

interface CartItem {
  produto: SellableItem;
  quantidade: number;
}

export default function VendasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [clienteId, setClienteId] = useState<string>("avulso");
  const [openCliente, setOpenCliente] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos_pdv"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produto_base")
        .select("id, nome, codigo_barras_base, variacoes:produto_variacoes(id, qualidade, com_aro, preco_venda, preco_lojista, estoque, codigo_barras_especifico)");
        
      if (error) throw error;

      const flatList: SellableItem[] = [];
      (data || []).forEach((base: any) => {
        if (!base.variacoes) return;
        base.variacoes.forEach((v: any) => {
          if (v.estoque > 0) {
            flatList.push({
              id: v.id,
              produto_base_id: base.id,
              nome: base.nome,
              qualidade: v.qualidade,
              com_aro: v.com_aro,
              preco_venda: v.preco_venda,
              preco_lojista: v.preco_lojista,
              estoque: v.estoque,
              codigo_barras: v.codigo_barras_especifico || base.codigo_barras_base || ""
            });
          }
        });
      });
      return flatList.sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const produtosFiltrados = useMemo(() => {
    if (!search) return produtos;
    const s = search.toLowerCase();
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(s) || 
      p.codigo_barras.toLowerCase() === s ||
      p.qualidade.toLowerCase().includes(s)
    );
  }, [produtos, search]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_select_pdv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome, tipo_cliente").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const isLojista = useMemo(() => {
    if (clienteId === "avulso") return false;
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.tipo_cliente === "lojista";
  }, [clienteId, clientes]);

  const getProductPrice = (p: SellableItem) => {
    if (isLojista && p.preco_lojista > 0) return p.preco_lojista;
    return p.preco_venda;
  };

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (getProductPrice(item.produto) * item.quantidade), 0), [cart, isLojista]);
  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantidade, 0), [cart]);

  const addToCart = (produto: SellableItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id);
      if (existing) {
        if (existing.quantidade >= produto.estoque) {
          toast.error("Estoque insuficiente.");
          return prev;
        }
        return prev.map((item) => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return;
    const itemEncontrado = produtos.find(p => p.codigo_barras === search);
    if (itemEncontrado) {
      addToCart(itemEncontrado);
      setSearch("");
      toast.success(`${itemEncontrado.nome} adicionado!`);
    }
  };

  const updateQuantity = (produtoId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.produto.id === produtoId) {
          const newQtd = item.quantidade + delta;
          if (newQtd <= 0) return item; 
          if (newQtd > item.produto.estoque) {
            toast.error("Estoque máximo atingido.");
            return item;
          }
          return { ...item, quantidade: newQtd };
        }
        return item;
      });
    });
  };

  const removeFromCart = (produtoId: string) => setCart((prev) => prev.filter((item) => item.produto.id !== produtoId));
  const clearCart = () => { setCart([]); setClienteId("avulso"); setFormaPagamento("dinheiro"); };

  // ================= NOVA LÓGICA DE IMPRESSÃO (Igual à OS) =================
  const imprimirCupom = () => {
    const nomeEmpresa = config?.nome_empresa || "MINHA EMPRESA";
    const endereco = config?.endereco || "";
    const telefone = config?.telefone || "";
    const nomeCliente = clienteId === "avulso" ? "Avulso" : clientes.find((c) => c.id === clienteId)?.nome || "Não informado";
    const dataAtual = new Date().toLocaleString("pt-BR");

    const linhasProdutos = cart.map(item => {
      const pu = getProductPrice(item.produto);
      const st = pu * item.quantidade;
      return `
        <tr>
          <td style="padding: 3px 0; border-bottom: 1px dotted #ccc;">${item.quantidade}</td>
          <td style="padding: 3px 0; border-bottom: 1px dotted #ccc; max-width: 35mm; word-wrap: break-word;">${item.produto.nome} (${item.produto.qualidade})</td>
          <td style="padding: 3px 0; border-bottom: 1px dotted #ccc; text-align: right;">${pu.toFixed(2)}</td>
          <td style="padding: 3px 0; border-bottom: 1px dotted #ccc; text-align: right;">${st.toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Recibo</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 5mm; color: #000; width: 70mm; }
        h1, h2, h3, p { margin: 0; padding: 0; line-height: 1.2; }
        .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
        .linha { border-bottom: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { border-bottom: 1px dashed #000; text-align: left; padding-bottom: 4px; font-weight: bold; }
      </style>
      </head>
      <body>
        <div class="center"><h2 class="bold" style="font-size: 16px;">${nomeEmpresa}</h2>${endereco ? `<p>${endereco}</p>` : ""}${telefone ? `<p>Tel: ${telefone}</p>` : ""}<div class="linha"></div><h3 class="bold">CUPOM NAO FISCAL</h3><p>${dataAtual}</p></div>
        <div class="linha"></div>
        <div style="margin-bottom: 8px;"><p><span class="bold">Cliente:</span> ${nomeCliente}</p><p><span class="bold">Pagamento:</span> ${formaPagamento.toUpperCase()}</p></div>
        <table><thead><tr><th>QTD</th><th>PRODUTO</th><th class="right">UN</th><th class="right">TOT</th></tr></thead><tbody>${linhasProdutos}</tbody></table>
        <div class="linha"></div>
        <div class="right"><h2 class="bold" style="font-size: 16px;">TOTAL: R$ ${cartTotal.toFixed(2)}</h2></div>
        <div class="center" style="margin-top: 20px;"><p class="bold">Obrigado pela preferencia!</p><p style="font-size: 10px; margin-top: 5px;">Sistema</p></div>
      </body></html>
    `;

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
      doc.write(htmlContent); 
      doc.close();

      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = () => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        };
      }

      setTimeout(() => { 
        iframe.contentWindow?.focus(); 
        iframe.contentWindow?.print(); 
      }, 500);
    }
  };
  // ================= FIM NOVA LÓGICA DE IMPRESSÃO =================

  const checkoutMutation = useMutation({
    mutationFn: async (shouldPrint: boolean) => {
      if (cart.length === 0) throw new Error("O carrinho está vazio.");

      const { data: venda, error: vendaErr } = await (supabase as any).from("vendas").insert({
        cliente_id: clienteId === "avulso" ? null : clienteId,
        valor_total: cartTotal,
        forma_pagamento: formaPagamento,
      }).select("id").single();
      if (vendaErr) throw vendaErr;

      const itensPayload = cart.map((item) => ({
        venda_id: venda.id,
        produto_id: item.produto.id, 
        quantidade: item.quantidade,
        preco_unitario: getProductPrice(item.produto),
        subtotal: getProductPrice(item.produto) * item.quantidade,
      }));

      const { error: itensErr } = await (supabase as any).from("venda_itens").insert(itensPayload);
      if (itensErr) throw itensErr;

      for (const item of cart) {
        await (supabase as any).from("produto_variacoes").update({ estoque: item.produto.estoque - item.quantidade }).eq("id", item.produto.id);
      }
      return shouldPrint;
    },
    onSuccess: (shouldPrint) => {
      toast.success("Venda finalizada com sucesso!");
      setIsConfirmModalOpen(false);
      if (shouldPrint) imprimirCupom();
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["produtos_pdv"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    },
    onError: (err: any) => { toast.error(err.message || "Erro ao finalizar."); },
  });

  return (
    <>
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 border-border/50 shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-center mb-2">Resumo da Venda</DialogTitle>
          </DialogHeader>
          
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-center bg-muted/30 rounded-2xl border border-border/40">
            <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest">Valor a Cobrar</p>
            <p className="text-5xl font-black text-primary font-mono tracking-tighter">R$ {cartTotal.toFixed(2)}</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border/50 shadow-sm text-xs font-bold text-foreground/80 uppercase">
              <span>{cartItemsCount} {cartItemsCount === 1 ? 'item' : 'itens'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
              <span className="text-primary">{formaPagamento.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <Button className="h-14 text-base font-bold rounded-xl w-full bg-primary hover:bg-primary/90 shadow-md transition-all" onClick={() => checkoutMutation.mutate(true)} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Printer className="mr-2 h-5 w-5" />}
              Finalizar e Imprimir
            </Button>
            <Button variant="outline" className="h-14 text-base font-bold rounded-xl w-full border-border/60 hover:bg-muted/50 transition-all" onClick={() => checkoutMutation.mutate(false)} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2 h-5 w-5" />}
              Apenas Finalizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDV ESTRUTURA GOLD STANDARD: h-full absoluto sem scroll na página */}
      <div className="flex flex-col lg:flex-row gap-4 h-full w-full animate-in fade-in duration-500">
        
        {/* LADO ESQUERDO: Catálogo */}
        <div className="flex-1 flex flex-col min-w-0 bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
          
          <div className="p-4 border-b border-border/40 bg-muted/10 shrink-0 flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <h1 className="text-xl font-black flex items-center gap-2 text-foreground">
                <ShoppingCart className="h-5 w-5 text-primary" /> Ponto de Venda
              </h1>
            </div>
            
            <form onSubmit={handleBarcodeSubmit} className="relative flex-1 max-w-md group">
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Buscar ou Bipe o Código..." 
                className="pl-11 pr-11 h-12 rounded-xl bg-background border-border/50 shadow-sm focus-visible:ring-primary font-medium" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                autoFocus
              />
              <Button type="submit" size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background/50">
            {loadingProdutos ? (
              <div className="flex flex-col justify-center items-center h-full gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">A carregar catálogo...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/80">
                <PackageOpen className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-bold">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {produtosFiltrados.map((p) => {
                  const cartQtd = cart.find(i => i.produto.id === p.id)?.quantidade || 0;
                  const estoqueRestante = p.estoque - cartQtd; 
                  const esgotado = estoqueRestante <= 0;
                  const inCart = cartQtd > 0;
                  const precoAtual = getProductPrice(p);
                  const isPrecoLojistaAtivo = isLojista && p.preco_lojista > 0;

                  return (
                    <div key={p.id} onClick={() => !esgotado && addToCart(p)} className={cn("group relative rounded-2xl p-4 flex flex-col cursor-pointer transition-all border-2 overflow-hidden", inCart ? "border-primary bg-primary/5 shadow-md" : "border-border/40 bg-card hover:border-primary/40", esgotado && !inCart && "opacity-50 cursor-not-allowed grayscale-[50%]")}>
                      {inCart && <div className="absolute top-2 right-2 bg-primary text-primary-foreground min-w-[24px] h-6 px-2 rounded-full flex items-center justify-center text-xs font-black shadow-sm z-10">{cartQtd}</div>}
                      <div className={cn("flex-1 leading-tight mb-4 text-sm text-foreground/90 relative z-10", inCart && "pr-6")}>
                        <span className="font-bold">{p.nome}</span>
                        <div className="text-[10px] text-muted-foreground font-medium mt-1 flex flex-wrap gap-1">
                          <span className="bg-muted px-1.5 py-0.5 rounded border border-border/50 uppercase">{p.qualidade}</span>
                          {p.com_aro && <span className="bg-muted px-1.5 py-0.5 rounded border border-border/50 uppercase">Com Aro</span>}
                        </div>
                      </div>
                      <div className="mt-auto flex flex-col relative z-10 border-t border-border/30 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black tracking-tighter text-foreground">R$ {precoAtual.toFixed(2)}</span>
                          {isPrecoLojistaAtivo && <BadgePercent className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full", esgotado ? "bg-destructive animate-pulse" : "bg-emerald-500")} />
                          <span className={cn("text-[10px] font-bold uppercase tracking-wider", esgotado ? "text-destructive" : "text-muted-foreground")}>
                            {esgotado ? "Esgotado" : `Restam: ${estoqueRestante}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LADO DIREITO: Carrinho Fixo */}
        <div className="w-full lg:w-[400px] flex flex-col shrink-0 bg-card rounded-3xl border border-border/40 shadow-xl overflow-hidden">
          
          <div className="p-4 border-b border-border/40 bg-muted/10 shrink-0 flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> Carrinho
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold rounded-lg transition-colors">
                Limpar Tudo
              </Button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-background/30">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <PackageOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className="font-bold text-sm">Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const precoUnitario = getProductPrice(item.produto);
                  const subtotal = precoUnitario * item.quantidade;

                  return (
                    <div key={item.produto.id} className="flex flex-col gap-2 p-3 bg-background rounded-xl border border-border/60 shadow-sm relative group">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-snug">{item.produto.nome}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{item.produto.qualidade} {item.produto.com_aro && '(Aro)'}</span>
                        </div>
                        <span className="font-mono text-sm font-black text-foreground">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground font-semibold bg-muted/40 px-1.5 py-0.5 rounded border border-border/30">
                          R$ {precoUnitario.toFixed(2)} /un
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center bg-muted/30 rounded-lg border border-border/50 p-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-background" onClick={() => updateQuantity(item.produto.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-xs font-bold font-mono">{item.quantidade}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-background" onClick={() => updateQuantity(item.produto.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.produto.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Área de Pagamento (Travada no Fundo) */}
          <div className="p-4 bg-muted/10 border-t border-border/40 shrink-0 space-y-4 relative z-20">
            
            <div className="grid gap-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cliente / Lojista</Label>
              <Popover open={openCliente} onOpenChange={setOpenCliente}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openCliente} className="w-full justify-between h-10 rounded-xl bg-background border-border/60 hover:bg-muted/50 text-xs font-bold">
                    {clienteId === "avulso" ? "Cliente Avulso (Padrão)" : clientes.find((c) => c.id === clienteId)?.nome}
                    <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0 rounded-xl" align="end">
                  <Command>
                    <CommandInput placeholder="Procurar cliente..." className="h-10 text-sm" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty className="p-3 text-center text-xs">Nenhum cliente.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="avulso" onSelect={() => { setClienteId("avulso"); setOpenCliente(false); }} className="py-2 cursor-pointer text-sm">
                          <Check className={cn("mr-2 h-4 w-4 text-primary", clienteId === "avulso" ? "opacity-100" : "opacity-0")} />
                          <span className="font-bold">Cliente Avulso</span>
                        </CommandItem>
                        {clientes.map((c) => (
                          <CommandItem key={c.id} value={c.nome} onSelect={() => { setClienteId(c.id); setOpenCliente(false); }} className="py-2 cursor-pointer text-sm">
                            <Check className={cn("mr-2 h-4 w-4 text-primary", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-bold">{c.nome}</span>
                              {c.tipo_cliente === "lojista" && <span className="text-[9px] text-primary font-bold uppercase mt-0.5">Lojista</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-10 rounded-xl bg-background border-border/60 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="dinheiro" className="text-sm"><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" /> Dinheiro</div></SelectItem>
                  <SelectItem value="pix" className="text-sm"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-teal-500" /> PIX</div></SelectItem>
                  <SelectItem value="cartao_credito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-indigo-500" /> Crédito</div></SelectItem>
                  <SelectItem value="cartao_debito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-orange-500" /> Débito</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2 pb-1 flex justify-between items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="text-4xl font-black text-primary tracking-tighter font-mono">R$ {cartTotal.toFixed(2)}</span>
            </div>
            
            <Button className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20" disabled={cart.length === 0} onClick={() => setIsConfirmModalOpen(true)}>
              Cobrar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}