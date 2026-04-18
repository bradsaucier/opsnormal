// @vitest-environment node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as { load: (source: string) => unknown };

type WorkflowStep = Record<string, unknown> & {
  env?: unknown;
  name?: unknown;
  run?: unknown;
};
type WorkflowJob = Record<string, unknown> & {
  steps?: unknown;
};
type WorkflowDefinition = Record<string, unknown> & {
  jobs?: unknown;
};

function readWorkflow(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadWorkflow(path: string): WorkflowDefinition {
  const workflow = load(readWorkflow(path));

  if (!isRecord(workflow)) {
    throw new Error(`Workflow ${path} did not parse to an object.`);
  }

  return workflow;
}

function getJob(workflow: WorkflowDefinition, jobName: string): WorkflowJob {
  if (!isRecord(workflow.jobs)) {
    throw new Error('Workflow did not define jobs.');
  }

  const job = workflow.jobs[jobName];

  if (!isRecord(job)) {
    throw new Error(`Job ${jobName} was not found in workflow.`);
  }

  return job;
}

function getSteps(job: WorkflowJob): WorkflowStep[] {
  if (!Array.isArray(job.steps)) {
    return [];
  }

  return job.steps.filter((step): step is WorkflowStep => isRecord(step));
}

describe('release CodeQL poll contract', () => {
  const workflow = loadWorkflow('../../.github/workflows/deploy.yml');

  it('targets the commit check-runs API for the release SHA', () => {
    const releaseSmoke = getJob(workflow, 'release_smoke');
    const step = getSteps(releaseSmoke).find(
      (candidate) => candidate.name === 'Await CodeQL verdict for release SHA',
    );

    expect(step).toBeDefined();
    expect(typeof step?.run).toBe('string');
    expect(
      isRecord(step?.env) ? step.env.CODEQL_CHECK_RUN_NAME : undefined,
    ).toBe('codeql');
    expect(step?.run).toContain('/commits/${RELEASE_SHA}/check-runs');
    expect(step?.run).toContain('select(.name == $name)');
    expect(step?.run).not.toContain('workflows/codeql.yml/runs');
    expect(step?.run).toContain('set -euo pipefail');
  });
});
