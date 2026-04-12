import { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import { SubscriptionService } from "../../domain/subscriptions/subscription-service";
import { toGrpcStatus } from "../error-mapper";
import { checkApiKey } from "../interceptors/auth";

type CreateRequest = { email: string; repository: string };
type DeactivateRequest = { id: number };
type SubscriptionResponse = { id: number; email: string; repository: string; is_active: boolean; created_at: string };
type ListResponse = { subscriptions: SubscriptionResponse[] };

export function makeSubscriptionHandlers(service: SubscriptionService, apiKey: string) {
  function createSubscription(
    call: ServerUnaryCall<CreateRequest, SubscriptionResponse>,
    callback: sendUnaryData<SubscriptionResponse>
  ): void {
    try {
      checkApiKey(apiKey, call.metadata);
    } catch (err) {
      callback(err as Error);
      return;
    }

    service
      .createSubscription({ email: call.request.email, repository: call.request.repository })
      .then((sub) => {
        callback(null, {
          id: sub.id,
          email: sub.email,
          repository: sub.repository,
          is_active: sub.isActive,
          created_at: sub.createdAt
        });
      })
      .catch((err) => {
        const { code, message } = toGrpcStatus(err);
        callback(Object.assign(new Error(message), { code }));
      });
  }

  function listSubscriptions(
    call: ServerUnaryCall<Record<string, never>, ListResponse>,
    callback: sendUnaryData<ListResponse>
  ): void {
    try {
      checkApiKey(apiKey, call.metadata);
    } catch (err) {
      callback(err as Error);
      return;
    }

    service
      .listSubscriptions()
      .then((subs) => {
        callback(null, {
          subscriptions: subs.map((s) => ({
            id: s.id,
            email: s.email,
            repository: s.repository,
            is_active: s.isActive,
            created_at: s.createdAt
          }))
        });
      })
      .catch((err) => {
        const { code, message } = toGrpcStatus(err);
        callback(Object.assign(new Error(message), { code }));
      });
  }

  function deactivateSubscription(
    call: ServerUnaryCall<DeactivateRequest, Record<string, never>>,
    callback: sendUnaryData<Record<string, never>>
  ): void {
    try {
      checkApiKey(apiKey, call.metadata);
    } catch (err) {
      callback(err as Error);
      return;
    }

    service
      .deactivateSubscription(call.request.id)
      .then(() => callback(null, {}))
      .catch((err) => {
        const { code, message } = toGrpcStatus(err);
        callback(Object.assign(new Error(message), { code }));
      });
  }

  return { createSubscription, listSubscriptions, deactivateSubscription };
}
