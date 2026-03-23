import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Loader2, Check, ChevronsUpDown, PackageOpen, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  preco_lojista: number; 
  estoque: number;
}

interface CartItem {
  produto: Produto;
  quantidade: number;
}

export default function VendasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [clienteId, setClienteId] = useState<string>("avulso");
  const [openCliente, setOpenCliente] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");

  // 1. Fetch de Produtos 
  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos_pdv", search],
    queryFn: async () => {
      let query = supabase.from("produtos").select("id, nome, preco_venda, preco_lojista, estoque").gt("estoque", 0).order("nome");
      if (search) query = query.ilike("nome", `%${search}%`);
      const { data, error } = await query.limit(30);
      if (error) throw error;
      return data as Produto[];
    },
  });

  // 2. Fetch de Clientes 
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_select_pdv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome, tipo_cliente").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // LOGICA INTELIGENTE DE PREÇOS
  const isLojista = useMemo(() => {
    if (clienteId === "avulso") return false;
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.tipo_cliente === "lojista";
  }, [clienteId, clientes]);

  const getProductPrice = (p: Produto) => {
    if (isLojista && p.preco_lojista > 0) return p.preco_lojista;
    return p.preco_venda;
  };

  // Cálculos do Carrinho em tempo real
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (getProductPrice(item.produto) * item.quantidade), 0), [cart, isLojista]);
  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantidade, 0), [cart]);

  // Ações do Carrinho
  const addToCart = (produto: Produto) => {
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

  // 3. Mutation de Checkout
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("O carrinho está vazio.");

      const { data: venda, error: vendaErr } = await supabase
        .from("vendas")
        .insert({
          cliente_id: clienteId === "avulso" ? null : clienteId,
          valor_total: cartTotal,
          forma_pagamento: formaPagamento,
        }).select("id").single();

      if (vendaErr) throw vendaErr;

      const itensPayload = cart.map((item) => {
        const precoFinal = getProductPrice(item.produto);
        return {
          venda_id: venda.id,
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: precoFinal,
          subtotal: precoFinal * item.quantidade,
        };
      });

      const { error: itensErr } = await supabase.from("venda_itens").insert(itensPayload);
      if (itensErr) throw itensErr;

      for (const item of cart) {
        const novoEstoque = item.produto.estoque - item.quantidade;
        await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.produto.id);
      }
    },
    onSuccess: () => {
      toast.success("Venda finalizada com sucesso!");
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["produtos_pdv"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao finalizar."),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-6 pb-6 animate-in fade-in duration-500">
      
      {/* Cabeçalho Premium */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20"><ShoppingCart className="h-6 w-6 text-primary" /></div>
            Frente de Caixa (PDV)
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Selecione os produtos e feche a venda rapidamente.</p>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold rounded-xl transition-colors">
              Limpar Tudo
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* LADO ESQUERDO: Catálogo de Produtos */}
        <div className="xl:col-span-2 flex flex-col min-h-0 gap-5">
          
          {/* Barra de Busca Premium */}
          <div className="relative group shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Buscar pelo nome do produto..." 
              className="pl-12 h-14 text-base rounded-2xl bg-card/80 border-border/50 shadow-sm backdrop-blur-sm focus-visible:ring-primary focus-visible:bg-background transition-all" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>

          <ScrollArea className="flex-1 rounded-3xl bg-muted/10 border border-border/40 p-5 shadow-inner">
            {loadingProdutos ? (
              <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">A carregar catálogo...</p>
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground/80">
                <PackageOpen className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-bold">Nenhum produto encontrado</p>
                <p className="text-sm opacity-70">Tente buscar por outro termo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                {produtos.map((p) => {
                  const cartQtd = cart.find(i => i.produto.id === p.id)?.quantidade || 0;
                  const estoqueRestante = p.estoque - cartQtd; // Calcula o estoque em tempo real
                  const esgotado = estoqueRestante <= 0;
                  const inCart = cartQtd > 0;
                  const precoAtual = getProductPrice(p);
                  const isPrecoLojistaAtivo = isLojista && p.preco_lojista > 0;

                  return (
                    <div 
                      key={p.id} 
                      onClick={() => !esgotado && addToCart(p)} 
                      className={cn(
                        "group relative rounded-2xl p-5 flex flex-col cursor-pointer transition-all duration-300 border-2 overflow-hidden", 
                        inCart ? "border-primary bg-primary/[0.03] shadow-md scale-[0.98]" : "border-border/40 bg-card shadow-sm hover:shadow-lg hover:border-primary/40 hover:-translate-y-1", 
                        esgotado && !inCart && "opacity-50 cursor-not-allowed grayscale-[50%]"
                      )}
                    >
                      {inCart && (
                        <div className="absolute top-3 right-3 bg-primary text-primary-foreground min-w-[28px] h-7 px-2 rounded-full flex items-center justify-center text-xs font-black shadow-md z-10 animate-in zoom-in">
                          {cartQtd}
                        </div>
                      )}
                      
                      {/* Efeito de brilho de fundo no hover */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                      <div className={cn("flex-1 font-bold leading-tight mb-4 text-[15px] text-foreground/90 relative z-10", inCart && "pr-8")}>
                        {p.nome}
                      </div>

                      {/* VALOR E ESTOQUE ALINHADOS EM BAIXO */}
                      <div className="mt-auto flex flex-col relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-black tracking-tighter text-foreground flex items-center gap-2">
                            R$ {precoAtual.toFixed(2)}
                          </span>
                          
                          {/* Ícone com title corrigido usando span em volta */}
                          {isPrecoLojistaAtivo && (
                            <span title="Preço de Lojista Ativo" className="flex items-center bg-primary/10 p-1 rounded-md">
                              <BadgePercent className="h-4 w-4 text-primary" />
                            </span>
                          )}
                        </div>
                        
                        {/* ESTOQUE EM BAIXO DO VALOR SEMPRE ATUALIZADO */}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full", esgotado ? "bg-destructive animate-pulse" : "bg-emerald-500")} />
                          <span className={cn("text-[11px] font-bold uppercase tracking-wider", esgotado ? "text-destructive" : "text-muted-foreground/90")}>
                            {esgotado ? "Esgotado" : `Estoque: ${estoqueRestante} un`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* LADO DIREITO: Carrinho e Checkout */}
        <Card className="flex flex-col min-h-0 shadow-2xl border-border/40 rounded-[2rem] overflow-hidden bg-card/60 backdrop-blur-xl relative">
          
          <div className="absolute top-0 inset-x-0 h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxwYXRoIGQ9Ik0wIDEwbDEwIDEwTDIwIDEwVjBIMHoiIGZpbGw9IiNmM2Y0ZjYiIGZpbGwtb3BhY2l0eT0iMC41IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KPC9zdmc+')] opacity-20 dark:opacity-10 pointer-events-none z-10"></div>

          <CardHeader className="bg-background/90 border-b border-border/40 p-6 pt-8 z-20">
            <CardTitle className="text-lg font-black flex justify-between items-center text-foreground/90 uppercase tracking-widest">
              Resumo do Pedido
              <span className="bg-primary/10 border border-primary/20 text-primary text-sm px-3 py-1 rounded-xl font-bold font-mono shadow-inner">
                {cartItemsCount} {cartItemsCount === 1 ? 'item' : 'itens'}
              </span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-gradient-to-b from-background/30 to-background/60 z-20">
            <ScrollArea className="flex-1 p-5 px-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 my-16">
                  <div className="bg-muted p-6 rounded-3xl mb-4 shadow-inner border border-border/50">
                    <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="font-bold text-lg">O carrinho está vazio</p>
                  <p className="text-sm font-medium mt-1">Adicione produtos à esquerda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const precoUnitario = getProductPrice(item.produto);
                    const subtotal = precoUnitario * item.quantidade;
                    const estoqueRestante = item.produto.estoque - item.quantidade; // Estoque em tempo real no carrinho

                    return (
                      <div key={item.produto.id} className="flex flex-col gap-3 p-4 bg-background rounded-2xl border border-border/60 shadow-sm group hover:shadow-md transition-all relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors"></div>

                        <div className="flex justify-between items-start gap-3 pl-2">
                          <span className="font-bold text-sm leading-snug text-foreground/90">{item.produto.nome}</span>
                          <span className="font-mono text-base font-black text-foreground whitespace-nowrap">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex items-end justify-between pl-2">
                          {/* Valor unitário e estoque no carrinho */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground font-semibold bg-muted/50 px-2 py-1 rounded-md border border-border/40 w-fit">
                              R$ {precoUnitario.toFixed(2)} /un
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 font-bold ml-1">
                              Restam {estoqueRestante}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-muted/40 rounded-full border border-border/60 p-0.5 shadow-sm">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-background" onClick={() => updateQuantity(item.produto.id, -1)}>
                                <Minus className="h-3 w-3 font-bold" />
                              </Button>
                              <span className="w-6 text-center text-sm font-bold font-mono">{item.quantidade}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-background" onClick={() => updateQuantity(item.produto.id, 1)}>
                                <Plus className="h-3 w-3 font-bold" />
                              </Button>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.produto.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            {/* ÁREA DE CHECKOUT */}
            <div className="p-6 bg-background border-t border-border/50 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.1)] space-y-6 relative z-30">
              
              <div className="grid gap-3">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cliente / Desconto</Label>
                <Popover open={openCliente} onOpenChange={setOpenCliente}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openCliente} className="w-full justify-between h-12 rounded-xl bg-card border-border/60 hover:bg-muted/50 transition-colors shadow-sm font-bold text-foreground/80">
                      {clienteId === "avulso" ? "Cliente Avulso (Padrão)" : clientes.find((c) => c.id === clienteId)?.nome || "Selecionar cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-0 rounded-2xl shadow-xl border-border/50" align="end">
                    <Command>
                      <CommandInput placeholder="Procurar cliente pelo nome..." className="h-12 font-medium" />
                      <CommandList className="max-h-[250px]">
                        <CommandEmpty className="p-4 text-center text-sm font-medium text-muted-foreground">Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="avulso" onSelect={() => { setClienteId("avulso"); setOpenCliente(false); }} className="py-3 cursor-pointer">
                            <Check className={cn("mr-3 h-4 w-4 text-primary", clienteId === "avulso" ? "opacity-100" : "opacity-0")} />
                            <span className="font-bold">Cliente Avulso <span className="font-normal text-muted-foreground ml-1">(Preço Padrão)</span></span>
                          </CommandItem>
                          {clientes.map((cliente) => (
                            <CommandItem key={cliente.id} value={cliente.nome} onSelect={() => { setClienteId(cliente.id); setOpenCliente(false); }} className="py-3 cursor-pointer">
                              <Check className={cn("mr-3 h-4 w-4 text-primary", clienteId === cliente.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-bold">{cliente.nome}</span>
                                {cliente.tipo_cliente === "lojista" && <span className="text-[10px] text-primary bg-primary/10 w-fit px-2 py-0.5 rounded uppercase font-bold tracking-wider mt-1">Desconto Lojista Ativo</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-3">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Método de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="h-12 rounded-xl bg-card border-border/60 shadow-sm font-bold text-foreground/80 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-xl">
                    <SelectItem value="dinheiro" className="py-3 cursor-pointer"><div className="flex items-center gap-3 font-bold"><Banknote className="h-4 w-4 text-emerald-500" /> Dinheiro</div></SelectItem>
                    <SelectItem value="pix" className="py-3 cursor-pointer"><div className="flex items-center gap-3 font-bold"><Smartphone className="h-4 w-4 text-teal-500" /> PIX</div></SelectItem>
                    <SelectItem value="cartao_credito" className="py-3 cursor-pointer"><div className="flex items-center gap-3 font-bold"><CreditCard className="h-4 w-4 text-indigo-500" /> Cartão de Crédito</div></SelectItem>
                    <SelectItem value="cartao_debito" className="py-3 cursor-pointer"><div className="flex items-center gap-3 font-bold"><CreditCard className="h-4 w-4 text-orange-500" /> Cartão de Débito</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-2">
                <div className="flex justify-between items-end pb-4 px-1">
                  <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total a Cobrar</span>
                  <span className="text-4xl font-black text-primary tracking-tighter font-mono drop-shadow-sm">R$ {cartTotal.toFixed(2)}</span>
                </div>
                
                <Button 
                  className="w-full h-16 rounded-2xl text-xl font-black shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 relative overflow-hidden group" 
                  disabled={cart.length === 0 || checkoutMutation.isPending} 
                  onClick={() => checkoutMutation.mutate()}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                  {checkoutMutation.isPending ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Concluindo Venda...</> : "Confirmar Venda"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}