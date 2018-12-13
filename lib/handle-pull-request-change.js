module.exports = handlePullRequestChange;

const isSemanticMessage = require('./is-semantic-message');
const getConfig = require('probot-config');

const DEFAULT_OPTS = {
	requireTitle: true,
	requireCommits: [true, 'some'],
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
	if (Array.isArray(requireCommits) && requireCommits[1] === 'all') {
		hasSemanticCommits = !commits.some((commit) => {
			return !isSemanticMessage(commit.message);
		});
	} else {
		hasSemanticCommits = commits.some((commit) => {
			return isSemanticMessage(commit.message);
		});
	}

	const breakingCommitMissingColon = commits.some((commit) => {
		return commit.message.indexOf('BREAKING CHANGE') > -1 ? commit.message.indexOf('BREAKING CHANGE:') === -1 : false;
	});

	return { hasSemanticCommits, breakingCommitMissingColon };
}

async function handlePullRequestChange(context) {
	let { requireTitle, requireCommits, requirePrBreakingChangeColon, requireCommitBreakingChangeColon } = await getConfig(
		context,
		'commit-cop.yml',
		DEFAULT_OPTS
	);

	// validate options are of correct type or set to default
	if (typeof requireTitle !== 'boolean') {
		requireTitle = DEFAULT_OPTS.requireTitle;
	}
	if (!Array.isArray(requireCommits) && typeof requireCommits[0] !== 'boolean' && typeof requireCommits[0] !== 'string') {
		requireCommits = DEFAULT_OPTS.requireCommits;
	}
	if (typeof requirePrBreakingChangeColon !== 'boolean') {
		requirePrBreakingChangeColon = DEFAULT_OPTS.requirePrBreakingChangeColon;
	}
	if (typeof requireCommitBreakingChangeColon !== 'boolean') {
		requireCommitBreakingChangeColon = DEFAULT_OPTS.requireCommitBreakingChangeColon;
	}

	const { title, head, body = '' } = context.payload.pull_request;
	const hasSemanticTitle = isSemanticMessage(title);
	const { hasSemanticCommits, breakingCommitMissingColon } = await commitsAreSemantic(context, requireCommits);
	const bodyBreakingHasColon = body.indexOf('BREAKING CHANGE') > -1 ? body.indexOf('BREAKING CHANGE:') > -1 : true;

	const isSemantic =
		(hasSemanticTitle || !requireTitle) &&
		(hasSemanticCommits || !requireCommits[0]) &&
		(bodyBreakingHasColon || !requirePrBreakingChangeColon) &&
		(!breakingCommitMissingColon || !requireCommitBreakingChangeColon);

	const state = isSemantic ? 'success' : 'failure';

	function getDescription() {
		if (requirePrBreakingChangeColon && !bodyBreakingHasColon) {
			return '⛔️BREAKING CHANGE in PR body needs colon';
		}
		if (requireCommitBreakingChangeColon && breakingCommitMissingColon) {
			return '⛔️BREAKING CHANGE in commit missing colon';
		}

		const titlePart = requireTitle ? `${hasSemanticTitle ? '✅' : '⛔️'} title` : '';
		const commitsPart = requireCommits[0] ? `${hasSemanticCommits ? '✅' : '⛔️'} ${requireCommits[1]} commits` : '';

		return `${titlePart} — ${commitsPart}`;
	}

	const status = {
		sha: head.sha,
		state,
		target_url: 'https://github.com/zieka/commit-cop',
		description: !bodyBreakingHasColon ? 'BREAKING CHANGE in PR body needs colon' : getDescription(),
		context: 'Commit Cop'
	};
	const result = await context.github.repos.createStatus(context.repo(status));
	return result;
}
