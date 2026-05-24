/** 達成率リング（0–100）。SVGのみ・依存ライブラリなし。 */
export function SalesAchievementRing({
  percent,
  size = 96,
}: {
  percent: number;
  size?: number;
}) {
  const p = Math.min(100, Math.max(0, percent));
  const stroke = 8;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#FAD6DF"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#F48BA8"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
