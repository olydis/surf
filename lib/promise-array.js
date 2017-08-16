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
const path = require("path");
const rxjs_1 = require("rxjs");
const promisify_1 = require("./promisify");
const sfs = require('fs');
function asyncMap(array, selector, maxConcurrency = 4) {
    return rxjs_1.Observable.from(array)
        .map((k) => rxjs_1.Observable.defer(() => rxjs_1.Observable.fromPromise(selector(k))
        .map((v) => ({ k, v }))))
        .mergeAll(maxConcurrency)
        .reduce((acc, kvp) => {
        acc[kvp.k] = kvp.v;
        return acc;
    }, {})
        .toPromise();
}
exports.asyncMap = asyncMap;
function asyncReduce(array, selector, seed) {
    return __awaiter(this, void 0, void 0, function* () {
        let acc = seed;
        for (let x of array) {
            acc = yield selector(acc, x);
        }
        return acc;
    });
}
exports.asyncReduce = asyncReduce;
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
exports.delay = delay;
function retryPromise(func) {
    return rxjs_1.Observable.defer(() => rxjs_1.Observable.fromPromise(func()))
        .retry(3)
        .toPromise();
}
exports.retryPromise = retryPromise;
function statNoException(file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield promisify_1.fs.stat(file);
        }
        catch (e) {
            return null;
        }
    });
}
exports.statNoException = statNoException;
function statSyncNoException(file) {
    try {
        return sfs.statSync(file);
    }
    catch (e) {
        return null;
    }
}
exports.statSyncNoException = statSyncNoException;
function readdirRecursive(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        let acc = [];
        for (let entry of yield promisify_1.fs.readdir(dir)) {
            let target = path.resolve(dir, entry);
            let stat = yield statNoException(target);
            if (stat && stat.isDirectory()) {
                let entries = yield readdirRecursive(target);
                _.each(entries, (x) => acc.push(x));
            }
            else {
                acc.push(target);
            }
        }
        return acc;
    });
}
exports.readdirRecursive = readdirRecursive;
