# @peiyanlu/release


[![module](https://img.shields.io/badge/package-ESM--only-FFE536.svg?logo=npm)](https://nodejs.org/api/esm.html)
[![npm](https://img.shields.io/npm/v/@peiyanlu/release.svg)](https://npmjs.com/package/@peiyanlu/release)
[![license](https://img.shields.io/npm/l/@peiyanlu/release.svg)](https://npmjs.com/package/@peiyanlu/release)
[![downloads](https://img.shields.io/npm/dm/@peiyanlu/release.svg)](https://npmjs.com/package/@peiyanlu/release)
[![node](https://img.shields.io/node/v/@peiyanlu/release.svg)](https://nodejs.org)
[![size](https://packagephobia.com/badge?p=@peiyanlu/release)](https://packagephobia.com/result?p=@peiyanlu/release)
[![deps](https://img.shields.io/librariesio/release/npm/@peiyanlu/release)](https://libraries.io/npm/%40peiyanlu%2Frelease)
[![build](https://img.shields.io/github/actions/workflow/status/peiyanlu/release/test.yaml?branch=master&logo=github)](https://github.com/peiyanlu/release/actions)
[![coverage](https://coveralls.io/repos/github/peiyanlu/release/badge.svg?branch=master)](https://coveralls.io/github/peiyanlu/release?branch=master)

一个基于 [Conventional Commits](https://www.conventionalcommits.org/) 自动升级版本、生成变更日志并完成发布的工具。

- 📄 使用 [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) 分析提交记录、计算下一个版本并生成变更日志。
- 🧩 提供通用的项目与托管扩展接口，可支持自定义项目类型、清单格式和 Git 托管平台。
- 📦 内置 `package.json`、Node.js GitHub Action 项目类型，以及 npm/pnpm 发布和 workspace monorepo 支持。
- 🚀 提供 CLI 和 [GitHub Action](https://github.com/peiyanlu/release) 两种发布入口，支持本地及 CI 自动化发布。

## 功能与扩展点

提供通用扩展接口，并内置项目与发布实现：

| 能力                       | 内置实现                                                                     |
|----------------------------|------------------------------------------------------------------------------|
| 抽象扩展接口               | `Project`、`MonorepoProject`、`ProjectManifest`、`GitRepositoryHosting`      |
| `package.json` 项目        | `PackageJsonProject`、`PackageJsonMonorepoProject`                           |
| 项目清单                   | `PackageJsonManifest`、`ComposedProjectManifest`                             |
| GitHub 托管                | `GithubHosting`                                                              |
| npm / pnpm 发布支持        | `NpmProject`、`PnpmProject`、`NpmWorkspacesProject`、`PnpmWorkspacesProject` |
| Node.js GitHub Action 项目 | `NodeGithubActionProject`                                                    |
| 发布入口                   | `ReleaserCli`、`ReleaserGithubAction`                                        |

单包项目可使用 `NpmProject` 或 `PnpmProject`；多包项目可使用对应的 workspace 实现。通过 `Project`、`MonorepoProject`、`ProjectManifest` 和 `GitRepositoryHosting`，也可扩展其他项目类型、清单格式和托管平台。

## 环境要求

- Node.js 22.18+
- Git 仓库
- npm 发布需要可用的 npm 身份验证；GitHub API 操作需要 GitHub token

## 安装

```sh
pnpm add -D @peiyanlu/release
# 或 npm install --save-dev @peiyanlu/release
```

## CLI

```sh
release [release-type] [options]
```

不指定 `release-type` 时，会根据提交记录推断并预选升级类型；CI 模式下自动采用该类型。可指定 `major`、`minor`、`patch` 或 `prerelease`。

```sh
pnpm exec release --dry-run
pnpm exec release minor --dry-run
pnpm exec release --ci
```

常用选项：

| 选项             | 说明                                               |
|------------------|----------------------------------------------------|
| `-n, --dry-run`  | 预览发布步骤，不写入变更                           |
| `--ci`           | CI 模式，关闭交互式流程                            |
| `--skip-bump`    | 跳过项目版本更新                                   |
| `--skip-git`     | 跳过 Git 提交、标签、推送；版本推断仍读取 Git 历史 |
| `--skip-publish` | 跳过项目发布                                       |
| `--skip-release` | 跳过仓库托管服务上创建发布                         |
| `-v, --version`  | 显示版本                                           |
| `-h, --help`     | 显示完整帮助                                       |

## 配置

CLI 会从当前项目根目录加载第一个存在的 `release.config.ts`、`.mts`、`.js` 或 `.mjs` 文件。CLI 要求配置文件提供 `project` 和 `hosting`；GitHub Action 只要求配置文件提供 `project`，提供的 `hosting` 将被忽略。

下面的单包配置使用 pnpm 项目，并提供 GitHub 托管功能：

```ts
// release.config.ts
import { defineConfig, GithubHosting, PnpmProject } from '@peiyanlu/release'


export default defineConfig({
  project: new PnpmProject(),
  hosting: new GithubHosting({
    token: process.env.GITHUB_TOKEN,
  }),
  bump: { prerelease: 'beta' },
  commit: { sign: false },
  publish: { tag: 'latest' },
})
```

`defineConfig` 接受 `project`、可选的 `hosting`，以及 `checkout`、`bump`、`commit`、`tag`、`push`、`publish`、`release`、`pullRequest` 等步骤选项。项目和步骤选项的 TypeScript 类型可用于编辑器提示。

### pnpm workspace monorepo

当 pnpm workspace 用于管理多个包时，可使用 `PnpmWorkspacesProject`。`mode` 为 `fixed` 时所有包共用版本；`independent` 时各包可单独升级。workspace 包由根目录 `pnpm-workspace.yaml` 中的 `packages` 模式发现。

```ts
// release.config.ts
import { defineConfig, GithubHosting, PnpmWorkspacesProject } from '@peiyanlu/release'


export default defineConfig({
  project: new PnpmWorkspacesProject({ mode: 'fixed' }),
  hosting: new GithubHosting({
    token: process.env.GITHUB_TOKEN,
  }),
})
```

## GitHub Action

本仓库也可作为 Action 使用。Action 要求配置文件定义 `project`，并使用 `github-token` 访问 GitHub API。`workflow` 的默认值为 `full`。

```yaml
name: Release

on:
  issue_comment:
    types: [ created, deleted ]
  push:
    branches:
      - master

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          fetch-tags: true
      
      - uses: pnpm/action-setup@v6
        with:
          version: 12
      
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org/
          package-manager-cache: false
      
      - run: pnpm install --frozen-lockfile
      
      - uses: peiyanlu/release@master
        with:
          workflow: full
          github-token: ${{ secrets.GITHUB_TOKEN }}
          npm-token: ${{ secrets.NPM_TOKEN }}
```

确保仓库中已提交 `release.config.ts`，Action 会从检出的项目中加载该文件。若发布到 npm，将 `npm-token` 配置为仓库 secret；它会作为 `NODE_AUTH_TOKEN` 提供给发布步骤。也可在仓库配置 npm Trusted Publishing。

### Pull requests

在仓库中 `Settings → Actions → General → Workflow permissions` 启用 `Allow GitHub Actions to create and approve pull requests`。

### npm Trusted Publishing

[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) 使用 GitHub Actions 的 OIDC 身份发布 npm 包，不需要长期有效的 `NPM_TOKEN`。

1. **确认条件**：包已至少发布过一个版本，使用公开 npm registry 和 GitHub 托管的 runner，在 package.json 中提供 `repository.url`。Trusted Publisher 按包和 workflow 文件分别注册。
2. **在 npm 注册发布者**：打开 [npmjs.com](https://www.npmjs.com/) 上对应包的 **Settings → Trusted Publisher → GitHub Actions**：填写 GitHub 用户或组织名、仓库名和 workflow 文件名（例如 `release.yml`），勾选 `Allow npm publish`。
   如果 workflow 使用 GitHub environment，也填写相同的 environment 名称。
3. **调整发布 job**：在发布 job 中授予 `id-token: write` 权限，使用 Node.js 22.14.0 或更高版本，以确保 npm 版本为 11.5.1 或更高版本，并从 `actions/setup-node` 移除 `registry-url`（v7 以下），从 Action step 输入中移除 `npm-token`。例如：

```yaml
name: Release

on:
  issue_comment:
    types: [ created, deleted ]
  push:
    branches:
      - master

permissions:
  contents: write
  pull-requests: write
  id-token: write                                              # 新增

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          fetch-tags: true
      
      - uses: pnpm/action-setup@v6
        with:
          version: 12
      
      - uses: actions/setup-node@v7
        with:
          node-version: 24                                     # npm 11.5.1+
          registry-url: https://registry.npmjs.org/            # v7 以下移除
          package-manager-cache: false
      
      - run: pnpm install --frozen-lockfile
      
      - uses: peiyanlu/release@master
        with:
          workflow: full
          github-token: ${{ secrets.GITHUB_TOKEN }}
          #npm-token: ${{ secrets.NPM_TOKEN }}                 # 移除
```

配置正确后，npm/pnpm 会自动通过 OIDC 认证，公开仓库发布的版本还会自动附带 provenance（来源证明），无需额外开启。

若出现 `ENEEDAUTH`：
核对 npm 包是否已存在、注册的仓库和 workflow 文件名、GitHub environment，以及发布 job 是否有 `id-token: write` 并使用满足版本要求的 npm CLI。

### Snapshots

为 `workflow_dispatch` 添加 `snapshot` 字符串输入：手动运行时输入非空值会执行快照 job；push 和 issue comment 事件没有该输入，因此仍按原有流程执行。

```yaml
name: Release

on:
  issue_comment:
    types: [ created, deleted ]
  push:
    branches:
      - master
  workflow_dispatch:
    inputs:
      snapshot:
        description: Snapshot publish tag.
        type: string

jobs:
  check:
    if: inputs.snapshot == ''
    # 保留现有 check job 的其余配置
  
  pull-request:
    needs: check
    if: needs.check.outputs.workflow == 'pull-request'
    # 保留现有 pull-request job 的其余配置
  
  release:
    needs: check
    if: needs.check.outputs.workflow == 'release'
    # 保留现有 release job 的其余配置
  
  snapshot:
    if: inputs.snapshot != ''
    name: Snapshot
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          fetch-tags: true
      
      - uses: pnpm/action-setup@v6
        with:
          version: 12
      
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org/
          package-manager-cache: false
      
      - run: pnpm install --frozen-lockfile
      
      - uses: peiyanlu/release@master
        with:
          workflow: snapshot
          github-token: ${{ secrets.GITHUB_TOKEN }}
          bump-snapshot: ${{ inputs.snapshot }}
```

在 GitHub Actions 页面手动运行 workflow 并填写 snapshot 为 canary：此时 `check`、`pull-request` 和 `release` 不执行，快照 job 发布 `1.2.0-canary.<timestamp>`。

Trusted Publisher 注册绑定到具体 workflow 文件。要让快照发布也使用同一注册，建议将快照 job 放在已注册的 workflow 中，而不是另建 workflow。

### 参数

`workflow` 支持：

| 值             | 行为                                              |
|----------------|---------------------------------------------------|
| `full`         | 创建发布 Pull Request，并在发布提交上执行发布     |
| `pull-request` | 创建或更新发布 Pull Request                       |
| `release`      | 执行发布提交对应的发布流程                        |
| `snapshot`     | 发布临时快照版本                                  |
| `check`        | 检查事件上下文，并输出是否继续及应执行的 workflow |

主要 Action 输入：

| 输入                         | 说明                                                |
|------------------------------|-----------------------------------------------------|
| `github-token`               | 必填，GitHub API token                              |
| `npm-token`                  | 可选，npm token                                     |
| `workflow`                   | 工作流，默认 `full`                                 |
| `checkout-branch`            | 发布分支，默认 `release-branch`                     |
| `bump-version`               | 指定版本号                                          |
| `bump-as`                    | 版本类型：`major`、`minor`、`patch` 或 `prerelease` |
| `bump-prerelease`            | 预发布标识，如 `beta`                               |
| `bump-snapshot`              | 快照版本标识                                        |
| `bump-first-release`         | 是否按首次发布处理                                  |
| `bump-skip`                  | 跳过版本升级                                        |
| `bump-by-project`            | monorepo 各项目的版本升级选项 JSON                  |
| `maintenance-branch-enabled` | 是否创建维护分支                                    |
| `publish-skip`               | 跳过项目发布                                        |
| `publish-access`             | npm access：`public` 或 `restricted`                |
| `publish-tag`                | npm dist-tag 或 Action 发布别名                     |

## Conventional Commits 与版本

工具根据提交历史和 Conventional Commits 生成变更日志并计算版本。通常 `feat` 触发 minor，`fix`、`perf` 等触发 patch，破坏性变更触发 major；文档、测试、构建等不一定产生版本升级。可使用 `--dry-run` 预览结果。

## 许可证

[MIT](./LICENSE)
