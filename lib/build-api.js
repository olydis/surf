"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const promise_array_1 = require("./promise-array");
const spawn_rx_1 = require("spawn-rx");
const git_api_1 = require("./git-api");
const d = require('debug')('surf:build-api');
function createBuildDiscovers(rootPath, discoverer) {
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
exports.createBuildDiscovers = createBuildDiscovers;
function determineBuildCommands(rootPath, discoverer, sha) {
    return __awaiter(this, void 0, void 0, function* () {
        let discoverers = createBuildDiscovers(rootPath, discoverer);
        let activeDiscoverers = [];
        let mainDiscoverer = yield promise_array_1.asyncReduce(discoverers, (acc, x) => __awaiter(this, void 0, void 0, function* () {
            let affinity = (yield x.getAffinityForRootDir()) || 0;
            if (affinity < 1)
                return acc;
            if (x.shouldAlwaysRun) {
                activeDiscoverers.push({ affinity, discoverer: x });
                return acc;
            }
            return (acc.affinity < affinity) ?
                { affinity, discoverer: x } :
                acc;
        }), { affinity: -1, discoverer: null });
        if (mainDiscoverer.discoverer) {
            activeDiscoverers.push(mainDiscoverer);
        }
        activeDiscoverers = _.sortBy(activeDiscoverers, (x) => 0 - x.affinity);
        if (activeDiscoverers.length < 1) {
            throw new Error("We can't figure out how to build this repo automatically.");
        }
        let ret = {
            cmd: undefined,
            args: undefined,
            cmds: [],
            artifactDirs: [],
        };
        for (let { discoverer } of activeDiscoverers) {
            let thisCmd = yield discoverer.getBuildCommand(sha);
            d(`Discoverer returned ${JSON.stringify(thisCmd)}`);
            if (thisCmd.cmds) {
                let newCmds = _.map(thisCmd.cmds, (x) => spawn_rx_1.findActualExecutable(x.cmd, x.args));
                ret.cmds.push(...newCmds);
            }
            else {
                ret.cmds.push(spawn_rx_1.findActualExecutable(thisCmd.cmd, thisCmd.args));
            }
            if (thisCmd.artifactDirs) {
                ret.artifactDirs.push(...thisCmd.artifactDirs);
            }
        }
        _.each(ret.cmds, (x) => d(`Actual executable to run: ${x.cmd} ${x.args.join(' ')}`));
        return ret;
    });
}
exports.determineBuildCommands = determineBuildCommands;
function runAllBuildCommands(cmds, rootDir, sha, tempDir) {
    let toConcat = _.map(cmds, ({ cmd, args }) => {
        return runBuildCommand(cmd, args, rootDir, sha, tempDir);
    });
    return rxjs_1.Observable.concat(...toConcat)
        .publish().refCount();
}
exports.runAllBuildCommands = runAllBuildCommands;
function runBuildCommand(cmd, args, rootDir, sha, tempDir) {
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
    return spawn_rx_1.spawnDetached(cmd, args, opts);
}
exports.runBuildCommand = runBuildCommand;
function uploadBuildArtifacts(gistId, gistCloneUrl, artifactDirs, buildLog, token) {
    return __awaiter(this, void 0, void 0, function* () {
        let targetDir = git_api_1.getGistTempdir(gistId);
        // Add the build log even though it isn't an artifact
        yield git_api_1.addFilesToGist(gistCloneUrl, targetDir, buildLog, token);
        for (let artifactDir of artifactDirs) {
            yield git_api_1.addFilesToGist(gistCloneUrl, targetDir, artifactDir, token);
        }
        yield git_api_1.pushGistRepoToMaster(targetDir, token);
        return targetDir;
    });
}
exports.uploadBuildArtifacts = uploadBuildArtifacts;
