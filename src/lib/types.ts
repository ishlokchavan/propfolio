export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface EmailAccount {
  id: string
  user_id: string
  provider: 'google' | 'microsoft'
  email: string
  last_synced_at: string | null
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  emails_scanned: number
  created_at: string
}

export interface Property {
  id: string
  user_id: string
  email_account_id: string | null
  project_name: string
  developer: string
  unit_number: string | null
  property_type: string | null
  location: string | null
  emirate: string
  total_value: number
  paid_amount: number
  booking_date: string | null
  handover_date: string | null
  ownership_names: string[] | null
  ownership_split: string
  ai_confidence: number | null
  created_at: string
  updated_at: string
  payment_milestones?: PaymentMilestone[]
}

export interface PaymentMilestone {
  id: string
  property_id: string
  user_id: string
  label: string
  amount: number
  due_date: string | null
  due_label: string | null
  status: 'paid' | 'due' | 'future'
  paid_date: string | null
  created_at: string
}

export interface SyncJob {
  id: string
  user_id: string
  email_account_id: string
  status: 'queued' | 'scanning' | 'parsing' | 'done' | 'error'
  progress: number
  log: Array<{ message: string; type: 'info' | 'found' | 'processing' | 'error'; timestamp: string }>
  properties_found: number
  emails_scanned: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}
