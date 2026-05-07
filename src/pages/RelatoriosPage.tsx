import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, TrendingUp, DollarSign, Wrench, ShoppingCart, Loader2, Calendar, Printer, Smartphone, Banknote, CreditCard, BookOpenCheck, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Periodo = "7d" | "30d" | "ano" | "custom";

const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [dataInicioCustom, setDataInicioCustom] = useState<string>(getTodayString());
  const [dataFimCustom, setDataFimCustom] = useState<string>(getTodayString());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["relatorios_financeiros_v3", periodo, dataInicioCustom, dataFimCustom],
    queryFn: async () => {
      let dataInicio = new Date();
      let dataFim = new Date(); 
      dataFim.setHours(23, 59, 59, 999);
      
      if (periodo === "7d") {
        dataInicio.setDate(dataInicio.getDate() - 7);
      } else if (periodo === "30d") {
        dataInicio.setDate(dataInicio.getDate() - 30);
      } else if (periodo === "ano") {
        dataInicio.setFullYear(dataInicio.getFullYear() - 1);
      } else if (periodo === "custom") {
        if (dataInicioCustom) {
          const [ano, mes, dia] = dataInicioCustom.split('-');
          dataInicio = new Date(Number(ano), Number(mes) - 1, Number(dia), 0, 0, 0);
        }
        if (dataFimCustom) {
          const [ano, mes, dia] = dataFimCustom.split('-');
          dataFim = new Date(Number(ano), Number(mes) - 1, Number(dia), 23, 59, 59, 999);
        }
      }

      const isoInicio = dataInicio.toISOString();
      const isoFim = dataFim.toISOString();

      // 1. Busca de Vendas
      const { data: vendas, error: errVendas } = await (supabase as any)
        .from("vendas")
        .select("id, valor_total, created_at, forma_pagamento, observacoes, desconto")
        .gte("created_at", isoInicio)
        .lte("created_at", isoFim)
        .order("created_at", { ascending: false });
      if (errVendas) throw errVendas;

      const vendasIds = vendas?.map((v: any) => v.id).filter(Boolean) || [];
      let itensMapeados: any[] = [];
      
      // 2. Busca Segura dos Itens e Produtos
      if (vendasIds.length > 0) {
        const { data: itens, error: errItens } = await (supabase as any)
          .from("venda_itens")
          .select("*")
          .in("venda_id", vendasIds);
          
        if (!errItens && itens) {
          const produtoIds = [...new Set(itens.map((i: any) => i.produto_id).filter(Boolean))];
          const mapProdutos = new Map();
          
          if (produtoIds.length > 0) {
            const { data: p1 } = await (supabase as any).from("produto_base").select("*").in("id", produtoIds);
            p1?.forEach((p: any) => mapProdutos.set(p.id, { 
              nome: p.nome, 
              codigo_barras: p.codigo_barras_base || p.codigo_barras_especifico || p.codigo_barras || '-' 
            }));
            
            const { data: p2 } = await (supabase as any).from("produto_variacoes").select("*").in("id", produtoIds);
            
            const parentIds = p2?.map((v: any) => v.produto_id || v.produto_base_id || v.base_id).filter(Boolean) || [];
            let parentProds: any[] = [];
            
            if (parentIds.length > 0) {
              const { data: pParents } = await (supabase as any).from("produto_base").select("*").in("id", parentIds);
              parentProds = pParents || [];
            }
            const mapParents = new Map();
            parentProds.forEach((p: any) => mapParents.set(p.id, p));

            p2?.forEach((v: any) => {
              const parentId = v.produto_id || v.produto_base_id || v.base_id;
              const parent = mapParents.get(parentId);
              
              const nomeFinal = v.nome && v.nome !== 'Única' && v.nome !== 'Padrão'
                ? `${parent?.nome || ''} - ${v.nome}`.trim() 
                : (parent?.nome || v.nome || 'Produto Não Identificado');
              
              const codigoBarrasFinal = v.codigo_barras_especifico || v.codigo_barras_base || v.codigo_barras || parent?.codigo_barras_base || parent?.codigo_barras || '-';
              
              mapProdutos.set(v.id, {
                nome: nomeFinal.startsWith('- ') ? nomeFinal.substring(2) : nomeFinal,
                codigo_barras: codigoBarrasFinal
              });
            });
          }

          const mapaVendas = new Map();
          vendas?.forEach((v: any) => mapaVendas.set(v.id, v));

          itensMapeados = itens.map((item: any) => {
            const prod = mapProdutos.get(item.produto_id) || {};
            const vendaVinculada = mapaVendas.get(item.venda_id) || {};
            
            const descontoConvertido = Number(vendaVinculada.desconto) || Number(vendaVinculada.valor_desconto) || 0;
            const valorConvertido = Number(item.valor_total) || Number(item.valor) || Number(item.preco_unitario) || Number(item.subtotal) || 0;

            return {
              id: item.id || Math.random().toString(),
              data: vendaVinculada.created_at,
              codigo_barras: prod.codigo_barras || '-',
              produto: prod.nome || 'Produto Não Identificado',
              quantidade: item.quantidade || 1,
              desconto: descontoConvertido,
              valor: valorConvertido,
            };
          }).sort((a: any, b: any) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
        }
      }

    const { data: ordens, error: errOrdens } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, valor_total, data_finalizacao, status, forma_pagamento")
        .eq("status", "entregue")
        .gte("data_finalizacao", isoInicio)
        .lte("data_finalizacao", isoFim);

      if (errOrdens) throw errOrdens;

      const { data: parcelasPagas, error: errParcelas } = await supabase
        .from("crediario_parcelas")
        .select("valor_parcela, data_pagamento, forma_pagamento")
        .eq("status_pagamento", "pago")
        .gte("data_pagamento", isoInicio)
        .lte("data_pagamento", isoFim);
      if (errParcelas) throw errParcelas;

      const { data: sangrias, error: errSangrias } = await (supabase as any)
        .from("sangrias")
        .select("id, valor, created_at, observacao")
        .gte("created_at", isoInicio)
        .lte("created_at", isoFim);
      if (errSangrias) console.error("Erro ao buscar sangrias:", errSangrias);

      let totalVendas = 0, totalGravacoes = 0, totalOrdens = 0, totalCrediarioRecebido = 0, totalSangrias = 0;
      let qtdVendas = 0, qtdGravacoes = 0, qtdOrdens = 0, qtdParcelas = 0, qtdSangrias = 0;
      let totalPix = 0, totalDinheiro = 0, totalCredito = 0, totalDebito = 0;

      const historicoGeral = [
        ...(vendas || []).map((v: any) => ({
          id: v.id,
          created_at: v.created_at,
          forma_pagamento: v.forma_pagamento,
          observacoes: v.observacoes,
          valor_total: v.valor_total,
          tipo: 'venda'
        })),
        ...(ordens || []).map((o: any) => ({
          id: o.id,
          created_at: o.data_finalizacao,
          forma_pagamento: o.forma_pagamento,
          observacoes: o.numero_os ? `OS #${o.numero_os}` : 'Ordem de Serviço',
          valor_total: o.valor_total,
          tipo: 'os'
        })),
        ...(sangrias || []).map((s: any) => ({
          id: s.id || Math.random().toString(),
          created_at: s.created_at,
          forma_pagamento: 'sangria',
          observacoes: s.observacao,
          valor_total: s.valor,
          tipo: 'sangria'
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      sangrias?.forEach((s: any) => {
        totalSangrias += Number(s.valor || 0);
        qtdSangrias++;
      });

      const processarPagamento = (forma: string, valorTotal: number) => {
        if (!forma) return;
        const f = forma.toLowerCase();
        if (f === 'pix') totalPix += valorTotal;
        else if (f === 'dinheiro') totalDinheiro += valorTotal;
        else if (f === 'cartao_credito' || f === 'credito') totalCredito += valorTotal;
        else if (f === 'cartao_debito' || f === 'debito') totalDebito += valorTotal;
        else if (f.includes('misto')) {
          const dinMatch = forma.match(/Din R\$([0-9.]+)/);
          if (dinMatch) totalDinheiro += parseFloat(dinMatch[1]);
          const pixMatch = forma.match(/PIX R\$([0-9.]+)/);
          if (pixMatch) totalPix += parseFloat(pixMatch[1]);
          const credMatch = forma.match(/Créd R\$([0-9.]+)/);
          if (credMatch) totalCredito += parseFloat(credMatch[1]);
          const debMatch = forma.match(/Déb R\$([0-9.]+)/);
          if (debMatch) totalDebito += parseFloat(debMatch[1]);
        } else {
          totalDinheiro += valorTotal;
        }
      };

      const historicoMap = new Map<string, { data: string; pdv: number; os: number; total: number }>();
      const difMeses = (dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const agruparPorMes = periodo === "ano" || difMeses > 3;

      const formatador = agruparPorMes 
        ? new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
        : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

      const iterador = new Date(dataInicio);
      while (iterador <= dataFim) {
        const chave = formatador.format(iterador);
        if (!historicoMap.has(chave)) historicoMap.set(chave, { data: chave, pdv: 0, os: 0, total: 0 });
        if (agruparPorMes) iterador.setMonth(iterador.getMonth() + 1);
        else iterador.setDate(iterador.getDate() + 1);
      }

      vendas?.forEach((v: any) => {
        if (v.forma_pagamento === 'crediario') return;
        if (v.observacoes === "Gravação de Copos") {
          totalGravacoes += Number(v.valor_total);
          qtdGravacoes++;
        } else {
          totalVendas += Number(v.valor_total);
          qtdVendas++;
        }
        processarPagamento(v.forma_pagamento, Number(v.valor_total));
        const chave = formatador.format(new Date(v.created_at));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.pdv += Number(v.valor_total);
          historicoMap.get(chave)!.total += Number(v.valor_total);
        }
      });

      ordens?.forEach(o => {
        if (o.forma_pagamento === 'crediario' || !o.data_finalizacao) return;
        totalOrdens += Number(o.valor_total);
        qtdOrdens++;
        processarPagamento(o.forma_pagamento, Number(o.valor_total));
        const chave = formatador.format(new Date(o.data_finalizacao));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.os += Number(o.valor_total);
          historicoMap.get(chave)!.total += Number(o.valor_total);
        }
      });

      parcelasPagas?.forEach(p => {
        if (!p.data_pagamento) return;
        totalCrediarioRecebido += Number(p.valor_parcela);
        qtdParcelas++;
        processarPagamento(p.forma_pagamento, Number(p.valor_parcela));
        const chave = formatador.format(new Date(p.data_pagamento));
        if (historicoMap.has(chave)) {
          historicoMap.get(chave)!.total += Number(p.valor_parcela);
        }
      });

      const faturamentoTotal = totalVendas + totalGravacoes + totalOrdens + totalCrediarioRecebido;
      const ticketMedio = (qtdVendas + qtdGravacoes + qtdOrdens + qtdParcelas) > 0 ? faturamentoTotal / (qtdVendas + qtdGravacoes + qtdOrdens + qtdParcelas) : 0;

      return {
        kpis: {
          faturamentoTotal, ticketMedio, totalVendas, totalOrdens, totalCrediarioRecebido, totalGravacoes, totalSangrias,
          qtdVendas, qtdOrdens, qtdParcelas, qtdGravacoes, qtdSangrias
        },
        pagamentos: {
          pix: totalPix, dinheiro: totalDinheiro, credito: totalCredito, debito: totalDebito
        },
        graficoEvolucao: Array.from(historicoMap.values()),
        graficoDistribuicao: [
          { name: "Vendas", value: totalVendas, color: "hsl(var(--chart-1))" },
          { name: "OS", value: totalOrdens, color: "hsl(var(--chart-2))" },
          { name: "Crediário", value: totalCrediarioRecebido, color: "#f97316" },
          { name: "Gravação", value: totalGravacoes, color: "#ec4899" },
        ],
        listaVendas: historicoGeral,
        listaItens: itensMapeados
      };
    }
  });

  const { 
    kpis = { faturamentoTotal: 0, ticketMedio: 0, totalVendas: 0, totalOrdens: 0, totalCrediarioRecebido: 0, totalGravacoes: 0, totalSangrias: 0, qtdVendas: 0, qtdOrdens: 0, qtdParcelas: 0, qtdGravacoes: 0, qtdSangrias: 0 }, 
    pagamentos = { pix: 0, dinheiro: 0, credito: 0, debito: 0 },
    graficoEvolucao = [], 
    graficoDistribuicao = [],
    listaVendas = [],
    listaItens = []
  } = data || {};

  const formatarDataBR = (dataString: string) => {
    if (!dataString) return "";
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const periodoTexto = periodo === 'custom' 
    ? `${formatarDataBR(dataInicioCustom)} até ${formatarDataBR(dataFimCustom)}` 
    : periodo === 'ano' ? 'Últimos 12 meses' : periodo === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias';

  const handlePrint = (mode: 'vendas' | 'produtos') => {
    const linhasVendas = listaVendas.map((venda: any) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; border-right: 1px solid #ddd; border-left: 1px solid #ddd;">${new Date(venda.created_at).toLocaleString('pt-BR')}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; text-transform: capitalize; ${venda.tipo === 'sangria' ? 'color: red; font-weight: bold;' : ''}">
          ${venda.tipo === 'sangria' ? 'Sangria' : (venda.forma_pagamento ? venda.forma_pagamento.replace('_', ' ') : '-')}
        </td>
        <td style="padding: 8px; border-right: 1px solid #ddd;">${venda.observacoes || '-'}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; text-align: right; font-weight: bold; ${venda.tipo === 'sangria' ? 'color: red;' : ''}">
          ${venda.tipo === 'sangria' ? '- ' : ''}R$ ${Number(venda.valor_total || 0).toFixed(2)}
        </td>
      </tr>
    `).join('') || `<tr><td colspan="4" style="padding: 15px; text-align: center; border: 1px solid #ddd;">Nenhum registo encontrado no período.</td></tr>`;

    const linhasProdutos = listaItens.map((item: any) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; border-right: 1px solid #ddd; border-left: 1px solid #ddd; white-space: nowrap;">${item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; color: #555; font-family: monospace;">${item.codigo_barras}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; font-weight: bold;">${item.produto}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; text-align: center;">${item.quantidade}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; text-align: right; color: #555;">R$ ${Number(item.desconto || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-right: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${Number(item.valor || 0).toFixed(2)}</td>
      </tr>
    `).join('') || `<tr><td colspan="6" style="padding: 15px; text-align: center; border: 1px solid #ddd;">Nenhum produto vendido encontrado no período.</td></tr>`;

    const conteudoVendas = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Faturamento Total</div>
          <div style="font-size: 16px; font-weight: 900; color: #047857;">R$ ${Number(kpis.faturamentoTotal || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Sangrias / Saídas</div>
          <div style="font-size: 14px; font-weight: bold; color: #dc2626;">R$ ${Number(kpis.totalSangrias || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Vendas (À Vista)</div>
          <div style="font-size: 14px; font-weight: bold; color: #000;">R$ ${Number(kpis.totalVendas || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">OS (À Vista)</div>
          <div style="font-size: 14px; font-weight: bold; color: #000;">R$ ${Number(kpis.totalOrdens || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Crediário Recebido</div>
          <div style="font-size: 14px; font-weight: bold; color: #000;">R$ ${Number(kpis.totalCrediarioRecebido || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 120px;">
          <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Gravação</div>
          <div style="font-size: 14px; font-weight: bold; color: #000;">R$ ${Number(kpis.totalGravacoes || 0).toFixed(2)}</div>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 900; margin-bottom: 10px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px;">Formas de Pagamento (Entradas)</h3>
      <div style="display: flex; gap: 10px; margin-bottom: 25px;">
        <div style="flex: 1; background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase;">PIX</div>
          <div style="font-size: 16px; font-weight: 900; color: #000;">R$ ${Number(pagamentos.pix || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Dinheiro</div>
          <div style="font-size: 16px; font-weight: 900; color: #000;">R$ ${Number(pagamentos.dinheiro || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Cartão Crédito</div>
          <div style="font-size: 16px; font-weight: 900; color: #000;">R$ ${Number(pagamentos.credito || 0).toFixed(2)}</div>
        </div>
        <div style="flex: 1; background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Cartão Débito</div>
          <div style="font-size: 16px; font-weight: 900; color: #000;">R$ ${Number(pagamentos.debito || 0).toFixed(2)}</div>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 900; margin-bottom: 10px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px;">Histórico de Movimentações</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="background-color: #e5e7eb; color: #1f2937;">
            <th style="padding: 8px; border: 1px solid #d1d5db;">Data / Hora</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Pagamento</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Observações</th>
            <th style="padding: 8px; border: 1px solid #d1d5db; text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>${linhasVendas}</tbody>
      </table>
    `;

    const conteudoProdutos = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-top: 15px;">
        <thead>
          <tr style="background-color: #e5e7eb; color: #1f2937;">
            <th style="padding: 8px; border: 1px solid #d1d5db;">Data</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Cód. Barras</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Produto</th>
            <th style="padding: 8px; border: 1px solid #d1d5db; text-align: center;">Qtd</th>
            <th style="padding: 8px; border: 1px solid #d1d5db; text-align: right;">Desconto</th>
            <th style="padding: 8px; border: 1px solid #d1d5db; text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>${linhasProdutos}</tbody>
      </table>
    `;

    const htmlFinal = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório</title>
        <style>@page { margin: 15mm; size: A4 portrait; } body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; }</style>
      </head>
      <body>
        <div style="margin-bottom: 20px; border-bottom: 2px solid #1f2937; padding-bottom: 10px;">
          <h1 style="font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0;">
            ${mode === 'vendas' ? 'Relatório de Vendas e Recebimentos' : 'Relatório de Produtos Vendidos'}
          </h1>
          <p style="color: #4b5563; font-weight: bold; margin: 5px 0 0 0;">Período: ${periodoTexto}</p>
        </div>
        ${mode === 'vendas' ? conteudoVendas : conteudoProdutos}
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(htmlFinal); doc.close();
      setTimeout(() => { 
        iframe.contentWindow?.focus(); 
        iframe.contentWindow?.print(); 
        setTimeout(() => { document.body.removeChild(iframe); }, 2000); 
      }, 500);
    }
  };

  if (isError) {
    return <div className="flex justify-center items-center h-[50vh] text-destructive">Erro ao carregar relatórios financeiros.</div>;
  }

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            Inteligência Financeira
          </h1>
          <p className="text-muted-foreground mt-1 ml-1 font-medium">Acompanhe o faturamento real e a divisão dos seus recebimentos.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex items-center gap-2 mr-2 mb-1 sm:mb-0">
            <Button onClick={() => handlePrint('vendas')} variant="outline" className="h-12 rounded-xl font-bold border-primary/20 hover:bg-primary/10 text-primary">
              <Printer className="w-4 h-4 mr-2" /> Vendas
            </Button>
            <Button onClick={() => handlePrint('produtos')} variant="outline" className="h-12 rounded-xl font-bold border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-500">
              <Printer className="w-4 h-4 mr-2" /> Produtos
            </Button>
          </div>

          {periodo === "custom" && (
            <div className="flex items-center gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Data Inicial</Label>
                <Input 
                  type="date" 
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-medium"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Data Final</Label>
                <Input 
                  type="date" 
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-medium"
                />
              </div>
            </div>
          )}

          <div className="w-full sm:w-48">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1 mb-1.5 block">Período de Análise</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-12 rounded-xl bg-background border-border/60 shadow-sm font-bold text-sm">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="7d" className="font-medium">Últimos 7 dias</SelectItem>
                <SelectItem value="30d" className="font-medium">Últimos 30 dias</SelectItem>
                <SelectItem value="ano" className="font-medium">Últimos 12 meses</SelectItem>
                <SelectItem value="custom" className="font-bold text-primary">Personalizado...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 lg:grid-cols-3 gap-4">
            <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-primary-foreground/80 font-bold text-xs uppercase tracking-wider">Receita Líquida Real</p>
                    <p className="text-3xl font-black tracking-tight font-mono">R$ {Number(kpis.faturamentoTotal || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-primary-foreground/20 p-2.5 rounded-2xl"><DollarSign className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Ticket Médio</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.ticketMedio || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-primary/10 p-2.5 rounded-2xl"><TrendingUp className="h-6 w-6 text-primary" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">OS (À Vista)</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalOrdens || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdOrdens || 0} ordens</p>
                  </div>
                  <div className="bg-amber-500/10 p-2.5 rounded-2xl"><Wrench className="h-6 w-6 text-amber-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">Vendas (À Vista)</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalVendas || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdVendas || 0} vendas</p>
                  </div>
                  <div className="bg-emerald-500/10 p-2.5 rounded-2xl"><ShoppingCart className="h-6 w-6 text-emerald-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">Fiado Recebido</p>
                    <p className="text-2xl font-black tracking-tight text-foreground font-mono">R$ {Number(kpis.totalCrediarioRecebido || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdParcelas || 0} parcelas</p>
                  </div>
                  <div className="bg-orange-500/10 p-2.5 rounded-2xl"><BookOpenCheck className="h-6 w-6 text-orange-500" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-red-500/20 shadow-sm hover:shadow-md transition-shadow bg-red-500/5 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-red-500 font-bold text-[11px] uppercase tracking-wider">Sangrias / Saídas</p>
                    <p className="text-2xl font-black tracking-tight text-red-500 font-mono">R$ {Number(kpis.totalSangrias || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md w-fit">{kpis.qtdSangrias || 0} retiradas</p>
                  </div>
                  <div className="bg-red-500/10 p-2.5 rounded-2xl"><ArrowDownCircle className="h-6 w-6 text-red-500" /></div>
                </div>
              </CardContent>
            </Card>

          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground mb-3 ml-2 flex items-center gap-2">
              Detalhamento de Recebimentos
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-3xl border-teal-500/20 shadow-sm bg-gradient-to-br from-card to-teal-500/5 hover:border-teal-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-teal-600 font-bold text-[10px] uppercase tracking-widest">PIX</p>
                    <div className="bg-teal-500/10 p-2 rounded-xl"><Smartphone className="h-4 w-4 text-teal-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.pix || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-emerald-500/20 shadow-sm bg-gradient-to-br from-card to-emerald-500/5 hover:border-emerald-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest">Dinheiro</p>
                    <div className="bg-emerald-500/10 p-2 rounded-xl"><Banknote className="h-4 w-4 text-emerald-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.dinheiro || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-indigo-500/20 shadow-sm bg-gradient-to-br from-card to-indigo-500/5 hover:border-indigo-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest">Crédito</p>
                    <div className="bg-indigo-500/10 p-2 rounded-xl"><CreditCard className="h-4 w-4 text-indigo-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.credito || 0).toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-orange-500/20 shadow-sm bg-gradient-to-br from-card to-orange-500/5 hover:border-orange-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-orange-600 font-bold text-[10px] uppercase tracking-widest">Débito</p>
                    <div className="bg-orange-500/10 p-2 rounded-xl"><CreditCard className="h-4 w-4 text-orange-600" /></div>
                  </div>
                  <p className="text-xl font-black tracking-tight text-foreground font-mono">R$ {Number(pagamentos.debito || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-black">Evolução de Entradas (Caixa)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-6">
                <div className="h-[300px] min-h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={300}>
                    <AreaChart data={graficoEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} tickFormatter={(value) => `R$${value}`} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Entrada R$"]}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col">
              <CardHeader className="border-b border-border/30 pb-4 px-6 pt-6">
                <CardTitle className="text-lg font-black">Origem das Receitas</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center items-center">
                {kpis.faturamentoTotal === 0 ? (
                  <div className="text-center text-muted-foreground space-y-2">
                    <BarChart3 className="h-12 w-12 mx-auto opacity-20" />
                    <p className="font-bold">Sem faturamento no período</p>
                  </div>
                ) : (
                  <div className="h-[250px] min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={250}>
                      <PieChart>
                        <Pie data={graficoDistribuicao.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={8}>
                          {graficoDistribuicao.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}