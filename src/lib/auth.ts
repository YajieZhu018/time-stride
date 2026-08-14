import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * The single seam between this app and "who is the current user".
 *
 * TimeTrack ships without a login: the schema is fully multi-user (every
 * Category and TimeEvent carries a userId), but exactly one User row is seeded.
 *
 * To add Auth.js later, replace the body of getCurrentUserId with a call to
 * `auth()` and read the id off the session. Nothing else in the app resolves a
 * user, so no other file needs to change.
 *
 * The seeded user's email is the owner's real address, so the first OAuth
 * sign-in links to this existing row rather than creating a second user and
 * orphaning every event logged before that point.
 */
export const OWNER_EMAIL =
  process.env.TIMETRACK_OWNER_EMAIL ?? "yajie.zhu@icloud.com";

export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      `No user seeded for ${OWNER_EMAIL}. Run \`npx prisma db seed\` first.`,
    );
  }

  return user.id;
});
