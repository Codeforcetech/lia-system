import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { purposeLabel } from "@/lib/labels";
import type { MessagePurpose, MessageTone } from "@prisma/client";
import { getOrGenerateManagerBriefing } from "@/lib/ai-sales-summary";
import {
  computeCustomerTodoFlags,
  assignPrimaryTodoBucket,
  todoReasonLinesForDisplay,
  todoSectionTitleJa,
  messagePurposeForTodoBucket,
  buildAiSalesProposalCore,
  getSuggestedTone,
  type SalesCustomerContext,
  type TodoBucketKey,
  type SalesPriority,
} from "@/lib/ai-sales";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export const HOME_TODO_BUCKET_ORDER: TodoBucketKey[] = [
  "BIRTHDAY",
  "THANK_YOU",
  "LONG_GAP",
  "MEMO",
];

export type HomeTodoCard = {
  customerId: string;
  customerName: string;
  lineName: string | null;
  lastVisitLabel: string;
  tags: string[];
  score: number;
  priority: SalesPriority;
  reasonLines: string[];
  purpose: MessagePurpose;
  tone: MessageTone;
  suggestedLineLabel: string;
  primaryBucket: TodoBucketKey;
};

export type HomeManagerStats = {
  totalUnique: number;
  breakdown: Record<TodoBucketKey, number>;
  topCustomer: null | {
    customerId: string;
    name: string;
    primaryLabel: string;
    priority: SalesPriority;
    score: number;
  };
};

export type HomeDashboardData = {
  managerAdvice: string;
  stats: HomeManagerStats;
  groups: Record<TodoBucketKey, HomeTodoCard[]>;
};

export async function loadHomeDashboard(): Promise<HomeDashboardData | null> {
  try {
    const user = await getDemoUser();
    const today = new Date();

    const rows = await prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        lineName: true,
        tags: true,
        lastVisitDate: true,
        birthday: true,
        notes: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    const groups: Record<TodoBucketKey, HomeTodoCard[]> = {
      BIRTHDAY: [],
      THANK_YOU: [],
      LONG_GAP: [],
      MEMO: [],
    };
    const breakdown: Record<TodoBucketKey, number> = {
      BIRTHDAY: 0,
      THANK_YOU: 0,
      LONG_GAP: 0,
      MEMO: 0,
    };

    let top: HomeTodoCard | null = null;

    for (const row of rows) {
      const ctx: SalesCustomerContext = {
        id: row.id,
        name: row.name,
        tags: row.tags,
        lastVisitDate: row.lastVisitDate,
        birthday: row.birthday,
        latestNoteUpdatedAt: row.notes[0]?.updatedAt ?? null,
      };

      const flags = computeCustomerTodoFlags(ctx, today);
      const primary = assignPrimaryTodoBucket(flags);
      if (!primary) continue;

      const purpose = messagePurposeForTodoBucket(primary);
      const tone = getSuggestedTone(ctx, purpose, today);
      const core = buildAiSalesProposalCore(ctx, today);

      const card: HomeTodoCard = {
        customerId: row.id,
        customerName: row.name,
        lineName: row.lineName,
        lastVisitLabel: row.lastVisitDate ? formatDate(row.lastVisitDate) : "（未登録）",
        tags: row.tags,
        score: core.score,
        priority: core.priority,
        reasonLines: todoReasonLinesForDisplay(flags),
        purpose,
        tone,
        suggestedLineLabel: purposeLabel(purpose),
        primaryBucket: primary,
      };

      breakdown[primary] += 1;
      groups[primary].push(card);

      if (!top || card.score > top.score) {
        top = card;
      }
    }

    for (const k of HOME_TODO_BUCKET_ORDER) {
      groups[k].sort((a, b) => b.score - a.score);
    }

    const totalUnique =
      breakdown.BIRTHDAY + breakdown.THANK_YOU + breakdown.LONG_GAP + breakdown.MEMO;

    const stats: HomeManagerStats = {
      totalUnique,
      breakdown,
      topCustomer: top
        ? {
            customerId: top.customerId,
            name: top.customerName,
            primaryLabel: todoSectionTitleJa(top.primaryBucket),
            priority: top.priority,
            score: top.score,
          }
        : null,
    };

    const managerAdvice = await getOrGenerateManagerBriefing(
      {
        totalUnique,
        breakdown,
        topCustomer: stats.topCustomer
          ? {
              customerId: stats.topCustomer.customerId,
              name: stats.topCustomer.name,
              primaryLabel: stats.topCustomer.primaryLabel,
              priority: stats.topCustomer.priority,
              score: stats.topCustomer.score,
            }
          : null,
      },
      today
    );

    return {
      managerAdvice,
      stats,
      groups,
    };
  } catch {
    return null;
  }
}
