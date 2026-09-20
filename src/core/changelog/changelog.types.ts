import type { CommitType } from 'conventional-changelog-conventionalcommits'


export interface ChangelogOptions {
  pkgDir?: string;
  
  tagPrefix?: string;
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number;
  /** 自定义 markdown 插入到更新日志的版本标题后，在生成的内容之前 */
  preamble?: string;
  /** 对默认 commit types 进行转换 */
  transformTypes?: (types: CommitType[]) => CommitType[]
  /** 提交范围（scope） */
  scope?: string | string[]
  
  filename?: string
  
  version?: string
  
  previousTag?: string
}
