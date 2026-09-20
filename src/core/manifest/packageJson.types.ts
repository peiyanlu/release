import type { Dict } from '@peiyanlu/ts-utils'


export interface PackageJsonProps extends Dict<any> {
  name: string
  version: string
  private?: boolean
}
