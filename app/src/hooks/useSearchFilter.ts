import { useState, useMemo } from "react";
import { StockVehicle } from "../types";

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function useSearchFilter<T>(
  items: T[],
  stock: StockVehicle[],
  getSearchableFields: (item: T, vehicleNames: Map<string, string>) => string[],
) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = normalizeSearchValue(search.trim());
    if (!query) return items;
    const vehicleNames = new Map(
      stock.map((v) => [v.folder_path, normalizeSearchValue(v.name)]),
    );
    return items.filter((item) =>
      getSearchableFields(item, vehicleNames).some((value) =>
        normalizeSearchValue(value).includes(query),
      ),
    );
  }, [items, stock, search, getSearchableFields]);

  return { search, setSearch, filtered };
}
