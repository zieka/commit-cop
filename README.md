# Commit Cop

[![Build Status](https://travis-ci.com/zieka/commit-cop.svg?branch=master)](https://travis-ci.com/zieka/commit-cop)

> GitHub status check that ensures your pull requests follow the Conventional Commits spec

Enforces [conventional commit messages](https://conventionalcommits.org)

## How it works

Commit Cop looks for a conventional commit message in:

1. the PR title
2. some PR commit

Commit Cop will ignore characters up till the commit type:

    - ✅ - "TICKET#12412312 feat(scope): my new feature"
    - ✅ - "some stuff we prepend feat: my new feature"

## Installation

👉 [github.com/apps/commit-cop](https://github.com/apps/commit-cop)

## License

[Apache 2.0](LICENSE)
