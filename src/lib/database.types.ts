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
      blocks: {
        Row: {
          actual_minutes: number | null
          created_at: string
          done: boolean
          end_at: string
          id: string
          item_id: string | null
          locked: boolean
          origin: string
          reason: string | null
          start_at: string
          title: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          created_at?: string
          done?: boolean
          end_at: string
          id?: string
          item_id?: string | null
          locked?: boolean
          origin?: string
          reason?: string | null
          start_at: string
          title: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          created_at?: string
          done?: boolean
          end_at?: string
          id?: string
          item_id?: string | null
          locked?: boolean
          origin?: string
          reason?: string | null
          start_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_defaults: {
        Row: {
          course: string
          default_minutes: number
          sample_count: number
          user_id: string
        }
        Insert: {
          course: string
          default_minutes: number
          sample_count?: number
          user_id: string
        }
        Update: {
          course?: string
          default_minutes?: number
          sample_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_defaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          end_at: string
          external_id: string
          id: string
          location: string | null
          source_id: string
          start_at: string
          title: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          end_at: string
          external_id: string
          id?: string
          location?: string | null
          source_id: string
          start_at: string
          title: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          end_at?: string
          external_id?: string
          id?: string
          location?: string | null
          source_id?: string
          start_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          date: string
          done: boolean
          habit_id: string
          user_id: string
        }
        Insert: {
          date: string
          done?: boolean
          habit_id: string
          user_id: string
        }
        Update: {
          date?: string
          done?: boolean
          habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          cadence: string
          color: string
          days_json: Json | null
          id: string
          name: string
          target_per_week: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          cadence: string
          color: string
          days_json?: Json | null
          id?: string
          name: string
          target_per_week: number
          user_id: string
        }
        Update: {
          archived?: boolean
          cadence?: string
          color?: string
          days_json?: Json | null
          id?: string
          name?: string
          target_per_week?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          actual_minutes: number | null
          completed_at: string | null
          course: string | null
          created_at: string
          description: string | null
          due_at: string | null
          est_minutes: number | null
          external_id: string | null
          id: string
          is_project: boolean
          last_seen_at: string | null
          origin: string
          parent_id: string | null
          priority: string
          remaining_minutes: number | null
          source_id: string | null
          status: string
          step_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          completed_at?: string | null
          course?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          est_minutes?: number | null
          external_id?: string | null
          id?: string
          is_project?: boolean
          last_seen_at?: string | null
          origin?: string
          parent_id?: string | null
          priority?: string
          remaining_minutes?: number | null
          source_id?: string | null
          status?: string
          step_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          completed_at?: string | null
          course?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          est_minutes?: number | null
          external_id?: string | null
          id?: string
          is_project?: boolean
          last_seen_at?: string | null
          origin?: string
          parent_id?: string | null
          priority?: string
          remaining_minutes?: number | null
          source_id?: string | null
          status?: string
          step_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_runs: {
        Row: {
          blocks_written: number
          plan_date: string
          ran_at: string
          rejections_json: Json
          user_id: string
        }
        Insert: {
          blocks_written?: number
          plan_date: string
          ran_at?: string
          rejections_json?: Json
          user_id: string
        }
        Update: {
          blocks_written?: number
          plan_date?: string
          ran_at?: string
          rejections_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          enabled: boolean
          id: string
          kind: string
          label: string
          last_error: string | null
          last_synced_at: string | null
          url_secret: string | null
          user_id: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          kind: string
          label: string
          last_error?: string | null
          last_synced_at?: string | null
          url_secret?: string | null
          user_id: string
        }
        Update: {
          enabled?: boolean
          id?: string
          kind?: string
          label?: string
          last_error?: string | null
          last_synced_at?: string | null
          url_secret?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string
          id: string
          planner_prefs_json: Json | null
          timezone: string
          working_hours_json: Json | null
        }
        Insert: {
          email: string
          id: string
          planner_prefs_json?: Json | null
          timezone?: string
          working_hours_json?: Json | null
        }
        Update: {
          email?: string
          id?: string
          planner_prefs_json?: Json | null
          timezone?: string
          working_hours_json?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_block_work: {
        Args: {
          block_id: string
          work_minutes: number
        }
        Returns: undefined
      }
      reorder_project_steps: {
        Args: {
          ordered_step_ids: string[]
          project_id_arg: string
        }
        Returns: undefined
      }
      replace_ai_plan: {
        Args: {
          new_blocks: Json
          replaceable_block_ids: string[]
          run_rows: Json
          target_user_id: string
        }
        Returns: number
      }
      replace_ai_project_steps: {
        Args: {
          new_steps: Json
          replaceable_step_ids: string[]
          target_project_id: string
          target_user_id: string
        }
        Returns: number
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
