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
const mimeTypes = require("mime-types");
const fs = require("fs");
const url = require("url");
const _ = require("lodash");
const request = require("request-promise");
const requestOg = require("request");
const parseLinkHeader = require("parse-link-header");
const pkg = require('../package.json');
const promise_array_1 = require("./promise-array");
const createLRU = require("lru-cache");
const d = require('debug')('surf:github-api');
function apiUrl(path, gist = false) {
    let apiRoot = gist ?
        (process.env.GIST_ENTERPRISE_URL || process.env.GITHUB_ENTERPRISE_URL) :
        process.env.GITHUB_ENTERPRISE_URL;
    if (apiRoot) {
        return `${apiRoot}/api/v3/${path}`;
    }
    else {
        return `https://api.github.com/${path}`;
    }
}
const sshRemoteUrl = /^git@(.*):([^.]*)(\.git)?$/i;
const httpsRemoteUri = /https?:\/\//i;
function getSanitizedRepoUrl(repoUrl) {
    if (repoUrl.match(httpsRemoteUri))
        return repoUrl;
    let m = repoUrl.match(sshRemoteUrl);
    if (!m) {
        d(`URL ${repoUrl} seems totally bogus`);
        return repoUrl;
    }
    if (m[1] === 'github.com') {
        return `https://github.com/${m[2]}`;
    }
    else {
        let host = process.env.GITHUB_ENTERPRISE_URL || `https://${m[1]}`;
        return `${host}/${m[2]}`;
    }
}
exports.getSanitizedRepoUrl = getSanitizedRepoUrl;
function getNwoFromRepoUrl(repoUrl) {
    // Fix up SSH repo origins
    let m = repoUrl.match(sshRemoteUrl);
    if (m) {
        return m[2];
    }
    let u = url.parse(repoUrl);
    return u.path.slice(1).replace(/\.git$/, '');
}
exports.getNwoFromRepoUrl = getNwoFromRepoUrl;
function getIdFromGistUrl(gistUrl) {
    let u = url.parse(gistUrl);
    let s = u.pathname.split('/');
    // NB: Anonymous Gists don't have usernames, just the token
    return s[2] || s[1];
}
exports.getIdFromGistUrl = getIdFromGistUrl;
function gitHub(uri, token = null, body = null, extraHeaders = null, targetFile = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let tok = token || process.env.GITHUB_TOKEN;
        d(`Fetching GitHub URL: ${uri}`);
        let opts = {
            uri: uri,
            headers: {
                'User-Agent': `${pkg.name}/${pkg.version}`,
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${tok}`
            },
            json: true,
            followAllRedirects: true
        };
        if (body) {
            opts.body = body;
            opts.method = 'POST';
        }
        if (extraHeaders) {
            Object.assign(opts.headers, extraHeaders);
        }
        if (_.isNumber(body) || body instanceof Buffer || body instanceof fs.ReadStream) {
            delete opts.json;
        }
        if (targetFile) {
            delete opts.json;
            yield new Promise((res, rej) => {
                let str = requestOg(opts)
                    .pipe(fs.createWriteStream(targetFile));
                str.on('finish', () => res());
                str.on('error', (e) => rej(e));
            });
            return { result: targetFile, headers: {} };
        }
        let ret = null;
        let result = null;
        try {
            ret = request(opts);
            result = yield ret;
        }
        catch (e) {
            d(JSON.stringify(e.cause));
            d(JSON.stringify(e.message));
            throw e;
        }
        return { result, headers: ret.response.headers };
    });
}
exports.gitHub = gitHub;
const githubCache = createLRU({
    max: 1000
});
function cachedGitHub(uri, token = null, maxAge = undefined) {
    return __awaiter(this, void 0, void 0, function* () {
        let ret = githubCache.get(uri);
        if (ret)
            return ret;
        ret = yield gitHub(uri, token);
        githubCache.set(uri, ret, maxAge);
        return ret;
    });
}
exports.cachedGitHub = cachedGitHub;
function githubPaginate(uri, token = null, maxAge = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let next = uri;
        let ret = [];
        do {
            let { headers, result } = yield cachedGitHub(next, token, maxAge);
            ret = ret.concat(result);
            if (!headers['link'])
                break;
            let links = parseLinkHeader(headers['link']);
            next = 'next' in links ? links.next.url : null;
        } while (next);
        return ret;
    });
}
exports.githubPaginate = githubPaginate;
function fetchAllOpenPRs(nwo) {
    return githubPaginate(apiUrl(`repos/${nwo}/pulls?state=open`), null, 60 * 1000);
}
exports.fetchAllOpenPRs = fetchAllOpenPRs;
const refCache = createLRU({
    max: 1000
});
function fetchSingleRef(nwo, ref, shaHint = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let ret = shaHint ? refCache.get(shaHint) : null;
        if (ret) {
            return ret;
        }
        ret = yield cachedGitHub(apiUrl(`repos/${nwo}/git/refs/heads/${ref}`), null, 30 * 1000);
        refCache.set(ret.result.object.sha, ret);
        return ret;
    });
}
exports.fetchSingleRef = fetchSingleRef;
function fetchRepoInfo(nwo) {
    return cachedGitHub(apiUrl(`repos/${nwo}`), null, 5 * 60 * 1000);
}
exports.fetchRepoInfo = fetchRepoInfo;
function objectValues(obj) {
    return Object.keys(obj).map((x) => obj[x]);
}
function fetchAllRefsWithInfo(nwo) {
    return __awaiter(this, void 0, void 0, function* () {
        let openPRs = (yield fetchAllOpenPRs(nwo));
        let refList = openPRs.map((x) => x.head.ref);
        let refToPR = openPRs.reduce((acc, x) => {
            acc[x.head.ref] = x;
            return acc;
        }, {});
        let refs = objectValues(yield promise_array_1.asyncMap(refList, (ref) => __awaiter(this, void 0, void 0, function* () {
            let repoName = refToPR[ref].head.repo.full_name;
            let shaHint = refToPR[ref].head.sha;
            try {
                return (yield fetchSingleRef(repoName, ref, shaHint)).result;
            }
            catch (e) {
                d(`Tried to fetch ref ${repoName}:${ref} but it failed: ${e.message}`);
                return null;
            }
        })));
        // Monitor the default branch for the repo (usually 'master')
        let repoInfo = yield fetchRepoInfo(nwo);
        let defaultBranch = repoInfo.result.default_branch;
        let result = yield fetchSingleRef(nwo, defaultBranch);
        refs.push(result.result);
        // Filter failures from when we get the ref
        refs = refs.filter((x) => x !== null);
        let commitInfo = yield promise_array_1.asyncMap(_.map(refs, (ref) => ref.object.url), (x) => __awaiter(this, void 0, void 0, function* () {
            try {
                return (yield cachedGitHub(x)).result;
            }
            catch (e) {
                d(`Tried to fetch commit info for ${x} but failed: ${e.message}`);
                return null;
            }
        }));
        _.each(refs, (ref) => {
            ref.object.commit = commitInfo[ref.object.url];
            ref.object.pr = refToPR[ref.ref.replace(/^refs\/heads\//, '')];
        });
        // Filter failures from the commitInfo asyncMap above
        refs = refs.filter((r) => r.object.commit);
        return refs;
    });
}
exports.fetchAllRefsWithInfo = fetchAllRefsWithInfo;
function postCommitStatus(nwo, sha, state, description, target_url, context, token = null) {
    let body = { state, target_url, description, context };
    if (!target_url) {
        delete body.target_url;
    }
    d(JSON.stringify(body));
    return gitHub(apiUrl(`repos/${nwo}/statuses/${sha}`), token, body);
}
exports.postCommitStatus = postCommitStatus;
function createGist(description, files, publicGist = false, token = null) {
    let body = { files, description, "public": publicGist };
    return gitHub(apiUrl('gists', true), token || process.env.GIST_TOKEN, body);
}
exports.createGist = createGist;
function fetchAllTags(nwo, token = null) {
    return githubPaginate(apiUrl(`repos/${nwo}/tags?per_page=100`), token, 60 * 1000);
}
exports.fetchAllTags = fetchAllTags;
function fetchStatusesForCommit(nwo, sha, token = null) {
    return githubPaginate(apiUrl(`repos/${nwo}/commits/${sha}/statuses?per_page=100`), token, 60 * 1000);
}
exports.fetchStatusesForCommit = fetchStatusesForCommit;
function getCombinedStatusesForCommit(nwo, sha, token = null) {
    return gitHub(apiUrl(`repos/${nwo}/commits/${sha}/status`), token);
}
exports.getCombinedStatusesForCommit = getCombinedStatusesForCommit;
function createRelease(nwo, tag, token = null) {
    let body = {
        tag_name: tag,
        target_committish: tag,
        name: `${nwo.split('/')[1]} @ ${tag}`,
        body: 'To be written',
        draft: true
    };
    return gitHub(apiUrl(`repos/${nwo}/releases`), token, body);
}
exports.createRelease = createRelease;
function uploadFileToRelease(releaseInfo, targetFile, fileName, token = null) {
    let uploadUrl = releaseInfo.upload_url.replace(/{[^}]*}/g, '');
    uploadUrl = uploadUrl + `?name=${encodeURIComponent(fileName)}`;
    let contentType = {
        "Content-Type": mimeTypes.lookup[fileName] || 'application/octet-stream',
        "Content-Length": fs.statSync(targetFile).size
    };
    d(JSON.stringify(contentType));
    return gitHub(uploadUrl, token, fs.createReadStream(targetFile), contentType);
}
exports.uploadFileToRelease = uploadFileToRelease;
function getReleaseByTag(nwo, tag, token = null) {
    return gitHub(apiUrl(`repos/${nwo}/releases/tags/${tag}`), token);
}
exports.getReleaseByTag = getReleaseByTag;
function downloadReleaseAsset(nwo, assetId, targetFile, token = null) {
    let headers = { "Accept": "application/octet-stream" };
    return gitHub(apiUrl(`repos/${nwo}/releases/assets/${assetId}`), token, null, headers, targetFile);
}
exports.downloadReleaseAsset = downloadReleaseAsset;
function findPRForCommit(nwo, sha, token = null) {
    return __awaiter(this, void 0, void 0, function* () {
        // NB: Thanks pea53 for this but also this is bananas weird lol
        let result = (yield gitHub(apiUrl(`search/issues?q=${sha}`), token)).result;
        let item = result.items.find((x) => {
            if (!x.pull_request)
                return false;
            if (x.pull_request.url.indexOf(`/${nwo}/`) < 0)
                return false;
            return true;
        });
        if (!item || !item.pull_request)
            return null;
        return (yield gitHub(item.pull_request.url)).result;
    });
}
exports.findPRForCommit = findPRForCommit;
