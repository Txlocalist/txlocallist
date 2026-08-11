import { describe, expect, test } from "vitest";

import {
  isMissingPrismaTableError,
  isUnavailablePrismaRelationError,
} from "@/lib/prisma-errors";

describe("Prisma schema compatibility errors", () => {
  test("recognizes a relation table that has not been migrated", () => {
    const error = Object.assign(
      new Error('The table `public.EventLike` does not exist in the current database.'),
      { code: "P2021" }
    );

    expect(isMissingPrismaTableError(error)).toBe(true);
    expect(isUnavailablePrismaRelationError(error, "likes")).toBe(true);
  });

  test("recognizes a relation missing from a stale generated Prisma client", () => {
    const error = Object.assign(
      new Error(
        "Unknown field `likes` for select statement on model `EventCountOutputType`."
      ),
      { name: "PrismaClientValidationError" }
    );

    expect(isUnavailablePrismaRelationError(error, "likes")).toBe(true);
  });

  test("does not hide unrelated Prisma validation errors", () => {
    const error = Object.assign(
      new Error("Unknown argument `startDate`. Available options are marked with ?."),
      { name: "PrismaClientValidationError" }
    );

    expect(isUnavailablePrismaRelationError(error, "likes")).toBe(false);
  });
});
