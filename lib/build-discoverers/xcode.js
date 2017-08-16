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
const promisify_1 = require("../promisify");
const build_discover_base_1 = require("../build-discover-base");
class XcodeBuildDiscoverer extends build_discover_base_1.BuildDiscoverBase {
    constructor(rootDir) {
        super(rootDir);
    }
    getAffinityForRootDir() {
        return __awaiter(this, void 0, void 0, function* () {
            let names = yield promisify_1.fs.readdir(this.rootDir);
            return _.find(names, (x) => x.match(/(xcworkspace|xcodeproj)$/i)) ? 5 : 0;
        });
    }
    getBuildCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            return { cmd: 'xcodebuild', args: [] };
        });
    }
}
exports.default = XcodeBuildDiscoverer;
