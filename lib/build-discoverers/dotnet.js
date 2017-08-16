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
const promisify_1 = require("../promisify");
const promise_array_1 = require("../promise-array");
const build_discover_base_1 = require("../build-discover-base");
const d = require('debug')('surf:build-discover-dotnet');
class DotNetBuildDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
    }
    findSolutionFile(dir = this.rootDir, recurse = true) {
        return __awaiter(this, void 0, void 0, function* () {
            // Look in one-level's worth of directories for any file ending in sln
            let dentries = yield promisify_1.fs.readdir(dir);
            d(dentries.join());
            for (let entry of dentries) {
                let target = path.join(dir, entry);
                let stat = yield promise_array_1.statNoException(target);
                if (!stat) {
                    d(`Failed to stat: ${target}`);
                    continue;
                }
                if (stat.isDirectory()) {
                    if (!recurse)
                        continue;
                    let didItWork = yield this.findSolutionFile(target, false);
                    if (didItWork)
                        return didItWork;
                }
                if (!target.match(/\.sln$/i))
                    continue;
                return target;
            }
            return null;
        });
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            let file = yield this.findSolutionFile();
            return (file ? 10 : 0);
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: This sucks right now, make it more better'er
            let buildCommand = process.platform === 'win32' ? 'msbuild' : 'xbuild';
            let slnFile = yield this.findSolutionFile();
            let projFiles = _.filter(yield promise_array_1.readdirRecursive(this.rootDir), (x) => x.match(/\.(cs|vb|fs)proj/i));
            let artifactDirs = _.map(projFiles, (x) => path.join(path.dirname(x), 'bin', 'Release'));
            return {
                cmd: buildCommand,
                args: ['/p:Configuration=Release', slnFile],
                artifactDirs: _.uniq(artifactDirs)
            };
        });
    }
}
exports.default = DotNetBuildDiscoverer;
