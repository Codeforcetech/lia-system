import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEMO_EMAIL = "demo@lia.local";

export async function getDemoUser() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      role: UserRole.CAST,
      name: "Demo User",
    },
    create: {
      email: DEMO_EMAIL,
      role: UserRole.CAST,
      name: "Demo User",
    },
  });

  return user;
}

