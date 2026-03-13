import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Config {
  id: string;
  nome_empresa: string;
  logo_url: string | null;
  telefone: string | null;
  endereco: string | null;
  mensagem_padrao_os: string | null;
  garantia_padrao: string | null;
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes").select("*").limit(1).single().then(({ data }) => {
      if (data) setConfig(data as any);
    });
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("configuracoes").update({
      nome_empresa: config.nome_empresa,
      telefone: config.telefone,
      endereco: config.endereco,
      mensagem_padrao_os: config.mensagem_padrao_os,
      garantia_padrao: config.garantia_padrao,
    }).eq("id", config.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configurações salvas!");
  }

  if (!config) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  const set = (key: keyof Config, value: string) => setConfig({ ...config, [key]: value });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Dados da Empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2"><Label>Nome da Empresa</Label><Input value={config.nome_empresa} onChange={(e) => set("nome_empresa", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Telefone</Label><Input value={config.telefone || ""} onChange={(e) => set("telefone", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Garantia Padrão</Label><Input value={config.garantia_padrao || ""} onChange={(e) => set("garantia_padrao", e.target.value)} /></div>
          </div>
          <div className="grid gap-2"><Label>Endereço</Label><Input value={config.endereco || ""} onChange={(e) => set("endereco", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Mensagem Padrão da OS</Label><Textarea value={config.mensagem_padrao_os || ""} onChange={(e) => set("mensagem_padrao_os", e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
