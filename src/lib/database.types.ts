export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// Permissive types — covers all tables without needing supabase gen types.
// Replace with generated types (supabase gen types typescript) for full type safety.
type AnyTable = {
  Row:           any
  Insert:        any
  Update:        any
  Relationships: any[]
}

export interface Database {
  public: {
    Tables:    { [tableName: string]: AnyTable }
    Views:     { [viewName: string]: { Row: any } }
    Functions: { [fn: string]: any }
    Enums:     { [en: string]: any }
  }
}
