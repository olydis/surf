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
const path = require("path");
const temp = require("temp");
const job_installer_base_1 = require("../job-installer-base");
const srx = require("spawn-rx");
const d = require('debug')('surf:docker');
// NB: This has to be ../src or else we'll try to get it in ./lib and it'll fail
const makeDockerfile = _.template(fs.readFileSync(require.resolve('../../src/job-installers/docker.in'), 'utf8'));
class DockerInstaller extends job_installer_base_1.JobInstallerBase {
    getName() {
        return 'docker';
    }
    getAffinityForJob(name, command) {
        return __awaiter(this, void 0, void 0, function* () {
            let docker = srx.findActualExecutable('docker', []).cmd;
            if (docker === 'docker') {
                d(`Can't find docker in PATH, assuming not installed`);
                return 0;
            }
            // Let local daemons trump docker
            return 3;
        });
    }
    installJob(name, command, returnContent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let opts = {
                envs: this.getInterestingEnvVars().map((x) => `${x}=${process.env[x]}`),
                pkgJson: require('../../package.json'),
                name, command
            };
            if (returnContent) {
                return { "Dockerfile": makeDockerfile(opts) };
            }
            let dir = temp.mkdirSync('surf');
            let target = path.join(dir, 'Dockerfile');
            fs.writeFileSync(target, makeDockerfile(opts), 'utf8');
            console.error(`Building Docker image, this will take a bit...`);
            yield srx.spawnPromise('docker', ['build', '-t', name, dir]);
            srx.spawnPromiseDetached('docker', ['run', name])
                .catch((e) => console.error(`Failed to execute docker-run! ${e.message}`));
            return `Created new docker image: ${name}
  
To start it: docker run ${name}'`;
        });
    }
}
exports.DockerInstaller = DockerInstaller;
