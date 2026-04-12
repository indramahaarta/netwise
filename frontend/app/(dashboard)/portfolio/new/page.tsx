'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreatePortfolio } from '@/hooks/use-portfolios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CURRENCIES = ['USD', 'IDR', 'SGD', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD']

export default function NewPortfolioPage() {
  const router = useRouter()
  const create = useCreatePortfolio()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const p = await create.mutateAsync({ name, currency })
      router.push(`/portfolio/${p.id}/import`)
    } catch {
      setError('Failed to create portfolio')
    }
  }

  return (
    <div className="p-6 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>New Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Portfolio Name</Label>
              <Input
                id="name"
                placeholder="e.g. US Stocks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Base Currency</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create Portfolio'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
