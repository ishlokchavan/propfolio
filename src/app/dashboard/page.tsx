import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: properties }, { data: emailAccounts }, { data: profile }] = await Promise.all([
    supabase
      .from('properties')
      .select('*, payment_milestones(*)')
      .order('created_at', { ascending: false }),  // RLS returns own + shared-with-me
    supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
  ])

  return (
    <DashboardShell
      user={user}
      profile={profile}
      properties={properties || []}
      emailAccounts={emailAccounts || []}
    />
  )
}
