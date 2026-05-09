export interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: { ip?: string; privatePort: number; publicPort?: number; type: string }[]
}
