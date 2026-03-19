import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Loader2, Check, ChevronsUpDown, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  preco_lojista: number; // NOVO CAMPO
  estoque: number;
}

// O CartItem agora só guarda a quantidade, o subtotal é calculado em tempo real!
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

  // 1. Fetch de Produtos (Agora puxa também o preco_lojista)
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

  // 2. Fetch de Clientes (Agora puxa o tipo_cliente)
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
    // Se for lojista E o produto tiver um preço de lojista configurado (> 0), aplica desconto.
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
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl"><ShoppingCart className="h-7 w-7 text-primary" /></div>
            Frente de Caixa
          </h1>
          <p className="text-muted-foreground mt-1 ml-1">Registo de vendas rápidas e controlo de stock.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Catálogo */}
        <div className="xl:col-span-2 flex flex-col min-h-0 gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Buscar produto..." className="pl-12 h-14 text-lg rounded-2xl bg-card border-border/50 shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <ScrollArea className="flex-1 rounded-2xl bg-muted/20 border border-border/40 p-4">
            {loadingProdutos ? <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-10 w-10 animate-spin text-primary/60" /></div>
            : produtos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
                <PackageOpen className="h-16 w-16 mb-4 opacity-20" /><p className="text-lg font-medium">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                {produtos.map((p) => {
                  const cartQtd = cart.find(i => i.produto.id === p.id)?.quantidade || 0;
                  const esgotado = cartQtd >= p.estoque;
                  const inCart = cartQtd > 0;
                  const precoAtual = getProductPrice(p);
                  const isPrecoLojistaAtivo = isLojista && p.preco_lojista > 0;

                  return (
                    <div key={p.id} onClick={() => !esgotado && addToCart(p)} className={cn("group relative rounded-2xl p-5 flex flex-col cursor-pointer transition-all duration-200 border-2", inCart ? "border-primary bg-primary/[0.03] shadow-md" : "border-transparent bg-card shadow-sm hover:shadow-md hover:border-primary/30", esgotado && !inCart && "opacity-50 cursor-not-allowed")}>
                      {inCart && <div className="absolute top-3 right-3 bg-primary text-primary-foreground min-w-[28px] h-7 px-2 rounded-full flex items-center justify-center text-xs font-black shadow-sm">{cartQtd}</div>}
                      <div className={cn("flex-1 font-semibold leading-tight mb-4 line-clamp-2 text-[15px]", inCart && "pr-8")}>{p.nome}</div>
                      <div className="mt-auto flex flex-col gap-1">
                        <span className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                          R$ {precoAtual.toFixed(2)}
                          {isPrecoLojistaAtivo && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">Lojista</span>}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full", esgotado ? "bg-destructive" : "bg-emerald-500")} />
                          {esgotado ? "Esgotado" : `${p.estoque - cartQtd} em stock`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Carrinho */}
        <Card className="flex flex-col min-h-0 shadow-xl border-border/50 rounded-3xl overflow-hidden bg-card/50 backdrop-blur-xl">
          <CardHeader className="bg-background/80 border-b p-5">
            <CardTitle className="text-xl font-bold flex justify-between items-center">Pedido Atual<span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-bold">{cartItemsCount} itens</span></CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-background/40">
            <ScrollArea className="flex-1 p-5">
              {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 my-12"><div className="bg-muted p-6 rounded-full mb-4"><ShoppingCart className="h-10 w-10" /></div><p className="font-medium text-lg">Carrinho vazio</p></div> : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const precoUnitario = getProductPrice(item.produto);
                    const subtotal = precoUnitario * item.quantidade;
                    return (
                      <div key={item.produto.id} className="flex flex-col gap-3 p-4 bg-background rounded-2xl border shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-start gap-3"><span className="font-semibold text-sm leading-snug">{item.produto.nome}</span><span className="font-mono text-base font-bold text-primary whitespace-nowrap">R$ {subtotal.toFixed(2)}</span></div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">R$ {precoUnitario.toFixed(2)} /un</span>
                          <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1 border">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.produto.id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                            <span className="w-6 text-center text-sm font-bold">{item.quantidade}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.produto.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeFromCart(item.produto.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="p-5 bg-background border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] space-y-5">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente (Ativa Preço Lojista)</Label>
                <Popover open={openCliente} onOpenChange={setOpenCliente}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openCliente} className="w-full justify-between h-12 rounded-xl bg-muted/20 border-primary/20">
                      {clienteId === "avulso" ? "Cliente Avulso" : clientes.find((c) => c.id === clienteId)?.nome || "Selecionar cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-0 rounded-xl" align="start">
                    <Command>
                      <CommandInput placeholder="Procurar cliente..." className="h-11" />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="avulso" onSelect={() => { setClienteId("avulso"); setOpenCliente(false); }} className="py-3">
                            <Check className={cn("mr-2 h-4 w-4 text-primary", clienteId === "avulso" ? "opacity-100" : "opacity-0")} />
                            <span className="font-medium">Cliente Avulso (Preço Padrão)</span>
                          </CommandItem>
                          {clientes.map((cliente) => (
                            <CommandItem key={cliente.id} value={cliente.nome} onSelect={() => { setClienteId(cliente.id); setOpenCliente(false); }} className="py-3">
                              <Check className={cn("mr-2 h-4 w-4 text-primary", clienteId === cliente.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{cliente.nome}</span>
                                {cliente.tipo_cliente === "lojista" && <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Lojista</span>}
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
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/20 font-medium"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="dinheiro" className="py-3"><div className="flex items-center gap-3"><Banknote className="h-5 w-5 text-emerald-500" /> Dinheiro</div></SelectItem>
                    <SelectItem value="pix" className="py-3"><div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-teal-500" /> PIX</div></SelectItem>
                    <SelectItem value="cartao_credito" className="py-3"><div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-indigo-500" /> Crédito</div></SelectItem>
                    <SelectItem value="cartao_debito" className="py-3"><div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-orange-500" /> Débito</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator className="opacity-50" />
              <div className="flex justify-between items-end pb-2">
                <span className="text-base font-semibold text-muted-foreground">Total a Pagar</span>
                <span className="text-4xl font-black text-primary tracking-tighter font-mono">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <Button className="w-full h-16 rounded-xl text-xl font-bold shadow-lg hover:shadow-primary/25 hover:-translate-y-1 transition-all" disabled={cart.length === 0 || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
                {checkoutMutation.isPending ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Processando...</> : "Finalizar Venda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}