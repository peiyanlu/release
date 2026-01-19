# Release Project

<p>
  <a href="https://www.npmjs.com/package/@peiyanlu/create-release" target="_blank">
    <img src="https://img.shields.io/badge/npm-@peiyanlu/create--release-blue.svg?logo=npm" alt="NPM Package" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/create-release" target="_blank">
    <img src="https://img.shields.io/npm/v/@peiyanlu/create-release.svg" alt="NPM Version" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/create-release" target="_blank">
    <img src="https://img.shields.io/npm/l/@peiyanlu/create-release.svg" alt="Package License" />
  </a>
  <a href="https://www.npmjs.com/package/@peiyanlu/create-release" target="_blank">
    <img src="https://img.shields.io/npm/dm/@peiyanlu/create-release.svg" alt="NPM Downloads" />
  </a>
</p>

🚀 **一个用于自动化版本管理与包发布的通用 CLI 工具**

提供完整的发布工作流自动化：

- [**Bump 版本号**][1]
- [**自动生成 Changelog**][2]
- [**Git**：暂存 → 提交 → 打 Tag → 推送][3]
- [**发布到 npm**][4]
- [**GitHub**：创建 Release][5]

## 安装

```bash
npm install -D @peiyanlu/release
# 或
yarn add -D @peiyanlu/release
# 或
pnpm add -D @peiyanlu/release
```

## 配置

发布流程可以通过配置文件进行自定义。如果项目中**未提供配置文件**，工具会自动使用**内置默认配置**。

支持的配置文件格式：

```
release.config.{ts,mts,cts,js,mjs,cjs}
```

示例配置：

```ts
// release.config.ts
import { defineConfig } from '@peiyanlu/release'


export default defineConfig({
  git: {
    commitMessage: 'chore(release): ${version}',
    tagName: '${version}',
  },
  npm: {
    publish: true,
  },
  github: {
    release: true,
    autoGenerate: false,
  },
})
```

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

基于 Git 提交历史自动生成结构化 Changelog，底层依赖以下命令分析提交范围：

```bash
git log --pretty=format:"%s %h %H" {from}...{to}
```

支持 **--show-changelog** 预览模式：

- 仅展示用于生成 Changelog 的 Commits
- 不会修改任何文件或提交历史

可与 **Conventional Commits** 规范结合使用，实现规范化、可读性更高的变更日志。


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
