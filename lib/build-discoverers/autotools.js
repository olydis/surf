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
const d = require('debug')('surf:build-discover-autotools');
class AutotoolsBuildDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            let names = yield promisify_1.fs.readdir(this.rootDir);
            let result = _.find(names, (x) => x.match(/configure\.(in|ac)/i));
            return result ? 5 : 0;
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let cmds = [
                { cmd: path.join(this.rootDir, 'configure'), args: ['--prefix', path.resolve(this.rootDir, 'surf-artifacts')] },
                { cmd: 'make', args: [] },
                { cmd: 'make', args: ['install'] }
            ];
            let autogen = path.join(this.rootDir, 'autogen.sh');
            if (yield promise_array_1.statNoException(autogen)) {
                cmds.unshift({ cmd: autogen, args: [] });
            }
            d(JSON.stringify(cmds));
            return {
                cmds: cmds,
                artifactDirs: [path.join(this.rootDir, 'surf-artifacts')]
            };
        });
    }
}
exports.default = AutotoolsBuildDiscoverer;
