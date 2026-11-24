# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.3.0](https://github.com/peiyanlu/release/compare/v2.2.1...v2.3.0) (2026-11-24)

### ✨ 新功能

* **cli:** 支持通过 `--config.<path> <value>` 覆盖配置项 ([8b0c875](https://github.com/peiyanlu/release/commit/8b0c875c568ed092a13e1368bff827ac0ad0e1d2))
* **monorepo:** 固定模式下按破坏性变更决定是否升级无变更项目 ([3c2aa4c](https://github.com/peiyanlu/release/commit/3c2aa4c43b3d3120c7f99efe05470caf60a25554))

### ♻️ 代码重构

* 迁移提示工具至 cli-utils 并用 styleText 替代 ansis ([90e56a9](https://github.com/peiyanlu/release/commit/90e56a912cc23a3a4a8bfe42f245bbbff6d9e4d4))

## <small>[2.2.1](https://github.com/peiyanlu/release/compare/v2.2.0...v2.2.1) (2026-11-19)</small>

### 🐛 Bug 修复

* 发布前跳过已发布版本 ([1b897c2](https://github.com/peiyanlu/release/commit/1b897c2ec9aeeb52cda463feefc76663cb0308d6))

## [2.2.0](https://github.com/peiyanlu/release/compare/v2.1.3...v2.2.0) (2026-11-16)

### ✨ 新功能

* **cli:** 支持交互式创建提交并新增跳过工作区检查选项 ([c55482f](https://github.com/peiyanlu/release/commit/c55482feacb4131b07bca2d9d49afb1ce8baea57))

### 🐛 Bug 修复

* **deps:** 升级 npm 依赖 ([90e683f](https://github.com/peiyanlu/release/commit/90e683f4229d2e8bde928010ded3fbe42860c3d8))
* 仅对版本已变更的项目执行发布与 Release 生成 ([3dcc8e2](https://github.com/peiyanlu/release/commit/3dcc8e21e581cbfaccbe6b70790ffa0fac9dc2ee))

### ♻️ 代码重构

* **releaser-cli:** 重构版本提示并迁移工具依赖 ([f36494a](https://github.com/peiyanlu/release/commit/f36494a37f1ef81129764e1dd79ef5004774b2c7))

## <small>[2.1.3](https://github.com/peiyanlu/release/compare/v2.1.2...v2.1.3) (2026-11-07)</small>

### 🐛 Bug 修复

* 移除 hasBump 过滤以处理所有项目 ([84ffbbe](https://github.com/peiyanlu/release/commit/84ffbbe9048e9166ee52335720e4601956be36d5))

## <small>[2.1.2](https://github.com/peiyanlu/release/compare/v2.1.1...v2.1.2) (2026-11-05)</small>

### 🐛 Bug 修复

* **changelog:** 修复提交正文的缩进与列表格式处理 ([c924197](https://github.com/peiyanlu/release/commit/c92419759e40d98e3e3497e2e403b4a74cb088a6))
* **releaser-cli:** 修复版本选择提示与首次发布流程 ([be9aadc](https://github.com/peiyanlu/release/commit/be9aadcc96840ad61e23e8a62a19f0e55151febf))

## <small>[2.1.1](https://github.com/peiyanlu/release/compare/v2.1.0...v2.1.1) (2026-11-02)</small>

### 🐛 Bug 修复

* **action:** 修复 Corepack 初始化与依赖安装 ([fea9aff](https://github.com/peiyanlu/release/commit/fea9affae6d8043d92705411f286156fc924d176))

### 📝 文档

* 补充 PR 权限与 Trusted Publishing 配置说明 ([64d9fcb](https://github.com/peiyanlu/release/commit/64d9fcb4d27414497e83d4a3620c4e49d9005a56))

## [2.1.0](https://github.com/peiyanlu/release/compare/v2.0.0...v2.1.0) (2026-11-02)

### ✨ 新功能

* 支持交互式初始化配置 ([f04718e](https://github.com/peiyanlu/release/commit/f04718eeea81051d3d393c14d7423f69849d7433))

### 🐛 Bug 修复

* 仅处理 GitHub Actions bot 的发布提交 ([5b19221](https://github.com/peiyanlu/release/commit/5b19221d8c68d77b92032608d52e3f2a6129b7b0))
* 修复 action 依赖缺失 ([4832429](https://github.com/peiyanlu/release/commit/483242975b81d17f66579597975a05b65c13a8b0))
* 将 package.json 静态导入改为运行时读取 ([0c7d773](https://github.com/peiyanlu/release/commit/0c7d773b5a2bbeaf4e0e99c6b7c8b536d2e9747d))
* 调整 CLI 模式中的跳过流程逻辑 ([d42c7a4](https://github.com/peiyanlu/release/commit/d42c7a4c53c2bf9a14610b241a2f936b324e57e3))

## [2.0.0](https://github.com/peiyanlu/release/compare/v1.3.1...v2.0.0) (2026-10-22)

### ⚠ BREAKING CHANGES

* 重构 release 实现 ([9bbbe3f](https://github.com/peiyanlu/release/commit/9bbbe3f6eff892b2c736afb9cb1b67d55ae86cec))

### ✨ 新功能

* 重构 release 实现 ([9bbbe3f](https://github.com/peiyanlu/release/commit/9bbbe3f6eff892b2c736afb9cb1b67d55ae86cec))

## <small>[1.3.1](https://github.com/peiyanlu/release/compare/v1.3.0...v1.3.1) (2026-08-18)</small>

### 🐛 Bug 修复

* 修复链接打开失败 ([67322ed](https://github.com/peiyanlu/release/commit/67322ed26090470fecd5355c68ba21ec8376b96f))

## [1.3.0](https://github.com/peiyanlu/release/compare/v1.2.1...v1.3.0) (2026-08-18)

### ✨ 新功能

* 优化配置文件生成 ([4b37b00](https://github.com/peiyanlu/release/commit/4b37b000976b26d96ff28947537520cf10c834d9))
* 支持配置简短的 Release Notes ([5e3c607](https://github.com/peiyanlu/release/commit/5e3c607613acbe613b2eccb14358ed0b25e90e38))
* 支持提交 scope 处理 ([96b9e76](https://github.com/peiyanlu/release/commit/96b9e76d1e994adabdc087b54c66ac8d5814fb19))

### 🐛 Bug 修复

* 修复流程跳过逻辑 ([680cfb9](https://github.com/peiyanlu/release/commit/680cfb9cf57eab45023e07fcc569be32c29d161f))

## <small>[1.2.1](https://github.com/peiyanlu/release/compare/v1.2.0...v1.2.1) (2026-08-10)</small>

### 🐛 Bug 修复

* 修复命令行参数默认值问题 ([5559b7c](https://github.com/peiyanlu/release/commit/5559b7c5fb74b2a0513085c6a3462994b6e4b5af))

## [1.2.0](https://github.com/peiyanlu/release/compare/v1.1.2...v1.2.0) (2026-08-03)

### ✨ 新功能

* 添加发布清理配置 ([f1d14d9](https://github.com/peiyanlu/release/commit/f1d14d99f8ae13e7181cdb9a60e58da17fd62cee))

## <small>[1.1.2](https://github.com/peiyanlu/release/compare/v1.1.1...v1.1.2) (2026-07-09)</small>

### 🐛 Bug 修复

* 修复公共类型引用外部依赖问题 ([5834774](https://github.com/peiyanlu/release/commit/5834774c72f7972ebc8b4ec3c5d215245f3d2db6))

## <small>[1.1.1](https://github.com/peiyanlu/release/compare/v1.1.0...v1.1.1) (2026-07-04)</small>

### 🐛 Bug 修复

* 修复版本推断失败 ([e3aac6d](https://github.com/peiyanlu/release/commit/e3aac6dca8b0ff56c1b5d43a854484d95da77610))

## [1.1.0](https://github.com/peiyanlu/release/compare/v1.0.0...v1.1.0) (2026-07-03)

### ✨ 新功能

* 增强 changelog 生成 ([7875d44](https://github.com/peiyanlu/release/commit/7875d4473600acc022d2faf24f5551ecd5a9c23c))

### 🐛 Bug 修复

* 修复新版 conventional-changelog 模板兼容性 ([9cd1ea6](https://github.com/peiyanlu/release/commit/9cd1ea68edec5d98a410685a6f016cfe5023eb94))

## [1.0.0](https://github.com/peiyanlu/release/compare/v0.0.16...v1.0.0) (2026-07-01)

### ⚠ BREAKING CHANGES

* 重构 CLI 参数 ([2ea0ff1](https://github.com/peiyanlu/release/commit/2ea0ff17e41cf1bed15dd93d3f54b6d95dea9f71))
  * - `ignoreGit` -> `skipGit`
    - `ignoreNpm` -> `skipNpm`
    - `ignoreGithub` -> `skipGithub`
    - `requireWorkDirClean` -> `requireCleanWorkingTree`

### ✨ 新功能

* 重构 CLI 参数 ([2ea0ff1](https://github.com/peiyanlu/release/commit/2ea0ff17e41cf1bed15dd93d3f54b6d95dea9f71))

## <small>[0.0.16](https://github.com/peiyanlu/release/compare/v0.0.15...v0.0.16) (2026-06-29)</small>

### 🧹 其他更新

* 代码清理 ([ed2a1af](https://github.com/peiyanlu/release/commit/ed2a1afc27a46b0a0a500b29a6e7a31725f5e08f))

## <small>[0.0.15](https://github.com/peiyanlu/release/compare/v0.0.14...v0.0.15) (2026-06-15)</small>

### ✨ 新功能

* 支持生成指定数量的变更日志 ([4dc736d](https://github.com/peiyanlu/release/commit/4dc736d399512e3779cf48e0f06f35b38efe964d))

## <small>[0.0.14](https://github.com/peiyanlu/release/compare/v0.0.13...v0.0.14) (2026-06-12)</small>

### 🎨 用户体验

* 优化信息提示 ([389e055](https://github.com/peiyanlu/release/commit/389e0555b2f4c1dcb9780e8d33e5283f01bc3b75))

## <small>[0.0.13](https://github.com/peiyanlu/release/compare/v0.0.12...v0.0.13) (2026-06-12)</small>

### ✨ 新功能

* 发布流程中断不影响后续流程 ([fa215af](https://github.com/peiyanlu/release/commit/fa215aff7a3b7ffcad5331b21925c5e4eed36989))
* 支持显示配置跳过流程 ([c92dffa](https://github.com/peiyanlu/release/commit/c92dffa41a8d06ced32b4e789a26a3193a16358c))

### 🤖 CI

* 优化依赖更新策略 ([aba48e2](https://github.com/peiyanlu/release/commit/aba48e2a34692d5d9f9302710e58c0ec12a109b0))

## <small>[0.0.12](https://github.com/peiyanlu/release/compare/v0.0.11...v0.0.12) (2026-04-23)</small>

### 🧹 其他更新

* 依赖升级 ([97f7ba6](https://github.com/peiyanlu/release/commit/97f7ba64006b1f45de1ec1ae438547974cd9e912))

### 🤖 CI

* 版本升级 ([4fb5024](https://github.com/peiyanlu/release/commit/4fb502463b1b951b6ca2420407a926ddf0cc1985))

## <small>[0.0.11](https://github.com/peiyanlu/release/compare/v0.0.10...v0.0.11) (2026-04-23)</small>

### 🐛 Bug 修复

* 修复 GitHub Action 编译错误 ([7d81be1](https://github.com/peiyanlu/release/commit/7d81be162f721c6b02c09066a584d49b634c1fb6))

## <small>[0.0.10](https://github.com/peiyanlu/release/compare/v0.0.9...v0.0.10) (2026-04-23)</small>

### 🐛 Bug 修复

* 修复 GitHub Action 错误 ([fe8444f](https://github.com/peiyanlu/release/commit/fe8444f655c2c55618eb150039902d62140a62d8))

## <small>[0.0.9](https://github.com/peiyanlu/release/compare/v0.0.8...v0.0.9) (2026-04-23)</small>

### ✨ 新功能

* 支持 GitHub Action ([affb497](https://github.com/peiyanlu/release/commit/affb49796c28545d8a800365346da724d449f5ee))

### ⚙️ 配置

* 升级 tsconfig ([c480be7](https://github.com/peiyanlu/release/commit/c480be7e827dd0f72d00c4073ee1963b5bbf03b8))

## <small>[0.0.8](https://github.com/peiyanlu/release/compare/v0.0.7...v0.0.8) (2026-04-23)</small>

### 🧹 其他更新

* 依赖升级 ([271e4fd](https://github.com/peiyanlu/release/commit/271e4fd9b9bde04a583cda6b66f0291ae84bd93d))

## <small>[0.0.7](https://github.com/peiyanlu/release/compare/v0.0.6...v0.0.7) (2026-04-23)</small>

### 🐛 Bug 修复

* 修复 prepare 子命令错误 ([6505ba9](https://github.com/peiyanlu/release/commit/6505ba94319cb1feb5ddc3986db02cf47f4a7062))

## <small>[0.0.6](https://github.com/peiyanlu/release/compare/v0.0.5...v0.0.6) (2026-04-23)</small>

### ✨ 新功能

* 拆分工作流程支持分步工作 ([80cc927](https://github.com/peiyanlu/release/commit/80cc92717b2f7cf6ab08d19564b293712ca75ce3))
* 增强 changelog 生成和获取 ([70c0e83](https://github.com/peiyanlu/release/commit/70c0e83230ee43076819b539f8a8b859302bc80f))

## <small>[0.0.5](https://github.com/peiyanlu/release/compare/v0.0.4...v0.0.5) (2026-04-23)</small>

### 🐛 Bug 修复

* 修复 Github release url 错误 ([f539bcf](https://github.com/peiyanlu/release/commit/f539bcf511f1995817ecbf4cbfcccac79bc27322))
* 修复 monorepo 打印 changelog 范围计算错误 ([ef5db36](https://github.com/peiyanlu/release/commit/ef5db36a4de22e12c12747c56d1f8e00d6888664))

### 📝 文档

* **readme:** 更新 shields.io 徽章 ([2b334af](https://github.com/peiyanlu/release/commit/2b334af927e99ab5183098cf3b716cd9e14bef74))

## <small>[0.0.4](https://github.com/peiyanlu/release/compare/v0.0.3...v0.0.4) (2026-04-23)</small>

### ✨ 新功能

* 优化 CHANGELOG 生成 ([bd09792](https://github.com/peiyanlu/release/commit/bd097922889323ca7ed1fc27d82d71d9864f3718))
* monorepo 支持 ([1628220](https://github.com/peiyanlu/release/commit/1628220993a279600f13362833da0ce5c236001f))

## <small>0.0.3 (2026-04-23)</small>

### ✨ 新功能

* 新代码提交 ([b96bb79](https://github.com/peiyanlu/release/commit/b96bb798a3e7839c49a2a179a0c36eda4ccfeda4))
