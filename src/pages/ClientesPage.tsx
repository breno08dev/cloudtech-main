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
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
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

// 1. Definição do Schema de Validação
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

  // 2. React Hook Form
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  });

  // 3. Pesquisa e Listagem (Server-side Filtering)
  const { data: clientes = [], isLoading, isError } = useQuery({
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

  // 4. Mutations de Escrita
  const saveMutation = useMutation({
    mutationFn: async (payload: ClienteFormValues) => {
      // Mapeamento explícito para satisfazer o Supabase e limpar campos vazios
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
      // Invalida a cache para recarregar a lista automaticamente
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      // Invalida também a lista de clientes que aparece no ecrã de "Nova Ordem"
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

  // Ações de Interface
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input {...register("nome")} className={errors.nome ? "border-red-500" : ""} />
                {errors.nome && <p className="text-sm text-red-500">{errors.nome.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input {...register("telefone")} />
                </div>
                <div className="grid gap-2">
                  <Label>WhatsApp</Label>
                  <Input {...register("whatsapp")} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CPF / CNPJ</Label>
                  <Input {...register("cpf_cnpj")} />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  {/* Para usar o Select do Shadcn com o React Hook Form, precisamos do Controller */}
                  <Controller
                    control={control}
                    name="tipo_cliente"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cliente">Cliente Final</SelectItem>
                          <SelectItem value="lojista">Lojista</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea {...register("observacoes")} />
              </div>
              
              <Button type="submit" disabled={saveMutation.isPending} className="mt-2">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {saveMutation.isPending ? "A guardar..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome, telefone ou CPF..." 
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
                <TableHead>Telefone</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-red-500">
                    Erro ao carregar os clientes.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && clientes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
              )}
              
              {!isLoading && !isError && clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="font-mono text-sm">{c.telefone || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{c.cpf_cnpj || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${c.tipo_cliente === "lojista" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.tipo_cliente === "lojista" ? "Lojista" : "Cliente"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => window.confirm("Excluir este cliente?") && deleteMutation.mutate(c.id)}
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