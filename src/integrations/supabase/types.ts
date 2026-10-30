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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      investigation_messages: {
        Row: {
          client_id: string
          created_at: string
          id: string
          investigation_id: string
          parts: Json
          role: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          investigation_id: string
          parts: Json
          role: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          investigation_id?: string
          parts?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_messages_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          benefit: string | null
          created_at: string
          facts: Json
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          benefit?: string | null
          created_at?: string
          facts?: Json
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          benefit?: string | null
          created_at?: string
          facts?: Json
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_rule_versions: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_until: string | null
          executable_spec: Json | null
          id: string
          official_source_url: string
          reviewed_at: string | null
          reviewer_reference: string | null
          rule_key: string
          source_sha256: string | null
          status: string
          version: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          executable_spec?: Json | null
          id?: string
          official_source_url: string
          reviewed_at?: string | null
          reviewer_reference?: string | null
          rule_key: string
          source_sha256?: string | null
          status?: string
          version: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          executable_spec?: Json | null
          id?: string
          official_source_url?: string
          reviewed_at?: string | null
          reviewer_reference?: string | null
          rule_key?: string
          source_sha256?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      previdenciary_documents: {
        Row: {
          byte_size: number
          created_at: string
          delete_after: string | null
          deletion_state: string
          external_consent_at: string | null
          extracted_at: string | null
          extraction: Json | null
          extraction_version: string | null
          id: string
          investigation_id: string
          mime_type: string
          model: string | null
          original_name: string
          sha256: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          delete_after?: string | null
          deletion_state?: string
          external_consent_at?: string | null
          extracted_at?: string | null
          extraction?: Json | null
          extraction_version?: string | null
          id?: string
          investigation_id: string
          mime_type: string
          model?: string | null
          original_name: string
          sha256: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          delete_after?: string | null
          deletion_state?: string
          external_consent_at?: string | null
          extracted_at?: string | null
          extraction?: Json | null
          extraction_version?: string | null
          id?: string
          investigation_id?: string
          mime_type?: string
          model?: string | null
          original_name?: string
          sha256?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "previdenciary_documents_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      private_ai_usage: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          investigation_id: string | null
          model: string | null
          operation: string
          status: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          investigation_id?: string | null
          model?: string | null
          operation: string
          status?: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          investigation_id?: string | null
          model?: string | null
          operation?: string
          status?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_ai_usage_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "previdenciary_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_ai_usage_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      private_processing_preferences: {
        Row: {
          external_processing_approved: boolean
          retention_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          external_processing_approved?: boolean
          retention_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          external_processing_approved?: boolean
          retention_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reserve_private_ai_usage: {
        Args: {
          p_document?: string
          p_investigation: string
          p_operation?: string
        }
        Returns: string
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
