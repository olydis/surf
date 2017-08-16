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
const job_installer_api_1 = require("./job-installer-api");
function main(argv, showHelp) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!argv.n || !argv.c) {
            console.error("You must specify both name and command");
            showHelp();
            process.exit(-1);
        }
        let extraEnvs = argv.environment ? argv.environment.split(',') : null;
        let result = yield job_installer_api_1.installJob(argv.name, argv.command, argv['dry-run'], argv.type, extraEnvs);
        if (!argv['dry-run']) {
            console.log(result);
            return;
        }
        if (Object.keys(result).length < 2) {
            for (let file in result) {
                console.log(result[file]);
            }
        }
        else {
            for (let file in result) {
                console.log(`${file}:\n`);
                console.log(result[file]);
            }
        }
    });
}
exports.main = main;
