import * as path from 'path';
import { statNoException } from '../promise-array';
import { BuildDiscoverBase } from '../build-discover-base';

const d = require('debug')('surf:build-discover-rust');

export default class RustBuildDiscoverer extends BuildDiscoverBase {
  constructor(rootDir) {
    super(rootDir);
  }

  async getAffinityForRootDir() {
    let cargo = path.join(this.rootDir, 'Cargo.toml');
    let exists = await statNoException(cargo);

    if (exists) { d(`Found Cargo.toml at ${cargo}`); }
    return exists ? 5 : 0;
  }

  async getBuildCommand() {
    process.env.RUST_BACKTRACE = "1";
    return { cmd: 'cargo', args: ['test', '-v'] };
  }
}
