import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHODS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

interface ClienteOption { id: string; nome: string; tipo_cliente: string; }
interface ProdutoOption { id: string; nome: string; preco_venda: number; preco_lojista: number; estoque: number; }
interface VendaItem { produto_id: string; nome: string; quantidade: number; preco_unitario: number; subtotal: number; }

export default function VendasPage() {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [isLojista, setIsLojista] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [itens, setItens] = useState<VendaItem[]>([]);
  const [newItem, setNewItem] = useState({ produto_id: "", quantidade: 1 });
  const [vendas, setVendas] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("clientes").select("id, nome, tipo_cliente").order("nome"),
      supabase.from("produtos").select("id, nome, preco_venda, preco_lojista, estoque").gt("estoque", 0).order("nome"),
      supabase.from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(20),
    ]).then(([c, p, v]) => {
      setClientes(c.data || []);
      setProdutos(p.data || []);
      setVendas(v.data || []);
    });
  }, []);

  function onClienteChange(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setIsLojista(c?.tipo_cliente === "lojista");
    // Recalculate prices for existing items
    setItens((prev) =>
      prev.map((item) => {
        const prod = produtos.find((p) => p.id === item.produto_id);
        if (!prod) return item;
        const price = c?.tipo_cliente === "lojista" ? Number(prod.preco_lojista) : Number(prod.preco_venda);
        return { ...item, preco_unitario: price, subtotal: price * item.quantidade };
      })
    );
  }

  function addItem() {
    const prod = produtos.find((p) => p.id === newItem.produto_id);
    if (!prod) return;
    if (newItem.quantidade > prod.estoque) { toast.error("Estoque insuficiente"); return; }
    const price = isLojista ? Number(prod.preco_lojista) : Number(prod.preco_venda);
    setItens([...itens, { produto_id: prod.id, nome: prod.nome, quantidade: newItem.quantidade, preco_unitario: price, subtotal: price * newItem.quantidade }]);
    setNewItem({ produto_id: "", quantidade: 1 });
  }

  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx));
  }

  const total = itens.reduce((s, i) => s + i.subtotal, 0);

  async function finalizarVenda() {
    if (itens.length === 0) { toast.error("Adicione itens à venda"); return; }
    const { data: venda, error } = await supabase.from("vendas").insert({
      cliente_id: clienteId || null,
      valor_total: total,
      forma_pagamento: formaPagamento,
    }).select("id").single();
    if (error || !venda) { toast.error("Erro ao criar venda"); return; }
    // Insert items
    await supabase.from("venda_itens").insert(
      itens.map((i) => ({ venda_id: venda.id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal }))
    );
    // Decrease stock
    for (const item of itens) {
      const prod = produtos.find((p) => p.id === item.produto_id);
      if (prod) await supabase.from("produtos").update({ estoque: prod.estoque - item.quantidade }).eq("id", prod.id);
    }
    toast.success("Venda finalizada!");
    setItens([]);
    setClienteId("");
    // Reload
    const { data: v } = await supabase.from("vendas").select("*, clientes(nome)").order("created_at", { ascending: false }).limit(20);
    setVendas(v || []);
    const { data: p } = await supabase.from("produtos").select("id, nome, preco_venda, preco_lojista, estoque").gt("estoque", 0).order("nome");
    setProdutos(p || []);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vendas</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova Venda</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={onClienteChange}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome} {c.tipo_cliente === "lojista" ? "🏪" : ""}</SelectItem>))}</SelectContent>
                  </Select>
                  {isLojista && <p className="text-xs text-primary mt-1">Preço de lojista aplicado</p>}
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Produto</Label>
                  <Select value={newItem.produto_id} onValueChange={(v) => setNewItem({ ...newItem, produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                    <SelectContent>{produtos.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome} (est: {p.estoque})</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Qtd</Label>
                  <Input type="number" min={1} className="w-20" value={newItem.quantidade} onChange={(e) => setNewItem({ ...newItem, quantidade: Number(e.target.value) })} />
                </div>
                <Button onClick={addItem}><Plus className="h-4 w-4" /></Button>
              </div>

              {itens.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((i, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{i.nome}</TableCell>
                        <TableCell className="text-center font-mono">{i.quantidade}</TableCell>
                        <TableCell className="text-right font-mono">R$ {i.preco_unitario.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">R$ {i.subtotal.toFixed(2)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-lg font-bold">Total: <span className="font-mono">R$ {total.toFixed(2)}</span></span>
                <Button onClick={finalizarVenda} disabled={itens.length === 0}>
                  <ShoppingCart className="h-4 w-4 mr-2" />Finalizar Venda
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Vendas Recentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vendas.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma venda registrada.</p>}
            {vendas.map((v: any) => (
              <div key={v.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                <div>
                  <p className="font-medium">{v.clientes?.nome || "Sem cliente"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="font-mono font-semibold">R$ {Number(v.valor_total).toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
