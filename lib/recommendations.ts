import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

type Recommendation = {
  customer: {
    id: string;
    name: string;
    lineName: string | null;
    tags: string[];
    lastVisitDate: Date | null;
  };
  reason: string;
  lastVisitLabel: string;
};

export type HomeRecommendations = {
  today: Recommendation[];
  longTimeNoSee: Recommendation[];
  birthdaySoon: Recommendation[];
  thankYou: Recommendation[];
};

/** ホームの TODO / 折りたたみリスト用 */
export type HomeRecommendationItem = Recommendation;

function formatDate(d: Date) {
  // 例: 2026/05/08
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function daysBetween(a: Date, b: Date) {
  const ms = 1000 * 60 * 60 * 24;
  return Math.floor((a.getTime() - b.getTime()) / ms);
}

function isWithinDaysFromToday(date: Date, withinDays: number, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + withinDays);
  return date >= start && date <= end;
}

function nextBirthday(birthday: Date, today = new Date()) {
  const next = new Date(today);
  next.setHours(0, 0, 0, 0);
  next.setMonth(birthday.getMonth(), birthday.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function getHomeRecommendations(): Promise<HomeRecommendations> {
  try {
    const user = await getDemoUser();
    const today = new Date();

    const customers = await prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        lineName: true,
        tags: true,
        birthday: true,
        lastVisitDate: true,
        notes: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    const byId = new Map<
      string,
      {
        base: Omit<Recommendation, "reason">;
        flags: {
          longTimeNoSee: boolean;
          birthdaySoon: boolean;
          thankYou: boolean;
          noteUpdated: boolean;
        };
        reasons: string[];
        score: number;
      }
    >();

    for (const c of customers) {
      const flags = {
        longTimeNoSee: false,
        birthdaySoon: false,
        thankYou: false,
        noteUpdated: false,
      };
      const reasons: string[] = [];
      let score = 0;

      // 1) lastVisitDate が14日以上前
      if (c.lastVisitDate) {
        const diff = daysBetween(today, c.lastVisitDate);
        if (diff >= 14) {
          reasons.push("前回来店から14日以上経過");
          flags.longTimeNoSee = true;
          score += 40;
        }
        // 3) lastVisitDate が3日以内
        if (diff >= 0 && diff <= 3) {
          reasons.push("来店後のお礼LINE候補");
          flags.thankYou = true;
          score += 30;
        }
      }

      // 2) birthday が今日から7日以内
      if (c.birthday) {
        const nb = nextBirthday(c.birthday, today);
        if (isWithinDaysFromToday(nb, 7, today)) {
          reasons.push("誕生日が近い");
          flags.birthdaySoon = true;
          score += 35;
        }
      }

      // 4) customer_notes が直近3日以内に更新
      const lastNoteUpdatedAt = c.notes[0]?.updatedAt ?? null;
      if (lastNoteUpdatedAt) {
        const diff = daysBetween(today, lastNoteUpdatedAt);
        if (diff >= 0 && diff <= 3) {
          reasons.push("接客メモ更新あり");
          flags.noteUpdated = true;
          score += 20;
        }
      }

      if (reasons.length === 0) continue;

      byId.set(c.id, {
        base: {
          customer: {
            id: c.id,
            name: c.name,
            lineName: c.lineName,
            tags: c.tags,
            lastVisitDate: c.lastVisitDate,
          },
          lastVisitLabel: c.lastVisitDate ? formatDate(c.lastVisitDate) : "（未登録）",
        },
        flags,
        reasons,
        score,
      });
    }

    const list = Array.from(byId.values());
    list.sort((a, b) => b.score - a.score);

    const todayList = list
      .slice(0, 30)
      .map((x) => ({ ...x.base, reason: x.reasons.join(" / ") }));

    const longTimeNoSee = list
      .filter((x) => x.flags.longTimeNoSee)
      .slice(0, 30)
      .map((x) => ({ ...x.base, reason: "前回来店から14日以上経過" }));

    const birthdaySoon = list
      .filter((x) => x.flags.birthdaySoon)
      .slice(0, 30)
      .map((x) => ({ ...x.base, reason: "誕生日が近い" }));

    const thankYou = list
      .filter((x) => x.flags.thankYou)
      .slice(0, 30)
      .map((x) => ({ ...x.base, reason: "来店後のお礼LINE候補" }));

    return {
      today: todayList,
      longTimeNoSee,
      birthdaySoon,
      thankYou,
    };
  } catch {
    // DB未起動などでもホーム画面が壊れないようにする（MVPの起動優先）
    return { today: [], longTimeNoSee: [], birthdaySoon: [], thankYou: [] };
  }
}

