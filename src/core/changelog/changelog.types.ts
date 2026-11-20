import type { CommitType } from 'conventional-changelog-conventionalcommits'


export interface ChangelogWriteOptions {
  /** 日志文件名称 */
  filename?: string
}

export interface ChangelogPresetOptions {
  /** 对默认 commit types 进行转换 */
  transformTypes?: (types: CommitType[]) => CommitType[]
  /** 提交范围（scope） */
  scope?: string | string[]
}

export interface ChangelogOptions extends ChangelogPresetOptions, ChangelogWriteOptions {
  pkgDir?: string
  /** tag 前缀 */
  tagPrefix?: string
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number
  /** 自定义 markdown 插入到更新日志的版本标题后，在生成的内容之前 */
  preamble?: string
  /** 当前版本 */
  version?: string
  /** 上一个版本 tag */
  previousTag?: string
  /** 项目在没有更改的情况下被升级，以与其他项目中的重大更改保持同步 */
  breakingSync?: boolean
}
