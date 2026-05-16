export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          entry_fee: number
          prize_pool: number
          status: 'upcoming' | 'active' | 'finished'
          starts_at: string | null
          ends_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tournaments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          home_team: string
          home_flag: string | null
          away_team: string
          away_flag: string | null
          match_date: string
          group_name: string | null
          round: string
          status: 'pending' | 'live' | 'finished'
          home_score: number | null
          away_score: number | null
          lock_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          prediction: '1' | 'X' | '2'
          points_earned: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          match_id: string
          prediction: '1' | 'X' | '2'
        }
        Update: {
          prediction?: '1' | 'X' | '2'
        }
      }
      tournament_registrations: {
        Row: {
          id: string
          user_id: string
          tournament_id: string
          paid: boolean
          payment_id: string | null
          registered_at: string
        }
        Insert: {
          user_id: string
          tournament_id: string
          paid?: boolean
          payment_id?: string | null
        }
        Update: {
          paid?: boolean
          payment_id?: string | null
        }
      }
    }
    Views: {
      standings: {
        Row: {
          user_id: string
          tournament_id: string
          full_name: string | null
          username: string | null
          total_points: number
          correct_predictions: number
          total_predictions: number
        }
      }
    }
  }
}
