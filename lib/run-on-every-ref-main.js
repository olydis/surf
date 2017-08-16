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
const rxjs_1 = require("rxjs");
const git_api_1 = require("./git-api");
const github_api_1 = require("./github-api");
const ON_DEATH = require("death");
const build_monitor_1 = require("./build-monitor");
require('./custom-rx-operators');
const d = require('debug')('surf:run-on-every-ref');
const DeathPromise = new Promise((res, rej) => {
    ON_DEATH((sig) => rej(new Error(`Signal ${sig} thrown`)));
});
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function main(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        let cmdWithArgs = argv._;
        let repo = argv.r;
        let server = argv.s;
        if (argv.help) {
            showHelp();
            process.exit(0);
        }
        if (cmdWithArgs.length < 1) {
            console.log("Command to run not specified, defaulting to 'surf-build'");
            cmdWithArgs = ['surf-build', '-n', 'surf'];
        }
        if (!repo) {
            try {
                repo = github_api_1.getSanitizedRepoUrl(yield git_api_1.getOriginForRepo('.'));
                console.error(`Repository not specified, using current directory: ${repo}`);
            }
            catch (e) {
                console.error("Repository not specified and current directory is not a Git repo");
                d(e.stack);
                showHelp();
                process.exit(-1);
            }
        }
        let jobs = parseInt(argv.j || '2');
        if (argv.j && (jobs < 1 || jobs > 64)) {
            console.error("--jobs must be an integer");
            showHelp();
            process.exit(-1);
        }
        // Do an initial fetch to get our initial state
        let refInfo = null;
        let fetchRefs = () => github_api_1.fetchAllRefsWithInfo(github_api_1.getNwoFromRepoUrl(repo));
        let fetchRefsWithRetry = rxjs_1.Observable.defer(() => rxjs_1.Observable.fromPromise(fetchRefs())
            .delayFailures(getRandomInt(1000, 6000)))
            .retry(5);
        if (argv.u)
            refInfo = yield fetchRefsWithRetry.toPromise();
        console.log(`Watching ${repo}, will run '${cmdWithArgs.join(' ')}'\n`);
        let buildMonitor = new build_monitor_1.BuildMonitor(cmdWithArgs, repo, jobs, () => fetchRefsWithRetry, refInfo);
        buildMonitor.start();
        // NB: This is a little weird - buildMonitorCrashed just returns an item
        // whereas DeathPromise actually throws
        let ex = yield (rxjs_1.Observable.merge(buildMonitor.buildMonitorCrashed.delay(5000).take(1), rxjs_1.Observable.fromPromise(DeathPromise)).toPromise());
        if (ex)
            throw ex;
        // NB: We will never get here in normal operation
        return true;
    });
}
exports.main = main;
