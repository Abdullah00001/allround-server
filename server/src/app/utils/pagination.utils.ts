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
