export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
     clientes: {
  Row: {
    id: string
    nome: string
    telefone: string | null
    whatsapp: string | null
    cpf_cnpj: string | null
    tipo_cliente: string
    observacoes: string | null
    created_at: string
    // ADICIONE A LINHA ABAIXO:
    data_aniversario: string | null
  }
  Insert: {
    id?: string
    nome: string
    telefone?: string | null
    whatsapp?: string | null
    cpf_cnpj?: string | null
    tipo_cliente?: string
    observacoes?: string | null
    created_at?: string
    // ADICIONE A LINHA ABAIXO:
    data_aniversario?: string | null
  }
  Update: {
    id?: string
    nome?: string
    telefone?: string | null
    whatsapp?: string | null
    cpf_cnpj?: string | null
    tipo_cliente?: string
    observacoes?: string | null
    created_at?: string
    // ADICIONE A LINHA ABAIXO:
    data_aniversario?: string | null
  }
  Relationships: []
}

      configuracoes: {
        Row: {
          id: string
          nome_empresa: string
          logo_url: string | null
          telefone: string | null
          endereco: string | null
          mensagem_padrao_os: string | null
          garantia_padrao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome_empresa?: string
          logo_url?: string | null
          telefone?: string | null
          endereco?: string | null
          mensagem_padrao_os?: string | null
          garantia_padrao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome_empresa?: string
          logo_url?: string | null
          telefone?: string | null
          endereco?: string | null
          mensagem_padrao_os?: string | null
          garantia_padrao?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crediarios: {
        Row: {
          id: string
          cliente_id: string
          venda_id: string | null
          ordem_servico_id: string | null
          valor_total: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          venda_id?: string | null
          ordem_servico_id?: string | null
          valor_total: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          venda_id?: string | null
          ordem_servico_id?: string | null
          valor_total?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crediarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crediarios_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crediarios_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          }
        ]
      }
      crediario_parcelas: {
        Row: {
          id: string
          crediario_id: string
          numero_parcela: number
          valor_parcela: number
          data_vencimento: string
          status_pagamento: string
          data_pagamento: string | null
          forma_pagamento: string | null
          created_at: string
        }
        Insert: {
          id?: string
          crediario_id: string
          numero_parcela: number
          valor_parcela: number
          data_vencimento: string
          status_pagamento?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          crediario_id?: string
          numero_parcela?: number
          valor_parcela?: number
          data_vencimento?: string
          status_pagamento?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crediario_parcelas_crediario_id_fkey"
            columns: ["crediario_id"]
            isOneToOne: false
            referencedRelation: "crediarios"
            referencedColumns: ["id"]
          }
        ]
      }
      produto_base: {
        Row: {
          id: string
          nome: string
          categoria: string | null
          marca: string | null
          descricao: string | null
          codigo_barras_base: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          categoria?: string | null
          marca?: string | null
          descricao?: string | null
          codigo_barras_base?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          categoria?: string | null
          marca?: string | null
          descricao?: string | null
          codigo_barras_base?: string | null
          created_at?: string
        }
        Relationships: []
      }
      produto_variacoes: {
        Row: {
          id: string
          produto_id: string
          qualidade: string
          com_aro: boolean | null
          preco_custo: number
          preco_venda: number
          preco_lojista: number
          estoque: number
          estoque_minimo: number
          codigo_barras_especifico: string | null
          created_at: string
        }
        Insert: {
          id?: string
          produto_id: string
          qualidade: string
          com_aro?: boolean | null
          preco_custo?: number
          preco_venda?: number
          preco_lojista?: number
          estoque?: number
          estoque_minimo?: number
          codigo_barras_especifico?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          produto_id?: string
          qualidade?: string
          com_aro?: boolean | null
          preco_custo?: number
          preco_venda?: number
          preco_lojista?: number
          estoque?: number
          estoque_minimo?: number
          codigo_barras_especifico?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_variacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto_base"
            referencedColumns: ["id"]
          }
        ]
      }
      caixas: {
        Row: {
          id: string
          data_abertura: string
          data_fechamento: string | null
          saldo_inicial: number
          saldo_final_dinheiro: number | null
          status: string
          observacoes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          data_abertura?: string
          data_fechamento?: string | null
          saldo_inicial?: number
          saldo_final_dinheiro?: number | null
          status?: string
          observacoes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          data_abertura?: string
          data_fechamento?: string | null
          saldo_inicial?: number
          saldo_final_dinheiro?: number | null
          status?: string
          observacoes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      movimentacoes_caixa: {
        Row: {
          id: string
          caixa_id: string | null
          tipo: string
          categoria: string
          valor: number
          descricao: string | null
          origem_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          caixa_id?: string | null
          tipo: string
          categoria: string
          valor: number
          descricao?: string | null
          origem_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          caixa_id?: string | null
          tipo?: string
          categoria?: string
          valor?: number
          descricao?: string | null
          origem_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          }
        ]
      }
      custos_empresa: {
        Row: {
          id: string
          descricao: string
          valor: number
          tipo: string
          vencimento: string | null
          pago: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          descricao: string
          valor: number
          tipo: string
          vencimento?: string | null
          pago?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          descricao?: string
          valor?: number
          tipo?: string
          vencimento?: string | null
          pago?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          id: string
          numero_os: string
          cliente_id: string | null
          marca_aparelho: string | null
          modelo_aparelho: string | null
          imei: string | null
          senha_aparelho: string | null
          problema_relatado: string | null
          diagnostico: string | null
          status: string
          valor_servico: number
          valor_pecas: number
          valor_total: number
          desconto: number | null
          forma_pagamento: string | null
          garantia_servico: string | null
          peca_original: boolean | null
          checklist_tela_quebrada: boolean | null
          checklist_nao_liga: boolean | null
          checklist_molhado: boolean | null
          checklist_bateria_ruim: boolean | null
          checklist_camera_quebrada: boolean | null
          checklist_outros: string | null
          data_previsao: string | null
          data_finalizacao: string | null
          observacoes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          numero_os: string
          cliente_id?: string | null
          marca_aparelho?: string | null
          modelo_aparelho?: string | null
          imei?: string | null
          senha_aparelho?: string | null
          problema_relatado?: string | null
          diagnostico?: string | null
          status?: string
          valor_servico?: number
          valor_pecas?: number
          valor_total?: number
          desconto?: number | null
          forma_pagamento?: string | null
          garantia_servico?: string | null
          peca_original?: boolean | null
          checklist_tela_quebrada?: boolean | null
          checklist_nao_liga?: boolean | null
          checklist_molhado?: boolean | null
          checklist_bateria_ruim?: boolean | null
          checklist_camera_quebrada?: boolean | null
          checklist_outros?: string | null
          data_previsao?: string | null
          data_finalizacao?: string | null
          observacoes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          numero_os?: string
          cliente_id?: string | null
          marca_aparelho?: string | null
          modelo_aparelho?: string | null
          imei?: string | null
          senha_aparelho?: string | null
          problema_relatado?: string | null
          diagnostico?: string | null
          status?: string
          valor_servico?: number
          valor_pecas?: number
          valor_total?: number
          desconto?: number | null
          forma_pagamento?: string | null
          garantia_servico?: string | null
          peca_original?: boolean | null
          checklist_tela_quebrada?: boolean | null
          checklist_nao_liga?: boolean | null
          checklist_molhado?: boolean | null
          checklist_bateria_ruim?: boolean | null
          checklist_camera_quebrada?: boolean | null
          checklist_outros?: string | null
          data_previsao?: string | null
          data_finalizacao?: string | null
          observacoes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }
      ordem_servico_pecas: {
        Row: {
          id: string
          ordem_servico_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          ordem_servico_id: string
          produto_id: string
          quantidade?: number
          preco_unitario?: number
          subtotal?: number
          created_at?: string
        }
        Update: {
          id?: string
          ordem_servico_id?: string
          produto_id?: string
          quantidade?: number
          preco_unitario?: number
          subtotal?: number
          created_at?: string
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
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id"]
          }
        ]
      }
      ordem_servico_servicos: {
        Row: {
          id: string
          ordem_servico_id: string
          descricao: string
          valor: number
          created_at: string
        }
        Insert: {
          id?: string
          ordem_servico_id: string
          descricao: string
          valor?: number
          created_at?: string
        }
        Update: {
          id?: string
          ordem_servico_id?: string
          descricao?: string
          valor?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_servicos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          }
        ]
      }
      ordem_servico_fotos: {
        Row: {
          id: string
          ordem_servico_id: string
          foto_url: string
          descricao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ordem_servico_id: string
          foto_url: string
          descricao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ordem_servico_id?: string
          foto_url?: string
          descricao?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_fotos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          }
        ]
      }
      vendas: {
        Row: {
          id: string
          cliente_id: string | null
          valor_total: number
          desconto: number | null
          forma_pagamento: string
          created_at: string
          observacoes: string | null
        }
        Insert: {
          id?: string
          cliente_id?: string | null
          valor_total?: number
          desconto?: number | null
          forma_pagamento?: string
          created_at?: string
          observacoes: string | null
        }
        Update: {
          id?: string
          cliente_id?: string | null
          valor_total?: number
          desconto?: number | null
          forma_pagamento?: string
          created_at?: string
          observacoes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }

      sangrias: {
        Row: {
          id: string
          valor: number
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          valor: number
          observacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          valor?: number
          observacao?: string | null
          created_at?: string
        }
        Relationships: []
      }

      venda_itens: {
        Row: {
          id: string
          venda_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          venda_id: string
          produto_id: string
          quantidade?: number
          preco_unitario?: number
          subtotal?: number
          created_at?: string
        }
        Update: {
          id?: string
          venda_id?: string
          produto_id?: string
          quantidade?: number
          preco_unitario?: number
          subtotal?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          }
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