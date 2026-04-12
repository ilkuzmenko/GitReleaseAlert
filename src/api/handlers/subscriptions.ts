import { Router } from "express";
import { SubscriptionService } from "../../domain/subscriptions/subscription-service";

export function buildSubscriptionsRouter(service: SubscriptionService): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const created = await service.createSubscription({
        email: req.body?.email,
        repository: req.body?.repository
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (_req, res, next) => {
    try {
      const subscriptions = await service.listSubscriptions();
      res.status(200).json({ items: subscriptions });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await service.deactivateSubscription(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
