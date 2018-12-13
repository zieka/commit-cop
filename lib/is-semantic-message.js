const commitTypes = Object.keys(require('conventional-commit-types').types);
const parseCommitMessage = require('parse-commit-message').parse;

console.log(commitTypes);

module.exports = function isSemanticMessage(message) {
	// This targets anything that precedes the type so we can later remove it
	//		^.*\s - look for anything from the begining of the line
	//		(?=) -  as long as it is followed by
	//		([a-z]*(\(|\:))) - any lower case word followed by a ( or :
	const stringBeforeType = new RegExp(/^.*\s(?=([a-z]*(\(|\:)))/g);
	try {
		const { type } = parseCommitMessage(message.replace(stringBeforeType, ''));
		return commitTypes.includes(type);
	} catch (e) {
		return false;
	}
};
