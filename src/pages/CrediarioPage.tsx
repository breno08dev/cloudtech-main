import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Wallet, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle, Banknote, Smartphone, CreditCard, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CrediarioPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Estados de Paginação e Filtro
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [filtroStatus, setFiltroStatus] = useState("pendente"); 

  // Estados dos Modais
  const [parcelaToPay, setParcelaToPay] = useState<any>(null);
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState("dinheiro");
  const [crediarioToDelete, setCrediarioToDelete] = useState<{id: string, cliente: string} | null>(null);
  
  // NOVO: Estado para a senha de exclusão
  const [senhaAdmin, setSenhaAdmin] = useState("");

  const { data: crediarios = [], isLoading } = useQuery({
    queryKey: ["crediarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crediarios")
        .select(`
          *,
          cliente:clientes(nome, telefone),
          parcelas:crediario_parcelas(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const crediariosFiltrados = crediarios.filter((c) => {
    const matchSearch = !search || c.cliente?.nome?.toLowerCase().includes(search.toLowerCase());
    
    let matchStatus = true;
    if (filtroStatus !== "todos") {
      if (search && filtroStatus === "pendente") {
        matchStatus = true;
      } else {
        matchStatus = c.status === filtroStatus;
      }
    }
    
    return matchSearch && matchStatus;
  });

  const totalItems = crediariosFiltrados.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedCrediarios = crediariosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pagarParcelaMutation = useMutation({
    mutationFn: async ({ parcela, formaPagamento }: { parcela: any, formaPagamento: string }) => {
      const { data: caixaAberto } = await supabase
        .from("caixas")
        .select("id")
        .eq("status", "aberto")
        .maybeSingle();

      const { error: errorParcela } = await supabase
        .from("crediario_parcelas")
        .update({
          status_pagamento: "pago",
          data_pagamento: new Date().toISOString(),
          forma_pagamento: formaPagamento
        })
        .eq("id", parcela.id);

      if (errorParcela) throw errorParcela;

      const nomeCliente = crediarios.find(c => c.id === parcela.crediario_id)?.cliente?.nome || "Cliente";
      const { error: errorMovimentacao } = await supabase
        .from("movimentacoes_caixa")
        .insert({
          caixa_id: caixaAberto?.id || null, 
          tipo: "entrada",
          categoria: "recebimento_crediario",
          valor: parcela.valor_parcela, 
          descricao: `Rec. Fiado: Parcela ${parcela.numero_parcela} - ${nomeCliente} (${formaPagamento.toUpperCase()})`,
          origem_id: parcela.crediario_id
        });

      if (errorMovimentacao) throw errorMovimentacao;

      const { data: todasParcelas } = await supabase
        .from("crediario_parcelas")
        .select("status_pagamento")
        .eq("crediario_id", parcela.crediario_id);

      const todasPagas = todasParcelas?.every(p => p.status_pagamento === "pago");
      if (todasPagas) {
        await supabase.from("crediarios").update({ status: "quitado" }).eq("id", parcela.crediario_id);
      }

      return parcela.crediario_id;
    },
    onSuccess: () => {
      toast.success("Parcela recebida e registrada no financeiro!");
      setParcelaToPay(null); 
      queryClient.invalidateQueries({ queryKey: ["crediarios"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics_v2"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_caixa"] }); 
      queryClient.invalidateQueries({ queryKey: ["relatorios_financeiros_v2"] }); 
    },
    onError: (err: any) => {
      toast.error("Erro ao receber parcela: " + err.message);
    },
  });

  const excluirCrediarioMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crediarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dívida apagada com sucesso!");
      setCrediarioToDelete(null);
      setSenhaAdmin(""); // Limpa a senha
      queryClient.invalidateQueries({ queryKey: ["crediarios"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir dívida: " + err.message);
    },
  });

  const handlePagarClick = (parcela: any) => {
    setParcelaToPay(parcela);
    setFormaPagamentoSelecionada("dinheiro");
  };

  const confirmarPagamento = () => {
    if (!parcelaToPay) return;
    pagarParcelaMutation.mutate({ parcela: parcelaToPay, formaPagamento: formaPagamentoSelecionada });
  };

  const handleExcluirDivida = () => {
    if (senhaAdmin !== "911723") {
      toast.error("Senha incorreta!", { description: "Você não tem permissão para realizar esta ação." });
      return;
    }
    if (crediarioToDelete) {
      excluirCrediarioMutation.mutate(crediarioToDelete.id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-500">
      
      {/* Modal de Pagamento */}
      <Dialog open={!!parcelaToPay} onOpenChange={(open) => !open && setParcelaToPay(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-border/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-center mb-1">Receber Parcela</DialogTitle>
            <p className="text-center text-sm font-medium text-muted-foreground">
              Parcela {parcelaToPay?.numero_parcela} • Vencimento: {parcelaToPay?.data_vencimento ? new Date(parcelaToPay.data_vencimento + 'T12:00:00').toLocaleDateString("pt-BR") : ''}
            </p>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center justify-center gap-2 text-center bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4">
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">Valor a Receber</p>
            <p className="text-4xl font-black text-emerald-600 font-mono tracking-tighter">
              R$ {Number(parcelaToPay?.valor_parcela || 0).toFixed(2)}
            </p>
          </div>

          <div className="grid gap-2 mb-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Forma de Pagamento</Label>
            <Select value={formaPagamentoSelecionada} onValueChange={setFormaPagamentoSelecionada}>
              <SelectTrigger className="h-12 rounded-xl bg-background border-border/60 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="dinheiro" className="text-sm"><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" /> Dinheiro</div></SelectItem>
                <SelectItem value="pix" className="text-sm"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-teal-500" /> PIX</div></SelectItem>
                <SelectItem value="cartao_credito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-indigo-500" /> Cartão de Crédito</div></SelectItem>
                <SelectItem value="cartao_debito" className="text-sm"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-orange-500" /> Cartão de Débito</div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setParcelaToPay(null)} className="rounded-xl font-bold h-12 sm:w-1/2">
              Cancelar
            </Button>
            <Button 
              onClick={confirmarPagamento} 
              disabled={pagarParcelaMutation.isPending} 
              className="rounded-xl font-bold h-12 bg-primary hover:bg-primary/90 shadow-md sm:w-1/2"
            >
              {pagarParcelaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Crediário com Senha */}
      <Dialog open={!!crediarioToDelete} onOpenChange={(open) => {
        if (!open) {
          setCrediarioToDelete(null);
          setSenhaAdmin(""); // Limpa a senha ao fechar o modal
        }
      }}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] p-6 text-center border-red-500/20 shadow-2xl">
          <div className="mx-auto bg-red-500/10 p-4 rounded-full w-fit mb-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <DialogTitle className="text-2xl font-black mb-2 text-foreground">Excluir Dívida</DialogTitle>
          <p className="text-sm text-muted-foreground font-medium mb-4 px-2">
            Tem certeza que deseja apagar a dívida de <strong className="text-foreground">{crediarioToDelete?.cliente}</strong>? Esta ação apagará todas as parcelas pendentes e não poderá ser desfeita.
          </p>
          
          <div className="grid gap-2 mb-6 text-left">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1 text-center">Senha de Segurança</Label>
            <Input 
              type="password" 
              placeholder="Digite a senha..." 
              value={senhaAdmin} 
              onChange={(e) => setSenhaAdmin(e.target.value)} 
              className="h-12 rounded-xl bg-background border-red-500/30 focus-visible:ring-red-500 text-center tracking-widest text-lg font-mono shadow-inner"
              autoFocus
            />
          </div>

          <Button 
            onClick={handleExcluirDivida} 
            disabled={excluirCrediarioMutation.isPending || !senhaAdmin} 
            variant="destructive" 
            className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
          >
            {excluirCrediarioMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
            Sim, Excluir Dívida
          </Button>
          <Button variant="ghost" onClick={() => { setCrediarioToDelete(null); setSenhaAdmin(""); }} className="w-full mt-2 font-bold rounded-xl h-11 hover:bg-muted/80">Cancelar</Button>
        </DialogContent>
      </Dialog>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border/40 p-6 rounded-[2rem] backdrop-blur-xl shadow-sm shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            Gestão de Crediário
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 ml-1">Controle os pagamentos a prazo e fiados dos seus clientes.</p>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtro */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Buscar por nome do cliente..." 
            className="pl-12 h-14 text-base rounded-2xl bg-card/60 border-border/50 focus-visible:ring-primary backdrop-blur-md transition-all shadow-sm w-full font-medium" 
            value={search} 
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1); 
            }} 
          />
        </div>
        
        <Select 
          value={filtroStatus} 
          onValueChange={(v) => { 
            setFiltroStatus(v); 
            setCurrentPage(1); 
          }}
        >
          <SelectTrigger className="h-14 w-full sm:w-[200px] rounded-2xl bg-card/60 border-border/50 shadow-sm font-bold">
            <SelectValue placeholder="Filtro" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="pendente">Apenas Pendentes</SelectItem>
            <SelectItem value="quitado">Apenas Quitados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="rounded-[2rem] border-border/40 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background/80 border-b border-border/40">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black py-5 pl-6">Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black">Data da Dívida</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-center">Status Geral</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right">Valor Total</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/80 font-black text-right pr-6">Parcelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : paginatedCrediarios.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground font-bold">Nenhum crediário encontrado.</TableCell></TableRow>
                ) : (
                  paginatedCrediarios.map((cred) => {
                    const isExpanded = expandedId === cred.id;
                    const parcelas: any[] = (cred.parcelas || []).sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
                    const todasPagas = parcelas.every(p => p.status_pagamento === 'pago');

                    return (
                      <React.Fragment key={cred.id}>
                        {/* Linha Principal */}
                        <TableRow className={cn("hover:bg-background/80 transition-all cursor-pointer", isExpanded && "bg-muted/30")} onClick={() => toggleExpand(cred.id)}>
                          <TableCell className="font-bold text-sm pl-6 py-4">
                            {cred.cliente?.nome}
                            <div className="text-xs text-muted-foreground font-normal">{cred.cliente?.telefone || "Sem telefone"}</div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{new Date(cred.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-center">
                            {todasPagas ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                                <CheckCircle className="h-3 w-3" /> Quitado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                                <Clock className="h-3 w-3" /> Pendente
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-black">R$ {Number(cred.valor_total).toFixed(2)}</TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={(e) => { e.stopPropagation(); toggleExpand(cred.id); }}>
                              Ver Detalhes {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Linha Expandida (Parcelas) */}
                        {isExpanded && (
                          <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-2 border-border/50">
                            <TableCell colSpan={5} className="p-0">
                              <div className="p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                  <h4 className="text-sm font-black uppercase text-muted-foreground">Cronograma de Parcelas</h4>
                                  
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive h-8 text-xs font-bold"
                                    onClick={() => setCrediarioToDelete({ id: cred.id, cliente: cred.cliente?.nome })}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Dívida
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {parcelas.map((p) => {
                                    const isPago = p.status_pagamento === "pago";
                                    const isAtrasada = !isPago && new Date(p.data_vencimento) < new Date(new Date().setHours(0,0,0,0));

                                    return (
                                      <div key={p.id} className={cn("p-4 rounded-xl border flex flex-col gap-3 transition-all", isPago ? "bg-emerald-500/5 border-emerald-500/20" : isAtrasada ? "bg-red-500/5 border-red-500/30" : "bg-background border-border/60 shadow-sm")}>
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Parcela {p.numero_parcela}</span>
                                            <p className="font-mono text-lg font-black mt-0.5">R$ {Number(p.valor_parcela).toFixed(2)}</p>
                                          </div>
                                          {isPago ? (
                                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                                          ) : isAtrasada ? (
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                          ) : (
                                            <Clock className="h-5 w-5 text-orange-400" />
                                          )}
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-auto border-t border-border/40 pt-3">
                                          <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Vencimento</span>
                                            <span className={cn("text-xs font-bold", isAtrasada && !isPago ? "text-red-500" : "text-foreground")}>
                                              {new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString("pt-BR")}
                                            </span>
                                          </div>
                                          
                                          {!isPago ? (
                                            <Button 
                                              size="sm" 
                                              className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 px-4 shadow-sm"
                                              onClick={() => handlePagarClick(p)}
                                            >
                                              Receber
                                            </Button>
                                          ) : (
                                            <div className="flex flex-col text-right">
                                              <span className="text-[10px] text-emerald-600 uppercase font-bold">Pago em ({p.forma_pagamento?.toUpperCase() || 'N/A'})</span>
                                              <span className="text-xs font-bold text-emerald-600">
                                                {new Date(p.data_pagamento).toLocaleDateString("pt-BR")}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* BARRA DE PAGINAÇÃO */}
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-sm shrink-0">
              <span className="text-muted-foreground font-medium hidden sm:inline-block ml-2">
                A mostrar <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-bold text-foreground">{totalItems}</span> registos
              </span>
              <div className="flex items-center gap-2 ml-auto sm:ml-0 mr-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 rounded-xl font-bold bg-background">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-xs font-bold px-3 text-muted-foreground">Pág. {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-9 rounded-xl font-bold bg-background">
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}