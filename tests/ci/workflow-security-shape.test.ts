// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as { load: (source: string) => unknown };

type PermissionLevel = 'read' | 'write' | 'none';
type PermissionBlock = Record<string, PermissionLevel>;
type WorkflowStep = {
  env?: unknown;
  name?: unknown;
  run?: unknown;
  uses?: unknown;
  with?: unknown;
};
type WorkflowJob = Record<string, unknown> & {
  permissions?: unknown;
  steps?: unknown;
};
type WorkflowDefinition = Record<string, unknown> & {
  on?: unknown;
  permissions?: unknown;
  jobs?: unknown;
  concurrency?: unknown;
};

const workflowDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../.github/workflows',
);
const workflowFiles = readdirSync(workflowDirectory)
  .filter((fileName) => fileName.endsWith('.yml'))
  .sort();
const zizmorActionPin = /^zizmorcore\/zizmor-action@[0-9a-f]{40}$/;
const contentsWriteAllowlist = new Set<string>();
const contentsWriteJustificationTag =
  '# workflow-security: allow-contents-write';

function readWorkflowText(fileName: string): string {
  return readFileSync(join(workflowDirectory, fileName), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function loadWorkflow(fileName: string): WorkflowDefinition {
  const workflow = load(readWorkflowText(fileName));

  if (!isRecord(workflow)) {
    throw new Error(`Workflow ${fileName} did not parse to an object.`);
  }

  return workflow;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPermissionBlock(value: unknown): PermissionBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, PermissionLevel] => {
      const [, permission] = entry;

      return (
        permission === 'read' || permission === 'write' || permission === 'none'
      );
    },
  );

  return Object.fromEntries(entries);
}

function getJobs(workflow: WorkflowDefinition): Record<string, WorkflowJob> {
  if (!isRecord(workflow.jobs)) {
    throw new Error('Workflow did not define jobs.');
  }

  return Object.fromEntries(
    Object.entries(workflow.jobs).filter(
      (entry): entry is [string, WorkflowJob] => {
        const [, job] = entry;
        return isRecord(job);
      },
    ),
  );
}

