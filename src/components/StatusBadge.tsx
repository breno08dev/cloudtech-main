import { OS_STATUS_MAP } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = OS_STATUS_MAP[status] || { label: status, class: "" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.class}`}>
      {config.label}
    </span>
  );
}
