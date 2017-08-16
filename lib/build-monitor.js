"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const spawn_rx_1 = require("spawn-rx");
const rxjs_1 = require("rxjs");
class SerialSubscription extends rxjs_1.Subscription {
    constructor() {
        super();
        this._currentSubscription = rxjs_1.Subscription.EMPTY;
    }
    add(teardown) {
        if (this.closed)
            return;
        if (typeof (teardown) === 'function')
            teardown = new rxjs_1.Subscription(teardown);
        if (this._currentSubscription) {
            this.remove(this._currentSubscription);
            this._currentSubscription.unsubscribe();
            this._currentSubscription = null;
        }
        super.add(this._currentSubscription = teardown);
        return this;
    }
}
const github_api_1 = require("./github-api");
require('./custom-rx-operators');
const d = require('debug')('surf:build-monitor');
function getSeenRefs(refs) {
    return _.reduce(refs, (acc, x) => {
        acc.add(x.object.sha);
        return acc;
    }, new Set());
}
exports.getSeenRefs = getSeenRefs;
class BuildMonitor {
    constructor(cmdWithArgs, repo, maxConcurrentJobs, fetchRefs, initialRefs = null, scheduler = null, pollInterval = 5000) {
        this.cmdWithArgs = cmdWithArgs;
        this.repo = repo;
        this.maxConcurrentJobs = maxConcurrentJobs;
        this.fetchRefs = fetchRefs;
        this.initialRefs = initialRefs;
        this.scheduler = scheduler;
        this.pollInterval = pollInterval;
        this.currentBuilds = {};
        this.scheduler = this.scheduler || rxjs_1.Scheduler.queue;
        this.currentRunningMonitor = new SerialSubscription();
        this.buildsToActuallyExecute = new rxjs_1.Subject();
        this.buildMonitorCrashed = new rxjs_1.Subject();
        this.buildMonitorCrashed.subscribe((e) => {
            console.error(`Build Monitor crashed! ${e.message}`);
            console.error(e.stack);
            this.unsubscribe();
        });
        if (initialRefs) {
            this.seenCommits = getSeenRefs(initialRefs);
        }
        else {
            this.seenCommits = new Set();
        }
    }
    unsubscribe() {
        this.currentRunningMonitor.unsubscribe();
    }
    runBuild(ref) {
        let args = _.clone(this.cmdWithArgs).splice(1).concat([ref.object.sha]);
        let envToAdd = {
            'SURF_SHA1': ref.object.sha,
            'SURF_REPO': this.repo,
            'SURF_NWO': github_api_1.getNwoFromRepoUrl(this.repo),
            'SURF_REF': ref.ref.replace(/^refs\/heads\//, '')
        };
        if (ref.object.pr) {
            envToAdd.SURF_PR_NUM = ref.object.pr.number;
        }
        let opts = {
            env: _.assign({}, envToAdd, process.env)
        };
        d(`About to run: ${this.cmdWithArgs[0]} ${args.join(' ')}`);
        console.log(`Building ${this.repo}@${ref.object.sha} (${ref.ref})`);
        return spawn_rx_1.spawn(this.cmdWithArgs[0], args, opts)
            .do((x) => console.log(x), e => console.error(e));
    }
    getOrCreateBuild(ref) {
        let ret = this.currentBuilds[ref.object.sha];
        if (ret)
            return ret;
        d(`Queuing build for SHA: ${ref.object.sha}, ${ref.ref}`);
        let cs = new rxjs_1.Subject();
        let cancel = () => cs.next(true);
        let innerObs = this.runBuild(ref)
            .takeUntil(cs)
            .publishLast();
        innerObs.catch(() => rxjs_1.Observable.of(''))
            .subscribe(() => {
            d(`Removing ${ref.object.sha} from active builds`);
            delete this.currentBuilds[ref.object.sha];
        });
        let connected = null;
        let buildObs = rxjs_1.Observable.create((subj) => {
            this.seenCommits.add(ref.object.sha);
            let disp = innerObs.subscribe(subj);
            if (!connected)
                connected = innerObs.connect();
            return disp;
        });
        return this.currentBuilds[ref.object.sha] = { observable: buildObs, cancel };
    }
    start() {
        let fetchCurrentRefs = rxjs_1.Observable.interval(this.pollInterval, this.scheduler)
            .switchMap(() => this.fetchRefs());
        let disp = this.buildsToActuallyExecute
            .map((x) => x.delayFailures(4000).catch((e) => {
            console.log(e.message.replace(/[\r\n]+$/, ''));
            d(e.stack);
            return rxjs_1.Observable.empty();
        }))
            .mergeAll(this.maxConcurrentJobs)
            .subscribe(() => { }, (e) => this.buildMonitorCrashed.next(e));
        let disp2 = fetchCurrentRefs.subscribe((refs) => {
            let seenRefs = getSeenRefs(refs);
            // Cancel any builds that are out-of-date
            let cancellers = _.reduce(Object.keys(this.currentBuilds), (acc, x) => {
                if (seenRefs.has(x))
                    return acc;
                acc.push(this.currentBuilds[x].cancel);
                return acc;
            }, []);
            // NB: We intentionally collect all of these via the reducer first to avoid
            // altering currentBuilds while iterating through it
            _.each(cancellers, (x) => x());
            let refsToBuild = this.determineRefsToBuild(refs);
            // NB: If we don't do this, we can stack overflow if the build queue
            // gets too deep
            rxjs_1.Observable.from(refsToBuild)
                .observeOn(this.scheduler)
                .subscribe((x) => this.buildsToActuallyExecute.next(this.getOrCreateBuild(x).observable));
        }, (e) => this.buildMonitorCrashed.next(e));
        let newSub = new rxjs_1.Subscription();
        newSub.add(disp);
        newSub.add(disp2);
        this.currentRunningMonitor.add(newSub);
        return newSub;
    }
    determineRefsToBuild(refInfo) {
        let dedupe = new Set();
        return _.filter(refInfo, (ref) => {
            if (this.seenCommits.has(ref.object.sha))
                return false;
            if (dedupe.has(ref.object.sha))
                return false;
            dedupe.add(ref.object.sha);
            return true;
        });
    }
}
exports.BuildMonitor = BuildMonitor;
