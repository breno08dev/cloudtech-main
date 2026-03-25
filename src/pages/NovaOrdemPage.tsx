import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Loader2, UserCircle, Smartphone, ClipboardCheck, Wrench, Save, X, DollarSign, CalendarDays, ChevronsUpDown, Check, Search
} from "lucide-react";

const ordemSchema = z.object({
  cliente_id: z.string().min(1, "Selecione um cliente obrigatório"),
  marca_aparelho: z.string().min(2, "A marca é obrigatória"),
  modelo_aparelho: z.string().min(2, "O modelo é obrigatório"),
  imei: z.string().optional(),
  senha_aparelho: z.string().optional(),
  problema_relatado: z.string().min(5, "Descreva o problema (mín. 5 caracteres)"),
  diagnostico: z.string().optional(),
  valor_servico: z.coerce.number().min(0, "O valor não pode ser negativo"),
  observacoes: z.string().optional(),
  data_previsao: z.string().optional(),
  checklist_tela_quebrada: z.boolean().default(false),
  checklist_nao_liga: z.boolean().default(false),
  checklist_molhado: z.boolean().default(false),
  checklist_bateria_ruim: z.boolean().default(false),
  checklist_camera_quebrada: z.boolean().default(false),
  checklist_outros: z.string().optional(),
});

type OrdemFormValues = z.infer<typeof ordemSchema>;

