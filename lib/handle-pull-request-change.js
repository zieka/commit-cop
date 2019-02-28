module.exports = handlePullRequestChange;

const isSemanticMessage = require('./is-semantic-message');
const getConfig = require('probot-config');

const DEFAULT_OPTS = {
	requireTitle: true,
	requireCommits: 'some',
	requirePrBreakingChangeColon: true,
	requireCommitBreakingChangeColon: true,
	requireJira: false
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
	let reason;
	const hasSemanticCommits = commits[requireCommits === 'all' ? 'every' : 'some']((commit) => {
		const parsedSemantic = isSemanticMessage(commit.message);
		if (parsedSemantic.status) {
			return true;
		}
		reason = parsedSemantic.reason;
		return false;
	});

	const breakingCommitsHaveColons = commits.every((commit) => {
		// if it has a breaking change check to see if there is a colon after
		return commit.message.indexOf('BREAKING CHANGE') > -1 ? commit.message.indexOf('BREAKING CHANGE:') > -1 : false;
	});

	return { hasSemanticCommits: { status: hasSemanticCommits, reason }, breakingCommitsHaveColons };
}

async function handlePullRequestChange(context) {
	let config;
	try {
		config = await getConfig(context, 'commit-cop.yml', DEFAULT_OPTS);
	} catch (err) {
		config = DEFAULT_OPTS;
	}
	let { requireTitle, requireCommits, requirePrBreakingChangeColon, requireCommitBreakingChangeColon, requireJira } = config;

	// validate options are of correct type or set to default
	if (typeof requireTitle !== 'boolean') {
		requireTitle = DEFAULT_OPTS.requireTitle;
	}
	if (typeof requireCommits !== 'string') {
		requireCommits = DEFAULT_OPTS.requireCommits;
	}
	if (typeof requirePrBreakingChangeColon !== 'boolean') {
		requirePrBreakingChangeColon = DEFAULT_OPTS.requirePrBreakingChangeColon;
	}
	if (typeof requireCommitBreakingChangeColon !== 'boolean') {
		requireCommitBreakingChangeColon = DEFAULT_OPTS.requireCommitBreakingChangeColon;
	}
	if (typeof requireCommitBreakingChangeColon !== 'boolean') {
		requireCommitBreakingChangeColon = DEFAULT_OPTS.requireCommitBreakingChangeColon;
	}
	if (typeof requireJira !== 'boolean') {
		requireJira = DEFAULT_OPTS.requireJira;
	}

	const { title, head, body = '' } = context.payload.pull_request;
	const hasSemanticTitle = isSemanticMessage(title);
	const { hasSemanticCommits, breakingCommitsHaveColons } = await commitsAreSemantic(context, requireCommits);

	const breakingPrHasColon = body.indexOf('BREAKING CHANGE') > -1 ? body.indexOf('BREAKING CHANGE:') > -1 : true;

	const isSemantic =
		(hasSemanticTitle.status || !requireTitle) &&
		(hasSemanticCommits.status || requireCommits === 'none') &&
		(breakingPrHasColon || !requirePrBreakingChangeColon) &&
		(!breakingCommitsHaveColons || !requireCommitBreakingChangeColon);

	const state = isSemantic ? 'success' : 'failure';

	function getDescription() {
		if (requirePrBreakingChangeColon && !breakingPrHasColon) {
			return '⛔️ Missing colon (:) after BREAKING CHANGE in pull request';
		}
		if (requireCommitBreakingChangeColon && !breakingCommitsHaveColons) {
			return '⛔️ Missing colon (:) after BREAKING CHANGE in some commit';
		}
		if (requireTitle && !hasSemanticTitle.status) {
			return `⛔️ Pull request title ${hasSemanticTitle.reason}`;
		}
		if (requireCommits !== 'none' && !hasSemanticCommits.status) {
			return `⛔️ ${requireCommits === 'all' ? 'All commits' : 'Some commit'} ${hasSemanticCommits.reason}`;
		}
		return `${requireTitle ? '✅ PR Title' : ''} ${
			requireCommits !== 'none' ? `${requireCommits === 'all' ? '✅ All commits' : '✅ Some commit'}` : ''
		}`;
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
