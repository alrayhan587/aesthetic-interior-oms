export const CAD_SUBMISSION_FILE_TYPE_VALUES = [
  'FLOOR_PLAN',
  'FURNITURE_LAYOUT',
  'BEAM_LAYOUT',
  'COLUMN_LAYOUT',
  'LANDSCAPING',
  'ROOF_TOP_DESIGN',
  'ELECTRICAL_PLUMBING',
  'WORKING_DETAILS',
  'OTHERS',
] as const

export type CadSubmissionFileTypeValue = (typeof CAD_SUBMISSION_FILE_TYPE_VALUES)[number]

export const CAD_SUBMISSION_FILE_TYPE_LABELS: Record<CadSubmissionFileTypeValue, string> = {
  FLOOR_PLAN: 'Floor Plan',
  FURNITURE_LAYOUT: 'Furniture Layout',
  BEAM_LAYOUT: 'Beam Layout',
  COLUMN_LAYOUT: 'Column Layout',
  LANDSCAPING: 'Landscaping',
  ROOF_TOP_DESIGN: 'Roof Top Design',
  ELECTRICAL_PLUMBING: 'Electrical Plumbing',
  WORKING_DETAILS: 'Working Details',
  OTHERS: 'Others',
}

export const CAD_SUBMISSION_FILE_TYPE_OPTIONS = CAD_SUBMISSION_FILE_TYPE_VALUES.map((value) => ({
  value,
  label: CAD_SUBMISSION_FILE_TYPE_LABELS[value],
}))

export const MAX_CAD_SUBMISSION_FILES = 12
export const MAX_CAD_SUBMISSION_FILE_SIZE_BYTES = 30 * 1024 * 1024

export const ALLOWED_CAD_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/acad',
  'application/x-acad',
  'application/autocad',
  'application/x-dwg',
  'application/dwg',
  'drawing/dwg',
  'image/vnd.dwg',
  'application/dxf',
  'image/vnd.dxf',
])

export const ALLOWED_CAD_UPLOAD_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx', 'dwg', 'dxf'])

export const CAD_EXTENSION_CONTENT_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  dwg: 'application/x-dwg',
  dxf: 'application/dxf',
}

export function formatCadSubmissionFileType(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  const normalized = value.trim().toUpperCase()
  if (normalized in CAD_SUBMISSION_FILE_TYPE_LABELS) {
    return CAD_SUBMISSION_FILE_TYPE_LABELS[normalized as CadSubmissionFileTypeValue]
  }
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function isCadSubmissionFileTypeValue(value: string): value is CadSubmissionFileTypeValue {
  return CAD_SUBMISSION_FILE_TYPE_VALUES.includes(value as CadSubmissionFileTypeValue)
}

export function sanitizeCadFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function getCadFileExtension(fileName: string): string {
  const safeName = (fileName || '').trim().toLowerCase()
  const dotIndex = safeName.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === safeName.length - 1) return ''
  return safeName.slice(dotIndex + 1)
}
