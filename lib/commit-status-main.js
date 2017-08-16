#!/usr/bin/env node
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
const chalk = require("chalk");
const promise_array_1 = require("./promise-array");
const git_api_1 = require("./git-api");
const github_api_1 = require("./github-api");
const d = require('debug')('surf:commit-status-main');
function main(repo, server, jsonOnly, help, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        if (help) {
            showHelp();
            process.exit(0);
        }
        repo = repo || process.env.SURF_REPO;
        if (!repo) {
            try {
                repo = yield git_api_1.getOriginForRepo('.');
            }
            catch (e) {
                console.error("Repository not specified and current directory is not a Git repo");
                d(e.stack);
                showHelp();
                process.exit(-1);
            }
        }
        d(`Getting nwo for ${repo}`);
        let nwo = github_api_1.getNwoFromRepoUrl(repo);
        let refList = yield github_api_1.fetchAllRefsWithInfo(nwo);
        let refToObject = refList.reduce((acc, x) => {
            acc[x.ref] = x.object;
            return acc;
        }, {});
        let statuses = yield promise_array_1.asyncMap(_.map(refList, (x) => x.ref), (ref) => __awaiter(this, void 0, void 0, function* () {
            let sha = refToObject[ref].sha;
            return (yield github_api_1.getCombinedStatusesForCommit(nwo, sha)).result;
        }));
        if (jsonOnly) {
            let statusArr = _.reduce(refList, (acc, x) => {
                acc[x.ref] = statuses[x.ref];
                delete acc[x.ref].repository;
                return acc;
            }, {});
            console.log(JSON.stringify(statusArr));
        }
        else {
            const statusToIcon = {
                'success': chalk.green('✓'),
                'failure': chalk.red('✘'),
                'error': chalk.red('✘'),
                'pending': chalk.yellow('‽')
            };
            console.log(`Commit Status Information for ${repo}\n`);
            for (let ref of refList) {
                let status = statuses[ref.ref];
                let friendlyName = ref.object.pr ?
                    `#${ref.object.pr.number} (${ref.object.pr.title})` :
                    `${ref.ref.replace('refs/heads/', '')}`;
                //console.log(JSON.stringify(status));
                if (!status || status.total_count === 0) {
                    console.log(`${statusToIcon['pending']}: ${friendlyName} - no commit status for this branch / PR`);
                    continue;
                }
                if (status.total_count === 1) {
                    d(JSON.stringify(status));
                    console.log(`${statusToIcon[status.state]}: ${friendlyName} - ${status.statuses[0].description || '(No description)'} - ${status.statuses[0].target_url || '(No CI URL given)'}`);
                    continue;
                }
                console.log(`${statusToIcon[status.state]}: ${friendlyName}`);
                _.each(status.statuses, (status) => {
                    console.log(`  ${status.description} - ${status.target_url}`);
                });
            }
        }
    });
}
exports.main = main;
