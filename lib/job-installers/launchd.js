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
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const job_installer_base_1 = require("../job-installer-base");
const spawn_rx_1 = require("spawn-rx");
const stringArgv = require("string-argv");
const xmlescape = require("xml-escape");
const mkdirp = require("mkdirp");
const d = require('debug')('surf:launchd');
// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeLaunchdService = _.template(fs.readFileSync(require.resolve('../../src/job-installers/launchd.plist.in'), 'utf8'));
class LaunchdInstaller extends job_installer_base_1.JobInstallerBase {
    getName() {
        return 'launchd';
    }
    getAffinityForJob(name, command) {
        return __awaiter(this, void 0, void 0, function* () {
            return process.platform === 'darwin' ? 5 : 0;
        });
    }
    installJob(name, command, returnContent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // NB: launchd requires commands to be have absolute paths
            let [, cmd, params] = command.match(/^(\S+)(.*)/);
            command = spawn_rx_1.findActualExecutable(cmd, []).cmd;
            let opts = {
                commandWithoutArgs: command,
                argList: stringArgv(params).map((x) => xmlescape(x)),
                envs: this.getInterestingEnvVars().map((x) => [xmlescape(x), xmlescape(process.env[x])]),
                name
            };
            opts = Object.keys(opts).reduce((acc, x) => {
                if (x === 'envs' || x === 'argList') {
                    acc[x] = opts[x];
                    return acc;
                }
                acc[x] = xmlescape(opts[x]);
                return acc;
            }, {});
            if (returnContent) {
                let ret = {};
                ret[`local.${name}.plist`] = makeLaunchdService(opts);
                return ret;
            }
            let target = `${process.env.HOME}/Library/LaunchAgents/local.${name}.plist`;
            mkdirp.sync(path.dirname(target));
            fs.writeFileSync(target, makeLaunchdService(opts));
            fs.chmodSync(target, 0o644);
            return `launchd agent written to '${target}
  
launchd agents only run when the current user logs on, because many macOS services
only work interactively, such as the keychain.

To start manually, run launchctl load ${target}`;
        });
    }
}
exports.default = LaunchdInstaller;
