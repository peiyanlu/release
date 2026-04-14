# Release Project

<p>
  <a href="https://www.npmjs.com/package/@peiyanlu/release" target="_blank">
    <img src="https://img.shields.io/badge/npm-@peiyanlu/release-blue.svg?logo=npm" alt="NPM Package" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/release" target="_blank">
    <img src="https://img.shields.io/npm/v/@peiyanlu/release.svg" alt="NPM Version" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/release" target="_blank">
    <img src="https://img.shields.io/npm/l/@peiyanlu/release.svg" alt="Package License" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/release" target="_blank">
    <img src="https://img.shields.io/npm/dm/@peiyanlu/release.svg" alt="NPM Downloads" />
  </a>
</p>

🚀 **一个用于自动化版本管理与包发布的通用 CLI 工具**

提供完整的发布工作流自动化：

- [**Bump 版本号**][1]
- [**自动生成 Changelog**][2]
- [**Git**：暂存 → 提交 → 打 Tag → 推送][3]
- [**发布到 npm**][4]
- [**GitHub**：创建 Release][5]
- [**Monorepo**][6]

## 安装

```bash
npm install -D @peiyanlu/release
# 或
yarn add -D @peiyanlu/release
# 或
pnpm add -D @peiyanlu/release
```

## CLI

```bash
release [release-type] [options]
```

`release-type` 用于指定版本升级类型，支持：

- `patch`：Bug 修复版本（默认）
- `minor`：向后兼容的新功能
- `major`：不向后兼容的破坏性更新

当未传入 `release-type` 时，默认使用 `patch`

```bash
pnpm release minor --ci
```

### 通用参数

| 参数                 | 说明                                                         |
|--------------------|------------------------------------------------------------|
| `-v, --version`    | 输出当前 CLI 版本并退出                                             |
| `-h, --help`       | 显示帮助信息                                                     |
| `-n, --dry-run`    | 空跑模式，展示将要执行的发布流程但不做任何修改                                    |
| `--show-release`   | 打印即将发布的版本号并退出                                              |
| `--show-changelog` | 打印生成的 Changelog 并退出                                        |
| `--ci`             | 启用 CI 模式：禁用交互提示，缺少必要参数时直接失败；GitHub Actions 等 CI/CD 环境中默认启用 |

### Prepare 相关参数

| 参数          | 说明                       |
|-------------|--------------------------|
| `--prepare` | 仅仅变更版本、提交代码、创建 Tag、推送到远程 |

```bash
pnpm release minor --prepare --ci --package pkg-a
```

> 后续可以通过 tag 进行 npm 发布和创建 GitHub release

### Monorepo / CI 相关参数

| 参数                    | 说明                               |
|-----------------------|----------------------------------|
| `-p, --package <pkg>` | 指定要发布的子包名称（仅用于 Monorepo 的 CI 场景） |

```bash
pnpm release minor --ci --package pkg-a
```

### npm 发布相关参数

| 参数             | 说明                             |
|----------------|--------------------------------|
| `--otp <code>` | npm 发布时使用的一次性验证码（用于开启 2FA 的账户） |

> 当使用 **Trusted Publishing（OIDC）** 时，通常无需提供 `--otp`。


## 配置

发布流程可以通过配置文件进行自定义。  
如果项目中**未提供配置文件**，工具会自动使用**内置默认配置**。

默认配置适用于 **单仓库（Single Repo）** 项目。  
当项目为 **Monorepo** 结构时，**必须显式提供配置文件**，并开启 Monorepo 模式以正确识别各个子包。

支持的配置文件格式：

```
release.config.{ts,mts,js,mjs}
```

示例配置：

```ts
// release.config.ts
import { defineConfig } from '@peiyanlu/release'


export default defineConfig({
  isMonorepo: false,
  packages: [],
  getPkgDir: (pkg) => `.`,
  toTag: (pkg: string, version: string) => `v${ version }`,
  tagPrefix: undefined,
  
  git: {
    commit: true,
    tag: true,
    push: true,
    commitMessage: 'chore(release): ${tag}',
    tagMessage: '${tag}',
  },
  npm: {
    publish: true,
  },
  github: {
    release: true,
    releaseName: '${tag}',
  },
})
```

### Monorepo 配置

在 Monorepo 场景下，需要显式声明仓库结构、子包列表以及 Tag / Changelog 的生成规则。

示例配置：

```ts
// release.config.ts
import { defineConfig } from '@peiyanlu/release'


export default defineConfig({
  isMonorepo: true,
  packages: [ 'demo-a', 'demo-b' ],
  getPkgDir: (pkg) => `packages/${ pkg }`,
  toTag: (pkg: string, version: string) => `${ pkg }@${ version }`,
  tagPrefix: (pkg: string) => `${ pkg }@`,
  
  git: {
    commit: true,
    tag: true,
    push: true,
    commitMessage: 'chore(release): ${tag}',
    tagMessage: '${tag}',
  },
  npm: {
    publish: true,
  },
  github: {
    release: true,
    releaseName: '${tag}',
  },
})
```

