export interface CommitType {
  type: string
  section: string
  description: string
}


export const defaultTypes: CommitType[] = [
  {
    type: 'feat',
    section: '✨ 新功能',
    description: '新增功能',
  },
  {
    type: 'feature',
    section: '✨ 新功能',
    description: '新增功能',
  },
  {
    type: 'fix',
    section: '🐛 Bug 修复',
    description: '修复 bug',
  },
  {
    type: 'perf',
    section: '⚡ 性能优化',
    description: '提升性能',
  },
  {
    type: 'revert',
    section: '⏪ 回退',
    description: '回退到之前版本',
  },
  {
    type: 'docs',
    section: '📝 文档',
    description: '文档更新',
  },
  {
    type: 'style',
    section: '💄 样式调整',
    description: '样式或格式修改',
  },
  {
    type: 'chore',
    section: '🎫 其他更新',
    description: '非功能性更改',
  },
  {
    type: 'refactor',
    section: '♻ 代码重构',
    description: '重构代码',
  },
  {
    type: 'test',
    section: '✅ 测试',
    description: '测试更新',
  },
  {
    type: 'build',
    section: '👷‍ 构建系统',
    description: '构建工具和系统修改',
  },
  {
    type: 'ci',
    section: '🔧 CI 配置',
    description: '持续集成配置',
  },
  // custom
  {
    type: 'config',
    section: '🔨 配置',
    description: '配置文件更新',
  },
  {
    type: 'deps',
    section: '🔗 依赖更新',
    description: '依赖版本变更',
  },
  {
    type: 'security',
    section: '🔒 安全修复',
    description: '安全性更新',
  },
  {
    type: 'i18n',
    section: '🌐 国际化',
    description: '国际化相关更新',
  },
  {
    type: 'ux',
    section: '🖥️ 用户体验',
    description: '用户体验改进',
  },
  {
    type: 'hotfix',
    section: '🔥 热修复',
    description: '紧急修复',
  },
]


export const mergeTypes = (types: CommitType[]) => {
  types.forEach((item) => {
    const index = defaultTypes.findIndex(it => it.type === item.type)
    if (index >= 0) {
      defaultTypes.splice(index, 1, { ...item })
    } else {
      defaultTypes.push({ ...item })
    }
  })
}

export const findType = (type: string) => {
  const res = defaultTypes.find((item) => item.type === type)
  return res?.section ?? type
}
