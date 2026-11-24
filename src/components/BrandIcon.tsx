import type { GarmentCategory } from "../core/entities";

type IconName = GarmentCategory | "studio" | "wardrobe" | "outfits" | "photo" | "transfer" | "settings" | "reset" | "check";
const paths: Record<IconName, string> = {
  studio: "M10 6a2 2 0 1 1 3 1.7L12 9v2l9 5v2H3v-2l9-5",
  wardrobe: "M3 3h18v17H3zM12 3v17M9 10v3m6-3v3M5 20v2m14-2v2",
  outfits: "M3 7h13v13H3zM8 7V3h13v13h-5M6 16l3-4 4 4",
  photo: "M3 4h18v16H3zM5 17l5-6 4 4 2-2 3 4M16 8h.01",
  check: "m5 12 4 4L19 6",
  reset: "M4 11a8 8 0 1 1 2.5 6M4 5v6h6",
  settings: "M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4",
  transfer: "M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4",
  top: "M8 4 3 7l2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z",
  bottom: "M7 4h10l2 16h-5l-2-9-2 9H5zM7 7h10",
  "dress-skirt": "M8 4h2l2 4 2-4h2l-1 7 5 9H4l5-9z",
  outerwear: "M8 4 4 7l-2 12h4l2-7v8h8v-8l2 7h4L20 7l-4-3M8 4l4 6 4-6m-4 6v10",
  footwear: "M3 14V8h4l4 6 4 1 4-1 2 3v3H3zM3 17h17",
  accessory: "M5 9h14l2 11H3zM9 9V7a3 3 0 0 1 6 0v2",
};

export function BrandIcon({ name }: { name: IconName }) {
  return <svg className="brand-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
