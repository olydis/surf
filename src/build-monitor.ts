import * as _ from 'lodash';
import { spawn } from 'spawn-rx';
import { Observable, Scheduler, Subject, Subscription } from 'rxjs';

class SerialSubscription extends Subscription {
  private _currentSubscription;

  constructor() {
    super();
    this._currentSubscription = Subscription.EMPTY;
  }

  add(teardown): Subscription {
    if (this.closed) return;
    if (typeof (teardown) === 'function') teardown = new Subscription(teardown);

    if (this._currentSubscription) {
      this.remove(this._currentSubscription);
      this._currentSubscription.unsubscribe();
      this._currentSubscription = null;
    }

    super.add(this._currentSubscription = teardown);

    return this;
  }
}

import { getNwoFromRepoUrl } from './github-api';

require('./custom-rx-operators');

const d = require('debug')('surf:build-monitor');

export function getSeenRefs(refs) {
  return _.reduce(refs, (acc, x) => {
    acc.add(x.object.sha);
    return acc;
  }, new Set());
}

export class BuildMonitor {
  private currentBuilds: any;
  private currentRunningMonitor: any;
  private buildsToActuallyExecute: any;
  public buildMonitorCrashed: any;
  private seenCommits: any;

  constructor(
    private cmdWithArgs: any,
    private repo,
    private maxConcurrentJobs,
    private fetchRefs,
    private initialRefs = null,
    private scheduler = null,
    private pollInterval = 5000) {

    this.currentBuilds = {};
    this.scheduler = this.scheduler || Scheduler.queue;
    this.currentRunningMonitor = new SerialSubscription();
    this.buildsToActuallyExecute = new Subject();
    this.buildMonitorCrashed = new Subject();

    this.buildMonitorCrashed.subscribe((e) => {
      console.error(`Build Monitor crashed! ${e.message}`);
      console.error(e.stack);

      this.unsubscribe();
    });

    if (initialRefs) {
      this.seenCommits = getSeenRefs(initialRefs);
    } else {
      this.seenCommits = new Set();
    }
  }

  unsubscribe() {
    this.currentRunningMonitor.unsubscribe();
  }

  runBuild(ref) {
    let args = _.clone(this.cmdWithArgs).splice(1).concat([ref.object.sha]);
    let envToAdd: any = {
      'SURF_SHA1': ref.object.sha,
      'SURF_REPO': this.repo,
      'SURF_NWO': getNwoFromRepoUrl(this.repo),
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

    return spawn(this.cmdWithArgs[0], args, opts)
      .do((x) => console.log(x), e => console.error(e));
  }

  getOrCreateBuild(ref) {
    let ret = this.currentBuilds[ref.object.sha];
    if (ret) return ret;

    d(`Queuing build for SHA: ${ref.object.sha}, ${ref.ref}`);
    let cs = new Subject();
    let cancel = () => cs.next(true);

    let innerObs = this.runBuild(ref)
      .takeUntil(cs)
      .publishLast();

    innerObs.catch(() => Observable.of(''))
      .subscribe(() => {
        d(`Removing ${ref.object.sha} from active builds`);
        delete this.currentBuilds[ref.object.sha];
      });

    let connected = null;
    let buildObs = Observable.create((subj) => {
      this.seenCommits.add(ref.object.sha);

      let disp = innerObs.subscribe(subj);
      if (!connected) connected = innerObs.connect();

      return disp;
    });

    return this.currentBuilds[ref.object.sha] = { observable: buildObs, cancel };
  }

  start() {
    let fetchCurrentRefs = Observable.interval(this.pollInterval, this.scheduler)
      .switchMap(() => this.fetchRefs());

    let disp = this.buildsToActuallyExecute
      .map((x) => x.delayFailures(4000).catch((e) => {

        console.log(e.message.replace(/[\r\n]+$/, ''));
        d(e.stack);

        return Observable.empty();
      }))
      .mergeAll(this.maxConcurrentJobs)
      .subscribe(() => { }, (e) => this.buildMonitorCrashed.next(e));

    let disp2 = fetchCurrentRefs.subscribe((refs) => {
      let seenRefs = getSeenRefs(refs);

      // Cancel any builds that are out-of-date
      let cancellers = _.reduce(Object.keys(this.currentBuilds), (acc, x) => {
        if (seenRefs.has(x)) return acc;

        acc.push(this.currentBuilds[x].cancel);
        return acc;
      }, []);

      // NB: We intentionally collect all of these via the reducer first to avoid
      // altering currentBuilds while iterating through it
      _.each(cancellers, (x) => x());

      let refsToBuild = this.determineRefsToBuild(refs);

      // NB: If we don't do this, we can stack overflow if the build queue
      // gets too deep
      Observable.from(refsToBuild)
        .observeOn(this.scheduler)
        .subscribe((x) =>
          this.buildsToActuallyExecute.next(this.getOrCreateBuild(x).observable));
    }, (e) => this.buildMonitorCrashed.next(e));

    let newSub = new Subscription();
    newSub.add(disp); newSub.add(disp2);

    this.currentRunningMonitor.add(newSub);
    return newSub;
  }

  determineRefsToBuild(refInfo) {
    let dedupe = new Set();

    return _.filter(refInfo, (ref) => {
      if (this.seenCommits.has(ref.object.sha)) return false;
      if (dedupe.has(ref.object.sha)) return false;

      dedupe.add(ref.object.sha);
      return true;
    });
  }
}