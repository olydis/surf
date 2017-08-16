"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
rxjs_1.Observable.prototype.subUnsub = function (onSub = null, onUnsub = null) {
    return rxjs_1.Observable.create((subj) => {
        if (onSub)
            onSub();
        let d = this.subscribe(subj);
        return new rxjs_1.Subscription(() => {
            if (onUnsub)
                onUnsub();
            d.unsubscribe();
        });
    });
};
rxjs_1.Observable.prototype.permaRefcount = function () {
    let connected = null;
    return rxjs_1.Observable.create((subj) => {
        let d = this.subscribe(subj);
        if (!connected)
            connected = this.connect();
        return d;
    });
};
rxjs_1.Observable.prototype.delayFailures = function (delayTime) {
    return this
        .catch((e) => {
        return rxjs_1.Observable.timer(delayTime)
            .flatMap(() => rxjs_1.Observable.throw(e));
    });
};
