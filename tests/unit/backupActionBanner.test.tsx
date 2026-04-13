import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BackupActionBanner } from '../../src/features/export/BackupActionBanner';

describe('BackupActionBanner', () => {
  it('does not render when no prompt is active', () => {
    const { container } = render(<BackupActionBanner prompt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title, detail, and backup action link as an accessible alert', () => {
    render(
      <BackupActionBanner
        prompt={{
          tone: 'warning',
          title: 'No external JSON backup recorded',
          detail: 'Create one now before relying on local-only data.',
        }}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'No external JSON backup recorded' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open backup and recovery' }),
    ).toHaveAttribute('href', '#backup-and-recovery');
  });
});