### 使用 CLI 生成配置文件

工具内置 `init` 子命令，可用于快速生成发布配置文件。

```bash
release init
```

#### init 参数说明

| 参数               | 说明                  |
|------------------|---------------------|
| `-f, --force`    | 覆盖已存在的配置文件          |
| `-m, --monorepo` | 生成 Monorepo 项目的配置模板 |

#### 行为说明

- 自动检测项目模块类型（ESM / CJS）
- 自动检测是否使用 TypeScript
- 根据检测结果生成对应格式的配置文件：
    - `release.config.ts`
    - `release.config.mts`
    - `release.config.js`
    - `release.config.mjs`
- 若配置文件已存在且未使用 `--force`，将终止并提示错误

## Bump 版本号

工具内置语义化版本（Semantic Versioning）管理能力，可自动更新`package.json` 中的版本号：

- 支持标准版本类型：
    - `major`：不兼容的重大变更（1.x.x → 2.0.0）
    - `minor`：向后兼容的新功能（1.1.x → 1.2.0）
    - `patch`：向后兼容的 Bug 修复（1.1.1 → 1.1.2）
- 支持**预发布版本**：
    - `alpha`、`beta`、`rc` 等（如 `1.2.0-alpha.1`）
- 支持**自定义版本号**：
    - 可直接指定目标版本（如 `1.3.0`）
- 支持 **--show-release** 预览：
    - 在不修改文件的情况下查看即将升级到的版本

版本更新后，工具会自动同步到后续的 Git Tag、GitHub Release 与 npm 发布流程。

## Changelog

基于 Git **Conventional Commits** 规范提交历史自动生成结构化 Changelog

COMMIT_TYPES：

- 默认：`feat | feature | fix | perf | revert | docs | style | chore | refactor | test | build | ci`
- 自定义：`config | deps | security | i18n | ux | hotfix`

支持 **--show-changelog** 预览模式：

- 仅展示用于生成 Changelog 的 Commits
- 不会修改任何文件或提交历史

## Git 自动化

自动执行标准发布流程：

**stage → commit → tag → push**

并支持推送到**任意 Git 远程仓库**，适配单仓库与多仓库场景。


## npm 发布（Trusted Publishing）

工具会根据 `package.json` 中的 `publishConfig` 配置，将包发布到对应的 npm 仓库。

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

自 **2025 年 7 月** 起，GitHub CI 已支持 npm 的 **Trusted Publishing（可信发布）** + **OIDC**：

- ✅ 无需长期有效的 npm Token
- ✅ 使用 OpenID Connect 进行身份验证
- ✅ 自动生成 provenance（来源证明）

适用于 CI/CD 场景下的**安全、无 Token** 自动化发布。


## GitHub Releases

GitHub Release 可基于 Git Tag 自动创建，并支持附带：

- **Release Notes（发布说明）**
- **构建产物（Assets）**

支持两种创建方式：

1. **自动化方式**：使用 `GITHUB_TOKEN` 直接创建
2. **手动方式**：通过 GitHub Web UI 创建（工具预填充字段）

## Monorepo

工具默认配置偏向于 **单仓库（Single Repo）** 项目，但是可以通过配置使其支持 **Monorepo**

## 流程拆分

### 本地准备 Release（仅创建 Tag）

在本地完成版本确认与变更准备：

- 确定下一个版本
- 更新 `package.json` / `CHANGELOG`
- 创建发布提交
- 创建并推送 git 标签

### CI/CD 自动发布（由 Tag 触发）

当 Tag 推送到远端后，CI/CD 自动执行：

- 发布到 npm
- 创建 GitHub Release

### 示例用法

- 发布到 npm
```ts
// publishCI.ts

import { publishTagToNpm } from '@peiyanlu/release'
await publishTagToNpm({})
```

```json5
// package.json

{
  "scripts": {
    "ci-publish": "tsx src/publishCI.ts"
  }
}
```

```yaml
# .github/workflows/publish.yml

jobs:
  publish:
    name: Publish
    runs-on: ubuntu-latest
    
    steps:
      - name: Publish
        run: npm i -g npm@^11.5.2 && pnpm run ci-publish "$REF_NAME"
        env:
          REF_NAME: ${{ github.ref_name }}
```

- 创建 GitHub Release
```yaml
# .github/workflows/release.yml

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    
    steps:
      - name: Release
        uses: peiyanlu/release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: |
            Please refer to [CHANGELOG.md](./CHANGELOG.md) for details.
          draft: false
```

## Dry Run

```bash
pnpm release --dry-run
```

可以**完整展示发布流程，但不会执行任何实际修改**，适合调试和验证配置。


## 相关链接

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
- [GitHub Releases 官方文档](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

[1]: #bump-版本号

[2]: #changelog

[3]: #git-自动化

[4]: #npm-发布trusted-publishing

[5]: #github-releases

[6]: #monorepo
