import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { eol, execAsync, getAuthenticatedUser, getGithubUrl, getPublishedVersion, gitAdd, gitBranch, gitBranchCurrent, gitCheckout, gitCheckoutBranch, gitCheckoutBranchForce, gitCommitAmendNoEdit, gitCommitMessage, gitConfigGet, gitConfigSet, gitDiff, gitFetch, gitLog, gitLsRemote, gitPush, gitPushBranch, gitRevParse, gitTag, hasWriteAccess, isGitRepo, isPrerelease, isValidVersion, isWorkingTreeClean, parseGitHubRepo, pingRegistry, runGit } from "@peiyanlu/cli-utils";
import { copyDir, createMatcher, createTempDir, editFile, normalizePath, readJsonFile, writeJsonFile } from "@peiyanlu/node-utils";
import { assert, dedent, equals, isBlankString, isBoolean, isEmpty, isEmptyObject, isFunction, isIndex, isNotEmpty, isNull, isString, isUndefined, isZero, omit, onceAsync, partition, sleep, throwError, tryCall, tryCallSync, unset } from "@peiyanlu/ts-utils";
import { ConventionalChangelog } from "conventional-changelog";
import createPreset from "conventional-changelog-conventionalcommits";
import { Bumper } from "conventional-recommended-bump";
import { readFile, writeFile } from "node:fs/promises";
import { finished } from "node:stream/promises";
import { bold, compareUrl, each, heading, link, list, newline, segments, small, words } from "@conventional-changelog/template";
import semver, { SemVer, clean, gt, gte, inc, lt, major, prerelease, rcompare, valid } from "semver";
import { Octokit } from "@octokit/rest";
import open from "open";
import { glob, globSync } from "tinyglobby";
import { parse as parse$1 } from "yaml";
import { context } from "@actions/github";
import { getBooleanInput, getInput } from "@actions/core";
import { cancel, confirm, group, intro, isCancel, log, note, outro, select, text } from "@clack/prompts";
import { blue, blueBright, cyan, cyanBright, dim, green, greenBright, magenta, magentaBright, red, redBright, yellow } from "ansis";
//#region src/config/index.ts
const defineConfig = (config) => config;
const loadJavaScriptFile = async (file) => {
	const { href } = pathToFileURL(file);
	const mod = await import(href);
	const temp = "default" in mod ? mod.default : mod;
	return typeof temp === "function" ? temp() : temp;
};
const findFile = (cwd, filename, extensions) => {
	for (const ext of extensions) {
		const path = resolve(cwd, `${filename}.${ext}`);
		if (existsSync(path)) return path;
	}
};
const loadConfig = async (cwd = process.cwd()) => {
	const file = findFile(cwd, "release.config", [
		"ts",
		"mts",
		"js",
		"mjs"
	]);
	if (!file) return {
		file: "",
		config: {}
	};
	return {
		file,
		config: await loadJavaScriptFile(file)
	};
};
//#endregion
//#region src/core/changelog/committype.ts
const defaultTypes = [
	{
		type: "feat",
		section: "✨ 新功能",
		effect: "bump"
	},
	{
		type: "feature",
		section: "✨ 新功能",
		effect: "bump"
	},
	{
		type: "fix",
		section: "🐛 Bug 修复",
		effect: "bump"
	},
	{
		type: "perf",
		section: "⚡ 性能优化",
		effect: "bump"
	},
	{
		type: "revert",
		section: "⏪ 回退",
		effect: "bump"
	},
	{
		type: "docs",
		section: "📝 文档",
		effect: "changelog"
	},
	{
		type: "style",
		section: "💄 样式调整",
		effect: "hidden"
	},
	{
		type: "chore",
		section: "🧹 其他更新",
		effect: "hidden"
	},
	{
		type: "refactor",
		section: "♻️ 代码重构",
		effect: "changelog"
	},
	{
		type: "test",
		section: "🧪 测试",
		effect: "hidden"
	},
	{
		type: "build",
		section: "🏗️ 构建系统",
		effect: "hidden"
	},
	{
		type: "ci",
		section: "🤖 CI",
		effect: "hidden"
	},
	{
		type: "security",
		section: "🛡️ 安全修复",
		effect: "changelog"
	},
	{
		type: "hotfix",
		section: "🚑 热修复",
		effect: "changelog"
	},
	{
		type: "i18n",
		section: "🌐 国际化",
		effect: "changelog"
	},
	{
		type: "ux",
		section: "🎨 用户体验",
		effect: "changelog"
	},
	{
		type: "deps",
		section: "📦 依赖更新",
		effect: "changelog"
	},
	{
		type: "tool",
		section: "🛠️ 工具链",
		effect: "hidden"
	},
	{
		type: "config",
		section: "⚙️ 配置",
		effect: "hidden"
	}
];
//#endregion
//#region src/core/changelog/templates.ts
const isLikelyHash = (value) => /^[0-9a-f]{7,40}$/i.test(value);
function headerPartial(context) {
	const { isPatch, linkCompare, version, title, date, previousTag } = context;
	const versionText = linkCompare && !isLikelyHash(previousTag) ? link(version, compareUrl(context)) : version;
	const fullTitle = words(versionText, title && `"${title}"`, date && `(${date})`);
	return heading(2, isPatch ? small(fullTitle) : fullTitle);
}
function preamblePartial(contest) {
	const { preamble, commitGroups, noteGroups } = contest;
	return segments(preamble, isEmpty(preamble) && isEmpty(commitGroups) && isEmpty(noteGroups) && "Version bump without any changes.");
}
function template(context) {
	const { headerPartial, preamblePartial, commitPartial, footerPartial, noteGroups, commitGroups } = context;
	return segments(headerPartial(context), preamblePartial(context), each(noteGroups, (group) => segments(heading(3, words("⚠", group.title)), list(group.notes, (note) => {
		const line1 = words(note.commit.scope && bold(`${note.commit.scope}:`), commitPartial(context, note.commit));
		const line2 = note.commit.subject.trim() !== note.text.trim() ? list([note.text], (t) => t) : "";
		return each([line1, line2], (t) => t, newline());
	})), newline(2)), each(commitGroups, (group) => segments(group.title && heading(3, group.title), list(group.commits, (commit) => commitPartial(context, commit))), newline(2)), footerPartial(context));
}
//#endregion
//#region src/core/changelog/changelog.ts
const versionHeaderRegex = /^#+ (?:<small>)?\[?([^[\]()\s]*\d+\.\d+\.\d+[^[\]()\s]*)]?(?:<\/small>)?/m;
const tagsRegex = /\/([^/)]*)\.\.\.([^/)]*)\)/;
const decodeTag = (tag) => {
	return tryCallSync(() => decodeURIComponent(tag), tag);
};
const extractLastRelease = async (input) => {
	let stream = input;
	let inLastChanges = false;
	let notes = "";
	let chunk;
	let lines;
	let line;
	let previousTag = "";
	let nextTag = "";
	let version = "";
	if (typeof stream === "string") stream = [stream];
	top: for await (chunk of stream) {
		lines = chunk.toString("utf8").split(/\n/);
		for (line of lines) {
			const versionMatch = line.match(versionHeaderRegex);
			if (versionMatch) {
				if (inLastChanges) break top;
				[, version] = versionMatch;
				inLastChanges = true;
				const tagsMatch = line.match(tagsRegex);
				if (tagsMatch) {
					previousTag = decodeTag(tagsMatch[1]);
					nextTag = decodeTag(tagsMatch[2]);
				}
				continue;
			}
			if (inLastChanges) notes += `${line}\n`;
		}
	}
	return {
		version,
		notes: notes.trim(),
		previousTag,
		nextTag
	};
};
var Changelog = class {
	options;
	constructor(options = {}) {
		this.options = options;
	}
	get infile() {
		const { pkgDir = ".", filename = "CHANGELOG.md" } = this.options;
		return normalizePath(join(pkgDir, filename));
	}
	setOptions(options) {
		Object.assign(this.options, options);
	}
	parsePreset() {
		const { transformTypes, scope } = this.options;
		const types = transformTypes?.(defaultTypes) ?? defaultTypes;
		return createPreset({
			types,
			scope
		});
	}
	async inferReleaseType() {
		const { pkgDir, tagPrefix } = this.options ?? {};
		const preset = this.parsePreset();
		const res = await new Bumper().config(preset).commits({ path: pkgDir }).tag({ prefix: tagPrefix }).bump(preset.whatBump);
		if (!("releaseType" in res)) return {};
		const { releaseType, reason } = res;
		return {
			releaseType,
			reason
		};
	}
	createGenerator() {
		const { pkgDir = ".", tagPrefix = "v", releaseCount = 1 } = this.options;
		const { preamble, version, previousTag } = this.options;
		return new ConventionalChangelog().readPackage(`${pkgDir}/package.json`).config(this.parsePreset()).options({ releaseCount }).commits({ path: pkgDir }).tags({ prefix: tagPrefix }).readRepository().context({
			preamble,
			version,
			previousTag
		}).writer({
			preamblePartial,
			headerPartial,
			template
		});
	}
	async read() {
		const generator = this.createGenerator();
		let content = "";
		for await (const chunk of generator.write()) content += chunk;
		return content.trimEnd();
	}
	async write() {
		const { infile, options } = this;
		const { releaseCount = 1 } = options;
		if (!existsSync(infile)) await writeFile(infile, "");
		const exist = readFileSync(infile, "utf-8");
		const writeStream = createWriteStream(infile);
		const generator = this.createGenerator();
		let content = "";
		for await (const chunk of generator.write()) {
			content += chunk;
			writeStream.write(chunk);
		}
		const override = isZero(releaseCount);
		if (!(isBlankString(exist) || override)) {
			writeStream.write(eol());
			writeStream.write(exist);
		}
		writeStream.end();
		await finished(writeStream);
		return content.trimEnd();
	}
};
//#endregion
//#region src/core/hosting/hosting.ts
/** Git 仓库托管服务的基类 */
var GitRepositoryHosting = class {};
//#endregion
//#region src/core/manifest/manifest.ts
var ProjectManifest = class {
	filepath;
	static Filename;
	projectDir;
	constructor(filepath) {
		this.filepath = filepath;
		this.projectDir = dirname(filepath);
	}
	async getPrereleaseVersion() {
		const version = await this.getVersion();
		return prerelease(version);
	}
};
//#endregion
//#region src/core/manifest/packageJson.ts
var PackageJsonManifest = class extends ProjectManifest {
	static Filename = "package.json";
	contents;
	manifest;
	async readManifest() {
		if (!this.contentsMutex) {
			this.contentsMutex = readFile(this.filepath, "utf-8");
			this.contents = await this.contentsMutex;
			this.manifest = JSON.parse(this.contents);
			return this.manifest;
		}
		await this.contentsMutex;
		return this.manifest;
	}
	async getName() {
		const { name } = await this.readManifest();
		return name;
	}
	async getVersion() {
		const { version } = await this.readManifest();
		return version;
	}
	async isPrivate() {
		const { private: isPrivate } = await this.readManifest();
		return Boolean(isPrivate);
	}
	async writeVersion(version, dryRun) {
		await this.readManifest();
		const { name, version: from } = this.manifest;
		this.manifest.version = version;
		this.contents = this.contents.replace(/"version":(\s*)"[^"]+"/, `"version":$1"${version}"`);
		if (!dryRun) await writeFile(this.filepath, this.contents, "utf-8");
		return {
			name,
			from,
			to: version,
			files: [this.filepath]
		};
	}
	contentsMutex;
};
//#endregion
//#region src/core/manifest/composed.ts
var ComposedProjectManifest = class extends ProjectManifest {
	mainManifest;
	subManifests;
	constructor(mainManifest, subManifests) {
		super(mainManifest.filepath);
		this.mainManifest = mainManifest;
		this.subManifests = subManifests;
	}
	get contents() {
		return this.mainManifest.contents;
	}
	get manifest() {
		return this.mainManifest.manifest;
	}
	readManifest() {
		return this.mainManifest.readManifest();
	}
	getName() {
		return this.mainManifest.getName();
	}
	getVersion() {
		return this.mainManifest.getVersion();
	}
	isPrivate() {
		return this.mainManifest.isPrivate();
	}
	async writeVersion(version, dryRun) {
		const update = await this.mainManifest.writeVersion(version, dryRun);
		for (let sub of this.subManifests) {
			const { files } = await sub.writeVersion(version, dryRun);
			update.files.push(...files);
		}
		return update;
	}
};
//#endregion
//#region src/core/utils.ts
const nonPreReleaseTypes = [
	"patch",
	"minor",
	"major"
];
const getTypePriority = (type) => nonPreReleaseTypes.indexOf(type);
const getCurrentActiveType = (version) => {
	for (const type of nonPreReleaseTypes) if (semver[type](version)) return type;
};
const getSnapshotTimestamp = (date = /* @__PURE__ */ new Date()) => date.toISOString().replace(/\D/g, "").slice(0, 14);
const setSnapshotIdentifier = (version, snapshot) => {
	if (!snapshot) return version;
	const semverVersion = new SemVer(version);
	semverVersion.prerelease = [snapshot, getSnapshotTimestamp()];
	return semverVersion.format();
};
const getPrereleaseIdentifier = (prerelease, snapshot) => {
	if (snapshot) return `${snapshot}.${getSnapshotTimestamp()}`;
	return prerelease;
};
const getPrereleaseIdentifierBase = (snapshot) => snapshot ? false : void 0;
const getReleaseType = (releaseType, version, prerelease$1) => {
	if (!isUndefined(prerelease$1)) {
		if (Array.isArray(prerelease(version))) {
			const currentActiveType = getCurrentActiveType(version);
			if (currentActiveType === releaseType || getTypePriority(currentActiveType) > getTypePriority(releaseType)) return "prerelease";
		}
		return `pre${releaseType}`;
	}
	return releaseType;
};
const when = (condition, ...value) => condition ? [...value] : [];
const unless = (condition, ...value) => condition ? [] : [...value];
async function firstFromStream(stream) {
	const { value, done } = await stream[Symbol.asyncIterator]().next();
	return done ? void 0 : value;
}
async function* getTags(params = {}) {
	const { path, from = "", to = "HEAD", all } = params;
	const stdout = await runGit([
		"log",
		"--decorate=short",
		"--no-color",
		"--date-order",
		"--format=%D",
		...when(all, "--all"),
		[from, to].filter(Boolean).join(".."),
		...path ? ["--", path] : []
	]);
	for (const record of stdout.split(/\r?\n/)) for (const [, tag] of record.matchAll(/tag:\s*([^\s,]+)/gi)) yield tag.trim();
}
async function* getSemverTags(params = {}) {
	const { prefix, skipUnstable, clean: clean$1, ...getTagsParams } = params;
	const tagsStream = getTags(getTagsParams);
	const unstableTagRegex = /\d+\.\d+\.\d+-.+/;
	const cleanTag = clean$1 ? (tag, unprefixed) => clean(unprefixed || tag) : (tag) => tag;
	let unprefixed;
	let tag;
	for await (tag of tagsStream) {
		if (skipUnstable && unstableTagRegex.test(tag)) continue;
		if (prefix) {
			if (typeof prefix === "string" ? tag.startsWith(prefix) : prefix.test(tag)) {
				unprefixed = tag.replace(prefix, "");
				if (valid(unprefixed)) {
					tag = cleanTag(tag, unprefixed);
					if (tag) yield tag;
				}
			}
		} else if (valid(tag)) {
			tag = cleanTag(tag);
			if (tag) yield tag;
		}
	}
}
async function getLastSemverTag(params = {}) {
	return firstFromStream(getSemverTags(params));
}
async function getVersionFromTags(params = {}) {
	const semverTagsStream = getSemverTags({
		clean: true,
		...params
	});
	const semverTags = [];
	for await (const tag of semverTagsStream) semverTags.push(tag);
	if (!semverTags.length) return;
	return semverTags.sort(rcompare)[0];
}
const readTextSync = (path) => {
	if (!existsSync(path)) return "";
	return readFileSync(path).toString("utf8");
};
const parseHostedGitUrl = (url) => {
	const [domain = "", prefix = "", owner = "", repo = ""] = [...(url.trim().match(/((?:github|gitlab|bitbucket|gitee|codeberg|sourceforge|git\.sr|\d+\.\d+\.\d+\.\d+:\d+)\.?(?:com|org|net|ht)?)[:\/](~)?([^/]+)\/(.+?)(?:[#/?](?:.+?)?)?(?:\.git)?$/) ?? []).slice(1)];
	return {
		host: domain ? `http${url.includes("https://") ? "s" : ""}://${domain}` : "",
		prefix,
		owner,
		repo
	};
};
//#endregion
//#region src/core/project/project.ts
const DEFAULT_TAG_PREFIX = "v";
const DEFAULT_CHANGELOG_FILE = "CHANGELOG.md";
const DEFAULT_PUBLISH_TAG = "latest";
const DEFAULT_PRE_PUBLISH_TAG = "next";
var Project = class {
	options;
	manifest;
	changedFiles = [];
	versionUpdates = [];
	constructor(options) {
		this.options = options;
		this.options.changelogFile ??= DEFAULT_CHANGELOG_FILE;
		const { compose, manifest } = options;
		this.manifest = compose?.(manifest) ?? manifest;
	}
	get hasBump() {
		return this.versionUpdates.length > 0;
	}
	async getHostedGitInfo() {
		const remote = await gitConfigGet("remote.origin.url");
		return parseHostedGitUrl(remote ?? "");
	}
	isMonorepoMode() {
		return "mode" in this;
	}
	async getCommitMessage() {
		const { versionUpdates, versionUpdates: [{ to }] } = this;
		if (isEmpty(versionUpdates)) throwError("Nothing to commit");
		return `chore(release): ${to}`;
	}
	toTag(tagPrefix, version) {
		return `${tagPrefix}${version}`;
	}
	toBranch(branchPrefix, version) {
		return `${branchPrefix}${major(version)}`;
	}
	async getTagPrefix(override) {
		if (!isUndefined(override)) return override;
		const { options: { tagPrefix = "v" } } = this;
		return isFunction(tagPrefix) ? tagPrefix("") : tagPrefix;
	}
	async getTags(options = {}) {
		const { manifest } = this;
		const { tagPrefix: override, verify = true } = options;
		const tagPrefix = await this.getTagPrefix(override);
		const version = await manifest.getVersion();
		const tag = this.toTag(tagPrefix, version);
		if (verify) {
			if (await gitRevParse([tag])) return [];
		}
		return [tag];
	}
	async getReleaseData(options = {}) {
		const { manifest, versionUpdates, versionUpdates: [{ notes }], options: { changelogFile } } = this;
		const { projectDir } = manifest;
		const { tagPrefix: override } = options;
		const tagPrefix = await this.getTagPrefix(override);
		const version = await manifest.getVersion();
		const isPrerelease = Boolean(await manifest.getPrereleaseVersion());
		const lastRelease = await extractLastRelease(isEmpty(versionUpdates) ? readTextSync(join(projectDir, changelogFile)) : notes);
		if (Object.values(lastRelease).every(isEmpty) || lastRelease.version && lastRelease.version !== version) return [];
		if (!lastRelease.nextTag) {
			const tags = await this.getTags({
				tagPrefix,
				verify: false
			});
			if (tags.length) [lastRelease.nextTag] = tags;
		}
		return [{
			...lastRelease,
			title: this.toTag(tagPrefix, version),
			version,
			isPrerelease,
			isLatest: await this.isLatestRelease(options)
		}];
	}
	async isFirstRelease(options = {}) {
		return !await this.getLastReleaseTag(options);
	}
	async getLastReleaseTag(options = {}) {
		const { manifest: { projectDir } } = this;
		const { tagPrefix: override } = options;
		return getLastSemverTag({
			path: projectDir,
			prefix: await this.getTagPrefix(override)
		});
	}
	async isLatestRelease(options = {}) {
		const { manifest } = this;
		const { tagPrefix: override } = options;
		const version = await manifest.getVersion();
		const currentVersion = valid(version);
		if (!currentVersion) return true;
		const latestVersion = await getVersionFromTags({
			prefix: await this.getTagPrefix(override),
			skipUnstable: true,
			all: true
		});
		return !latestVersion || gte(currentVersion, latestVersion);
	}
	async getDefaultPublishTag(options = {}) {
		const { manifest } = this;
		const name = await manifest.getName();
		const version = await manifest.getVersion();
		const map = /* @__PURE__ */ new Map();
		map.set(name, DEFAULT_PUBLISH_TAG);
		const prerelease = await manifest.getPrereleaseVersion();
		if (prerelease) {
			const [identifier] = prerelease;
			const tag = isString(identifier) ? identifier : DEFAULT_PRE_PUBLISH_TAG;
			map.set(name, tag);
			return map;
		}
		if (!await this.isLatestRelease(options)) {
			const tag = `release.${major(version)}.x`;
			map.set(name, tag);
			return map;
		}
		return map;
	}
	/** 在主要版本发布后创建维护分支引用 */
	async getMaintenanceBranches(options = {}) {
		const { manifest } = this;
		const { tagPrefix: override, branchPrefix } = options;
		const tagPrefix = await this.getTagPrefix(override);
		const version = await manifest.getVersion();
		const currentVersion = valid(version);
		if (!currentVersion) return [];
		const [releaseData] = await this.getReleaseData(options);
		const previousTag = releaseData?.previousTag || await this.getLastReleaseTag({ tagPrefix });
		if (previousTag) {
			const previousVersion = valid(previousTag.startsWith(tagPrefix) ? previousTag.slice(tagPrefix.length) : previousTag);
			if (previousVersion && major(currentVersion) > major(previousVersion)) return [{
				from: previousTag,
				to: this.toBranch(branchPrefix ?? tagPrefix, previousVersion)
			}];
		}
		return [];
	}
	changelog(options = {}) {
		const { manifest: { projectDir }, options: { changelogFile } } = this;
		const { tagPrefix, releaseCount, preamble, transformTypes, scope } = options;
		return new Changelog({
			pkgDir: projectDir,
			tagPrefix,
			filename: changelogFile,
			releaseCount,
			preamble,
			transformTypes,
			scope
		});
	}
	async getNextVersion(options = {}) {
		const { manifest } = this;
		const { forcePrivate, logger } = options;
		if (!forcePrivate && await manifest.isPrivate()) return;
		const { version: forcedVersion, baseVersion, as, prerelease, snapshot, firstRelease, tagPrefix: override } = options;
		let isFirstRelease = firstRelease;
		const tagPrefix = await this.getTagPrefix(override);
		const name = await manifest.getName();
		if (forcedVersion && valid(forcedVersion)) {
			logger?.verbose(`Using specified version "${forcedVersion}" for "${name}".`);
			return setSnapshotIdentifier(forcedVersion, snapshot);
		}
		if (isUndefined(firstRelease)) isFirstRelease = await this.isFirstRelease({ tagPrefix });
		const version = baseVersion ?? await manifest.getVersion();
		if (isFirstRelease) {
			logger?.verbose(`First release detected for "${name}".`);
			return setSnapshotIdentifier(version, snapshot);
		}
		const forcePrerelease = equals("prerelease", as);
		let releaseType = as;
		if (!as || forcePrerelease) {
			const inferred = await this.inferReleaseType({
				...options,
				tagPrefix
			});
			if (inferred) releaseType = inferred;
		}
		if (!releaseType) {
			if (!snapshot && !forcePrerelease) {
				logger?.verbose(`No release type detected for "${name}".`);
				return;
			}
			logger?.verbose(`No release type detected for "${name}", defaulting to "patch" for snapshot or forced prerelease mode.`);
			releaseType = "patch";
		}
		const identifier = getPrereleaseIdentifier(forcePrerelease ? prerelease ?? "beta" : prerelease, snapshot);
		return inc(version, getReleaseType(releaseType, version, identifier), false, identifier, getPrereleaseIdentifierBase(snapshot));
	}
	async inferReleaseType(options = {}) {
		const { logger, tagPrefix: override } = options;
		const { manifest } = this;
		const tagPrefix = await this.getTagPrefix(override);
		const { releaseType, reason } = await this.changelog({
			...options,
			tagPrefix
		}).inferReleaseType();
		if (reason) logger?.verbose(`${reason} for "${await manifest.getName()}"`);
		return releaseType;
	}
	async bump(options = {}) {
		const { logger, firstRelease } = options;
		const { manifest } = this;
		const name = await manifest.getName();
		const version = await manifest.getVersion();
		const nextVersion = await this.getNextVersion(options);
		if (!nextVersion || version === nextVersion && !firstRelease) {
			logger?.verbose(`No version changes for "${name}". Skipping.`);
			return false;
		}
		const { tagPrefix: override, skipChangelog, dryRun } = options;
		const versionUpdate = {
			...await manifest.writeVersion(nextVersion, dryRun),
			notes: ""
		};
		this.versionUpdates.push(versionUpdate);
		this.changedFiles.push(...versionUpdate.files);
		if (version === nextVersion) logger?.verbose(`${name}: ${nextVersion}`);
		else logger?.verbose(`${name}: ${version} -> ${nextVersion}`);
		if (!skipChangelog) {
			const tagPrefix = await this.getTagPrefix(override);
			const lastReleaseTag = await this.getLastReleaseTag({ tagPrefix });
			const log = this.changelog({
				...options,
				tagPrefix
			});
			log.setOptions({
				version: nextVersion,
				previousTag: lastReleaseTag
			});
			versionUpdate.notes = dryRun ? await log.read() : await log.write();
			logger?.verbose(`Release notes:\n\n${versionUpdate.notes ?? "..."}`);
			this.changedFiles.push(log.infile);
		}
		return true;
	}
	async revert(options = {}, filesSet = /* @__PURE__ */ new Set()) {
		const { manifest, versionUpdates } = this;
		const { dryRun, logger } = options;
		if (isEmpty(versionUpdates)) return false;
		for (const update of versionUpdates) {
			logger?.verbose(`Reverting ${update.name}: ${update.to} -> ${update.from}`);
			update.files.forEach((file) => filesSet.add(file));
			await manifest.writeVersion(update.from, dryRun);
		}
		this.changedFiles = this.changedFiles.filter((file) => !filesSet.has(file));
		this.versionUpdates.length = 0;
		return true;
	}
};
//#endregion
//#region src/core/project/monorepo.ts
var MonorepoProject = class extends Project {
	mode;
	async getCommitMessage() {
		if (this.isFixedMode) return super.getCommitMessage();
		return this.getIndependentCommitMessage();
	}
	async getTagPrefix(scope) {
		if (this.options.tagPrefix) return this.options.tagPrefix(scope ?? "");
		if (this.isFixedMode) return super.getTagPrefix();
		return `${scope}@`;
	}
	async getTags(options = {}) {
		if (this.isFixedMode) return super.getTags(options);
		return this.getIndependentTags(options);
	}
	async getReleaseData(options = {}) {
		if (this.isFixedMode) return super.getReleaseData(options);
		return this.getIndependentReleaseData(options);
	}
	async isFirstRelease(options = {}) {
		if (this.isFixedMode) return super.isFirstRelease(options);
		return this.isIndependentFirstRelease();
	}
	async getDefaultPublishTag(options = {}) {
		if (this.isFixedMode) return super.getDefaultPublishTag(options);
		return this.getIndependentDefaultPublishTag(options);
	}
	async getMaintenanceBranches(options = {}) {
		if (this.isFixedMode) return super.getMaintenanceBranches(options);
		return this.getIndependentMaintenanceBranches(options);
	}
	getNextVersion(options = {}) {
		if (this.isFixedMode && options.version) return super.getNextVersion(options);
		throwError("Monorepo project \"independent\" mode does not support getNextVersion");
	}
	async bump(options = {}) {
		if (this.isFixedMode) return this.fixedBump(options);
		return this.independentBump(options);
	}
	async revert(options = {}) {
		const { manifest, versionUpdates } = this;
		const { dryRun, logger } = options;
		const files = /* @__PURE__ */ new Set();
		const rootUpdate = versionUpdates.find(({ files }) => files.includes(manifest.filepath));
		let hasRevert = false;
		if (rootUpdate) {
			logger?.verbose(`Reverting ${rootUpdate.name}: ${rootUpdate.to} -> ${rootUpdate.from}`);
			rootUpdate.files.forEach((file) => files.add(file));
			await manifest.writeVersion(rootUpdate.from, dryRun);
			hasRevert = true;
		}
		for await (const project of this.getProjects()) hasRevert = await project.revert(options, files) || hasRevert;
		this.changedFiles = this.changedFiles.filter((file) => !files.has(file));
		this.versionUpdates.length = 0;
		return hasRevert;
	}
	projectsMutex;
	constructor(options) {
		const { mode, compose } = options;
		super({
			...options,
			compose: compose ? (manifest, isRoot = true) => compose(manifest, isRoot) : (manifest) => manifest
		});
		this.mode = mode;
	}
	get isFixedMode() {
		return this.mode === "fixed";
	}
	get isIndependentMode() {
		return this.mode === "independent";
	}
	async *getProjects() {
		if (!this.projectsMutex) {
			const { compose, getProjects } = this.options;
			const options = {
				compose: (manifest) => compose(manifest, false),
				manifest: this.manifest
			};
			this.projectsMutex = (async () => {
				const projects = [];
				for await (const project of getProjects(options)) if (!await project.manifest.isPrivate()) projects.push(project);
				return projects;
			})();
		}
		yield* await this.projectsMutex;
	}
	async getScope(name) {
		if (this.options.scope) return this.options.scope(name, await this.manifest.getName());
		return name.replace(/@[^/]+\//, "");
	}
	async getMaxVersion() {
		const { manifest } = this;
		let max = await manifest.getVersion();
		const packages = [];
		for await (const project of this.getProjects()) {
			const name = await project.manifest.getName();
			const version = await project.manifest.getVersion();
			if (gt(version, max)) {
				max = version;
				packages.length = 0;
			}
			if (version === max) packages.push(name);
		}
		return {
			version: max,
			packages
		};
	}
	getIndependentCommitMessage() {
		const { versionUpdates } = this;
		if (isEmpty(versionUpdates)) throwError("Nothing to commit");
		return `chore(release): monorepo release\n\n${versionUpdates.map(({ name, to }) => `- ${name}@${to}`).join("\n")}`;
	}
	async getIndependentTags(options) {
		const tags = [];
		for await (const project of this.getProjects()) if (project.hasBump) {
			const name = await project.manifest.getName();
			const scope = await this.getScope(name);
			const tagPrefix = await this.getTagPrefix(scope);
			tags.push(...await project.getTags({
				...options,
				tagPrefix
			}));
		}
		return tags;
	}
	async getIndependentReleaseData(options) {
		const data = [];
		for await (const project of this.getProjects()) if (project.hasBump) {
			const name = await project.manifest.getName();
			const scope = await this.getScope(name);
			const tagPrefix = await this.getTagPrefix(scope);
			const version = await project.manifest.getVersion();
			const releaseData = await project.getReleaseData({
				...options,
				tagPrefix
			});
			data.push(...releaseData.map((data) => ({
				...data,
				title: this.toTag(tagPrefix, version)
			})));
		}
		return data;
	}
	async getIndependentDefaultPublishTag(options) {
		const map = /* @__PURE__ */ new Map();
		for await (const project of this.getProjects()) {
			const name = await project.manifest.getName();
			const scope = await this.getScope(name);
			const tagPrefix = await this.getTagPrefix(scope);
			const tag = await project.getDefaultPublishTag({
				...options,
				tagPrefix
			});
			map.set(name, tag.get(name));
		}
		return map;
	}
	async getIndependentMaintenanceBranches(options) {
		const branches = [];
		for await (const project of this.getProjects()) {
			const name = await project.manifest.getName();
			const scope = await this.getScope(name);
			const tagPrefix = await this.getTagPrefix(scope);
			branches.push(...await project.getMaintenanceBranches({
				...options,
				tagPrefix
			}));
		}
		return branches;
	}
	async getBumpOptions(project, options, baseVersion, firstRelease) {
		const { extraScopes = [], byProject, force, ...bumpOptions } = options;
		const name = await project.manifest.getName();
		const scope = await this.getScope(name);
		const tagPrefix = await this.getTagPrefix(scope);
		return {
			firstRelease,
			...bumpOptions,
			...byProject?.[name],
			scope: [scope, ...extraScopes],
			tagPrefix,
			baseVersion
		};
	}
	async independentBump(options = {}) {
		let hasBump = false;
		for await (const project of this.getProjects()) {
			const projectBumpOptions = await this.getBumpOptions(project, options);
			hasBump = await project.bump(projectBumpOptions) || hasBump;
			this.changedFiles.push(...project.changedFiles);
			this.versionUpdates.push(...project.versionUpdates);
		}
		return hasBump;
	}
	async fixedBump(options = {}) {
		const { force } = options;
		const { manifest } = this;
		const rootVersion = await manifest.getVersion();
		const name = await manifest.getName();
		const tagPrefix = await this.getTagPrefix(name);
		const firstRelease = await this.isFirstRelease({ tagPrefix });
		let hasBump = false;
		let fixedVersion;
		const updatedProjects = [];
		for await (const project of this.getProjects()) {
			const projectBumpOptions = await this.getBumpOptions(project, options, rootVersion, firstRelease);
			const nextVersion = await project.getNextVersion(projectBumpOptions);
			if (nextVersion || force) {
				updatedProjects.push({
					project,
					options: projectBumpOptions
				});
				if (nextVersion && (!fixedVersion || gt(nextVersion, fixedVersion))) fixedVersion = nextVersion;
			}
		}
		if (fixedVersion) {
			hasBump = await super.bump({
				...options,
				forcePrivate: true,
				version: fixedVersion,
				tagPrefix
			});
			for (const { project, options } of updatedProjects) {
				hasBump = await project.bump({
					...options,
					version: fixedVersion
				}) || hasBump;
				this.changedFiles.push(...project.changedFiles);
				this.versionUpdates.push(...project.versionUpdates);
			}
		}
		return hasBump;
	}
	async isIndependentFirstRelease(options = {}) {
		let allFirst = true;
		for await (const project of this.getProjects()) {
			const name = await project.manifest.getName();
			const scope = await this.getScope(name);
			const tagPrefix = await this.getTagPrefix(scope);
			allFirst &&= await project.isFirstRelease({
				...options,
				tagPrefix
			});
		}
		return allFirst;
	}
};
//#endregion
//#region src/core/project/packageJson.ts
var PackageJsonProject = class extends Project {
	constructor(options = {}) {
		const { path = PackageJsonManifest.Filename } = options;
		super({
			...options,
			manifest: new PackageJsonManifest(path)
		});
	}
	publish(_options) {
		throwError("Publishing a package.json project is not supported");
	}
	publishCheck(_options) {
		throwError("Publishing a package.json project is not supported");
	}
};
//#endregion
//#region src/core/project/packageJsonMonorepo.ts
/**
* 基于 package.json 的单体仓库项目。
*/
var PackageJsonMonorepoProject = class extends MonorepoProject {
	constructor(options) {
		const { root = process.cwd(), getProjects } = options;
		super({
			...options,
			manifest: new PackageJsonManifest(normalizePath(join(root, PackageJsonManifest.Filename))),
			async *getProjects(options) {
				for await (const path of getProjects(options)) yield new PackageJsonProject({
					path: isAbsolute(path) ? path : normalizePath(join(root, path)),
					...options
				});
			}
		});
	}
	publish(_options) {
		throwError("Publishing a package.json monorepo project is not supported");
	}
	publishCheck(_options) {
		throwError("Publishing a package.json monorepo project is not supported");
	}
};
//#endregion
//#region src/core/logger.ts
const defaultPrinter = ({ dryRun, stage, message }) => {
	console.log(`${dryRun ? `[dry-run]` : ""}[${stage}]:`, message);
};
/** 一个子消息记录器，绑定到特定阶段 */
var ChildLogger = class {
	parent;
	stage;
	/**
	* 创建子日志记录器。
	* @param parent - 要继承其选项的父日志记录器。
	* @param stage - 此日志记录器所属的处理阶段。
	*/
	constructor(parent, stage) {
		this.parent = parent;
		this.stage = stage;
	}
	/**
	* 记录一条普通信息。
	* @param message - 要记录的信息。
	*/
	info(message) {
		this.parent.info(this.stage, message);
	}
	/**
	* 记录一条详细信息。
	* @param message - 要记录的信息。
	*/
	verbose(message) {
		this.parent.verbose(this.stage, message);
	}
};
/** 消息记录器 */
var Logger = class {
	options;
	printer;
	colors;
	colorMap = /* @__PURE__ */ new Map();
	constructor(options = {}) {
		this.options = options;
		const { colors = [], printer = defaultPrinter } = options;
		this.colors = colors;
		this.printer = printer;
	}
	info(stage, message) {
		const { silent, dryRun } = this.options;
		if (!silent) {
			const color = this.getColor(stage);
			this.printer({
				dryRun,
				stage,
				message,
				color
			});
		}
	}
	verbose(stage, message) {
		const { silent, verbose, dryRun } = this.options;
		if (!silent && (verbose || dryRun)) {
			const color = this.getColor(stage);
			this.printer({
				dryRun,
				stage,
				message,
				color
			});
		}
	}
	createChild(stage) {
		return new ChildLogger(this, stage);
	}
	getColor(stage) {
		const cached = this.colorMap.get(stage);
		if (cached) return cached;
		const index = this.colorMap.size % this.colors.length;
		const color = this.colors[index] ?? ((text) => text);
		this.colorMap.set(stage, color);
		return color;
	}
};
//#endregion
//#region src/core/releaser.ts
var Releaser = class {
	options;
	project;
	hosting;
	logger;
	stepsOptions = {};
	skippedSteps = {};
	state = {};
	queue = [];
	constructor(options) {
		this.options = options;
		const { project, hosting, logger, ...log } = options;
		this.project = project;
		this.hosting = hosting;
		this.logger = logger ?? new Logger(log);
	}
	enqueue(fn) {
		this.queue.push(fn);
		return this;
	}
	setOptions(options) {
		const logger = this.logger.createChild("set-options");
		logger.verbose("Setting options for steps:");
		logger.verbose(options);
		for (const [key, value] of Object.entries(options)) Object.assign(this.stepsOptions[key] ??= {}, value);
		logger.verbose("Final options for steps:");
		logger.verbose(this.stepsOptions);
		return this;
	}
	setUser(options) {
		return this.enqueue(async () => {
			const { options: { dryRun }, stepsOptions: { setUser } } = this;
			const { username, email } = {
				...setUser,
				...options
			};
			const logger = this.logger.createChild("set-user");
			if (this.shouldSkip("setUser")) {
				logger.info("Skipping set git user.");
				return;
			}
			logger.info("Setting git user...");
			if (!username && !email) {
				logger.info("No git user configuration provided.");
				return;
			}
			if (username) {
				logger.verbose(`Setting git user.name to "${username}".`);
				if (!dryRun) await gitConfigSet("user.name", username);
			}
			if (email) {
				logger.verbose(`Setting git user.email to "${email}".`);
				if (!dryRun) await gitConfigSet("user.email", email);
			}
		});
	}
	setSkippedSteps(options) {
		const logger = this.logger.createChild("set-skipped-steps");
		logger.verbose("Setting skipped for steps:");
		logger.verbose(options);
		Object.assign(this.skippedSteps, options);
		logger.verbose("Final skipped for steps:");
		logger.verbose(this.skippedSteps);
		return this;
	}
	checkout(options) {
		return this.enqueue(async () => {
			const { options: { dryRun }, stepsOptions: { checkout } } = this;
			const { branch: headBranch = "release-branch", fetch, force } = {
				...checkout,
				...options
			};
			const logger = this.logger.createChild("checkout");
			if (this.shouldSkip("checkout")) {
				logger.info("Skipping checkout.");
				return;
			}
			logger.info(`Checking out branch ${headBranch}...`);
			this.state.headBranch = headBranch;
			this.state.baseBranch = await this.getBaseBranch();
			if (fetch) {
				logger.verbose(`Fetching all commits and tags from the remote repository...`);
				if (!dryRun) await gitFetch([
					"--prune",
					"--unshallow",
					"--tags",
					"--",
					"origin",
					"HEAD"
				]);
			}
			if (force) {
				logger.verbose(`Force checking out branch ${headBranch}...`);
				if (!dryRun) await gitCheckoutBranchForce(headBranch);
			} else {
				logger.verbose(`Checking out branch ${headBranch}...`);
				if (!dryRun) await gitCheckoutBranch(headBranch);
			}
		});
	}
	bump(options) {
		return this.enqueue(async () => {
			const { project, options: { dryRun }, stepsOptions: { bump } } = this;
			const logger = this.logger.createChild("bump");
			if (this.shouldSkip("bump")) {
				logger.info("Skipping bump.");
				return;
			}
			logger.info("Bumping version...");
			const done = await project.bump({
				dryRun,
				logger,
				...bump,
				...options
			});
			this.state.bump = done;
			if (!done) logger.info("No version changes detected.");
		});
	}
	commit(options) {
		return this.enqueue(async () => {
			const { project, options: { dryRun }, state, stepsOptions: { commit } } = this;
			const { sign, allowEmpty } = {
				...commit,
				...options
			};
			const logger = this.logger.createChild("commit");
			if (this.shouldSkip("commit")) {
				logger.info("Skipping commit.");
				return;
			}
			logger.info(`Committing changes...`);
			if (!state.bump) {
				logger.info("No changes to commit.");
				return;
			}
			const files = project.changedFiles;
			const message = await project.getCommitMessage();
			logger.verbose(`Files to commit:`);
			files.forEach((file) => {
				logger.verbose(`- ${file}`);
			});
			logger.verbose(message.includes("\n") ? `Commit message:\n\n${message}` : `Commit message: ${message}`);
			if (!dryRun) {
				await gitAdd(["--", ...files]);
				await gitCommitMessage(message, [
					...when(sign, "--gpg-sign"),
					...when(allowEmpty, "--allow-empty"),
					"--no-verify"
				]);
			}
		});
	}
	revert() {
		return this.enqueue(async () => {
			const { project, logger, options: { dryRun } } = this;
			logger.info("revert", "Reverting version updates...");
			if (!await project.revert({
				dryRun,
				logger: logger.createChild("revert")
			})) {
				logger.info("revert", "No version updates to revert.");
				return;
			}
			this.state.bump = false;
		});
	}
	maintenanceBranch(options) {
		return this.enqueue(async () => {
			const { project, options: { dryRun }, stepsOptions: { maintenanceBranch } } = this;
			const { enabled, force } = {
				...maintenanceBranch,
				...options
			};
			const logger = this.logger.createChild("maintenance-branch");
			if (this.shouldSkip("maintenanceBranch")) {
				logger.info("Skipping create maintenance branches.");
				return;
			}
			logger.info("Creating maintenance branches...");
			if (!enabled) {
				logger.info("Maintenance branch creation is disabled.");
				return;
			}
			logger.verbose("Fetching fresh tags from the remote repository...");
			if (!dryRun) await gitFetch(["--tags"]);
			const branches = await project.getMaintenanceBranches();
			if (!branches.length) {
				logger.info("No maintenance branches to create.");
				return;
			}
			logger.verbose("Branches to create:");
			for (const { from, to } of branches) {
				logger.verbose(`- ${to} from ${from}`);
				if (dryRun) continue;
				if ((await gitRevParse(["--verify", `refs/heads/${to}`]) || await gitLsRemote([
					"--heads",
					"origin",
					to
				])) && !force) {
					logger.info(`Branch ${to} already exists, skipping.`);
					continue;
				}
				const args = when(force, "--force");
				await gitBranch([
					...args,
					"--",
					to,
					from
				]);
				await gitPushBranch("origin", to, ["--no-verify", ...args]);
			}
		});
	}
	tag(options) {
		return this.enqueue(async () => {
			const { project, options: { dryRun }, stepsOptions: { tag } } = this;
			const { fetch, sign } = {
				...tag,
				...options
			};
			const logger = this.logger.createChild("tag");
			if (this.shouldSkip("tag")) {
				logger.info("Skipping tag.");
				return;
			}
			logger.info("Tagging version...");
			if (fetch) {
				logger.verbose("Fetching fresh tags from the remote repository...");
				if (!dryRun) await gitFetch(["--tags"]);
			}
			const tags = await project.getTags();
			this.state.tags = tags.length > 0;
			if (!this.state.tags) {
				logger.info("No version changes detected.");
				return;
			}
			logger.verbose(`Tags to create:`);
			for (const tag of tags) {
				logger.verbose(`- ${tag}`);
				if (!dryRun) await gitTag([
					sign ? "--sign" : "--annotate",
					"--message",
					tag,
					tag
				]);
			}
		});
	}
	push(options) {
		return this.enqueue(async () => {
			const { options: { dryRun }, state, stepsOptions: { push } } = this;
			const { force } = {
				...push,
				...options
			};
			const logger = this.logger.createChild("push");
			if (this.shouldSkip("push")) {
				logger.info("Skipping push.");
				return;
			}
			const branch = await gitBranchCurrent();
			logger.info(`Pushing changes to "${branch}"...`);
			if (!state.bump && !state.tags) {
				logger.info("Nothing to push.");
				return;
			}
			if (!dryRun) {
				if (state.bump) await gitPushBranch("origin", branch, [...when(force, "--force"), "--no-verify"]);
				if (state.tags) await gitPush([
					"origin",
					"--tags",
					"--no-verify"
				]);
			}
		});
	}
	publish(options) {
		return this.enqueue(async () => {
			const { project, options: { dryRun }, stepsOptions: { publish } } = this;
			const logger = this.logger.createChild("publish");
			if (this.shouldSkip("publish")) {
				logger.info("Skipping publish.");
				return;
			}
			logger.info("Publishing...");
			const tagsMap = await project.getDefaultPublishTag();
			const name = await project.manifest.getName();
			const tag = tagsMap.get(name);
			await project.publish({
				dryRun,
				logger,
				tag,
				...publish,
				...options
			});
		});
	}
	release(option) {
		const { hosting } = this;
		if (!hosting) throwError("Hosting service is not configured. Please set the hosting option.");
		return this.enqueue(async () => {
			const { project, options: { dryRun }, stepsOptions: { release } } = this;
			const logger = this.logger.createChild("release");
			if (this.shouldSkip("release")) {
				logger.info("Skipping release.");
				return;
			}
			logger.info("Creating release...");
			await hosting.createRelease({
				project,
				dryRun,
				logger,
				...release,
				...option
			});
		});
	}
	pullRequest(option) {
		const { hosting } = this;
		if (!hosting) throwError("Hosting service is not configured. Please set the hosting option.");
		return this.enqueue(async () => {
			const { project, state, options: { dryRun }, stepsOptions: { pullRequest } } = this;
			const logger = this.logger.createChild("pull-request");
			if (this.shouldSkip("pullRequest")) {
				logger.info("Skipping pull request.");
				return;
			}
			logger.info("Creating pull request...");
			if (!state.bump) {
				logger.info("No version changes detected, skipping pull request creation.");
				return;
			}
			if (!state.headBranch) {
				logger.info("Head branch is not set, skipping pull request creation.");
				return;
			}
			await hosting.createPullRequest({
				project,
				dryRun,
				logger,
				from: state.headBranch,
				to: await this.getBaseBranch(),
				...pullRequest,
				...option
			});
		});
	}
	async run(condition) {
		let shouldRun = true;
		if (condition) {
			const logger = this.logger.createChild("run");
			logger.info("Checking condition...");
			shouldRun = await condition(this);
			if (shouldRun) logger.info("Condition passed, running release steps...");
			else logger.info("Condition failed, skipping release steps.");
		}
		if (shouldRun) for (const fn of this.queue) await fn();
		const logger = this.logger.createChild("done");
		this.queue.length = 0;
		logger.info(`Done!`);
	}
	shouldSkip(step) {
		return this.skippedSteps[step] === true;
	}
	async getBaseBranch() {
		const { state: { baseBranch } } = this;
		if (baseBranch) return baseBranch;
		return gitBranchCurrent();
	}
};
//#endregion
//#region src/hosting-github/github.ts
var GithubHosting = class extends GitRepositoryHosting {
	options;
	octokit;
	browser;
	constructor(options = {}) {
		const { octokit, token, browser } = options;
		super();
		this.options = options;
		this.browser = browser ?? (!octokit && !token);
		this.octokit = octokit ?? new Octokit({ auth: token });
	}
	async createRelease(options) {
		const { project, dryRun, logger } = options;
		const { octokit, browser } = this;
		const releaseData = await project.getReleaseData();
		if (isEmpty(releaseData)) {
			logger?.info("No release data found. Skipping release creation.");
			return;
		}
		const [owner, repo] = await this.getRepositoryId(project);
		for (const data of releaseData) {
			logger?.verbose(`Creating GitHub release "${data.title}"...`);
			const browserRelease = async () => {
				const url = new URL(`${getGithubUrl(owner, repo)}/releases/new`);
				Object.entries({
					tag: data.nextTag,
					title: data.title,
					body: data.notes,
					prerelease: data.isPrerelease
				}).forEach(([key, value]) => {
					url.searchParams.set(key, String(value));
				});
				logger?.verbose(`Opening GitHub release page for tag "${data.nextTag}"...`);
				await open(url.toString());
				await sleep(1500);
			};
			const resetRelease = async () => {
				const res = await (async () => {
					const release = await this.getRelease({
						owner,
						repo,
						tag: data.nextTag
					});
					const opts = {
						owner,
						repo,
						tag_name: data.nextTag,
						name: data.title,
						body: data.notes,
						prerelease: data.isPrerelease,
						make_latest: data.isLatest ? "true" : "false"
					};
					if (release) {
						const { data } = await octokit.repos.updateRelease({
							...opts,
							release_id: release.id
						});
						return data;
					} else {
						const { data } = await octokit.repos.createRelease({
							...opts,
							draft: false
						});
						return data;
					}
				})();
				if (!res) return;
				await this.uploadAssets({
					owner,
					repo,
					release_id: res.id,
					assets: []
				});
			};
			if (!dryRun) browser ? await browserRelease() : await resetRelease();
		}
	}
	async createPullRequest(options) {
		const { project, dryRun, draft, logger } = options;
		let { from, to } = options;
		const { octokit } = this;
		const [owner, repo] = await this.getRepositoryId(project);
		from ||= await gitBranchCurrent();
		to ||= await this.getDefaultBranch(owner, repo);
		if (from === to) throwError("Cannot create a pull request from the same branch.");
		const [pr] = await this.listPullRequest({
			owner,
			repo,
			from
		});
		if (pr) logger?.info(`Updating existing pull request #${pr.number}`);
		logger?.verbose("Pull request data:");
		if (!pr && draft) logger?.verbose("Draft: true");
		const { title, body } = await this.getPullRequestData(project, from, to);
		logger?.verbose(`${from} -> ${to}`);
		logger?.verbose(`Title: ${title}`);
		logger?.verbose(`Body:\n\n${body}`);
		const opts = {
			owner,
			repo,
			title,
			body
		};
		if (!dryRun) {
			if (pr) await octokit.rest.pulls.update({
				...opts,
				pull_number: pr.number
			});
			else await octokit.rest.pulls.create({
				...opts,
				base: to,
				head: from,
				draft
			});
		}
	}
	async releaseCheck(options = {}) {
		const { logger } = options;
		logger?.verbose("Checking GitHub repository configuration...");
		const remoteUrl = await gitConfigGet("remote.origin.url");
		const useGithub = isNotEmpty(parseGitHubRepo(remoteUrl));
		assert(useGithub, "Git remote \"origin\" is not a GitHub repository");
	}
	async getRepositoryId(project) {
		let { options: { owner, repo } } = this;
		const i = project.getHostedGitInfo();
		return [owner ?? (await i).owner, repo ?? (await i).repo];
	}
	async uploadAssets(options) {
		const { octokit } = this;
		const { owner, repo, release_id, assets } = options;
		const files = await glob(assets);
		await Promise.all(files.map((file) => {
			const { base: filename } = parse(file);
			return octokit.repos.uploadReleaseAsset({
				owner,
				repo,
				release_id,
				name: filename,
				data: readFileSync(file, "utf-8")
			});
		}));
	}
	async getRelease(options) {
		const { octokit } = this;
		const { data } = await tryCall(() => octokit.rest.repos.getReleaseByTag({ ...options }), { data: void 0 });
		return data;
	}
	async listPullRequest(options) {
		const { octokit } = this;
		const { owner, repo, from } = options;
		const { data } = await tryCall(() => octokit.rest.pulls.list({
			owner,
			repo,
			head: `${owner}:${from}`,
			state: "open"
		}), { data: [] });
		return data;
	}
	async getDefaultBranch(owner, repo) {
		const { octokit } = this;
		const { data: { default_branch } } = await tryCall(() => octokit.rest.repos.get({
			owner,
			repo
		}), { data: { default_branch: "master" } });
		return default_branch;
	}
	async getPullRequestData(project, from, to) {
		const title = (await project.getCommitMessage()).split("\n")[0];
		const updates = project.versionUpdates.map(({ name, notes }) => `# ${name}\n\n${notes.trim()}`).join("\n\n");
		return {
			title,
			body: dedent(`
      ${updates}
          
      <!--
        Please do not edit this comment.
        release-pull-request: true
        release-branch-from: ${from}
        release-branch-to: ${to}
      -->
    `)
		};
	}
};
//#endregion
//#region src/project-github-action/publish.ts
const runBuildCommands = async (commands, options, cwd) => {
	const { dryRun, env = process.env, logger } = options;
	for (const command of commands) {
		logger?.info(`Running build command: ${command}`);
		if (!dryRun) await execAsync(command, {
			cwd,
			env,
			error: "log"
		});
	}
};
const publish = async (project, options = {}) => {
	const { manifest, manifest: { projectDir } } = project;
	const { dryRun, logger, tag } = options;
	const publishTag = isFunction(tag) ? tag(await manifest.getVersion(), await manifest.getPrereleaseVersion()) : tag ?? "latest";
	const pkg = await manifest.readManifest();
	const version = await manifest.getVersion();
	const validVersion = valid(version);
	if (!validVersion) throwError(`Invalid GitHub Action version: ${version}`);
	const { build = [], files = pkg.files = [] } = options;
	const tagPrefix = await project.getTagPrefix();
	const withTag = (version, tag) => {
		return equals(tag, "latest") ? version : `${version}-${tag}`;
	};
	const majorBranch = withTag(`${tagPrefix}${major(validVersion)}`, publishTag);
	const versionTag = project.toTag(tagPrefix, validVersion);
	const buildBranch = publishTag;
	const buildCommands = Array.isArray(build) ? build : [build];
	const originalBranch = await gitBranchCurrent();
	const releaseCommit = await gitRevParse(["--verify", "HEAD"]);
	logger?.info(`Publishing GitHub Action ${versionTag}...`);
	logger?.verbose(`Build branch: ${buildBranch}`);
	logger?.verbose(`Major branch: ${majorBranch}`);
	let shouldRestoreBranch = false;
	try {
		if (!dryRun) {
			if (await gitRevParse(["--is-shallow-repository"]) === "true") {
				logger?.info("Fetching git history...");
				await gitFetch([
					"--deepen=1",
					"--",
					"origin",
					originalBranch
				]);
			}
			await gitCheckoutBranchForce(buildBranch, releaseCommit);
			shouldRestoreBranch = originalBranch !== buildBranch;
		}
		await runBuildCommands(buildCommands, options, projectDir);
		if (!dryRun && files.length) {
			logger?.info("Staging GitHub Action files...");
			await gitAdd([
				"--force",
				"--",
				...files
			]);
			if (await gitDiff(["--cached", "--name-only"])) await gitCommitAmendNoEdit(["--no-verify"]);
		}
		if (!dryRun) {
			logger?.info("Creating GitHub Action release refs...");
			await gitBranch([
				"-f",
				"--",
				majorBranch,
				"HEAD"
			]);
			await gitTag([
				"-f",
				"--",
				versionTag,
				"HEAD"
			]);
			logger?.info("Pushing GitHub Action release refs...");
			await gitPush([
				"--force",
				"--no-verify",
				"origin",
				"--",
				buildBranch
			]);
			await gitPush([
				"--force",
				"--no-verify",
				"origin",
				"--",
				majorBranch
			]);
			await gitPush([
				"--force",
				"--no-verify",
				"origin",
				"--",
				versionTag
			]);
		}
	} finally {
		if (shouldRestoreBranch) await gitCheckout([originalBranch]);
	}
};
//#endregion
//#region src/project-github-action/project.ts
/** Node.js GitHub Actions 项目，将版本引用发布到 Git 分支和标签 */
var NodeGithubActionProject = class extends PackageJsonProject {
	/**
	* 获取项目最近一次发布的标签。
	* GitHub Action 发布标签指向发布分支中的打包提交，无法从源分支到达。因此需要遍历所有引用，并通过标签的父提交判断它是否属于当前分支。
	*/
	async getLastReleaseTag(options = {}) {
		const { tagPrefix: override } = options;
		const tags = getSemverTags({
			prefix: await this.getTagPrefix(override),
			all: true
		});
		for await (const tag of tags) if (await this.isReachableFromHead(tag) || await this.isReachableFromHead(`${tag}^`)) return tag;
	}
	async publish(options = {}) {
		const tagsMap = await this.getDefaultPublishTag();
		const name = await this.manifest.getName();
		const tag = tagsMap.get(name);
		await publish(this, {
			tag,
			...options
		});
	}
	async publishCheck(options) {
		const { logger } = options;
		logger?.verbose("Checking GitHub repository configuration...");
		const remoteUrl = await gitConfigGet("remote.origin.url");
		const useGithub = isNotEmpty(parseGitHubRepo(remoteUrl));
		assert(useGithub, "Git remote \"origin\" is not a GitHub repository");
	}
	constructor(options = {}) {
		super(options);
	}
	async isReachableFromHead(ref) {
		return tryCall(() => runGit([
			"merge-base",
			"--is-ancestor",
			ref,
			"HEAD"
		]), false);
	}
};
//#endregion
//#region src/project-npm/check.ts
const check$1 = async (project, options = {}) => {
	const { logger } = options;
	logger?.verbose("Checking npm registry...");
	const pinged = await pingRegistry();
	assert(pinged, "Unable to connect to the npm registry");
	logger?.verbose("Checking npm authentication...");
	const username = await getAuthenticatedUser();
	assert(username, "Not authenticated with npm");
	const name = await project.manifest.getName();
	if (await getPublishedVersion(name)) {
		logger?.verbose(`Checking npm write access for "${name}"...`);
		const hasAccess = await hasWriteAccess(name, username);
		assert(hasAccess, `No write access to npm package "${name}"`);
	}
};
//#endregion
//#region src/project-npm/cleanup.ts
const PUBLISH_CONFIG_FIELDS$1 = [
	"bin",
	"main",
	"exports",
	"types",
	"typings",
	"module",
	"browser",
	"esnext",
	"es2015",
	"unpkg",
	"umd:main",
	"typesVersions",
	"cpu",
	"os",
	"engines"
];
const IGNORE_FIELDS$1 = [
	"babel",
	"browserslist",
	"c8",
	"commitlint",
	"devDependencies",
	"eslintConfig",
	"eslintIgnore",
	"husky",
	"jest",
	"lint-staged",
	"nano-staged",
	"pre-commit",
	"prettier",
	"pwmetrics",
	"remarkConfig",
	"renovate",
	"resolutions",
	"sharec",
	"simple-git-hooks",
	"simple-pre-commit",
	"size-limit",
	"typeCoverage",
	"yaspeller",
	"pnpm",
	"packageManager"
];
const KEEP_SCRIPT_NAMES$1 = [
	"preinstall",
	"install",
	"postinstall"
];
const IGNORE_FILES$1 = [
	".DS_Store",
	".git",
	".vscode",
	".idea",
	"node_modules"
];
const cleanPackageJSON$1 = async (dir, options) => {
	const file = join(dir, "package.json");
	const json = await readJsonFile(file);
	const { ignoreFields = [], keepScripts = [] } = options ?? {};
	const mergePublishConfig = (json) => {
		if (!json.publishConfig) return json;
		const publishConfig = { ...json.publishConfig };
		PUBLISH_CONFIG_FIELDS$1.forEach((field) => {
			if (publishConfig[field]) {
				json[field] = publishConfig[field];
				delete publishConfig[field];
			}
		});
		return {
			...json,
			publishConfig
		};
	};
	const removeIgnoredFields = (json) => {
		const fields = [...ignoreFields, ...IGNORE_FIELDS$1];
		const [matched, unmatched] = partition(fields, (i) => i.includes("."));
		matched.forEach((field) => unset(json, field));
		return omit(json, unmatched);
	};
	const cleanScripts = (json) => {
		if (!json.scripts) return json;
		const keep = [...keepScripts, ...KEEP_SCRIPT_NAMES$1];
		const excludes = Object.keys(json.scripts).filter((k) => !keep.includes(k));
		json.scripts = omit(json.scripts, excludes);
		return json;
	};
	const removeEmptyObjects = (json) => {
		const excludes = Object.entries(json).filter(([k, v]) => isEmptyObject(v)).map(([k, v]) => k);
		return omit(json, excludes);
	};
	const cleaned = removeEmptyObjects(cleanScripts(removeIgnoredFields(structuredClone(mergePublishConfig(json)))));
	await writeJsonFile(file, cleaned);
};
const cleanReadme$1 = async (dir, homepage) => {
	const file = join(dir, "README.md");
	homepage && await editFile(file, (str) => {
		return str.split(/^##\s+\S.*$/m)[0] + `## Docs

Read full docs **[here](${homepage})**.`;
	});
};
//#endregion
//#region src/project-npm/publish.ts
const publish$2 = async (project, options = {}) => {
	const { manifest, manifest: { projectDir } } = project;
	const { access, tag, otp, env = process.env, dryRun, logger, cleanPublish } = options;
	const publishTag = isFunction(tag) ? tag(await manifest.getVersion(), await manifest.getPrereleaseVersion()) : tag;
	const args = [
		"publish",
		...when(access, "--access", access),
		...when(publishTag, "--tag", publishTag),
		...when(dryRun, "--dry-run"),
		...when(otp, "--otp", otp)
	];
	if (cleanPublish) {
		const { ignoreFields, keepScripts, cleanReadme: shouldCleanReadme } = options;
		const parent = resolve(projectDir);
		const temp = await createTempDir(parent);
		await copyDir(parent, temp.path, { ignore: [(name) => {
			return [temp.name, ...IGNORE_FILES$1].map((pattern) => createMatcher(pattern)).some((matcher) => matcher(name));
		}] });
		await cleanPackageJSON$1(temp.path, {
			ignoreFields,
			keepScripts
		});
		if (shouldCleanReadme) {
			const info = await project.getHostedGitInfo();
			if (!Object.values(info).every(isEmpty)) {
				const { host, prefix, owner, repo } = info;
				await cleanReadme$1(temp.path, `${host}/${prefix}${owner}/${repo}#readme`);
			}
		}
		logger?.verbose(`Publishing "${await manifest.getName()}" with command: npm ${args.join(" ")}`);
		await execAsync("npm", args, {
			cwd: temp.path,
			env,
			error: "log"
		});
		await temp.remove();
	} else {
		logger?.verbose(`Publishing "${await manifest.getName()}" with command: npm ${args.join(" ")}`);
		await execAsync("npm", args, {
			cwd: projectDir,
			env,
			error: "log"
		});
	}
};
//#endregion
//#region src/project-npm/project.ts
/** 一个基于 npm 的项目，使用 package.json 进行配置 */
var NpmProject = class extends PackageJsonProject {
	async publish(options = {}) {
		await publish$2(this, { ...options });
	}
	async publishCheck(options = {}) {
		await check$1(this, options);
	}
};
//#endregion
//#region src/project-npm/workspacesProject.ts
const getPackagesGlobPatterns$1 = async (manifest) => {
	const workspaces = (await manifest).workspaces;
	return Array.isArray(workspaces) ? workspaces : workspaces?.packages ?? [];
};
async function* getProjects$1(options) {
	const { manifest, manifest: { projectDir } } = options;
	const packages = await getPackagesGlobPatterns$1(manifest.readManifest());
	for (const pkg of packages) {
		const matched = globSync(normalizePath(join(pkg, PackageJsonManifest.Filename)), {
			cwd: projectDir,
			onlyFiles: true,
			absolute: true,
			ignore: NpmWorkspacesProject.GlobIgnore
		});
		for (const filepath of matched) yield filepath;
	}
}
/** 一个基于 npm workspaces 的 monorepo 项目，使用 package.json 的 workspaces 进行配置 */
var NpmWorkspacesProject = class extends PackageJsonMonorepoProject {
	static GlobIgnore = ["**/node_modules/**"];
	constructor(options) {
		super({
			...options,
			getProjects: getProjects$1
		});
	}
	async publish(options = {}) {
		const onceCall = onceAsync(this.getDefaultPublishTag.bind(this));
		for await (const project of this.getProjects()) if (project.hasBump) {
			const opts = this.isFixedMode ? {} : await (async () => {
				const tagsMap = await onceCall();
				const name = await project.manifest.getName();
				return { tag: tagsMap.get(name) };
			})();
			await publish$2(project, {
				...opts,
				...options
			});
		}
	}
	async publishCheck(options = {}) {
		await check$1(this, options);
	}
};
//#endregion
//#region src/project-pnpm/check.ts
const check = async (project, options = {}) => {
	const { logger } = options;
	logger?.verbose("Checking npm registry...");
	const pinged = await pingRegistry();
	assert(pinged, "Unable to connect to the npm registry");
	logger?.verbose("Checking npm authentication...");
	const username = await getAuthenticatedUser();
	assert(username, "Not authenticated with npm");
	const name = await project.manifest.getName();
	if (await getPublishedVersion(name)) {
		logger?.verbose(`Checking npm write access for "${name}"...`);
		const hasAccess = await hasWriteAccess(name, username);
		assert(hasAccess, `No write access to npm package "${name}"`);
	}
};
//#endregion
//#region src/project-pnpm/cleanup.ts
const PUBLISH_CONFIG_FIELDS = [
	"bin",
	"main",
	"exports",
	"types",
	"typings",
	"module",
	"browser",
	"esnext",
	"es2015",
	"unpkg",
	"umd:main",
	"typesVersions",
	"cpu",
	"os",
	"engines"
];
const IGNORE_FIELDS = [
	"babel",
	"browserslist",
	"c8",
	"commitlint",
	"devDependencies",
	"eslintConfig",
	"eslintIgnore",
	"husky",
	"jest",
	"lint-staged",
	"nano-staged",
	"pre-commit",
	"prettier",
	"pwmetrics",
	"remarkConfig",
	"renovate",
	"resolutions",
	"sharec",
	"simple-git-hooks",
	"simple-pre-commit",
	"size-limit",
	"typeCoverage",
	"yaspeller",
	"pnpm",
	"packageManager"
];
const KEEP_SCRIPT_NAMES = [
	"preinstall",
	"install",
	"postinstall"
];
const IGNORE_FILES = [
	".DS_Store",
	".git",
	".vscode",
	".idea",
	"node_modules"
];
const cleanPackageJSON = async (dir, options) => {
	const file = join(dir, "package.json");
	const json = await readJsonFile(file);
	const { ignoreFields = [], keepScripts = [] } = options ?? {};
	const mergePublishConfig = (json) => {
		if (!json.publishConfig) return json;
		const publishConfig = { ...json.publishConfig };
		PUBLISH_CONFIG_FIELDS.forEach((field) => {
			if (publishConfig[field]) {
				json[field] = publishConfig[field];
				delete publishConfig[field];
			}
		});
		return {
			...json,
			publishConfig
		};
	};
	const removeIgnoredFields = (json) => {
		const fields = [...ignoreFields, ...IGNORE_FIELDS];
		const [matched, unmatched] = partition(fields, (i) => i.includes("."));
		matched.forEach((field) => unset(json, field));
		return omit(json, unmatched);
	};
	const cleanScripts = (json) => {
		if (!json.scripts) return json;
		const keep = [...keepScripts, ...KEEP_SCRIPT_NAMES];
		const excludes = Object.keys(json.scripts).filter((k) => !keep.includes(k));
		json.scripts = omit(json.scripts, excludes);
		return json;
	};
	const removeEmptyObjects = (json) => {
		const excludes = Object.entries(json).filter(([k, v]) => isEmptyObject(v)).map(([k, v]) => k);
		return omit(json, excludes);
	};
	const cleaned = removeEmptyObjects(cleanScripts(removeIgnoredFields(structuredClone(mergePublishConfig(json)))));
	await writeJsonFile(file, cleaned);
};
const cleanReadme = async (dir, homepage) => {
	const file = join(dir, "README.md");
	homepage && await editFile(file, (str) => {
		return str.split(/^##\s+\S.*$/m)[0] + `## Docs

Read full docs **[here](${homepage})**.`;
	});
};
//#endregion
//#region src/project-pnpm/publish.ts
const publish$1 = async (project, options = {}) => {
	const { manifest, manifest: { projectDir } } = project;
	const { access, tag, otp, env = process.env, dryRun, logger, gitChecks, cleanPublish } = options;
	const publishTag = isFunction(tag) ? tag(await manifest.getVersion(), await manifest.getPrereleaseVersion()) : tag;
	const args = [
		"publish",
		...when(access, "--access", access),
		...when(publishTag, "--tag", publishTag),
		...when(dryRun, "--dry-run"),
		...when(otp, "--otp", otp),
		...unless(gitChecks, "--no-git-checks")
	];
	if (cleanPublish) {
		const { ignoreFields, keepScripts, cleanReadme: shouldCleanReadme } = options;
		const parent = resolve(projectDir);
		const temp = await createTempDir(parent);
		await copyDir(parent, temp.path, { ignore: [(name) => {
			return [temp.name, ...IGNORE_FILES].map((pattern) => createMatcher(pattern)).some((matcher) => matcher(name));
		}] });
		await cleanPackageJSON(temp.path, {
			ignoreFields,
			keepScripts
		});
		if (shouldCleanReadme) {
			const info = await project.getHostedGitInfo();
			if (!Object.values(info).every(isEmpty)) {
				const { host, prefix, owner, repo } = info;
				await cleanReadme(temp.path, `${host}/${prefix}${owner}/${repo}#readme`);
			}
		}
		logger?.verbose(`Publishing "${await manifest.getName()}" with command: pnpm ${args.join(" ")}`);
		await execAsync("pnpm", args, {
			cwd: temp.path,
			env,
			error: "log"
		});
		await temp.remove();
	} else {
		logger?.verbose(`Publishing "${await manifest.getName()}" with command: pnpm ${args.join(" ")}`);
		await execAsync("pnpm", args, {
			cwd: projectDir,
			env,
			error: "log"
		});
	}
};
//#endregion
//#region src/project-pnpm/project.ts
/** 一个基于 pnpm 的项目，使用 package.json 进行配置 */
var PnpmProject = class extends PackageJsonProject {
	async publish(options = {}) {
		await publish$1(this, { ...options });
	}
	async publishCheck(options = {}) {
		await check(this, options);
	}
};
//#endregion
//#region src/project-pnpm/workspacesProject.ts
const getPackagesGlobPatterns = async (filepath) => {
	const { packages = [] } = parse$1(readFileSync(filepath, "utf8"));
	return packages;
};
const getProjects = async function* (options) {
	const { manifest: { projectDir } } = options;
	const workspaceFile = join(projectDir, PnpmWorkspacesProject.WorkspaceFile);
	const packages = await getPackagesGlobPatterns(workspaceFile);
	for (const pkg of packages) {
		const matched = globSync(normalizePath(join(pkg, PackageJsonManifest.Filename)), {
			cwd: projectDir,
			onlyFiles: true,
			absolute: true,
			ignore: PnpmWorkspacesProject.GlobIgnore
		});
		for (const filepath of matched) yield filepath;
	}
};
/** 一个基于 pnpm 工作区的单体仓库项目，使用 package.json 和 pnpm-workspace.yaml 进行配置 */
var PnpmWorkspacesProject = class extends PackageJsonMonorepoProject {
	static WorkspaceFile = "pnpm-workspace.yaml";
	static GlobIgnore = ["**/node_modules/**"];
	constructor(options) {
		super({
			...options,
			getProjects
		});
	}
	async publish(options = {}) {
		const onceCall = onceAsync(this.getDefaultPublishTag.bind(this));
		for await (const project of this.getProjects()) if (project.hasBump) {
			const opts = this.isFixedMode ? {} : await (async () => {
				const tagsMap = await onceCall();
				const name = await project.manifest.getName();
				return { tag: tagsMap.get(name) };
			})();
			await publish$1(project, {
				...opts,
				...options
			});
		}
	}
	async publishCheck(options = {}) {
		await check$1(this, options);
	}
};
//#endregion
//#region src/releaser-github-action/comment.ts
const ALLOWED_AUTHOR_ASSOCIATIONS = [
	"OWNER",
	"COLLABORATOR",
	"MEMBER"
];
const JSON_START = "```json";
const JSON_START_OFFSET = 7;
const JSON_END = "```";
/** 所有支持的拉取请求评论命令 */
const COMMANDS = ["!release/set-options", "!release/set-preamble"];
/**
* 判断正文是否以命令开头，并且命令后紧跟空白字符或正文结束。
* 这样可以避免将更长的标记（例如 `!release/set-options-foo`）误判为匹配的命令
*/
const startsWithCommand = (body, command) => {
	if (!body.startsWith(command)) return false;
	const nextChar = body[command.length];
	return nextChar === void 0 || /\s/.test(nextChar);
};
/** 评论内容是否是支持的命令评论之一 */
const isCommandComment = (body) => isString(body) && COMMANDS.some((command) => startsWithCommand(body, command));
/** 解析 releaser 参数 */
const parseSetOptionsComment = (comment) => {
	if (ALLOWED_AUTHOR_ASSOCIATIONS.includes(comment.author_association)) {
		const { body } = comment;
		if (body && startsWithCommand(body, "!release/set-options")) {
			const start = body.indexOf(JSON_START);
			const end = isIndex(start) ? body.indexOf(JSON_END, start + JSON_START_OFFSET) : -1;
			if (!isIndex(start) || !isIndex(end)) return;
			return body.substring(start + JSON_START_OFFSET, end).trim();
		}
	}
};
/** 解析日志前言 */
function parseSetPreambleComment(comment) {
	if (ALLOWED_AUTHOR_ASSOCIATIONS.includes(comment.author_association)) {
		const { body } = comment;
		if (body && startsWithCommand(body, "!release/set-preamble")) {
			const newlineIndex = body.indexOf("\n");
			const firstLine = isIndex(newlineIndex) ? body.slice(0, newlineIndex) : body;
			const secondLine = isIndex(newlineIndex) ? body.slice(newlineIndex + 1).trim() : "";
			const name = firstLine.slice(21).replace(/`/g, "").trim().split(/\s+/)[0];
			const preamble = secondLine;
			if (preamble) return {
				name,
				preamble
			};
		}
	}
	return null;
}
//#endregion
//#region src/releaser-github-action/conditions.ts
const ifReleaseCommit = async (releaser) => {
	const { project, options: { dryRun } } = releaser;
	if (!(await gitLog(["-1", "--pretty=%B"]))?.startsWith("chore(release):")) return false;
	if (!dryRun) await gitFetch(["--tags"]);
	return (await project.getTags()).length > 0;
};
/**
* 检测当前事件是否为针对处于打开状态的发布拉取请求的受支持命令评论：
* （`!release/set-options` 或 `!release/set-preamble`）
*
* @returns 如果是此类评论，则返回 `目标分支`；如果是评论事件但不是命令评论，则返回 `false`；如果根本不是评论事件，则返回 `null`
*/
const ifCommandComment = () => {
	const { eventName, payload: { issue, comment } } = context;
	const isPullRequest = issue?.pull_request;
	const issueAuthor = (issue?.user)?.login;
	const issueBody = issue?.body;
	const issueState = issue?.state;
	const commentBody = comment?.body;
	if (eventName === "issue_comment") {
		if (isPullRequest && issueAuthor === "github-actions[bot]" && issueState === "open" && issueBody?.includes("release-pull-request: true") && isCommandComment(commentBody)) {
			const matches = issueBody.match(/release-branch-to:\s*(\S+)/);
			if (matches) return matches[1];
		}
		return false;
	}
	return null;
};
//#endregion
//#region src/releaser-github-action/options.ts
const omitEmpty = (object) => {
	const result = {};
	for (const [key, value] of Object.entries(object)) if (isBoolean(value) || Boolean(value)) result[key] = value;
	return result;
};
const getOptionalBooleanInput = (name) => getInput(name) ? getBooleanInput(name) : void 0;
const getOptionalJsonInput = (name) => {
	const value = getInput(name);
	return value ? JSON.parse(value) : void 0;
};
const getInputOptions = () => ({
	checkout: omitEmpty({ branch: getInput("checkout-branch") }),
	bump: omitEmpty({
		version: getInput("bump-version"),
		as: getInput("bump-as"),
		prerelease: getInput("bump-prerelease"),
		snapshot: getInput("bump-snapshot"),
		firstRelease: getOptionalBooleanInput("bump-first-release"),
		byProject: getOptionalJsonInput("bump-by-project")
	}),
	maintenanceBranch: omitEmpty({ enabled: getOptionalBooleanInput("maintenance-branch-enabled") }),
	publish: omitEmpty({
		access: getInput("publish-access"),
		tag: getInput("publish-tag")
	})
});
const getInputSkippedSteps = () => ({
	bump: getOptionalBooleanInput("bump-skip"),
	publish: getOptionalBooleanInput("publish-skip")
});
//#endregion
//#region src/releaser-github-action/releaser.ts
var ReleaserGithubAction = class extends Releaser {
	setUser(options = {}) {
		return super.setUser({
			username: "github-actions[bot]",
			email: "github-actions[bot]@users.noreply.github.com",
			...options
		});
	}
	checkout(options = {}) {
		return super.checkout({
			fetch: true,
			force: true,
			...options
		});
	}
	tag(options = {}) {
		return super.tag({
			fetch: true,
			...options
		});
	}
	push(options = {}) {
		return super.push({
			force: true,
			...options
		});
	}
	constructor(options) {
		super({
			hosting: new GithubHosting({ octokit: options.octokit }),
			...options
		});
	}
	fetchOptions() {
		return this.enqueue(async () => {
			const { state: { headBranch }, stepsOptions: { bump: bumpOpts } } = this;
			if (!headBranch) throwError("Head branch is not set. Please call `checkout` before `fetchParams`.");
			const { project, hosting } = this;
			const logger = this.logger.createChild("fetch-options");
			logger.info("Fetching options from pull request comments...");
			const { octokit } = hosting;
			const [owner, repo] = await hosting.getRepositoryId(project);
			const { data: [pr] } = await octokit.rest.pulls.list({
				owner,
				repo,
				head: `${owner}:${headBranch}`,
				state: "open"
			});
			if (!pr) {
				logger.info("No open pull request found.");
				return;
			}
			const { data: comments } = await octokit.rest.issues.listComments({
				owner,
				repo,
				issue_number: pr.number
			});
			let optionsApplied = false;
			let preamble;
			const preambleByName = /* @__PURE__ */ new Map();
			for (let i = comments.length, comment; i >= 0; i--) {
				comment = comments[i];
				if (!optionsApplied) {
					const json = parseSetOptionsComment(comment);
					if (json) {
						try {
							const options = JSON.parse(json);
							logger.verbose("Found set-options comment:");
							logger.verbose(json);
							this.setOptions(options);
							optionsApplied = true;
						} catch {
							logger.verbose("Failed to parse parameters comment:");
							logger.verbose(json);
						}
						continue;
					}
				}
				const setPreamble = parseSetPreambleComment(comment);
				if (setPreamble) {
					const { name, preamble: markdown } = setPreamble;
					if (name) {
						if (!preambleByName.has(name)) preambleByName.set(name, markdown);
					} else if (isUndefined(preamble)) preamble = markdown;
				}
			}
			if (isEmpty(preamble) && isEmpty(preambleByName)) return;
			const bump = { ...bumpOpts };
			if (isNotEmpty(preamble)) {
				logger.verbose("Found global set-preamble comment.");
				bump.preamble = preamble;
			}
			if (isNotEmpty(preambleByName)) for (const [name, markdown] of preambleByName) (bump.byProject ??= {})[name] = {
				...bump.byProject?.[name],
				preamble: markdown
			};
			this.setOptions({ bump });
		});
	}
	fetch() {
		return this.enqueue(async () => {
			const { logger, options: { dryRun } } = this;
			logger.info("fetch", "Fetching all commits and tags from the remote repository...");
			if (!dryRun) {
				const unshallow = await gitRevParse(["--is-shallow-repository"]) === "true" ? ["--unshallow"] : [];
				await gitFetch([
					"--prune",
					"--tags",
					...unshallow,
					"--",
					"origin",
					"HEAD"
				]);
			}
		});
	}
	async runPullRequestAction() {
		await this.setUser().checkout().fetchOptions().bump().commit().push().pullRequest().run();
	}
	async runReleaseAction(check = true) {
		await this.setUser().maintenanceBranch().tag().push().publish().release().run(check ? ifReleaseCommit : void 0);
	}
	async runSnapshotAction(snapshotTag) {
		if (!snapshotTag) throwError("Snapshot tag is required.");
		await this.fetch().bump({
			snapshot: snapshotTag,
			skipChangelog: true
		}).publish({ tag: snapshotTag }).revert().run();
	}
	async runAction() {
		const logger = this.logger.createChild("run");
		logger.info("Detecting action...");
		const commandComment = ifCommandComment();
		let isReleaseCommit = false;
		if (commandComment === false) {
			logger.info("Action triggered by a pull request comment.");
			logger.info("No command comment found in a comment. Stopping action.");
			return;
		}
		if (!isNull(commandComment)) {
			logger.info("Action triggered by a pull request comment.");
			if (await gitBranchCurrent() !== commandComment) this.checkout({
				branch: commandComment,
				fetch: true,
				force: false
			});
		} else isReleaseCommit = await ifReleaseCommit(this);
		if (isReleaseCommit) {
			logger.info("Running release action...");
			await this.runReleaseAction(false);
		} else {
			logger.info("Running pull request action...");
			await this.runPullRequestAction();
		}
	}
};
//#endregion
//#region package.json
var package_default = {
	name: "@peiyanlu/release",
	version: "1.3.1",
	description: "Tool to automate version bumps, changelogs, and releases.",
	license: "MIT",
	type: "module",
	"private": false,
	bin: { "release": "index.js" },
	exports: {
		".": {
			"types": "./dist/index.d.mts",
			"default": "./dist/index.mjs"
		},
		"./package.json": "./package.json"
	},
	scripts: {
		"dev": "tsdown -w",
		"build": "tsdown",
		"prepublishOnly": "tsdown",
		"release": "node index.js",
		"release:dry": "node index.js -C -n",
		"test": "vitest run",
		"test:cov": "vitest run --coverage"
	},
	dependencies: {
		"@actions/core": "^3.0.1",
		"@actions/github": "^9.1.1",
		"@clack/prompts": "^1.7.0",
		"@conventional-changelog/template": "^1.2.1",
		"@octokit/rest": "^22.0.1",
		"@peiyanlu/cli-utils": "^0.0.15",
		"@peiyanlu/node-utils": "^0.0.4",
		"@peiyanlu/ts-utils": "^0.0.12",
		"ansis": "^4.3.1",
		"commander": "^15.0.0",
		"conventional-changelog": "^8.1.0",
		"conventional-changelog-conventionalcommits": "^10.2.1",
		"conventional-recommended-bump": "^12.1.0",
		"open": "^11.0.0",
		"publint": "^0.3.22",
		"semver": "^7.8.5",
		"tinyglobby": "^0.2.17",
		"yaml": "^2.9.0",
		"handlebars": "^4.7.9"
	},
	devDependencies: {
		"@peiyanlu/test-tools": "^0.0.7",
		"@types/node": "^24.13.3",
		"@types/semver": "^7.7.1",
		"@vitest/coverage-v8": "^4.1.10",
		"tsdown": "^0.23.1",
		"typescript": "^6.0.3",
		"vitest": "^4.1.10"
	},
	author: {
		"name": "YanluPei",
		"email": "peiyanlu@vip.qq.com"
	},
	engines: { "node": ">=20" },
	keywords: ["typescript", "cli"],
	files: ["dist", "template"],
	publishConfig: {
		"access": "public",
		"registry": "https://registry.npmjs.org"
	},
	repository: {
		"type": "git",
		"url": "git+https://github.com/peiyanlu/release.git"
	},
	bugs: { "url": "https://github.com/peiyanlu/release/issues" },
	homepage: "https://github.com/peiyanlu/release#readme"
};
//#endregion
//#region src/releaser-cli/prompts.ts
const abortTask = (msg) => {
	cancel(`${red("✕")} ${msg ?? "Release cancelled."}`);
	process.exit(0);
};
const singlePrompt = async (fn, abortMsg) => {
	const value = await fn();
	if (isCancel(value)) abortTask(abortMsg);
	return value;
};
const question = (msg, dryRun) => {
	return `${(dryRun ? yellow : red)("?")} ${msg}`;
};
const getVersionHint = async (project, options = {}) => await project.getNextVersion(options) ?? "No version change";
const createVersionOptions = async (project, options = {}, current, tagPrefix) => {
	const firstRelease = await project.isFirstRelease({ tagPrefix });
	if (firstRelease) return [
		{
			label: "Initial release",
			value: "initial",
			hint: `Release ${current}`,
			bump: {
				version: current,
				firstRelease
			}
		},
		{
			label: "Custom",
			value: "custom",
			hint: "Specify an exact version"
		},
		{
			label: "As-is",
			value: "ignore",
			hint: `Do not update the version ${current}`,
			bump: { version: current }
		}
	];
	const fromPreRelease = isPrerelease(current);
	const candidates = [
		{
			label: fromPreRelease ? "Release" : "Patch",
			value: "patch",
			hint: await getVersionHint(project, {
				...options,
				tagPrefix,
				as: "patch"
			}),
			bump: { as: "patch" }
		},
		{
			label: "Minor",
			value: "minor",
			hint: await getVersionHint(project, {
				...options,
				tagPrefix,
				as: "minor"
			}),
			bump: { as: "minor" }
		},
		{
			label: "Major",
			value: "major",
			hint: await getVersionHint(project, {
				...options,
				tagPrefix,
				as: "major"
			}),
			bump: { as: "major" }
		}
	];
	if (fromPreRelease) candidates.unshift({
		label: "Pre-release",
		value: "prerelease",
		hint: await getVersionHint(project, {
			...options,
			tagPrefix,
			as: "prerelease"
		}),
		bump: { as: "prerelease" }
	});
	else for (const as of [
		"patch",
		"minor",
		"major"
	]) candidates.push({
		label: `Pre-${as[0].toUpperCase()}${as.slice(1)}`,
		value: `pre${as}`,
		hint: await getVersionHint(project, {
			...options,
			tagPrefix,
			as,
			prerelease: "beta"
		}),
		bump: {
			as,
			prerelease: "beta"
		}
	});
	candidates.push({
		label: "Custom",
		value: "custom",
		hint: "Specify an exact version"
	}, {
		label: "As-is",
		value: "ignore",
		hint: `Do not update the version ${current}`,
		bump: { version: current }
	});
	return candidates;
};
const runBumpPrompts = async (project, options = {}) => {
	const { bump: bumpOpts = {}, run = {} } = options;
	const bump = { ...bumpOpts };
	const { dryRun = false, ci = false } = run;
	if (bump.version || bump.as || bump.snapshot) return bump;
	const runVersionPrompts = async (project, tagPrefix) => {
		const promptsRes = {};
		const inferred = await project.inferReleaseType({
			...bump,
			tagPrefix
		});
		const name = await project.manifest.getName();
		const current = await project.manifest.getVersion();
		let useCustom = false;
		let customVersion = current;
		if (project.isMonorepoMode() && project.isFixedMode) {
			const { version: maxVersion, packages } = await project.getMaxVersion();
			if (lt(current, maxVersion)) {
				useCustom = true;
				customVersion = inc(maxVersion, inferred ?? "patch");
				note(`
            Current version: ${current}
            Highest package version: ${maxVersion}
            Packages at this version:\n${packages.map((name) => `- ${name}`).join("\n")}
            
            Minimum release version: ${maxVersion}
            Suggested release version: ${customVersion} (used in CI)
          `.trim(), "Monorepo version mismatch", { format(line) {
					return line.trim();
				} });
			}
		}
		const versionOptions = await createVersionOptions(project, bump, current, tagPrefix);
		const find = (val) => versionOptions.find((option) => option.value === val);
		const fromPreRelease = isPrerelease(current);
		const initialValue = useCustom ? "custom" : inferred && find(inferred) ? inferred : fromPreRelease && find("prerelease") ? "prerelease" : "patch";
		const type = ci ? initialValue : await singlePrompt(() => select({
			message: question(`Select "${cyan`${name}`}" release version type:`, dryRun),
			options: versionOptions,
			initialValue
		}));
		if (equals(type, "custom")) promptsRes.version = ci ? customVersion : await singlePrompt(() => text({
			message: question("Enter release version:", dryRun),
			initialValue: customVersion,
			placeholder: customVersion,
			validate: (val) => {
				if (isUndefined(val) || !isValidVersion(val)) return "Invalid version.";
			}
		}));
		else {
			const selected = find(type);
			Object.assign(promptsRes, selected?.bump);
		}
		return promptsRes;
	};
	if (project.isMonorepoMode() && project.isIndependentMode) for await (const subProject of project.getProjects()) {
		const name = await subProject.manifest.getName();
		const scope = await project.getScope(name);
		const tagPrefix = await project.getTagPrefix(scope);
		const monoBump = bump;
		(monoBump.byProject ??= {})[name] = {
			...monoBump.byProject?.[name],
			...await runVersionPrompts(subProject, tagPrefix)
		};
	}
	else {
		const result = await runVersionPrompts(project);
		Object.assign(bump, result);
	}
	return bump;
};
const getCliPromptOptions = async (options = {}) => {
	const { dryRun = false, ci = false } = options;
	const shouldPrompt = (v) => !ci && (isUndefined(v) || dryRun);
	const res = await group({
		commit: () => options.skipGit ? Promise.resolve(false) : shouldPrompt(options.skipGit) ? confirm({ message: question("Commit release changes?", dryRun) }) : Promise.resolve(true),
		tag: () => options.skipGit ? Promise.resolve(false) : shouldPrompt(options.skipGit) ? confirm({ message: question("Create release tags?", dryRun) }) : Promise.resolve(true),
		push: () => options.skipGit ? Promise.resolve(false) : shouldPrompt(options.skipGit) ? confirm({ message: question("Push release changes?", dryRun) }) : Promise.resolve(true),
		publish: () => options.skipPublish ? Promise.resolve(false) : shouldPrompt(options.skipPublish) ? confirm({ message: question("Publish project?", dryRun) }) : Promise.resolve(true),
		release: () => options.skipRelease || options.skipGit ? Promise.resolve(false) : shouldPrompt(options.skipRelease) ? confirm({ message: question("Create repository release?", dryRun) }) : Promise.resolve(true)
	}, { onCancel: () => {
		abortTask();
	} });
	return {
		commit: !res.commit,
		tag: !res.tag,
		push: !res.push,
		publish: !res.publish,
		release: !res.release
	};
};
const runConfirmPrompts = async (ci = false, dryRun = false) => {
	if (!(ci ? true : await singlePrompt(() => confirm({ message: question(red("Confirm start workflow?"), dryRun) })))) abortTask();
};
//#endregion
//#region src/releaser-cli/releaser.ts
var ReleaserCli = class extends Releaser {
	constructor(options) {
		const { silent, dryRun, verbose } = options;
		super({
			logger: new Logger({
				silent,
				dryRun,
				verbose,
				colors: [
					blue,
					blueBright,
					cyan,
					cyanBright,
					green,
					greenBright,
					magenta,
					magentaBright,
					red,
					redBright
				].sort(() => Math.random() - .5),
				printer: ({ dryRun, stage, message, color }) => {
					const msg = isString(message) ? message : JSON.stringify(message, null, 2);
					log.message(dim`${dryRun ? yellow`[dry-run]` : ""}${color(`[${stage}]`)}: ${msg}`);
				}
			}),
			...options
		});
	}
	tag(options = {}) {
		return super.tag({
			fetch: true,
			...options
		});
	}
	push(options = {}) {
		return super.push({
			force: true,
			...options
		});
	}
	async run(...args) {
		await super.run(...args);
		this.end();
	}
	setCliOptions(options) {
		return this.enqueue(async () => {
			const { ci, dryRun, releaseType: as } = options;
			const { project, stepsOptions: { bump: bumpOpts } } = this;
			const bump = await runBumpPrompts(project, {
				bump: {
					...bumpOpts,
					as
				},
				run: options
			});
			this.setOptions({ bump }).setSkippedSteps(await getCliPromptOptions(options));
			await runConfirmPrompts(ci, dryRun);
		});
	}
	setLegacyOptions() {
		return this.enqueue(async () => {
			const logger = this.logger.createChild("legacy-options");
			const { config, file } = await loadConfig(process.cwd());
			const legacySteps = omit(config, [
				"project",
				"hosting",
				"releaser"
			]);
			if (file) {
				logger.verbose(`Legacy config file: ${file}`);
				logger.verbose("Legacy config for steps:");
				logger.verbose(legacySteps);
			}
			this.setOptions(legacySteps);
		});
	}
	check() {
		return this.enqueue(async () => {
			const { project, hosting } = this;
			const logger = this.logger.createChild("check");
			logger.info("Checking release environment...");
			if (![
				"commit",
				"tag",
				"push"
			].every((k) => this.shouldSkip(k))) {
				logger.verbose("Checking Git repository...");
				const isRepo = await isGitRepo();
				assert(isRepo, "Current directory is not a Git repository");
				logger.verbose("Checking working tree...");
				const isClean = await isWorkingTreeClean();
				assert(isClean, "Git working tree is not clean");
				logger.verbose("Checking remote repository...");
				const hasRemote = await gitConfigGet("remote.origin.url");
				assert(hasRemote, "Git remote \"origin\" is not configured");
			}
			if (!this.shouldSkip("publish")) await project.publishCheck({ logger });
			if (!this.shouldSkip("release")) await hosting?.releaseCheck({ logger });
		});
	}
	start() {
		return this.enqueue(async () => {
			const { name, version } = package_default;
			console.log(`${blue`i`} ${name} v${version}\n`);
			intro("🚀 Starting release");
		});
	}
	end() {
		const { options: { dryRun = false } } = this;
		outro(`🎉 ${dryRun ? "Dry run complete" : "Release complete"}`);
		process.exit(0);
	}
	async runAction(options) {
		await this.start().setLegacyOptions().setCliOptions(options).check().bump().commit().tag().push().publish().release().run();
	}
};
//#endregion
export { Changelog, ChildLogger, ComposedProjectManifest, DEFAULT_CHANGELOG_FILE, DEFAULT_PRE_PUBLISH_TAG, DEFAULT_PUBLISH_TAG, DEFAULT_TAG_PREFIX, GitRepositoryHosting, GithubHosting, Logger, MonorepoProject, NodeGithubActionProject, NpmProject, NpmWorkspacesProject, Octokit, PackageJsonManifest, PackageJsonMonorepoProject, PackageJsonProject, PnpmProject, PnpmWorkspacesProject, Project, ProjectManifest, Releaser, ReleaserCli, ReleaserGithubAction, defaultTypes, defineConfig, extractLastRelease, findFile, getInputOptions, getInputSkippedSteps, headerPartial, ifCommandComment, ifReleaseCommit, loadConfig, loadJavaScriptFile, preamblePartial, publish, template };
