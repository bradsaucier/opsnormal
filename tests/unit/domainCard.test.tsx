import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DomainCard } from '../../src/components/DomainCard';
import { SECTORS } from '../../src/types';

describe('DomainCard', () => {
  it('renders the fixed sector sigil and points the radiogroup at the shared instruction strip', () => {
    render(
      <>
        <p id="shared-instructions">Shared instructions.</p>
        <DomainCard
          sector={SECTORS[0]}
          sectorSigil="S1"
          instructionId="shared-instructions"
          status="unmarked"
          onSelect={vi.fn().mockResolvedValue(undefined)}
        />
      </>,
    );

    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('WORK')).toBeInTheDocument();
    expect(screen.queryByText('STATE')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('radio').map((radio) => radio.textContent),
    ).toEqual(['NOM', 'DEG', 'NONE']);

    const group = screen.getByRole('radiogroup', {
      name: /work or school status/i,
    });
    expect(group).toHaveAttribute('aria-describedby', 'shared-instructions');
    expect(
      screen.queryByText(
        /Choose a state directly\. Arrow keys move inside the control group\./i,
      ),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['nominal', 'ops-sector-spine-nominal'],
    ['degraded', 'ops-sector-spine-degraded'],
    ['unmarked', 'ops-sector-spine-unmarked'],
  ] as const)(
    'maps %s status to the matching spine treatment',
    (status, expectedClassName) => {
      const { container } = render(
        <DomainCard
          sector={SECTORS[1]}
          sectorSigil="S2"
          status={status}
          onSelect={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      expect(container.querySelector(`.${expectedClassName}`)).not.toBeNull();
    },
  );

  it('keeps roving focus and immediate selection behavior intact', () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);

    render(
      <>
        <p id="shared-instructions">Shared instructions.</p>
        <DomainCard
          sector={SECTORS[2]}
          sectorSigil="S3"
          instructionId="shared-instructions"
          status="unmarked"
          onSelect={onSelect}
        />
      </>,
    );

    const unmarked = screen.getByRole('radio', {
      name: /relationships unmarked/i,
    });
    const nominal = screen.getByRole('radio', {
      name: /relationships nominal/i,
    });

    expect(unmarked).toHaveAttribute('tabindex', '0');
    expect(nominal).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(unmarked, { key: 'ArrowRight' });

    expect(nominal).toHaveFocus();
    expect(nominal).toHaveAttribute('tabindex', '-1');
    expect(onSelect).toHaveBeenCalledWith('relationships', 'nominal');
  });

  it('adds a local busy hint without dropping the shared instruction description', () => {
    render(
      <>
        <p id="shared-instructions">Shared instructions.</p>
        <DomainCard
          sector={SECTORS[3]}
          sectorSigil="S4"
          instructionId="shared-instructions"
          status="nominal"
          busy
          onSelect={vi.fn().mockResolvedValue(undefined)}
        />
      </>,
    );

    const group = screen.getByRole('radiogroup', { name: /body status/i });
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    const descriptionIds = describedBy.split(' ');

    expect(descriptionIds).toContain('shared-instructions');
    expect(descriptionIds).toHaveLength(2);
    expect(screen.getByText('Saving local write. Stand by.')).toHaveClass(
      'sr-only',
    );
  });

  it('keeps focus parked and swallows control keys while busy', () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);

    render(
      <DomainCard
        sector={SECTORS[0]}
        sectorSigil="S1"
        status="unmarked"
        busy
        onSelect={onSelect}
      />,
    );

    const unmarked = screen.getByRole('radio', {
      name: /work or school unmarked/i,
    });
    const nominal = screen.getByRole('radio', {
      name: /work or school nominal/i,
    });

    unmarked.focus();
    fireEvent.keyDown(unmarked, { key: 'ArrowRight' });

    expect(unmarked).toHaveFocus();
    expect(unmarked).toHaveAttribute('tabindex', '0');
    expect(nominal).toHaveAttribute('tabindex', '-1');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
