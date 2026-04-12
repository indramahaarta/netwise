'use client'

import { useState, useEffect } from 'react'
import { useProfile, useUpdateProfile, useLogout } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  const { data: user } = useProfile()
  const update = useUpdateProfile()
  const logout = useLogout()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setUsername(user.username)
      setEmail(user.email)
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await update.mutateAsync({
        username,
        email,
        ...(apiKey ? { finnhub_api_key: apiKey } : {}),
      })
      setApiKey('')
      setSuccess('Profile updated successfully')
    } catch {
      setError('Failed to update profile')
    }
  }

  return (
    <div className="p-6 max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your account details and Finnhub API key</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="apikey">Finnhub API Key</Label>
                {user?.has_finnhub_api_key && (
                  <Badge variant="outline" className="text-xs">Configured</Badge>
                )}
              </div>
              <Input
                id="apikey"
                type="password"
                placeholder={user?.has_finnhub_api_key ? 'Leave blank to keep existing key' : 'Enter your Finnhub API key'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for live stock prices and forex rates. Get yours at finnhub.io
              </p>
            </div>
            {success && <p className="text-sm text-green-600">{success}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
