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
const promise_array_1 = require("./promise-array");
const d = require('debug')('surf:job-installer-api');
function createJobInstallers() {
    let discoverClasses = fs.readdirSync(path.join(__dirname, 'job-installers'));
    return discoverClasses.filter((x) => x.match(/\.js$/i)).map((x) => {
        const Klass = require(path.join(__dirname, 'job-installers', x)).default;
        d(`Found job installer: ${Klass.name}`);
        return new Klass();
    });
}
exports.createJobInstallers = createJobInstallers;
function getDefaultJobInstallerForPlatform(name, command) {
    return __awaiter(this, void 0, void 0, function* () {
        let ret = (yield promise_array_1.asyncReduce(createJobInstallers(), (acc, installer) => __awaiter(this, void 0, void 0, function* () {
            let affinity = yield installer.getAffinityForJob(name, command);
            if (affinity < 1)
                return acc;
            if (!acc)
                return { affinity, installer };
            return acc.affinity >= affinity ? acc : { affinity, installer };
        }), null));
        let installer = ret ? ret.installer : null;
        if (!installer) {
            let names = createJobInstallers().map((x) => x.getName());
            throw new Error(`Can't find a compatible job installer for your platform - available types are - ${names.join(', ')}`);
        }
        return installer;
    });
}
exports.getDefaultJobInstallerForPlatform = getDefaultJobInstallerForPlatform;
function installJob(name, command, returnContent = false, explicitType = null, extraEnvVars = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let installer = null;
        if (explicitType) {
            installer = createJobInstallers().find((x) => x.getName() == explicitType);
            if (!installer) {
                let names = createJobInstallers().map((x) => x.getName());
                throw new Error(`Couldn't find job installer with name ${explicitType} - available types are ${names.join(', ')}`);
            }
        }
        else {
            installer = yield getDefaultJobInstallerForPlatform(name, command);
        }
        if (extraEnvVars)
            installer.setExtraEnvVars(extraEnvVars);
        return yield installer.installJob(name, command, returnContent);
    });
}
exports.installJob = installJob;
