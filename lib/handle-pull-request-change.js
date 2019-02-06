module.exports = handlePullRequestChange;

const isSemanticMessage = require('./is-semantic-message');
const getConfig = require('probot-config');

const DEFAULT_OPTS = {
	requireTitle: true,
	requireCommits: 'some',
	requirePrBreakingChangeColon: true,
	requireCommitBreakingChangeColon: true
};

async function commitsAreSemantic(context, requireCommits) {
	// get commits
	const elements = await context.github.pullRequests.getCommits(
		context.repo({
			number: context.payload.pull_request.number
		})
	);

	// parse commit data
	const commits = elements.data.map((element) => element.commit);

	// determine if commits are semantic
	let hasSemanticCommits;
	if (requireCommits === 'all') {
		hasSemanticCommits = !commits.some((commit) => {
			return !isSemanticMessage(commit.message);
		});
	} else {
		hasSemanticCommits = commits.some((commit) => {
			return isSemanticMessage(commit.message);
		});
	}

	const hasBreakingCommit = commits.some((commit) => {
		return commit.message.indexOf('BREAKING CHANGE') > -1;
	});
	const breakingCommitMissingColon = commits.some((commit) => {
		return commit.message.indexOf('BREAKING CHANGE') > -1 ? commit.message.indexOf('BREAKING CHANGE:') === -1 : false;
	});

	return { hasSemanticCommits, breakingCommitMissingColon, hasBreakingCommit };
}

async function handlePullRequestChange(context) {
	let config;
	try {
		config = await getConfig(context, 'commit-cop.yml', DEFAULT_OPTS);
	} catch (err) {
		config = DEFAULT_OPTS;
	}
	let { requireTitle, requireCommits, requirePrBreakingChangeColon, requireCommitBreakingChangeColon } = config;

	// validate options are of correct type or set to default
	if (typeof requireTitle !== 'boolean') {
		requireTitle = DEFAULT_OPTS.requireTitle;
	}
	// if (typeof requireCommits !== 'string') {
	// 	requireCommits = DEFAULT_OPTS.requireCommits;
	// }
	if (typeof requirePrBreakingChangeColon !== 'boolean') {
		requirePrBreakingChangeColon = DEFAULT_OPTS.requirePrBreakingChangeColon;
	}
	if (typeof requireCommitBreakingChangeColon !== 'boolean') {
		requireCommitBreakingChangeColon = DEFAULT_OPTS.requireCommitBreakingChangeColon;
	}

	const { title, head, body = '' } = context.payload.pull_request;
	const hasSemanticTitle = isSemanticMessage(title);
	const { hasSemanticCommits, breakingCommitMissingColon, hasBreakingCommit } = await commitsAreSemantic(context, requireCommits);
	const prBodyHasBreaking = body.indexOf('BREAKING CHANGE') > -1;
	const bodyBreakingHasColon = prBodyHasBreaking ? body.indexOf('BREAKING CHANGE:') > -1 : true;

	const isSemantic =
		(hasSemanticTitle || !requireTitle) &&
		(hasSemanticCommits || requireCommits === 'none') &&
		(bodyBreakingHasColon || !requirePrBreakingChangeColon) &&
		(!breakingCommitMissingColon || !requireCommitBreakingChangeColon);

	const state = isSemantic ? 'success' : 'failure';

	function getDescription() {
		const titlePart = requireTitle ? `${hasSemanticTitle ? '✅' : '⛔️'} title — ` : '';
		const commitsPart =
			requireCommits !== 'none' ? `${hasSemanticCommits ? '✅' : '⛔️'} ${requireCommits === 'all' ? 'all' : 'some'} commits — ` : '';
		const brPrPart = requirePrBreakingChangeColon && prBodyHasBreaking ? `${bodyBreakingHasColon ? '✅' : '⛔️'} PR — ` : '';
		const brCommitPart =
			requireCommitBreakingChangeColon && hasBreakingCommit ? `${!breakingCommitMissingColon ? '✅' : '⛔️'} Commit` : '';

		return `${titlePart}${commitsPart}${prBodyHasBreaking || hasBreakingCommit ? `BC colon ${brPrPart}${brCommitPart}` : ''}`;
	}

	const status = {
		sha: head.sha,
		state,
		target_url: 'https://github.com/zieka/commit-cop',
		description: getDescription(),
		context: 'Commit Cop'
	};
	const result = await context.github.repos.createStatus(context.repo(status));
	return result;
}
