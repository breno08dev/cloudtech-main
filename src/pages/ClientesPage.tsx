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
import { Plus, Search, Pencil, Trash2, Loader2, Users, UserCircle, ChevronLeft, ChevronRight, AlertCircle, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  cpf_cnpj: string | null;
  tipo_cliente: string;
  observacoes: string | null;
  data_aniversario: string | null; // NOVO CAMPO
  created_at: string;
}

const clienteSchema = z.object({
  nome: z.string().min(2, "O nome do cliente é obrigatório"),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  tipo_cliente: z.enum(["cliente", "lojista"]).default("cliente"),
  observacoes: z.string().optional(),
  data_aniversario: z.string().optional(), // NOVO CAMPO
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

const defaultValues: ClienteFormValues = { 
  nome: "", 
  telefone: "", 
  whatsapp: "", 
  cpf_cnpj: "", 
  tipo_cliente: "cliente", 
  observacoes: "",
  data_aniversario: ""
};

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Estado para Modal de Exclusão Profissional
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Estado para Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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
        data_aniversario: payload.data_aniversario || null, // NOVO CAMPO NO PAYLOAD
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
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes_select"] });
    },
    onError: () => {
      toast.error("Não é possível excluir um cliente com Ordens de Serviço vinculadas.");
      setItemToDelete(null);
    },
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
      observacoes: c.observacoes || "",
      data_aniversario: c.data_aniversario || ""
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

  // --- LÓGICA DE ANIVERSARIANTES DO DIA ---
  const hoje = new Date();
  const mesHoje = (hoje.getMonth() + 1).toString().padStart(2, '0');
  const diaHoje = hoje.getDate().toString().padStart(2, '0');

  const aniversariantesDoDia = clientes.filter(c => {
    if (!c.data_aniversario) return false;
    // O formato no banco é YYYY-MM-DD
    const partes = c.data_aniversario.split('-');
    if (partes.length === 3) {
      return partes[1] === mesHoje && partes[2] === diaHoje;
    }
    return false;
  });

  const enviarMensagemAniversario = (nome: string, numeroUrl: string | null) => {
    if (!numeroUrl) {
      toast.error("Cliente não possui número de WhatsApp cadastrado.");
      return;
    }
    
    // Limpa a formatação do número para a URL do WhatsApp
    const numeroLimpo = numeroUrl.replace(/\D/g, '');
    
    const mensagem = `Olá, ${nome}!  Hoje é um dia muito especial!\n\nNós da Cloud Tech desejamos tudo de melhor na sua vida, muita alegria e sucesso. Que você possa aproveitar muito o seu dia!\n\nComo forma de agradecimento pela parceria, você ganhou um chaveiro personalizado da nossa loja. \n\nÉ só dar uma passadinha aqui na loja (Avenida Cristo Redentor 573 - Posto Iguatemi) e retirar o seu. Um grande abraço de toda a equipe!`;
    
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // --- LÓGICA DE PAGINAÇÃO ---
  const totalItems = clientes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedClientes = clientes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
      
      {/* Modal Excluir Cliente */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6 text-center border-red-500/20 shadow-2xl">
          <div className="mx-auto bg-red-500/10 p-4 rounded-full w-fit mb-3"><AlertCircle className="h-8 w-8 text-red-500" /></div>
          <DialogTitle className="text-2xl font-black mb-2 text-foreground">Excluir Cliente</DialogTitle>
          <p className="text-sm text-muted-foreground font-medium mb-6 px-2">Tem certeza que deseja excluir permanentemente este cliente do sistema? Esta ação não poderá ser desfeita.</p>
          
          <Button 
            onClick={() => { if(itemToDelete) deleteMutation.mutate(itemToDelete); }} 
            disabled={deleteMutation.isPending} 
            variant="destructive" 
            className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
          >
            {deleteMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
            Sim, Excluir Cliente
          </Button>
          <Button variant="ghost" onClick={() => setItemToDelete(null)} className="w-full mt-2 font-bold rounded-xl h-11 hover:bg-muted/80">Cancelar</Button>
        </DialogContent>
      </Dialog>

      {/* ALERTAS DE ANIVERSARIANTES DO DIA */}
      {aniversariantesDoDia.length > 0 && (
        <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-top-4">
          {aniversariantesDoDia.map(c => (
            <Card key={`aniv-${c.id}`} className="rounded-[2rem] border-pink-500/30 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent shadow-sm">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-pink-500/20 p-3 rounded-full">
                    <Gift className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">Hoje é o aniversário de {c.nome}! 🎉</h3>
                    <p className="text-sm font-medium text-muted-foreground">Não esqueça de enviar a mensagem de parabéns e o presente da loja.</p>
                  </div>
                </div>
                <Button 
                  onClick={() => enviarMensagemAniversario(c.nome, c.whatsapp || c.telefone)}
                  className="rounded-xl h-11 font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 shrink-0 w-full sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar Parabéns
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
          
          <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/40 shadow-2xl p-0 overflow-hidden">
            <div className="bg-muted/30 p-6 pb-4 border-b border-border/40">
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <UserCircle className="h-6 w-6 text-primary" />
                {editId ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 p-6 pt-4 bg-background max-h-[80vh] overflow-y-auto">
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
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">CPF / CNPJ</Label>
                  <Input {...register("cpf_cnpj")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm font-mono" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nascimento</Label>
                  <Input type="date" {...register("data_aniversario")} className="h-12 rounded-xl bg-card border-border/60 focus-visible:ring-primary shadow-sm font-medium" />
                </div>
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
          placeholder="Buscar por nome, telefone ou CPF/CNPJ..." 
          className="pl-12 h-14 text-base rounded-2xl bg-card/60 border-border/50 focus-visible:ring-primary backdrop-blur-md transition-all shadow-sm w-full font-medium" 
          value={search} 
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }} 
        />
      </div>

      {/* Tabela de Dados (Premium) com Paginação */}
      <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background/80 hover:bg-background/80 border-b border-border/40">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black py-5 pl-6">Nome do Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Contato</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">CPF / CNPJ</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Nascimento</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-bold text-muted-foreground">A carregar clientes...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center text-destructive font-bold bg-destructive/5">
                      Erro ao carregar os clientes.
                    </TableCell>
                  </TableRow>
                ) : paginatedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-10 w-10 opacity-20 mb-2" />
                        <span className="font-bold text-lg text-muted-foreground">Nenhum cliente encontrado.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClientes.map((c) => (
                    <TableRow key={c.id} className={`hover:bg-background/80 transition-all duration-200 border-border/30 group ${isFetching ? 'opacity-60' : ''}`}>
                      <TableCell className="font-bold text-sm text-foreground/90 pl-6 py-4">{c.nome}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground font-medium">
                        {c.telefone || c.whatsapp || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground font-medium">{c.cpf_cnpj || "—"}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground font-medium">
                        {c.data_aniversario ? new Date(`${c.data_aniversario}T00:00:00`).toLocaleDateString('pt-BR') : "—"}
                      </TableCell>
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
                            onClick={() => setItemToDelete(c.id)}
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

          {/* --- BARRA DE PAGINAÇÃO --- */}
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-sm shrink-0">
              <span className="text-muted-foreground font-medium hidden sm:inline-block ml-2">
                Mostrando <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-bold text-foreground">{totalItems}</span> clientes
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