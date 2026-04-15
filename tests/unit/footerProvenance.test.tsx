import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FooterProvenance } from '../../src/components/FooterProvenance';

describe('FooterProvenance', () => {
  it('renders build, license, and source link with safe new-tab semantics', () => {
    render(<FooterProvenance />);

    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('License')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();

    const link = screen.getByTestId('footer-provenance-source');
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/bradsaucier/opsnormal',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
    expect(link.getAttribute('rel') ?? '').toContain('noreferrer');
    expect(link).toHaveAccessibleName(/source on github/i);
  });
});
