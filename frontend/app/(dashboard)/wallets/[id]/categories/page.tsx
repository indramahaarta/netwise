'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useWalletCategories, useCreateWalletCategory, useDeleteWalletCategory } from '@/hooks/use-wallets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

export default function WalletCategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: categories, isLoading } = useWalletCategories()
  const createCategory = useCreateWalletCategory()
  const deleteCategory = useDeleteWalletCategory()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await createCategory.mutateAsync({ name, type })
      setName('')
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(catId: number) {
    if (!confirm('Delete this category?')) return
    await deleteCategory.mutateAsync(catId)
  }

  const customCats = (categories || []).filter((c) => !c.is_system)
  const systemCats = (categories || []).filter((c) => c.is_system)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/wallets/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">Manage Categories</h1>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Groceries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Custom categories */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Custom Categories</h2>
        {customCats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom categories yet.</p>
        ) : (
          <div className="space-y-2">
            {customCats.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{cat.name}</p>
                      <Badge variant="outline" className="mt-1">
                        {cat.type}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* System categories */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">System Categories</h2>
        {systemCats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No system categories.</p>
        ) : (
          <div className="space-y-2">
            {systemCats.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{cat.name}</p>
                      <Badge variant="outline" className="mt-1">
                        {cat.type}
                      </Badge>
                    </div>
                  </div>
                  <Badge>System</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
