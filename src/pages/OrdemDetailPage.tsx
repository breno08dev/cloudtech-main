import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { OS_STATUS_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { Printer, Download, Plus, Trash2 } from "lucide-react";

interface OrdemDetail {
  id: string;
  numero_os: string;
  cliente_id: string | null;
  marca_aparelho: string | null;
  modelo_aparelho: string | null;
  imei: string | null;
  senha_aparelho: string | null;
  problema_relatado: string | null;
  diagnostico: string | null;
  status: string;
  valor_servico: number;
  valor_pecas: number;
  valor_total: number;
  checklist_tela_quebrada: boolean;
  checklist_nao_liga: boolean;
  checklist_molhado: boolean;
  checklist_bateria_ruim: boolean;
  checklist_camera_quebrada: boolean;
  checklist_outros: string | null;
  data_previsao: string | null;
  data_finalizacao: string | null;
  observacoes: string | null;
  created_at: string;
  clientes: { nome: string; telefone: string | null } | null;
}

interface Peca {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produtos?: { nome: string };
}

interface Servico {
  id: string;
  descricao: string;
  valor: number;
}

interface ProdutoOption {
  id: string;
  nome: string;
  preco_venda: number;
  estoque: number;
}

export default function OrdemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ordem, setOrdem] = useState<OrdemDetail | null>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [newPeca, setNewPeca] = useState({ produto_id: "", quantidade: 1 });
  const [newServico, setNewServico] = useState({ descricao: "", valor: 0 });

  useEffect(() => { if (id) loadAll(); }, [id]);

  async function loadAll() {
    const [osRes, pecasRes, servicosRes, prodRes] = await Promise.all([
      supabase.from("ordens_servico").select("*, clientes(nome, telefone)").eq("id", id!).single(),
      supabase.from("ordem_servico_pecas").select("*, produtos(nome)").eq("ordem_servico_id", id!),
      supabase.from("ordem_servico_servicos").select("*").eq("ordem_servico_id", id!),
      supabase.from("produtos").select("id, nome, preco_venda, estoque").gt("estoque", 0).order("nome"),
    ]);
    setOrdem(osRes.data as any);
    setPecas((pecasRes.data as any) || []);
    setServicos(servicosRes.data || []);
    setProdutos(prodRes.data || []);
  }

  async function updateStatus(status: string) {
    const updates: any = { status };
    if (status === "pronto" || status === "entregue") updates.data_finalizacao = new Date().toISOString();
    await supabase.from("ordens_servico").update(updates).eq("id", id!);
    toast.success("Status atualizado");
    loadAll();
  }

  async function addPeca() {
    if (!newPeca.produto_id) return;
    const prod = produtos.find((p) => p.id === newPeca.produto_id);
    if (!prod) return;
    if (newPeca.quantidade > prod.estoque) { toast.error("Estoque insuficiente"); return; }

    const subtotal = prod.preco_venda * newPeca.quantidade;
    await supabase.from("ordem_servico_pecas").insert({
      ordem_servico_id: id!,
      produto_id: newPeca.produto_id,
      quantidade: newPeca.quantidade,
      preco_unitario: prod.preco_venda,
      subtotal,
    });
    // Decrease stock
    await supabase.from("produtos").update({ estoque: prod.estoque - newPeca.quantidade }).eq("id", prod.id);
    // Recalculate totals
    await recalcTotals();
    setNewPeca({ produto_id: "", quantidade: 1 });
    toast.success("Peça adicionada");
    loadAll();
  }

  async function removePeca(peca: Peca) {
    await supabase.from("ordem_servico_pecas").delete().eq("id", peca.id);
    // Restore stock
    const { data: currentProd } = await supabase.from("produtos").select("estoque").eq("id", peca.produto_id).single();
    if (currentProd) {
      await supabase.from("produtos").update({ estoque: currentProd.estoque + peca.quantidade }).eq("id", peca.produto_id);
    }
    await recalcTotals();
    toast.success("Peça removida");
    loadAll();
  }

  async function addServico() {
    if (!newServico.descricao.trim()) return;
    await supabase.from("ordem_servico_servicos").insert({
      ordem_servico_id: id!,
      descricao: newServico.descricao,
      valor: Number(newServico.valor),
    });
    await recalcTotals();
    setNewServico({ descricao: "", valor: 0 });
    toast.success("Serviço adicionado");
    loadAll();
  }

  async function removeServico(sid: string) {
    await supabase.from("ordem_servico_servicos").delete().eq("id", sid);
    await recalcTotals();
    toast.success("Serviço removido");
    loadAll();
  }

  async function recalcTotals() {
    const { data: pecasData } = await supabase.from("ordem_servico_pecas").select("subtotal").eq("ordem_servico_id", id!);
    const { data: servicosData } = await supabase.from("ordem_servico_servicos").select("valor").eq("ordem_servico_id", id!);
    const valorPecas = (pecasData || []).reduce((s, p) => s + Number(p.subtotal), 0);
    const valorServico = (servicosData || []).reduce((s, sv) => s + Number(sv.valor), 0);
    await supabase.from("ordens_servico").update({
      valor_pecas: valorPecas,
      valor_servico: valorServico,
      valor_total: valorPecas + valorServico,
    }).eq("id", id!);
  }

  function printOS() {
    window.print();
  }

  if (!ordem) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="font-mono">{ordem.numero_os}</span>
            <StatusBadge status={ordem.status} />
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Criada em {new Date(ordem.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={printOS}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          <Select value={ordem.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(OS_STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{ordem.clientes?.nome || "—"}</p>
            <p className="text-muted-foreground font-mono">{ordem.clientes?.telefone || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Aparelho</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{[ordem.marca_aparelho, ordem.modelo_aparelho].filter(Boolean).join(" ") || "—"}</p>
            <p className="font-mono text-muted-foreground">IMEI: {ordem.imei || "—"}</p>
            <p className="text-muted-foreground">Senha: {ordem.senha_aparelho || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Checklist de Entrada</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {ordem.checklist_tela_quebrada && <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Tela quebrada</span>}
            {ordem.checklist_nao_liga && <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Não liga</span>}
            {ordem.checklist_molhado && <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Molhado</span>}
            {ordem.checklist_bateria_ruim && <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Bateria ruim</span>}
            {ordem.checklist_camera_quebrada && <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">Câmera quebrada</span>}
            {ordem.checklist_outros && <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1">{ordem.checklist_outros}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Problema e Diagnóstico</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><Label className="text-muted-foreground text-xs">Problema Relatado</Label><p>{ordem.problema_relatado || "—"}</p></div>
          <div><Label className="text-muted-foreground text-xs">Diagnóstico</Label><p>{ordem.diagnostico || "—"}</p></div>
          {ordem.observacoes && <div><Label className="text-muted-foreground text-xs">Observações</Label><p>{ordem.observacoes}</p></div>}
        </CardContent>
      </Card>

      {/* Peças */}
      <Card>
        <CardHeader><CardTitle className="text-base">Peças Utilizadas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pecas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{(p as any).produtos?.nome || "—"}</TableCell>
                  <TableCell className="text-center font-mono">{p.quantidade}</TableCell>
                  <TableCell className="text-right font-mono">R$ {Number(p.preco_unitario).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">R$ {Number(p.subtotal).toFixed(2)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removePeca(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={newPeca.produto_id} onValueChange={(v) => setNewPeca({ ...newPeca, produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar peça" /></SelectTrigger>
                <SelectContent>{produtos.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome} (est: {p.estoque})</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <Input type="number" min={1} className="w-20" value={newPeca.quantidade} onChange={(e) => setNewPeca({ ...newPeca, quantidade: Number(e.target.value) })} />
            <Button size="sm" onClick={addPeca}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card>
        <CardHeader><CardTitle className="text-base">Serviços Realizados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.descricao}</TableCell>
                  <TableCell className="text-right font-mono">R$ {Number(s.valor).toFixed(2)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeServico(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2 items-end">
            <Input placeholder="Descrição do serviço" className="flex-1" value={newServico.descricao} onChange={(e) => setNewServico({ ...newServico, descricao: e.target.value })} />
            <Input type="number" step="0.01" className="w-28" placeholder="Valor" value={newServico.valor || ""} onChange={(e) => setNewServico({ ...newServico, valor: Number(e.target.value) })} />
            <Button size="sm" onClick={addServico}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span className="font-mono">R$ {Number(ordem.valor_servico).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Peças</span><span className="font-mono">R$ {Number(ordem.valor_pecas).toFixed(2)}</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-base"><span>Total</span><span className="font-mono">R$ {Number(ordem.valor_total).toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
