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
const build_discover_base_1 = require("../build-discover-base");
const d = require('debug')('surf:build-discover-drivers');
const possibleScriptPathsWin32 = [
    'script/ci.ps1',
    'script/ci.cmd',
    'script/cibuild.ps1',
    'script/cibuild.cmd',
    'build.ps1',
    'build.cmd'
];
const possibleScriptPathsPosix = [
    'script/ci',
    'script/cibuild',
    'build.sh'
];
class BuildScriptDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            let scriptDir = yield this.getScriptPath();
            return (scriptDir ? 50 : 0);
        });
    }
    getScriptPath() {
        return __awaiter(this, void 0, void 0, function* () {
            const guesses = process.platform === 'win32' ? possibleScriptPathsWin32 : possibleScriptPathsPosix;
            for (let guess of guesses) {
                try {
                    let fullPath = path.join(this.rootDir, guess);
                    d(`Looking for file ${fullPath}`);
                    let stat = yield promisify_1.fs.stat(fullPath);
                    d("Found it!");
                    if (stat)
                        return fullPath;
                }
                catch (e) {
                    continue;
                }
            }
            d("Didn't find a build script");
            return null;
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let artifactDir = path.join(this.rootDir, 'surf-artifacts');
            yield promisify_1.mkdirp(artifactDir);
            process.env.SURF_ARTIFACT_DIR = artifactDir;
            return { cmd: yield this.getScriptPath(), args: [], artifactDirs: [artifactDir] };
        });
    }
}
exports.default = BuildScriptDiscoverer;
