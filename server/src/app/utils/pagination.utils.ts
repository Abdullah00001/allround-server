import { Request } from 'express';

export interface IPaginationLinks {
  currentPage: string;
  nextPage: string | null;
  previousPage: string | null;
  firstPage: string;
  lastPage: string;
}

export interface IPaginationMeta {
  total: number;
  totalPages: number;
  links: IPaginationLinks;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  message: string;
  meta: IPaginationMeta;
  data: T[];
  traceId: string;
}

export interface IBuildPaginationMetaParams {
  total: number;
  page: number;
  limit: number;
  req: Request;
}

export interface IPaginatedSlice<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Slices an in-memory list for page/limit pagination.
 *
 * @template T
 * @param {T[]} items - Full ordered result set.
 * @param {number} page - 1-based page number.
 * @param {number} limit - Page size.
 * @returns {IPaginatedSlice<T>} Page window plus total count.
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number
): IPaginatedSlice<T> {
  const skip = (page - 1) * limit;
  return {
    items: items.slice(skip, skip + limit),
    total: items.length,
    page,
    limit,
  };
}

/**
 * Builds standard pagination metadata with dynamically resolved page links.
 * Preserves existing query parameters on the request.
 *
 * @param params - { total, page, limit, req }
 * @returns {IPaginationMeta}
 */
export function buildPaginationMeta({
  total,
  page,
  limit,
  req,
}: IBuildPaginationMetaParams): IPaginationMeta {
  const totalPages = Math.ceil(total / limit);
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:5007';
  const pathname = req.baseUrl + req.path;
  const baseUrl = `${protocol}://${host}${pathname}`;

  // Preserve other query parameters
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'page' && key !== 'limit' && typeof value === 'string') {
      queryParams.set(key, value);
    }
  }

  const createPageUrl = (pageNum: number): string => {
    const params = new URLSearchParams(queryParams);
    params.set('page', String(pageNum));
    params.set('limit', String(limit));
    return `${baseUrl}?${params.toString()}`;
  };

  return {
    total,
    totalPages,
    links: {
      currentPage: createPageUrl(page),
      nextPage: page < totalPages ? createPageUrl(page + 1) : null,
      previousPage: page > 1 && page <= totalPages + 1 ? createPageUrl(page - 1) : null,
      firstPage: createPageUrl(1),
      lastPage: createPageUrl(Math.max(totalPages, 1)),
    },
  };
}
