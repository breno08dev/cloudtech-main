export const OS_STATUS_MAP: Record<string, { label: string; class: string }> = {
  recebido: { label: "Recebido", class: "status-badge-received" },
  em_analise: { label: "Em Análise", class: "status-badge-analysis" },
  aguardando_peca: { label: "Aguardando Peça", class: "status-badge-waiting" },
  em_manutencao: { label: "Em Manutenção", class: "status-badge-maintenance" },
  pronto: { label: "Pronto", class: "status-badge-ready" },
  entregue: { label: "Entregue", class: "status-badge-delivered" },
  cancelado: { label: "Cancelado", class: "status-badge-canceled" },
};

export const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
];
