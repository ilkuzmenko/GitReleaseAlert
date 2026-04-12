import {Metadata, status} from "@grpc/grpc-js";

export function checkApiKey(apiKey: string, metadata: Metadata): void {
  if (!apiKey) return;

  const values = metadata.get("x-api-key");
  if (!values.length || values[0] !== apiKey) {
    throw Object.assign(new Error("Invalid or missing API key"), {code: status.UNAUTHENTICATED});
  }
}
