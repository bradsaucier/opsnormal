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

describe('build provenance workflow contract', () => {
  const ciWorkflow = readWorkflow('../../.github/workflows/ci.yml');
  const deployWorkflow = readWorkflow('../../.github/workflows/deploy.yml');

  it('attests the uploaded dist-ci-verified artifact digest in verify_matrix', () => {
    const verifyMatrix = getJobBlock(ciWorkflow, 'verify_matrix');

    expect(verifyMatrix).toContain('id-token: write');
    expect(verifyMatrix).toContain('attestations: write');
    expect(verifyMatrix).toContain('id: upload_dist');
    expect(verifyMatrix).toContain(
      'uses: actions/attest-build-provenance@a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32 # v4.1.0',
    );
    expect(verifyMatrix).toContain(
      'subject-digest: sha256:${{ steps.upload_dist.outputs.artifact-digest }}',
    );

    expectOrdered(verifyMatrix, [
      'name: Upload CI-verified production artifact',
      'name: Attest build provenance',
      'name: Install Playwright browsers',
    ]);
  });

  it('verifies provenance before release smoke uses the artifact', () => {
    const releaseSmoke = getJobBlock(deployWorkflow, 'release_smoke');

    expect(releaseSmoke).toContain('attestations: read');
    expect(releaseSmoke).toContain(
      'gh attestation verify dist-ci-verified.zip',
    );
    expect(releaseSmoke).toContain(
      '--signer-workflow ${{ github.repository }}/.github/workflows/ci.yml',
    );
    expect(releaseSmoke).toContain(
      '--source-digest ${{ github.event.workflow_run.head_sha }}',
    );
    expect(releaseSmoke).toContain('--source-ref refs/heads/main');

    expectOrdered(releaseSmoke, [
      'name: Resolve CI-verified production artifact metadata',
      'name: Download CI-verified production artifact archive',
      'name: Verify build provenance',
      'name: Extract CI-verified production artifact',
      'name: Run Chromium smoke against CI artifact',
    ]);
  });

  it('verifies provenance before the deploy job uploads Pages', () => {
    const deployJob = getJobBlock(deployWorkflow, 'deploy');

    expect(deployJob).toContain('attestations: read');
    expect(deployJob).toContain('gh attestation verify dist-ci-verified.zip');
    expect(deployJob).toContain(
      '--signer-workflow ${{ github.repository }}/.github/workflows/ci.yml',
    );
    expect(deployJob).toContain(
      '--source-digest ${{ github.event.workflow_run.head_sha }}',
    );
    expect(deployJob).toContain('--source-ref refs/heads/main');

    expectOrdered(deployJob, [
      'name: Resolve CI-verified production artifact metadata',
      'name: Download CI-verified production artifact archive',
      'name: Verify build provenance',
      'name: Extract CI-verified production artifact',
      'name: Upload Pages artifact',
    ]);
  });
});
