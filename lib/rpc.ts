'use client'

import { supabase } from '@/lib/supabase'

export async function rpc<T = unknown>(
  fn: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw new Error(error.message)
  return data as T
}
