'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCreateWallet } from '@/hooks/use-wallets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function NewWalletPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const createWallet = useCreateWallet()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const wallet = await createWallet.mutateAsync({ name: name.trim() })
    router.push(`/wallets/${wallet.id}`)
  }

  return (
    <div className="p-6 max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/wallets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">New Wallet</h1>
          <p className="text-sm text-muted-foreground">Track a bank account or cash balance</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Wallet Details</CardTitle>
          <CardDescription>Currency is fixed to IDR</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Wallet Name</Label>
              <Input
                id="name"
                placeholder="e.g. BCA, Mandiri, Cash on Hand"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value="IDR" disabled className="text-muted-foreground" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => router.push('/wallets')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!name.trim() || createWallet.isPending}
              >
                {createWallet.isPending ? 'Creating...' : 'Create Wallet'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
