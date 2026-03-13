import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Construction } from "lucide-react";

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          "Vendas por Período",
          "Serviços Realizados",
          "Produtos Mais Vendidos",
          "Peças Mais Utilizadas",
          "Faturamento Mensal",
          "Estoque Atual",
        ].map((title) => (
          <Card key={title} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Construction className="h-3 w-3" /> Em breve — exportar PDF/CSV
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
