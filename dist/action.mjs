import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { assert, dedent, isBoolean, isEmpty, isIndex, isNotEmpty, isNull, isString, isUndefined, newline, sleep, throwError, tryCall } from "@peiyanlu/ts-utils";
import { existsSync, readFileSync } from "node:fs";
import { parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getGithubUrl, gitAdd, gitBranch, gitBranchCurrent, gitCheckoutBranch, gitCheckoutBranchForce, gitCommitMessage, gitConfigGet, gitConfigSet, gitFetch, gitLog, gitLsRemote, gitPush, gitPushBranch, gitRevParse, gitTag, parseGitHubRepo } from "@peiyanlu/cli-utils";
import "semver";
import { Octokit } from "@octokit/rest";
import open from "open";
import { glob } from "tinyglobby";
import "@peiyanlu/node-utils";
import "conventional-changelog";
import "conventional-changelog-conventionalcommits";
import "conventional-recommended-bump";
import "@conventional-changelog/template";
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
	return isUndefined(nextChar) || /\s/.test(nextChar);
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
	const logger = releaser.logger.createChild("if-release-commit");
	if (!(await gitLog(["-1", "--pretty=%B"]))?.startsWith("chore(release):")) {
		logger.verbose("Skipping non-release commit.");
		return false;
	}
	logger.verbose("Checking existing release tags...");
	if (!dryRun) await gitFetch(["--tags"]);
	const tags = await project.getTags();
	const canRelease = tags.length > 0;
	if (canRelease) {
		logger.verbose(`Found release tags:`);
		for (const tag of tags) logger.verbose(`- ${tag}`);
	} else logger.verbose(`No release tags found.`);
	return canRelease;
};
/**
* 检测当前事件是否为针对处于打开状态的发布拉取请求的受支持命令评论：
* （`!release/set-options` 或 `!release/set-preamble`）
*
* @returns 如果是此类评论，则返回 `目标分支`；如果是评论事件但不是命令评论，则返回 `false`；如果根本不是评论事件，则返回 `null`
*/
const ifCommandComment = () => {
	const { eventName, payload: { issue, comment } } = context;
	if (eventName !== "issue_comment") return null;
	const isPullRequest = issue?.pull_request;
	const issueAuthor = (issue?.user)?.login;
	const issueBody = issue?.body;
	const issueState = issue?.state;
	const commentBody = comment?.body;
	if (isPullRequest && issueAuthor === "github-actions[bot]" && issueState === "open" && issueBody?.includes("release-pull-request: true") && isCommandComment(commentBody)) {
		const matches = issueBody.match(/release-branch-to:\s*(\S+)/);
		return matches ? matches[1] : false;
	}
	return false;
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
//#region src/core/hosting/hosting.ts
/** Git 仓库托管服务的基类 */
var GitRepositoryHosting = class {};
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
						const { data } = await octokit.rest.repos.updateRelease({
							...opts,
							release_id: release.id
						});
						return data;
					} else {
						const { data } = await octokit.rest.repos.createRelease({
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
			return octokit.rest.repos.uploadReleaseAsset({
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
		return {
			title: (await project.getCommitMessage()).split("\n")[0],
			body: [project.versionUpdates.map(({ name, notes }) => `# ${name}${newline(2)}${notes.trim()}`).join(newline(2)), dedent(`
        <!--
          Release pull request metadata.
          release-pull-request: true
          release-branch-from: ${from}
          release-branch-to: ${to}
        -->
      `)].join(newline(2))
		};
	}
};
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
//#region src/action.ts
console.log(`Triggered by event: ${context.eventName}`);
const workflow = getInput("workflow");
if (workflow === "check" && ifCommandComment() === false) {
	setOutput("continue", "false");
	setOutput("workflow", "none");
	process.exit(0);
}
const GITHUB_TOKEN = getInput("github-token");
const NODE_AUTH_TOKEN = getInput("npm-token");
const inputOptions = getInputOptions();
const skippedSteps = getInputSkippedSteps();
if (NODE_AUTH_TOKEN) process.env.NODE_AUTH_TOKEN = NODE_AUTH_TOKEN;
try {
	const { config: { project, hosting, releaser, ...options }, file } = await loadConfig(process.cwd());
	console.log(`Legacy config file: ${file}`);
	if (!project) throwError("Project is required.");
	const gha = new ReleaserGithubAction({
		project,
		octokit: getOctokit(GITHUB_TOKEN),
		...releaser
	}).setOptions({
		...options,
		checkout: {
			...options.checkout,
			...inputOptions.checkout
		},
		bump: {
			...options.bump,
			...inputOptions.bump
		},
		maintenanceBranch: {
			...options.maintenanceBranch,
			...inputOptions.maintenanceBranch
		},
		publish: {
			...options.publish,
			...inputOptions.publish
		}
	}).setSkippedSteps(skippedSteps);
	switch (workflow) {
		case "check":
			const workflow = await ifReleaseCommit(gha) ? "release" : "pull-request";
			setOutput("continue", "true");
			setOutput("workflow", workflow);
			break;
		case "full":
			await gha.runAction();
			break;
		case "pull-request":
			await gha.runPullRequestAction();
			break;
		case "release":
			await gha.runReleaseAction();
			break;
		case "snapshot": await gha.runSnapshotAction(inputOptions.bump?.snapshot);
	}
} catch (error) {
	if (error instanceof Error) setFailed(error.message);
	else setFailed("An unknown error occurred");
	throw error;
}
//#endregion
export {};
