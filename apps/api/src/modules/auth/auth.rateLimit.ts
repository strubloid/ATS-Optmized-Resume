import { rateLimit } from "express-rate-limit";

const fifteenMinutes = 15 * 60 * 1000;
const skipDuringTests = () => process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const registrationRateLimit = rateLimit({
  windowMs: fifteenMinutes,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Try again later." },
  skip: skipDuringTests
});

export const loginRateLimit = rateLimit({
  windowMs: fifteenMinutes,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
  skip: skipDuringTests
});
