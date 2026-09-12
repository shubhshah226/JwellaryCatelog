export interface ApiResponse<T = unknown> {
  exceptions: string | null;
  data?: T;
  status: number;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}
