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
const _ = require("lodash");
const job_installer_base_1 = require("../job-installer-base");
const promise_array_1 = require("../promise-array");
const spawn_rx_1 = require("spawn-rx");
const d = require('debug')('surf:systemd');
// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeSystemdService = _.template(fs.readFileSync(require.resolve('../../src/job-installers/systemd.service.in'), 'utf8'));
class SystemdInstaller extends job_installer_base_1.JobInstallerBase {
    getName() {
        return 'systemd';
    }
    getAffinityForJob(name, command) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.platform !== 'linux')
                return 0;
            let systemctl = yield promise_array_1.statNoException('/usr/bin/systemctl');
            if (!systemctl) {
                d(`Can't find systemctl, assuming systemd not installed`);
                return 0;
            }
            return 5;
        });
    }
    installJob(name, command, returnContent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // NB: systemd requires commands to be have absolute paths
            let [, cmd, params] = command.match(/^(\S+)(.*)/);
            command = spawn_rx_1.findActualExecutable(cmd, []).cmd + params;
            let opts = {
                envs: this.getInterestingEnvVars().map((x) => `${x}=${process.env[x]}`),
                name, command
            };
            let target = `/etc/systemd/system/${name}.service`;
            if (returnContent) {
                let ret = {};
                ret[`${name}.service`] = makeSystemdService(opts);
                return ret;
            }
            fs.writeFileSync(target, makeSystemdService(opts));
            yield spawn_rx_1.spawnPromise('systemctl', ['daemon-reload']);
            yield spawn_rx_1.spawnPromise('systemctl', ['start', name]);
            return `systemd service written to '${target}
  
To run it at system startup: sudo systemctl enable ${name}'`;
        });
    }
}
exports.default = SystemdInstaller;
