import path, { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { newline } from "@conventional-changelog/template";
import { gitAdd, gitAddSync, gitBranch, gitBranchCurrent, gitCheckoutBranch, gitCheckoutBranchForce, gitCommitMessage, gitConfigGet, gitConfigSet, gitFetch, gitLsRemote, gitPush, gitPushBranch, gitRevParse, gitTag, isGitRepo, isPrerelease, isValidVersion, isWorkingTreeClean } from "@peiyanlu/cli-utils";
import { readJsonFileSync } from "@peiyanlu/node-utils";
import { assert, equals, isString, isUndefined, omit, throwError } from "@peiyanlu/ts-utils";
import { program } from "commander";
import Handlebars from "handlebars";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { cancel, confirm, group, intro, isCancel, log, note, outro, select, text } from "@clack/prompts";
import { blue, blueBright, cyan, cyanBright, dim, green, greenBright, magenta, magentaBright, red, redBright, yellow } from "ansis";
import { inc, lt } from "semver";
import "conventional-changelog";
import "conventional-changelog-conventionalcommits";
import "conventional-recommended-bump";
//#region node_modules/.pnpm/tsdown@0.23.1_publint@0.3.22_typescript@6.0.3/node_modules/tsdown/esm-shims.js
const getFilename = () => fileURLToPath(import.meta.url);
const getDirname = () => path.dirname(getFilename());
const __dirname = /* @__PURE__ */ getDirname();
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
//#region src/config/index.ts
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
//#region src/core/utils.ts
const when = (condition, ...value) => condition ? [...value] : [];
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
//#region src/cli.ts
program.name("release").description(package_default.description).version(package_default.version, "-v, --version", "Print the tool version and exit.").usage("[release-type] [options]").argument("[release-type]", `Release type. One of 'major', 'minor', 'patch', or 'prerelease'.`).enablePositionalOptions().option("-n, --dry-run", "Run in dry mode.").option("--ci", "Enable CI mode.").option("--skip-git", "Skip all Git-related checks and operations.").option("--skip-publish", "Skip the package publishing step.").option("--skip-release", "Skip the repository release step.").helpOption("-h, --help", "Display help information.").action(async (releaseType, options) => {
	const { config: { project, hosting, releaser } } = await loadConfig(process.cwd());
	const { dryRun } = options;
	if (!project) throwError("Project not found");
	if (!hosting) throwError("GitRepositoryHosting not found");
	await new ReleaserCli({
		...releaser,
		project,
		hosting,
		dryRun
	}).runAction({
		releaseType,
		...options
	});
});
program.command("init").description("Create a release configuration file").option("--npm", "Use npm as the package manager", false).option("--pnpm", "Use pnpm as the package manager", false).option("--monorepo", "Configure a monorepo", false).option("--fixed", "Use fixed versioning for the monorepo", false).option("--github-workflow", "Create a GitHub Actions release workflow", false).option("--force", "Overwrite existing configuration or workflow files", false).option("--add", "Stage generated files with Git", false).action(async (options) => {
	const { npm, pnpm, monorepo, fixed, githubWorkflow, force, add } = options;
	const cwd = process.cwd();
	const tplDir = resolve(__dirname, "..", "template");
	const { dependencies, devDependencies } = readJsonFileSync(join(cwd, "package.json"));
	const isTS = existsSync(join(cwd, "tsconfig.json")) || Object.keys({
		...dependencies,
		...devDependencies
	}).includes("typescript");
	const configFile = join(cwd, `release.config.${isTS ? "ts" : "js"}`);
	const workflowFile = join(cwd, ".github/workflows", "release.yml");
	if (existsSync(configFile) && !force) throwError(`"${configFile}" already exists`);
	if (githubWorkflow && existsSync(workflowFile) && !force) throwError(`"${workflowFile}" already exists`);
	const template = readFileSync(join(tplDir, `release.config.hbs`), "utf-8");
	const configContent = Handlebars.compile(template)({
		monorepo,
		fixed,
		npm,
		pnpm,
		npmOrPnpm: npm || pnpm
	});
	writeFileSync(configFile, configContent.trimEnd() + newline(), "utf-8");
	if (githubWorkflow) {
		const workflowContent = readFileSync(join(tplDir, `release.text`), "utf-8");
		await mkdir(".github/workflows", { recursive: true });
		writeFileSync(workflowFile, workflowContent.trimEnd() + newline(), "utf-8");
	}
	if (add) gitAddSync(githubWorkflow ? [configFile, workflowFile] : [configFile]);
});
program.parse(process.argv);
//#endregion
export {};
