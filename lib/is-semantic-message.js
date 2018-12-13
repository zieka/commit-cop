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
		const breakingHasSemi = message.indexOf('BREAKING CHANGE') > -1 ? message.indexOf('BREAKING CHANGE:') > -1 : true;
		return commitTypes.includes(type) && breakingHasSemi;
	} catch (e) {
		return false;
	}
};
