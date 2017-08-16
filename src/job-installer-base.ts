const interestingEnvVars = [
  /^GITHUB_TOKEN$/,
  /^GIST_TOKEN$/,
  /^GITHUB_ENTERPRISE_URL$/,
  /^GIST_ENTERPRISE_URL$/,
  /^SURF_/,
  /^PATH$/
];

export class JobInstallerBase {
  private extraEnvVars: any;

  constructor() {
  }

  getInterestingEnvVars() {
    return Object.keys(process.env)
      .filter((x) => interestingEnvVars.find((re) => x.match(re) as any))
      .concat(this.extraEnvVars || []);
  }

  setExtraEnvVars(vars) {
    this.extraEnvVars = vars;
  }

  getName(): string {
    throw new Error("Implement me!");
  }

  async getAffinityForJob(name, command): Promise<number> {
    throw new Error("Implement me!");
  }

  async installJob(name, command, returnContent = false): Promise<any> {
    throw new Error("Implement me!");
  }
}
