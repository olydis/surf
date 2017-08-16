import { Observable, Subscription } from 'rxjs';

(Observable.prototype as any).subUnsub = function (onSub = null, onUnsub = null) {
  return Observable.create((subj) => {
    if (onSub) onSub();
    let d = this.subscribe(subj);

    return new Subscription(() => {
      if (onUnsub) onUnsub();
      d.unsubscribe();
    });
  });
};

(Observable.prototype as any).permaRefcount = function () {
  let connected = null;

  return Observable.create((subj) => {
    let d = this.subscribe(subj);
    if (!connected) connected = this.connect();

    return d;
  });
};

(Observable.prototype as any).delayFailures = function (delayTime) {
  return this
    .catch((e) => {
      return Observable.timer(delayTime)
        .flatMap(() => Observable.throw(e));
    });
};
