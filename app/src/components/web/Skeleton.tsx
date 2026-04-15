/** Skeleton placeholder for loading states. Renders animated shimmer bars. */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-lg" />
      <div className="skeleton-line skeleton-sm" />
      <div className="skeleton-line skeleton-md" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton-line skeleton-md" />
          <div className="skeleton-line skeleton-sm" />
          <div className="skeleton-line skeleton-xs" />
        </div>
      ))}
    </div>
  );
}
