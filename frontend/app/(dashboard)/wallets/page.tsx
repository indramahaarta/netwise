'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useWallets, useAggregatedWalletSnapshots } from '@/hooks/use-wallets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Wallet, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function fmtIDR(value: string | number | undefined) {
  const num = parseFloat(String(value ?? '0'))
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export default function WalletsPage() {
  const { data: wallets, isLoading } = useWallets()
  const [chartRange, setChartRange] = useState('1M')
  const { data: snapshots, isLoading: snapshotsLoading } = useAggregatedWalletSnapshots(chartRange)

  const totalBalance = (wallets ?? []).reduce(
    (sum, w) => sum + parseFloat(w.balance ?? '0'),
    0
  )

  const chartData = useMemo(() => {
    if (!snapshots) return []
    return snapshots.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: parseFloat(s.total_balance),
    }))
  }, [snapshots])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <Link href="/wallets/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Wallet
          </Button>
        </Link>
      </div>

      {/* Total balance summary */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Wallet Balance</p>
            <p className="text-2xl font-bold mt-1">{fmtIDR(totalBalance)}</p>
          </CardContent>
        </Card>
      )}

      {/* Balance over time chart */}
      {!isLoading && (wallets ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Balance Over Time</CardTitle>
            <div className="flex gap-1">
              {['1M', '3M', '1Y', 'ALL'].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={chartRange === r ? 'default' : 'ghost'}
                  onClick={() => setChartRange(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {snapshotsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No snapshot data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => {
                    const num = parseFloat(String(v ?? '0'))
                    return new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(num)
                  }} />
                  <Tooltip formatter={(v: any) => fmtIDR(v)} />
                  <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wallet list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (wallets ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No wallets yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a wallet to track your bank account cash.
            </p>
          </div>
          <Link href="/wallets/new">
            <Button>Create Wallet</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(wallets ?? []).map((w) => (
            <Link key={w.id} href={`/wallets/${w.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.currency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold">{fmtIDR(w.balance)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
