export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function errorPayload(error: unknown) {
  return error instanceof ApiError
    ? { code: error.code, message: error.message }
    : { code: "INTERNAL_ERROR", message: "The server could not complete the request." };
}
