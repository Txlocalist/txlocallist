"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const MIN_TAG_LENGTH = 2;

function getTextValue(formData, fieldName) {
  return formData.get(fieldName)?.toString().trim() ?? "";
}

function buildErrorState(error, fieldErrors = {}) {
  return {
    error,
    fieldErrors,
  };
}

function slugifyTag(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createTagAction(_prevState, formData) {
  await requireStaff();

  const name = getTextValue(formData, "name");
  const slug = slugifyTag(name);
  const fieldErrors = {};

  if (name.length < MIN_TAG_LENGTH) {
    fieldErrors.name = `Use at least ${MIN_TAG_LENGTH} characters for the tag name.`;
  }

  if (!slug) {
    fieldErrors.name = "Use letters or numbers in the tag name.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return buildErrorState("Fix the highlighted fields and try again.", fieldErrors);
  }

  const existingTag = await prisma.tag.findFirst({
    where: {
      OR: [
        { slug },
        {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (existingTag) {
    return buildErrorState("That tag already exists.", {
      name: `A tag named "${existingTag.name}" is already available.`,
    });
  }

  const tag = await prisma.tag.create({
    data: {
      name,
      slug,
    },
    select: {
      name: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/businesses");

  return {
    error: "",
    fieldErrors: {},
    success: `Tag created: ${tag.name}`,
  };
}
