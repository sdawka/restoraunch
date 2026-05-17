#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Restoraunch Deploy ===${NC}"

# Parse flags
SKIP_TESTS=false
PRODUCTION=false
for arg in "$@"; do
  case $arg in
    --skip-tests) SKIP_TESTS=true ;;
    --production) PRODUCTION=true ;;
  esac
done

# Pre-flight: check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
  git status --short
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# Pre-flight: check branch
BRANCH=$(git branch --show-current)
if [[ "$PRODUCTION" == true && "$BRANCH" != "main" ]]; then
  echo -e "${YELLOW}Warning: Deploying to production from branch '$BRANCH' (not main)${NC}"
  read -p "Continue? (y/N) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# Run tests
if [[ "$SKIP_TESTS" == false ]]; then
  echo -e "\n${GREEN}Running tests...${NC}"
  npm run test
  npm run test:components
  echo -e "${GREEN}Tests passed!${NC}"
else
  echo -e "${YELLOW}Skipping tests (--skip-tests)${NC}"
fi

# Build
echo -e "\n${GREEN}Building...${NC}"
npm run build

# Deploy
echo -e "\n${GREEN}Deploying to Cloudflare Workers...${NC}"
npx wrangler deploy

echo -e "\n${GREEN}=== Deploy complete! ===${NC}"
