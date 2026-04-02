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
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OS_STATUS_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Printer, Plus, Trash2, Loader2, FileText, ShieldCheck, Undo2,
  UserCircle, Smartphone, Wrench, Package, ClipboardList, CheckCircle2,
  Banknote, CreditCard, QrCode, PieChart, Save, BookOpenCheck, AlertCircle
} from "lucide-react";

export default function OrdemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newPeca, setNewPeca] = useState({ produto_id: "", quantidade: 1 });
  const [newServico, setNewServico] = useState({ descricao: "", valor: 0 });
  const [editForm, setEditForm] = useState<any>({
    problema_relatado: "",
    diagnostico: "",
    observacoes: "",
    status: "recebido",
    garantia_servico: "90 dias",
    peca_original: false
  });
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({ metodo: "pix", desconto: 0 });
  const [pagamentoMisto, setPagamentoMisto] = useState({ dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0 });
  const [valorRecebido, setValorRecebido] = useState<number | "">("");

  // ADICIONADO: Estados para Crediário
  const [parcelasCrediario, setParcelasCrediario] = useState<number>(1);
  const [dataVencimentoCrediario, setDataVencimentoCrediario] = useState<string>("");

  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setDataVencimentoCrediario(defaultDate.toISOString().split('T')[0]);
  }, []);

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
        supabase.from("ordens_servico").select("*, clientes(nome, telefone, tipo_cliente, cpf_cnpj)").eq("id", id!).single(),
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

  const valorPecasEServicos = (data?.ordem?.valor_pecas || 0) + (data?.ordem?.valor_servico || 0);
  const valorFinalComDesconto = Math.max(0, valorPecasEServicos - paymentData.desconto);
  
  const somaMisto = (pagamentoMisto.dinheiro || 0) + (pagamentoMisto.pix || 0) + (pagamentoMisto.cartao_credito || 0) + (pagamentoMisto.cartao_debito || 0);
  const faltaMisto = valorFinalComDesconto - somaMisto;

  const getFormaPagamentoString = () => {
    if (paymentData.metodo !== "misto") return paymentData.metodo;
    
    const partes = [];
    if (pagamentoMisto.dinheiro > 0) partes.push(`Din R$${pagamentoMisto.dinheiro.toFixed(2)}`);
    if (pagamentoMisto.pix > 0) partes.push(`PIX R$${pagamentoMisto.pix.toFixed(2)}`);
    if (pagamentoMisto.cartao_credito > 0) partes.push(`Créd R$${pagamentoMisto.cartao_credito.toFixed(2)}`);
    if (pagamentoMisto.cartao_debito > 0) partes.push(`Déb R$${pagamentoMisto.cartao_debito.toFixed(2)}`);
    
    return `MISTO (${partes.join(' | ')})`;
  };

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
      const { criar_crediario, parcelas, vencimento, ...rawUpdates } = overrides || {};
      
      const baseUpdates = { ...editForm, ...rawUpdates };
      const updates: any = {};

      for (const key in baseUpdates) {
        if (key === 'id') continue; 
        if (baseUpdates[key] === "") updates[key] = null;
        else updates[key] = baseUpdates[key];
      }

      if (updates.status === "pronto" || updates.status === "entregue") {
        updates.data_finalizacao = new Date().toISOString();
      }

      if (updates.desconto !== undefined && updates.desconto !== null) updates.desconto = Number(updates.desconto) || 0;
      if (updates.valor_total !== undefined && updates.valor_total !== null) updates.valor_total = Number(updates.valor_total) || 0;
      if (updates.peca_original !== undefined) updates.peca_original = Boolean(updates.peca_original);

      // 1. Guardar Ordem de Serviço
      const { error } = await supabase.from("ordens_servico").update(updates).eq("id", id!);
      if (error) throw error;
      
      // 2. Se for crediário, regista a dívida
      if (criar_crediario && data?.ordem?.cliente_id) {
        const valorTotalFinal = updates.valor_total;
        
        const { data: crediario, error: credErr } = await (supabase as any).from("crediarios").insert({
          cliente_id: data.ordem.cliente_id,
          ordem_servico_id: id!,
          valor_total: valorTotalFinal,
          status: "pendente"
        }).select("id").single();
        
        if (credErr) throw credErr;

        const valorParcela = valorTotalFinal / (parcelas || 1);
        const parcelasPayload = [];
        const dataBase = new Date(vencimento + "T12:00:00");
        
        for (let i = 1; i <= parcelas; i++) {
          const dataVenc = new Date(dataBase);
          dataVenc.setMonth(dataVenc.getMonth() + (i - 1));
          
          parcelasPayload.push({
            crediario_id: crediario.id,
            numero_parcela: i,
            valor_parcela: valorParcela,
            data_vencimento: dataVenc.toISOString().split('T')[0],
            status_pagamento: "pendente"
          });
        }
        
        const { error: parcErr } = await (supabase as any).from("crediario_parcelas").insert(parcelasPayload);
        if (parcErr) throw parcErr;
      }
    },
    onSuccess: () => {
      toast.success("Ordem de Serviço salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["crediarios"] }); // Invalida crediário também
      navigate("/ordens"); 
    },
    onError: (err: any) => toast.error(`Erro ao salvar: ${err.message}`),
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

  const removeServicoMutation = useMutation({
    mutationFn: async (servicoId: string) => {
      await supabase.from("ordem_servico_servicos").delete().eq("id", servicoId);
      await recalcTotals(id!);
    },
    onSuccess: () => { 
      toast.success("Serviço removido"); 
      queryClient.invalidateQueries({ queryKey: ["ordem_detail", id] }); 
    },
    onError: (err: any) => toast.error(err.message)
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "entregue") {
      setPaymentData({ metodo: "pix", desconto: 0 }); 
      setPagamentoMisto({ dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0 });
      setValorRecebido("");
      setParcelasCrediario(1);
      
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setDataVencimentoCrediario(defaultDate.toISOString().split('T')[0]);

      setIsPaymentModalOpen(true);
    } else {
      setEditForm({ ...editForm, status: newStatus });
    }
  };

  const handleConfirmPayment = () => {
    if (paymentData.metodo === "misto" && faltaMisto > 0.01) {
      toast.error("O valor misto não cobre o total da OS.");
      return;
    }

    const overrides: any = {
      status: "entregue",
      forma_pagamento: getFormaPagamentoString(),
      desconto: paymentData.desconto,
      valor_total: valorFinalComDesconto
    };

    if (paymentData.metodo === "crediario") {
      overrides.criar_crediario = true;
      overrides.parcelas = parcelasCrediario;
      overrides.vencimento = dataVencimentoCrediario;
    }
    
    setEditForm({ ...editForm, status: "entregue" });
    setIsPaymentModalOpen(false);
    saveOsMutation.mutate(overrides);
  };

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/60" /></div>;
  if (isError || !data?.ordem) return <div className="p-8 text-center text-destructive font-medium">Erro ao carregar a OS.</div>;

  const { ordem, pecas, servicos, produtos } = data;
  const nomeLoja = config?.nome_empresa || "Nome da Assistência";
  const enderecoLoja = config?.endereco || "Endereço não configurado";
  const telefoneLoja = config?.telefone || "Telefone não configurado";
  const valorTotalSemDescontoConst = (ordem.valor_pecas || 0) + (ordem.valor_servico || 0);

  const logoHtml = config?.logo_url ? `<img src="${config.logo_url}" alt="Logo" style="max-height: 50px; margin: 0 auto 10px auto; display: block;" />` : '';

  const servicosRealizados = [
    ...servicos.map((s: any) => s.descricao),
    ...pecas.map((p: any) => p.produto_variacoes?.produto_base?.nome || "Peça")
  ].join(', ') || "Nenhum serviço registrado.";

  const condicaoEntrada = [
    ordem.problema_relatado,
    ordem.checklist_tela_quebrada ? "Tela Quebrada" : null,
    ordem.checklist_nao_liga ? "Não Liga" : null,
    ordem.checklist_molhado ? "Molhado" : null,
    ordem.checklist_bateria_ruim ? "Bateria Ruim" : null,
    ordem.checklist_outros ? `Outros: ${ordem.checklist_outros}` : null
  ].filter(Boolean).join(" | ");

  const prazoGarantia = editForm.garantia_servico?.toUpperCase() || config?.garantia_padrao?.toUpperCase() || "90 DIAS";
  const isPecaOriginal = ordem.peca_original ? "☑ SIM &emsp; ☐ NÃO" : "☐ SIM &emsp; ☑ NÃO";

  const gerarImpressao = (modo: "os" | "garantia" | "estorno") => {
  let htmlContent = "";

    if (modo === "os") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Ordem de Serviço</title>
          <style>
            @page { margin: 10mm; size: A4 portrait; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 11px; margin: 0; padding: 0; color: #000; }
            h1, h2, h3, p { margin: 0; padding: 0; line-height: 1.3; }
            .center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
            .linha { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; text-align: left; }
            th { border-bottom: 1px dashed #000; padding-bottom: 4px; font-weight: bold; }
            .box { border: 1px solid #000; padding: 8px; border-radius: 4px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 10px;">
            ${logoHtml}
            <h2 class="bold" style="font-size: 16px;">${nomeLoja}</h2>
            <p>${enderecoLoja} | Tel: ${telefoneLoja}</p>
          </div>
          <div class="linha"></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
            <div><h2 class="bold" style="font-size: 14px;">ORDEM DE SERVIÇO: ${ordem.numero_os}</h2></div>
            <div class="right"><p>Data: ${new Date(ordem.created_at).toLocaleDateString("pt-BR")}</p><p>Status: ${OS_STATUS_MAP[ordem.status as keyof typeof OS_STATUS_MAP]?.label}</p></div>
          </div>
          
          <div class="grid-2">
            <div class="box">
              <h3 class="bold" style="border-bottom: 1px solid #ccc; margin-bottom: 4px;">Cliente</h3>
              <p class="bold">${ordem.clientes?.nome || "Não informado"}</p>
              <p>Tel: ${ordem.clientes?.telefone || "—"}</p>
            </div>
            <div class="box">
              <h3 class="bold" style="border-bottom: 1px solid #ccc; margin-bottom: 4px;">Aparelho</h3>
              <p class="bold">${[ordem.marca_aparelho, ordem.modelo_aparelho].join(" ")}</p>
              <p>IMEI: ${ordem.imei || "—"} | Senha: ${ordem.senha_aparelho || "—"}</p>
            </div>
          </div>

          <div class="box" style="margin-bottom: 10px;">
            <h3 class="bold" style="border-bottom: 1px solid #ccc; margin-bottom: 4px;">Condição / Checklist de Entrada</h3>
            <p>
              [ ${ordem.checklist_tela_quebrada ? 'X' : ' '} ] Tela Quebrada &nbsp; 
              [ ${ordem.checklist_nao_liga ? 'X' : ' '} ] Não Liga &nbsp; 
              [ ${ordem.checklist_molhado ? 'X' : ' '} ] Molhado &nbsp; 
              [ ${ordem.checklist_bateria_ruim ? 'X' : ' '} ] Bateria Ruim
            </p>
            ${ordem.checklist_outros ? `<p style="margin-top: 4px;"><strong>Outros:</strong> ${ordem.checklist_outros}</p>` : ''}
          </div>

          <div class="grid-2">
            <div class="box">
              <h3 class="bold" style="border-bottom: 1px solid #ccc; margin-bottom: 4px;">Problema Relatado</h3>
              <p>${ordem.problema_relatado || "—"}</p>
            </div>
            <div class="box">
              <h3 class="bold" style="border-bottom: 1px solid #ccc; margin-bottom: 4px;">Diagnóstico</h3>
              <p>${ordem.diagnostico || "Aguardando avaliação."}</p>
            </div>
          </div>

          <h3 class="bold" style="margin-top: 10px; border-bottom: 1px dashed #000;">Serviços e Peças Aplicadas</h3>
          <table style="margin-bottom: 15px;">
            <thead><tr><th>Descrição</th><th class="center" style="width: 50px;">Qtd</th><th class="right" style="width: 80px;">Valor (R$)</th></tr></thead>
            <tbody>
              ${servicos.map((s: any) => `<tr><td style="padding: 3px 0;">${s.descricao} (Serviço)</td><td class="center">-</td><td class="right">${s.valor.toFixed(2)}</td></tr>`).join("")}
              ${pecas.map((p: any) => {
                const nomePeca = p.produto_variacoes?.produto_base?.nome || "Peça";
                const qualidade = p.produto_variacoes?.qualidade || "";
                const nomeFinal = qualidade ? `${nomePeca} (${qualidade})` : nomePeca;
                return `<tr><td style="padding: 3px 0;">${nomeFinal} (Peça)</td><td class="center">${p.quantidade}</td><td class="right">${p.subtotal.toFixed(2)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>

          <div style="float: right; width: 250px; border: 1px solid #000; padding: 10px;">
            <p style="display: flex; justify-content: space-between;"><span>Mão de Obra:</span> <span>R$ ${(ordem.valor_servico || 0).toFixed(2)}</span></p>
            <p style="display: flex; justify-content: space-between;"><span>Peças:</span> <span>R$ ${(ordem.valor_pecas || 0).toFixed(2)}</span></p>
            ${ordem.desconto > 0 ? `<p style="display: flex; justify-content: space-between; color: red;"><span>Desconto:</span> <span>- R$ ${Number(ordem.desconto).toFixed(2)}</span></p>` : ''}
            <div style="border-top: 1px dashed #ccc; margin: 5px 0;"></div>
            <p class="bold" style="display: flex; justify-content: space-between; font-size: 14px;"><span>TOTAL:</span> <span>R$ ${ordem.valor_total.toFixed(2)}</span></p>
          </div>
          <div style="clear: both;"></div>

          <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center;">
            <div style="width: 200px; border-top: 1px solid #000; padding-top: 5px;">${nomeLoja}</div>
            <div style="width: 200px; border-top: 1px solid #000; padding-top: 5px;">Assinatura do Cliente<br><span style="font-size: 9px;">${ordem.clientes?.nome || ""}</span></div>
          </div>
        </body>
        </html>
      `;
    } else if (modo === "garantia") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Termo de Garantia</title>
          <style>
            @page { margin: 8mm; size: A4 portrait; }
            body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.25; color: #000; }
            h1, h2, h3, p { margin: 0; padding: 0; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            ul { margin: 2px 0 2px 20px; padding: 0; text-align: justify; }
            li { margin-bottom: 3px; }
            .info-box { border: 1px solid #000; padding: 8px; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background-color: #fdfdfd; }
            .signature-area { margin-top: 25px; display: flex; justify-content: space-between; text-align: center; }
            .sig-line { width: 220px; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; }
            .footer { margin-top: 15px; font-size: 10px; text-align: center; border-top: 1px dashed #ccc; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 10px;">
            ${logoHtml}
            <h1 class="bold uppercase" style="font-size: 16px; margin-bottom: 2px;">${nomeLoja}</h1>
            <p class="bold" style="font-size: 12px;">CNPJ: 59.415.196/0001-28</p>
            <h2 class="bold" style="font-size: 14px; margin-top: 8px; text-decoration: underline;">TERMO DE GARANTIA</h2>
          </div>

          <p class="bold uppercase" style="margin-top: 10px;">NÃO ESTÃO INCLUSOS NESTA GARANTIA ALGUNS ACESSÓRIOS E TODAS AS PARTES EXTERNAS DO CELULAR TAIS COMO:</p>
          <p style="text-align: justify;">Lentes, antenas, carcaças, capas, cases, teclas, teclados e botões laterais se houver, tampas, películas protetoras, cabos de dados, fones de ouvido, cartão de memória, pendrive, suportes e partes que se desgastam com o uso.</p>

          <p class="bold uppercase" style="margin-top: 8px;">A GARANTIA É CANCELADA AUTOMATICAMENTE NOS SEGUINTES CASOS:</p>
          <ul>
            <li>Em casos de quedas, esmagamentos, sobrecarga elétrica, exposição do aparelho a altas temperaturas, umidade ou infiltração, oxidação, sinais de uso inadequado ou violação do lacre, ainda que para conserto por terceiros.</li>
            <li>Instalações, modificações ou alterações no software operacional, abertura do equipamento ou tentativa de conserto por terceiros, que não sejam os técnicos da prestadora, mesmo que para realização de outros serviços, bem como a violação do selo/lacre de garantia colocado pela prestadora.</li>
          </ul>

          <p class="bold uppercase" style="margin-top: 8px;">E ainda:</p>
          <p class="uppercase" style="text-align: justify;">LENTE TOUCHSCREEN QUE APRESENTEM MAU USO, TRINCADOS OU QUEBRADOS, RISCADOS, MANCHADOS, DESCOLADOS OU COM CABO FLEX ROMPIDO.</p>

          <p class="bold uppercase" style="margin-top: 8px;">Vale lembrar que:</p>
          <ul>
            <li>A GARANTIA DE 90 (NOVENTA) dias está de acordo com o artigo 26 inciso II do código de defesa do consumidor.</li>
            <li>Funcionamento, instalação e atualização de aplicativos, bem como o sistema operacional do aparelho NÃO FAZEM parte desta garantia.</li>
            <li>Limpeza e conservação do aparelho NÃO FAZEM parte desta garantia.</li>
            <li>A não apresentação do documento fiscal (nota) implica na perda da garantia.</li>
            <li>Qualquer mau funcionamento APÓS ATUALIZAÇÕES do sistema operacional ou aplicativos NÃO FAZEM PARTE DESSA GARANTIA.</li>
            <li>A GARANTIA é válida somente para o item ou serviço descrito na nota fiscal, ordem de serviço ou neste termo de garantia, NÃO ABRANGENDO OUTRAS PARTES e respeitando as condições aqui descritas.</li>
          </ul>

          <div class="info-box">
            <div><span class="bold">Data:</span> ${new Date().toLocaleDateString('pt-BR')}</div>
            <div><span class="bold">Ordem de Serviço:</span> ${ordem.numero_os}</div>
            <div><span class="bold">Marca:</span> ${ordem.marca_aparelho || ''}</div>
            <div><span class="bold">Modelo:</span> ${ordem.modelo_aparelho || ''}</div>
            <div class="col-span-2"><span class="bold">IMEI:</span> ${ordem.imei || ''}</div>
            <div style="grid-column: span 2;"><span class="bold">Condição de entrada do equipamento (defeito e aspecto):</span><br>${condicaoEntrada}</div>
            <div style="grid-column: span 2;"><span class="bold">Serviço realizado:</span> ${servicosRealizados}</div>
          </div>

          <div style="display: flex; gap: 30px; margin-top: 8px; font-weight: bold; font-size: 12px;">
            <div>☑ ${prazoGarantia}</div>
            <div>PEÇA ORIGINAL? ${isPecaOriginal}</div>
          </div>

          <p style="text-align: justify; margin-top: 10px; font-size: 10px;">
            Confirmo que li este termo de garantia, fui orientado sobre o seu conteúdo e que testei o aparelho, e este se encontra em perfeito estado estético e de funcionamento no ato da retirada.
          </p>

          <div style="margin-top: 10px; font-size: 11px;">
            <div><span class="bold">Cliente:</span> ${ordem.clientes?.nome || ''}</div>
            <div><span class="bold">Telefone:</span> ${ordem.clientes?.telefone || ''}</div>
          </div>

          <div class="signature-area">
            <div class="sig-line">Assinatura Técnico<br>${nomeLoja}</div>
            <div class="sig-line">Ass: Cliente<br>${ordem.clientes?.nome || ''}</div>
          </div>

          <div class="footer">
            <span class="bold">Endereço da loja:</span> ${enderecoLoja} &emsp;|&emsp; <span class="bold">Telefones da loja:</span> ${telefoneLoja}
          </div>
        </body>
        </html>
      `;
    } else if (modo === "estorno") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Termo de Estorno</title>
          <style>
            @page { margin: 15mm; size: A4 portrait; }
            body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #000; }
            .center { text-align: center; } .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center" style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px;">
            ${logoHtml}
            <h1 class="bold uppercase" style="font-size: 24px; margin-bottom: 5px;">${nomeLoja}</h1>
            <p style="font-size: 12px; color: #555;">Termo de Devolução / Estorno</p>
          </div>
          
          <div style="text-align: justify; margin-top: 20px;">
            <h2 class="center bold uppercase" style="font-size: 18px; margin-bottom: 40px; text-decoration: underline;">TERMO DE ESTORNO</h2>
            
            <p>
              Eu <strong>${ordem.clientes?.nome || "________________________________________________"}</strong> cpf: <strong>${ordem.clientes?.cpf_cnpj || "_________________________"}</strong>
            </p>
            
            <p>
              Declaro que recebi o estorno de <strong>R$ ${ordem.valor_total.toFixed(2)}</strong>
            </p>
            
            <p>
              Referente ao pagamento de serviço de manutenção não realizado na Ordem de Serviço Nº <strong>${ordem.numero_os}</strong>.
            </p>
            
            <p class="bold" style="margin-top: 40px;">
              Declaro nada mais ter a receber.
            </p>
          </div>
          
          <div style="margin-top: 60px;">
            <p>${enderecoLoja} &emsp; Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div style="margin-top: 80px; display: flex; justify-content: space-between; text-align: center;">
            <div style="width: 250px; border-top: 1px solid #000; padding-top: 5px;">
              <p class="bold uppercase" style="font-size: 12px;">Ass Cliente</p>
              <p style="font-size: 11px; color: #555; margin-top: 2px;">${ordem.clientes?.nome || ""}</p>
            </div>
            <div style="width: 250px; border-top: 1px solid #000; padding-top: 5px;">
              <p class="bold uppercase" style="font-size: 12px;">Ass Tecnico</p>
              <p style="font-size: 11px; color: #555; margin-top: 2px;">${nomeLoja}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

   const iframe = document.createElement('iframe');
   iframe.style.position = 'fixed';
   iframe.style.right = '0';
   iframe.style.bottom = '0';
   iframe.style.width = '0px';
   iframe.style.height = '0px';
   iframe.style.border = 'none';
   document.body.appendChild(iframe);

   const doc = iframe.contentWindow?.document;
   if (doc) {
     doc.open(); 
     doc.write(htmlContent); 
     doc.close();

     if (iframe.contentWindow) {
       iframe.contentWindow.onafterprint = () => {
         if (document.body.contains(iframe)) {
           document.body.removeChild(iframe);
         }
       };
     }

     setTimeout(() => { 
       iframe.contentWindow?.focus(); 
       iframe.contentWindow?.print(); 
     }, 500); 
   }
  };

  const isConfirmarDisabled = saveOsMutation.isPending || 
    (paymentData.metodo === 'misto' && faltaMisto > 0.01) ||
    (paymentData.metodo === 'crediario' && !data?.ordem?.cliente_id);

  return (
    <div className="print:hidden space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 border border-border/40 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" /> Gestão da OS 
            <span className="font-mono text-primary bg-primary/10 px-3 py-1 rounded-xl text-lg tracking-wider border border-primary/20 shadow-inner">{ordem.numero_os}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => gerarImpressao("os")} className="h-11 rounded-xl font-semibold bg-background hover:bg-muted/80 border-border/60">
            <Printer className="h-4 w-4 mr-2" /> Imprimir OS
          </Button>
          <Button variant="outline" onClick={() => gerarImpressao("garantia")} className="h-11 rounded-xl font-semibold border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10">
            <ShieldCheck className="h-4 w-4 mr-2" /> Imprimir Garantia
          </Button>
          <Button variant="outline" onClick={() => gerarImpressao("estorno")} className="h-11 rounded-xl font-semibold border-red-500/30 text-red-600 bg-red-500/5 hover:bg-red-500/10">
            <Undo2 className="h-4 w-4 mr-2" /> Imprimir Estorno
          </Button>
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
            <div className="flex-1 max-h-[250px] overflow-auto scrollbar-thin">
              <Table><TableHeader className="bg-muted/20"><TableRow className="border-border/30"><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold py-3">Descrição</TableHead><TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold text-right py-3">Valor</TableHead><TableHead className="w-12 py-3"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {servicos.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Nenhum serviço.</TableCell></TableRow>)}
                  {servicos.map((s: any) => (
                    <TableRow key={s.id} className="border-border/20">
                      <TableCell className="font-medium text-sm text-foreground/90">{s.descricao}</TableCell>
                      <TableCell className="text-right font-mono text-primary font-bold">R$ {s.valor.toFixed(2)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeServicoMutation.mutate(s.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <div className="flex-1 max-h-[250px] overflow-auto scrollbar-thin">
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
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm"><CardContent className="p-6 space-y-6">
          <div className="grid gap-3">
            <Label className="text-sm font-bold flex items-center gap-2 text-foreground/90"><CheckCircle2 className="h-4 w-4 text-primary" /> Garantia e Qualidade</Label>
            <div className="flex flex-col gap-4">
              <RadioGroup value={editForm.garantia_servico} onValueChange={(v) => setEditForm({...editForm, garantia_servico: v})} className="flex flex-wrap gap-3">
                {Array.from(new Set(["Sem garantia", "90 dias", config?.garantia_padrao].filter(Boolean))).map((opcao, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-background/50 px-4 py-2.5 rounded-xl border border-border/60 hover:bg-muted/50 cursor-pointer"><RadioGroupItem value={opcao as string} id={`garantia-${idx}`} /><Label htmlFor={`garantia-${idx}`} className="cursor-pointer font-medium text-sm">{opcao}</Label></div>
                ))}
              </RadioGroup>
              <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/20">
                <Checkbox id="peca_original" checked={editForm.peca_original} onCheckedChange={(c) => setEditForm({...editForm, peca_original: c})} />
                <Label htmlFor="peca_original" className="cursor-pointer font-bold text-primary">Marcar como Peça Original</Label>
              </div>
            </div>
          </div>
          <div className="grid gap-2 pt-2">
            <Label className="text-sm font-bold text-foreground/90">Observações de Entrega Internas</Label>
            <Textarea value={editForm.observacoes} onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})} className="bg-background/50 rounded-xl border-border/60 min-h-[80px] resize-none" placeholder="Ex: Cliente deixou chip..." />
          </div>
        </CardContent></Card>

        <Card className="rounded-3xl border-none shadow-xl shadow-primary/5 bg-gradient-to-br from-primary/10 via-background to-background flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-bl-[100px] -z-0 blur-xl pointer-events-none"></div>
          <CardContent className="p-8 space-y-6 relative z-10 flex-1 flex flex-col justify-center">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-base"><span className="text-muted-foreground font-semibold">Mão de Obra</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-border/40 shadow-sm">R$ {(ordem.valor_servico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between items-center text-base"><span className="text-muted-foreground font-semibold">Peças</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-border/40 shadow-sm">R$ {(ordem.valor_pecas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              {ordem.desconto > 0 && (<div className="flex justify-between items-center text-base text-red-500 font-medium"><span>Desconto</span><span className="font-mono font-bold bg-background px-3 py-1 rounded-lg border border-red-200 shadow-sm">- R$ {Number(ordem.desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>)}
              <div className="border-t-2 border-primary/20 pt-4 flex justify-between items-end"><span className="font-black uppercase tracking-widest text-sm text-primary mb-1">Total da OS</span><span className="text-5xl font-black text-primary font-mono tracking-tighter drop-shadow-sm">R$ {ordem.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
            </div>
            
            <div className="grid gap-3 pt-4 mt-auto">
              <Label className="text-xs font-bold uppercase text-muted-foreground/80 tracking-widest ml-1">Status do Equipamento</Label>
              <Select value={editForm.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-14 text-base font-bold bg-background/80 backdrop-blur-md border border-border/60 shadow-sm rounded-2xl px-5"><SelectValue placeholder="Status" /></SelectTrigger>
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
              
            <Button 
                onClick={() => saveOsMutation.mutate({})} 
                disabled={saveOsMutation.isPending} 
                className="w-full h-14 mt-1 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
              >
                {saveOsMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                Salvar Atualizações
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden border-border/40 shadow-2xl">
          
          <div className="bg-primary/10 p-6 flex flex-col items-center justify-center border-b border-border/40 relative shrink-0">
            <div className="absolute top-4 right-4 bg-background/50 px-3 py-1 rounded-full text-xs font-bold border border-border/60">OS: {ordem.numero_os}</div>
            <DialogTitle className="text-2xl font-black mt-2">Finalizar Entrega</DialogTitle>
          </div>
          
          <div className="p-6 space-y-6 bg-background overflow-y-auto flex-1 scrollbar-thin">
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Forma de Pagamento</Label>
              <RadioGroup value={paymentData.metodo} onValueChange={(v) => setPaymentData({...paymentData, metodo: v})} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'pix', label: 'PIX', icon: QrCode },
                  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                  { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                  { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
                  { id: 'misto', label: 'Múltiplas', icon: PieChart },
                  { id: 'crediario', label: 'Crediário', icon: BookOpenCheck },
                ].map((metodo) => (
                  <div key={metodo.id} className="relative">
                    <RadioGroupItem value={metodo.id} id={metodo.id} className="peer sr-only" />
                    <Label htmlFor={metodo.id} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 border-border/50 bg-card hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-full text-center">
                      <metodo.icon className={cn("h-6 w-6", paymentData.metodo === metodo.id ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="font-semibold text-xs">{metodo.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* OPÇÕES DO CREDIÁRIO */}
            {paymentData.metodo === "crediario" && (
              <div className="grid gap-3 mt-1 bg-orange-500/10 p-3 rounded-xl border border-orange-500/20 shadow-inner animate-in slide-in-from-top-2">
                {!data?.ordem?.cliente_id ? (
                  <p className="text-[11px] text-red-500 font-bold flex items-center gap-1.5 p-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Esta OS não tem cliente vinculado para abrir Crediário.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Nº Parcelas</Label>
                        <Input 
                          type="number" min="1" max="24" 
                          value={parcelasCrediario} 
                          onChange={(e) => setParcelasCrediario(Number(e.target.value))} 
                          className="h-10 mt-1 text-xs font-mono bg-background border-orange-500/30 focus-visible:ring-orange-500" 
                        />
                      </div>
                      <div>
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">1º Vencimento</Label>
                        <Input 
                          type="date" 
                          value={dataVencimentoCrediario} 
                          onChange={(e) => setDataVencimentoCrediario(e.target.value)} 
                          className="h-10 mt-1 text-xs font-mono bg-background border-orange-500/30 focus-visible:ring-orange-500" 
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-orange-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor da parcela:</span>
                      <span className="text-sm font-mono font-black text-orange-600">
                        R$ {(valorFinalComDesconto / (parcelasCrediario || 1)).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Aplicar Desconto (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">R$</span>
                <Input type="number" min="0" step="0.01" value={paymentData.desconto || ""} onChange={(e) => setPaymentData({...paymentData, desconto: Number(e.target.value)})} className="h-12 pl-10 text-lg font-mono rounded-xl bg-card border-border/60 focus-visible:ring-primary" placeholder="0.00" />
              </div>
            </div>

            {/* TROCO SIMPLES - APENAS PIX OU DINHEIRO */}
            {(paymentData.metodo === "dinheiro" || paymentData.metodo === "pix") && (
              <div className="grid gap-2 mt-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Valor Recebido (Para Troco)</Label>
                <Input 
                  type="number" min="0" step="0.01" 
                  value={valorRecebido} 
                  onChange={(e) => setValorRecebido(e.target.value ? Number(e.target.value) : "")} 
                  className="h-10 rounded-xl bg-card border-border/60 font-mono text-sm shadow-inner focus-visible:ring-primary" 
                  placeholder={`R$ ${valorFinalComDesconto.toFixed(2)}`}
                />
                {Number(valorRecebido) > valorFinalComDesconto && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg mt-1 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600">Troco a devolver:</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">R$ {(Number(valorRecebido) - valorFinalComDesconto).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* PAGAMENTO MISTO */}
            {paymentData.metodo === "misto" && (
              <div className="grid grid-cols-2 gap-3 mt-1 bg-card p-4 rounded-xl border border-border/50 shadow-inner">
                <div><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Dinheiro</Label><Input type="number" min="0" step="0.01" value={pagamentoMisto.dinheiro || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, dinheiro: Number(e.target.value)})} className="h-10 mt-1 text-xs font-mono rounded-lg" placeholder="0.00" /></div>
                <div><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">PIX</Label><Input type="number" min="0" step="0.01" value={pagamentoMisto.pix || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, pix: Number(e.target.value)})} className="h-10 mt-1 text-xs font-mono rounded-lg" placeholder="0.00" /></div>
                <div><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Crédito</Label><Input type="number" min="0" step="0.01" value={pagamentoMisto.cartao_credito || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, cartao_credito: Number(e.target.value)})} className="h-10 mt-1 text-xs font-mono rounded-lg" placeholder="0.00" /></div>
                <div><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Débito</Label><Input type="number" min="0" step="0.01" value={pagamentoMisto.cartao_debito || ""} onChange={(e) => setPagamentoMisto({...pagamentoMisto, cartao_debito: Number(e.target.value)})} className="h-10 mt-1 text-xs font-mono rounded-lg" placeholder="0.00" /></div>
                
                <div className="col-span-2 flex justify-between items-center pt-3 mt-1 border-t border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {faltaMisto > 0.01 ? "Falta:" : faltaMisto < -0.01 ? "Troco:" : "Fechado:"}
                  </span>
                  <span className={cn("text-base font-mono font-black", faltaMisto > 0.01 ? "text-red-500" : "text-emerald-500")}>
                    R$ {Math.abs(faltaMisto).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 space-y-2 mt-2">
              <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal:</span><span className="font-mono">R$ {valorTotalSemDescontoConst.toFixed(2)}</span></div>
              {paymentData.desconto > 0 && (<div className="flex justify-between text-sm text-red-500 font-medium"><span>Desconto:</span><span className="font-mono">- R$ {paymentData.desconto.toFixed(2)}</span></div>)}
              <div className="flex justify-between items-end pt-2 border-t border-border/60"><span className="font-bold">Total a Pagar:</span><span className="text-3xl font-black text-primary font-mono tracking-tighter">R$ {valorFinalComDesconto.toFixed(2)}</span></div>
            </div>
          </div>
          
          <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 sm:justify-between flex-row shrink-0">
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleConfirmPayment} disabled={isConfirmarDisabled} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-6 disabled:opacity-50"><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Pagamento</Button>
          </DialogFooter>
          
        </DialogContent>
      </Dialog>
    </div>
  );
}