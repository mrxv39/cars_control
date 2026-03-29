import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / pageSize);
  const paged = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  );

  // Reset page when items change (e.g. new search filter)
  const [prevLength, setPrevLength] = useState(items.length);
  if (items.length !== prevLength) {
    setPrevLength(items.length);
    if (page !== 0) setPage(0);
  }

  return { paged, page, totalPages, setPage };
}
