import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, Package } from "lucide-react";
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

const produtoSchema = z.object({
  nome: z.string().min(2, "O nome do produto é obrigatório"),
  categoria: z.string().optional(),
  marca: z.string().optional(),
  modelo_compativel: z.string().optional(),
  preco_custo: z.coerce.number().min(0, "O valor não pode ser negativo"),
  preco_venda: z.coerce.number().min(0, "O valor não pode ser negativo"),
  preco_lojista: z.coerce.number().min(0, "O valor não pode ser negativo"),
  estoque: z.coerce.number().min(0, "O stock não pode ser negativo"),
  estoque_minimo: z.coerce.number().min(0, "O stock não pode ser negativo"),
});

type ProdutoFormValues = z.infer<typeof produtoSchema>;

const defaultValues: ProdutoFormValues = {
  nome: "", categoria: "", marca: "", modelo_compativel: "",
  preco_custo: 0, preco_venda: 0, preco_lojista: 0, estoque: 0, estoque_minimo: 5,
};

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues,
  });

  const { data: produtos = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ["produtos", search],
    queryFn: async () => {
      let query = supabase.from("produtos").select("*").order("nome");
      
      if (search) {
        query = query.or(`nome.ilike.%${search}%,categoria.ilike.%${search}%,marca.ilike.%${search}%,modelo_compativel.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Produto[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProdutoFormValues) => {
      const dbPayload = {
        nome: payload.nome,
        categoria: payload.categoria || null,
        marca: payload.marca || null,
        modelo_compativel: payload.modelo_compativel || null,
        preco_custo: payload.preco_custo,
        preco_venda: payload.preco_venda,
        preco_lojista: payload.preco_lojista,
        estoque: payload.estoque,
        estoque_minimo: payload.estoque_minimo,
      };

      if (editId) {
        const { error } = await supabase.from("produtos").update(dbPayload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(dbPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Produto atualizado" : "Produto cadastrado");
      setDialogOpen(false);
      reset(defaultValues);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    },
    onError: () => toast.error("Ocorreu um erro ao guardar o produto."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: () => toast.error("Não é possível excluir um produto que já está vinculado a uma OS."),
  });

  function onSubmit(data: ProdutoFormValues) {
    saveMutation.mutate(data);
  }

  function handleEdit(p: Produto) {
    reset({
      nome: p.nome,
      categoria: p.categoria || "",
      marca: p.marca || "",
      modelo_compativel: p.modelo_compativel || "",
      preco_custo: p.preco_custo,
      preco_venda: p.preco_venda,
      preco_lojista: p.preco_lojista,
      estoque: p.estoque,
      estoque_minimo: p.estoque_minimo,
    });
    setEditId(p.id);
    setDialogOpen(true);
  }

  function handleCloseDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      reset(defaultValues);
      setEditId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho Premium */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border/40 p-6 rounded-[2rem] backdrop-blur-xl shadow-sm shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
              <Package className="h-6 w-6 text-primary" />
            </div>
            Produtos e Estoque
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Gerencie peças, acessórios e acompanhe a disponibilidade.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:-translate-y-0.5 transition-all font-bold h-12 px-6 text-base">
              <Plus className="mr-2 h-5 w-5" /> Novo Produto
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/40 shadow-2xl p-0 overflow-hidden max-h-[90vh]">
            <div className="bg-muted/30 p-6 pb-4 border-b border-border/40">
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                {editId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </div>
            
            <div className="overflow-y-auto p-6 bg-background max-h-[calc(90vh-140px)]">
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
                
                {/* Nome */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome do Produto *</Label>
                  <Input {...register("nome")} className={`h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm ${errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}`} placeholder="Ex: Tela iPhone 11 Original" />
                  {errors.nome && <p className="text-xs text-red-500 font-bold ml-1">{errors.nome.message}</p>}
                </div>
                
                {/* Categoria e Marca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Categoria</Label>
                    <Input {...register("categoria")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: Peças, Acessórios..." />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Marca</Label>
                    <Input {...register("marca")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: Apple, Samsung..." />
                  </div>
                </div>
                
                {/* Modelo */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Modelos Compatíveis</Label>
                  <Input {...register("modelo_compativel")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: iPhone 11, iPhone XR..." />
                </div>
                
                {/* Preços */}
                <div className="grid grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/40">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Custo (R$)</Label>
                    <Input type="number" step="0.01" {...register("preco_custo")} className="h-11 rounded-xl bg-background border-border/60 focus-visible:ring-primary font-mono text-sm" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-1">Venda (R$)</Label>
                    <Input type="number" step="0.01" {...register("preco_venda")} className="h-11 rounded-xl bg-background border-primary/30 focus-visible:ring-primary font-mono font-bold text-primary shadow-sm" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Lojista (R$)</Label>
                    <Input type="number" step="0.01" {...register("preco_lojista")} className="h-11 rounded-xl bg-background border-border/60 focus-visible:ring-primary font-mono text-sm" />
                  </div>
                </div>
                
                {/* Estoque */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Quantidade em Estoque</Label>
                    <Input type="number" {...register("estoque")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm font-mono font-bold text-lg" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Alerta: Estoque Mínimo</Label>
                    <Input type="number" {...register("estoque_minimo")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm font-mono text-muted-foreground" />
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border/40 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending} className="rounded-xl bg-primary hover:bg-primary/90 font-bold px-8 shadow-md">
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {saveMutation.isPending ? "A guardar..." : "Salvar Produto"}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative w-full max-w-md group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar produto, categoria ou modelo..." 
          className="pl-12 h-14 text-base rounded-2xl bg-card/60 border-border/50 focus-visible:ring-primary backdrop-blur-md transition-all shadow-sm w-full font-medium" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* Tabela de Dados (Premium) */}
      <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background/80 hover:bg-background/80 border-b border-border/40">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black py-5 pl-6">Produto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Detalhes</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right">Custo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-primary font-black text-right">Venda</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right">Lojista</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-center">Estoque</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-bold text-muted-foreground">A carregar inventário...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center text-destructive font-bold bg-destructive/5">
                      Erro ao carregar o stock de produtos.
                    </TableCell>
                  </TableRow>
                ) : produtos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-10 w-10 opacity-20 mb-2" />
                        <span className="font-bold text-lg text-muted-foreground">Nenhum produto encontrado.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  produtos.map((p) => {
                    const baixoEstoque = p.estoque <= p.estoque_minimo;
                    
                    return (
                      <TableRow key={p.id} className={`hover:bg-background/80 transition-all duration-200 border-border/30 group ${isFetching ? 'opacity-60' : ''}`}>
                        <TableCell className="font-bold text-sm text-foreground/90 pl-6 py-4">{p.nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            {p.categoria && <span className="font-medium text-muted-foreground">{p.categoria}</span>}
                            {p.marca && <span className="text-muted-foreground/70">{p.marca}</span>}
                            {!p.categoria && !p.marca && <span className="text-muted-foreground/50">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium text-muted-foreground/80">R$ {Number(p.preco_custo).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-black text-primary">R$ {Number(p.preco_venda).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium text-muted-foreground/80">R$ {Number(p.preco_lojista).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          {baixoEstoque ? (
                            <span title="Estoque abaixo do mínimo recomendado" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 font-mono text-sm font-black animate-pulse">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {p.estoque}
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-bold text-foreground/80 bg-muted/50 px-3 py-1 rounded-md border border-border/40">
                              {p.estoque}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => window.confirm("Excluir este produto?") && deleteMutation.mutate(p.id)}
                              disabled={deleteMutation.isPending}
                              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}