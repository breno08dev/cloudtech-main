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
import { Plus, Search, Pencil, Trash2, AlertTriangle, Loader2 } from "lucide-react";
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

// 1. Definição do Schema de Validação
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

  // 2. React Hook Form
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues,
  });

  // 3. Pesquisa e Listagem com React Query (Filtragem no Servidor)
  const { data: produtos = [], isLoading, isError } = useQuery({
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

  // 4. Mutations de Escrita
  const saveMutation = useMutation({
    mutationFn: async (payload: ProdutoFormValues) => {
      // Mapeamos explicitamente para satisfazer o TypeScript do Supabase
      // e garantimos que valores opcionais vazios vão como nulos (null)
      const dbPayload = {
        nome: payload.nome, // Garantimos que o nome é uma string válida
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

  // Ações de Interface
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos / Estoque</h1>
        
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input {...register("nome")} className={errors.nome ? "border-red-500" : ""} />
                {errors.nome && <p className="text-sm text-red-500">{errors.nome.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input {...register("categoria")} />
                </div>
                <div className="grid gap-2">
                  <Label>Marca</Label>
                  <Input {...register("marca")} />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Modelo Compatível</Label>
                <Input {...register("modelo_compativel")} />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Preço Custo</Label>
                  <Input type="number" step="0.01" {...register("preco_custo")} />
                </div>
                <div className="grid gap-2">
                  <Label>Preço Venda</Label>
                  <Input type="number" step="0.01" {...register("preco_venda")} />
                </div>
                <div className="grid gap-2">
                  <Label>Preço Lojista</Label>
                  <Input type="number" step="0.01" {...register("preco_lojista")} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Estoque</Label>
                  <Input type="number" {...register("estoque")} />
                </div>
                <div className="grid gap-2">
                  <Label>Estoque Mínimo</Label>
                  <Input type="number" {...register("estoque_minimo")} />
                </div>
              </div>
              
              <Button type="submit" disabled={saveMutation.isPending} className="mt-2">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {saveMutation.isPending ? "A guardar..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar produto, marca ou modelo..." 
          className="pl-9" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
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
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-red-500">
                    Erro ao carregar o stock de produtos.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && produtos.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
              )}
              
              {!isLoading && !isError && produtos.map((p) => (
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => window.confirm("Excluir este produto?") && deleteMutation.mutate(p.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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