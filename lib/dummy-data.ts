// ==============================
// CRM Dummy Data Based on Entities
// ==============================

// Lead statuses
export type LeadStatus = "NEW" | "CONTACTED" | "FOLLOWUP" | "VISIT_SCHEDULED" | "REJECTED" | "CONVERTED"

export type Lead = {
  id: number
  name: string
  phone: string
  email: string
  location: string
  projectType: string
  projectSize: string
  source: "facebook" | "manual" | "referral" | "website" | "instagram"
  status: LeadStatus
  assignedTo: string
  createdAt: string
}

export type Followup = {
  id: number
  leadId: number
  leadName: string
  assignedTo: string
  followupDate: string
  followupType: "call" | "meeting" | "email"
  note: string
  status: "pending" | "done" | "missed"
}

export type Visit = {
  id: number
  leadId: number
  leadName: string
  location: string
  scheduledDate: string
  startTime: string
  endTime: string
  assignedTeamMember: string
  visitStatus: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled"
}

export type ActivityLog = {
  id: number
  userId: number
  userName: string
  leadId: number
  leadName: string
  action: string
  description: string
  createdAt: string
}

// ==============================
// Recent Leads (Block 2)
// ==============================
export const recentLeads: Lead[] = [
  {
    id: 1,
    name: "Rajesh Sharma",
    phone: "+91 98765 43210",
    email: "rajesh.sharma@email.com",
    location: "Baner, Pune",
    projectType: "Interior Design",
    projectSize: "2500 sqft",
    source: "facebook",
    status: "NEW",
    assignedTo: "Amit Kumar",
    createdAt: "2026-02-25T09:30:00",
  },
  {
    id: 2,
    name: "Priya Patel",
    phone: "+91 87654 32109",
    email: "priya.patel@email.com",
    location: "Koregaon Park, Pune",
    projectType: "Full Renovation",
    projectSize: "3200 sqft",
    source: "referral",
    status: "CONTACTED",
    assignedTo: "Amit Kumar",
    createdAt: "2026-02-24T14:15:00",
  },
  {
    id: 3,
    name: "Vikram Desai",
    phone: "+91 76543 21098",
    email: "vikram.d@email.com",
    location: "Hinjewadi, Pune",
    projectType: "Modular Kitchen",
    projectSize: "400 sqft",
    source: "website",
    status: "FOLLOWUP",
    assignedTo: "Sneha Joshi",
    createdAt: "2026-02-23T11:45:00",
  },
  {
    id: 4,
    name: "Anita Kulkarni",
    phone: "+91 65432 10987",
    email: "anita.k@email.com",
    location: "Wakad, Pune",
    projectType: "Office Interior",
    projectSize: "5000 sqft",
    source: "instagram",
    status: "VISIT_SCHEDULED",
    assignedTo: "Amit Kumar",
    createdAt: "2026-02-22T16:00:00",
  },
  {
    id: 5,
    name: "Suresh Mehta",
    phone: "+91 54321 09876",
    email: "suresh.m@email.com",
    location: "Kharadi, Pune",
    projectType: "Living Room Design",
    projectSize: "800 sqft",
    source: "facebook",
    status: "CONVERTED",
    assignedTo: "Sneha Joshi",
    createdAt: "2026-02-21T10:00:00",
  },
  {
    id: 6,
    name: "Meera Nair",
    phone: "+91 43210 98765",
    email: "meera.n@email.com",
    location: "Viman Nagar, Pune",
    projectType: "Bedroom Design",
    projectSize: "600 sqft",
    source: "manual",
    status: "REJECTED",
    assignedTo: "Amit Kumar",
    createdAt: "2026-02-20T13:30:00",
  },
  {
    id: 7,
    name: "Karan Singh",
    phone: "+91 32109 87654",
    email: "karan.s@email.com",
    location: "Aundh, Pune",
    projectType: "Complete Home",
    projectSize: "4200 sqft",
    source: "referral",
    status: "CONTACTED",
    assignedTo: "Sneha Joshi",
    createdAt: "2026-02-19T08:45:00",
  },
  {
    id: 8,
    name: "Deepa Joshi",
    phone: "+91 21098 76543",
    email: "deepa.j@email.com",
    location: "SB Road, Pune",
    projectType: "Bathroom Renovation",
    projectSize: "200 sqft",
    source: "website",
    status: "NEW",
    assignedTo: "Amit Kumar",
    createdAt: "2026-02-25T11:00:00",
  },
]

