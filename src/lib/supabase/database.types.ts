export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          address: string | null;
          phone: string | null;
          account_state: string;
          created_by: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          address?: string | null;
          phone?: string | null;
          account_state?: string;
          created_by?: string | null;
          activated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          address?: string | null;
          phone?: string | null;
          account_state?: string;
          created_by?: string | null;
          activated_at?: string | null;
        };
      };
      customer_documents: {
        Row: {
          id: string;
          customer_id: string;
          document_kind: string;
          storage_path: string;
          verification_state: string;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          customer_id: string;
          document_kind: string;
          storage_path: string;
          verification_state?: string;
        };
        Update: {
          document_kind?: string;
          storage_path?: string;
          verification_state?: string;
          verified_by?: string | null;
          verified_at?: string | null;
        };
      };
      audit_events: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          record_kind: string;
          record_id: string;
          summary: string;
          created_at: string;
        };
        Insert: {
          actor_id: string;
          action: string;
          record_kind: string;
          record_id: string;
          summary: string;
        };
        Update: Record<string, never>;
      };
      suppliers: {
        Row: {
          id: string;
          account_id: string | null;
          supplier_kind: string;
          business_name: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_by: string;
          creation_route: string;
          invitation_evidence_path: string | null;
          approval_decision: string | null;
          approved_by: string | null;
          approved_at: string | null;
          state: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          supplier_kind: string;
          business_name: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_by: string;
          creation_route?: string;
          invitation_evidence_path?: string | null;
          state?: string;
        };
        Update: {
          account_id?: string | null;
          supplier_kind?: string;
          business_name?: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          invitation_evidence_path?: string | null;
          approval_decision?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          state?: string;
        };
      };
      supplier_documents: {
        Row: {
          id: string;
          supplier_id: string;
          document_kind: string;
          is_primary_id: boolean;
          storage_path: string;
          verification_state: string;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          supplier_id: string;
          document_kind: string;
          is_primary_id?: boolean;
          storage_path: string;
          verification_state?: string;
        };
        Update: {
          document_kind?: string;
          is_primary_id?: boolean;
          storage_path?: string;
          verification_state?: string;
          verified_by?: string | null;
          verified_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
