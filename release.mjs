import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
//#region src/release.ts
async function run() {
	try {
		const github = getOctokit(process.env.GITHUB_TOKEN);
		const { owner, repo } = context.repo;
		const tag = getInput("tag_name", { required: true }).replace("refs/tags/", "");
		const releaseName = getInput("release_name", { required: false }) || tag;
		const body = getInput("body", { required: false }) || "";
		const draft = getInput("draft", { required: false }) === "true";
		const prerelease = /\d-[a-z]/.test(tag);
		await github.rest.repos.createRelease({
			owner,
			repo,
			tag_name: tag,
			name: releaseName,
			body,
			draft,
			prerelease
		});
	} catch (error) {
		setFailed(error.message);
	}
}
await run();
//#endregion
export {};
