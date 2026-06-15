// @ts-nocheck
import { supabase } from '../lib/supabase'

export interface ContactInfo {
  id?:       string
  email:     string | null
  whatsapp:  string | null   // número en formato internacional sin "+", ej: 5492901234567
  instagram: string | null   // handle sin "@", ej: hinchahub
  subtitle:  string | null
}

const DEFAULT_CONTACT: ContactInfo = {
  email:     'deeze.designs@gmail.com',
  whatsapp:  null,
  instagram: null,
  subtitle:  'Estamos para ayudarte.',
}

export async function fetchContactInfo(): Promise<ContactInfo> {
  const { data, error } = await supabase
    .from('contact_info')
    .select('id, email, whatsapp, instagram, subtitle')
    .limit(1)
    .single()

  if (error || !data) return DEFAULT_CONTACT
  return {
    id:        data.id,
    email:     data.email     ?? null,
    whatsapp:  data.whatsapp   ?? null,
    instagram: data.instagram ?? null,
    subtitle:  data.subtitle  ?? DEFAULT_CONTACT.subtitle,
  }
}

export async function updateContactInfo(
  id:    string,
  patch: Omit<ContactInfo, 'id'>,
): Promise<void> {
  const { error } = await supabase
    .from('contact_info')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
