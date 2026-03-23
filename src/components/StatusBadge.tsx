import { OS_STATUS_MAP } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Pega o rótulo do status no nosso mapa de constantes
  const config = OS_STATUS_MAP[status] || { label: status };
  
  // Variável para guardar as classes de cor de cada status
  let colorClass = "bg-primary/10 text-primary border-primary/20"; // Cor padrão (Azul)

  // O uso das strings completas aqui impede o Tailwind de "apagar" as cores no build
  const s = status.toLowerCase();
  
  if (s.includes("recebido")) {
    colorClass = "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30";
  } else if (s.includes("analise") || s.includes("análise")) {
    colorClass = "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30";
  } else if (s.includes("aguardando")) {
    colorClass = "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  } else if (s.includes("manutencao") || s.includes("manutenção")) {
    colorClass = "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30";
  } else if (s.includes("pronto")) {
    colorClass = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
  } else if (s.includes("entregue")) {
    colorClass = "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
  } else if (s.includes("cancelad")) {
    colorClass = "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border shadow-sm ${colorClass}`}>
      {/* Bolinha colorida (usa a cor do texto atual herdada pelo 'bg-current') */}
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80"></span>
      {config.label}
    </span>
  );
}