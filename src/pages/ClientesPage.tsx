import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, Loader2, Users, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  cpf_cnpj: string | null;
  tipo_cliente: string;
  observacoes: string | null;
  created_at: string;
}

const clienteSchema = z.object({
  nome: z.string().min(2, "O nome do cliente é obrigatório"),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  tipo_cliente: z.enum(["cliente", "lojista"]).default("cliente"),
  observacoes: z.string().optional(),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

const defaultValues: ClienteFormValues = { 
  nome: "", 
  telefone: "", 
  whatsapp: "", 
  cpf_cnpj: "", 
  tipo_cliente: "cliente", 
  observacoes: "" 
};

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  });

  const { data: clientes = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ["clientes", search],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*").order("created_at", { ascending: false });
      
      if (search) {
        query = query.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%,cpf_cnpj.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ClienteFormValues) => {
      const dbPayload = {
        nome: payload.nome,
        telefone: payload.telefone || null,
        whatsapp: payload.whatsapp || null,
        cpf_cnpj: payload.cpf_cnpj || null,
        tipo_cliente: payload.tipo_cliente,
        observacoes: payload.observacoes || null,
      };

      if (editId) {
        const { error } = await supabase.from("clientes").update(dbPayload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(dbPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Cliente atualizado" : "Cliente cadastrado");
      setDialogOpen(false);
      reset(defaultValues);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes_select"] }); 
    },
    onError: () => toast.error("Ocorreu um erro ao guardar o cliente."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes_select"] });
    },
    onError: () => toast.error("Não é possível excluir um cliente com Ordens de Serviço vinculadas."),
  });

  function onSubmit(data: ClienteFormValues) {
    saveMutation.mutate(data);
  }

  function handleEdit(c: Cliente) {
    reset({ 
      nome: c.nome, 
      telefone: c.telefone || "", 
      whatsapp: c.whatsapp || "", 
      cpf_cnpj: c.cpf_cnpj || "", 
      tipo_cliente: (c.tipo_cliente as "cliente" | "lojista") || "cliente", 
      observacoes: c.observacoes || "" 
    });
    setEditId(c.id);
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
              <Users className="h-6 w-6 text-primary" />
            </div>
            Gestão de Clientes
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Administre a sua base de clientes finais e lojistas.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:-translate-y-0.5 transition-all font-bold h-12 px-6 text-base">
              <Plus className="mr-2 h-5 w-5" /> Novo Cliente
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/40 shadow-2xl p-0 overflow-hidden">
            <div className="bg-muted/30 p-6 pb-4 border-b border-border/40">
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <UserCircle className="h-6 w-6 text-primary" />
                {editId ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 p-6 pt-4 bg-background">
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome Completo / Empresa *</Label>
                <Input {...register("nome")} className={`h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm ${errors.nome ? "border-red-500 focus-visible:ring-red-500" : ""}`} />
                {errors.nome && <p className="text-xs text-red-500 font-bold ml-1">{errors.nome.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Telefone</Label>
                  <Input {...register("telefone")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" placeholder="(00) 0000-0000" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">WhatsApp</Label>
                  <Input {...register("whatsapp")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" placeholder="(00) 90000-0000" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">CPF / CNPJ</Label>
                  <Input {...register("cpf_cnpj")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm font-mono" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Categoria de Cliente</Label>
                  <Controller
                    control={control}
                    name="tipo_cliente"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-12 rounded-xl bg-card border-border/60 focus:ring-primary shadow-sm font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/50 shadow-xl">
                          <SelectItem value="cliente" className="py-3 font-medium cursor-pointer">Cliente Final</SelectItem>
                          <SelectItem value="lojista" className="py-3 font-bold text-primary cursor-pointer">Lojista (Preço Especial)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Observações / Endereço</Label>
                <Textarea {...register("observacoes")} className="min-h-[80px] resize-none rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm" />
              </div>
              
              <div className="pt-2 border-t border-border/40 mt-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="rounded-xl bg-primary hover:bg-primary/90 font-bold px-8 shadow-md">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {saveMutation.isPending ? "A guardar..." : "Salvar Registo"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative w-full max-w-md group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar por nome, telefone ou CPF..." 
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
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black py-5 pl-6">Nome do Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Contato</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">CPF / CNPJ</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-bold text-muted-foreground">A carregar clientes...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center text-destructive font-bold bg-destructive/5">
                      Erro ao carregar os clientes.
                    </TableCell>
                  </TableRow>
                ) : clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-10 w-10 opacity-20 mb-2" />
                        <span className="font-bold text-lg text-muted-foreground">Nenhum cliente encontrado.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((c) => (
                    <TableRow key={c.id} className={`hover:bg-background/80 transition-all duration-200 border-border/30 group ${isFetching ? 'opacity-60' : ''}`}>
                      <TableCell className="font-bold text-sm text-foreground/90 pl-6 py-4">{c.nome}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground font-medium">
                        {c.telefone || c.whatsapp || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground font-medium">{c.cpf_cnpj || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                          c.tipo_cliente === "lojista" 
                          ? "bg-primary/10 text-primary border-primary/20" 
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                        }`}>
                          {c.tipo_cliente === "lojista" ? "Lojista" : "Cliente"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => window.confirm("Tem certeza que deseja excluir este cliente?") && deleteMutation.mutate(c.id)}
                            disabled={deleteMutation.isPending}
                            className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}