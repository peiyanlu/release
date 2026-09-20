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

- Node.js 20 或更新版本
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

不指定 `release-type` 时，工具根据提交记录计算升级类型。可指定 `major`、`minor`、`patch` 或 `prerelease`。

```sh
pnpm exec release --dry-run
pnpm exec release minor --dry-run
pnpm exec release --ci
```

常用选项：

| 选项             | 说明                     |
|------------------|--------------------------|
| `-n, --dry-run`  | 预览发布步骤，不写入变更 |
| `--ci`           | CI 模式，关闭交互式流程  |
| `--skip-git`     | 跳过 Git 检查和操作      |
| `--skip-publish` | 跳过包发布               |
| `--skip-release` | 跳过仓库 Release         |
| `-v, --version`  | 显示版本                 |
| `-h, --help`     | 显示完整帮助             |

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
  checkout: { branch: 'release' },
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

本仓库也可作为 Action 使用。Action 要求配置文件定义 `project`，并使用 `github-token` 访问 GitHub API。完整工作流默认值为 `full`。

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
          
      - run: pnpm install --frozen-lockfile
        
      - uses: peiyanlu/release@v2
        with:
          workflow: full
          github-token: ${{ secrets.GITHUB_TOKEN }}
          npm-token: ${{ secrets.NPM_TOKEN }}
```

确保仓库中已提交 `release.config.ts`，Action 能在 checkout 的项目中加载它。若发布到 npm，将 `npm-token` 配置为仓库 secret；它会作为 `NODE_AUTH_TOKEN` 提供给发布步骤。也可在仓库配置 npm Trusted Publishing。

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
