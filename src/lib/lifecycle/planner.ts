import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import {
  availableVariants,
  complementaryVariants,
  realProductWhere,
} from './catalog';
import {
  ageBetween,
  cartStage,
  DAY,
  lowStock,
  type LifecycleKind,
} from './policy';

const db = () => getPrisma();
export async function planLifecycle(now = new Date()) {
  const runtime = await db().lifecycleRuntime.upsert({
    where: { id: 'default' },
    create: { id: 'default', startedAt: now },
    update: {},
  });
  const leaseToken = randomUUID();
  const acquired = await db().lifecycleRuntime.updateMany({
    where: {
      id: runtime.id,
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60_000) },
  });
  if (!acquired.count) return { queued: 0, busy: true };
  let queued = 0;
  try {
    const variants =
      process.env.CATALOG_DEMO_MODE === '1' ? [] : await availableVariants();
    // Baseline first: installing the automation must not invent a restock.
    const events: { id: string; kind: LifecycleKind; cycle: number }[] = [];
    for (const v of variants) {
      const previous = await db().lifecycleVariantState.findUnique({
        where: { variantId: v.id },
      });
      const restocked = previous && previous.stock === 0;
      const cycle = (previous?.cycle ?? 0) + (restocked ? 1 : 0);
      const changed = previous && !previous.price.equals(v.price);
      const state = await db().lifecycleVariantState.upsert({
        where: { variantId: v.id },
        create: {
          variantId: v.id,
          stock: v.availableQuantity,
          price: v.price,
          cycle,
          observedAt: now,
        },
        update: {
          stock: v.availableQuantity,
          price: v.price,
          cycle,
          observedAt: now,
          ...(restocked ? { restockedAt: now } : {}),
          ...(changed ? { priceChangedAt: now } : {}),
        },
      });
      if (state.restockedAt && ageBetween(state.restockedAt, now, 0, DAY))
        events.push({ id: v.id, kind: 'FAVORITE_RESTOCK', cycle });
      if (lowStock(v.availableQuantity, v.lowStockThreshold))
        events.push({ id: v.id, kind: 'LOW_STOCK', cycle });
      if (
        state.priceChangedAt &&
        ageBetween(state.priceChangedAt, now, 0, DAY) &&
        process.env.LIFECYCLE_PRICE_ALERTS_ENABLED === 'true'
      )
        events.push({ id: v.id, kind: 'FAVORITE_PRICE', cycle });
    }
    // Record sold-out versions too, so a real 0 -> positive transition is seen.
    const zeros = await db().productVariant.findMany({
      where: {
        isActive: true,
        availableQuantity: { lte: 0 },
        product: realProductWhere,
      },
      take: 500,
    });
    for (const v of zeros)
      await db().lifecycleVariantState.upsert({
        where: { variantId: v.id },
        create: { variantId: v.id, stock: 0, price: v.price, observedAt: now },
        update: { stock: 0, price: v.price, observedAt: now },
      });
    const subscribers = await db().newsletterSubscriber.findMany({
      where: {
        status: 'ACTIVE',
        ...(runtime.subscriberCursor
          ? { id: { gt: runtime.subscriberCursor } }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: 20,
    });
    for (const subscriber of subscribers) {
      const queue = async (
        kind: LifecycleKind,
        eventKey: string,
        ids: string[],
        sourceId: string | null = null,
        quantities: number[] = [],
        expiresAt = new Date(now.getTime() + 7 * DAY),
      ) => {
        // Unique event keys survive retries, cron overlap and deployments.
        const result = await db().lifecycleDelivery.createMany({
          data: {
            subscriberId: subscriber.id,
            kind,
            eventKey,
            variantIds: ids,
            quantities,
            sourceId,
            expiresAt,
            dueAt: now,
            nextAttemptAt: now,
          },
          skipDuplicates: true,
        });
        queued += result.count;
      };
      if (
        subscriber.confirmedAt &&
        subscriber.confirmedAt >= runtime.startedAt &&
        ageBetween(subscriber.confirmedAt, now, 0, 7 * DAY)
      )
        await queue(
          'WELCOME',
          `welcome:${subscriber.confirmedAt.toISOString()}`,
          [],
        );
      if (process.env.CATALOG_DEMO_MODE === '1') continue;
      const customer = await db().customer.findUnique({
        where: { email: subscriber.email },
        select: {
          id: true,
          emailVerified: true,
          createdAt: true,
          wishlistItems: { select: { productId: true, createdAt: true } },
        },
      });
      const favorites = customer?.emailVerified ? customer.wishlistItems : [];
      const orders = await db().order.findMany({
        where: {
          email: subscriber.email,
          status: 'PAID',
          payment: { status: 'SUCCEEDED' },
        },
        include: {
          items: true,
          refunds: { select: { id: true } },
          returns: { select: { id: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 30,
      });
      const interests = subscriber.personalizedEmails
        ? await db().product.findMany({
            where: {
              id: {
                in: [
                  ...favorites.map((f) => f.productId),
                  ...orders.flatMap((o) =>
                    o.items.flatMap((i) => (i.productId ? [i.productId] : [])),
                  ),
                ],
              },
            },
            select: { tcgSetId: true, productType: true },
          })
        : [];
      const fresh = variants.filter(
        (v) =>
          v.product.newArrival &&
          v.product.publishedAt &&
          v.product.publishedAt >= runtime.startedAt &&
          ageBetween(v.product.publishedAt, now, 0, 7 * DAY) &&
          (!interests.length ||
            interests.some(
              (i) =>
                (i.tcgSetId && i.tcgSetId === v.product.tcgSetId) ||
                i.productType === v.product.productType,
            )),
      );
      const uniqueFresh = [
        ...new Map(fresh.map((v) => [v.productId, v])).values(),
      ].slice(0, 3);
      if (uniqueFresh.length)
        await queue(
          'NEW_ARRIVAL',
          `new:${uniqueFresh[0]!.productId}`,
          uniqueFresh.map((v) => v.id),
          null,
          [],
          new Date(now.getTime() + DAY),
        );
      if (!subscriber.personalizedEmails || !subscriber.personalizedConsentAt)
        continue;
      const consentAt = subscriber.personalizedConsentAt;
      const carts = await db().cart.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now },
          updatedAt: { gte: consentAt },
          OR: [
            ...(customer?.emailVerified ? [{ customerId: customer.id }] : []),
            {
              checkouts: {
                some: { email: subscriber.email, status: { not: 'COMPLETED' } },
              },
            },
          ],
          checkouts: { none: { order: { isNot: null } } },
        },
        include: {
          items: true,
          checkouts: { orderBy: { updatedAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      });
      for (const cart of carts) {
        const activity = new Date(
          Math.max(
            cart.updatedAt.getTime(),
            ...cart.items.map((i) => i.updatedAt.getTime()),
            ...cart.checkouts.map((c) => c.updatedAt.getTime()),
          ),
        );
        const stage = cartStage(activity, now);
        if (
          stage &&
          cart.items.length &&
          !orders.some((o) => o.paidAt && o.paidAt >= activity)
        ) {
          const ids = cart.items.map((i) => i.variantId);
          const inStock = await availableVariants(ids);
          if (inStock.length)
            await queue(
              stage,
              `cart:${cart.id}:${stage}`,
              inStock.map((v) => v.id),
              cart.id,
              inStock.map((v) =>
                Math.min(
                  v.availableQuantity,
                  cart.items.find((i) => i.variantId === v.id)!.quantity,
                ),
              ),
              new Date(activity.getTime() + 7 * DAY),
            );
        }
      }
      for (const event of events) {
        const v = variants.find((v) => v.id === event.id)!;
        const favorite = favorites.find(
          (f) => f.productId === v.productId && f.createdAt <= now,
        );
        if (!favorite) continue;
        // A specific stock alert already subscribed takes precedence.
        if (
          event.kind === 'FAVORITE_RESTOCK' &&
          (await db().stockAlert.count({
            where: {
              email: subscriber.email,
              variantId: v.id,
              status: { in: ['ACTIVE', 'SENDING', 'NOTIFIED'] },
              updatedAt: { gte: new Date(now.getTime() - 7 * DAY) },
            },
          }))
        )
          continue;
        const priceKey =
          event.kind === 'FAVORITE_PRICE' ? `:${v.price.toFixed(2)}` : '';
        await queue(
          event.kind,
          `${event.kind}:${v.id}:${event.cycle}${priceKey}`,
          [v.id],
          null,
          [],
          new Date(now.getTime() + DAY),
        );
      }
      const boughtIds = [
        ...new Set(
          orders.flatMap((o) =>
            o.items.flatMap((i) => (i.productId ? [i.productId] : [])),
          ),
        ),
      ];
      for (const order of orders) {
        if (
          order.refunds.length ||
          order.returns.length ||
          !order.deliveredAt ||
          order.deliveredAt < consentAt
        )
          continue;
        const purchased = order.items.flatMap((i) =>
          i.productId ? [i.productId] : [],
        );
        const recommendations = await complementaryVariants(
          purchased,
          boughtIds,
        );
        if (ageBetween(order.deliveredAt, now, 3 * DAY, 10 * DAY))
          await queue(
            'POST_PURCHASE',
            `post:${order.id}`,
            recommendations.map((v) => v.id),
            order.id,
          );
        if (
          ageBetween(order.deliveredAt, now, 14 * DAY, 30 * DAY) &&
          recommendations.length
        )
          await queue(
            'COMPLEMENTS',
            `complements:${order.id}`,
            recommendations.map((v) => v.id),
            order.id,
          );
      }
      const last = orders[0];
      if (last?.paidAt && ageBetween(last.paidAt, now, 75 * DAY, 105 * DAY)) {
        const changes = variants.filter(
          (v) =>
            v.product.publishedAt &&
            v.product.publishedAt > last.paidAt! &&
            !boughtIds.includes(v.productId),
        );
        const restockedIds = await db().lifecycleDelivery.findMany({
          where: {
            subscriberId: subscriber.id,
            kind: 'FAVORITE_RESTOCK',
            createdAt: { gt: last.paidAt },
          },
          select: { variantIds: true },
          take: 10,
        });
        const ids = new Set(restockedIds.flatMap((r) => r.variantIds));
        const products = [
          ...new Map(
            [...changes, ...variants.filter((v) => ids.has(v.id))].map((v) => [
              v.productId,
              v,
            ]),
          ).values(),
        ].slice(0, 3);
        if (products.length)
          await queue(
            'WIN_BACK',
            `win:${last.id}`,
            products.map((v) => v.id),
            last.id,
          );
      }
    }
    // A round-robin cursor prevents the first 20 subscribers monopolising a run.
    await db().lifecycleRuntime.updateMany({
      where: { id: runtime.id, leaseToken },
      data: {
        subscriberCursor:
          subscribers.length === 20 ? subscribers.at(-1)!.id : null,
      },
    });
    return { queued, busy: false };
  } finally {
    await db().lifecycleRuntime.updateMany({
      where: { id: runtime.id, leaseToken },
      data: { leaseUntil: null, leaseToken: null },
    });
  }
}
