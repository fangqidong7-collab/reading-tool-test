export interface ShelfTheme {
  id: string;
  name: string;
  /** 4~5 个纯色，用于书籍封面 */
  coverColors: string[];
}

export const SHELF_THEMES: ShelfTheme[] = [
  {
    id: "autumn",
    name: "金秋",
    coverColors: ["#F8EC99", "#DEB938", "#A8B774", "#2C4219", "#433A30"],
  },
  {
    id: "magnolia",
    name: "玉兰",
    coverColors: ["#E0D7C7", "#BE9F89", "#98C3C7", "#5399A0", "#1B2A31"],
  },
  {
    id: "sunset",
    name: "晚霞",
    coverColors: ["#FCE5C3", "#F7B596", "#EEA59E", "#626C8B", "#402C39"],
  },
  {
    id: "bluebell",
    name: "蓝铃",
    coverColors: ["#BAACEB", "#5F5AA5", "#B8D062", "#5E891B", "#28380A"],
  },
  {
    id: "spring",
    name: "春晓",
    coverColors: ["#F3F6F3", "#9EBEED", "#4E90F5", "#94C000", "#4B6B03"],
  },
  {
    id: "lavender",
    name: "薰衣草",
    coverColors: ["#C5DCE1", "#DD9AA9", "#B094BC", "#7B5AA5", "#2A1C64"],
  },
  {
    id: "verdant",
    name: "苍翠",
    coverColors: ["#C7C9C9", "#C0B58E", "#93A989", "#386939", "#12341B"],
  },
  {
    id: "sunshine",
    name: "暖阳",
    coverColors: ["#F9E3B6", "#FBCE6B", "#D5A007", "#6C8B08", "#2B2202"],
  },
  {
    id: "meadow",
    name: "花野",
    coverColors: ["#F4DFE6", "#E0A3BB", "#D6E6E7", "#C5CCB2", "#97A13B"],
  },
];

/** 根据书名 hash 从主题封面色中选一个纯色 */
export function getCoverColor(title: string, theme: ShelfTheme): string {
  let hash = 0;
  const str = title.trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return theme.coverColors[Math.abs(hash) % theme.coverColors.length];
}

export function getThemeById(id: string): ShelfTheme {
  return SHELF_THEMES.find((t) => t.id === id) || SHELF_THEMES[4];
}
