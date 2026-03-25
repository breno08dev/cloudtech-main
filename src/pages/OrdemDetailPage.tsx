import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OS_STATUS_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Printer, Plus, Trash2, Loader2, Save, FileText, ShieldCheck,
  UserCircle, Smartphone, Wrench, Package, ClipboardList, CheckCircle2,
  Banknote, CreditCard, QrCode
} from "lucide-react";

export default function OrdemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newPeca, setNewPeca] = useState({ produto_id: "", quantidade: 1 });
  const [newServico, setNewServico] = useState({ descricao: "", valor: 0 });
  const [editForm, setEditForm] = useState<any>({});
  const [printMode, setPrintMode] = useState<"os" | "garantia">("os");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({ metodo: "pix", desconto: 0 });

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ordem_detail", id],
    queryFn: async () => {
      const [osRes, pecasRes, servicosRes, prodRes] = await Promise.all([
        supabase.from("ordens_servico").select("*, clientes(nome, telefone, tipo_cliente)").eq("id", id!).single(),
        (supabase as any).from("ordem_servico_pecas").select("*, produto_variacoes(qualidade, com_aro, produto_base(nome))").eq("ordem_servico_id", id!),
        supabase.from("ordem_servico_servicos").select("*").eq("ordem_servico_id", id!),
        (supabase as any).from("produto_base").select("id, nome, variacoes:produto_variacoes(id, qualidade, com_aro, preco_venda, preco_lojista, estoque)"),
      ]);

      if (osRes.error) throw osRes.error;

      const flatProdutos: any[] = [];
      (prodRes.data || []).forEach((base: any) => {
        base.variacoes?.forEach((v: any) => {
          if (v.estoque > 0) {
            flatProdutos.push({
              id: v.id,
              nome: `${base.nome} - ${v.qualidade}${v.com_aro ? ' (Aro)' : ''}`,
              preco_venda: v.preco_venda,
              preco_lojista: v.preco_lojista,
              estoque: v.estoque
            });
          }
        });
      });

      flatProdutos.sort((a, b) => a.nome.localeCompare(b.nome));

      return {
        ordem: osRes.data,
        pecas: pecasRes.data || [],
        servicos: servicosRes.data || [],
        produtos: flatProdutos,
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
    
    const valorTotalSemDesconto = valorPecas + valorServico;
    const descontoAplicado = data?.ordem?.desconto || 0;
    
    await supabase.from("ordens_servico").update({ 
      valor_pecas: valorPecas, 
      valor_servico: valorServico, 
      valor_total: Math.max(0, valorTotalSemDesconto - descontoAplicado)
    }).eq("id", osId);
  };

  const saveOsMutation = useMutation({
    mutationFn: async (overrides?: any) => {
      const rawUpdates = { ...editForm, ...overrides };
      const updates: any = {};

      for (const key in rawUpdates) {
        if (key === 'id') continue; 
        if (rawUpdates[key] === "") updates[key] = null;
        else updates[key] = rawUpdates[key];
      }

      if (updates.status === "pronto" || updates.status === "entregue") {
        updates.data_finalizacao = new Date().toISOString();
      }

      if (updates.desconto !== undefined && updates.desconto !== null) updates.desconto = Number(updates.desconto) || 0;
      if (updates.valor_total !== undefined && updates.valor_total !== null) updates.valor_total = Number(updates.valor_total) || 0;
      if (updates.peca_original !== undefined) updates.peca_original = Boolean(updates.peca_original);

      const { error } = await supabase.from("ordens_servico").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ordem de Serviço guardada!");
      queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      navigate("/ordens"); 
    },
    onError: (err: any) => toast.error(`Erro ao guardar: ${err.message}`),
  });
  
  const addPecaMutation = useMutation({
    mutationFn: async () => {
      if (!newPeca.produto_id) throw new Error("Selecione uma peça");
      const prod = data?.produtos.find((p) => p.id === newPeca.produto_id);
      if (!prod || newPeca.quantidade > prod.estoque) throw new Error("Estoque insuficiente");

      const isLojista = data?.ordem?.clientes?.tipo_cliente === "lojista";
      const precoFinal = isLojista && prod.preco_lojista > 0 ? prod.preco_lojista : prod.preco_venda;

      await (supabase as any).from("ordem_servico_pecas").insert({ 
        ordem_servico_id: id!, 
        produto_id: prod.id, 
        quantidade: newPeca.quantidade, 
        preco_unitario: precoFinal, 
        subtotal: precoFinal * newPeca.quantidade 
      });
      await (supabase as any).from("produto_variacoes").update({ estoque: prod.estoque - newPeca.quantidade }).eq("id", prod.id);
      await recalcTotals(id!);
    },
    onSuccess: () => { toast.success("Peça adicionada"); setNewPeca({ produto_id: "", quantidade: 1 }); queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] }); },
    onError: (err: any) => toast.error(err.message)
  });

  const removePecaMutation = useMutation({
    mutationFn: async (peca: any) => {
      await supabase.from("ordem_servico_pecas").delete().eq("id", peca.id);
      const { data: currentProd } = await (supabase as any).from("produto_variacoes").select("estoque").eq("id", peca.produto_id).single();
      if (currentProd) await (supabase as any).from("produto_variacoes").update({ estoque: currentProd.estoque + peca.quantidade }).eq("id", peca.produto_id);
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
    setTimeout(() => window.print(), 150);
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "entregue") {
      setPaymentData({ metodo: "pix", desconto: 0 }); 
      setIsPaymentModalOpen(true);
    } else {
      setEditForm({ ...editForm, status: newStatus });
    }
  };

  const handleConfirmPayment = () => {
    const valorPecasEServicos = (data.ordem.valor_pecas || 0) + (data.ordem.valor_servico || 0);
    const overrides = {
      status: "entregue",
      forma_pagamento: paymentData.metodo,
      desconto: paymentData.desconto,
      valor_total: Math.max(0, valorPecasEServicos - paymentData.desconto)
    };
    
    setEditForm({ ...editForm, ...overrides });
    setIsPaymentModalOpen(false);
    saveOsMutation.mutate(overrides);
  };

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/60" /></div>;
  if (isError || !data?.ordem) return <div className="p-8 text-center text-destructive font-medium">Erro ao carregar a OS.</div>;

  const { ordem, pecas, servicos, produtos } = data;
  const nomeLoja = config?.nome_empresa || "Nome da Assistência";
  const enderecoLoja = config?.endereco || "Endereço não configurado";
  const telefoneLoja = config?.telefone || "Telefone não configurado";

  const valorTotalSemDesconto = (ordem.valor_pecas || 0) + (ordem.valor_servico || 0);
  const valorFinalComDesconto = Math.max(0, valorTotalSemDesconto - paymentData.desconto);

  return (
    <>
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-page { width: 210mm; height: 296mm; padding: 15mm 20mm; box-sizing: border-box; } header, footer, .no-print { display: none !important; } }`}</style>

      {/* ================= OS PRINT ================= */}
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
            </div>
            <div className="border border-black p-3 rounded-md bg-gray-50/50">
              <h3 className="font-bold uppercase text-[9px] text-gray-500 mb-1 border-b border-gray-200">Equipamento</h3>
              <p className="font-bold text-sm leading-tight mt-1">{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</p>
              <p className="mt-1">IMEI/Série: {ordem.imei || "—"}</p>
              <p>Senha: {ordem.senha_aparelho || "Não informada"}</p>
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
                {pecas.map((p: any) => {
                  const nomePeca = p.produto_variacoes?.produto_base?.nome || "Peça Excluída";
                  const descQualidade = p.produto_variacoes?.qualidade || "";
                  const nomeCompleto = descQualidade ? `${nomePeca} (${descQualidade})` : nomePeca;
                  
                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-1.5">{nomeCompleto} <span className="text-[9px] text-gray-400">(Peça)</span></td>
                      <td className="text-center py-1.5">{p.quantidade}</td>
                      <td className="text-right py-1.5">R$ {p.subtotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 bg-gray-50 p-3 border border-gray-300 rounded-md text-right">
              <p className="text-[11px] text-gray-600 mb-0.5">Subtotal Serviços: R$ {(ordem.valor_servico || 0).toFixed(2)}</p>
              <p className="text-[11px] text-gray-600 mb-1">Subtotal Peças: R$ {(ordem.valor_pecas || 0).toFixed(2)}</p>
              {ordem.desconto > 0 && <p className="text-[11px] text-red-600 mb-1">Desconto: - R$ {Number(ordem.desconto).toFixed(2)}</p>}
              <p className="text-lg font-black mt-1 border-t border-gray-300 pt-1 leading-none">TOTAL: R$ {ordem.valor_total.toFixed(2)}</p>
            </div>
          </div>

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

      {/* ================= GARANTIA PRINT ================= */}
      {printMode === "garantia" && (
        <div className="hidden print:flex print:fixed print:inset-0 print:z-[99999] bg-white text-black flex-col print-page text-[12px] leading-relaxed">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">{nomeLoja}</h1>
            <p className="text-[10px] text-gray-600">{enderecoLoja} | Telefones: {telefoneLoja}</p>
            <h2 className="text-lg font-bold uppercase mt-4">Termo de Garantia de Equipamento</h2>
            <p className="text-[11px] text-gray-600 mt-1">Ordem de Serviço: <strong className="text-black text-sm">{ordem.numero_os}</strong></p>
          </div>
          
          <div className="text-justify space-y-4 flex-1">
            <p>
              Pelo presente termo, garantimos os serviços e peças descritos na OS <strong>{ordem.numero_os}</strong>, referente ao aparelho <strong>{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</strong> do cliente <strong>{ordem.clientes?.nome}</strong>.
            </p>

            <div className="mt-8 space-y-5 font-bold text-[13px] uppercase tracking-wide">
              <p>1 - A GARANTIA É DE {editForm.garantia_servico?.toUpperCase() || "90 DIAS"} E COBRE APENAS DEFEITOS DE FABRICAÇÃO DA PEÇA TROCADA.</p>
              <p>2 - NÃO TEM GARANTIA: PEÇA QUEBRADA, ARRANHADA, COM MARCAS DE QUEDA OU PRESSÃO, FLEX RASGADO, COM MARCAS DE ÁGUA E OXIDAÇÃO E COM O SELO DE GARANTIA RASGADO OU REMOVIDO.</p>
              <p>3 - O PRAZO PARA ANÁLISE DE GARANTIA É DE ATÉ 30 DIAS ÚTEIS.</p>
              <p>4 - OS APARELHOS NÃO RETIRADOS NO PRAZO DE 90 DIAS SERÃO VENDIDOS PARA CUSTEAR O VALOR DO CONSERTO OU DESCARTADOS.</p>
              <p>5 - NÃO NOS RESPONSABILIZAMOS POR CHIP, CARTÃO DE MEMÓRIA OU CAPINHA DEIXADOS NO APARELHO.</p>
            </div>
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

      {/* ================= MODAL DE PAGAMENTO ================= */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-border/40 shadow-2xl">
          <div className="bg-primary/10 p-6 flex flex-col items-center justify-center border-b border-border/40 relative">
            <div className="absolute top-4 right-4 bg-background/50 px-3 py-1 rounded-full text-xs font-bold border border-border/60">OS: {ordem.numero_os}</div>
            <DialogTitle className="text-2xl font-black mt-2">Finalizar Entrega</DialogTitle>
          </div>
          <div className="p-6 space-y-6 bg-background">
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Forma de Pagamento</Label>
              <RadioGroup value={paymentData.metodo} onValueChange={(v) => setPaymentData({...paymentData, metodo: v})} className="grid grid-cols-2 gap-3">
                {[
                  { id: 'pix', label: 'PIX', icon: QrCode },
                  { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                  { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
                  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                ].map((metodo) => (
                  <div key={metodo.id} className="relative">
                    <RadioGroupItem value={metodo.id} id={metodo.id} className="peer sr-only" />
                    <Label htmlFor={metodo.id} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-border/50 bg-card hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all">
                      <metodo.icon className={cn("h-6 w-6", paymentData.metodo === metodo.id ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="font-semibold">{metodo.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Aplicar Desconto (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">R$</span>
                <Input type="number" min="0" step="0.01" value={paymentData.desconto || ""} onChange={(e) => setPaymentData({...paymentData, desconto: Number(e.target.value)})} className="h-12 pl-10 text-lg font-mono rounded-xl bg-card border-border/60 focus-visible:ring-primary" placeholder="0.00" />
              </div>
            </div>
            <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal:</span><span className="font-mono">R$ {valorTotalSemDesconto.toFixed(2)}</span></div>
              {paymentData.desconto > 0 && (<div className="flex justify-between text-sm text-red-500 font-medium"><span>Desconto:</span><span className="font-mono">- R$ {paymentData.desconto.toFixed(2)}</span></div>)}
              <div className="flex justify-between items-end pt-2 border-t border-border/60"><span className="font-bold">Total a Pagar:</span><span className="text-3xl font-black text-primary font-mono tracking-tighter">R$ {valorFinalComDesconto.toFixed(2)}</span></div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 sm:justify-between flex-row">
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleConfirmPayment} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-6"><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= INTERFACE PRINCIPAL ================= */}
      <div className="print:hidden space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
          <div><h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3"><FileText className="h-6 w-6 text-primary" /> Gestão da OS <span className="font-mono text-primary bg-primary/10 px-3 py-1 rounded-xl text-lg tracking-wider border border-primary/20 shadow-inner">{ordem.numero_os}</span></h1></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handlePrint("os")} className="h-11 rounded-xl font-semibold bg-background hover:bg-muted/80 border-border/60"><Printer className="h-4 w-4 mr-2" /> Imprimir OS</Button>
            <Button variant="outline" onClick={() => handlePrint("garantia")} className="h-11 rounded-xl font-semibold border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10"><ShieldCheck className="h-4 w-4 mr-2" /> Imprimir Garantia</Button>
            <Button onClick={() => saveOsMutation.mutate({})} disabled={saveOsMutation.isPending} className="h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 px-6">{saveOsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Salvar Alterações</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 font-bold"><UserCircle className="h-4 w-4 text-primary" /> Dados do Cliente</Label>
              <div className="space-y-3">
                <div className="font-bold text-xl text-foreground/90">{ordem.clientes?.nome || "Cliente não vinculado"}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium"><span className="bg-muted/50 px-2.5 py-1 rounded-lg text-xs border border-border/60">{ordem.clientes?.tipo_cliente === "lojista" ? "Lojista" : "Cliente Final"}</span><span>{ordem.clientes?.telefone || "Sem telefone cadastrado"}</span></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 font-bold"><Smartphone className="h-4 w-4 text-indigo-500" /> Equipamento</Label>
              <div className="grid grid-cols-2 gap-5">
                <div><Label className="text-xs text-muted-foreground/80 font-medium">Marca/Modelo</Label><p className="font-bold text-foreground/90 mt-0.5">{[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</p></div>
                <div><Label className="text-xs text-muted-foreground/80 font-medium">IMEI / Série</Label><p className="font-mono text-sm font-semibold text-foreground/80 mt-0.5">{ordem.imei || "—"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground/80 font-medium">Senha</Label><p className="font-mono bg-background px-3 py-1.5 rounded-lg inline-block border border-border/60 font-medium text-sm mt-1">{ordem.senha_aparelho || "Não informada"}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-2">
              <Label className="text-sm font-bold flex items-center gap-2 text-foreground/90"><ClipboardList className="h-4 w-4 text-amber-500" /> Problema Relatado</Label>
              <Textarea value={editForm.problema_relatado} onChange={(e) => setEditForm({...editForm, problema_relatado: e.target.value})} className="min-h-[90px] text-base resize-none rounded-xl bg-card/50 border-border/50 focus-visible:ring-primary" />
            </div>
            <div className="grid gap-2 pt-2">
              <Label className="text-sm font-bold text-primary flex items-center gap-2">Diagnóstico Técnico</Label>
              <Textarea value={editForm.diagnostico} onChange={(e) => setEditForm({...editForm, diagnostico: e.target.value})} className="min-h-[110px] text-base rounded-xl border-primary/30 bg-primary/5 focus-visible:ring-primary/50" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
            <CardHeader className="bg-card border-b border-border/40 pb-4 px-5 pt-5"><CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground tracking-wide uppercase"><Wrench className="h-4 w-4 text-primary" /> Mão de Obra / Serviços</CardTitle></CardHeader>
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="flex-1 max-h-[250px] overflow-auto">
                <Table><TableHeader className="bg-muted/20"><TableRow className="border-border/30"><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold py-3">Descrição</TableHead><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold text-right py-3">Valor</TableHead><TableHead className="w-12 py-3"></TableHead></TableRow></TableHeader><TableBody>{servicos.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Nenhum serviço.</TableCell></TableRow>)}{servicos.map((s: any) => (<TableRow key={s.id} className="border-border/20"><TableCell className="font-medium text-sm text-foreground/90">{s.descricao}</TableCell><TableCell className="text-right font-mono text-primary font-bold">R$ {s.valor.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => removePecaMutation.mutate(s)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table>
              </div>
              <div className="p-5 bg-background border-t border-border/40 space-y-4">
                <div className="grid gap-1.5"><Label className="text-xs font-semibold text-muted-foreground">Descrição do Novo Serviço</Label><Input placeholder="Ex: Limpeza..." value={newServico.descricao} onChange={(e) => setNewServico({...newServico, descricao: e.target.value})} className="h-11 rounded-xl bg-card border-border/60" /></div>
                <div className="flex gap-3"><div className="w-1/2 grid gap-1.5"><Label className="text-xs font-semibold text-muted-foreground">Valor (R$)</Label><Input type="number" value={newServico.valor || ""} onChange={(e) => setNewServico({...newServico, valor: Number(e.target.value)})} className="h-11 rounded-xl font-mono bg-card border-border/60" /></div><Button onClick={() => addServicoMutation.mutate()} disabled={addServicoMutation.isPending || !newServico.descricao} className="w-1/2 self-end h-11 rounded-xl font-bold bg-primary"><Plus className="h-4 w-4 mr-2" /> Incluir</Button></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
             <CardHeader className="bg-card border-b border-border/40 pb-4 px-5 pt-5"><CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground tracking-wide uppercase"><Package className="h-4 w-4 text-emerald-500" /> Peças do Estoque</CardTitle></CardHeader>
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="flex-1 max-h-[250px] overflow-auto">
                <Table><TableHeader className="bg-muted/20"><TableRow className="border-border/30"><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold py-3">Produto</TableHead><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold text-center py-3">Qtd</TableHead><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold text-right py-3">Total</TableHead><TableHead className="w-12 py-3"></TableHead></TableRow></TableHeader><TableBody>{pecas.length === 0 && (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">Nenhuma peça.</TableCell></TableRow>)}{pecas.map((p: any) => {
                  const nomePeca = p.produto_variacoes?.produto_base?.nome || "Peça Excluída";
                  const descQualidade = p.produto_variacoes?.qualidade || "";
                  const nomeCompleto = descQualidade ? `${nomePeca} (${descQualidade})` : nomePeca;
                  return (
                  <TableRow key={p.id} className="border-border/20"><TableCell className="font-medium text-sm text-foreground/90 line-clamp-2 py-2">{nomeCompleto}</TableCell><TableCell className="text-center"><span className="font-mono bg-muted px-2 py-0.5 rounded-md text-xs">{p.quantidade}</span></TableCell><TableCell className="text-right font-mono text-emerald-600 font-bold">R$ {p.subtotal.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => removePecaMutation.mutate(p)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>
                )})}</TableBody></Table>
              </div>
              <div className="p-5 bg-background border-t border-border/40 space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Buscar Peça no Estoque</Label>
                  <Select value={newPeca.produto_id} onValueChange={(v) => setNewPeca({...newPeca, produto_id: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-card border-border/60 text-sm"><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg">
                      {produtos.map((p: any) => (
                        <SelectItem key={p.id} value={p.id} className="font-medium text-sm">{p.nome} - R$ {p.preco_venda.toFixed(2)} <span className="text-muted-foreground text-xs ml-1">(Est: {p.estoque})</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3"><div className="w-1/3 grid gap-1.5"><Label className="text-xs font-semibold text-muted-foreground">Qtd.</Label><Input type="number" min="1" value={newPeca.quantidade} onChange={(e) => setNewPeca({...newPeca, quantidade: Number(e.target.value)})} className="h-11 rounded-xl font-mono text-center bg-card border-border/60" /></div><Button onClick={() => addPecaMutation.mutate()} disabled={addPecaMutation.isPending || !newPeca.produto_id} className="w-2/3 self-end h-11 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-2" /> Adicionar</Button></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm"><CardContent className="p-6 space-y-6"><div className="grid gap-3"><Label className="text-sm font-bold flex items-center gap-2 text-foreground/90"><CheckCircle2 className="h-4 w-4 text-primary" /> Garantia do Serviço</Label><RadioGroup value={editForm.garantia_servico} onValueChange={(v) => setEditForm({...editForm, garantia_servico: v})} className="flex flex-wrap gap-3">{Array.from(new Set(["Sem garantia", "90 dias", config?.garantia_padrao].filter(Boolean))).map((opcao, idx) => (<div key={idx} className="flex items-center space-x-2 bg-background/50 px-4 py-2.5 rounded-xl border border-border/60 hover:bg-muted/50 cursor-pointer"><RadioGroupItem value={opcao as string} id={`garantia-${idx}`} /><Label htmlFor={`garantia-${idx}`} className="cursor-pointer font-medium text-sm">{opcao}</Label></div>))}</RadioGroup></div><div className="grid gap-2 pt-2"><Label className="text-sm font-bold text-foreground/90">Observações de Entrega Internas</Label><Textarea value={editForm.observacoes} onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})} className="bg-background/50 rounded-xl border-border/60 min-h-[80px] resize-none" placeholder="Ex: Cliente deixou chip..." /></div></CardContent></Card>

          <Card className="rounded-3xl border-none shadow-xl shadow-primary/5 bg-gradient-to-br from-primary/10 via-background to-background flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-bl-[100px] -z-0 blur-xl pointer-events-none"></div>
            <CardContent className="p-8 space-y-8 relative z-10 flex-1 flex flex-col justify-center">
              <div className="space-y-5">
                <div className="flex justify-between items-center text-base"><span className="text-muted-foreground font-semibold">Mão de Obra</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-border/40 shadow-sm">R$ {(ordem.valor_servico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between items-center text-base"><span className="text-muted-foreground font-semibold">Peças</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-border/40 shadow-sm">R$ {(ordem.valor_pecas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                {ordem.desconto > 0 && (<div className="flex justify-between items-center text-base text-red-500 font-medium"><span>Desconto</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-red-200 shadow-sm">- R$ {Number(ordem.desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>)}
                <div className="border-t-2 border-primary/20 pt-6 flex justify-between items-end"><span className="font-black uppercase tracking-widest text-sm text-primary mb-1">Total da OS</span><span className="text-5xl font-black text-primary font-mono tracking-tighter drop-shadow-sm">R$ {ordem.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              </div>
              <div className="grid gap-3 pt-6 mt-auto">
                <Label className="text-xs font-bold uppercase text-muted-foreground/80 tracking-widest ml-1">Status</Label>
                <Select value={editForm.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-16 text-lg font-bold bg-background/80 backdrop-blur-md border border-border/60 shadow-sm rounded-2xl px-6"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-xl">
                    {Object.entries(OS_STATUS_MAP).map(([k, v]) => {
                      const chave = String(k).toLowerCase();
                      let corHex = '#3b82f6'; 
                      if (chave.includes('recebido')) corHex = '#94a3b8'; else if (chave.includes('analise') || chave.includes('análise')) corHex = '#f97316'; else if (chave.includes('aguardando')) corHex = '#eab308'; else if (chave.includes('manutencao') || chave.includes('manutenção')) corHex = '#a855f7'; else if (chave.includes('pronto')) corHex = '#3b82f6'; else if (chave.includes('entregue')) corHex = '#22c55e'; else if (chave.includes('cancelad')) corHex = '#ef4444';
                      return (
                        <SelectItem key={k} value={k} className="text-base py-3 font-medium hover:bg-muted/50">
                          <div className="flex items-center gap-3"><div style={{ backgroundColor: corHex, width: '12px', height: '12px', minWidth: '12px', borderRadius: '50%' }} className="shadow-sm border border-black/10" /><span>{v.label}</span></div>
                        </SelectItem>
                      )
                    })}
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