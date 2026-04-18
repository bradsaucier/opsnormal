// @vitest-environment node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as { load: (source: string) => unknown };

type WorkflowStep = Record<string, unknown> & {
  if?: unknown;
  run?: unknown;
  uses?: unknown;
  with?: unknown;
};
type WorkflowJob = Record<string, unknown> & {
  name?: unknown;
  needs?: unknown;
  permissions?: unknown;
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

function getNeeds(job: WorkflowJob): string[] {
  if (Array.isArray(job.needs)) {
    return job.needs.filter((need): need is string => typeof need === 'string');
  }

  if (typeof job.needs === 'string') {
    return [job.needs];
  }

  return [];
}

describe('CodeQL merge gate contract', () => {
  const workflow = loadWorkflow('../../.github/workflows/ci.yml');

  it('defines a dedicated codeql job in the mainline integrity workflow', () => {
    const codeqlJob = getJob(workflow, 'codeql');

    expect(codeqlJob.name).toBe('codeql');
  });

  it('requires codeql in the verify aggregator needs list', () => {
    const verifyJob = getJob(workflow, 'verify');
    const needs = new Set(getNeeds(verifyJob));

    expect(needs).toEqual(
      new Set(['verify_matrix', 'webkit_smoke', 'firefox_smoke', 'codeql']),
    );
  });

  it('fails closed when codeql does not succeed', () => {
    const verifyJob = getJob(workflow, 'verify');
    const failureStep = getSteps(verifyJob).find(
      (step) => step.if === "${{ needs.codeql.result != 'success' }}",
    );

    expect(failureStep).toBeDefined();
    expect(failureStep?.run).toContain('exit 1');
  });

  it('pins the codeql job to the expected actions and query configuration', () => {
    const codeqlJob = getJob(workflow, 'codeql');
    const steps = getSteps(codeqlJob);
    const initStep = steps.find(
      (step) =>
        step.uses ===
        'github/codeql-action/init@95e58e9a2cdfd71adc6e0353d5c52f41a045d225',
    );
    const analyzeStep = steps.find(
      (step) =>
        step.uses ===
        'github/codeql-action/analyze@95e58e9a2cdfd71adc6e0353d5c52f41a045d225',
    );

    expect(initStep).toBeDefined();
    expect(analyzeStep).toBeDefined();
    expect(isRecord(initStep?.with) ? initStep.with.packs : undefined).toBe(
      'codeql/javascript-queries@2.3.7',
    );
    expect(isRecord(initStep?.with) ? initStep.with.queries : undefined).toBe(
      'security-extended,security-and-quality',
    );
  });
});
