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
const crypto = require("crypto");
const path = require("path");
const _ = require("lodash");
const nodegit_1 = require("nodegit");
const github_api_1 = require("./github-api");
const iso8601_1 = require("iso8601");
const promisify_1 = require("./promisify");
const promise_array_1 = require("./promise-array");
nodegit_1.enableThreadSafety();
const d = require('debug')('surf:git-api');
function using(block) {
    let toFree = [];
    try {
        return block((f) => { toFree.push(f); return f; });
    }
    finally {
        toFree.reverse().forEach((f) => f.free());
    }
}
function getHeadForRepo(targetDirname) {
    return __awaiter(this, void 0, void 0, function* () {
        let repoDir = yield nodegit_1.Repository.discover(targetDirname, 0, '');
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            let repo = ds(yield nodegit_1.Repository.open(repoDir));
            let commit = ds(yield repo.getHeadCommit());
            return commit.sha();
        }));
    });
}
exports.getHeadForRepo = getHeadForRepo;
function getOriginForRepo(targetDirname) {
    return __awaiter(this, void 0, void 0, function* () {
        let repoDir = yield nodegit_1.Repository.discover(targetDirname, 0, '');
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            let repo = ds(yield nodegit_1.Repository.open(repoDir));
            let origin = ds(yield nodegit_1.Remote.lookup(repo, 'origin'));
            return origin.pushurl() || origin.url();
        }));
    });
}
exports.getOriginForRepo = getOriginForRepo;
function getAllWorkdirs(repoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        let tmp = process.env.SURF_ORIGINAL_TMPDIR || process.env.TMPDIR || process.env.TEMP || '/tmp';
        let ret = yield promisify_1.fs.readdir(tmp);
        return _.reduce(ret, (acc, x) => {
            let nwo = github_api_1.getNwoFromRepoUrl(repoUrl).split('/')[1];
            if (x.match(/^surfg-/i)) {
                let tgt = path.join(tmp, x);
                let stats = promisify_1.fs.statSync(tgt);
                let now = new Date();
                if (now - stats.mtime > 1000 * 60 * 60 * 2) {
                    acc.push(path.join(tmp, x));
                }
                return acc;
            }
            if (!x.match(/-[a-f0-9A-F]{6}/i))
                return acc;
            if (x.indexOf(`${nwo}-`) < 0)
                return acc;
            acc.push(path.join(tmp, x));
            return acc;
        }, []);
    });
}
exports.getAllWorkdirs = getAllWorkdirs;
function getWorkdirForRepoUrl(repoUrl, sha, dontCreate = false) {
    let tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
    let nwo = github_api_1.getNwoFromRepoUrl(repoUrl).split('/')[1];
    let date = iso8601_1.toIso8601(new Date()).replace(/:/g, '.');
    let shortSha = sha.substr(0, 6);
    let ret = path.join(tmp, `${nwo}-${shortSha}`);
    if (promise_array_1.statSyncNoException(ret)) {
        ret = path.join(tmp, `${nwo}-${shortSha}-${date}`);
    }
    if (!dontCreate)
        promisify_1.mkdirp.sync(ret);
    return ret;
}
exports.getWorkdirForRepoUrl = getWorkdirForRepoUrl;
function getTempdirForRepoUrl(repoUrl, sha, dontCreate = false) {
    let tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
    let nwo = github_api_1.getNwoFromRepoUrl(repoUrl).split('/')[1];
    let date = iso8601_1.toIso8601(new Date()).replace(/:/g, '.');
    let shortSha = sha.substr(0, 6);
    let ret = path.join(tmp, `t-${nwo}-${shortSha}`);
    if (promise_array_1.statSyncNoException(ret)) {
        ret = path.join(tmp, `t-${nwo}-${shortSha}-${date}`);
    }
    if (!dontCreate)
        promisify_1.mkdirp.sync(ret);
    return ret;
}
exports.getTempdirForRepoUrl = getTempdirForRepoUrl;
function getGistTempdir(id) {
    let tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
    let date = iso8601_1.toIso8601(new Date()).replace(/:/g, '.');
    let ret = path.join(tmp, `surfg-${id}-${date}`);
    return ret;
}
exports.getGistTempdir = getGistTempdir;
function checkoutSha(targetDirname, sha) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            let repo = ds(yield nodegit_1.Repository.open(targetDirname));
            let commit = ds(yield repo.getCommit(sha));
            let opts = {};
            // Equivalent of `git reset --hard HEAD && git clean -xdf`
            d(`Found commit: ${targetDirname}:${commit.sha()}`);
            opts.checkoutStrategy = nodegit_1.Checkout.STRATEGY.FORCE |
                nodegit_1.Checkout.STRATEGY.RECREATE_MISSING |
                nodegit_1.Checkout.STRATEGY.REMOVE_UNTRACKED |
                nodegit_1.Checkout.STRATEGY.USE_THEIRS;
            yield nodegit_1.Checkout.tree(repo, commit, opts);
        }));
    });
}
exports.checkoutSha = checkoutSha;
function updateRefspecToPullPRs(repository) {
    nodegit_1.Remote.addFetch(repository, 'origin', '+refs/pull/*/head:refs/remotes/origin/pr/*');
}
exports.updateRefspecToPullPRs = updateRefspecToPullPRs;
function cloneRepo(url, targetDirname, token = null, bare = true) {
    return __awaiter(this, void 0, void 0, function* () {
        token = token || process.env.GITHUB_TOKEN;
        let opts = {
            bare: bare ? 1 : 0,
            fetchOpts: {
                callbacks: {
                    credentials: () => {
                        d(`Returning ${token} for authentication token`);
                        return nodegit_1.Cred.userpassPlaintextNew(token, 'x-oauth-basic');
                    },
                    certificateCheck: () => {
                        // Yolo
                        return 1;
                    }
                }
            }
        };
        if (!token) {
            d("GitHub token not set, only public repos will work!");
            delete opts.fetchOpts;
        }
        d(`Cloning ${url} => ${targetDirname}, bare=${bare}`);
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            let repo = yield nodegit_1.Clone.clone(url, targetDirname, opts);
            if (bare)
                updateRefspecToPullPRs(repo);
            ds(yield fetchRepo(targetDirname, token, bare));
            return repo;
        }));
    });
}
exports.cloneRepo = cloneRepo;
function fetchRepo(targetDirname, token = null, bare = true) {
    return __awaiter(this, void 0, void 0, function* () {
        token = token || process.env.GITHUB_TOKEN;
        let repo = bare ?
            yield nodegit_1.Repository.openBare(targetDirname) :
            yield nodegit_1.Repository.open(targetDirname);
        d(`Fetching all refs for ${targetDirname}`);
        let fo = {
            downloadTags: 1,
            callbacks: {
                credentials: () => {
                    d(`Returning ${token} for authentication token`);
                    return nodegit_1.Cred.userpassPlaintextNew(token, 'x-oauth-basic');
                },
                certificateCheck: () => {
                    // Yolo
                    return 1;
                }
            }
        };
        if (!token) {
            d("GitHub token not set, only public repos will work!");
            delete fo.callbacks;
        }
        yield repo.fetchAll(fo);
        return repo;
    });
}
exports.fetchRepo = fetchRepo;
function cloneOrFetchRepo(url, checkoutDir, token = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let dirname = crypto.createHash('sha1').update(url).digest('hex');
        let targetDirname = path.join(checkoutDir, dirname);
        let r = null;
        try {
            r = yield fetchRepo(targetDirname, token);
            r.free();
            return targetDirname;
        }
        catch (e) {
            d(`Failed to open bare repository, going to clone instead: ${e.message}`);
            d(e.stack);
        }
        yield promisify_1.rimraf(targetDirname);
        yield promisify_1.mkdirp(targetDirname);
        r = yield cloneRepo(url, targetDirname, token);
        r.free();
        return targetDirname;
    });
}
exports.cloneOrFetchRepo = cloneOrFetchRepo;
function resetOriginUrl(target, url) {
    return __awaiter(this, void 0, void 0, function* () {
        yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            let repo = ds(yield nodegit_1.Repository.open(target));
            nodegit_1.Remote.setUrl(repo, 'origin', url);
        }));
    });
}
exports.resetOriginUrl = resetOriginUrl;
function addFilesToGist(repoUrl, targetDir, artifactDirOrFile, token = null) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            if (!(yield promise_array_1.statNoException(targetDir))) {
                d(`${targetDir} doesn't exist, cloning it`);
                yield promisify_1.mkdirp(targetDir);
                ds(yield cloneRepo(repoUrl, targetDir, token, false));
            }
            d("Opening repo");
            let repo = ds(yield nodegit_1.Repository.open(targetDir));
            d("Opening index");
            let idx = ds(yield repo.index());
            yield idx.read(1);
            let stat = yield promisify_1.fs.stat(artifactDirOrFile);
            if (stat.isFile()) {
                d(`Adding artifact directly as file: ${artifactDirOrFile}}`);
                let tgt = path.join(targetDir, path.basename(artifactDirOrFile));
                promisify_1.fs.copySync(artifactDirOrFile, tgt);
                d(`Adding artifact: ${tgt}`);
                yield idx.addByPath(path.basename(artifactDirOrFile));
            }
            else {
                d("Reading artifacts directory");
                let artifacts = yield promisify_1.fs.readdir(artifactDirOrFile);
                for (let entry of artifacts) {
                    let tgt = path.join(targetDir, entry);
                    promisify_1.fs.copySync(path.join(artifactDirOrFile, entry), tgt);
                    d(`Adding artifact: ${tgt}`);
                    yield idx.addByPath(entry);
                }
            }
            yield idx.write();
            let oid = yield idx.writeTree();
            let head = yield nodegit_1.Reference.nameToId(repo, "HEAD");
            let parent = ds(yield repo.getCommit(head));
            d(`Writing commit to gist`);
            let now = new Date();
            let sig = ds(yield nodegit_1.Signature.create("Surf Build Server", "none@example.com", now.getTime(), now.getTimezoneOffset()));
            let sig2 = ds(yield nodegit_1.Signature.create("Surf Build Server", "none@example.com", now.getTime(), now.getTimezoneOffset()));
            d(`Creating commit`);
            yield ds(repo.createCommit("HEAD", sig, sig2, `Adding files from ${targetDir}`, oid, [parent]));
            return targetDir;
        }));
    });
}
exports.addFilesToGist = addFilesToGist;
function pushGistRepoToMaster(targetDir, token) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield using((ds) => __awaiter(this, void 0, void 0, function* () {
            d("Opening repo");
            let repo = ds(yield nodegit_1.Repository.open(targetDir));
            d("Looking up origin");
            let origin = yield nodegit_1.Remote.lookup(repo, 'origin');
            let refspec = "refs/heads/master:refs/heads/master";
            let pushopts = {
                callbacks: {
                    credentials: () => {
                        d(`Returning ${token} for authentication token`);
                        return nodegit_1.Cred.userpassPlaintextNew(token, 'x-oauth-basic');
                    },
                    certificateCheck: () => {
                        // Yolo
                        return 1;
                    }
                }
            };
            d("Pushing to Gist");
            yield origin.push([refspec], pushopts);
        }));
    });
}
exports.pushGistRepoToMaster = pushGistRepoToMaster;
