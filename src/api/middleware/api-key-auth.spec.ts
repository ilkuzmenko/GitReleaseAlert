import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../domain/errors";
import { buildApiKeyMiddleware } from "./api-key-auth";

function makeReq(apiKeyHeader?: string) {
  return { headers: { "x-api-key": apiKeyHeader } } as any;
}

describe("buildApiKeyMiddleware", () => {
  it("passes through when API_KEY is not configured", () => {
    const next = vi.fn();
    buildApiKeyMiddleware("")(makeReq(), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes through when correct key is provided", () => {
    const next = vi.fn();
    buildApiKeyMiddleware("secret")(makeReq("secret"), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next with UnauthorizedError when key is wrong", () => {
    const next = vi.fn();
    buildApiKeyMiddleware("secret")(makeReq("wrong"), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next with UnauthorizedError when header is absent", () => {
    const next = vi.fn();
    buildApiKeyMiddleware("secret")(makeReq(undefined), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
