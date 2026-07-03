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
