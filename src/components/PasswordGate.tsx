import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  // Ao removermos o sessionStorage, a variável começa SEMPRE como false
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "911723") {
      setIsAuthenticated(true);
      toast.success("Acesso autorizado!");
    } else {
      toast.error("Senha incorreta!");
      setPassword("");
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
      <Card className="w-full max-w-sm shadow-xl rounded-[2rem] border-border/50 bg-card/60 backdrop-blur-xl">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2 border border-primary/20">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-black">Acesso Restrito</CardTitle>
          <CardDescription className="font-medium">
            Por favor, insira a senha para aceder a esta sessão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Input 
  type="password" 
  placeholder="Digite a senha de administrador..." 
  value={password} 
  onChange={(e) => setPassword(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
       // chame a sua função de validar a senha aqui (ex: handleUnlock())
    }
  }}
  autoComplete="new-password"   // <-- Isso engana o Chrome
  name="admin_gate_key"         // <-- Tira o nome padrão de "password"
  id="admin_gate_key"
  data-lpignore="true"          // <-- Ignora LastPass e outros gerenciadores
  className="h-12 rounded-xl border-border/60 text-center text-lg tracking-widest shadow-sm focus-visible:ring-primary"
/>
            </div>
            <Button type="submit" className="w-full h-14 rounded-xl font-bold text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              Desbloquear Acesso
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}