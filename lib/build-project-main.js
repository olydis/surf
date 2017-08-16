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
const path = require("path");
const mkdirp = require("mkdirp");
const sfs = require("fs");
const git_api_1 = require("./git-api");
const github_api_1 = require("./github-api");
const build_api_1 = require("./build-api");
const promisify_1 = require("./promisify");
const promise_array_1 = require("./promise-array");
const rxjs_1 = require("rxjs");
const ON_DEATH = require("death");
const DeathPromise = new Promise((res, rej) => {
    ON_DEATH((sig) => rej(new Error(`Signal ${sig} thrown`)));
});
const d = require('debug')('surf:surf-build');
function getRootAppDir() {
    let ret = null;
    let tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
    switch (process.platform) {
        case 'win32':
            ret = path.join(process.env.LOCALAPPDATA, 'surf');
            break;
        case 'darwin':
            ret = process.env.HOME ?
                path.join(process.env.HOME, 'Library', 'Application Support', 'surf') :
                path.join(tmp, 'surf-repos');
            break;
        default:
            ret = process.env.HOME ?
                path.join(process.env.HOME, '.config', 'surf') :
                path.join(tmp, 'surf-repos');
            break;
    }
    mkdirp.sync(ret);
    return ret;
}
function getRepoCloneDir() {
    return path.join(getRootAppDir(), 'repos');
}
function truncateErrorMessage(errorMessage) {
    return (errorMessage.split('\n')[0]).substr(0, 256);
}
function main(argv, showHelp) {
    let doIt = rxjs_1.Observable.merge(rxjs_1.Observable.fromPromise(realMain(argv, showHelp)), rxjs_1.Observable.fromPromise(DeathPromise)).take(1).toPromise();
    return doIt
        .then((x) => Promise.resolve(x), (e) => {
        d("Build being taken down!");
        if (argv.name) {
            let repo = argv.repo || process.env.SURF_REPO;
            let sha = argv.sha || process.env.SURF_SHA1;
            let nwo = github_api_1.getNwoFromRepoUrl(repo);
            console.error(`Build Errored: ${e.message}`);
            d(`Attempting to post error status!`);
            return promise_array_1.retryPromise(() => {
                return github_api_1.postCommitStatus(nwo, sha, 'error', `Build Errored: ${truncateErrorMessage(e.message)}`, null, argv.name);
            })
                .catch(() => true)
                .then(() => d(`We did it!`))
                .then(() => Promise.reject(e));
        }
        else {
            return Promise.reject(e);
        }
    });
}
exports.main = main;
function configureEnvironmentVariablesForChild(nwo, sha, name, repo) {
    return __awaiter(this, void 0, void 0, function* () {
        process.env.SURF_NWO = nwo;
        process.env.SURF_REPO = repo;
        if (name)
            process.env.SURF_BUILD_NAME = name;
        // If the current PR number isn't set, try to recreate it
        try {
            if (!process.env.SURF_PR_NUM) {
                let pr = yield github_api_1.findPRForCommit(nwo, sha);
                if (pr) {
                    process.env.SURF_PR_NUM = pr.number;
                    process.env.SURF_REF = pr.head.ref;
                }
            }
        }
        catch (e) {
            d(`Couldn't fetch PR for commit: ${e.message}`);
        }
    });
}
function realMain(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        let sha = argv.sha || process.env.SURF_SHA1;
        let repo = argv.repo || process.env.SURF_REPO;
        let name = argv.name;
        if (argv.help) {
            showHelp();
            process.exit(0);
        }
        if (name === '__test__') {
            // NB: Don't end up setting statuses in unit tests, even if argv.name is set
            name = null;
        }
        if (!repo) {
            try {
                repo = github_api_1.getSanitizedRepoUrl(yield git_api_1.getOriginForRepo('.'));
                argv.repo = repo;
            }
            catch (e) {
                console.error("Repository not specified and current directory is not a Git repo");
                d(e.stack);
                showHelp();
                process.exit(-1);
            }
        }
        if (!repo) {
            showHelp();
            process.exit(-1);
        }
        let repoDir = getRepoCloneDir();
        d(`Running initial cloneOrFetchRepo: ${repo} => ${repoDir}`);
        let bareRepoDir = yield promise_array_1.retryPromise(() => git_api_1.cloneOrFetchRepo(repo, repoDir));
        if (!sha) {
            d(`SHA1 not specified, trying to retrieve default branch`);
            try {
                sha = yield git_api_1.getHeadForRepo(bareRepoDir);
                argv.sha = sha;
                d(`Default branch is ${sha}`);
            }
            catch (e) {
                console.error(`Failed to find the current commit for repo ${repo}: ${e.message}`);
                d(e.stack);
                showHelp();
                process.exit(-1);
            }
        }
        let nwo = github_api_1.getNwoFromRepoUrl(repo);
        yield configureEnvironmentVariablesForChild(nwo, sha, name, repo);
        d(`repo: ${repo}, sha: ${sha}`);
        if (name) {
            d(`Posting 'pending' to GitHub status`);
            let nwo = github_api_1.getNwoFromRepoUrl(repo);
            yield promise_array_1.retryPromise(() => github_api_1.postCommitStatus(nwo, sha, 'pending', 'Surf Build Server', null, name));
        }
        let workDir = git_api_1.getWorkdirForRepoUrl(repo, sha);
        let tempDir = git_api_1.getTempdirForRepoUrl(repo, sha);
        d(`Cloning to work directory: ${workDir}`);
        let r = yield promise_array_1.retryPromise(() => git_api_1.cloneRepo(bareRepoDir, workDir, null, false));
        r.free();
        d(`Checking out to given SHA1: ${sha}`);
        yield git_api_1.checkoutSha(workDir, sha);
        d(`Resetting remote origin to URL`);
        yield git_api_1.resetOriginUrl(workDir, repo);
        d(`Determining command to build`);
        let { cmd, cmds, args, artifactDirs } = yield build_api_1.determineBuildCommands(workDir, argv.discoverer);
        if (!cmds) {
            cmds = [{ cmd, args }];
        }
        let buildPassed = true;
        let buildLog = path.join(workDir, 'build-output.log');
        let fd = yield promisify_1.fs.open(buildLog, 'w');
        try {
            let buildStream = build_api_1.runAllBuildCommands(cmds, workDir, sha, tempDir);
            buildStream.concatMap((x) => {
                console.log(x.replace(/[\r\n]+$/, ''));
                return rxjs_1.Observable.fromPromise(promisify_1.fs.write(fd, x, null, 'utf8'));
            }).subscribe(() => { }, (e) => {
                console.error(e.message);
                sfs.writeSync(fd, `${e.message}\n`, null, 'utf8');
            });
            yield buildStream
                .reduce(() => null)
                .toPromise();
        }
        catch (_) {
            // NB: We log this in the subscribe statement above
            buildPassed = false;
        }
        finally {
            sfs.closeSync(fd);
        }
        if (name) {
            d(`Posting to GitHub status`);
            let nwo = github_api_1.getNwoFromRepoUrl(repo);
            let gistInfo = yield promise_array_1.retryPromise(() => github_api_1.createGist(`Build completed: ${nwo}#${sha}, ${new Date()}`, {
                "README.md": { content: `## Build for ${nwo} ${buildPassed ? 'succeeded' : 'failed'} on ${new Date()}` }
            }));
            d(`Gist result: ${gistInfo.result.html_url}`);
            d(`Gist clone URL: ${gistInfo.result.git_pull_url}`);
            let token = process.env.GIST_TOKEN || process.env.GITHUB_TOKEN;
            try {
                d(`Uploading build artifacts using token: ${token}`);
                yield promise_array_1.retryPromise(() => build_api_1.uploadBuildArtifacts(gistInfo.result.id, gistInfo.result.git_pull_url, artifactDirs, buildLog, token));
            }
            catch (e) {
                console.error(`Failed to upload build artifacts: ${e.message}`);
                d(e.stack);
            }
            yield github_api_1.postCommitStatus(nwo, sha, buildPassed ? 'success' : 'failure', 'Surf Build Server', gistInfo.result.html_url, name);
        }
        if (buildPassed && !process.env.DEBUG) {
            yield promisify_1.rimraf(tempDir);
        }
        return buildPassed ? 0 : -1;
    });
}
