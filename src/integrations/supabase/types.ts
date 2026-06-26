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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          matricula: string
          nome: string
          school_id: string
          turma: string | null
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          matricula: string
          nome: string
          school_id: string
          turma?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          matricula?: string
          nome?: string
          school_id?: string
          turma?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos_ausentes: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          numero_chamada: number
          simulado_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string | null
          numero_chamada: number
          simulado_id: string
          turma_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          numero_chamada?: number
          simulado_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_ausentes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_ausentes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_assessments: {
        Row: {
          answer_sheet_pdf_path: string | null
          created_at: string
          exam_pdf_path: string | null
          gabarito_liberado: boolean
          grade: string
          id: string
          offer: string
          subject: string
          updated_at: string
        }
        Insert: {
          answer_sheet_pdf_path?: string | null
          created_at?: string
          exam_pdf_path?: string | null
          gabarito_liberado?: boolean
          grade: string
          id?: string
          offer: string
          subject: string
          updated_at?: string
        }
        Update: {
          answer_sheet_pdf_path?: string | null
          created_at?: string
          exam_pdf_path?: string | null
          gabarito_liberado?: boolean
          grade?: string
          id?: string
          offer?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          alternativa_e: string | null
          anulada: boolean
          created_at: string
          enunciado: string
          id: string
          numero: number
          ordem: number
          pontos: number
          resposta_correta: string
          simulado_id: string
          updated_at: string
        }
        Insert: {
          alternativa_a: string
          alternativa_b: string
          alternativa_c: string
          alternativa_d: string
          alternativa_e?: string | null
          anulada?: boolean
          created_at?: string
          enunciado: string
          id?: string
          numero: number
          ordem?: number
          pontos?: number
          resposta_correta: string
          simulado_id: string
          updated_at?: string
        }
        Update: {
          alternativa_a?: string
          alternativa_b?: string
          alternativa_c?: string
          alternativa_d?: string
          alternativa_e?: string | null
          anulada?: boolean
          created_at?: string
          enunciado?: string
          id?: string
          numero?: number
          ordem?: number
          pontos?: number
          resposta_correta?: string
          simulado_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_alunos: {
        Row: {
          aluno_id: string | null
          data_resposta: string
          id: string
          nome: string | null
          numero_chamada: number | null
          questao_id: string
          resposta_escolhida: string
          simulado_id: string
          turma_id: string | null
          usuario_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          data_resposta?: string
          id?: string
          nome?: string | null
          numero_chamada?: number | null
          questao_id: string
          resposta_escolhida: string
          simulado_id: string
          turma_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          data_resposta?: string
          id?: string
          nome?: string | null
          numero_chamada?: number | null
          questao_id?: string
          resposta_escolhida?: string
          simulado_id?: string
          turma_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_alunos_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_alunos_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes_sem_gabarito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_alunos_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_simulados: {
        Row: {
          acertos: number
          aluno_id: string | null
          created_at: string
          data_finalizacao: string
          id: string
          percentual: number
          pontuacao_obtida: number
          simulado_id: string
          total_questoes: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          acertos?: number
          aluno_id?: string | null
          created_at?: string
          data_finalizacao?: string
          id?: string
          percentual?: number
          pontuacao_obtida?: number
          simulado_id: string
          total_questoes?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          acertos?: number
          aluno_id?: string | null
          created_at?: string
          data_finalizacao?: string
          id?: string
          percentual?: number
          pontuacao_obtida?: number
          simulado_id?: string
          total_questoes?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resultados_simulados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_simulados_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          created_at: string
          id: string
          inep: string
          name: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          inep: string
          name: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          inep?: string
          name?: string
        }
        Relationships: []
      }
      student_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          school_id: string
          student_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          school_id: string
          student_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          school_id?: string
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      support_materials: {
        Row: {
          answer_key_pdf_path: string | null
          commented_test_pdf_path: string | null
          component: string | null
          created_at: string
          grade: string
          id: string
          offer: string
          support_material_url: string | null
          updated_at: string
        }
        Insert: {
          answer_key_pdf_path?: string | null
          commented_test_pdf_path?: string | null
          component?: string | null
          created_at?: string
          grade: string
          id?: string
          offer: string
          support_material_url?: string | null
          updated_at?: string
        }
        Update: {
          answer_key_pdf_path?: string | null
          commented_test_pdf_path?: string | null
          component?: string | null
          created_at?: string
          grade?: string
          id?: string
          offer?: string
          support_material_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      turmas: {
        Row: {
          ano: string
          created_at: string
          id: string
          matricula_atual: number | null
          matricula_sige: string | null
          nome: string
          school_id: string
          turno: Database["public"]["Enums"]["turno_turma"]
          updated_at: string
        }
        Insert: {
          ano: string
          created_at?: string
          id?: string
          matricula_atual?: number | null
          matricula_sige?: string | null
          nome: string
          school_id: string
          turno?: Database["public"]["Enums"]["turno_turma"]
          updated_at?: string
        }
        Update: {
          ano?: string
          created_at?: string
          id?: string
          matricula_atual?: number | null
          matricula_sige?: string | null
          nome?: string
          school_id?: string
          turno?: Database["public"]["Enums"]["turno_turma"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      questoes_sem_gabarito: {
        Row: {
          alternativa_a: string | null
          alternativa_b: string | null
          alternativa_c: string | null
          alternativa_d: string | null
          alternativa_e: string | null
          created_at: string | null
          enunciado: string | null
          id: string | null
          numero: number | null
          ordem: number | null
          pontos: number | null
          simulado_id: string | null
          updated_at: string | null
        }
        Insert: {
          alternativa_a?: string | null
          alternativa_b?: string | null
          alternativa_c?: string | null
          alternativa_d?: string | null
          alternativa_e?: string | null
          created_at?: string | null
          enunciado?: string | null
          id?: string | null
          numero?: number | null
          ordem?: number | null
          pontos?: number | null
          simulado_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alternativa_a?: string | null
          alternativa_b?: string | null
          alternativa_c?: string | null
          alternativa_d?: string | null
          alternativa_e?: string | null
          created_at?: string | null
          enunciado?: string | null
          id?: string | null
          numero?: number | null
          ordem?: number | null
          pontos?: number | null
          simulado_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_student_codes: {
        Args: { _quantity: number; _school_id: string }
        Returns: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          school_id: string
          student_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "student_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_school: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_student_code: {
        Args: { _code: string }
        Returns: {
          code: string
          school_id: string
          school_inep: string
          school_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "professor"
        | "aluno"
        | "professor_responsavel"
        | "gestor"
      turno_turma: "manha" | "tarde" | "noite" | "integral"
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
    Enums: {
      app_role: [
        "admin",
        "professor",
        "aluno",
        "professor_responsavel",
        "gestor",
      ],
      turno_turma: ["manha", "tarde", "noite", "integral"],
    },
  },
} as const
