import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, Package, Barcode, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const variacaoSchema = z.object({
  id: z.string().optional(),
  qualidade: z.string().min(1, "A qualidade é obrigatória"),
  com_aro: z.boolean().default(false),
  preco_custo: z.coerce.number().min(0, "O valor não pode ser negativo"),
  preco_venda: z.coerce.number().min(0, "O valor não pode ser negativo"),
  preco_lojista: z.coerce.number().min(0, "O valor não pode ser negativo"),
  estoque: z.coerce.number().min(0, "O stock não pode ser negativo"),
  estoque_minimo: z.coerce.number().min(0, "O stock não pode ser negativo"),
});

const produtoSchema = z.object({
  nome: z.string().min(2, "O nome do produto é obrigatório"),
  categoria: z.string().optional(),
  marca: z.string().optional(),
  modelo_compativel: z.string().optional(),
  codigo_barras_base: z.string().optional(),
  variacoes: z.array(variacaoSchema).min(1, "Adicione pelo menos uma variação"),
});

type ProdutoFormValues = z.infer<typeof produtoSchema>;

const defaultValues: ProdutoFormValues = {
  nome: "", categoria: "", marca: "", modelo_compativel: "", codigo_barras_base: "",
  variacoes: [{ qualidade: "Padrão", com_aro: false, preco_custo: 0, preco_venda: 0, preco_lojista: 0, estoque: 0, estoque_minimo: 5 }],
};

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Estado para Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues,
  });

  const { fields: variacoesFields, append, remove } = useFieldArray({
    control,
    name: "variacoes",
  });

  const { data: produtos = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ["produtos", search],
    queryFn: async () => {
      let query = (supabase as any).from("produto_base").select("*, variacoes:produto_variacoes(*)");
      
      if (search) {
        query = query.or(`nome.ilike.%${search}%,categoria.ilike.%${search}%,marca.ilike.%${search}%,descricao.ilike.%${search}%,codigo_barras_base.ilike.%${search}%`);
      }

      const { data, error } = await query.order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProdutoFormValues) => {
      const basePayload = {
        nome: payload.nome,
        categoria: payload.categoria || null,
        marca: payload.marca || null,
        descricao: payload.modelo_compativel || null, 
        codigo_barras_base: payload.codigo_barras_base || null,
      };

      let baseId = editId;

      if (editId) {
        const { error } = await (supabase as any).from("produto_base").update(basePayload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("produto_base").insert(basePayload).select("id").single();
        if (error) throw error;
        baseId = data.id;
      }

      if (editId) {
        const { data: antigas } = await (supabase as any).from("produto_variacoes").select("id").eq("produto_id", editId);
        const idsMantidos = payload.variacoes.map(v => v.id).filter(Boolean);
        const idsParaApagar = (antigas || []).filter((a: any) => !idsMantidos.includes(a.id)).map((a: any) => a.id);
        
        if (idsParaApagar.length > 0) {
          await (supabase as any).from("produto_variacoes").delete().in("id", idsParaApagar);
        }
      }

      const variacoesParaAtualizar = payload.variacoes.filter(v => !!v.id).map(v => ({
        id: v.id, 
        produto_id: baseId,
        qualidade: v.qualidade,
        com_aro: v.com_aro,
        preco_custo: v.preco_custo,
        preco_venda: v.preco_venda,
        preco_lojista: v.preco_lojista,
        estoque: v.estoque,
        estoque_minimo: v.estoque_minimo,
      }));

      const variacoesParaInserir = payload.variacoes.filter(v => !v.id).map(v => ({
        produto_id: baseId,
        qualidade: v.qualidade,
        com_aro: v.com_aro,
        preco_custo: v.preco_custo,
        preco_venda: v.preco_venda,
        preco_lojista: v.preco_lojista,
        estoque: v.estoque,
        estoque_minimo: v.estoque_minimo,
      }));

      if (variacoesParaAtualizar.length > 0) {
        const { error: errUpdate } = await (supabase as any).from("produto_variacoes").upsert(variacoesParaAtualizar);
        if (errUpdate) throw errUpdate;
      }

      if (variacoesParaInserir.length > 0) {
        const { error: errInsert } = await (supabase as any).from("produto_variacoes").insert(variacoesParaInserir);
        if (errInsert) throw errInsert;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Produto atualizado" : "Produto cadastrado");
      setDialogOpen(false);
      reset(defaultValues);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics_v2"] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Ocorreu um erro ao guardar. Verifique se o código de barras já existe.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("produto_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: () => toast.error("Não é possível excluir um produto que já está vinculado."),
  });

  function onSubmit(data: ProdutoFormValues) {
    saveMutation.mutate(data);
  }

  function handleEdit(p: any) {
    reset({
      nome: p.nome,
      categoria: p.categoria || "",
      marca: p.marca || "",
      modelo_compativel: p.descricao || "",
      codigo_barras_base: p.codigo_barras_base || "", 
      variacoes: p.variacoes?.length > 0 ? p.variacoes.map((v: any) => ({
        id: v.id,
        qualidade: v.qualidade,
        com_aro: v.com_aro,
        preco_custo: v.preco_custo,
        preco_venda: v.preco_venda,
        preco_lojista: v.preco_lojista,
        estoque: v.estoque,
        estoque_minimo: v.estoque_minimo,
      })) : defaultValues.variacoes,
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

  // --- LÓGICA DE PAGINAÇÃO ---
  const totalItems = produtos.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedProdutos = produtos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      
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
          
          <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/40 shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-muted/30 p-6 pb-4 border-b border-border/40 shrink-0">
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                {editId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </div>
            
            <div className="overflow-y-auto p-6 bg-background flex-1">
              <form id="produto-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
                
                <div className="bg-card p-4 rounded-xl border border-border/50 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Dados Principais</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="grid gap-1.5 md:col-span-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome do Produto *</Label>
                      <Input {...register("nome")} className={`h-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary shadow-sm ${errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}`} placeholder="Ex: Tela iPhone 11" />
                      {errors.nome && <p className="text-xs text-red-500 font-bold ml-1">{errors.nome.message}</p>}
                    </div>
                    
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 flex items-center gap-1.5">
                        <Barcode className="h-3 w-3" /> Cód. Barras (Opcional)
                      </Label>
                      <Input {...register("codigo_barras_base")} className="h-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary shadow-sm font-mono text-sm" placeholder="Escaneie aqui..." />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Categoria</Label>
                      <Input {...register("categoria")} className="h-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: Peças, Acessórios..." />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Marca</Label>
                      <Input {...register("marca")} className="h-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: Apple, Samsung..." />
                    </div>
                  </div>
                  
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Modelos Compatíveis</Label>
                    <Input {...register("modelo_compativel")} className="h-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary shadow-sm" placeholder="Ex: iPhone 11, iPhone XR..." />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Variações e Estoque</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ qualidade: "", com_aro: false, preco_custo: 0, preco_venda: 0, preco_lojista: 0, estoque: 0, estoque_minimo: 5 })} className="rounded-lg h-9 border-primary/50 text-primary hover:bg-primary/10">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Variação
                    </Button>
                  </div>

                  {errors.variacoes?.root && (
                    <p className="text-xs text-red-500 font-bold">{errors.variacoes.root.message}</p>
                  )}

                  {variacoesFields.map((field, index) => (
                    <div key={field.id} className="bg-muted/20 p-4 rounded-xl border border-border/60 relative space-y-4">
                      {variacoesFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                        <div className="grid gap-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Qualidade (Ex: Incell, OLED)</Label>
                          <Input {...register(`variacoes.${index}.qualidade`)} className="h-10 rounded-lg bg-background border-border/60" />
                          {errors.variacoes?.[index]?.qualidade && <p className="text-[10px] text-red-500 font-bold">{errors.variacoes[index]?.qualidade?.message}</p>}
                        </div>
                        <div className="flex items-end pb-1.5">
                          <label className="flex items-center gap-2 cursor-pointer bg-background border border-border/60 px-4 h-10 rounded-lg">
                            <Checkbox onCheckedChange={(checked) => { const event = { target: { name: `variacoes.${index}.com_aro`, value: checked } }; register(`variacoes.${index}.com_aro`).onChange(event); }} />
                            <span className="text-xs font-bold uppercase">Com Aro?</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Custo (R$)</Label><Input type="number" step="0.01" {...register(`variacoes.${index}.preco_custo`)} className="h-10 rounded-lg bg-background border-border/60 font-mono" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-1">Venda (R$)</Label><Input type="number" step="0.01" {...register(`variacoes.${index}.preco_venda`)} className="h-10 rounded-lg bg-background border-primary/30 font-mono text-primary font-bold" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Lojista (R$)</Label><Input type="number" step="0.01" {...register(`variacoes.${index}.preco_lojista`)} className="h-10 rounded-lg bg-background border-border/60 font-mono" /></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Estoque</Label><Input type="number" {...register(`variacoes.${index}.estoque`)} className="h-10 rounded-lg bg-background border-border/60 font-mono font-bold text-base" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Estoque Mínimo</Label><Input type="number" {...register(`variacoes.${index}.estoque_minimo`)} className="h-10 rounded-lg bg-background border-border/60 font-mono text-muted-foreground" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                
              </form>
            </div>

            <div className="bg-background/80 p-4 border-t border-border/40 shrink-0 flex justify-end gap-3 z-10">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
              <Button form="produto-form" type="submit" disabled={saveMutation.isPending} className="rounded-xl bg-primary hover:bg-primary/90 font-bold px-8 shadow-md">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {saveMutation.isPending ? "A guardar..." : "Salvar Produto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full max-w-md group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar produto, categoria ou código de barras..." 
          className="pl-12 h-14 text-base rounded-2xl bg-card/60 border-border/50 focus-visible:ring-primary backdrop-blur-md transition-all shadow-sm w-full font-medium" 
          value={search} 
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1); // Volta para a página 1 ao pesquisar
          }} 
        />
      </div>

      <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background/80 hover:bg-background/80 border-b border-border/40">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black py-5 pl-6">Produto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Detalhes / Variações</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-primary font-black text-right">Preço de Venda</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-center">Estoque Total</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-64 text-center"><div className="flex flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-sm font-bold text-muted-foreground">A carregar inventário...</span></div></TableCell></TableRow>
                ) : isError ? (
                  <TableRow><TableCell colSpan={5} className="h-64 text-center text-destructive font-bold bg-destructive/5">Erro ao carregar o stock de produtos.</TableCell></TableRow>
                ) : paginatedProdutos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-16"><div className="flex flex-col items-center gap-2"><Package className="h-10 w-10 opacity-20 mb-2" /><span className="font-bold text-lg text-muted-foreground">Nenhum produto encontrado.</span></div></TableCell></TableRow>
                ) : (
                  paginatedProdutos.map((p) => {
                    const estoqueTotal = (p.variacoes || []).reduce((acc: number, v: any) => acc + v.estoque, 0);
                    const baixoEstoque = (p.variacoes || []).some((v: any) => v.estoque <= v.estoque_minimo);
                    
                    const precosVenda = (p.variacoes || []).map((v: any) => v.preco_venda);
                    const precoMin = precosVenda.length > 0 ? Math.min(...precosVenda) : 0;
                    const precoMax = precosVenda.length > 0 ? Math.max(...precosVenda) : 0;
                    
                    return (
                      <TableRow key={p.id} className={`hover:bg-background/80 transition-all duration-200 border-border/30 group ${isFetching ? 'opacity-60' : ''}`}>
                        <TableCell className="font-bold text-sm text-foreground/90 pl-6 py-4">
                          {p.nome}
                          {p.codigo_barras_base && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 mt-1">
                              <Barcode className="h-3 w-3" /> {p.codigo_barras_base}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs gap-1">
                            <span className="font-medium text-muted-foreground">
                              {p.categoria || "Sem Categoria"} {p.marca ? `• ${p.marca}` : ""}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(p.variacoes || []).map((v: any) => (
                                <span key={v.id} className="text-[9px] uppercase bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded">
                                  {v.qualidade} {v.com_aro && "(Aro)"} - {v.estoque} un
                                </span>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-black text-primary">
                          {precoMin === precoMax ? `R$ ${precoMin.toFixed(2)}` : `R$ ${precoMin.toFixed(2)} - ${precoMax.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-center">
                          {baixoEstoque ? (
                            <span title="Uma ou mais variações com estoque baixo" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 font-mono text-sm font-black animate-pulse">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {estoqueTotal}
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-bold text-foreground/80 bg-muted/50 px-3 py-1 rounded-md border border-border/40">
                              {estoqueTotal}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => window.confirm("Atenção: Excluir este produto apagará todas as variações ligadas a ele. Continuar?") && deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending} className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive">
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

          {/* --- BARRA DE PAGINAÇÃO --- */}
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-sm shrink-0">
              <span className="text-muted-foreground font-medium hidden sm:inline-block ml-2">
                Mostrando <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-bold text-foreground">{totalItems}</span> produtos
              </span>
              <div className="flex items-center gap-2 ml-auto sm:ml-0 mr-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 rounded-xl font-bold bg-background">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-xs font-bold px-3 text-muted-foreground">Pág. {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-9 rounded-xl font-bold bg-background">
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}