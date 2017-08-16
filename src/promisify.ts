import * as _ from 'lodash';
import * as pify from 'pify';

const toImport = [
  'mkdirp',
  'rimraf',
  'fs'
];

export declare const mkdirp: any;
export declare const rimraf: any;
export declare const fs: any;

module.exports = _.reduce(toImport, (acc, x) => {
  if (x == 'fs') {
    acc[x] = pify(require('fs-extra'));
  } else {
    acc[x] = pify(require(x));
  }

  return acc;
}, {});