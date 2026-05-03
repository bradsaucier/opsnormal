import { GitHubMark } from './icons/GitHubMark';

const REPO_URL = 'https://github.com/bradsaucier/opsnormal';

export function FooterProvenance() {
  return (
    <div
      className="ops-provenance flex flex-col gap-3 sm:w-full sm:max-w-sm sm:self-end"
      data-testid="footer-provenance"
    >
      <dl className="ops-provenance-facts lg:text-right">
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
