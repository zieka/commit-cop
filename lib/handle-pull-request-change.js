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

	return commits.data.map((element) => element.commit).some((commit) => isSemanticMessage(commit.message));
}

async function handlePullRequestChange(context) {
	const { experimental } = await getConfig(context, 'commit-cop.yml', DEFAULT_OPTS);

	const { title, head } = context.payload.pull_request;
	const hasSemanticTitle = isSemanticMessage(title);
	const hasSemanticCommits = await commitsAreSemantic(context);
	const isSemantic = hasSemanticTitle && hasSemanticCommits;
	const state = isSemantic ? 'success' : 'failure';

	function getDescription() {
		return `${experimental ? '(EXPERIMENTAL)' : ''} ${hasSemanticTitle ? '✅' : '⛔️'} conventional title  ${
			hasSemanticCommits ? '✅ ' : '⛔️'
		} conventional commit`;
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
