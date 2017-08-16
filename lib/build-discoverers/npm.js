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
const path = require("path");
const promisify_1 = require("../promisify");
const promise_array_1 = require("../promise-array");
const build_discover_base_1 = require("../build-discover-base");
const d = require('debug')('surf:build-discover-npm');
class NpmBuildDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            let pkgJson = path.join(this.rootDir, 'package.json');
            let exists = yield promise_array_1.statNoException(pkgJson);
            if (exists) {
                d(`Found package.json at ${pkgJson}`);
            }
            return exists ? 5 : 0;
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let pkgJson = JSON.parse(yield promisify_1.fs.readFile(path.join(this.rootDir, 'package.json'), 'utf8'));
            let cmds = [
                { cmd: 'npm', args: ['install'] }
            ];
            if (pkgJson.scripts && pkgJson.scripts.test) {
                cmds.push({ cmd: 'npm', args: ['test'] });
            }
            return { cmds };
        });
    }
}
exports.default = NpmBuildDiscoverer;
