module.exports = handlePullRequestChange;

const isSemanticMessage = require('./is-semantic-message');
const getConfig = require('probot-config');

const DEFAULT_OPTS = {
	experimental: false
};

async function commitsAreSemantic(context) {
	const commits = await context.github.pullRequests.getCommits(
		context.repo({
			number: context.payload.pull_request.number
		})
	);
	const hasSemanticCommits = commits.data.map((element) => element.commit).some((commit) => isSemanticMessage(commit.message));
	const breakingCommitMissingColon = commits.data.map((element) => element.commit).some((commit) => {
		return commit.message.indexOf('BREAKING CHANGE') > -1 ? commit.message.indexOf('BREAKING CHANGE:') === -1 : false;
	});
	return { hasSemanticCommits, breakingCommitMissingColon };
}

async function handlePullRequestChange(context) {
	const { experimental } = await getConfig(context, 'commit-cop.yml', DEFAULT_OPTS);

	const { title, head, body = '' } = context.payload.pull_request;
	const hasSemanticTitle = isSemanticMessage(title);
	const { hasSemanticCommits, breakingCommitMissingColon } = await commitsAreSemantic(context);
	const bodyBreakingHasColon = body.indexOf('BREAKING CHANGE') > -1 ? body.indexOf('BREAKING CHANGE:') > -1 : true;
	const isSemantic = hasSemanticTitle && hasSemanticCommits && bodyBreakingHasColon;
	const state = isSemantic ? 'success' : 'failure';

	function getDescription() {
		return `${experimental ? '(EXPERIMENTAL)' : ''} ${hasSemanticTitle ? '✅' : '⛔️'} title  ${
			hasSemanticCommits ? '✅' : '⛔️'
		} some commit ${breakingCommitMissingColon ? '⚠️ a breaking commit is missing a colon' : ''}`;
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
