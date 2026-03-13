import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  modelo_compativel: string | null;
  preco_custo: number;
  preco_venda: number;
  preco_lojista: number;
  estoque: number;
  estoque_minimo: number;
  created_at: string;
}

const emptyProduto = {
  nome: "", categoria: "", marca: "", modelo_compativel: "",
  preco_custo: 0, preco_venda: 0, preco_lojista: 0, estoque: 0, estoque_minimo: 5,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyProduto);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { loadProdutos(); }, []);

  async function loadProdutos() {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  }

  const filtered = produtos.filter((p) =>
    [p.nome, p.categoria, p.marca, p.modelo_compativel].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      ...form,
      preco_custo: Number(form.preco_custo),
      preco_venda: Number(form.preco_venda),
      preco_lojista: Number(form.preco_lojista),
      estoque: Number(form.estoque),
      estoque_minimo: Number(form.estoque_minimo),
    };
    if (editId) {
      await supabase.from("produtos").update(payload).eq("id", editId);
      toast.success("Produto atualizado");
    } else {
      await supabase.from("produtos").insert(payload);
      toast.success("Produto cadastrado");
    }
    setDialogOpen(false);
    setForm(emptyProduto);
    setEditId(null);
    loadProdutos();
  }

  function handleEdit(p: Produto) {
    setForm({
      nome: p.nome, categoria: p.categoria || "", marca: p.marca || "", modelo_compativel: p.modelo_compativel || "",
      preco_custo: p.preco_custo, preco_venda: p.preco_venda, preco_lojista: p.preco_lojista,
      estoque: p.estoque, estoque_minimo: p.estoque_minimo,
    });
    setEditId(p.id);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("produtos").delete().eq("id", id);
    toast.success("Produto excluído");
    loadProdutos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos / Estoque</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(emptyProduto); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Modelo Compatível</Label><Input value={form.modelo_compativel} onChange={(e) => setForm({ ...form, modelo_compativel: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Preço Custo</Label><Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Preço Venda</Label><Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Preço Lojista</Label><Input type="number" step="0.01" value={form.preco_lojista} onChange={(e) => setForm({ ...form, preco_lojista: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Estoque</Label><Input type="number" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Estoque Mínimo</Label><Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} /></div>
              </div>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Lojista</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.categoria || "—"}</TableCell>
                  <TableCell>{p.marca || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">R$ {Number(p.preco_custo).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">R$ {Number(p.preco_venda).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">R$ {Number(p.preco_lojista).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${p.estoque <= p.estoque_minimo ? "text-destructive" : ""}`}>
                      {p.estoque <= p.estoque_minimo && <AlertTriangle className="h-3 w-3" />}
                      {p.estoque}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
