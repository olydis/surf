"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const pify = require("pify");
const toImport = [
    'mkdirp',
    'rimraf',
    'fs'
];
module.exports = _.reduce(toImport, (acc, x) => {
    if (x == 'fs') {
        acc[x] = pify(require('fs-extra'));
    }
    else {
        acc[x] = pify(require(x));
    }
    return acc;
}, {});
