"use client";

import { useActionState } from "react";
import type { Customer } from "@prisma/client";
import {
  createCustomer,
  updateCustomer,
  type CustomerActionState,
} from "@/app/actions/customer";

function formatDateInput(d: Date) {
  // yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type Props =
  | { mode: "create"; customer?: never }
  | { mode: "edit"; customer: Customer };

export function CustomerForm(props: Props) {
  const action = props.mode === "create" ? createCustomer : updateCustomer;
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    action,
    {}
  );

  const c = props.mode === "edit" ? props.customer : null;
  const tagsDefault = c?.tags?.join(", ") ?? "";

  return (
    <form action={formAction} className="space-y-6">
      {props.mode === "edit" ? (
        <input type="hidden" name="id" value={c!.id} />
      ) : null}

      {state.error ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">顧客名（必須）</label>
        <input
          name="name"
          defaultValue={c?.name ?? ""}
          className="lia-input"
          placeholder="例）さくら"
          required
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">LINE名</label>
        <input
          name="lineName"
          defaultValue={c?.lineName ?? ""}
          className="lia-input"
          placeholder="例）Sakura🌸"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">誕生日</label>
        <input
          name="birthday"
          type="date"
          defaultValue={c?.birthday ? formatDateInput(c.birthday) : ""}
          className="lia-input"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">好きなお酒</label>
        <input
          name="favoriteDrink"
          defaultValue={c?.favoriteDrink ?? ""}
          className="lia-input"
          placeholder="例）シャンパン"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">趣味</label>
        <input
          name="hobby"
          defaultValue={c?.hobby ?? ""}
          className="lia-input"
          placeholder="例）サウナ"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">関係性メモ</label>
        <textarea
          name="relationshipMemo"
          defaultValue={c?.relationshipMemo ?? ""}
          className="lia-input min-h-28"
          placeholder="例）前回は友達と来店。仕事が忙しそう。"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">タグ（カンマ区切り）</label>
        <input
          name="tags"
          defaultValue={tagsDefault}
          className="lia-input"
          placeholder="例）VIP, 返信薄め"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="lia-btn-primary w-full disabled:translate-y-0 disabled:opacity-60"
      >
        {props.mode === "create"
          ? pending
            ? "登録中…"
            : "登録する"
          : pending
            ? "更新中…"
            : "更新する"}
      </button>
    </form>
  );
}

