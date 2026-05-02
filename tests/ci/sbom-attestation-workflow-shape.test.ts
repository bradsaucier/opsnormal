// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readWorkflow(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function getJobBlock(workflow: string, jobName: string): string {
  const jobStart = workflow.indexOf(`  ${jobName}:\n`);

  if (jobStart === -1) {
    throw new Error(`Job ${jobName} was not found in workflow.`);
  }

  const remainingWorkflow = workflow.slice(jobStart + 1);
  const nextJobOffset = remainingWorkflow.search(
    /^(?:\x20){2}[A-Za-z0-9_]+:\n/m,
  );

  if (nextJobOffset === -1) {
    return workflow.slice(jobStart);
  }

  return workflow.slice(jobStart, jobStart + 1 + nextJobOffset);
}

function expectOrdered(block: string, markers: string[]): void {
  let previousIndex = -1;

  for (const marker of markers) {
    const currentIndex = block.indexOf(marker);

    expect(
      currentIndex,
      `Expected marker "${marker}" in workflow block.`,
    ).toBeGreaterThan(-1);
    expect(
      currentIndex,
      `Expected marker "${marker}" to appear after the previous workflow marker.`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }
}

describe('release SBOM attestation workflow contract', () => {
  const ciWorkflow = readWorkflow('../../.github/workflows/ci.yml');
  const deployWorkflow = readWorkflow('../../.github/workflows/deploy.yml');

  it('generates and attests an SPDX SBOM for the uploaded release artifact digest', () => {
    const verifyMatrix = getJobBlock(ciWorkflow, 'verify_matrix');

    expect(verifyMatrix).toContain(
      'uses: anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610 # v0.24.0',
    );
    expect(verifyMatrix).toContain('format: spdx-json');
    expect(verifyMatrix).toContain('output-file: dist-ci-verified.spdx.json');
    expect(verifyMatrix).toContain('artifact-name: dist-ci-verified-sbom');
    expect(verifyMatrix).toContain('upload-artifact-retention: 7');
    expect(verifyMatrix).toContain('upload-release-assets: false');
    expect(verifyMatrix).toContain(
      'uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0',
    );
    expect(verifyMatrix).toContain('subject-name: dist-ci-verified.zip');
    expect(verifyMatrix).toContain(
      'subject-digest: sha256:${{ steps.upload_dist.outputs.artifact-digest }}',
    );
    expect(verifyMatrix).toContain('sbom-path: dist-ci-verified.spdx.json');

    expectOrdered(verifyMatrix, [
      'name: Upload CI-verified production artifact',
      'name: Attest build provenance',
      'name: Generate release SBOM',
      'name: Attest release SBOM',
      'name: Install Playwright browsers',
    ]);
  });

  it('verifies the SBOM attestation before release smoke uses the artifact', () => {
    const releaseSmoke = getJobBlock(deployWorkflow, 'release_smoke');

    expect(releaseSmoke).toContain('name: Verify SBOM attestation');
    expect(releaseSmoke).toContain(
      '--predicate-type https://spdx.dev/Document/v2.3',
    );
    expect(releaseSmoke).toContain(
      '--signer-workflow "${REPOSITORY}/.github/workflows/ci.yml"',
    );
    expect(releaseSmoke).toContain('--source-digest "${SOURCE_DIGEST}"');
    expect(releaseSmoke).toContain('--source-ref refs/heads/main');

    expectOrdered(releaseSmoke, [
      'name: Verify build provenance',
      'name: Verify SBOM attestation',
      'name: Extract CI-verified production artifact',
      'name: Run Chromium smoke against CI artifact',
    ]);
  });

  it('verifies the SBOM attestation before deploy uploads Pages', () => {
    const deployJob = getJobBlock(deployWorkflow, 'deploy');

    expect(deployJob).toContain('name: Verify SBOM attestation');
    expect(deployJob).toContain(
      '--predicate-type https://spdx.dev/Document/v2.3',
    );
    expect(deployJob).toContain(
      '--signer-workflow "${REPOSITORY}/.github/workflows/ci.yml"',
    );
    expect(deployJob).toContain('--source-digest "${SOURCE_DIGEST}"');
    expect(deployJob).toContain('--source-ref refs/heads/main');

    expectOrdered(deployJob, [
      'name: Verify build provenance',
      'name: Verify SBOM attestation',
      'name: Extract CI-verified production artifact',
      'name: Upload Pages artifact',
    ]);
  });
});
