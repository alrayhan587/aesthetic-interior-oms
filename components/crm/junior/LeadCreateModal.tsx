'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Mail, Phone, MapPin, DollarSign } from 'lucide-react'

type LeadCreateModalProps = {
  onCreated?: () => void
}

type JrCrmUser = {
  id: string
  fullName: string
  email: string
  phone: string
}

export default function LeadCreateModal({ onCreated }: LeadCreateModalProps) {
  const [open, setOpen] = useState(false)
  
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    budget: '',
    source: '',
    jrCrmUserId: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jrCrmUsers, setJrCrmUsers] = useState<JrCrmUser[]>([])
  const [jrCrmLoading, setJrCrmLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isJuniorCrm, setIsJuniorCrm] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true
    setJrCrmLoading(true)

    Promise.all([fetch('/api/me'), fetch('/api/department/available/JR_CRM')])
      .then(async ([meRes, jrRes]) => {
        const meData = await meRes.json()
        const jrData = await jrRes.json()

        if (!active) return

        const departments = Array.isArray(meData?.userDepartments)
          ? meData.userDepartments.map((entry: any) => entry?.department?.name)
          : []
        const isAdminUser = departments.includes('ADMIN')
        const isJrUser = departments.includes('JR_CRM')

        setCurrentUserId(meData?.id ?? null)
        setIsAdmin(isAdminUser)
        setIsJuniorCrm(isJrUser)

        if (jrData?.success && Array.isArray(jrData?.users)) {
          setJrCrmUsers(jrData.users)
        } else {
          setJrCrmUsers([])
        }

        if (isJrUser && !isAdminUser && meData?.id) {
          setForm((prev) => ({ ...prev, jrCrmUserId: meData.id }))
        }
      })
      .catch((err) => {
        console.error('Error loading JR CRM users:', err)
        if (active) {
          setJrCrmUsers([])
        }
      })
      .finally(() => {
        if (active) setJrCrmLoading(false)
      })

    return () => {
      active = false
    }
  }, [open])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.source.trim()) {
      setError('Name and source are required')
      return
    }
    setLoading(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      location: form.location || undefined,
      budget: form.budget ? Number(form.budget) : undefined,
      source: form.source.trim(),
      assignedToId: form.jrCrmUserId || undefined,
    }
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) {
      setOpen(false)
      setForm({
        name: '',
        email: '',
        phone: '',
        location: '',
        budget: '',
        source: '',
        jrCrmUserId: currentUserId && isJuniorCrm && !isAdmin ? currentUserId : '',
      })
      if (onCreated) onCreated()
    } else {
      setError(data.error || 'Failed to create lead')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-foreground hover:bg-foreground/70 text-background">
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold">Create New Lead</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Add a new lead to your pipeline.
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">Full Name *</label>
            <Input 
              id="name"
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              placeholder="Md. Tanvir Hasan"
              className="border-gray-200"
              required 
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email
            </label>
            <Input 
              id="email"
              name="email" 
              value={form.email} 
              onChange={handleChange} 
              placeholder="tanvir.hasan@gmail.com"
              type="email"
              className="border-gray-200"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone
            </label>
            <Input 
              id="phone"
              name="phone" 
              value={form.phone} 
              onChange={handleChange} 
              placeholder="+8801712345678"
              className="border-gray-200"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </label>
            <Input 
              id="location"
              name="location" 
              value={form.location} 
              onChange={handleChange} 
              placeholder="Dhaka, Bangladesh"
              className="border-gray-200"
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <label htmlFor="source" className="text-sm font-medium text-foreground">Source *</label>
            <select 
              id="source"
              name="source" 
              value={form.source} 
              onChange={handleChange} 
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-background text-foreground text-sm"
              required
            >
              <option value="">Select a source</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="TikTok">TikTok</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Direct Call">Direct Call</option>
              <option value="Office Visit">Office Visit</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* JR CRM Assignment */}
          <div className="space-y-2">
            <label htmlFor="jrCrmUserId" className="text-sm font-medium text-foreground">
              JR CRM
            </label>
            <select
              id="jrCrmUserId"
              name="jrCrmUserId"
              value={form.jrCrmUserId}
              onChange={handleChange}
              disabled={jrCrmLoading || (isJuniorCrm && !isAdmin)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-background text-foreground text-sm disabled:opacity-60"
            >
              <option value="">Select JR CRM</option>
              {jrCrmUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label htmlFor="budget" className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget
            </label>
            <Input 
              id="budget"
              name="budget" 
              value={form.budget} 
              onChange={handleChange} 
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              className="border-gray-200"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <DialogFooter className="flex gap-3 pt-4 border-t">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
