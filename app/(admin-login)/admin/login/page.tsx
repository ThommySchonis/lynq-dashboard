'use client'

import { type FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!ADMIN_EMAILS.includes(email)) {
      setError('No access.')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Incorrect email or password')
      setLoading(false)
    } else {
      window.location.href = '/admin'
    }
  }

  return (
    <div className="min-h-screen bg-[#1C0F36] flex items-center justify-center font-sans">
      <div className="bg-[#0D1829] border border-white/8 rounded-2xl p-10 w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Lynq & Flow" className="h-9 mb-4 mx-auto brightness-0 invert" />
          <div className="text-[13px] text-[#4a7fb5]">Admin access only</div>
        </div>

        <form onSubmit={(e) => { void handleLogin(e) }}>
          <div className="mb-4">
            <Label className="text-[#4a7fb5] text-xs mb-1.5">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#1C0F36] border-white/10 text-white text-sm"
            />
          </div>

          <div className="mb-6">
            <Label className="text-[#4a7fb5] text-xs mb-1.5">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-[#1C0F36] border-white/10 text-white text-sm"
            />
          </div>

          {error && (
            <div className="text-[#ff6b8a] text-[13px] mb-4">{error}</div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary text-white font-semibold"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