export default function NovaOrdemPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [openCliente, setOpenCliente] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { register, handleSubmit, control, formState: { errors } } = useForm<OrdemFormValues>({
    resolver: zodResolver(ordemSchema),
    defaultValues: {
      valor_servico: 0,
      checklist_tela_quebrada: false,
      checklist_nao_liga: false,
      checklist_molhado: false,
      checklist_bateria_ruim: false,
      checklist_camera_quebrada: false,
    },
  });

  async function onSubmit(data: OrdemFormValues) {
    setSaving(true);
    const payload = {
      ...data,
      data_previsao: data.data_previsao || null,
      numero_os: "", 
      valor_total: data.valor_servico,
    };

    const { data: result, error } = await supabase.from("ordens_servico").insert(payload).select("id").single();
    
    if (error) { 
      toast.error("Erro ao criar OS. Tente novamente."); 
      setSaving(false);
      return; 
    }

    if (data.valor_servico > 0) {
      await supabase.from("ordem_servico_servicos").insert({
        ordem_servico_id: result.id,
        descricao: "Serviço Inicial / Orçamento Base",
        valor: data.valor_servico
      });
    }
    
    setSaving(false);
    toast.success("Ordem de Serviço criada com sucesso!");
    navigate(`/ordens/${result.id}`);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            Nova Ordem de Serviço
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Preencha os dados abaixo para iniciar um novo atendimento técnico.</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* BLOCO: CLIENTE COM BUSCA INTELIGENTE */}
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-card/50 pb-4 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground tracking-wide">
              <UserCircle className="h-5 w-5 text-primary" /> Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2 flex flex-col">
              <Label className="text-foreground/90 font-medium ml-1">Buscar Cliente (Nome ou CPF/CNPJ) *</Label>
              <Controller
                control={control}
                name="cliente_id"
                render={({ field }) => (
                  <Popover open={openCliente} onOpenChange={setOpenCliente}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        role="combobox" 
                        aria-expanded={openCliente} 
                        className={`w-full justify-between h-12 rounded-xl bg-card/50 border-border/50 hover:bg-muted/50 transition-colors font-medium text-left ${errors.cliente_id ? "border-red-500 ring-1 ring-red-500/20" : ""} ${!field.value ? "text-muted-foreground" : "text-foreground/90"}`}
                      >
                        {field.value ? clientes.find((c) => c.id === field.value)?.nome : (loadingClientes ? "A carregar clientes..." : "Clique para buscar o cliente...")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/50 shadow-xl" align="start">
                      <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <CommandInput 
                            placeholder="Digite o nome ou CPF..." 
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0" 
                            value={searchCliente}
                            onValueChange={setSearchCliente}
                          />
                        </div>
                        <CommandList className="max-h-[250px]">
                          {searchCliente.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                              Digite algo para mostrar os resultados...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="p-4 text-center text-sm font-medium text-muted-foreground">Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {clientes
                                  .filter(c => {
                                    const termo = searchCliente.toLowerCase();
                                    const nome = (c.nome || "").toLowerCase();
                                    const cpfCnpj = (c.cpf_cnpj || "").toLowerCase();
                                    return nome.includes(termo) || cpfCnpj.includes(termo);
                                  })
                                  .map((c) => (
                                    <CommandItem 
                                      key={c.id} 
                                      value={c.id} 
                                      onSelect={() => { 
                                        field.onChange(c.id); 
                                        setOpenCliente(false); 
                                        setSearchCliente(""); 
                                      }} 
                                      className="py-3 cursor-pointer font-medium"
                                    >
                                      <Check className={cn("mr-3 h-4 w-4 text-primary", field.value === c.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col">
                                        <span>{c.nome}</span>
                                        {c.cpf_cnpj && (
                                          <span className="text-[10px] text-muted-foreground font-mono mt-0.5">CPF/CNPJ: {c.cpf_cnpj}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.cliente_id && <p className="text-sm text-red-500 font-medium ml-1">{errors.cliente_id.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* BLOCO: DADOS DO APARELHO */}
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-card/50 pb-4 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground tracking-wide">
              <Smartphone className="h-5 w-5 text-indigo-500" /> Detalhes do Aparelho
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-foreground/90 font-medium ml-1">Marca *</Label>
                <Input placeholder="Ex: Apple, Samsung, Motorola" {...register("marca_aparelho")} className={`h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all ${errors.marca_aparelho ? "border-red-500" : ""}`} />
                {errors.marca_aparelho && <p className="text-sm text-red-500 font-medium ml-1">{errors.marca_aparelho.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/90 font-medium ml-1">Modelo *</Label>
                <Input placeholder="Ex: iPhone 13 Pro, Galaxy S22" {...register("modelo_aparelho")} className={`h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all ${errors.modelo_aparelho ? "border-red-500" : ""}`} />
                {errors.modelo_aparelho && <p className="text-sm text-red-500 font-medium ml-1">{errors.modelo_aparelho.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-foreground/90 font-medium ml-1">IMEI ou Nº de Série</Label>
                <Input placeholder="Opcional" {...register("imei")} className="h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/90 font-medium ml-1">Senha do Aparelho</Label>
                <Input placeholder="Padrão, PIN ou descreva" {...register("senha_aparelho")} className="h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BLOCO: CHECKLIST */}
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-card/50 pb-4 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground tracking-wide">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" /> Checklist de Entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                { id: "checklist_tela_quebrada" as const, label: "Ecrã / Tela quebrada" },
                { id: "checklist_nao_liga" as const, label: "Aparelho não liga" },
                { id: "checklist_molhado" as const, label: "Molhado / Líquido" },
                { id: "checklist_bateria_ruim" as const, label: "Bateria degradada" },
                { id: "checklist_camera_quebrada" as const, label: "Câmera danificada" },
              ].map((item) => (
                <Controller
                  key={item.id}
                  control={control}
                  name={item.id}
                  render={({ field }) => (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/30 hover:bg-muted/30 transition-colors">
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} id={item.id} className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      <Label htmlFor={item.id} className="cursor-pointer font-medium text-sm text-foreground/80 select-none w-full">{item.label}</Label>
                    </div>
                  )}
                />
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/90 font-medium ml-1">Outros Problemas Visíveis</Label>
              <Input {...register("checklist_outros")} placeholder="Descreva arranhões, botões em falta, etc..." className="h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all" />
            </div>
          </CardContent>
        </Card>

        {/* BLOCO: PROBLEMA E DIAGNÓSTICO */}
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-card/50 pb-4 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground tracking-wide">
              <Wrench className="h-5 w-5 text-amber-500" /> Relato e Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-2">
              <Label className="text-foreground/90 font-medium ml-1">Problema Relatado pelo Cliente *</Label>
              <Textarea placeholder="O que o cliente disse que está a acontecer com o aparelho?" {...register("problema_relatado")} className={`min-h-[100px] resize-none rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all ${errors.problema_relatado ? "border-red-500" : ""}`} />
              {errors.problema_relatado && <p className="text-sm text-red-500 font-medium ml-1">{errors.problema_relatado.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/90 font-medium ml-1">Diagnóstico Técnico (Opcional)</Label>
              <Textarea placeholder="Sua avaliação inicial (pode ser preenchido depois)" {...register("diagnostico")} className="min-h-[100px] resize-none rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-card/40 rounded-2xl border border-border/40">
              <div className="space-y-2">
                <Label className="text-foreground/90 font-bold ml-1 flex items-center gap-1.5 text-primary">
                  <DollarSign className="h-4 w-4" /> Valor do Serviço (R$)
                </Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register("valor_servico")} className="h-11 rounded-xl bg-background border-border/60 focus-visible:ring-primary font-mono text-lg font-semibold transition-all" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/90 font-medium ml-1 flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" /> Previsão de Entrega
                </Label>
                <Input type="date" {...register("data_previsao")} className="h-11 rounded-xl bg-background border-border/60 focus-visible:ring-primary transition-all text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/90 font-medium ml-1">Observações Internas</Label>
              <Textarea placeholder="Anotações visíveis apenas para a equipa técnica..." {...register("observacoes")} className="min-h-[80px] resize-none rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary transition-all" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate("/ordens")} disabled={saving} className="h-12 px-6 rounded-xl border-border/60 font-medium hover:bg-muted/80 transition-colors w-full sm:w-auto">
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button type="submit" disabled={saving || loadingClientes} className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all w-full sm:w-auto sm:ml-auto">
            {saving ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Registando OS...</>) : (<><Save className="mr-2 h-5 w-5" /> Criar Ordem de Serviço</>)}
          </Button>
        </div>
      </form>
    </div>
  );
}