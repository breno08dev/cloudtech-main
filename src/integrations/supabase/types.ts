export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo_cliente: string
          whatsapp: string | null
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo_cliente?: string
          whatsapp?: string | null
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_cliente?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          created_at: string
          endereco: string | null
          garantia_padrao: string | null
          id: string
          logo_url: string | null
          mensagem_padrao_os: string | null
          nome_empresa: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          garantia_padrao?: string | null
          id?: string
          logo_url?: string | null
          mensagem_padrao_os?: string | null
          nome_empresa?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          garantia_padrao?: string | null
          id?: string
          logo_url?: string | null
          mensagem_padrao_os?: string | null
          nome_empresa?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ordem_servico_fotos: {
        Row: {
          created_at: string
          descricao: string | null
          foto_url: string
          id: string
          ordem_servico_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          foto_url: string
          id?: string
          ordem_servico_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          foto_url?: string
          id?: string
          ordem_servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_fotos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_servico_pecas: {
        Row: {
          created_at: string
          id: string
          ordem_servico_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          ordem_servico_id: string
          preco_unitario?: number
          produto_id: string
          quantidade?: number
          subtotal?: number
        }
        Update: {
          created_at?: string
          id?: string
          ordem_servico_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_pecas_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_servico_pecas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_servico_servicos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem_servico_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          ordem_servico_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem_servico_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_servicos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          checklist_bateria_ruim: boolean | null
          checklist_camera_quebrada: boolean | null
          checklist_molhado: boolean | null
          checklist_nao_liga: boolean | null
          checklist_outros: string | null
          checklist_tela_quebrada: boolean | null
          cliente_id: string | null
          created_at: string
          data_finalizacao: string | null
          data_previsao: string | null
          diagnostico: string | null
          id: string
          imei: string | null
          marca_aparelho: string | null
          modelo_aparelho: string | null
          numero_os: string
          observacoes: string | null
          problema_relatado: string | null
          senha_aparelho: string | null
          status: string
          valor_pecas: number
          valor_servico: number
          valor_total: number
        }
        Insert: {
          checklist_bateria_ruim?: boolean | null
          checklist_camera_quebrada?: boolean | null
          checklist_molhado?: boolean | null
          checklist_nao_liga?: boolean | null
          checklist_outros?: string | null
          checklist_tela_quebrada?: boolean | null
          cliente_id?: string | null
          created_at?: string
          data_finalizacao?: string | null
          data_previsao?: string | null
          diagnostico?: string | null
          id?: string
          imei?: string | null
          marca_aparelho?: string | null
          modelo_aparelho?: string | null
          numero_os: string
          observacoes?: string | null
          problema_relatado?: string | null
          senha_aparelho?: string | null
          status?: string
          valor_pecas?: number
          valor_servico?: number
          valor_total?: number
        }
        Update: {
          checklist_bateria_ruim?: boolean | null
          checklist_camera_quebrada?: boolean | null
          checklist_molhado?: boolean | null
          checklist_nao_liga?: boolean | null
          checklist_outros?: string | null
          checklist_tela_quebrada?: boolean | null
          cliente_id?: string | null
          created_at?: string
          data_finalizacao?: string | null
          data_previsao?: string | null
          diagnostico?: string | null
          id?: string
          imei?: string | null
          marca_aparelho?: string | null
          modelo_aparelho?: string | null
          numero_os?: string
          observacoes?: string | null
          problema_relatado?: string | null
          senha_aparelho?: string | null
          status?: string
          valor_pecas?: number
          valor_servico?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          created_at: string
          estoque: number
          estoque_minimo: number
          id: string
          marca: string | null
          modelo_compativel: string | null
          nome: string
          preco_custo: number
          preco_lojista: number
          preco_venda: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          estoque?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          modelo_compativel?: string | null
          nome: string
          preco_custo?: number
          preco_lojista?: number
          preco_venda?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          estoque?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          modelo_compativel?: string | null
          nome?: string
          preco_custo?: number
          preco_lojista?: number
          preco_venda?: number
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          created_at: string
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preco_unitario?: number
          produto_id: string
          quantidade?: number
          subtotal?: number
          venda_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string | null
          created_at: string
          forma_pagamento: string
          id: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          forma_pagamento?: string
          id?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          forma_pagamento?: string
          id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
