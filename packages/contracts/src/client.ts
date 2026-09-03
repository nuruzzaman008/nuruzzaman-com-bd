import type { paths } from './generated/api';

/** The shared error envelope every endpoint uses. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    request_id?: string;
  };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string[]> = {},
    readonly requestId?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
  }

  /**
   * The request never reached the API: the server is down, the network is out,
   * or the request was blocked. Status is 0 because there was no response.
   *
   * Worth separating from every other failure, because the honest message for a
   * visitor is completely different: nothing they typed was wrong.
   */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** True when the caller should send the visitor to sign in. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  /** The first message for a field, for rendering next to an input. */
  fieldError(field: string): string | undefined {
    return this.fields[field]?.[0];
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Next.js fetch cache options. Ignored in the browser. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
  /** Makes a payment-sensitive mutation safe to retry. */
  idempotencyKey?: string;
};

export type ClientConfig = {
  /**
   * Where requests go. In the browser this is the same origin (`/api/v1`);
   * on the server it is the internal Laravel URL, so a Server Component never
   * takes a public network hop to reach its own backend.
   */
  baseUrl: string;
  /** Extra headers per request, e.g. forwarding cookies from a Server Component. */
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  fetchImpl?: typeof fetch;
};

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;

  if (!query) {
    return url;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();

  return qs ? `${url}?${qs}` : url;
}

export function createClient(config: ClientConfig) {
  const doFetch = config.fetchImpl ?? fetch;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, headers = {}, signal, next, cache, idempotencyKey } = options;

    const resolved: Record<string, string> = {
      Accept: 'application/json',
      ...(await (config.getHeaders?.() ?? {})),
      ...headers,
    };

    if (body !== undefined && !(body instanceof FormData)) {
      resolved['Content-Type'] = 'application/json';
    }

    if (idempotencyKey) {
      resolved['Idempotency-Key'] = idempotencyKey;
    }

    let response: Response;

    try {
      response = await doFetch(buildUrl(config.baseUrl, path, query), {
        method,
        headers: resolved,
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        // The session is a cookie, so every request must carry credentials.
        credentials: 'include',
        signal,
        cache,
        ...(next ? { next } : {}),
      } as RequestInit);
    } catch (cause) {
      // An aborted request is the caller's own doing, not a failure to reach the
      // API, so it is passed through untouched.
      if ((cause as Error | undefined)?.name === 'AbortError') {
        throw cause;
      }

      // fetch rejects with a bare TypeError when it cannot reach the server, and
      // a caller cannot tell that apart from a bug. Wrapping it means the UI can
      // say "we could not reach the server" instead of implying the request was
      // rejected — which reads, wrongly, as "your details are wrong".
      throw new ApiError(0, 'network_error', 'Could not reach the API.', {}, undefined, {
        cause,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : undefined;

    if (!response.ok) {
      const envelope = payload as ApiErrorBody | undefined;

      throw new ApiError(
        response.status,
        envelope?.error?.code ?? 'request_failed',
        envelope?.error?.message ?? `Request failed with status ${response.status}`,
        envelope?.error?.fields ?? {},
        envelope?.error?.request_id,
      );
    }

    return payload as T;
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createClient>;

/**
 * Convenience aliases for the response shapes the frontend uses most. They are
 * projected out of the generated `paths` type, so renaming a field in
 * openapi.yaml breaks compilation here rather than at runtime.
 */
type Json<T> = T extends { content: { 'application/json': infer C } } ? C : never;

export type SiteSettings = Json<paths['/site/settings']['get']['responses']['200']>['data'];
export type SitemapFeed = Json<paths['/site/sitemap']['get']['responses']['200']>['data'];
export type Redirect = Json<paths['/site/redirects']['get']['responses']['200']>['data'][number];
export type SearchResults = Json<paths['/search']['get']['responses']['200']>['data'];

export type PostSummary = Json<paths['/posts']['get']['responses']['200']>['data'][number];
export type Post = Json<paths['/posts/{slug}']['get']['responses']['200']>['data'];
export type Page = Json<paths['/pages/{slug}']['get']['responses']['200']>['data'];
export type Category = Json<paths['/categories']['get']['responses']['200']>['data'][number];
export type Author = Json<paths['/authors/{slug}']['get']['responses']['200']>['data'];

export type ProductSummary = Json<paths['/products']['get']['responses']['200']>['data'][number];
export type Product = Json<paths['/products/{slug}']['get']['responses']['200']>['data'];
export type ProductVariant = NonNullable<Product['variants']>[number];
export type DownloadAsset = Json<paths['/releases']['get']['responses']['200']>['data'][number];

export type CourseSummary = Json<paths['/courses']['get']['responses']['200']>['data'][number];
export type Course = Json<paths['/courses/{slug}']['get']['responses']['200']>['data'];
export type Lesson = Json<
  paths['/courses/{courseSlug}/preview/{lessonSlug}']['get']['responses']['200']
>['data'];
export type CourseOutline = Json<
  paths['/learn/{courseSlug}/outline']['get']['responses']['200']
>['data'];
export type Gradebook = Json<
  paths['/learn/{courseSlug}/gradebook']['get']['responses']['200']
>['data'];
export type CourseAnnouncement = Json<
  paths['/learn/{courseSlug}/announcements']['get']['responses']['200']
>['data'][number];
export type CourseQuestion = Json<
  paths['/learn/{courseSlug}/questions']['get']['responses']['200']
>['data'][number];
export type LessonNote = Json<
  paths['/learn/{courseSlug}/notes']['get']['responses']['200']
>['data'][number];
export type Quiz = Json<paths['/quizzes/{quizId}']['get']['responses']['200']>['data'];
export type QuizResult = Json<
  paths['/quiz-attempts/{attemptId}/submit']['post']['responses']['200']
>['data'];
export type Assignment = Json<
  paths['/assignments/{assignmentId}']['get']['responses']['200']
>['data'];

export type Cart = Json<paths['/cart']['get']['responses']['200']>['data'];
export type CartLine = Cart['lines'][number];
export type CheckoutResult = Json<paths['/checkout']['post']['responses']['201']>['data'];
export type PaymentStatus = Json<
  paths['/payments/{reference}/status']['get']['responses']['200']
>['data'];

export type User = Json<paths['/me']['get']['responses']['200']>['data'];
export type Order = Json<paths['/account/orders/{number}']['get']['responses']['200']>['data'];
export type Enrollment = Json<paths['/account/courses']['get']['responses']['200']>['data'][number];
export type DownloadEntitlement = Json<
  paths['/account/downloads']['get']['responses']['200']
>['data'][number];
export type ActivationRequest = Json<
  paths['/account/activation-requests/{reference}']['get']['responses']['200']
>['data'];
export type SoftwareLicense = Json<
  paths['/account/licenses']['get']['responses']['200']
>['data'][number];
export type Certificate = Json<
  paths['/account/certificates']['get']['responses']['200']
>['data'][number];
export type SupportTicket = Json<
  paths['/account/support-tickets/{reference}']['get']['responses']['200']
>['data'];

export type AdminDashboard = Json<paths['/admin/dashboard']['get']['responses']['200']>['data'];
export type MediaItem = Json<paths['/admin/media']['get']['responses']['200']>['data'][number];
export type Setting = Json<paths['/admin/settings']['get']['responses']['200']>['data'][number];
export type AuditLogEntry = Json<
  paths['/admin/audit-logs']['get']['responses']['200']
>['data'][number];

/** Paginated list envelope used by index endpoints. */
export type Paginated<T> = {
  data: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

export type Envelope<T> = { data: T };
