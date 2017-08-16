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
const fs = require("fs");
const os = require("os");
const mkdirp = require("mkdirp");
const path = require("path");
const temp = require("temp");
const job_installer_base_1 = require("../job-installer-base");
const spawn_rx_1 = require("spawn-rx");
const xmlescape = require("xml-escape");
const d = require('debug')('surf:task-scheduler');
let runAsAdministrator = (cmd, params) => {
    return spawn_rx_1.spawnPromise(cmd, params)
        .then(() => 0)
        .catch((e) => {
        console.error(e.message);
        return -1;
    });
};
(function () {
    try {
        // NB: runas seems to have trouble compiling in various places :-/
        const runas = require('runas');
        runAsAdministrator = (cmd, params) => {
            let { exitCode } = runas(cmd, params, { admin: true, catchOutput: true });
            return Promise.resolve(exitCode);
        };
    }
    catch (e) {
        if (process.platform === 'win32') {
            console.error("Can't load runas, if this fails try re-running as Elevated Admin");
        }
    }
})();
// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeTaskSchedulerXml = _.template(fs.readFileSync(require.resolve('../../src/job-installers/task-scheduler.xml.in'), 'utf8'));
const makeTaskSchedulerCmd = _.template(fs.readFileSync(require.resolve('../../src/job-installers/task-scheduler.cmd.in'), 'utf8'));
class TaskSchedulerInstaller extends job_installer_base_1.JobInstallerBase {
    getName() {
        return 'task-scheduler';
    }
    getAffinityForJob(name, command) {
        return __awaiter(this, void 0, void 0, function* () {
            return process.platform === 'win32' ? 5 : 0;
        });
    }
    getPathToJobber() {
        let spawnRx = path.dirname(require.resolve('spawn-rx/package.json'));
        return path.join(spawnRx, 'vendor', 'jobber', 'jobber.exe');
    }
    installJob(name, command, returnContent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // NB: Because Task Scheduler sucks, we need to find a bunch of obscure
            // information first.
            let sidInfo = JSON.parse(yield spawn_rx_1.spawnPromise('powershell', ['-Command', 'Add-Type -AssemblyName System.DirectoryServices.AccountManagement; [System.DirectoryServices.AccountManagement.UserPrincipal]::Current | ConvertTo-Json']));
            let username, hostname;
            if (sidInfo.UserPrincipalName) {
                let [u, h] = sidInfo.UserPrincipalName.split("@");
                username = u;
                hostname = h;
            }
            else {
                username = sidInfo.SamAccountName;
                hostname = os.hostname().toUpperCase();
            }
            let shimCmdPath = path.join(process.env.LOCALAPPDATA, 'Surf', `${name}.cmd`);
            let xmlOpts = {
                currentDate: (new Date()).toISOString(),
                userSid: sidInfo.Sid.Value,
                workingDirectory: path.resolve('./'),
                jobberDotExe: this.getPathToJobber(),
                shimCmdPath, username, hostname, name
            };
            xmlOpts = Object.keys(xmlOpts).reduce((acc, x) => {
                acc[x] = xmlescape(xmlOpts[x]);
                return acc;
            }, {});
            let cmdOpts = {
                envs: this.getInterestingEnvVars().map((x) => `${x}=${process.env[x]}`),
                command
            };
            if (returnContent) {
                let ret = {};
                ret[`${name}.xml`] = makeTaskSchedulerXml(xmlOpts);
                ret[`${name}.cmd`] = makeTaskSchedulerCmd(cmdOpts);
                return ret;
            }
            mkdirp.sync(path.dirname(shimCmdPath));
            fs.writeFileSync(shimCmdPath, makeTaskSchedulerCmd(cmdOpts), 'utf8');
            let info = temp.openSync();
            fs.writeSync(info.fd, makeTaskSchedulerXml(xmlOpts), 0, 'ucs2');
            fs.closeSync(info.fd);
            d(`About to run schtasks, XML path is ${info.path}`);
            let exitCode = yield runAsAdministrator('schtasks', ['/Create', '/Tn', name, '/Xml', info.path]);
            if (exitCode !== 0) {
                throw new Error(`Failed to run schtasks, exited with ${exitCode}`);
            }
            return `Created new Scheduled Task ${name}, with script ${shimCmdPath}`;
        });
    }
}
exports.default = TaskSchedulerInstaller;
