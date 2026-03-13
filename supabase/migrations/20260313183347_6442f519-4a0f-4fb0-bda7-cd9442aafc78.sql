
-- Configurações da empresa
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa TEXT NOT NULL DEFAULT 'Minha Assistência',
  logo_url TEXT,
  telefone TEXT,
  endereco TEXT,
  mensagem_padrao_os TEXT DEFAULT 'Garantia de 90 dias para o serviço realizado.',
  garantia_padrao TEXT DEFAULT '90 dias',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  cpf_cnpj TEXT,
  tipo_cliente TEXT NOT NULL DEFAULT 'cliente' CHECK (tipo_cliente IN ('cliente', 'lojista')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  modelo_compativel TEXT,
  preco_custo NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_lojista NUMERIC(10,2) NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  marca_aparelho TEXT,
  modelo_aparelho TEXT,
  imei TEXT,
  senha_aparelho TEXT,
  problema_relatado TEXT,
  diagnostico TEXT,
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido','em_analise','aguardando_peca','em_manutencao','pronto','entregue','cancelado')),
  valor_servico NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_pecas NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  checklist_tela_quebrada BOOLEAN DEFAULT false,
  checklist_nao_liga BOOLEAN DEFAULT false,
  checklist_molhado BOOLEAN DEFAULT false,
  checklist_bateria_ruim BOOLEAN DEFAULT false,
  checklist_camera_quebrada BOOLEAN DEFAULT false,
  checklist_outros TEXT,
  data_previsao TIMESTAMPTZ,
  data_finalizacao TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Peças da OS
CREATE TABLE public.ordem_servico_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Serviços da OS
CREATE TABLE public.ordem_servico_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fotos da OS
CREATE TABLE public.ordem_servico_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendas
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens da venda
CREATE TABLE public.venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico_pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users have full access (single admin user)
CREATE POLICY "Authenticated full access" ON public.configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ordens_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ordem_servico_pecas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ordem_servico_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ordem_servico_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.venda_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for OS photos and company logo
INSERT INTO storage.buckets (id, name, public) VALUES ('os-photos', 'os-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Storage policies
CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('os-photos', 'company-assets'));
CREATE POLICY "Public read" ON storage.objects FOR SELECT TO public USING (bucket_id IN ('os-photos', 'company-assets'));
CREATE POLICY "Authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('os-photos', 'company-assets'));

-- Insert default config row
INSERT INTO public.configuracoes (nome_empresa) VALUES ('Minha Assistência Técnica');

-- Function to generate OS number
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_os IS NULL OR NEW.numero_os = '' THEN
    NEW.numero_os := 'OS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_generate_os_number
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_os_number();
