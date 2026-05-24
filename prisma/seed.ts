import { PrismaClient, UserRole } from "@prisma/client";
import { formatDateKeyInTokyo, daysInMonthForYearMonth } from "../lib/sales-dashboard";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@lia.local";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Demo User",
      role: UserRole.CAST,
    },
    create: {
      email,
      name: "Demo User",
      role: UserRole.CAST,
    },
  });

  // デモ用サンプルデータは seed を何度実行しても重複しないように、
  // demoユーザー配下を一度削除して作り直す。
  await prisma.generatedMessage.deleteMany({ where: { userId: user.id } });
  await prisma.workSchedule.deleteMany({ where: { userId: user.id } });
  await prisma.visit.deleteMany({ where: { userId: user.id } });
  await prisma.customerNote.deleteMany({ where: { userId: user.id } });
  await prisma.customer.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  // 直近7日内の誕生日に当たるように（年だけ当年に合わせる）
  const birthdayIn = (days: number) => {
    const d = daysFromNow(days);
    d.setHours(0, 0, 0, 0);
    // 適当な年（年齢はデモでは不要）
    d.setFullYear(1998);
    return d;
  };

  const customers = [
    {
      id: "demo_cust_sakura",
      name: "さくら",
      lineName: "Sakura🌸",
      tags: ["誕生日近い", "返信早い"],
      birthday: birthdayIn(3),
      favoriteDrink: "赤ワイン",
      hobby: "旅行",
      relationshipMemo:
        "話すと明るくて盛り上がる。誕生日の話題は重くならない程度に。旅行の話題が自然に続く。",
      lastVisitDate: daysAgo(12), // 誕生日近い＋少し間が空いている
    },
    {
      id: "demo_cust_airi",
      name: "Airi",
      lineName: "Airi",
      tags: ["VIP", "同伴候補"],
      birthday: null,
      favoriteDrink: "シャンパン",
      hobby: "ゴルフ",
      relationshipMemo:
        "仕事終わりにふらっと来るタイプ。忙しい時期は返信が短くなる。押しすぎず、落ち着いたテンションが良い。",
      lastVisitDate: daysAgo(2), // お礼候補
    },
    {
      id: "demo_cust_misaki",
      name: "みさき",
      lineName: "みさき(既読ゆっくり)",
      tags: ["返信薄め", "久しぶり"],
      birthday: null,
      favoriteDrink: "ハイボール",
      hobby: "サウナ",
      relationshipMemo:
        "返信は遅め。短文＋負担少ない聞き方だと返ってきやすい。最近仕事が忙しそう。",
      lastVisitDate: daysAgo(28), // 最近来店していない
    },
    {
      id: "demo_cust_aya",
      name: "あや",
      lineName: "aya🪽",
      tags: ["お酒好き", "イベント好き"],
      birthday: null,
      favoriteDrink: "ワイン",
      hobby: "音楽フェス",
      relationshipMemo: "イベントの話題に反応が良い。近況を軽く聞く感じが自然。",
      lastVisitDate: daysAgo(7),
    },
    {
      id: "demo_cust_yuto",
      name: "ゆうと",
      lineName: "Yuto",
      tags: ["久しぶり", "自然な雑談"],
      birthday: birthdayIn(6),
      favoriteDrink: "ビール",
      hobby: "映画",
      relationshipMemo: "雑談が好き。テンポよく、質問は1つまでが良い。",
      lastVisitDate: daysAgo(15), // 14日以上
    },
    {
      id: "demo_cust_haruka",
      name: "はるか",
      lineName: "はるか",
      tags: ["メモ更新あり"],
      birthday: null,
      favoriteDrink: "梅酒",
      hobby: "旅行",
      relationshipMemo: "最近仕事が忙しそう。労い＋無理しないトーンが良い。",
      lastVisitDate: daysAgo(10),
    },
  ] as const;

  // 顧客作成
  await prisma.customer.createMany({
    data: customers.map((c) => ({
      id: c.id,
      userId: user.id,
      name: c.name,
      lineName: c.lineName,
      birthday: c.birthday,
      favoriteDrink: c.favoriteDrink,
      hobby: c.hobby,
      relationshipMemo: c.relationshipMemo,
      tags: [...c.tags],
      lastVisitDate: c.lastVisitDate,
    })),
  });

  // ノート（1〜3件ずつ）
  await prisma.customerNote.createMany({
    data: [
      {
        id: "demo_note_sakura_1",
        userId: user.id,
        customerId: "demo_cust_sakura",
        content: "前回は友達と来店。旅行の話で盛り上がった。次はおすすめの行き先を聞きたい。",
        aiSummary: null,
      },
      {
        id: "demo_note_sakura_2",
        userId: user.id,
        customerId: "demo_cust_sakura",
        content: "赤ワインが好き。重くならないテンションの連絡が合う。",
        aiSummary: null,
      },
      {
        id: "demo_note_airi_1",
        userId: user.id,
        customerId: "demo_cust_airi",
        content: "VIP。シャンパン好き。落ち着いた雰囲気が好き。",
        aiSummary: null,
      },
      {
        id: "demo_note_airi_2",
        userId: user.id,
        customerId: "demo_cust_airi",
        content: "最近仕事が立て込んでるみたい。無理させない聞き方が良い。",
        aiSummary: null,
      },
      {
        id: "demo_note_airi_3",
        userId: user.id,
        customerId: "demo_cust_airi",
        content: "前回イベントの話をした。近況を軽く聞く→話題をイベントに戻す流れが自然。",
        aiSummary: null,
      },
      {
        id: "demo_note_misaki_1",
        userId: user.id,
        customerId: "demo_cust_misaki",
        content: "返信遅め。短文で質問は1つまでが返ってきやすい。",
        aiSummary: null,
      },
      {
        id: "demo_note_misaki_2",
        userId: user.id,
        customerId: "demo_cust_misaki",
        content: "最近仕事が忙しそう。体調気づかいの一言があると返ってきやすい。",
        aiSummary: null,
      },
      {
        id: "demo_note_aya_1",
        userId: user.id,
        customerId: "demo_cust_aya",
        content: "音楽フェスの話題が好き。イベント前に軽く近況聞くと自然。",
        aiSummary: null,
      },
      {
        id: "demo_note_yuto_1",
        userId: user.id,
        customerId: "demo_cust_yuto",
        content: "映画の話が好き。最近観た作品の話題を振ると会話が続く。",
        aiSummary: null,
      },
      {
        id: "demo_note_haruka_1",
        userId: user.id,
        customerId: "demo_cust_haruka",
        content: "最近メンタル疲れてそう。労い＋無理しないトーンが良い。",
        aiSummary: null,
        // 更新あり判定（直近3日以内）用に updatedAt を近づけたいが、Prismaの自動更新なので createdAt を近くする
      },
    ],
  });

  // 「接客メモ更新あり」を出すため、はるかのメモを直近扱いにする（updateでupdatedAtを更新）
  await prisma.customerNote.update({
    where: { id: "demo_note_haruka_1" },
    data: { content: "最近メンタル疲れてそう。労い＋無理しないトーンが良い。（直近メモ）" },
  });

  // 来店履歴（1〜3件ずつ）
  await prisma.visit.createMany({
    data: [
      {
        id: "demo_visit_sakura_1",
        userId: user.id,
        customerId: "demo_cust_sakura",
        visitedAt: daysAgo(40),
        amount: 18000,
        memo: "旅行の話。赤ワイン。",
      },
      {
        id: "demo_visit_sakura_2",
        userId: user.id,
        customerId: "demo_cust_sakura",
        visitedAt: daysAgo(12),
        amount: 26000,
        memo: "友達と来店。次の旅行の話題。",
      },
      {
        id: "demo_visit_airi_1",
        userId: user.id,
        customerId: "demo_cust_airi",
        visitedAt: daysAgo(30),
        amount: 55000,
        memo: "VIP。シャンパン。",
      },
      {
        id: "demo_visit_airi_2",
        userId: user.id,
        customerId: "demo_cust_airi",
        visitedAt: daysAgo(9),
        amount: 68000,
        memo: "イベントの話題。",
      },
      {
        id: "demo_visit_airi_3",
        userId: user.id,
        customerId: "demo_cust_airi",
        visitedAt: daysAgo(2),
        amount: 72000,
        memo: "同伴。忙しそうだったので短めで。",
      },
      {
        id: "demo_visit_misaki_1",
        userId: user.id,
        customerId: "demo_cust_misaki",
        visitedAt: daysAgo(60),
        amount: 14000,
        memo: "短時間。ハイボール。",
      },
      {
        id: "demo_visit_misaki_2",
        userId: user.id,
        customerId: "demo_cust_misaki",
        visitedAt: daysAgo(28),
        amount: 19000,
        memo: "仕事が忙しそう。サウナの話。",
      },
      {
        id: "demo_visit_aya_1",
        userId: user.id,
        customerId: "demo_cust_aya",
        visitedAt: daysAgo(7),
        amount: 32000,
        memo: "ワイン。イベントの話。",
      },
      {
        id: "demo_visit_yuto_1",
        userId: user.id,
        customerId: "demo_cust_yuto",
        visitedAt: daysAgo(15),
        amount: 15000,
        memo: "映画の話。",
      },
      {
        id: "demo_visit_haruka_1",
        userId: user.id,
        customerId: "demo_cust_haruka",
        visitedAt: daysAgo(10),
        amount: 22000,
        memo: "旅行の話。最近忙しそう。",
      },
    ],
  });

  // lastVisitDate を来店履歴の最新日に合わせる（デモの整合性）
  await prisma.customer.updateMany({
    where: { userId: user.id, id: "demo_cust_sakura" },
    data: { lastVisitDate: daysAgo(12) },
  });
  await prisma.customer.updateMany({
    where: { userId: user.id, id: "demo_cust_airi" },
    data: { lastVisitDate: daysAgo(2) },
  });
  await prisma.customer.updateMany({
    where: { userId: user.id, id: "demo_cust_misaki" },
    data: { lastVisitDate: daysAgo(28) },
  });

  // 今月（日本時間の暦月）の売上集計デモ用 Visit
  const monthKey = formatDateKeyInTokyo(now);
  const [yStr, mStr, dStr] = monthKey.split("-");
  const yNum = Number(yStr);
  const mNum = Number(mStr);
  const dToday = Number(dStr);
  const dim = daysInMonthForYearMonth(yNum, mNum);
  let visitDay1 = Math.min(dim, Math.max(1, dToday - 10));
  let visitDay2 = Math.min(dim, Math.max(1, dToday - 2));
  if (visitDay1 === visitDay2 && dim > visitDay2) {
    visitDay2 = Math.min(dim, visitDay2 + 1);
  }
  const boostVisits = [
    {
      id: "demo_visit_month_boost_a",
      userId: user.id,
      customerId: "demo_cust_airi",
      visitedAt: new Date(
        `${yNum}-${String(mNum).padStart(2, "0")}-${String(visitDay1).padStart(2, "0")}T18:00:00+09:00`
      ),
      amount: 125_000,
      memo: "今月集計用（シード）",
    },
    ...(visitDay1 !== visitDay2
      ? [
          {
            id: "demo_visit_month_boost_b",
            userId: user.id,
            customerId: "demo_cust_sakura",
            visitedAt: new Date(
              `${yNum}-${String(mNum).padStart(2, "0")}-${String(visitDay2).padStart(2, "0")}T19:30:00+09:00`
            ),
            amount: 98_000,
            memo: "今月集計用（シード）",
          },
        ]
      : []),
  ];
  await prisma.visit.createMany({ data: boostVisits });

  // 出勤予定（過去・未来）
  const pastKey = formatDateKeyInTokyo(daysAgo(14));
  const fut3Key = formatDateKeyInTokyo(daysFromNow(3));
  const fut12Key = formatDateKeyInTokyo(daysFromNow(12));
  await prisma.workSchedule.createMany({
    data: [
      {
        id: "demo_ws_past",
        userId: user.id,
        workDate: new Date(`${pastKey}T00:00:00+09:00`),
        memo: "過去の出勤（デモ）",
      },
      {
        id: "demo_ws_future_a",
        userId: user.id,
        workDate: new Date(`${fut3Key}T00:00:00+09:00`),
        memo: "20:00〜",
      },
      {
        id: "demo_ws_future_b",
        userId: user.id,
        workDate: new Date(`${fut12Key}T00:00:00+09:00`),
        memo: "同伴枠あり",
      },
    ],
  });

  await prisma.userSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, monthlySalesTarget: 500_000 },
    update: { monthlySalesTarget: 500_000 },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

