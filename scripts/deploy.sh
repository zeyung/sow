#!/bin/sh
# Build the site and publish dist/ to the gh-pages branch (served at https://<user>.github.io/<repo>/).
set -e
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
REPO=$(basename -s .git "$REMOTE")
PAGES_BASE="/$REPO/" npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(git -C .. rev-parse --short HEAD)"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Deployed to gh-pages"
