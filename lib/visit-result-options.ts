export type VisitResultOption = {
  value: string
  label: string
  description?: string
}

export const clientMoodOptions: VisitResultOption[] = [
  { value: 'HAPPY', label: 'Happy', description: 'Positive and comfortable' },
  { value: 'NEUTRAL', label: 'Neutral', description: 'Balanced, still evaluating' },
  { value: 'CONCERNED', label: 'Concerned', description: 'Has objections to resolve' },
  { value: 'UNSURE', label: 'Unsure', description: 'Needs more clarity before deciding' },
]

export const clientPotentialityOptions: VisitResultOption[] = [
  { value: 'HOT', label: 'Hot' },
  { value: 'WARM', label: 'Warm' },
  { value: 'COLD', label: 'Cold' },
]

export const projectTypeOptions: VisitResultOption[] = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'TRIPLEX', label: 'Triplex' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'OFFICE', label: 'Office' },
]

export const clientPersonalityOptions: VisitResultOption[] = [
  {
    value: 'ANALYTICAL',
    label: 'Analytical',
    description: 'Methodical, logical, and detail-oriented.',
  },
  {
    value: 'DRIVER',
    label: 'Driver',
    description: 'Results-oriented, efficient, and direct.',
  },
  {
    value: 'AMIABLE',
    label: 'Amiable',
    description: 'Patient, relationship-focused, and trust-driven.',
  },
  {
    value: 'EXPRESSIVE',
    label: 'Expressive',
    description: 'Creative, enthusiastic, and fast-paced.',
  },
]

export const budgetRangeOptions: VisitResultOption[] = [
  { value: 'UNDER_10L', label: 'Under 10L' },
  { value: '10L_TO_20L', label: '10L - 20L' },
  { value: '20L_TO_35L', label: '20L - 35L' },
  { value: '35L_TO_50L', label: '35L - 50L' },
  { value: '50L_TO_75L', label: '50L - 75L' },
  { value: 'ABOVE_75L', label: 'Above 75L' },
]

export const urgencyOptions: VisitResultOption[] = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'THREE_TO_SIX_MONTHS', label: '3-6 months' },
  { value: 'MORE_THAN_SIX_MONTHS', label: 'More than 6 months' },
]

export const stylePreferenceOptions: VisitResultOption[] = [
  { value: 'MODERN', label: 'Modern' },
  { value: 'TRADITIONAL', label: 'Traditional' },
  { value: 'MINIMALIST', label: 'Minimalist' },
  { value: 'LUXURY', label: 'Luxury' },
]
