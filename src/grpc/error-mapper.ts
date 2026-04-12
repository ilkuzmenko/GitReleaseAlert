import { status } from "@grpc/grpc-js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../domain/errors";

export function toGrpcStatus(error: unknown): { code: number; message: string } {
  if (error instanceof ValidationError) {
    return { code: status.INVALID_ARGUMENT, message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { code: status.NOT_FOUND, message: error.message };
  }
  if (error instanceof UnauthorizedError) {
    return { code: status.UNAUTHENTICATED, message: error.message };
  }
  return { code: status.INTERNAL, message: "Internal server error" };
}
