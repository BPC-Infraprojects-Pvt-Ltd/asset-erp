import { isAxiosError } from "axios";

export function authErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return "The request could not be completed. Try again.";
  }

  const body: unknown = error.response?.data;
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }
  }
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = body.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  if (error.response?.status === 401) {
    return "The organization, email, or password is not valid.";
  }
  return "The service could not complete the request. Try again.";
}
