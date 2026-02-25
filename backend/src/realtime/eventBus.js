const Redis = require("ioredis");
const { REALTIME_EVENT_TYPE_SET } = require("./eventTypes");

const REALTIME_CHANNEL = process.env.REDIS_REALTIME_CHANNEL || "wms:realtime-events";

const getRedisConnectionOptions = () => ({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

let publisher = null;
let subscriber = null;
let isSubscribed = false;
const subscribers = new Set();

const getPublisher = () => {
  if (!publisher) {
    publisher = new Redis(getRedisConnectionOptions());
  }
  return publisher;
};

const getSubscriber = () => {
  if (!subscriber) {
    subscriber = new Redis(getRedisConnectionOptions());
    subscriber.on("message", (channel, message) => {
      if (channel !== REALTIME_CHANNEL) {
        return;
      }

      let parsedMessage = null;
      try {
        parsedMessage = JSON.parse(message);
      } catch (error) {
        console.error("[realtime] Failed to parse redis event payload", error);
        return;
      }

      for (const handler of subscribers) {
        try {
          handler(parsedMessage);
        } catch (error) {
          console.error("[realtime] Subscriber handler failed", error);
        }
      }
    });
  }
  return subscriber;
};

const normalizeRealtimeEvent = (event) => {
  const eventType = event?.type;
  if (!REALTIME_EVENT_TYPE_SET.has(eventType)) {
    throw new Error(`Unsupported realtime event type '${eventType}'`);
  }

  return {
    type: eventType,
    payload: event?.payload ?? {},
    occurredAt: event?.occurredAt || new Date().toISOString()
  };
};

const publishRealtimeEvent = async (event) => {
  const normalizedEvent = normalizeRealtimeEvent(event);
  const publisherClient = getPublisher();
  await publisherClient.publish(REALTIME_CHANNEL, JSON.stringify(normalizedEvent));
  return normalizedEvent;
};

const subscribeRealtimeEvents = async (handler) => {
  if (typeof handler !== "function") {
    throw new Error("subscribeRealtimeEvents handler must be a function");
  }

  subscribers.add(handler);
  const subscriberClient = getSubscriber();

  if (!isSubscribed) {
    await subscriberClient.subscribe(REALTIME_CHANNEL);
    isSubscribed = true;
  }

  return () => {
    subscribers.delete(handler);
  };
};

const closeRealtimeEventBus = async () => {
  subscribers.clear();

  if (subscriber) {
    try {
      if (isSubscribed) {
        await subscriber.unsubscribe(REALTIME_CHANNEL);
      }
      await subscriber.quit();
    } catch (_error) {
      await subscriber.disconnect();
    } finally {
      subscriber = null;
      isSubscribed = false;
    }
  }

  if (publisher) {
    try {
      await publisher.quit();
    } catch (_error) {
      await publisher.disconnect();
    } finally {
      publisher = null;
    }
  }
};

module.exports = {
  closeRealtimeEventBus,
  publishRealtimeEvent,
  subscribeRealtimeEvents
};
