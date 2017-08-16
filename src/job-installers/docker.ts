import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as temp from 'temp';

import { JobInstallerBase } from '../job-installer-base';
import * as srx from 'spawn-rx';

const d = require('debug')('surf:docker');

// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeDockerfile =
  _.template(fs.readFileSync(require.resolve('../../src/job-installers/docker.in'), 'utf8'));

export class DockerInstaller extends JobInstallerBase {
  getName(): string {
    return 'docker';
  }

  async getAffinityForJob(name, command) {
    let docker = srx.findActualExecutable('docker', []).cmd;
    if (docker === 'docker') {
      d(`Can't find docker in PATH, assuming not installed`);
      return 0;
    }

    // Let local daemons trump docker
    return 3;
  }

  async installJob(name, command, returnContent = false) {
    let opts = {
      envs: this.getInterestingEnvVars().map((x) => `${x}=${process.env[x]}`),
      pkgJson: require('../../package.json'),
      name, command
    };

    if (returnContent) {
      return { "Dockerfile": makeDockerfile(opts) };
    }
    let dir = temp.mkdirSync('surf');
    let target = path.join(dir, 'Dockerfile');
    fs.writeFileSync(target, makeDockerfile(opts), 'utf8');

    console.error(`Building Docker image, this will take a bit...`);
    await srx.spawnPromise('docker', ['build', '-t', name, dir]);

    (srx as any).spawnPromiseDetached('docker', ['run', name])
      .catch((e) => console.error(`Failed to execute docker-run! ${e.message}`));

    return `Created new docker image: ${name}
  
To start it: docker run ${name}'`;
  }
}
