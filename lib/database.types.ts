
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "auction_bidders": {
                  Row: {
                    "auction_id": string,"bidder_id": string,"bidder_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "auction_id": string,"bidder_id": string,"bidder_no": number
                  }
                  Update: {
                    "auction_id"?: string,"bidder_id"?: string,"bidder_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "auction_bidders_auction_id_fkey"
      columns: ["auction_id"]
isOneToOne: false
      referencedRelation: "auctions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auction_bidders_bidder_id_fkey"
      columns: ["bidder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"auction_photos": {
                  Row: {
                    "auction_id": string,"id": string,"position": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auction_id": string,"id"?: string,"position"?: number,"storage_path": string
                  }
                  Update: {
                    "auction_id"?: string,"id"?: string,"position"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auction_photos_auction_id_fkey"
      columns: ["auction_id"]
isOneToOne: false
      referencedRelation: "auctions"
      referencedColumns: ["id"]
    }
                  ]
                },"auctions": {
                  Row: {
                    "area": string,"bid_count": number,"category": string,"closed_at": string | null,"condition": string,"created_at": string,"current_bid": number | null,"description": string,"drop_id": string,"ends_at": string,"id": string,"leader_id": string | null,"outcome": string | null,"relisted_from": string | null,"seller_id": string,"slot": number,"start_price": number,"starts_at": string,"step": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"bid_count"?: number,"category": string,"closed_at"?: string | null,"condition": string,"created_at"?: string,"current_bid"?: number | null,"description"?: string,"drop_id": string,"ends_at": string,"id"?: string,"leader_id"?: string | null,"outcome"?: string | null,"relisted_from"?: string | null,"seller_id": string,"slot": number,"start_price": number,"starts_at": string,"step": number,"title": string
                  }
                  Update: {
                    "area"?: string,"bid_count"?: number,"category"?: string,"closed_at"?: string | null,"condition"?: string,"created_at"?: string,"current_bid"?: number | null,"description"?: string,"drop_id"?: string,"ends_at"?: string,"id"?: string,"leader_id"?: string | null,"outcome"?: string | null,"relisted_from"?: string | null,"seller_id"?: string,"slot"?: number,"start_price"?: number,"starts_at"?: string,"step"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auctions_drop_id_fkey"
      columns: ["drop_id"]
isOneToOne: false
      referencedRelation: "drops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auctions_leader_id_fkey"
      columns: ["leader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auctions_relisted_from_fkey"
      columns: ["relisted_from"]
isOneToOne: false
      referencedRelation: "auctions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auctions_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bids": {
                  Row: {
                    "amount": number,"auction_id": string,"bidder_id": string,"created_at": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"auction_id": string,"bidder_id": string,"created_at"?: string,"id"?: string
                  }
                  Update: {
                    "amount"?: number,"auction_id"?: string,"bidder_id"?: string,"created_at"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bids_auction_id_fkey"
      columns: ["auction_id"]
isOneToOne: false
      referencedRelation: "auctions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bids_bidder_id_fkey"
      columns: ["bidder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"drop_reminders": {
                  Row: {
                    "created_at": string,"drop_id": string,"notified_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"drop_id": string,"notified_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"drop_id"?: string,"notified_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drop_reminders_drop_id_fkey"
      columns: ["drop_id"]
isOneToOne: false
      referencedRelation: "drops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drop_reminders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"drops": {
                  Row: {
                    "close_interval": string,"created_at": string,"first_close_at": string,"id": string,"max_lots": number,"number": number,"opens_at": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "close_interval"?: string,"created_at"?: string,"first_close_at": string,"id"?: string,"max_lots"?: number,"number"?: number,"opens_at": string,"status"?: string,"title": string
                  }
                  Update: {
                    "close_interval"?: string,"created_at"?: string,"first_close_at"?: string,"id"?: string,"max_lots"?: number,"number"?: number,"opens_at"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"pushed_at": string | null,"read_at": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ops_alerts": {
                  Row: {
                    "created_at": string,"detail": NonNullable<Json>,"id": string,"kind": string,"order_id": string | null,"resolved_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind": string,"order_id"?: string | null,"resolved_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind"?: string,"order_id"?: string | null,"resolved_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ops_alerts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount": number,"auction_id": string,"buyer_id": string,"commission": number,"created_at": string,"dispute_reason": string | null,"handed_over_at": string | null,"handover_attempts": number,"handover_code_hash": string | null,"handover_window_started_at": string | null,"id": string,"offer_round": number,"paid_at": string | null,"paid_out_at": string | null,"pay_by": string,"payout_amount": number,"paystack_access_code": string | null,"paystack_authorization_url": string | null,"paystack_reference": string | null,"refunded_at": string | null,"seller_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"auction_id": string,"buyer_id": string,"commission": number,"created_at"?: string,"dispute_reason"?: string | null,"handed_over_at"?: string | null,"handover_attempts"?: number,"handover_code_hash"?: string | null,"handover_window_started_at"?: string | null,"id"?: string,"offer_round"?: number,"paid_at"?: string | null,"paid_out_at"?: string | null,"pay_by": string,"payout_amount": number,"paystack_access_code"?: string | null,"paystack_authorization_url"?: string | null,"paystack_reference"?: string | null,"refunded_at"?: string | null,"seller_id": string,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"auction_id"?: string,"buyer_id"?: string,"commission"?: number,"created_at"?: string,"dispute_reason"?: string | null,"handed_over_at"?: string | null,"handover_attempts"?: number,"handover_code_hash"?: string | null,"handover_window_started_at"?: string | null,"id"?: string,"offer_round"?: number,"paid_at"?: string | null,"paid_out_at"?: string | null,"pay_by"?: string,"payout_amount"?: number,"paystack_access_code"?: string | null,"paystack_authorization_url"?: string | null,"paystack_reference"?: string | null,"refunded_at"?: string | null,"seller_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_auction_id_fkey"
      columns: ["auction_id"]
isOneToOne: false
      referencedRelation: "auctions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "amount": number,"attempts": number,"created_at": string,"failure_reason": string | null,"id": string,"order_id": string,"paystack_transfer_code": string | null,"seller_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"attempts"?: number,"created_at"?: string,"failure_reason"?: string | null,"id"?: string,"order_id": string,"paystack_transfer_code"?: string | null,"seller_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"attempts"?: number,"created_at"?: string,"failure_reason"?: string | null,"id"?: string,"order_id"?: string,"paystack_transfer_code"?: string | null,"seller_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "area": string | null,"bidding_suspended": boolean,"created_at": string,"display_name": string | null,"id": string,"is_admin": boolean,"phone": string | null,"strikes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"bidding_suspended"?: boolean,"created_at"?: string,"display_name"?: string | null,"id": string,"is_admin"?: boolean,"phone"?: string | null,"strikes"?: number
                  }
                  Update: {
                    "area"?: string | null,"bidding_suspended"?: boolean,"created_at"?: string,"display_name"?: string | null,"id"?: string,"is_admin"?: boolean,"phone"?: string | null,"strikes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "created_at": string,"endpoint": string,"id": string,"keys": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"endpoint": string,"id"?: string,"keys": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"endpoint"?: string,"id"?: string,"keys"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_bank": {
                  Row: {
                    "account_name": string,"account_number": string,"bank_code": string,"bank_name": string | null,"paystack_recipient_code": string | null,"seller_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name": string,"account_number": string,"bank_code": string,"bank_name"?: string | null,"paystack_recipient_code"?: string | null,"seller_id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_name"?: string,"account_number"?: string,"bank_code"?: string,"bank_name"?: string | null,"paystack_recipient_code"?: string | null,"seller_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_bank_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_auction_photo":
{ Args: { "p_auction_id": string,"p_position": number,"p_storage_path": string }; Returns: undefined
                           },
"admin_cancel_auction":
{ Args: { "p_auction_id": string }; Returns: undefined
                           },
"admin_cancel_drop":
{ Args: { "p_drop_id": string }; Returns: undefined
                           },
"admin_create_drop":
{ Args: { "p_close_interval_seconds"?: number,"p_first_close_at": string,"p_max_lots"?: number,"p_opens_at": string,"p_title": string }; Returns: string
                           },
"admin_drop_lots":
{ Args: { "p_drop_id": string }; Returns: {
              "area": string,"bid_count": number,"closed_at": string,"current_bid": number,"ends_at": string,"id": string,"outcome": string,"seller_name": string,"start_price": number,"title": string
            }[]
                           },
"admin_drops_calendar":
{ Args: { "p_days"?: number }; Returns: {
              "first_close_at": string,"id": string,"live_bids": number,"lots": number,"max_lots": number,"opens_at": string,"status": string,"title": string
            }[]
                           },
"admin_drops_week":
{ Args: { "p_week_start": string }; Returns: {
              "day": string,"drop_id": string,"last_close_at": string,"lots": number,"number": number,"opens_at": string,"state": string,"title": string,"unsold": number
            }[]
                           },
"admin_lots":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query": string,"p_status": string }; Returns: {
              "area": string,"bid_count": number,"closed_at": string,"current_bid": number,"drop_id": string,"drop_number": number,"drop_title": string,"ends_at": string,"id": string,"outcome": string,"photo": string,"seller_name": string,"slot": number,"start_price": number,"starts_at": string,"title": string,"total_count": number
            }[]
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_release_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"admin_retry_payout":
{ Args: { "p_payout_id": string }; Returns: undefined
                           },
"admin_review_user":
{ Args: { "p_reset_strikes"?: boolean,"p_user_id": string }; Returns: undefined
                           },
"admin_strikes_week":
{ Args: Record<PropertyKey, never>; Returns: {
              "bidding_suspended": boolean,"display_name": string,"lot_title": string,"phone": string,"strikes": number,"struck_at": string,"user_id": string
            }[]
                           },
"admin_suspend_user":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"admin_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query": string }; Returns: {
              "area": string,"bidding_suspended": boolean,"created_at": string,"display_name": string,"id": string,"is_admin": boolean,"phone": string,"strikes": number,"total_count": number
            }[]
                           },
"cancel_listing":
{ Args: { "p_auction_id": string }; Returns: undefined
                           },
"claim_payouts":
{ Args: { "p_limit"?: number }; Returns: {
              "amount": number,"order_id": string,"payout_id": string,"recipient_code": string,"title": string
            }[]
                           },
"claim_push_notifications":
{ Args: { "p_limit"?: number,"p_notification_id"?: string }; Returns: {
              "id": string,"payload": Json,"type": string,"user_id": string
            }[]
                           },
"close_due_auctions":
{ Args: { "p_limit"?: number }; Returns: number
                           },
"confirm_handover":
{ Args: { "p_code": string,"p_order_id": string }; Returns: Json
                           },
"create_listing":
{ Args: { "p_area": string,"p_category": string,"p_condition": string,"p_description": string,"p_drop_id": string,"p_start_price": number,"p_title": string }; Returns: string
                           },
"current_drops":
{ Args: { "p_limit"?: number }; Returns: {
              "accepting_listings": boolean,"areas": (string)[],"close_interval_seconds": number,"first_close_at": string,"id": string,"last_close_at": string,"lot_count": number,"number": number,"opens_at": string,"reminded": boolean,"server_now": string,"title": string,"total_bids": number
            }[]
                           },
"decline_second_chance":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"ensure_upcoming_drops":
{ Args: { "p_days"?: number }; Returns: number
                           },
"expire_unpaid_orders":
{ Args: { "p_limit"?: number }; Returns: number
                           },
"get_bid_history":
{ Args: { "p_auction_id": string,"p_limit"?: number }; Returns: {
              "amount": number,"bidder_no": number,"created_at": string,"is_me": boolean
            }[]
                           },
"get_handover_code":
{ Args: { "p_order_id": string }; Returns: string
                           },
"get_lot":
{ Args: { "p_auction_id": string }; Returns: Json
                           },
"listable_drops":
{ Args: { "p_limit"?: number }; Returns: {
              "id": string,"lot_count": number,"opens_at": string,"title": string
            }[]
                           },
"log_paystack_event":
{ Args: { "p_data_id": string,"p_event": string,"p_payload": Json,"p_reference": string }; Returns: boolean
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_order_paid":
{ Args: { "p_amount": number,"p_currency": string,"p_reference": string }; Returns: string
                           },
"mark_order_refunded":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"my_bids":
{ Args: Record<PropertyKey, never>; Returns: {
              "area": string,"auction_id": string,"closed_at": string,"current_bid": number,"ends_at": string,"is_leading": boolean,"my_max_bid": number,"outcome": string,"title": string
            }[]
                           },
"my_listings":
{ Args: Record<PropertyKey, never>; Returns: {
              "area": string,"bid_count": number,"closed_at": string,"current_bid": number,"drop_title": string,"ends_at": string,"id": string,"outcome": string,"photo": string,"relisted": boolean,"start_price": number,"starts_at": string,"title": string
            }[]
                           },
"my_orders":
{ Args: { "p_role"?: string }; Returns: {
              "amount": number,"area": string,"auction_id": string,"commission": number,"counterpart_name": string,"counterpart_phone": string,"created_at": string,"handed_over_at": string,"id": string,"offer_round": number,"paid_at": string,"paid_out_at": string,"pay_by": string,"payout_amount": number,"photo": string,"refunded_at": string,"status": string,"title": string
            }[]
                           },
"open_dispute":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"order_for_checkout":
{ Args: { "p_buyer_id": string,"p_order_id": string }; Returns: {
              "amount": number,"id": string,"pay_by": string,"paystack_access_code": string,"paystack_authorization_url": string,"status": string,"title": string
            }[]
                           },
"payout_transfer_result":
{ Args: { "p_payout_id": string,"p_reason"?: string,"p_result": string }; Returns: undefined
                           },
"payout_transfer_started":
{ Args: { "p_payout_id": string,"p_transfer_code": string }; Returns: undefined
                           },
"place_bid":
{ Args: { "p_amount": number,"p_auction_id": string }; Returns: Json
                           },
"record_late_payment_refund":
{ Args: { "p_reference": string }; Returns: undefined
                           },
"relist_auction":
{ Args: { "p_auction_id": string,"p_drop_id": string,"p_start_price"?: number }; Returns: string
                           },
"remove_auction_photo":
{ Args: { "p_auction_id": string,"p_position": number }; Returns: undefined
                           },
"save_seller_bank":
{ Args: { "p_account_name": string,"p_account_number": string,"p_bank_code": string,"p_bank_name": string,"p_recipient_code": string,"p_seller_id": string }; Returns: undefined
                           },
"search_lots":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "area": string,"bid_count": number,"category": string,"closed_at": string,"condition": string,"current_bid": number,"drop_id": string,"drop_title": string,"ends_at": string,"id": string,"outcome": string,"photo": string,"start_price": number,"starts_at": string,"title": string
            }[]
                           },
"send_drop_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"server_time":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"set_drop_reminder":
{ Args: { "p_drop_id": string,"p_on"?: boolean }; Returns: undefined
                           },
"set_order_checkout":
{ Args: { "p_access_code": string,"p_authorization_url": string,"p_order_id": string }; Returns: undefined
                           },
"step_for":
{ Args: { "p_start_price": number }; Returns: number
                           },
"update_listing":
{ Args: { "p_area": string,"p_auction_id": string,"p_category": string,"p_condition": string,"p_description": string,"p_start_price": number,"p_title": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
