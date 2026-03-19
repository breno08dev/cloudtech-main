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
import { Store, Phone, MapPin, ShieldCheck, Loader2, Save, Settings } from "lucide-react";

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
      // Tenta buscar a primeira linha da tabela de configurações
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
        // Já existe uma configuração, vamos atualizar
        const { error } = await supabase.from("configuracoes").update(dbPayload).eq("id", configData.id);
        if (error) throw error;
      } else {
        // Primeira vez configurando, vamos inserir
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
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Settings className="h-7 w-7 text-primary" />
            </div>
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground mt-2 ml-1">Personalize os dados da sua assistência e os termos padrão de impressão.</p>
        </div>
        <Button 
          size="lg" 
          className="rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
          disabled={saveMutation.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          {saveMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Configurações
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Bloco 1: Dados da Empresa */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" /> Dados da Assistência Técnica
            </CardTitle>
            <CardDescription>Essas informações aparecerão no cabeçalho das Ordens de Serviço.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="grid gap-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nome da Empresa / Loja *</Label>
              <Input 
                {...register("nome_empresa")} 
                className={`h-12 text-lg font-medium rounded-xl bg-muted/10 ${errors.nome_empresa ? "border-red-500 focus-visible:ring-red-500" : ""}`} 
                placeholder="Ex: Cloud Tech" 
              />
              {errors.nome_empresa && <span className="text-sm text-red-500">{errors.nome_empresa.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Telefones
                </Label>
                <Input 
                  {...register("telefone")} 
                  className="h-12 rounded-xl bg-muted/10" 
                  placeholder="Ex: (16) 98874-1282" 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço Completo
                </Label>
                <Input 
                  {...register("endereco")} 
                  className="h-12 rounded-xl bg-muted/10" 
                  placeholder="Ex: Avenida Cristo Redentor 573 - Posto Iguatemi" 
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Bloco 2: Padrões do Sistema */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Padrões de Termos e Garantia
            </CardTitle>
            <CardDescription>Defina os textos pré-preenchidos ao criar novas OS.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="grid gap-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Prazo de Garantia Padrão</Label>
              <Input 
                {...register("garantia_padrao")} 
                className="h-12 rounded-xl bg-muted/10 max-w-sm font-medium" 
                placeholder="Ex: 90 dias" 
              />
              <p className="text-xs text-muted-foreground">Este prazo será sugerido automaticamente ao abrir uma nova OS.</p>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mensagem Personalizada no Recibo (Opcional)</Label>
              <Textarea 
                {...register("mensagem_padrao_os")} 
                className="min-h-[100px] rounded-xl bg-muted/10" 
                placeholder="Ex: Aparelhos não retirados em 90 dias serão vendidos para custear o serviço..." 
              />
            </div>

          </CardContent>
        </Card>
      </form>
    </div>
  );
}