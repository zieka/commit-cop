#!/bin/sh

eval "$(ssh-agent -s)" #start the ssh agent
touch ./deploy_key.pem
echo $GITHUB_SSH | base64 -d > ./deploy_key.pem
chmod 600 ./deploy_key.pem # this key should have push access
ssh-add ./deploy_key.pem
git remote add deploy git@github.com:zieka/commit-cop.git
npm run ci:deploy
git push --follow-tags deploy HEAD:master