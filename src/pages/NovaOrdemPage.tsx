import { useEffect, useState } from "react";
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

interface ClienteOption { id: string; nome: string; }

export default function NovaOrdemPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [form, setForm] = useState({
    cliente_id: "",
    marca_aparelho: "",
    modelo_aparelho: "",
    imei: "",
    senha_aparelho: "",
    problema_relatado: "",
    diagnostico: "",
    valor_servico: 0,
    observacoes: "",
    data_previsao: "",
    checklist_tela_quebrada: false,
    checklist_nao_liga: false,
    checklist_molhado: false,
    checklist_bateria_ruim: false,
    checklist_camera_quebrada: false,
    checklist_outros: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { toast.error("Selecione um cliente"); return; }
    setSaving(true);
    const payload: any = {
      ...form,
      cliente_id: form.cliente_id || null,
      valor_servico: Number(form.valor_servico),
      data_previsao: form.data_previsao || null,
    };
    const { data, error } = await supabase.from("ordens_servico").insert(payload).select("id").single();
    setSaving(false);
    if (error) { toast.error("Erro ao criar OS"); return; }
    toast.success("Ordem de Serviço criada!");
    navigate(`/ordens/${data.id}`);
  }

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent>
            <Select value={form.cliente_id} onValueChange={(v) => set("cliente_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Aparelho</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Marca</Label><Input value={form.marca_aparelho} onChange={(e) => set("marca_aparelho", e.target.value)} /></div>
              <div className="grid gap-2"><Label>Modelo</Label><Input value={form.modelo_aparelho} onChange={(e) => set("modelo_aparelho", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>IMEI</Label><Input value={form.imei} onChange={(e) => set("imei", e.target.value)} className="font-mono" /></div>
              <div className="grid gap-2"><Label>Senha do Aparelho</Label><Input value={form.senha_aparelho} onChange={(e) => set("senha_aparelho", e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Checklist de Entrada</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["checklist_tela_quebrada", "Tela quebrada"],
              ["checklist_nao_liga", "Não liga"],
              ["checklist_molhado", "Molhado / Líquido"],
              ["checklist_bateria_ruim", "Bateria ruim"],
              ["checklist_camera_quebrada", "Câmera quebrada"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox checked={(form as any)[key]} onCheckedChange={(v) => set(key, !!v)} />
                <Label className="cursor-pointer">{label}</Label>
              </div>
            ))}
            <div className="grid gap-2">
              <Label>Outros</Label>
              <Input value={form.checklist_outros} onChange={(e) => set("checklist_outros", e.target.value)} placeholder="Descreva outros problemas..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Problema e Diagnóstico</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2"><Label>Problema Relatado</Label><Textarea value={form.problema_relatado} onChange={(e) => set("problema_relatado", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Diagnóstico</Label><Textarea value={form.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Valor do Serviço</Label><Input type="number" step="0.01" value={form.valor_servico} onChange={(e) => set("valor_servico", e.target.value)} /></div>
              <div className="grid gap-2"><Label>Previsão de Entrega</Label><Input type="date" value={form.data_previsao} onChange={(e) => set("data_previsao", e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar Ordem de Serviço"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate("/ordens")}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
