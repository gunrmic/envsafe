import pc from 'picocolors';

const SNIPPETS: Record<string, { name: string; snippet: string }> = {
  github: {
    name: 'GitHub Actions',
    snippet: `# Add ENVSAFE_KEY to your repository secrets:
#   Settings > Secrets and variables > Actions > New repository secret
#   Name: ENVSAFE_KEY
#   Value: (run \`envsafe get-key\` locally to get the key)

# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - run: npx envsafe run -- npm start
        env:
          ENVSAFE_KEY: \${{ secrets.ENVSAFE_KEY }}`,
  },
  gitlab: {
    name: 'GitLab CI',
    snippet: `# Add ENVSAFE_KEY to your CI/CD variables:
#   Settings > CI/CD > Variables > Add variable
#   Key: ENVSAFE_KEY
#   Value: (run \`envsafe get-key\` locally to get the key)
#   Flags: Masked, Protected

# .gitlab-ci.yml
deploy:
  stage: deploy
  image: node:20
  variables:
    ENVSAFE_KEY: \$ENVSAFE_KEY
  script:
    - npm ci
    - npx envsafe run -- npm start`,
  },
  circleci: {
    name: 'CircleCI',
    snippet: `# Add ENVSAFE_KEY to your project environment variables:
#   Project Settings > Environment Variables > Add Variable
#   Name: ENVSAFE_KEY
#   Value: (run \`envsafe get-key\` locally to get the key)

# .circleci/config.yml
version: 2.1
jobs:
  deploy:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm ci
      - run: npx envsafe run -- npm start`,
  },
};

export function ci(options: { platform?: string }): void {
  const platform = options.platform;

  if (!platform) {
    console.log(pc.bold('Available platforms:'));
    console.log('');
    for (const [key, { name }] of Object.entries(SNIPPETS)) {
      console.log(`  ${pc.bold(key.padEnd(12))} ${name}`);
    }
    console.log('');
    console.log(pc.dim('Usage: envsafe ci --platform <name>'));
    return;
  }

  const entry = SNIPPETS[platform.toLowerCase()];

  if (!entry) {
    console.error(pc.red(`Unknown platform: ${platform}`));
    console.error(pc.dim(`Supported: ${Object.keys(SNIPPETS).join(', ')}`));
    process.exit(1);
  }

  console.log(pc.bold(`${entry.name} integration:\n`));
  console.log(entry.snippet);
  console.log('');
  console.log(pc.dim('The ENVSAFE_KEY env var lets envsafe decrypt the vault without OS keychain access.'));
  console.log(pc.dim('Your secrets stay encrypted in .envsafe.vault — only the key lives in CI.'));
}
