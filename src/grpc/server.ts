import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { SubscriptionService } from "../domain/subscriptions/subscription-service";
import { makeSubscriptionHandlers } from "./handlers/subscriptions";

const PROTO_PATH = path.resolve(__dirname, "../../proto/subscriptions.proto");

function loadPackage(): grpc.GrpcObject {
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  return grpc.loadPackageDefinition(packageDef);
}

export function buildGrpcServer(subscriptionService: SubscriptionService, apiKey: string): grpc.Server {
  const pkg = loadPackage();
  const subscriptionsPkg = pkg["subscriptions"] as grpc.GrpcObject;
  const ServiceDef = subscriptionsPkg["SubscriptionService"] as grpc.ServiceClientConstructor;

  const server = new grpc.Server();
  server.addService(ServiceDef.service, makeSubscriptionHandlers(subscriptionService, apiKey));
  return server;
}

export function startGrpcServer(server: grpc.Server, port: number): void {
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error("gRPC server failed to bind", err);
      return;
    }
    console.log(`gRPC server listening on :${boundPort}`);
  });
}
