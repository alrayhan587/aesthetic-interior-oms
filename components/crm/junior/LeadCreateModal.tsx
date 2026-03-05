'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Mail, Phone, MapPin, DollarSign } from 'lucide-react'

type LeadCreateModalProps = {
  onCreated?: () => void
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
    source: '',
    status: 'NEW',
    stage: 'NEW',
    subStatus: '',
    budget: '',
    location: '',
    remarks: '',
    assignedTo: '',
    userId: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = {
      ...form,
      budget: form.budget ? Number(form.budget) : undefined,
      subStatus: form.subStatus || null,
      assignedTo: form.assignedTo || undefined,
      userId: form.userId || undefined,
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
        source: '',
        status: 'NEW',
        stage: 'NEW',
        subStatus: '',
        budget: '',
        location: '',
        remarks: '',
        assignedTo: '',
        userId: '',
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
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-bold">Create New Lead</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">Fill in the details to add a new lead to your pipeline</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-blue-600 rounded-full" />
              <h3 className="font-semibold text-foreground">Contact Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">Full Name *</label>
                <Input 
                  id="name"
                  name="name" 
                  value={form.name} 
                  onChange={handleChange} 
                  placeholder="John Doe"
                  className="border-gray-200"
                  required 
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email *
                </label>
                <Input 
                  id="email"
                  name="email" 
                  value={form.email} 
                  onChange={handleChange} 
                  placeholder="john@example.com"
                  type="email"
                  className="border-gray-200"
                  required 
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Phone
                </label>
                <Input 
                  id="phone"
                  name="phone" 
                  value={form.phone} 
                  onChange={handleChange} 
                  placeholder="+1 (555) 000-0000"
                  className="border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </label>
                <Input 
                  id="location"
                  name="location" 
                  value={form.location} 
                  onChange={handleChange} 
                  placeholder="City, Country"
                  className="border-gray-200"
                />
              </div>
            </div>
          </div>

          {/* Lead Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-green-600 rounded-full" />
              <h3 className="font-semibold text-foreground">Lead Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="source" className="text-sm font-medium text-foreground">Source</label>
                <Input 
                  id="source"
                  name="source" 
                  value={form.source} 
                  onChange={handleChange} 
                  placeholder="Website, Referral, Ad..."
                  className="border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium text-foreground">Status *</label>
                <select 
                  id="status"
                  name="status" 
                  value={form.status} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="FOLLOWUP">Follow-up</option>
                  <option value="VISIT_SCHEDULED">Visit Scheduled</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CONVERTED">Converted</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="stage" className="text-sm font-medium text-foreground">Stage *</label>
                <select 
                  id="stage"
                  name="stage" 
                  value={form.stage} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="NEW">New</option>
                  <option value="CONTACT_ATTEMPTED">Contact Attempted</option>
                  <option value="NURTURING">Nurturing</option>
                  <option value="VISIT_SCHEDULED">Visit Scheduled</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="subStatus" className="text-sm font-medium text-foreground">Sub-Status</label>
                <select 
                  id="subStatus"
                  name="subStatus" 
                  value={form.subStatus} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a sub-status</option>
                  <option value="NUMBER_COLLECTED">Number Collected</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="WARM_LEAD">Warm Lead</option>
                  <option value="FUTURE_CLIENT">Future Client</option>
                  <option value="SMALL_BUDGET">Small Budget</option>
                  <option value="DEAD_LEAD">Dead Lead</option>
                  <option value="INVALID">Invalid</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            </div>
          </div>

          {/* Financial & Assignment Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-purple-600 rounded-full" />
              <h3 className="font-semibold text-foreground">Financial & Assignment</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <label htmlFor="assignedTo" className="text-sm font-medium text-foreground">Assigned To (User ID)</label>
                <Input 
                  id="assignedTo"
                  name="assignedTo" 
                  value={form.assignedTo} 
                  onChange={handleChange} 
                  placeholder="Enter user ID"
                  className="border-gray-200"
                />
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-amber-600 rounded-full" />
              <h3 className="font-semibold text-foreground">Additional Information</h3>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="remarks" className="text-sm font-medium text-foreground">Remarks</label>
              <textarea 
                id="remarks"
                name="remarks" 
                value={form.remarks} 
                onChange={handleChange} 
                placeholder="Add any additional notes about this lead..."
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium text-foreground">Your User ID</label>
              <Input 
                id="userId"
                name="userId" 
                value={form.userId} 
                onChange={handleChange} 
                placeholder="Enter your user ID"
                className="border-gray-200"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <DialogFooter className="flex gap-3 pt-6 border-t">
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