function getJob(workflow: WorkflowDefinition, jobName: string): WorkflowJob {
  const job = getJobs(workflow)[jobName];

  if (!job) {
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

function getWriteScopes(permissions: PermissionBlock | null): string[] {
  return Object.entries(permissions ?? {})
    .filter(([, access]) => access === 'write')
    .map(([scope]) => scope)
    .sort();
}

function getReadScopes(permissions: PermissionBlock | null): string[] {
  return Object.entries(permissions ?? {})
    .filter(([, access]) => access === 'read')
    .map(([scope]) => scope)
    .sort();
}

function hasOwnProperty(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function getTrigger(
  workflow: WorkflowDefinition,
  triggerName: string,
): unknown {
  const triggerConfig = workflow.on;

  if (typeof triggerConfig === 'string') {
    return triggerConfig === triggerName ? true : undefined;
  }

  if (Array.isArray(triggerConfig)) {
    return triggerConfig.includes(triggerName) ? true : undefined;
  }

  if (!isRecord(triggerConfig)) {
    return undefined;
  }

  return triggerConfig[triggerName];
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function getJobBlock(workflowText: string, jobName: string): string {
  const jobStart = workflowText.indexOf(`  ${jobName}:\n`);

  if (jobStart === -1) {
    throw new Error(`Job ${jobName} was not found in workflow text.`);
  }

  const remainingWorkflow = workflowText.slice(jobStart + 1);
  const nextJobOffset = remainingWorkflow.search(
    /^(?:\x20){2}[A-Za-z0-9_]+:\n/m,
  );

  if (nextJobOffset === -1) {
    return workflowText.slice(jobStart);
  }

  return workflowText.slice(jobStart, jobStart + 1 + nextJobOffset);
}

function jobHasContentsWriteJustification(
  workflowText: string,
  jobName: string,
): boolean {
  // js-yaml drops comments, so the escape hatch has to be checked on the raw job block.
  return getJobBlock(workflowText, jobName).includes(
    contentsWriteJustificationTag,
  );
}

describe('workflow security contract', () => {
  it('requires persist-credentials: false on every checkout step', () => {
    let checkoutCount = 0;

    for (const workflowFile of workflowFiles) {
      const workflow = loadWorkflow(workflowFile);

      for (const [jobName, job] of Object.entries(getJobs(workflow))) {
        for (const step of getSteps(job)) {
          if (
            typeof step.uses === 'string' &&
            step.uses.startsWith('actions/checkout@')
          ) {
            checkoutCount += 1;

            expect(
              isRecord(step.with)
                ? step.with['persist-credentials']
                : undefined,
              `${workflowFile} job ${jobName} must set persist-credentials: false.`,
            ).toBe(false);
          }
        }
      }
    }

    expect(checkoutCount).toBeGreaterThan(0);
  });

  it('requires a top-level permissions block in every workflow', () => {
    for (const workflowFile of workflowFiles) {
      const workflow = loadWorkflow(workflowFile);

      expect(
        hasOwnProperty(workflow, 'permissions'),
        `${workflowFile} must declare top-level permissions.`,
      ).toBe(true);
      expect(
        getPermissionBlock(workflow.permissions),
        `${workflowFile} permissions must be a mapping.`,
      ).not.toBeNull();
    }
  });

  it('disallows contents: write outside a documented exception path', () => {
    for (const workflowFile of workflowFiles) {
      const workflow = loadWorkflow(workflowFile);
      const workflowText = readWorkflowText(workflowFile);

      for (const [jobName, job] of Object.entries(getJobs(workflow))) {
        const permissions = getPermissionBlock(job.permissions);

        if (permissions?.contents !== 'write') {
          continue;
        }

        expect(
          contentsWriteAllowlist.has(`${workflowFile}:${jobName}`) ||
            jobHasContentsWriteJustification(workflowText, jobName),
          `${workflowFile} job ${jobName} must not request contents: write without a documented exception.`,
        ).toBe(true);
      }
    }
  });

  it('pins workflow-lint to immutable zizmor action refs and workflow triggers', () => {
    const workflow = loadWorkflow('workflow-lint.yml');
    const pullRequestTrigger = getTrigger(workflow, 'pull_request');
    const pushTrigger = getTrigger(workflow, 'push');

    expect(pullRequestTrigger).toBeDefined();
    expect(pushTrigger).toBeDefined();
    expect(isRecord(pullRequestTrigger)).toBe(true);
    expect(isRecord(pushTrigger)).toBe(true);
    expect(
      getStringArray((pullRequestTrigger as Record<string, unknown>).paths),
    ).toContain('.github/**');
    expect(
      getStringArray((pushTrigger as Record<string, unknown>).branches),
    ).toEqual(['main']);
    expect(
      getStringArray((pushTrigger as Record<string, unknown>).paths),
    ).toContain('.github/**');

    const concurrency = workflow.concurrency;
    expect(isRecord(concurrency) ? concurrency.group : undefined).toBe(
      'workflow-lint-${{ github.ref }}',
    );

    const zizmorSteps = getSteps(getJob(workflow, 'zizmor')).filter(
      (step) =>
        typeof step.uses === 'string' &&
        step.uses.startsWith('zizmorcore/zizmor-action@'),
    );

    expect(zizmorSteps).toHaveLength(2);

    for (const step of zizmorSteps) {
      expect(step.uses).toMatch(zizmorActionPin);
      expect(isRecord(step.with) ? step.with.version : undefined).toBe(
        'v1.24.1',
      );
    }

    const blockingStep = zizmorSteps.find(
      (step) =>
        isRecord(step.with) &&
        step.with['advanced-security'] === false &&
        step.with['min-severity'] === 'high',
    );

    expect(blockingStep).toBeDefined();
  });

  it('keeps ci attestation permissions to the required scopes', () => {
    const workflow = loadWorkflow('ci.yml');
    const permissions = getPermissionBlock(
      getJob(workflow, 'verify_matrix').permissions,
    );

    expect(getReadScopes(permissions)).toEqual(['contents']);
    expect(getWriteScopes(permissions)).toEqual(['attestations', 'id-token']);
  });

  it('keeps deploy workflow jobs on least-privilege scopes', () => {
    const workflow = loadWorkflow('deploy.yml');
    const releaseSmokePermissions = getPermissionBlock(
      getJob(workflow, 'release_smoke').permissions,
    );
    const deployPermissions = getPermissionBlock(
      getJob(workflow, 'deploy').permissions,
    );

    expect(getReadScopes(releaseSmokePermissions)).toEqual([
      'actions',
      'attestations',
      'contents',
    ]);
    expect(getWriteScopes(releaseSmokePermissions)).toEqual([]);

    expect(getReadScopes(deployPermissions)).toEqual([
      'actions',
      'attestations',
      'contents',
    ]);
    expect(getWriteScopes(deployPermissions)).toEqual(['id-token', 'pages']);
  });

  it('keeps codeql write access scoped to security-events only', () => {
    const ciWorkflow = loadWorkflow('ci.yml');
    const scheduledWorkflow = loadWorkflow('codeql.yml');
    const ciPermissions = getPermissionBlock(
      getJob(ciWorkflow, 'codeql').permissions,
    );
    const scheduledPermissions = getPermissionBlock(
      getJob(scheduledWorkflow, 'analyze').permissions,
    );

    expect(getReadScopes(ciPermissions)).toEqual(['contents']);
    expect(getWriteScopes(ciPermissions)).toEqual(['security-events']);
    expect(getReadScopes(scheduledPermissions)).toEqual(['contents']);
    expect(getWriteScopes(scheduledPermissions)).toEqual(['security-events']);
  });

  it('gates Pages release on CodeQL verdict for the release SHA', () => {
    const workflow = loadWorkflow('deploy.yml');
    const workflowText = readWorkflowText('deploy.yml');
    const releaseSmokeSteps = getSteps(getJob(workflow, 'release_smoke'));
    const deployJob = getJob(workflow, 'deploy');
    const gateStep = releaseSmokeSteps.find(
      (step) => typeof step.name === 'string' && /codeql/i.test(step.name),
    );
    const deployNeeds = Array.isArray(deployJob.needs)
      ? deployJob.needs.filter(
          (need): need is string => typeof need === 'string',
        )
      : typeof deployJob.needs === 'string'
        ? [deployJob.needs]
        : [];

    expect(
      gateStep,
      'deploy.yml release_smoke must include a step that awaits CodeQL on the release SHA.',
    ).toBeDefined();
    expect(
      releaseSmokeSteps[0]?.name,
      'deploy.yml must check CodeQL before any release-smoke work begins.',
    ).toBe('Await CodeQL verdict for release SHA');
    expect(
      workflowText.includes('github.event.workflow_run.head_sha'),
      'deploy.yml CodeQL gate must filter on the release SHA, not a branch.',
    ).toBe(true);
    expect(
      typeof gateStep?.run === 'string' &&
        gateStep.run.includes('/commits/${RELEASE_SHA}/check-runs'),
      'deploy.yml CodeQL gate must poll the commit check-runs API.',
    ).toBe(true);
    expect(
      typeof gateStep?.run === 'string' &&
        !gateStep.run.includes(
          '/actions/workflows/${CODEQL_WORKFLOW_FILE}/runs',
        ),
      'deploy.yml CodeQL gate must not keep the legacy workflow-runs selector.',
    ).toBe(true);
    expect(
      deployNeeds,
      'deploy must remain blocked on release_smoke success.',
    ).toContain('release_smoke');
  });

  it('keeps CodeQL analysis on pinned query packs', () => {
    const workflow = loadWorkflow('codeql.yml');
    const analyzeSteps = getSteps(getJob(workflow, 'analyze'));
    const initStep = analyzeSteps.find(
      (step) =>
        typeof step.uses === 'string' &&
        step.uses.startsWith('github/codeql-action/init@'),
    );

    expect(initStep).toBeDefined();

    const initWith = isRecord(initStep?.with) ? initStep.with : undefined;
    const packs = initWith?.packs;

    expect(
      typeof packs === 'string' && packs.includes('@'),
      'codeql.yml must pin query packs with an @version reference.',
    ).toBe(true);
    expect(initWith?.queries).toBe('security-extended,security-and-quality');
  });
});