// ==============================
// Today's Followups (Block 3)
// ==============================
export const todayFollowups: Followup[] = [
  {
    id: 1,
    leadId: 2,
    leadName: "Priya Patel",
    assignedTo: "Amit Kumar",
    followupDate: "2026-02-25",
    followupType: "call",
    note: "Discuss budget and design preferences",
    status: "pending",
  },
  {
    id: 2,
    leadId: 3,
    leadName: "Vikram Desai",
    assignedTo: "Sneha Joshi",
    followupDate: "2026-02-25",
    followupType: "meeting",
    note: "Share modular kitchen catalog",
    status: "done",
  },
  {
    id: 3,
    leadId: 7,
    leadName: "Karan Singh",
    assignedTo: "Sneha Joshi",
    followupDate: "2026-02-25",
    followupType: "call",
    note: "Confirm site visit timing",
    status: "pending",
  },
  {
    id: 4,
    leadId: 1,
    leadName: "Rajesh Sharma",
    assignedTo: "Amit Kumar",
    followupDate: "2026-02-25",
    followupType: "email",
    note: "Send introductory portfolio email",
    status: "missed",
  },
  {
    id: 5,
    leadId: 8,
    leadName: "Deepa Joshi",
    assignedTo: "Amit Kumar",
    followupDate: "2026-02-25",
    followupType: "call",
    note: "First contact call - new lead",
    status: "pending",
  },
]

// ==============================
// Visit Schedule (Block 4)
// ==============================
export const visitSchedule: Visit[] = [
  {
    id: 1,
    leadId: 4,
    leadName: "Anita Kulkarni",
    location: "Wakad, Pune",
    scheduledDate: "2026-02-25",
    startTime: "10:00 AM",
    endTime: "11:30 AM",
    assignedTeamMember: "Rohit Patil",
    visitStatus: "Scheduled",
  },
  {
    id: 2,
    leadId: 5,
    leadName: "Suresh Mehta",
    location: "Kharadi, Pune",
    scheduledDate: "2026-02-25",
    startTime: "02:00 PM",
    endTime: "03:00 PM",
    assignedTeamMember: "Rohit Patil",
    visitStatus: "Completed",
  },
  {
    id: 3,
    leadId: 2,
    leadName: "Priya Patel",
    location: "Koregaon Park, Pune",
    scheduledDate: "2026-02-26",
    startTime: "11:00 AM",
    endTime: "12:30 PM",
    assignedTeamMember: "Neha Deshmukh",
    visitStatus: "Scheduled",
  },
  {
    id: 4,
    leadId: 7,
    leadName: "Karan Singh",
    location: "Aundh, Pune",
    scheduledDate: "2026-02-26",
    startTime: "03:00 PM",
    endTime: "04:30 PM",
    assignedTeamMember: "Rohit Patil",
    visitStatus: "Rescheduled",
  },
  {
    id: 5,
    leadId: 3,
    leadName: "Vikram Desai",
    location: "Hinjewadi, Pune",
    scheduledDate: "2026-02-24",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    assignedTeamMember: "Neha Deshmukh",
    visitStatus: "Cancelled",
  },
]

// ==============================
// Activity Timeline (Block 5)
// ==============================
export const activityTimeline: ActivityLog[] = [
  {
    id: 1,
    userId: 1,
    userName: "Amit Kumar",
    leadId: 1,
    leadName: "Rajesh Sharma",
    action: "Lead Created",
    description: "New lead from Facebook campaign",
    createdAt: "2026-02-25T09:30:00",
  },
  {
    id: 2,
    userId: 1,
    userName: "Amit Kumar",
    leadId: 8,
    leadName: "Deepa Joshi",
    action: "Lead Created",
    description: "Website inquiry - Bathroom Renovation",
    createdAt: "2026-02-25T11:00:00",
  },
  {
    id: 3,
    userId: 2,
    userName: "Sneha Joshi",
    leadId: 3,
    leadName: "Vikram Desai",
    action: "Followup Completed",
    description: "Shared modular kitchen catalog via WhatsApp",
    createdAt: "2026-02-25T10:15:00",
  },
  {
    id: 4,
    userId: 3,
    userName: "Rohit Patil",
    leadId: 5,
    leadName: "Suresh Mehta",
    action: "Visit Completed",
    description: "Site visit completed - Client interested in modern style",
    createdAt: "2026-02-25T15:30:00",
  },
  {
    id: 5,
    userId: 1,
    userName: "Amit Kumar",
    leadId: 4,
    leadName: "Anita Kulkarni",
    action: "Status Changed",
    description: "Moved to Visit Scheduled",
    createdAt: "2026-02-25T08:45:00",
  },
  {
    id: 6,
    userId: 2,
    userName: "Sneha Joshi",
    leadId: 7,
    leadName: "Karan Singh",
    action: "Note Added",
    description: "Client wants modern interior style. Budget approx 40 lakh.",
    createdAt: "2026-02-24T17:00:00",
  },
  {
    id: 7,
    userId: 1,
    userName: "Amit Kumar",
    leadId: 2,
    leadName: "Priya Patel",
    action: "Visit Scheduled",
    description: "Site visit booked for Feb 26, 11 AM",
    createdAt: "2026-02-24T14:30:00",
  },
  {
    id: 8,
    userId: 3,
    userName: "Rohit Patil",
    leadId: 4,
    leadName: "Anita Kulkarni",
    action: "Visit Scheduled",
    description: "Site visit scheduled for Feb 25, 10 AM",
    createdAt: "2026-02-24T09:00:00",
  },
]

