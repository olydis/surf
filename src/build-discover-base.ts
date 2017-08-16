export class BuildDiscoverBase {
  constructor(public rootDir) {
  }

  async getAffinityForRootDir(): Promise<number> {
    throw new Error("Implement me!");
  }

  async getBuildCommand(sha): Promise<any> {
    throw new Error("Implement me!");
  }
}
