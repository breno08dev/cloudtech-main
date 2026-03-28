import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; 
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react"; 
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  const [rememberMe, setRememberMe] = useState(true); 
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Erro ao fazer login. Verifique as suas credenciais.");
      } else {
        toast.success("Login realizado com sucesso!");
        onLogin();
        navigate("/vendas");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      toast.error("Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // IMPORTANTE: Adicionámos a classe "dark" e "text-foreground" aqui 
    // para forçar a tela a ficar sempre no tema escuro premium!
    <main className="dark min-h-screen w-full flex items-center justify-center bg-background text-foreground relative overflow-hidden font-sans">
      
      {/* Padrão de fundo abstrato (Premium Touch) */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none print:hidden">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotted-pattern" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotted-pattern)" />
        </svg>
      </div>

      {/* Gradiente de fundo suave para profundidade */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md mx-4 z-10 border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        
        <CardHeader className="flex flex-col items-center justify-center pt-10 pb-6 space-y-4">
          {/* Logo da Empresa */}
          <img 
            src="/conectnewlogo.png" 
            alt="Conect New Logo" 
            className="h-32 w-auto object-contain drop-shadow-lg brightness-110"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<span class="font-black text-2xl text-primary uppercase tracking-widest">Conect New</span>');
            }}
          />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Acessar Conta</h1>
            <p className="text-sm text-muted-foreground">Gestão de Assistência Técnica</p>
          </div>
        </CardHeader>

        <CardContent className="p-8 pt-2">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Campo E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/90 ml-1">E-mail</Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@provedor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 h-12 bg-background/50 border-border/60 rounded-xl focus-visible:ring-primary focus-visible:border-primary transition-all text-base"
                />
              </div>
            </div>

            {/* Campo Senha com Olhinho */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/90">Senha</Label>
                
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 pr-11 h-12 bg-background/50 border-border/60 rounded-xl focus-visible:ring-primary focus-visible:border-primary transition-all text-base"
                />
                {/* Botão do Olhinho */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1} 
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Ficar Logado */}
            <div className="flex items-center justify-between space-x-2 pt-1 ml-1">
              <div className="flex items-center space-x-2.5">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary h-5 w-5 rounded-md"
                />
                <Label htmlFor="remember" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                  Manter-me conectado
                </Label>
              </div>
            </div>

            {/* Botão de Login (Premium Gradient/Hover) */}
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold transition-all duration-300 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98] cursor-pointer" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default LoginPage;