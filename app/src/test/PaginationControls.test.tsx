import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaginationControls } from '../components/web/PaginationControls'

describe('PaginationControls', () => {
  it('returns null when totalPages <= 1', () => {
    const { container } = render(<PaginationControls page={0} totalPages={1} setPage={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders page info', () => {
    render(<PaginationControls page={0} totalPages={3} setPage={vi.fn()} />);
    expect(screen.getByText('Pagina 1 de 3')).toBeInTheDocument();
  });

  it('disables Anterior on first page', () => {
    render(<PaginationControls page={0} totalPages={3} setPage={vi.fn()} />);
    expect(screen.getByText('Anterior')).toBeDisabled();
  });

  it('disables Siguiente on last page', () => {
    render(<PaginationControls page={2} totalPages={3} setPage={vi.fn()} />);
    expect(screen.getByText('Siguiente')).toBeDisabled();
  });

  it('calls setPage with page-1 on Anterior click', () => {
    const setPage = vi.fn();
    render(<PaginationControls page={1} totalPages={3} setPage={setPage} />);
    fireEvent.click(screen.getByText('Anterior'));
    expect(setPage).toHaveBeenCalledWith(0);
  });

  it('calls setPage with page+1 on Siguiente click', () => {
    const setPage = vi.fn();
    render(<PaginationControls page={1} totalPages={3} setPage={setPage} />);
    fireEvent.click(screen.getByText('Siguiente'));
    expect(setPage).toHaveBeenCalledWith(2);
  });
});
