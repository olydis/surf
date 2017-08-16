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
const promise_array_1 = require("./promise-array");
const promisify_1 = require("./promisify");
const git_api_1 = require("./git-api");
const github_api_1 = require("./github-api");
const d = require('debug')('surf:surf-clean');
function main(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        if (argv.help) {
            showHelp();
            process.exit(0);
        }
        let repo = argv.repo || process.env.SURF_REPO;
        if (!repo) {
            repo = github_api_1.getSanitizedRepoUrl(yield git_api_1.getOriginForRepo('.'));
        }
        if (!repo) {
            showHelp();
            process.exit(-1);
        }
        // Do an initial fetch to get our initial state
        let refInfo = null;
        try {
            refInfo = yield github_api_1.fetchAllRefsWithInfo(github_api_1.getNwoFromRepoUrl(repo));
        }
        catch (e) {
            console.log(`Failed to fetch from ${argv.r}: ${e.message}`);
            d(e.stack);
            process.exit(-1);
        }
        let safeShas = _.map(refInfo, (ref) => `-${ref.object.sha.substr(0, 6)}`);
        d(`safeShas: ${Array.from(safeShas).join()}`);
        let allDirs = yield git_api_1.getAllWorkdirs(repo);
        let toDelete = _.filter(allDirs, (x) => !_.find(safeShas, (sha) => x.indexOf(sha) > 0));
        if (argv['dry-run']) {
            _.each(toDelete, (x) => console.log(x));
        }
        else {
            yield promise_array_1.asyncMap(toDelete, (x) => {
                d(`Burninating path '${x}'`);
                return promisify_1.rimraf(x)
                    .catch((e) => console.error(`Tried to burn ${x} but failed: ${e.message}`));
            });
        }
    });
}
exports.main = main;
