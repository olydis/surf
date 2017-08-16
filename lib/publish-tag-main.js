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
const fs = require("fs");
const _ = require("lodash");
const path = require("path");
const github_api_1 = require("./github-api");
const git_api_1 = require("./git-api");
const promise_array_1 = require("./promise-array");
const d = require('debug')('surf:surf-publish');
function cloneSurfBuildGist(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let targetDir = git_api_1.getGistTempdir(github_api_1.getIdFromGistUrl(url));
        let token = process.env['GIST_TOKEN'] || process.env['GITHUB_TOKEN'];
        d(`${url} => ${targetDir}`);
        yield git_api_1.cloneRepo(url, targetDir, token, false);
        return targetDir;
    });
}
function main(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        let repo = argv.repo || process.env.SURF_REPO;
        let tag = argv.tag;
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
        if (argv.help) {
            showHelp();
            process.exit(0);
        }
        if (!tag || !repo) {
            d(`Tag or repo not set: ${tag}, ${repo}`);
            showHelp();
            process.exit(-1);
        }
        // 1. Look up tag
        // 2. Run down CI statuses for tag SHA1
        // 3. Convert URLs to something clonable
        // 4. Clone them all
        // 5. Find the files
        // 6. Upload them all
        let nwo = github_api_1.getNwoFromRepoUrl(repo);
        let ourTag = (yield github_api_1.fetchAllTags(nwo)).find((x) => x.name === tag);
        if (!ourTag) {
            throw new Error(`Couldn't find a matching tag on GitHub for ${tag}`);
        }
        let statuses = yield github_api_1.fetchStatusesForCommit(nwo, ourTag.commit.sha);
        statuses = statuses.filter((x) => {
            return x.state === 'success' && x.target_url && x.target_url.match(/^https:\/\/gist\./i);
        });
        d(`About to download URLs: ${JSON.stringify(statuses, null, 2)}`);
        let targetDirMap = {};
        for (let status of statuses) {
            let targetDir = yield cloneSurfBuildGist(status.target_url);
            targetDirMap[targetDir] = status.context;
        }
        let fileList = _.flatten(Object.keys(targetDirMap)
            .map((d) => fs.readdirSync(d)
            .filter((f) => f !== 'build-output.txt' && fs.statSync(path.join(d, f)).isFile())
            .map((f) => path.join(d, f))));
        let dupeFileList = fileList.reduce((acc, x) => {
            let basename = path.basename(x);
            acc[basename] = acc[basename] || 0;
            acc[basename]++;
            return acc;
        }, {});
        let releaseInfo = (yield github_api_1.createRelease(nwo, ourTag.name)).result;
        d(JSON.stringify(dupeFileList));
        for (let file of fileList) {
            let name = path.basename(file);
            if (dupeFileList[name] > 1) {
                let relName = targetDirMap[path.dirname(file)];
                name = name.replace(/^([^\.]+)\./, `$1-${relName}.`);
                d(`Detected dupe, renaming to ${name}`);
            }
            d(`Uploading ${file} as ${name}`);
            yield promise_array_1.retryPromise(() => github_api_1.uploadFileToRelease(releaseInfo, file, name));
        }
    });
}
exports.main = main;
