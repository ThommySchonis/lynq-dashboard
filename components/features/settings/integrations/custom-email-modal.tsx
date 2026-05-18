'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/features/settings/password-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useConnectCustomEmail } from '@/hooks/settings'
import { INITIAL_CUSTOM_EMAIL_FORM, type CustomEmailForm } from '@/lib/settings-constants'
import type { CustomEmailConfig } from '@/types/settings'

interface CustomEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId?: string
}

function validate(fields: CustomEmailForm): string | null {
  if (!fields.email.trim()) return 'Email address is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return 'Enter a valid email address'
  if (!fields.imapHost.trim()) return 'IMAP host is required'
  if (!fields.imapPort.trim() || isNaN(Number(fields.imapPort))) return 'IMAP port must be a number'
  if (!fields.smtpHost.trim()) return 'SMTP host is required'
  if (!fields.smtpPort.trim() || isNaN(Number(fields.smtpPort))) return 'SMTP port must be a number'
  if (!fields.username.trim()) return 'Username is required'
  if (!fields.password.trim()) return 'Password is required'
  return null
}

export function CustomEmailModal({ open, onOpenChange, storeId }: CustomEmailModalProps) {
  const [fields, setFields] = useState<CustomEmailForm>({ ...INITIAL_CUSTOM_EMAIL_FORM })
  const [error, setError] = useState('')
  const connectMutation = useConnectCustomEmail()

  function set<K extends keyof CustomEmailForm>(key: K) {
    return (value: string) => setFields(prev => ({ ...prev, [key]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFields({ ...INITIAL_CUSTOM_EMAIL_FORM })
      setError('')
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate(fields)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    const config: CustomEmailConfig = {
      email: fields.email.trim(),
      imap_host: fields.imapHost.trim(),
      imap_port: Number(fields.imapPort),
      smtp_host: fields.smtpHost.trim(),
      smtp_port: Number(fields.smtpPort),
      username: fields.username.trim(),
      password: fields.password,
      use_ssl: true,
    }

    connectMutation.mutate({ ...config, store_id: storeId }, {
      onSuccess: () => handleOpenChange(false),
      onError: (err) => setError(err.message),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect custom email</DialogTitle>
          <DialogDescription>
            Enter your IMAP / SMTP credentials to connect any email account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-3.5">
            {/* Email address */}
            <div>
              <Label htmlFor="ce-email" className="mb-1.5 text-xs font-semibold">
                Email address
              </Label>
              <Input
                id="ce-email"
                type="email"
                value={fields.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email')(e.target.value)}
                placeholder="you@yourdomain.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* IMAP row */}
            <div className="grid grid-cols-[1fr_100px] gap-2.5">
              <div>
                <Label htmlFor="ce-imap-host" className="mb-1.5 text-xs font-semibold">
                  IMAP host
                </Label>
                <Input
                  id="ce-imap-host"
                  type="text"
                  value={fields.imapHost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('imapHost')(e.target.value)}
                  placeholder="imap.yourdomain.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <Label htmlFor="ce-imap-port" className="mb-1.5 text-xs font-semibold">
                  Port
                </Label>
                <Input
                  id="ce-imap-port"
                  type="number"
                  value={fields.imapPort}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('imapPort')(e.target.value)}
                  placeholder="993"
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            {/* SMTP row */}
            <div className="grid grid-cols-[1fr_100px] gap-2.5">
              <div>
                <Label htmlFor="ce-smtp-host" className="mb-1.5 text-xs font-semibold">
                  SMTP host
                </Label>
                <Input
                  id="ce-smtp-host"
                  type="text"
                  value={fields.smtpHost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('smtpHost')(e.target.value)}
                  placeholder="smtp.yourdomain.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <Label htmlFor="ce-smtp-port" className="mb-1.5 text-xs font-semibold">
                  Port
                </Label>
                <Input
                  id="ce-smtp-port"
                  type="number"
                  value={fields.smtpPort}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('smtpPort')(e.target.value)}
                  placeholder="587"
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <Label htmlFor="ce-username" className="mb-1.5 text-xs font-semibold">
                Username
              </Label>
              <Input
                id="ce-username"
                type="text"
                value={fields.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('username')(e.target.value)}
                placeholder="Usually your full email address"
                autoComplete="username"
                spellCheck={false}
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="ce-password" className="mb-1.5 text-xs font-semibold">
                Password
              </Label>
              <PasswordInput
                id="ce-password"
                value={fields.password}
                onChange={set('password')}
                placeholder="App password or account password"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={connectMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={connectMutation.isPending}>
              {connectMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              {connectMutation.isPending ? 'Connecting...' : 'Connect account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
