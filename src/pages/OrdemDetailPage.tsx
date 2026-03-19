import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { OS_STATUS_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Loader2, Save, FileText, ShieldCheck } from "lucide-react";

export default function OrdemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newPeca, setNewPeca] = useState({ produto_id: "", quantidade: 1 });
  const [newServico, setNewServico] = useState({ descricao: "", valor: 0 });
  const [editForm, setEditForm] = useState<any>({});
  const [printMode, setPrintMode] = useState<"os" | "garantia">("os");

  // 1. Fetch das Configurações da Empresa
  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ordem_detail", id],
    queryFn: async () => {
      const [osRes, pecasRes, servicosRes, prodRes] = await Promise.all([
        supabase.from("ordens_servico").select("*, clientes(nome, telefone, tipo_cliente)").eq("id", id!).single(),
        supabase.from("ordem_servico_pecas").select("*, produtos(nome)").eq("ordem_servico_id", id!),
        supabase.from("ordem_servico_servicos").select("*").eq("ordem_servico_id", id!),
        supabase.from("produtos").select("id, nome, preco_venda, preco_lojista, estoque").gt("estoque", 0).order("nome"),
      ]);

      if (osRes.error) throw osRes.error;
      return {
        ordem: osRes.data,
        pecas: pecasRes.data || [],
        servicos: servicosRes.data || [],
        produtos: prodRes.data || [],
      };
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.ordem) {
      setEditForm({
        problema_relatado: data.ordem.problema_relatado || "",
        diagnostico: data.ordem.diagnostico || "",
        observacoes: data.ordem.observacoes || "",
        status: data.ordem.status || "recebido",
        // Usa a garantia da OS, se não existir, tenta puxar do painel de Configurações, se não, usa 90 dias
        garantia_servico: data.ordem.garantia_servico || config?.garantia_padrao || "90 dias",
        peca_original: data.ordem.peca_original !== undefined ? data.ordem.peca_original : false,
      });
    }
  }, [data?.ordem, config]);

  const recalcTotals = async (osId: string) => {
    const { data: pecasData } = await supabase.from("ordem_servico_pecas").select("subtotal").eq("ordem_servico_id", osId);
    const { data: servicosData } = await supabase.from("ordem_servico_servicos").select("valor").eq("ordem_servico_id", osId);
    const valorPecas = (pecasData || []).reduce((s, p) => s + Number(p.subtotal), 0);
    const valorServico = (servicosData || []).reduce((s, sv) => s + Number(sv.valor), 0);
    await supabase.from("ordens_servico").update({ valor_pecas: valorPecas, valor_servico: valorServico, valor_total: valorPecas + valorServico }).eq("id", osId);
  };

  const saveOsMutation = useMutation({
    mutationFn: async () => {
      const updates = { ...editForm };
      if (editForm.status === "pronto" || editForm.status === "entregue") updates.data_finalizacao = new Date().toISOString();
      const { error } = await supabase.from("ordens_servico").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem de Serviço guardada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
    },
  });

  const addPecaMutation = useMutation({
    mutationFn: async () => {
      if (!newPeca.produto_id) throw new Error("Selecione uma peça");
      const prod = data?.produtos.find((p) => p.id === newPeca.produto_id);
      if (!prod || newPeca.quantidade > prod.estoque) throw new Error("Estoque insuficiente");

      const isLojista = data?.ordem?.clientes?.tipo_cliente === "lojista";
      const precoFinal = isLojista && prod.preco_lojista > 0 ? prod.preco_lojista : prod.preco_venda;

      await supabase.from("ordem_servico_pecas").insert({ 
        ordem_servico_id: id!, 
        produto_id: prod.id, 
        quantidade: newPeca.quantidade, 
        preco_unitario: precoFinal, 
        subtotal: precoFinal * newPeca.quantidade 
      });
      await supabase.from("produtos").update({ estoque: prod.estoque - newPeca.quantidade }).eq("id", prod.id);
      await recalcTotals(id!);
    },
    onSuccess: () => { toast.success("Peça adicionada"); setNewPeca({ produto_id: "", quantidade: 1 }); queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] }); },
  });

  const removePecaMutation = useMutation({
    mutationFn: async (peca: any) => {
      await supabase.from("ordem_servico_pecas").delete().eq("id", peca.id);
      const { data: currentProd } = await supabase.from("produtos").select("estoque").eq("id", peca.produto_id).single();
      if (currentProd) await supabase.from("produtos").update({ estoque: currentProd.estoque + peca.quantidade }).eq("id", peca.produto_id);
      await recalcTotals(id!);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] }); },
  });

  const addServicoMutation = useMutation({
    mutationFn: async () => {
      if (!newServico.descricao) throw new Error("Descrição obrigatória");
      await supabase.from("ordem_servico_servicos").insert({ ordem_servico_id: id!, descricao: newServico.descricao, valor: newServico.valor });
      await recalcTotals(id!);
    },
    onSuccess: () => { toast.success("Serviço adicionado"); setNewServico({ descricao: "", valor: 0 }); queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] }); },
  });

  const handlePrint = (mode: "os" | "garantia") => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (isError || !data?.ordem) return <div className="p-8 text-center text-red-500">Erro ao carregar a OS.</div>;

  const { ordem, pecas, servicos, produtos } = data;

  // Variáveis seguras para a impressão (Fallback)
  const nomeLoja = config?.nome_empresa || "Nome da Assistência";
  const enderecoLoja = config?.endereco || "Endereço não configurado";
  const telefoneLoja = config?.telefone || "Telefone não configurado";

  return (
    <>
      {/* CSS DE IMPRESSÃO */}
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-page { width: 210mm; height: 296mm; padding: 15mm 20mm; box-sizing: border-box; }
            header, footer, .no-print { display: none !important; }
          }
        `}
      </style>

      {/* ========================================================= */}
      {/* 1. MÁSCARA DA ORDEM DE SERVIÇO (OS)                         */}
      {/* ========================================================= */}
      {printMode === "os" && (
        <div className="hidden print:flex print:fixed print:inset-0 print:z-[99999] bg-white text-black flex-col print-page text-[11px]">
          
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-5">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest leading-none mb-1">{nomeLoja}</h1>
              <p className="text-[10px] text-gray-700">{enderecoLoja}</p>
              <p className="text-[10px] text-gray-700">Telefones: {telefoneLoja}</p>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-bold uppercase text-gray-500 mb-1 tracking-widest">Ordem de Serviço</h2>
              <p className="text-2xl font-bold font-mono leading-none mb-1">{ordem.numero_os}</p>
              <p className="text-[10px] text-gray-500">Data: {new Date(ordem.created_at).toLocaleDateString("pt-BR")} | Status: {OS_STATUS_MAP[ordem.status as keyof typeof OS_STATUS_MAP]?.label}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-black p-3 rounded-md bg-gray-50/50">
              <h3 className="font-bold uppercase text-[9px] text-gray-500 mb-1 border-b border-gray-200">Dados do Cliente</h3>
              <p className="font-bold text-sm leading-tight mt-1">{ordem.clientes?.nome || "Não informado"}</p>
              <p className="mt-1">Telefone: {ordem.clientes?.telefone || "—"}</p>
              <p>Tipo: {ordem.clientes?.tipo_cliente === "lojista" ? "Lojista" : "Cliente Final"}</p>
            </div>
            <div className="border border-black p-3 rounded-md bg-gray-50/50">
              <h3 className="font-bold uppercase text-[9px] text-gray-500 mb-1 border-b border-gray-200">Equipamento</h3>
              <p className="font-bold text-sm leading-tight mt-1">{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</p>
              <p className="mt-1">IMEI/Série: {ordem.imei || "—"}</p>
              <p>Senha de Desbloqueio: {ordem.senha_aparelho || "Não informada"}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold border-b border-black pb-0.5 mb-2 uppercase text-[10px]">Condição Visual de Entrada</h3>
            <div className="grid grid-cols-4 gap-2 text-[11px]">
              <span className="flex items-center gap-1"><Checkbox checked={ordem.checklist_tela_quebrada} className="print:border-black w-3 h-3" /> Tela quebrada</span>
              <span className="flex items-center gap-1"><Checkbox checked={ordem.checklist_nao_liga} className="print:border-black w-3 h-3" /> Não liga</span>
              <span className="flex items-center gap-1"><Checkbox checked={ordem.checklist_molhado} className="print:border-black w-3 h-3" /> Molhado</span>
              <span className="flex items-center gap-1"><Checkbox checked={ordem.checklist_bateria_ruim} className="print:border-black w-3 h-3" /> Bateria ruim</span>
            </div>
            {ordem.checklist_outros && <div className="mt-2 text-[11px]"><strong>Outros:</strong> {ordem.checklist_outros}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-bold border-b border-gray-300 pb-0.5 mb-1.5 uppercase text-[10px]">Problema Relatado</h3>
              <p className="text-gray-700 italic leading-snug">{ordem.problema_relatado || "—"}</p>
            </div>
            <div>
              <h3 className="font-bold border-b border-gray-300 pb-0.5 mb-1.5 uppercase text-[10px]">Diagnóstico Técnico</h3>
              <p className="text-gray-700 leading-snug">{ordem.diagnostico || "Aguardando avaliação."}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold border-b border-black pb-0.5 mb-1.5 uppercase text-[10px]">Serviços e Peças Aplicadas</h3>
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-[10px] text-gray-500 uppercase">
                  <th className="py-1">Descrição</th>
                  <th className="text-center py-1 w-16">Qtd</th>
                  <th className="text-right py-1 w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-100"><td className="py-1.5">{s.descricao} <span className="text-[9px] text-gray-400">(Serviço)</span></td><td className="text-center py-1.5">-</td><td className="text-right py-1.5">R$ {s.valor.toFixed(2)}</td></tr>
                ))}
                {pecas.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-100"><td className="py-1.5">{p.produtos?.nome} <span className="text-[9px] text-gray-400">(Peça)</span></td><td className="text-center py-1.5">{p.quantidade}</td><td className="text-right py-1.5">R$ {p.subtotal.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 bg-gray-50 p-3 border border-gray-300 rounded-md text-right">
              <p className="text-[11px] text-gray-600 mb-0.5">Subtotal Serviços: R$ {ordem.valor_servico.toFixed(2)}</p>
              <p className="text-[11px] text-gray-600 mb-1">Subtotal Peças: R$ {ordem.valor_pecas.toFixed(2)}</p>
              <p className="text-lg font-black mt-1 border-t border-gray-300 pt-1 leading-none">TOTAL: R$ {ordem.valor_total.toFixed(2)}</p>
            </div>
          </div>

          {/* Opcional: Mensagem Padrão que configurou */}
          {config?.mensagem_padrao_os && (
            <div className="mt-4 text-[10px] text-gray-500 text-justify">
              <strong>Atenção:</strong> {config.mensagem_padrao_os}
            </div>
          )}

          <div className="mt-auto flex justify-between px-8">
            <div className="text-center w-56 border-t border-black pt-1">
              <p className="text-[9px] uppercase font-bold">{nomeLoja}</p>
            </div>
            <div className="text-center w-56 border-t border-black pt-1">
              <p className="text-[9px] uppercase font-bold">Assinatura do Cliente</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{ordem.clientes?.nome}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MÁSCARA DO TERMO DE GARANTIA                             */}
      {/* ========================================================= */}
      {printMode === "garantia" && (
        <div className="hidden print:flex print:fixed print:inset-0 print:z-[99999] bg-white text-black flex-col print-page text-[12px] leading-relaxed">
          
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">{nomeLoja}</h1>
            <p className="text-[10px] text-gray-600">{enderecoLoja} | Telefones: {telefoneLoja}</p>
            <h2 className="text-lg font-bold uppercase mt-4">Termo de Garantia de Equipamento</h2>
            <p className="text-[11px] text-gray-600 mt-1">Documento Auxiliar à Ordem de Serviço: <strong className="text-black text-sm">{ordem.numero_os}</strong></p>
          </div>

          <div className="text-justify space-y-4">
            <p>
              Pelo presente termo, a <strong>{nomeLoja}</strong> garante os serviços executados e as peças substituídas descritos na Ordem de Serviço <strong>{ordem.numero_os}</strong>, referente ao aparelho <strong>{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</strong> (IMEI: {ordem.imei || "N/A"}), de propriedade do(a) Sr(a). <strong>{ordem.clientes?.nome}</strong>.
            </p>

            <h3 className="font-bold uppercase mt-4 border-b border-gray-300 pb-0.5">1. Prazo e Cobertura</h3>
            <p>
              O prazo de garantia para os serviços executados e peças substituídas é de <strong>{editForm.garantia_servico}</strong>, contados a partir da data de entrega do equipamento. A garantia cobre <strong>exclusivamente</strong> os defeitos de fabricação das peças instaladas por nossa assistência e vícios diretamente ligados ao serviço prestado.
            </p>

            <h3 className="font-bold uppercase mt-4 border-b border-gray-300 pb-0.5">2. Situações de Perda da Garantia</h3>
            <p>A garantia perderá <strong>totalmente a sua validade</strong> caso ocorra qualquer uma das seguintes situações durante o período vigente:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-1">
              <li>Rompimento, remoção ou rasura do selo de garantia afixado no aparelho.</li>
              <li>Constatação de danos físicos por mau uso, tais como: quedas, amassados, arranhões profundos, trincos, display vazado ou <strong>tela quebrada</strong>.</li>
              <li>Danos causados por exposição a umidade, vapor, suor excessivo, maresia ou contato direto com líquidos (oxidação).</li>
              <li>Sinais de que o aparelho foi aberto, consertado ou modificado pelo próprio cliente ou por terceiros não autorizados.</li>
              <li>Danos elétricos causados por picos de energia ou pelo uso de carregadores, cabos e acessórios não originais ou de má qualidade (curto-circuito).</li>
              <li>Problemas de software, atualizações mal sucedidas, jailbreak/root ou vírus.</li>
            </ul>

            <h3 className="font-bold uppercase mt-4 border-b border-gray-300 pb-0.5">3. Condições de Acionamento</h3>
            <p>
              Para o acionamento da garantia, é obrigatória a apresentação deste termo impresso junto ao aparelho defeituoso. O prazo máximo legal para análise, diagnóstico e resolução do defeito em garantia é de até 30 (trinta) dias corridos, conforme determina o Código de Defesa do Consumidor (Art. 18).
            </p>
          </div>

          <div className="mt-auto flex justify-between px-8 pb-4">
            <div className="text-center w-56 border-t border-black pt-1">
              <p className="text-[10px] uppercase font-bold">{nomeLoja}</p>
              <p className="text-[9px] text-gray-500 mt-1">Data: ____/____/________</p>
            </div>
            <div className="text-center w-56 border-t border-black pt-1">
              <p className="text-[10px] uppercase font-bold">Ciente e de Acordo</p>
              <p className="text-[9px] text-gray-500 mt-1">{ordem.clientes?.nome}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERFACE DO SISTEMA                                      */}
      {/* ========================================================= */}
      <div className="print:hidden space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" />
              Gestão da OS
              <span className="font-mono text-primary bg-primary/10 px-3 py-1 rounded-lg text-lg tracking-wider border border-primary/20">{ordem.numero_os}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handlePrint("os")} className="font-semibold bg-background hover:bg-muted">
              <Printer className="h-4 w-4 mr-2" /> Imprimir OS
            </Button>
            <Button variant="outline" onClick={() => handlePrint("garantia")} className="font-semibold border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
              <ShieldCheck className="h-4 w-4 mr-2" /> Imprimir Garantia
            </Button>
            <Button onClick={() => saveOsMutation.mutate()} disabled={saveOsMutation.isPending} className="font-bold shadow-md">
              {saveOsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </div>

        {/* Componentes de Edição (Corpo da Página) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Dados do Cliente</Label>
              <div className="space-y-2">
                <div className="font-semibold text-lg">{ordem.clientes?.nome || "Cliente não vinculado"}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded-md text-xs border">{ordem.clientes?.tipo_cliente === "lojista" ? "Lojista" : "Cliente Final"}</span>
                  <span>{ordem.clientes?.telefone || "Sem telefone cadastrado"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Equipamento</Label>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-muted-foreground">Marca/Modelo</Label><p className="font-semibold">{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</p></div>
                <div><Label className="text-xs text-muted-foreground">IMEI</Label><p className="font-mono text-sm">{ordem.imei || "—"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Senha de Desbloqueio</Label><p className="font-mono bg-muted/50 px-3 py-1.5 rounded-md inline-block border">{ordem.senha_aparelho || "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-2">
              <Label className="text-sm font-bold">Problema Relatado pelo Cliente</Label>
              <Textarea 
                value={editForm.problema_relatado} 
                onChange={(e) => setEditForm({...editForm, problema_relatado: e.target.value})}
                className="min-h-[80px] text-base resize-none bg-muted/20"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-bold text-primary flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>Diagnóstico Técnico</Label>
              <Textarea 
                value={editForm.diagnostico} 
                onChange={(e) => setEditForm({...editForm, diagnostico: e.target.value})}
                className="min-h-[100px] text-base border-primary/30 focus-visible:ring-primary/20 bg-primary/5"
                placeholder="Descreva o que foi encontrado e o que precisa ser feito..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Seções de Serviços e Peças */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/50 flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="p-4 bg-muted/30 border-b">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mão de Obra / Serviços</Label>
              </div>
              <div className="flex-1 max-h-[250px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-12"></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicos.map((s: any) => (
                      <TableRow key={s.id}><TableCell className="font-medium text-sm">{s.descricao}</TableCell><TableCell className="text-right font-mono text-primary font-bold">R$ {s.valor.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => removePecaMutation.mutate(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-background border-t space-y-3">
                <div className="grid gap-1"><Label className="text-xs">Descrição do Serviço</Label><Input placeholder="Ex: Formatação, Limpeza..." value={newServico.descricao} onChange={(e) => setNewServico({...newServico, descricao: e.target.value})} /></div>
                <div className="flex gap-3">
                  <div className="w-1/2 grid gap-1"><Label className="text-xs">Valor (R$)</Label><Input type="number" value={newServico.valor || ""} onChange={(e) => setNewServico({...newServico, valor: Number(e.target.value)})} /></div>
                  <Button onClick={() => addServicoMutation.mutate()} disabled={addServicoMutation.isPending || !newServico.descricao} className="w-1/2 self-end"><Plus className="h-4 w-4 mr-2" /> Incluir</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="p-4 bg-muted/30 border-b">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Peças do Estoque</Label>
              </div>
              <div className="flex-1 max-h-[250px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-12"></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {pecas.map((p: any) => (
                      <TableRow key={p.id}><TableCell className="font-medium line-clamp-2">{p.produtos?.nome}</TableCell><TableCell className="text-center font-mono bg-muted/20">{p.quantidade}</TableCell><TableCell className="text-right font-mono text-primary font-bold">R$ {p.subtotal.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => removePecaMutation.mutate(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-background border-t space-y-3">
                <div className="grid gap-1"><Label className="text-xs">Buscar Peça</Label><Select value={newPeca.produto_id} onValueChange={(v) => setNewPeca({...newPeca, produto_id: v})}><SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger><SelectContent>{produtos.map((p: any) => {
                    const isLojista = ordem.clientes?.tipo_cliente === "lojista";
                    const preco = isLojista && p.preco_lojista > 0 ? p.preco_lojista : p.preco_venda;
                    return (
                      <SelectItem key={p.id} value={p.id}>{p.nome} - R$ {preco.toFixed(2)} (Est: {p.estoque})</SelectItem>
                    )
                  })}</SelectContent></Select></div>
                <div className="flex gap-3">
                  <div className="w-1/3 grid gap-1"><Label className="text-xs">Qtd.</Label><Input type="number" min="1" value={newPeca.quantidade} onChange={(e) => setNewPeca({...newPeca, quantidade: Number(e.target.value)})} /></div>
                  <Button onClick={() => addPecaMutation.mutate()} disabled={addPecaMutation.isPending || !newPeca.produto_id} className="w-2/3 self-end"><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo Financeiro e Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-l-4 border-l-amber-500 bg-amber-500/5">
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-3">
                <Label className="text-sm font-bold">Garantia do Serviço</Label>
                <RadioGroup value={editForm.garantia_servico} onValueChange={(v) => setEditForm({...editForm, garantia_servico: v})} className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2 bg-background px-3 py-2 rounded-lg border"><RadioGroupItem value="Sem garantia" id="r1" /><Label htmlFor="r1">Sem garantia</Label></div>
                  <div className="flex items-center space-x-2 bg-background px-3 py-2 rounded-lg border"><RadioGroupItem value="90 dias" id="r2" /><Label htmlFor="r2">90 dias</Label></div>
                  <div className="flex items-center space-x-2 bg-background px-3 py-2 rounded-lg border"><RadioGroupItem value={config?.garantia_padrao || "Outro"} id="r3" /><Label htmlFor="r3">{config?.garantia_padrao || "Outro"}</Label></div>
                </RadioGroup>
              </div>
              <div className="grid gap-3">
                <Label className="text-sm font-bold">Qualidade da Peça</Label>
                <RadioGroup value={editForm.peca_original ? "sim" : "nao"} onValueChange={(v) => setEditForm({...editForm, peca_original: v === "sim"})} className="flex gap-4">
                  <div className="flex items-center space-x-2 bg-background px-3 py-2 rounded-lg border"><RadioGroupItem value="sim" id="p1" /><Label htmlFor="p1">Peça Original</Label></div>
                  <div className="flex items-center space-x-2 bg-background px-3 py-2 rounded-lg border"><RadioGroupItem value="nao" id="p2" /><Label htmlFor="p2">Peça Paralela</Label></div>
                </RadioGroup>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-bold">Observações de Entrega</Label>
                <Textarea value={editForm.observacoes} onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})} className="bg-background" placeholder="Ex: Entregue sem a capinha original..." />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-primary/30 bg-primary/5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-0"></div>
            <CardContent className="p-8 space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex justify-between text-base"><span className="text-muted-foreground font-medium">Subtotal Serviços</span><span className="font-mono font-bold text-foreground">R$ {ordem.valor_servico.toFixed(2)}</span></div>
                <div className="flex justify-between text-base"><span className="text-muted-foreground font-medium">Subtotal Peças</span><span className="font-mono font-bold text-foreground">R$ {ordem.valor_pecas.toFixed(2)}</span></div>
                <div className="border-t-2 border-primary/20 pt-4 flex justify-between items-end">
                  <span className="font-black uppercase tracking-wider text-sm text-primary">Total da OS</span>
                  <span className="text-4xl font-black text-primary font-mono tracking-tighter">R$ {ordem.valor_total.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid gap-2 pt-4 bg-background p-4 rounded-xl border shadow-sm">
                <Label className="text-xs font-bold uppercase text-center block mb-1 text-muted-foreground tracking-widest">Atualizar Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                  <SelectTrigger className="h-14 text-lg font-bold bg-transparent border-0 shadow-none justify-center focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OS_STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-base py-3 cursor-pointer justify-center text-center font-medium">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}