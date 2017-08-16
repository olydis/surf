import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import {Observable} from 'rxjs';

import { asyncReduce } from './promise-array';
import { spawnDetached, findActualExecutable } from 'spawn-rx';
import { addFilesToGist, getGistTempdir, pushGistRepoToMaster } from './git-api';

const d = require('debug')('surf:build-api');

export function createBuildDiscovers(rootPath, discoverer) {
  let discoverClasses = fs.readdirSync(path.join(__dirname, 'build-discoverers'));

  if (discoverer) {
    discoverClasses = [discoverer + ".js"];
  }

  return _.map(discoverClasses, (file) => {
    const Klass = require(path.join(__dirname, 'build-discoverers', file)).default;

    d(`Found build discoverer: ${Klass.name}`);
    return new Klass(rootPath);
  });
}

export async function determineBuildCommands(rootPath, discoverer, sha) {
  let discoverers = createBuildDiscovers(rootPath, discoverer);
  let activeDiscoverers = [];

  let mainDiscoverer = await asyncReduce(discoverers, async (acc, x) => {
    let affinity = await x.getAffinityForRootDir() || 0;
    if (affinity < 1) return acc;

    if (x.shouldAlwaysRun) {
      activeDiscoverers.push({ affinity, discoverer: x});
      return acc;
    }

    return (acc.affinity < affinity) ?
      { affinity, discoverer: x } :
      acc;
  }, {affinity: -1, discoverer: null});

  if (mainDiscoverer.discoverer) {
    activeDiscoverers.push(mainDiscoverer);
  }

  activeDiscoverers = _.sortBy(activeDiscoverers, (x) => 0 - x.affinity);

  if (activeDiscoverers.length < 1) {
    throw new Error("We can't figure out how to build this repo automatically.");
  }

  let ret = {
    cmds: [],
    artifactDirs: []
  };

  for (let {discoverer} of activeDiscoverers) {
    let thisCmd = await discoverer.getBuildCommand(sha);

    d(`Discoverer returned ${JSON.stringify(thisCmd)}`);
    if (thisCmd.cmds) {
      let newCmds = _.map(thisCmd.cmds, (x) => findActualExecutable(x.cmd, x.args));
      ret.cmds.push(...newCmds);
    } else {
      ret.cmds.push(findActualExecutable(thisCmd.cmd, thisCmd.args));
    }

    if (thisCmd.artifactDirs) {
      ret.artifactDirs.push(...thisCmd.artifactDirs);
    }
  }

  _.each(ret.cmds, (x) => d(`Actual executable to run: ${x.cmd} ${x.args.join(' ')}`));
  return ret;
}

export function runAllBuildCommands(cmds, rootDir, sha, tempDir) {
  let toConcat = _.map(cmds, ({cmd, args}) => {
    return runBuildCommand(cmd, args, rootDir, sha, tempDir);
  });

  return Observable.concat(...toConcat)
    .publish().refCount();
}

export function runBuildCommand(cmd, args, rootDir, sha, tempDir) {
  let envToAdd = {
    'SURF_SHA1': sha,
    'SURF_ORIGINAL_TMPDIR': process.env.TMPDIR || process.env.TEMP || '/tmp',
    'TMPDIR': tempDir,
    'TEMP': tempDir,
    'TMP': tempDir
  };

  let opts = {
    cwd: rootDir,
    env: _.assign({}, process.env, envToAdd)
  };

  d(`Running ${cmd} ${args.join(' ')}...`);
  return spawnDetached(cmd, args, opts);
}

export async function uploadBuildArtifacts(gistId, gistCloneUrl, artifactDirs, buildLog, token) {
  let targetDir = getGistTempdir(gistId);

  // Add the build log even though it isn't an artifact
  await addFilesToGist(gistCloneUrl, targetDir, buildLog, token);

  for (let artifactDir of artifactDirs) {
    await addFilesToGist(gistCloneUrl, targetDir, artifactDir, token);
  }

  await pushGistRepoToMaster(targetDir, token);
  return targetDir;
}
