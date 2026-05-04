import { GitHubMark } from './icons/GitHubMark';

const REPO_URL = 'https://github.com/bradsaucier/opsnormal';

export function FooterProvenance() {
  return (
    <div
      className="ops-provenance grid gap-3 sm:w-full sm:self-end lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-8"
      data-testid="footer-provenance"
    >
      <p className="ops-eyebrow-strong font-semibold text-ops-text-primary">
        Provenance
      </p>
      <dl className="ops-provenance-facts">
        <div>
          <dt>Build</dt>
          <dd className="text-ops-text-primary [font-variant-numeric:tabular-nums]">
            v{__APP_VERSION__}
          </dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>MIT</dd>
        </div>
      </dl>
      <a
        className="ops-action-button ops-action-button-subtle ops-provenance-source"
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View OpsNormal source on GitHub. Opens in a new tab."
        data-testid="footer-provenance-source"
      >
        <GitHubMark />
        <span>Source</span>
      </a>
    </div>
  );
}
