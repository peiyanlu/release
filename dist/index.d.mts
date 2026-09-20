import { AnyFunction, Dict, Simplify } from "@peiyanlu/ts-utils";
import { ConventionalChangelog, Preset } from "conventional-changelog";
import { CommitType } from "conventional-changelog-conventionalcommits";
import { FinalTemplateContext } from "@conventional-changelog/template";
import { ReleaseType } from "semver";
import { Octokit, Octokit as Octokit$1 } from "@octokit/rest";
import { getOctokit } from "@actions/github";
//#region src/core/changelog/changelog.types.d.ts
export interface ChangelogOptions {
  pkgDir?: string;
  tagPrefix?: string;
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number;
  /** 自定义 markdown 插入到更新日志的版本标题后，在生成的内容之前 */
  preamble?: string;
  /** 对默认 commit types 进行转换 */
  transformTypes?: (types: CommitType[]) => CommitType[];
  /** 提交范围（scope） */
  scope?: string | string[];
  filename?: string;
  version?: string;
  previousTag?: string;
}
//#endregion
//#region src/core/changelog/changelog.d.ts
interface LastRelease {
  version: string;
  notes: string;
  previousTag: string;
  nextTag: string;
}
export declare const extractLastRelease: (input: string | string[] | Iterable<string> | AsyncIterable<string | Buffer>) => Promise<LastRelease>;
export declare class Changelog {
  options: ChangelogOptions;
  constructor(options?: ChangelogOptions);
  get infile(): string;
  setOptions(options: ChangelogOptions): void;
  parsePreset(): Preset;
  inferReleaseType(): Promise<{
    releaseType?: undefined;
    reason?: undefined;
  } | {
    releaseType: "major" | "minor" | "patch";
    reason: string;
  }>;
  createGenerator(): ConventionalChangelog;
  read(): Promise<string>;
  write(): Promise<string>;
}
//#endregion
//#region src/core/changelog/committype.d.ts
export declare const defaultTypes: CommitType[];
//#endregion
//#region src/core/changelog/templates.d.ts
export declare function headerPartial(context: FinalTemplateContext): string;
export declare function preamblePartial(contest: FinalTemplateContext): string;
export declare function template(context: FinalTemplateContext): string;
//#endregion
//#region src/core/logger.d.ts
export type Printer = (message: LoggerMessage) => void;
export type Color = (text: string) => string;
export interface LoggerOptions {
  silent?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  printer?: Printer;
  colors?: Color[];
}
export interface LoggerMessage {
  dryRun?: boolean;
  stage: string;
  message: unknown;
  color: Color;
}
/** 一个子消息记录器，绑定到特定阶段 */
export declare class ChildLogger {
  parent: Logger;
  stage: string;
  /**
   * 创建子日志记录器。
   * @param parent - 要继承其选项的父日志记录器。
   * @param stage - 此日志记录器所属的处理阶段。
   */
  constructor(parent: Logger, stage: string);
  /**
   * 记录一条普通信息。
   * @param message - 要记录的信息。
   */
  info(message: unknown): void;
  /**
   * 记录一条详细信息。
   * @param message - 要记录的信息。
   */
  verbose(message: unknown): void;
}
/** 消息记录器 */
export declare class Logger {
  options: LoggerOptions;
  readonly printer: Printer;
  private readonly colors;
  private readonly colorMap;
  constructor(options?: LoggerOptions);
  info(stage: string, message: unknown): void;
  verbose(stage: string, message: unknown): void;
  createChild(stage: string): ChildLogger;
  private getColor;
}
//#endregion
//#region src/core/manifest/manifest.types.d.ts
export interface ProjectManifestVersionUpdate {
  name: string;
  from: string;
  to: string;
  files: string[];
}
//#endregion
//#region src/core/manifest/manifest.d.ts
export declare abstract class ProjectManifest<T = Dict> {
  filepath: string;
  static Filename: string;
  projectDir: string;
  abstract contents?: string;
  abstract manifest?: T;
  constructor(filepath: string);
  abstract readManifest(): Promise<T>;
  abstract getName(): Promise<string>;
  abstract getVersion(): Promise<string>;
  abstract isPrivate(): Promise<boolean>;
  abstract writeVersion(versin: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate>;
  getPrereleaseVersion(): Promise<readonly (string | number)[] | null>;
}
//#endregion
//#region src/core/utils.d.ts
interface HostedGitInfo {
  host: string;
  prefix: string;
  owner: string;
  repo: string;
}
//#endregion
//#region src/core/manifest/packageJson.types.d.ts
export interface PackageJsonProps extends Dict<any> {
  name: string;
  version: string;
  private?: boolean;
}
//#endregion
//#region src/core/manifest/packageJson.d.ts
export declare class PackageJsonManifest<T extends PackageJsonProps = PackageJsonProps> extends ProjectManifest<T> {
  static override Filename: string;
  contents?: string;
  manifest?: T;
  readManifest(): Promise<T>;
  getName(): Promise<string>;
  getVersion(): Promise<string>;
  isPrivate(): Promise<boolean>;
  writeVersion(version: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate>;
  private contentsMutex?;
}
//#endregion
//#region src/core/manifest/composed.d.ts
export declare class ComposedProjectManifest<T = Dict> extends ProjectManifest<T> {
  mainManifest: ProjectManifest<T>;
  subManifests: ProjectManifest[];
  constructor(mainManifest: ProjectManifest<T>, subManifests: ProjectManifest[]);
  get contents(): string | undefined;
  get manifest(): T | undefined;
  readManifest(): Promise<T>;
  getName(): Promise<string>;
  getVersion(): Promise<string>;
  isPrivate(): Promise<boolean>;
  writeVersion(version: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate>;
}
//#endregion
//#region src/core/project/project.types.d.ts
export type TagPrefixResolver = (scope: string) => string | Promise<string>;
export interface ProjectOptions {
  changelogFile?: string;
  manifest: ProjectManifest;
  tagPrefix?: string | TagPrefixResolver;
  compose?(manifest: ProjectManifest): ProjectManifest;
}
interface ProjectTagPrefixOptions {
  /**
   * 标签前缀。
   * @default 'v'
   */
  tagPrefix?: string;
}
export interface ProjectVersionUpdate extends ProjectManifestVersionUpdate {
  notes: string;
}
export interface ProjectTagsOptions extends ProjectTagPrefixOptions {
  verify?: boolean;
}
export interface ProjectReleaseOptions extends ProjectTagPrefixOptions {}
export interface ProjectMaintenanceBranchesOptions extends ProjectTagPrefixOptions {
  /**
   * 维护分支名称的前缀。
   * 默认使用标签前缀。
   */
  branchPrefix?: string;
}
export interface ProjectMaintenanceBranch {
  /**
   * 创建分支所基于的源标签。
   */
  from: string;
  /**
   * 要创建的目标分支名称。
   */
  to: string;
}
export interface ProjectNextVersionOptions extends ProjectTagPrefixOptions {
  /**
   * 忽略项目为私有项目这一限制。
   */
  forcePrivate?: boolean;
  /**
   * 强制升级到指定版本。
   * 未提供时，根据提交记录确定版本。
   */
  version?: string;
  /**
   * 用于计算升级版本的基准版本。
   * 未提供时，从清单文件中读取版本。
   */
  baseVersion?: string;
  /**
   * 要升级到的发布类型。
   * 未提供时，根据提交记录确定版本。
   */
  as?: ReleaseType;
  /**
   * 要使用的预发布标识符。
   */
  prerelease?: string;
  /**
   * 快照预发布标识符，版本号末尾会附加时间戳。
   */
  snapshot?: string;
  /**
   * 是否为首次发布。
   * 默认根据标签是否存在自动判断。
   */
  firstRelease?: boolean;
}
type ProjectBumpChangelogOptions = Pick<ChangelogOptions, "releaseCount" | "preamble" | "transformTypes">;
export interface ProjectBumpOptions extends ProjectNextVersionOptions, ProjectBumpChangelogOptions {
  /** 跳过变更日志生成 */
  skipChangelog?: boolean;
  /**
   * 是否仅试运行。
   * 为 `true` 时，不会将版本写入清单文件，只在内存中更新。
   */
  dryRun?: boolean;
  logger?: ChildLogger;
}
export interface ProjectRevertOptions {
  dryRun?: boolean;
  logger?: ChildLogger;
}
export interface ProjectPublishOptions {
  dryRun?: boolean;
  logger?: ChildLogger;
  /** 发布通道标签。由具体项目类型解释，例如 npm dist-tag 或 GitHub Action 分支别名。 */
  tag?: string | ((version: string, prerelease: readonly (string | number)[] | null) => string);
}
export interface ProjectPublishCheckOptions {
  logger?: ChildLogger;
}
//#endregion
//#region src/core/project/monorepo.types.d.ts
export type MonorepoMode = "fixed" | "independent";
export type GetProjectsOptions = Simplify<Required<Pick<ProjectOptions, "compose" | "manifest">>>;
export interface MonorepoProjectOptions extends ProjectOptions {
  /**
   * 单体仓库的版本模式。
   * `fixed` 表示所有项目统一升级到同一版本；`independent` 表示各项目分别升级版本。
   */
  mode: MonorepoMode;
  /**
   * 用于组合 package.json 的钩子函数。
   */
  compose?(packageJson: ProjectManifest, isRoot?: boolean): ProjectManifest;
  /**
   * 获取单体仓库中的项目。
   */
  getProjects(options: GetProjectsOptions): AsyncIterable<Project>;
  /**
   * 获取单体仓库中项目的 scope。
   * @param projectName - 要获取 scope 的项目名称。
   * @param rootName - 根项目名称。
   * @returns 项目的 scope。
   */
  scope?(projectName: string, rootName: string): string | Promise<string>;
  /**
   * 获取单体仓库中项目的标签前缀。
   * @param scope - 项目的 scope 名称。
   * @returns 项目的标签前缀。
   */
  tagPrefix?(scope: string): string | Promise<string>;
}
type NextVersionKeys = "skip" | "version" | "as" | "prerelease" | "snapshot" | "firstRelease";
type BumpKeys = "skipChangelog" | "releaseCount" | "preamble" | "transformTypes";
export type MonorepoProjectBumpByProjectOptions = Pick<ProjectBumpOptions, NextVersionKeys | BumpKeys>;
export interface MonorepoProjectBumpOptions extends Omit<ProjectBumpOptions, "tagPrefix"> {
  /**
   * 在固定版本模式下，强制升级单体仓库中没有变更的项目。
   */
  force?: boolean;
  /**
   * 要纳入项目变更日志的额外 scope。
   * 例如，要纳入 `fix(deps): 修复依赖项漏洞` 这类提交，可将 `deps` 添加到 `extraScopes`。
   */
  extraScopes?: string[];
  /**
   * 针对特定项目的版本升级选项。
   */
  byProject?: Record<string, MonorepoProjectBumpByProjectOptions>;
}
//#endregion
//#region src/core/project/monorepo.d.ts
export declare abstract class MonorepoProject extends Project {
  readonly mode: MonorepoMode;
  options: MonorepoProjectOptions & ProjectOptions;
  override getCommitMessage(): Promise<string>;
  override getTagPrefix(scope: string): Promise<string>;
  override getTags(options?: ProjectTagsOptions): Promise<string[]>;
  override getReleaseData(options?: ProjectReleaseOptions): Promise<ReleaseData[]>;
  override isFirstRelease(options?: ProjectReleaseOptions): Promise<boolean>;
  override getDefaultPublishTag(options?: ProjectReleaseOptions): Promise<Map<string, string>>;
  override getMaintenanceBranches(options?: ProjectMaintenanceBranchesOptions): Promise<ProjectMaintenanceBranch[]>;
  override getNextVersion(options?: MonorepoProjectBumpOptions): Promise<string | undefined>;
  override bump(options?: MonorepoProjectBumpOptions): Promise<boolean>;
  override revert(options?: ProjectRevertOptions): Promise<boolean>;
  private projectsMutex?;
  protected constructor(options: Simplify<MonorepoProjectOptions>);
  get isFixedMode(): boolean;
  get isIndependentMode(): boolean;
  getProjects(): AsyncGenerator<Project>;
  getScope(name: string): Promise<string>;
  getMaxVersion(): Promise<{
    version: string;
    packages: string[];
  }>;
  private getIndependentCommitMessage;
  private getIndependentTags;
  private getIndependentReleaseData;
  private getIndependentDefaultPublishTag;
  private getIndependentMaintenanceBranches;
  private getBumpOptions;
  private independentBump;
  private fixedBump;
  private isIndependentFirstRelease;
}
//#endregion
//#region src/core/project/project.d.ts
export declare const DEFAULT_TAG_PREFIX = "v";
export declare const DEFAULT_CHANGELOG_FILE = "CHANGELOG.md";
export declare const DEFAULT_PUBLISH_TAG = "latest";
export declare const DEFAULT_PRE_PUBLISH_TAG = "next";
export declare abstract class Project {
  options: ProjectOptions;
  manifest: ProjectManifest;
  changedFiles: string[];
  versionUpdates: ProjectVersionUpdate[];
  protected constructor(options: ProjectOptions);
  get hasBump(): boolean;
  getHostedGitInfo(): Promise<HostedGitInfo>;
  isMonorepoMode(): this is MonorepoProject;
  getCommitMessage(): Promise<string>;
  toTag(tagPrefix: string, version: string): string;
  toBranch(branchPrefix: string, version: string): string;
  getTagPrefix(override?: string): Promise<string>;
  getTags(options?: ProjectTagsOptions): Promise<string[]>;
  getReleaseData(options?: ProjectReleaseOptions): Promise<ReleaseData[]>;
  isFirstRelease(options?: ProjectReleaseOptions): Promise<boolean>;
  getLastReleaseTag(options?: ProjectReleaseOptions): Promise<string | undefined>;
  isLatestRelease(options?: ProjectReleaseOptions): Promise<boolean>;
  getDefaultPublishTag(options?: ProjectReleaseOptions): Promise<Map<string, string>>;
  /** 在主要版本发布后创建维护分支引用 */
  getMaintenanceBranches(options?: ProjectMaintenanceBranchesOptions): Promise<ProjectMaintenanceBranch[]>;
  changelog(options?: ProjectBumpOptions & {
    scope?: string[];
  }): Changelog;
  getNextVersion(options?: ProjectBumpOptions): Promise<string | undefined>;
  inferReleaseType(options?: ProjectBumpOptions): Promise<ReleaseType | undefined>;
  bump(options?: ProjectBumpOptions): Promise<boolean>;
  revert(options?: ProjectRevertOptions, filesSet?: Set<string>): Promise<boolean>;
  abstract publish(options?: ProjectPublishOptions): Promise<void>;
  abstract publishCheck(options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/core/hosting/hosting.types.d.ts
export interface ReleaseData {
  version: string;
  title: string;
  notes: string;
  previousTag: string;
  nextTag: string;
  isPrerelease: boolean;
  isLatest: boolean;
}
export interface CreateReleaseOptions {
  project: Project;
  dryRun?: boolean;
  logger?: ChildLogger;
}
export interface CreatePullRequestOptions {
  project: Project;
  to?: string;
  from?: string;
  dryRun?: boolean;
  logger?: ChildLogger;
}
export interface ReleaseCheckOptions {
  logger?: ChildLogger;
}
//#endregion
//#region src/core/hosting/hosting.d.ts
/** Git 仓库托管服务的基类 */
export declare abstract class GitRepositoryHosting {
  /** 为提供的项目创建 release */
  abstract createRelease(options: CreateReleaseOptions): Promise<void>;
  /** 未提供的项目创建 pull request */
  abstract createPullRequest(options: CreatePullRequestOptions): Promise<void>;
  /** 检查创建 release 需要的条件 */
  abstract releaseCheck(options?: ReleaseCheckOptions): Promise<void>;
}
//#endregion
//#region src/core/project/packageJson.types.d.ts
export interface PackageJsonProjectOptions extends Omit<ProjectOptions, "manifest"> {
  /**
   * package.json 文件的路径。
   */
  path?: string;
}
//#endregion
//#region src/core/project/packageJson.d.ts
export declare class PackageJsonProject extends Project {
  constructor(options?: Simplify<PackageJsonProjectOptions>);
  override publish(_options?: ProjectPublishOptions): Promise<void>;
  override publishCheck(_options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/core/project/packageJsonMonorepo.types.d.ts
export interface PackageJsonMonorepoProjectOptions extends Omit<MonorepoProjectOptions, "getProjects" | "manifest"> {
  mode: MonorepoMode;
  /**
   * 单体仓库的根目录。
   */
  root?: string;
  /**
   * 获取单体仓库中各项目的 package.json。
   */
  getProjects(options: GetProjectsOptions): AsyncIterable<string>;
}
//#endregion
//#region src/core/project/packageJsonMonorepo.d.ts
/**
 * 基于 package.json 的单体仓库项目。
 */
export declare class PackageJsonMonorepoProject extends MonorepoProject {
  constructor(options: Simplify<PackageJsonMonorepoProjectOptions>);
  override publish(_options?: ProjectPublishOptions): Promise<void>;
  override publishCheck(_options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/core/releaser.type.d.ts
export type PickOverridableOptions<T extends AnyFunction> = Partial<Omit<Exclude<Parameters<T>[0], undefined>, "dryRun" | "logger" | "tagPrefix" | "project">>;
export interface ReleaserOptions<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> {
  /**
   * 要发布的项目。
   */
  project: P;
  /**
   * 用于创建 Release 和拉取请求的 Git 仓库托管服务。
   */
  hosting?: G;
  dryRun?: boolean;
  silent?: boolean;
  verbose?: boolean;
  logger?: Logger;
}
export interface ReleaserCheckoutOptions {
  branch?: string;
  /**
   * 如果分支已存在，则删除并重新创建。
   */
  force?: boolean;
  /**
   * 强制从远程仓库获取所有提交和标签。
   */
  fetch?: boolean;
}
export interface ReleaserSetUserOptions {
  /**
   * 设置 Git 用户名。
   */
  username?: string;
  /**
   * 设置 Git 用户邮箱。
   */
  email?: string;
}
export interface ReleaserCommitOptions {
  sign?: boolean;
  allowEmpty?: boolean;
}
export interface ReleaserTagOptions {
  sign?: boolean;
  /** 在创建标签之前，从远程仓库获取最新的标签 */
  fetch?: boolean;
}
export interface ReleaserPushOptions {
  /** 强制推送分支 */
  force?: boolean;
}
export interface ReleaserMaintenanceBranchOptions {
  /** 强制创建分支 */
  force?: boolean;
  /** 启用维护分支创建 */
  enabled?: boolean;
}
export interface ReleaserStepsOptions<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> {
  setUser?: ReleaserSetUserOptions;
  maintenanceBranch?: ReleaserMaintenanceBranchOptions;
  checkout?: ReleaserCheckoutOptions;
  bump?: PickOverridableOptions<P["bump"]>;
  commit?: ReleaserCommitOptions;
  tag?: ReleaserTagOptions;
  push?: ReleaserPushOptions;
  publish?: PickOverridableOptions<P["publish"]>;
  release?: PickOverridableOptions<G["createRelease"]>;
  pullRequest?: PickOverridableOptions<G["createPullRequest"]>;
}
export type ReleaserStep = keyof ReleaserStepsOptions;
export type ReleaserSkipOptions = Partial<Record<ReleaserStep, boolean>>;
//#endregion
//#region src/core/releaser.d.ts
export declare class Releaser<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> {
  options: ReleaserOptions<P, G>;
  readonly project: P;
  readonly hosting?: G;
  readonly logger: Logger;
  readonly stepsOptions: ReleaserStepsOptions<P, G>;
  protected readonly skippedSteps: ReleaserSkipOptions;
  protected readonly state: {
    headBranch?: string;
    baseBranch?: string;
    bump?: boolean;
    tags?: boolean;
  };
  private readonly queue;
  constructor(options: ReleaserOptions<P, G>);
  enqueue(fn: () => Promise<void>): this;
  setOptions(options: ReleaserStepsOptions<P, G>): this;
  setUser(options?: ReleaserSetUserOptions): this;
  setSkippedSteps(options: ReleaserSkipOptions): this;
  checkout(options?: ReleaserCheckoutOptions): this;
  bump(options?: PickOverridableOptions<P["bump"]>): this;
  commit(options?: ReleaserCommitOptions): this;
  revert(): this;
  maintenanceBranch(options?: ReleaserMaintenanceBranchOptions): this;
  tag(options?: ReleaserTagOptions): this;
  push(options?: ReleaserPushOptions): this;
  publish(options?: PickOverridableOptions<P["publish"]>): this;
  release(option?: PickOverridableOptions<G["createRelease"]>): this;
  pullRequest(option?: PickOverridableOptions<G["createPullRequest"]>): this;
  run(condition?: (releaser: this) => Promise<boolean>): Promise<void>;
  protected shouldSkip(step: ReleaserStep): boolean;
  private getBaseBranch;
}
//#endregion
//#region src/config/index.d.ts
export interface UserConfig<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> extends ReleaserStepsOptions<P, G> {
  project?: P;
  hosting?: G;
  releaser?: Omit<ReleaserOptions, "project" | "hosting">;
}
export declare const defineConfig: <P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting>(config: UserConfig<P, G>) => UserConfig<P, G>;
export declare const loadJavaScriptFile: <T extends object>(file: string) => Promise<T>;
export declare const findFile: (cwd: string, filename: string, extensions: string[]) => string | undefined;
export declare const loadConfig: <T extends object>(cwd?: string) => Promise<{
  file: string;
  config: T;
}>;
//#endregion
//#region src/hosting-github/github.type.d.ts
export interface GithubOptions {
  /**
   * 用于通过 GitHub API 进行身份验证的 GitHub Personal Access Token。
   */
  token?: string;
  /**
   * 用于发起 API 请求的 GitHub Octokit 实例。
   */
  octokit?: Octokit$1;
  /**
   * GitHub 仓库的所有者（用户名或组织）。
   * 如果未提供，则会从远程仓库 URL 中自动推断。
   */
  owner?: string;
  /**
   * 用于创建 Release 的 GitHub 项目（仓库）名称。
   * 如果未提供，则会从远程仓库 URL 中自动推断。
   */
  repo?: string;
  /**
   * web-based GitHub Release
   */
  browser?: boolean;
}
export interface GithubCreatePullRequestOptions extends CreatePullRequestOptions {
  draft?: boolean;
}
export interface UploadAssetsOptions {
  owner: string;
  repo: string;
  release_id: number;
  assets: string[];
}
export interface GetReleaseOptions {
  owner: string;
  repo: string;
  tag: string;
}
export type RepositoryId = [owner: string, repo: string];
export interface ListPullRequestOptions {
  owner: string;
  repo: string;
  from: string;
}
//#endregion
//#region src/hosting-github/github.d.ts
export declare class GithubHosting extends GitRepositoryHosting {
  private readonly options;
  readonly octokit: Octokit;
  readonly browser: boolean;
  constructor(options?: GithubOptions);
  createRelease(options: CreateReleaseOptions): Promise<void>;
  createPullRequest(options: GithubCreatePullRequestOptions): Promise<void>;
  releaseCheck(options?: ReleaseCheckOptions): Promise<void>;
  getRepositoryId(project: Project): Promise<RepositoryId>;
  private uploadAssets;
  private getRelease;
  private listPullRequest;
  private getDefaultBranch;
  private getPullRequestData;
}
//#endregion
//#region src/project-github-action/publish.d.ts
export interface PublishOptions extends ProjectPublishOptions {
  /**
   * 发布引用前要运行的构建或安装命令。
   */
  build?: string | string[];
  /**
   * 构建后要暂存的文件。默认使用 package.json 中的 `files`。
   */
  files?: string[];
  /**
   * 运行构建命令前要设置的环境变量。
   * @default process.env
   */
  env?: Record<string, string | undefined>;
}
export declare const publish: (project: NodeGithubActionProject, options?: PublishOptions) => Promise<void>;
//#endregion
//#region src/project-github-action/project.d.ts
export interface NodeGithubActionProjectOptions extends PackageJsonProjectOptions {
  /**
   * 版本标签的前缀。
   * @default 'v'
   */
  tagPrefix?: string;
}
export type NodeGithubActionProjectBumpOptions = ProjectBumpOptions;
export type NodeGithubActionProjectPublishOptions = PublishOptions;
/** Node.js GitHub Actions 项目，将版本引用发布到 Git 分支和标签 */
export declare class NodeGithubActionProject extends PackageJsonProject {
  options: NodeGithubActionProjectOptions & ProjectOptions;
  /**
   * 获取项目最近一次发布的标签。
   * GitHub Action 发布标签指向发布分支中的打包提交，无法从源分支到达。因此需要遍历所有引用，并通过标签的父提交判断它是否属于当前分支。
   */
  override getLastReleaseTag(options?: ProjectReleaseOptions): Promise<string | undefined>;
  override publish(options?: NodeGithubActionProjectPublishOptions): Promise<void>;
  override publishCheck(options: ProjectPublishCheckOptions): Promise<void>;
  constructor(options?: NodeGithubActionProjectOptions);
  private isReachableFromHead;
}
//#endregion
//#region src/project-npm/publish.d.ts
interface CleanupOptions$1 {
  /** 是否清理项目内容后再发布 */
  cleanPublish?: boolean;
  /** package.json 需要忽略的字段，支持 `a.b.c` */
  ignoreFields?: string[];
  /** package.json 需要保留的脚本，默认：`preinstall | install | postinstall` */
  keepScripts?: string[];
  /** 是否精简 README.md，仅保留主要内容 */
  cleanReadme?: boolean;
}
interface PublishOptions$2 extends ProjectPublishOptions, CleanupOptions$1 {
  access?: string;
  registry?: string;
  otp?: string;
  env?: Record<string, string | undefined>;
}
//#endregion
//#region src/project-npm/project.d.ts
export type NpmProjectOptions = PackageJsonProjectOptions;
export type NpmProjectBumpOptions = ProjectBumpOptions;
export type NpmProjectPublishOptions = PublishOptions$2;
/** 一个基于 npm 的项目，使用 package.json 进行配置 */
export declare class NpmProject extends PackageJsonProject {
  override publish(options?: NpmProjectPublishOptions): Promise<void>;
  override publishCheck(options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/project-npm/workspacesProject.d.ts
export type NpmWorkspacesProjectOptions = Omit<PackageJsonMonorepoProjectOptions, "getProjects">;
export type NpmWorkspacesProjectBumpOptions = ProjectBumpOptions;
export type NpmWorkspacesProjectPublishOptions = PublishOptions$2;
/** 一个基于 npm workspaces 的 monorepo 项目，使用 package.json 的 workspaces 进行配置 */
export declare class NpmWorkspacesProject extends PackageJsonMonorepoProject {
  static GlobIgnore: string[];
  constructor(options: NpmWorkspacesProjectOptions);
  override publish(options?: NpmWorkspacesProjectPublishOptions): Promise<void>;
  override publishCheck(options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/project-pnpm/publish.d.ts
interface CleanupOptions {
  /** 是否清理项目内容后再发布 */
  cleanPublish?: boolean;
  /** package.json 需要忽略的字段，支持 `a.b.c` */
  ignoreFields?: string[];
  /** package.json 需要保留的脚本，默认：`preinstall | install | postinstall` */
  keepScripts?: string[];
  /** 是否精简 README.md，仅保留主要内容 */
  cleanReadme?: boolean;
}
interface PublishOptions$1 extends ProjectPublishOptions, CleanupOptions {
  access?: string;
  registry?: string;
  otp?: string;
  env?: Record<string, string | undefined>;
  /** 是否在发布前执行 git 检查 */
  gitChecks?: boolean;
}
//#endregion
//#region src/project-pnpm/project.d.ts
export type PnpmProjectOptions = PackageJsonProjectOptions;
export type PnpmProjectBumpOptions = ProjectBumpOptions;
export type PnpmProjectPublishOptions = PublishOptions$1;
/** 一个基于 pnpm 的项目，使用 package.json 进行配置 */
export declare class PnpmProject extends PackageJsonProject {
  override publish(options?: PnpmProjectPublishOptions): Promise<void>;
  override publishCheck(options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/project-pnpm/workspacesProject.d.ts
export type PnpmWorkspacesProjectOptions = Omit<PackageJsonMonorepoProjectOptions, "getProjects">;
export type PnpmWorkspacesProjectBumpOptions = ProjectBumpOptions;
export type PnpmWorkspacesProjectPublishOptions = PublishOptions$1;
/** 一个基于 pnpm 工作区的单体仓库项目，使用 package.json 和 pnpm-workspace.yaml 进行配置 */
export declare class PnpmWorkspacesProject extends PackageJsonMonorepoProject {
  static WorkspaceFile: string;
  static GlobIgnore: string[];
  constructor(options: PnpmWorkspacesProjectOptions);
  override publish(options?: PnpmWorkspacesProjectPublishOptions): Promise<void>;
  override publishCheck(options?: ProjectPublishCheckOptions): Promise<void>;
}
//#endregion
//#region src/releaser-github-action/releaser.d.ts
export interface ReleaserGithubActionOptions<P extends Project = Project> extends Omit<ReleaserOptions<P, GithubHosting>, "hosting"> {
  /** 用于进行 GitHub API 调用的 Octokit 实例 */
  octokit: ReturnType<typeof getOctokit>;
}
export declare class ReleaserGithubAction<P extends Project = Project> extends Releaser<P, GithubHosting> {
  readonly hosting: GithubHosting;
  override setUser(options?: ReleaserSetUserOptions): this;
  override checkout(options?: ReleaserCheckoutOptions): this;
  override tag(options?: ReleaserTagOptions): this;
  override push(options?: ReleaserPushOptions): this;
  constructor(options: Simplify<ReleaserGithubActionOptions<P>>);
  fetchOptions(): this;
  fetch(): this;
  runPullRequestAction(): Promise<void>;
  runReleaseAction(check?: boolean): Promise<void>;
  runSnapshotAction(snapshotTag: string): Promise<void>;
  runAction(): Promise<void>;
}
//#endregion
//#region src/releaser-github-action/conditions.d.ts
export declare const ifReleaseCommit: (releaser: ReleaserGithubAction) => Promise<boolean>;
/**
 * 检测当前事件是否为针对处于打开状态的发布拉取请求的受支持命令评论：
 * （`!release/set-options` 或 `!release/set-preamble`）
 *
 * @returns 如果是此类评论，则返回 `目标分支`；如果是评论事件但不是命令评论，则返回 `false`；如果根本不是评论事件，则返回 `null`
 */
export declare const ifCommandComment: () => string | false | null;
//#endregion
//#region src/releaser-github-action/options.d.ts
interface InputOptions<T> {
  checkout: Partial<{
    branch: string;
  }>;
  bump: Partial<{
    version: string;
    as: ReleaseType;
    prerelease: string;
    snapshot: string;
    firstRelease: boolean;
    skip: boolean;
    /** monorepo bump */
    byProject: T;
  }>;
  maintenanceBranch: Partial<{
    enabled: boolean;
  }>;
  publish: Partial<{
    skip: boolean;
    /** npm publish */
    access: string;
    tag: string;
  }>;
}
export declare const getInputOptions: <T extends Dict>() => InputOptions<T>;
export declare const getInputSkippedSteps: () => ReleaserSkipOptions;
//#endregion
//#region src/releaser-cli/releaser.d.ts
export interface ReleaserCliRunOptions {
  dryRun?: boolean;
  ci?: boolean;
  skipGit?: boolean;
  skipPublish?: boolean;
  skipRelease?: boolean;
  releaseType?: ReleaseType;
}
export interface CliStepsSkip {
  commit?: boolean;
  tag?: boolean;
  push?: boolean;
  publish?: boolean;
  release?: boolean;
}
export type ReleaserCliOptions<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> = ReleaserOptions<P, G>;
export declare class ReleaserCli<P extends Project = Project, G extends GitRepositoryHosting = GitRepositoryHosting> extends Releaser<P, G> {
  constructor(options: ReleaserCliOptions<P, G>);
  override tag(options?: ReleaserTagOptions): this;
  override push(options?: ReleaserPushOptions): this;
  override run(...args: []): Promise<void>;
  setCliOptions(options: ReleaserCliRunOptions): this;
  setLegacyOptions(): this;
  check(): this;
  start(): this;
  end(): void;
  runAction(options: ReleaserCliRunOptions): Promise<void>;
}
//#endregion
export { Octokit };