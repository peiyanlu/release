import { CommitType } from '../types.js'


export const defaultTypes: CommitType[] = [
  {
    type: 'feat',
    section: '✨ 新功能',
    effect: 'bump',
    description: '新增功能',
  },
  {
    type: 'feature',
    section: '✨ 新功能',
    effect: 'bump',
    description: '新增功能',
  },
  {
    type: 'fix',
    section: '🐛 Bug 修复',
    effect: 'bump',
    description: '修复 bug',
  },
  {
    type: 'perf',
    section: '⚡ 性能优化',
    effect: 'bump',
    description: '提升性能',
  },
  {
    type: 'revert',
    section: '⏪ 回退',
    effect: 'bump',
    description: '回退到之前版本',
  },
  {
    type: 'docs',
    section: '📝 文档',
    effect: 'changelog',
    description: '文档更新',
  },
  {
    type: 'style',
    section: '💄 样式调整',
    effect: 'hidden',
    description: '样式或格式修改',
  },
  {
    type: 'chore',
    section: '🧹 其他更新',
    effect: 'hidden',
    description: '非功能性更改',
  },
  {
    type: 'refactor',
    section: '♻️ 代码重构',
    effect: 'changelog',
    description: '重构代码',
  },
  {
    type: 'test',
    section: '🧪 测试',
    effect: 'hidden',
    description: '测试更新',
  },
  {
    type: 'build',
    section: '🏗️ 构建系统',
    effect: 'hidden',
    description: '构建工具和系统修改',
  },
  {
    type: 'ci',
    section: '🤖 CI',
    effect: 'hidden',
    description: '持续集成配置',
  },
  // custom
  {
    type: 'security',
    section: '🛡️ 安全修复',
    effect: 'changelog',
    description: '安全性更新',
  },
  {
    type: 'hotfix',
    section: '🚑 热修复',
    effect: 'changelog',
    description: '紧急修复',
  },
  {
    type: 'i18n',
    section: '🌐 国际化',
    effect: 'changelog',
    description: '国际化相关更新',
  },
  {
    type: 'ux',
    section: '🎨 用户体验',
    effect: 'changelog',
    description: '用户体验改进',
  },
  {
    type: 'deps',
    section: '📦 依赖更新',
    effect: 'changelog',
    description: '依赖版本变更',
  },
  {
    type: 'tool',
    section: '🛠️ 工具链',
    effect: 'hidden',
    description: '工具链变更',
  },
  {
    type: 'config',
    section: '⚙️ 配置',
    effect: 'hidden',
    description: '配置文件更新',
  },
]
