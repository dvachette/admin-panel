export interface Organization {
  name: string
  website?: string
  location: string
}

export type ExperienceType = 'job' | 'internship' | 'association'
export type Workload = 'full-time' | 'part-time' | 'volunteer'

export interface Experience {
  id: string
  type: ExperienceType
  title: string
  organization: Organization
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD, null when ongoing */
  endDate: string | null
  workload: Workload
  highlights: string[]
  tags: string[]
}

export interface Interest {
  id: string
  title: string
  /** URL of an SVG icon */
  icon: string
  description: string
  tags: string[]
}

export const EXPERIENCE_TYPES: { label: string; value: ExperienceType }[] = [
  { label: 'Emploi', value: 'job' },
  { label: 'Stage', value: 'internship' },
  { label: 'Associatif', value: 'association' },
]

export const WORKLOADS: { label: string; value: Workload }[] = [
  { label: 'Temps plein', value: 'full-time' },
  { label: 'Temps partiel', value: 'part-time' },
  { label: 'Bénévolat', value: 'volunteer' },
]

export function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
