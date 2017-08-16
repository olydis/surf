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
const github_api_1 = require("./github-api");
const promise_array_1 = require("./promise-array");
const d = require('debug')('surf:surf-publish');
function main(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        let repo = argv.repo || process.env.SURF_REPO;
        let tag = argv.tag;
        let target = argv.target || path.resolve('.');
        if (argv.help) {
            showHelp();
            process.exit(0);
        }
        if (!tag || !repo) {
            d(`Tag or repo not set: ${tag}, ${repo}`);
            showHelp();
            process.exit(-1);
        }
        let nwo = github_api_1.getNwoFromRepoUrl(repo);
        let release = (yield github_api_1.getReleaseByTag(nwo, tag)).result;
        yield promise_array_1.asyncMap(release.assets, (asset) => {
            if (asset.state !== 'uploaded')
                return Promise.resolve(true);
            let file = path.join(target, asset.name);
            return promise_array_1.retryPromise(() => github_api_1.downloadReleaseAsset(nwo, asset.id, file));
        });
    });
}
exports.main = main;
