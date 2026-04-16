export interface ShelfTheme {
  id: string;
  name: string;
  /** 5 色阶：从最亮(背景)到最深(文字/强调) */
  colors: [string, string, string, string, string];
}

export const SHELF_THEMES: ShelfTheme[] = [
  {
    id: "autumn",
    name: "金秋",
    colors: ["#F8EC99", "#DEB938", "#A8B774", "#2C4219", "#433A30"],
  },
  {
    id: "magnolia",
    name: "玉兰",
    colors: ["#E0D7C7", "#BE9F89", "#98C3C7", "#5399A0", "#1B2A31"],
  },
  {
    id: "sunset",
    name: "晚霞",
    colors: ["#FCE5C3", "#F7B596", "#EEA59E", "#626C8B", "#402C39"],
  },
  {
    id: "bluebell",
    name: "蓝铃",
    colors: ["#BAACEB", "#5F5AA5", "#B8D062", "#5E891B", "#28380A"],
  },
  {
    id: "spring",
    name: "春晓",
    colors: ["#F3F6F3", "#9EBEED", "#4E90F5", "#94C000", "#4B6B03"],
  },
  {
    id: "lavender",
    name: "薰衣草",
    colors: ["#C5DCE1", "#DD9AA9", "#B094BC", "#7B5AA5", "#2A1C64"],
  },
  {
    id: "verdant",
    name: "苍翠",
    colors: ["#C7C9C9", "#C0B58E", "#93A989", "#386939", "#12341B"],
  },
  {
    id: "sunshine",
    name: "暖阳",
    colors: ["#F9E3B6", "#FBCE6B", "#D5A007", "#6C8B08", "#2B2202"],
  },
  {
    id: "meadow",
    name: "花野",
    colors: ["#F4DFE6", "#E0A3BB", "#D6E6E7", "#C5CCB2", "#97A13B"],
  },
];

/**
 * 根据书名 hash 从当前主题的色阶中生成封面渐变
 * 每本书从色阶 1~3 中选两个不同的色组成渐变
 */
export function getCoverGradient(title: string, theme: ShelfTheme): string {
  const pairs = [
    [1, 2], // 色阶2 → 色阶3
    [2, 3], // 色阶3 → 色阶4
    [1, 3], // 色阶2 → 色阶4
    [0, 2], // 色阶1 → 色阶3
    [1, 4], // 色阶2 → 色阶5
    [0, 3], // 色阶1 → 色阶4
  ];

  let hash = 0;
  const str = title.trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const pairIndex = Math.abs(hash) % pairs.length;
  const [a, b] = pairs[pairIndex];

  return `linear-gradient(135deg, ${theme.colors[a]} 0%, ${theme.colors[b]} 100%)`;
}

export function getThemeById(id: string): ShelfTheme {
  return SHELF_THEMES.find((t) => t.id === id) || SHELF_THEMES[4]; // 默认春晓
}
