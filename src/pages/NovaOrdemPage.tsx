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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

// 1. Definimos o "Schema" de validação com o Zod
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

  // 2. Trazemos a lista de clientes usando React Query (com cache e loading automático)
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Inicializamos o React Hook Form
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
      numero_os: "", // Gatilho para a Sequence do banco
      valor_total: data.valor_servico, // CORREÇÃO 1: A OS já nasce com o Total preenchido corretamente
    };

    const { data: result, error } = await supabase.from("ordens_servico").insert(payload).select("id").single();
    
    if (error) { 
      toast.error("Erro ao criar OS. Tente novamente."); 
      console.error(error);
      setSaving(false);
      return; 
    }

    // CORREÇÃO 2: Se o utilizador inseriu um valor inicial, registamos isso na tabela de serviços!
    // Assim, quando a OrdemDetailPage recalcular os totais (ao adicionar peças), 
    // este valor não será apagado, garantindo que o dinheiro não "some" da OS.
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
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Controller
                control={control}
                name="cliente_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className={errors.cliente_id ? "border-red-500" : ""}>
                      <SelectValue placeholder={loadingClientes ? "Carregando..." : "Selecione o cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cliente_id && <p className="text-sm text-red-500">{errors.cliente_id.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Aparelho</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Marca *</Label>
                <Input {...register("marca_aparelho")} className={errors.marca_aparelho ? "border-red-500" : ""} />
                {errors.marca_aparelho && <p className="text-sm text-red-500">{errors.marca_aparelho.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label>Modelo *</Label>
                <Input {...register("modelo_aparelho")} className={errors.modelo_aparelho ? "border-red-500" : ""} />
                {errors.modelo_aparelho && <p className="text-sm text-red-500">{errors.modelo_aparelho.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>IMEI</Label>
                <Input {...register("imei")} className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>Senha do Aparelho</Label>
                <Input {...register("senha_aparelho")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Checklist de Entrada</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              { id: "checklist_tela_quebrada" as const, label: "Tela quebrada" },
              { id: "checklist_nao_liga" as const, label: "Não liga" },
              { id: "checklist_molhado" as const, label: "Molhado / Líquido" },
              { id: "checklist_bateria_ruim" as const, label: "Bateria ruim" },
              { id: "checklist_camera_quebrada" as const, label: "Câmera quebrada" },
            ].map((item) => (
              <Controller
                key={item.id}
                control={control}
                name={item.id}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id={item.id} />
                    <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                  </div>
                )}
              />
            ))}
            <div className="grid gap-2 mt-2">
              <Label>Outros</Label>
              <Input {...register("checklist_outros")} placeholder="Descreva outros problemas visíveis..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Problema e Diagnóstico</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Problema Relatado *</Label>
              <Textarea {...register("problema_relatado")} className={errors.problema_relatado ? "border-red-500" : ""} />
              {errors.problema_relatado && <p className="text-sm text-red-500">{errors.problema_relatado.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Diagnóstico</Label>
              <Textarea {...register("diagnostico")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor do Serviço (R$)</Label>
                <Input type="number" step="0.01" {...register("valor_servico")} />
              </div>
              <div className="grid gap-2">
                <Label>Previsão de Entrega</Label>
                <Input type="date" {...register("data_previsao")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea {...register("observacoes")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-8">
          <Button type="submit" disabled={saving || loadingClientes}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : "Criar Ordem de Serviço"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/ordens")} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}