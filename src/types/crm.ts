export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'google_sheet' | 'manual';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  service_interested: string;
  address: string;
  status: "New User" | "complete" | "incomplete";
  status_response: string;
  lead_source: LeadSource;
  notes: string | null;
  follow_up_date: string | null;
  google_sheet_row_id: string | null;
  created_at: string;
  updated_at: string;
  // License fields
  license_name_1: string | null;
  license_name_2: string | null;
  license_name_3: string | null;
  license_status_1: string | null;
  license_status_2: string | null;
  license_status_3: string | null;
  license_link_1: string | null;
  license_link_2: string | null;
  license_link_3: string | null;
}

export interface Client {
  id: string;
  user_id: string;
  lead_id: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  billing_details: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  lead_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  client?: Client;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  lead_id: string | null;
  client_id: string | null;
  invoice_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  user_id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  google_sheet_id: string | null;
  created_at: string;
  updated_at: string;
}