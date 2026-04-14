import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AlertSurface } from '../../src/components/AlertSurface';
import { getAlertSurfaceActionToneClass } from '../../src/components/alertSurfaceTone';

describe('AlertSurface', () => {
  it('wires the heading into aria-labelledby when no explicit label is provided', () => {
    render(
      <AlertSurface
        tone="attention"
        title="Database Upgrade Blocked"
        description="Close other tabs before retrying the upgrade."
        role="alert"
      />,
    );

    const alert = screen.getByRole('alert');
    const heading = screen.getByRole('heading', {
      name: 'Database Upgrade Blocked',
    });

    expect(alert).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('preserves an explicit aria-labelledby contract from the consumer', () => {
    render(
      <AlertSurface
        tone="info"
        title="Offline Ready"
        aria-labelledby="external-label"
      />,
    );

    const surface = screen
      .getByRole('heading', { name: 'Offline Ready' })
      .closest('section');

    expect(surface).toHaveAttribute('aria-labelledby', 'external-label');
  });

  it('does not assign a role when the consumer does not request one', () => {
    render(<AlertSurface tone="success" title="Install the app" />);

    const surface = screen
      .getByRole('heading', { name: 'Install the app' })
      .closest('section');

    expect(surface).not.toHaveAttribute('role');
  });

  it('maps the warning tone to the orange action-button treatment', () => {
    expect(getAlertSurfaceActionToneClass('warning')).toContain(
      'ops-action-button-orange',
    );
  });

  it('keeps success and neutral tones distinct in the shared action treatment', () => {
    expect(getAlertSurfaceActionToneClass('success')).toContain(
      'ops-action-button-success',
    );
    expect(getAlertSurfaceActionToneClass('neutral')).toContain(
      'ops-action-button-neutral',
    );
  });
});
