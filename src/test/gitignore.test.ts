import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("credential exclusions", () => {
  it.each([
    ".env",
    ".env.production",
    "nested/.env.test",
    ".dev.vars.preview",
    "credentials.json",
    "nested/service-account-test.json",
    "secrets/token.txt",
    "credentials/password.txt",
    "private.pem",
    "private.key",
    "private.p12",
    "private.pfx",
    "vault.kdbx",
    ".npmrc",
    ".aws/credentials",
  ])("ignores %s without writing a credential file", (path) => {
    expect(
      execFileSync("git", ["check-ignore", "--no-index", path], { encoding: "utf8" }).trim(),
    ).toBe(path);
  });
  it("keeps application configuration and tests trackable", () => {
    const output = execFileSync(
      "git",
      ["check-ignore", "--no-index", "--non-matching", "--verbose", "--stdin"],
      {
        input: "package.json\nvitest.config.ts\nsrc/test/app-routing.test.tsx\n.env\n",
        encoding: "utf8",
      },
    );
    const lines = output.trim().split("\n");
    expect(lines.slice(0, 3).every((line) => line.startsWith("::\t"))).toBe(true);
  });
});