// ==============================
// Performance Metrics Data (Charts)
// ==============================

// Lead Handling Metrics - Monthly trend
export const monthlyLeadData = [
  { month: "Sep", totalLeads: 32, contacted: 28, pending: 4 },
  { month: "Oct", totalLeads: 45, contacted: 38, pending: 7 },
  { month: "Nov", totalLeads: 38, contacted: 35, pending: 3 },
  { month: "Dec", totalLeads: 52, contacted: 44, pending: 8 },
  { month: "Jan", totalLeads: 48, contacted: 42, pending: 6 },
  { month: "Feb", totalLeads: 56, contacted: 48, pending: 8 },
]

// Follow-Up Discipline - Weekly
export const followupDisciplineData = [
  { week: "W1", onTime: 18, overdue: 3, missed: 1 },
  { week: "W2", onTime: 22, overdue: 2, missed: 0 },
  { week: "W3", onTime: 15, overdue: 5, missed: 2 },
  { week: "W4", onTime: 25, overdue: 1, missed: 1 },
]

// Conversion Funnel
export const conversionFunnelData = [
  { stage: "Total Leads", value: 48 },
  { stage: "Contacted", value: 38 },
  { stage: "Followup", value: 28 },
  { stage: "Visit Scheduled", value: 15 },
  { stage: "Converted", value: 8 },
]

// Visit Management
export const visitManagementData = [
  { month: "Sep", scheduled: 8, completed: 6, cancelled: 1, rescheduled: 1 },
  { month: "Oct", scheduled: 12, completed: 10, cancelled: 1, rescheduled: 1 },
  { month: "Nov", scheduled: 10, completed: 8, cancelled: 2, rescheduled: 0 },
  { month: "Dec", scheduled: 15, completed: 12, cancelled: 1, rescheduled: 2 },
  { month: "Jan", scheduled: 14, completed: 11, cancelled: 2, rescheduled: 1 },
  { month: "Feb", scheduled: 18, completed: 14, cancelled: 2, rescheduled: 2 },
]

// Lead Source Distribution
export const leadSourceData = [
  { source: "Facebook", count: 18, fill: "var(--color-chart-1)" },
  { source: "Referral", count: 12, fill: "var(--color-chart-2)" },
  { source: "Website", count: 9, fill: "var(--color-chart-3)" },
  { source: "Instagram", count: 6, fill: "var(--color-chart-4)" },
  { source: "Manual", count: 3, fill: "var(--color-chart-5)" },
]

// Contact Rate & Conversion Rate trend
export const ratesTrendData = [
  { month: "Sep", contactRate: 87, visitConversion: 25, qualifiedRate: 62 },
  { month: "Oct", contactRate: 84, visitConversion: 27, qualifiedRate: 58 },
  { month: "Nov", contactRate: 92, visitConversion: 26, qualifiedRate: 65 },
  { month: "Dec", contactRate: 85, visitConversion: 29, qualifiedRate: 60 },
  { month: "Jan", contactRate: 88, visitConversion: 31, qualifiedRate: 68 },
  { month: "Feb", contactRate: 86, visitConversion: 33, qualifiedRate: 70 },
]

// KPI Summary Numbers
export const kpiSummary = {
  totalLeadsAssigned: 48,
  newLeadsPending: 8,
  firstContactTimeAvg: "2.4 hrs",
  contactRate: 86,
  followupsDueToday: 12,
  followupsCompletedOnTime: 88,
  overdueFollowups: 3,
  visitConversionRate: 33,
  rejectionRate: 12,
  qualifiedLeadRate: 70,
  visitsScheduled: 5,
  visitShowUpRate: 82,
}
