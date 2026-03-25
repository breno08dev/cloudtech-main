import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Store, Phone, MapPin, ShieldCheck, Loader2, Save, Settings, Building2 } from "lucide-react";

// 1. Schema de Validação
const configSchema = z.object({
  nome_empresa: z.string().min(2, "O nome da empresa é obrigatório"),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  garantia_padrao: z.string().optional(),
  mensagem_padrao_os: z.string().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();

  // 2. Setup do Formulário
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      nome_empresa: "",
      telefone: "",
      endereco: "",
      garantia_padrao: "90 dias",
      mensagem_padrao_os: "",
    },
  });

  // 3. Fetch das Configurações Atuais
  const { data: configData, isLoading } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 4. Preencher o formulário quando os dados chegam do banco
  useEffect(() => {
    if (configData) {
      reset({
        nome_empresa: configData.nome_empresa,
        telefone: configData.telefone || "",
        endereco: configData.endereco || "",
        garantia_padrao: configData.garantia_padrao || "90 dias",
        mensagem_padrao_os: configData.mensagem_padrao_os || "",
      });
    }
  }, [configData, reset]);

  // 5. Mutation para Salvar (Insert ou Update)
  const saveMutation = useMutation({
    mutationFn: async (values: ConfigFormValues) => {
      const dbPayload = {
        nome_empresa: values.nome_empresa,
        telefone: values.telefone || null,
        endereco: values.endereco || null,
        garantia_padrao: values.garantia_padrao || null,
        mensagem_padrao_os: values.mensagem_padrao_os || null,
      };

      if (configData?.id) {
        const { error } = await supabase.from("configuracoes").update(dbPayload).eq("id", configData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configuracoes").insert([dbPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações atualizadas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
    },
    onError: () => {
      toast.error("Ocorreu um erro ao salvar as configurações.");
    },
  });

  const onSubmit = (data: ConfigFormValues) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">A carregar preferências...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* Header Premium da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border/40 p-6 rounded-[2rem] backdrop-blur-xl shadow-sm shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            Configurações
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Personalize os dados da sua assistência e os termos padrão de impressão.</p>
        </div>
        <Button 
          className="rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:-translate-y-0.5 transition-all font-bold h-12 px-6 text-base"
          disabled={saveMutation.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          {saveMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Configurações
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Bloco 1: Dados da Empresa */}
        <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden">
          <CardHeader className="bg-background/80 border-b border-border/40 p-6">
            <CardTitle className="text-xl font-black flex items-center gap-2 text-foreground/90 uppercase tracking-widest">
              <Building2 className="h-5 w-5 text-primary" /> Dados da Assistência
            </CardTitle>
            <CardDescription className="font-medium">Essas informações aparecerão no cabeçalho das suas Ordens de Serviço.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6 bg-background/30">
            
            <div className="grid gap-2">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome da Empresa / Loja *</Label>
              <Input 
                {...register("nome_empresa")} 
                className={`h-14 text-lg font-bold rounded-2xl bg-card/80 border-border/60 shadow-sm focus-visible:ring-primary transition-all ${errors.nome_empresa ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                placeholder="Ex: Cloud Tech" 
              />
              {errors.nome_empresa && <span className="text-xs font-bold text-red-500 ml-1">{errors.nome_empresa.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                  <Phone className="h-3.5 w-3.5" /> Telefones
                </Label>
                <Input 
                  {...register("telefone")} 
                  className="h-12 rounded-xl bg-card/80 border-border/60 shadow-sm focus-visible:ring-primary transition-all font-medium text-base" 
                  placeholder="Ex: (16) 98874-1282" 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1">
                  <MapPin className="h-3.5 w-3.5" /> Endereço Completo
                </Label>
                <Input 
                  {...register("endereco")} 
                  className="h-12 rounded-xl bg-card/80 border-border/60 shadow-sm focus-visible:ring-primary transition-all font-medium text-base" 
                  placeholder="Ex: Avenida Cristo Redentor 573" 
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Bloco 2: Padrões do Sistema */}
        <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden">
          <CardHeader className="bg-background/80 border-b border-border/40 p-6">
            <CardTitle className="text-xl font-black flex items-center gap-2 text-foreground/90 uppercase tracking-widest">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Padrões de Termos e Garantia
            </CardTitle>
            <CardDescription className="font-medium">Defina os textos pré-preenchidos ao criar novas OS.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8 bg-background/30">
            
            <div className="grid gap-2 max-w-md">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Prazo de Garantia Padrão</Label>
              <Input 
                {...register("garantia_padrao")} 
                className="h-12 rounded-xl bg-card/80 border-border/60 shadow-sm focus-visible:ring-primary transition-all font-bold text-base" 
                placeholder="Ex: 90 dias" 
              />
              <p className="text-[11px] font-semibold text-muted-foreground/70 ml-1">Este prazo será sugerido automaticamente ao abrir uma nova OS.</p>
            </div>

            <Separator className="opacity-50" />

            <div className="grid gap-2">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mensagem Personalizada no Recibo (Opcional)</Label>
              <Textarea 
                {...register("mensagem_padrao_os")} 
                className="min-h-[120px] rounded-2xl bg-card/80 border-border/60 shadow-sm focus-visible:ring-primary transition-all font-medium text-base resize-none" 
                placeholder="Ex: Aparelhos não retirados em 90 dias serão vendidos para custear o serviço..." 
              />
              <p className="text-[11px] font-semibold text-muted-foreground/70 ml-1">Mensagem impressa no rodapé da folha da Ordem de Serviço.</p>
            </div>

          </CardContent>
        </Card>
      </form>
    </div>
  );
}