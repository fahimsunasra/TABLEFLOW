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
      customers: {
        Row: {
          birthday: string | null
          email: string | null
          full_name: string
          id: string
          lifetime_spend: number
          loyalty_points: number
          loyalty_tier: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          tags_array: string[]
          total_visits: number
        }
        Insert: {
          birthday?: string | null
          email?: string | null
          full_name: string
          id?: string
          lifetime_spend?: number
          loyalty_points?: number
          loyalty_tier?: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          tags_array?: string[]
          total_visits?: number
        }
        Update: {
          birthday?: string | null
          email?: string | null
          full_name?: string
          id?: string
          lifetime_spend?: number
          loyalty_points?: number
          loyalty_tier?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          tags_array?: string[]
          total_visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rewards: {
        Row: {
          customer_phone: string | null
          discount_code: string | null
          expires_at: string | null
          game_type: string
          id: string
          is_redeemed: boolean
          restaurant_id: string
          reward_title: string
        }
        Insert: {
          customer_phone?: string | null
          discount_code?: string | null
          expires_at?: string | null
          game_type: string
          id?: string
          is_redeemed?: boolean
          restaurant_id: string
          reward_title: string
        }
        Update: {
          customer_phone?: string | null
          discount_code?: string | null
          expires_at?: string | null
          game_type?: string
          id?: string
          is_redeemed?: boolean
          restaurant_id?: string
          reward_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rewards_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens_array: string[]
          category_id: string | null
          description: string | null
          dietary_tags_array: string[]
          id: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          modifiers_json: Json
          name: string
          prep_time_mins: number
          price: number
          restaurant_id: string
          station: Database["public"]["Enums"]["kitchen_station"]
        }
        Insert: {
          allergens_array?: string[]
          category_id?: string | null
          description?: string | null
          dietary_tags_array?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          modifiers_json?: Json
          name: string
          prep_time_mins?: number
          price?: number
          restaurant_id: string
          station?: Database["public"]["Enums"]["kitchen_station"]
        }
        Update: {
          allergens_array?: string[]
          category_id?: string | null
          description?: string | null
          dietary_tags_array?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          modifiers_json?: Json
          name?: string
          prep_time_mins?: number
          price?: number
          restaurant_id?: string
          station?: Database["public"]["Enums"]["kitchen_station"]
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_status: Database["public"]["Enums"]["item_status"]
          menu_item_id: string | null
          modifiers_selected_json: Json
          name: string
          order_id: string
          quantity: number
          restaurant_id: string
          special_instructions: string | null
          station: Database["public"]["Enums"]["kitchen_station"]
          unit_price: number
        }
        Insert: {
          id?: string
          item_status?: Database["public"]["Enums"]["item_status"]
          menu_item_id?: string | null
          modifiers_selected_json?: Json
          name?: string
          order_id: string
          quantity?: number
          restaurant_id: string
          special_instructions?: string | null
          station?: Database["public"]["Enums"]["kitchen_station"]
          unit_price?: number
        }
        Update: {
          id?: string
          item_status?: Database["public"]["Enums"]["item_status"]
          menu_item_id?: string | null
          modifiers_selected_json?: Json
          name?: string
          order_id?: string
          quantity?: number
          restaurant_id?: string
          special_instructions?: string | null
          station?: Database["public"]["Enums"]["kitchen_station"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_notes: string | null
          discount_amount: number
          id: string
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          reservation_id: string | null
          restaurant_id: string
          scheduled_fire_at: string | null
          service_charge: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax_amount: number
          tip_amount: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_notes?: string | null
          discount_amount?: number
          id?: string
          order_number: number
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_id?: string | null
          restaurant_id: string
          scheduled_fire_at?: string | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          tip_amount?: number
          total_amount?: number
        }
        Update: {
          created_at?: string
          customer_notes?: string | null
          discount_amount?: number
          id?: string
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_id?: string | null
          restaurant_id?: string
          scheduled_fire_at?: string | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_amount?: number
          tip_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string | null
          discount_value: number
          id: string
          is_active: boolean
          is_qr_exclusive: boolean
          min_order_amount: number
          promo_type: Database["public"]["Enums"]["promo_type"]
          restaurant_id: string
          title: string
          usage_count: number
        }
        Insert: {
          code?: string | null
          discount_value?: number
          id?: string
          is_active?: boolean
          is_qr_exclusive?: boolean
          min_order_amount?: number
          promo_type?: Database["public"]["Enums"]["promo_type"]
          restaurant_id: string
          title: string
          usage_count?: number
        }
        Update: {
          code?: string | null
          discount_value?: number
          id?: string
          is_active?: boolean
          is_qr_exclusive?: boolean
          min_order_amount?: number
          promo_type?: Database["public"]["Enums"]["promo_type"]
          restaurant_id?: string
          title?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          arrival_time: string
          booking_date: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deposit_paid: boolean
          dietary_notes: string | null
          eta_time: string | null
          id: string
          party_size: number
          restaurant_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          table_id: string | null
        }
        Insert: {
          arrival_time: string
          booking_date: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_paid?: boolean
          dietary_notes?: string | null
          eta_time?: string | null
          id?: string
          party_size?: number
          restaurant_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          table_id?: string | null
        }
        Update: {
          arrival_time?: string
          booking_date?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_paid?: boolean
          dietary_notes?: string | null
          eta_time?: string | null
          id?: string
          party_size?: number
          restaurant_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          id: string
          logo_url: string | null
          name: string
          service_charge_pct: number
          settings_json: Json
          slug: string
          stripe_account_id: string | null
          subscription_tier: string
          tax_rate: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          service_charge_pct?: number
          settings_json?: Json
          slug: string
          stripe_account_id?: string | null
          subscription_tier?: string
          tax_rate?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          service_charge_pct?: number
          settings_json?: Json
          slug?: string
          stripe_account_id?: string | null
          subscription_tier?: string
          tax_rate?: number
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          pin_code: string | null
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          pin_code?: string | null
          restaurant_id: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          pin_code?: string | null
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          id: string
          pos_x: number
          pos_y: number
          qr_code_token: string
          restaurant_id: string
          shape: Database["public"]["Enums"]["table_shape"]
          status: Database["public"]["Enums"]["table_status"]
          table_number: string
          zone: Database["public"]["Enums"]["table_zone"]
        }
        Insert: {
          capacity?: number
          id?: string
          pos_x?: number
          pos_y?: number
          qr_code_token?: string
          restaurant_id: string
          shape?: Database["public"]["Enums"]["table_shape"]
          status?: Database["public"]["Enums"]["table_status"]
          table_number: string
          zone?: Database["public"]["Enums"]["table_zone"]
        }
        Update: {
          capacity?: number
          id?: string
          pos_x?: number
          pos_y?: number
          qr_code_token?: string
          restaurant_id?: string
          shape?: Database["public"]["Enums"]["table_shape"]
          status?: Database["public"]["Enums"]["table_status"]
          table_number?: string
          zone?: Database["public"]["Enums"]["table_zone"]
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_demo_restaurant: { Args: never; Returns: string }
      create_restaurant: {
        Args: { _full_name: string; _name: string; _slug: string }
        Returns: string
      }
      has_staff_role: {
        Args: {
          _rid: string
          _roles: Database["public"]["Enums"]["staff_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { _rid: string }; Returns: boolean }
      place_guest_order: {
        Args: {
          _items: Json
          _notes: string
          _slug: string
          _table_number: string
        }
        Returns: number
      }
    }
    Enums: {
      item_status: "pending" | "preparing" | "ready" | "served"
      kitchen_station:
        | "Main Kitchen"
        | "Grill"
        | "Starters"
        | "Desserts"
        | "Bar"
      order_status:
        | "incoming"
        | "accepted"
        | "preparing"
        | "ready"
        | "served"
        | "cancelled"
      order_type: "qr_table" | "foh_pos" | "eta_preorder"
      payment_status: "unpaid" | "partial" | "paid"
      promo_type:
        | "secret_qr"
        | "happy_hour"
        | "bogo"
        | "percentage"
        | "fixed"
        | "first_time"
      reservation_status:
        | "pending"
        | "confirmed"
        | "arriving_soon"
        | "checked_in"
        | "seated"
        | "completed"
        | "cancelled"
        | "no_show"
      staff_role: "owner" | "manager" | "foh" | "kitchen"
      table_shape: "square" | "round" | "rectangle"
      table_status:
        | "available"
        | "reserved"
        | "occupied"
        | "waiting_food"
        | "bill_requested"
        | "cleaning"
      table_zone: "Main Dining" | "Patio" | "Bar"
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
    Enums: {
      item_status: ["pending", "preparing", "ready", "served"],
      kitchen_station: ["Main Kitchen", "Grill", "Starters", "Desserts", "Bar"],
      order_status: [
        "incoming",
        "accepted",
        "preparing",
        "ready",
        "served",
        "cancelled",
      ],
      order_type: ["qr_table", "foh_pos", "eta_preorder"],
      payment_status: ["unpaid", "partial", "paid"],
      promo_type: [
        "secret_qr",
        "happy_hour",
        "bogo",
        "percentage",
        "fixed",
        "first_time",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "arriving_soon",
        "checked_in",
        "seated",
        "completed",
        "cancelled",
        "no_show",
      ],
      staff_role: ["owner", "manager", "foh", "kitchen"],
      table_shape: ["square", "round", "rectangle"],
      table_status: [
        "available",
        "reserved",
        "occupied",
        "waiting_food",
        "bill_requested",
        "cleaning",
      ],
      table_zone: ["Main Dining", "Patio", "Bar"],
    },
  },
} as const
