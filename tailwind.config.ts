import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** 余白・枠・淡ピンク面（旧ラベンダー番号を置換） */
        lia: {
          50: "#FAFAFA",
          100: "#FFF5F8",
          150: "#FDECEF",
          200: "#EDEEF4",
          300: "#F3DDE5",
          400: "#FAD6DF",
          500: "#F7A8BC",
          600: "#F48BA8",
          700: "#E87595",
          800: "#12153F",
          900: "#080B3F",
          950: "#070A3D",
        },
        /** 本文・見出し・補助（濃紺・グレー） */
        liaInk: {
          DEFAULT: "#080B3F",
          heading: "#070A3D",
          deep: "#0B0F4A",
          muted: "#6B6F85",
          subtle: "#8A8DA3",
        },
      },
      boxShadow: {
        lia: "0 4px 24px -6px rgba(8, 11, 63, 0.07), 0 2px 8px -4px rgba(8, 11, 63, 0.05)",
        "lia-sm":
          "0 1px 3px rgba(8, 11, 63, 0.05), 0 1px 2px rgba(8, 11, 63, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
