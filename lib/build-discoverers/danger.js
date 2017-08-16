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
const promise_array_1 = require("../promise-array");
const build_discover_base_1 = require("../build-discover-base");
const spawn_rx_1 = require("spawn-rx");
const d = require('debug')('surf:build-discover-npm');
class DangerBuildDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
        // Danger runs concurrently with other builds
        this.shouldAlwaysRun = true;
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            const bailedAffinity = 0;
            const dangerFile = path.join(this.rootDir, 'Dangerfile');
            const exists = yield promise_array_1.statNoException(dangerFile);
            if (process.env.SURF_DISABLE_DANGER || !exists)
                return bailedAffinity;
            // If we can't find Bundler in PATH, bail
            if (spawn_rx_1.findActualExecutable('bundle', []).cmd === 'bundle') {
                console.log(`A Dangerfile exists but can't find Ruby and Bundler in PATH, skipping`);
                return bailedAffinity;
            }
            d(`Found Dangerfile at ${dangerFile}`);
            return exists ? 100 : bailedAffinity;
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let cmds = [
                { cmd: 'bundle', args: ['install'] },
                { cmd: 'bundle', args: ['exec', 'danger'] }
            ];
            if (!process.env.SURF_BUILD_NAME) {
                cmds[1].args.push('local');
            }
            if (!process.env.DANGER_GITHUB_API_TOKEN) {
                process.env.DANGER_GITHUB_API_TOKEN = process.env.GITHUB_TOKEN;
            }
            return { cmds };
        });
    }
}
exports.default = DangerBuildDiscoverer;
