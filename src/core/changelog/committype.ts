import type { CommitType } from 'conventional-changelog-conventionalcommits'


export const defaultTypes: CommitType[] = [
  {
    type: 'feat',
    section: '✨ 新功能',
    effect: 'bump',
  },
  {
    type: 'feature',
    section: '✨ 新功能',
    effect: 'bump',
  },
  {
    type: 'fix',
    section: '🐛 Bug 修复',
    effect: 'bump',
  },
  {
    type: 'perf',
    section: '⚡ 性能优化',
    effect: 'bump',
  },
  {
    type: 'revert',
    section: '⏪ 回退',
    effect: 'bump',
  },
  {
    type: 'docs',
    section: '📝 文档',
    effect: 'changelog',
  },
  {
    type: 'style',
    section: '💄 样式调整',
    effect: 'hidden',
  },
  {
    type: 'chore',
    section: '🧹 其他更新',
    effect: 'hidden',
  },
  {
    type: 'refactor',
    section: '♻️ 代码重构',
    effect: 'changelog',
  },
  {
    type: 'test',
    section: '🧪 测试',
    effect: 'hidden',
  },
  {
    type: 'build',
    section: '🏗️ 构建系统',
    effect: 'hidden',
  },
  {
    type: 'ci',
    section: '🤖 CI',
    effect: 'hidden',
  },
  // 自定义提交类型
  {
    type: 'security',
    section: '🛡️ 安全修复',
    effect: 'changelog',
  },
  {
    type: 'hotfix',
    section: '🚑 热修复',
    effect: 'changelog',
  },
  {
    type: 'i18n',
    section: '🌐 国际化',
    effect: 'changelog',
  },
  {
    type: 'ux',
    section: '🎨 用户体验',
    effect: 'changelog',
  },
  {
    type: 'deps',
    section: '📦 依赖更新',
    effect: 'changelog',
  },
  {
    type: 'tool',
    section: '🛠️ 工具链',
    effect: 'hidden',
  },
  {
    type: 'config',
    section: '⚙️ 配置',
    effect: 'hidden',
  },
]
