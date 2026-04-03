import { reloadCurrentPage } from './runtime';

export function renderBootFailureFallback(rootElement: HTMLElement): void {
  const shell = document.createElement('div');
  shell.className = 'ops-boot-fallback-shell';
  shell.setAttribute('role', 'alert');

  const container = document.createElement('div');
  container.className = 'ops-boot-fallback-container';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'ops-boot-fallback-eyebrow';
  eyebrow.textContent = 'Boot failure';

  const title = document.createElement('h1');
  title.className = 'ops-boot-fallback-title';
  title.textContent = 'OpsNormal failed to start';

  const copy = document.createElement('p');
  copy.className = 'ops-boot-fallback-copy';
  copy.textContent =
    'Your data may still exist in local storage. Try reloading. If this persists, clear site data through browser settings after exporting.';

  const actions = document.createElement('div');
  actions.className = 'ops-boot-fallback-actions';

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.className = 'ops-boot-fallback-button';
  reloadButton.textContent = 'Reload';
  reloadButton.addEventListener('click', reloadCurrentPage);

  actions.append(reloadButton);
  container.append(eyebrow, title, copy, actions);
  shell.append(container);

  rootElement.replaceChildren(shell);
}
