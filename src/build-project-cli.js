#!/usr/bin/env node

import main from './build-project-main';

const d = require('debug')('surf:surf-build');

const yargs = require('yargs')
  .usage(`Usage: surf-build -r http://github.com/some/repo -s SHA1
Clones a repo from GitHub and builds the given SHA1`)
  .alias('r', 'repo')
  .describe('repo', 'The repository to clone')
  .alias('s', 'sha')
  .describe('sha', 'The sha to build')
  .alias('n', 'name')
  .describe('name', 'The name to give this build on GitHub')
  .alias('d', 'discoverer')
  .describe('discoverer', 'The single build discoverer to use')
  .alias('v', 'version')
  .describe('version', 'Print the current version number and exit')
  .alias('h', 'help')
  .epilog(`
Some useful environment variables:

GITHUB_ENTERPRISE_URL - the GitHub Enterprise URL to (optionally) post status to.
GITHUB_TOKEN - the GitHub (.com or Enterprise) API token to use. Must be provided.
GIST_ENTERPRISE_URL - the GitHub Enterprise URL to (optionally) post Gists to.
GIST_TOKEN - the GitHub (.com or Enterprise) API token to use to create the build output Gist.

SURF_SHA1 - an alternate way to specify the --sha parameter, provided
            automatically by surf-client.
SURF_REPO - an alternate way to specify the --repo parameter, provided
            automatically by surf-client.`);

const argv = yargs.argv;

if (argv.version) {
  let pkgJson = require('../package.json');
  console.log(`Surf ${pkgJson.version}`);
  process.exit(0);
}

main(argv, () => yargs.showHelp())
  .then((x) => process.exit(x))
  .catch((e) => {
    console.log(`Fatal Error: ${e.message}`);
    d(e.stack);

    process.exit(-1);
  });
