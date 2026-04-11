// 常用英语词典 - 已移至 public/dict_builtin.json，动态加载
let englishDictionary: Record<string, { meaning: string; pos: string }> = {};
let builtinDictLoaded = false;

export async function loadBuiltinDictionary(): Promise<void> {
  if (builtinDictLoaded) return;
  try {
    const resp = await fetch('/dict_builtin.json');
    if (resp.ok) {
      englishDictionary = await resp.json();
      builtinDictLoaded = true;
      console.log('内置词典加载完成, 词条数:', Object.keys(englishDictionary).length);
    }
  } catch (e) {
    console.warn('内置词典加载失败:', e);
  }
}

// 不规则动词表 - 过去式/过去分词 -> 原形
export const irregularVerbs: Record<string, string> = {
  "arose": "arise",
  "awoke": "awake",
  "was": "be",
  "were": "be",
  "beat": "beat",
  "became": "become",
  "began": "begin",
  "begun": "begin",
  "bent": "bend",
  "bet": "bet",
  "bid": "bid",
  "bound": "bind",
  "bit": "bite",
  "bitten": "bite",
  "bled": "bleed",
  "blew": "blow",
  "blown": "blow",
  "broke": "break",
  "broken": "break",
  "bred": "breed",
  "brought": "bring",
  "broadcast": "broadcast",
  "built": "build",
  "burned": "burn",
  "burnt": "burn",
  "burst": "burst",
  "bought": "buy",
  "caught": "catch",
  "chose": "choose",
  "chosen": "choose",
  "clung": "cling",
  "came": "come",
  "cost": "cost",
  "crept": "creep",
  "cut": "cut",
  "dealt": "deal",
  "dug": "dig",
  "dived": "dive",
  "done": "do",
  "drew": "draw",
  "drawn": "draw",
  "drank": "drink",
  "drunk": "drink",
  "drove": "drive",
  "driven": "drive",
  "dwelt": "dwell",
  "ate": "eat",
  "eaten": "eat",
  "fallen": "fall",
  "fell": "fall",
  "fed": "feed",
  "felt": "feel",
  "fought": "fight",
  "found": "find",
  "fit": "fit",
  "fled": "flee",
  "flew": "fly",
  "flown": "fly",
  "forbade": "forbid",
  "forecast": "forecast",
  "forgave": "forgive",
  "forgiven": "forgive",
  "forgot": "forget",
  "forgotten": "forget",
  "forsook": "forsake",
  "forsaken": "forsake",
  "froze": "freeze",
  "frozen": "freeze",
  "gave": "give",
  "given": "give",
  "went": "go",
  "gone": "go",
  "ground": "grind",
  "grew": "grow",
  "grown": "grow",
  "hung": "hang",
  "had": "have",
  "heard": "hear",
  "hid": "hide",
  "hidden": "hide",
  "hit": "hit",
  "hurt": "hurt",
  "kept": "keep",
  "knelt": "kneel",
  "knit": "knit",
  "knew": "know",
  "known": "know",
  "laid": "lay",
  "led": "lead",
  "left": "leave",
  "lent": "lend",
  "let": "let",
  "lay": "lie",
  "lain": "lie",
  "lit": "light",
  "lost": "lose",
  "made": "make",
  "meant": "mean",
  "met": "meet",
  "mistook": "mistake",
  "mistaken": "mistake",
  "mowed": "mow",
  "overcame": "overcome",
  "overdid": "overdo",
  "overdone": "overdo",
  "overtook": "overtake",
  "overtaken": "overtake",
  "paid": "pay",
  "pled": "plead",
  "proved": "prove",
  "put": "put",
  "quit": "quit",
  "read": "read",
  "rid": "rid",
  "rode": "ride",
  "ridden": "ride",
  "rang": "ring",
  "rung": "ring",
  "rose": "rise",
  "risen": "rise",
  "ran": "run",
  "sawed": "saw",
  "said": "say",
  "saw": "see",
  "seen": "see",
  "sought": "seek",
  "sold": "sell",
  "sent": "send",
  "sewed": "sew",
  "shook": "shake",
  "shaken": "shake",
  "shone": "shine",
  "shot": "shot",
  "showed": "show",
  "shown": "show",
  "shrank": "shrink",
  "shrunk": "shrink",
  "sung": "sing",
  "sank": "sink",
  "sunk": "sink",
  "sat": "sit",
  "slept": "sleep",
  "slid": "slide",
  "smelt": "smell",
  "sowed": "sow",
  "spoke": "speak",
  "spoken": "speak",
  "sped": "speed",
  "spun": "spin",
  "spat": "spit",
  "split": "split",
  "spoilt": "spoil",
  "spread": "spread",
  "stood": "stand",
  "stole": "steal",
  "stolen": "steal",
  "stuck": "stick",
  "stung": "sting",
  "stank": "stink",
  "stunk": "stink",
  "strove": "strive",
  "striven": "strive",
  "swore": "swear",
  "sworn": "swear",
  "swept": "sweep",
  "swollen": "swell",
  "took": "take",
  "taken": "take",
  "taught": "teach",
  "tore": "tear",
  "torn": "tear",
  "told": "tell",
  "thought": "think",
  "threw": "throw",
  "thrown": "throw",
  "thrust": "thrust",
  "underwent": "undergo",
  "undergone": "undergo",
  "understood": "understand",
  "woke": "wake",
  "woken": "wake",
  "wore": "wear",
  "worn": "wear",
  "wove": "weave",
  "won": "win",
  "wound": "wind",
  "withheld": "withhold",
  "withdrawn": "withdraw",
  "withstood": "withstand",
  "wrung": "wring",
  "written": "write",
  "wrote": "write",
};

// 不规则名词复数
export const irregularNouns: Record<string, string> = {
  "children": "child",
  "feet": "foot",
  "teeth": "tooth",
  "geese": "goose",
  "mice": "mouse",
  "men": "man",
  "women": "woman",
  "oxen": "ox",
  "sheep": "sheep",
  "deer": "deer",
  "fish": "fish",
  "fruit": "fruit",
  "species": "species",
  "aircraft": "aircraft",
  "data": "data",
  "means": "means",
  "offspring": "offspring",
  "progress": "progress",
  "salmon": "salmon",
  "staff": "staff",
  "trout": "trout",
};

// 常见词缀规则
const suffixRules: Array<{ suffix: string; remove: number; add?: string }> = [
  { suffix: "ies", remove: 3, add: "y" },
  { suffix: "es", remove: 2 },
  { suffix: "s", remove: 1 },
  { suffix: "ing", remove: 3 },
  { suffix: "ed", remove: 2 },
  { suffix: "er", remove: 2 },
  { suffix: "est", remove: 3 },
  { suffix: "ly", remove: 2 },
  { suffix: "tion", remove: 4 },
  { suffix: "sion", remove: 4 },
  { suffix: "ment", remove: 4 },
  { suffix: "ness", remove: 4 },
  { suffix: "able", remove: 4 },
  { suffix: "ible", remove: 4 },
  { suffix: "al", remove: 2 },
  { suffix: "ful", remove: 3 },
  { suffix: "less", remove: 4 },
  { suffix: "ous", remove: 3 },
  { suffix: "ive", remove: 3 },
];

// 常见动词词形映射
const verbForms: Record<string, string> = {
  "running": "run",
  "runs": "run",
  "ran": "run",
  "walking": "walk",
  "walks": "walk",
  "walked": "walk",
  "taking": "take",
  "takes": "take",
  "took": "take",
  "taken": "take",
  "giving": "give",
  "gives": "give",
  "gave": "give",
  "given": "give",
  "making": "make",
  "makes": "make",
  "made": "make",
  "getting": "get",
  "gets": "get",
  "got": "get",
  "coming": "come",
  "comes": "come",
  "came": "come",
  "seeing": "see",
  "sees": "see",
  "saw": "see",
  "seen": "see",
  "knowing": "know",
  "knows": "know",
  "knew": "know",
  "known": "know",
  "thinking": "think",
  "thinks": "think",
  "thought": "think",
  "wanting": "want",
  "wants": "want",
  "wanted": "want",
  "finding": "find",
  "finds": "find",
  "found": "find",
  "telling": "tell",
  "tells": "tell",
  "told": "tell",
  "asking": "ask",
  "asks": "ask",
  "asked": "ask",
  "working": "work",
  "works": "work",
  "feeling": "feel",
  "feels": "feel",
  "felt": "feel",
  "trying": "try",
  "tries": "try",
  "leaving": "leave",
  "leaves": "leave",
  "left": "leave",
  "calling": "call",
  "calls": "call",
  "called": "call",
  "keeping": "keep",
  "keeps": "keep",
  "kept": "keep",
  "beginning": "begin",
  "begins": "begin",
  "began": "begin",
  "begun": "begin",
  "showing": "show",
  "shows": "show",
  "showed": "show",
  "shown": "show",
  "hearing": "hear",
  "hears": "hear",
  "heard": "hear",
  "playing": "play",
  "plays": "play",
  "played": "play",
  "living": "live",
  "lives": "live",
  "loved": "love",
  "loving": "love",
  "loves": "love",
  "believing": "believe",
  "believes": "believe",
  "believed": "believe",
  "bringing": "bring",
  "brings": "bring",
  "brought": "bring",
  "happening": "happen",
  "happens": "happen",
  "happened": "happen",
  "writing": "write",
  "writes": "write",
  "wrote": "write",
  "written": "write",
  "standing": "stand",
  "stands": "stand",
  "stood": "stand",
  "losing": "lose",
  "loses": "lose",
  "lost": "lose",
  "paying": "pay",
  "pays": "pay",
  "paid": "pay",
  "meeting": "meet",
  "meets": "meet",
  "met": "meet",
  "included": "include",
  "including": "include",
  "includes": "include",
  "continuing": "continue",
  "continues": "continue",
  "continued": "continue",
  "setting": "set",
  "sets": "set",
  "learning": "learn",
  "learns": "learn",
  "learned": "learn",
  "changing": "change",
  "changes": "change",
  "changed": "change",
  "leading": "lead",
  "leads": "lead",
  "led": "lead",
  "understanding": "understand",
  "understands": "understand",
  "watching": "watch",
  "watches": "watch",
  "watched": "watch",
  "following": "follow",
  "follows": "follow",
  "stopping": "stop",
  "stops": "stop",
  "stopped": "stop",
  "speaking": "speak",
  "speaks": "speak",
  "spoke": "speak",
  "spoken": "speak",
  "reading": "read",
  "reads": "read",
  "allowing": "allow",
  "allows": "allow",
  "allowed": "allow",
  "adding": "add",
  "adds": "add",
  "added": "add",
  "spending": "spend",
  "spends": "spend",
  "spent": "spend",
  "growing": "grow",
  "grows": "grow",
  "grew": "grow",
  "grown": "grow",
  "opening": "open",
  "opens": "open",
  "opened": "open",
  "winning": "win",
  "wins": "win",
  "won": "win",
  "offering": "offer",
  "offers": "offer",
  "offered": "offer",
  "remembering": "remember",
  "remembers": "remember",
  "remembered": "remember",
  "considering": "consider",
  "considers": "consider",
  "considered": "consider",
  "appearing": "appear",
  "appears": "appear",
  "appeared": "appear",
  "buying": "buy",
  "buys": "buy",
  "bought": "buy",
  "waiting": "wait",
  "waits": "wait",
  "waited": "wait",
  "serving": "serve",
  "serves": "serve",
  "served": "serve",
  "dying": "die",
  "dies": "die",
  "died": "die",
  "sending": "send",
  "sends": "send",
  "sent": "send",
  "expecting": "expect",
  "expects": "expect",
  "expected": "expect",
  "building": "build",
  "builds": "build",
  "staying": "stay",
  "stays": "stay",
  "stayed": "stay",
  "falling": "fall",
  "falls": "fall",
  "fell": "fall",
  "fallen": "fall",
  "cutting": "cut",
  "cuts": "cut",
  "reaching": "reach",
  "reaches": "reach",
  "reached": "reach",
  "killing": "kill",
  "kills": "kill",
  "killed": "kill",
  "remaining": "remain",
  "remains": "remain",
  "remained": "remain",
  "suggesting": "suggest",
  "suggests": "suggest",
  "suggested": "suggest",
  "raising": "raise",
  "raises": "raise",
  "raised": "raise",
  "passing": "pass",
  "passes": "pass",
  "passed": "pass",
  "selling": "sell",
  "sells": "sell",
  "sold": "sell",
  "requiring": "require",
  "requires": "require",
  "required": "require",
  "reporting": "report",
  "reports": "report",
  "reported": "report",
  "deciding": "decide",
  "decides": "decide",
  "decided": "decide",
  "pulling": "pull",
  "pulls": "pull",
  "pulled": "pull",
  "developing": "develop",
  "develops": "develop",
  "developed": "develop",
  "studying": "study",
  "studies": "study",
  "studied": "study",
  "explaining": "explain",
  "explains": "explain",
  "explained": "explain",
  "producing": "produce",
  "produces": "produce",
  "produced": "produce",
  "driving": "drive",
  "drives": "drive",
  "flying": "fly",
  "flies": "fly",
  "flew": "fly",
  "flown": "fly",
  "eating": "eat",
  "eats": "eat",
  "ate": "eat",
  "eaten": "eat",
  "drinking": "drink",
  "drinks": "drink",
  "drank": "drink",
  "drunk": "drink",
  "sleeping": "sleep",
  "sleeps": "sleep",
  "slept": "sleep",
  "teaching": "teach",
  "teaches": "teach",
  "taught": "teach",
  "fighting": "fight",
  "fights": "fight",
  "fought": "fight",
  "rising": "rise",
  "rises": "rise",
  "rose": "rise",
  "risen": "rise",
  "dreaming": "dream",
  "dreams": "dream",
  "choosing": "choose",
  "chooses": "choose",
  "chose": "choose",
  "chosen": "choose",
  "holding": "hold",
  "holds": "hold",
  "held": "hold",
  "throwing": "throw",
  "throws": "throw",
  "threw": "throw",
  "thrown": "throw",
  "catching": "catch",
  "catches": "catch",
  "caught": "catch",
  "hitting": "hit",
  "drawing": "draw",
  "dealing": "deal",
  "deals": "deal",
  "dealt": "deal",
  "meaning": "mean",
  "meant": "mean",
  "wearing": "wear",
  "wears": "wear",
  "wore": "wear",
  "worn": "wear",
  "breaking": "break",
  "breaks": "break",
  "broke": "break",
  "broken": "break",
  "hanging": "hang",
  "rides": "ride",
  "riding": "ride",
  "rode": "ride",
  "ridden": "ride",
  "singing": "sing",
  "sings": "sing",
  "sang": "sing",
  "sung": "sing",
  "shouting": "shout",
  "shouts": "shout",
  "shouted": "shout",
  "closing": "close",
  "closes": "close",
  "closed": "close",
  "signing": "sign",
  "signs": "sign",
  "signed": "sign",
  "listening": "listen",
  "listens": "listen",
  "listened": "listen",
  "picking": "pick",
  "picks": "pick",
  "picked": "pick",
  "planning": "plan",
  "plans": "plan",
  "pointing": "point",
  "points": "point",
  "pointed": "point",
  "presenting": "present",
  "presents": "present",
  "presented": "present",
  "pressing": "press",
  "presses": "press",
  "pressed": "press",
  "preventing": "prevent",
  "prevents": "prevent",
  "prevented": "prevent",
  "promising": "promise",
  "promises": "promise",
  "promised": "promise",
  "proving": "prove",
  "proves": "prove",
  "proved": "prove",
  "publishing": "publish",
  "publishes": "publish",
  "published": "publish",
  "pushing": "push",
  "pushes": "push",
  "pushed": "push",
  "reacting": "react",
  "reacts": "react",
  "reacted": "react",
  "realizing": "realize",
  "realizes": "realize",
  "realized": "realize",
  "receiving": "receive",
  "receives": "receive",
  "received": "receive",
  "recognizing": "recognize",
  "recognizes": "recognize",
  "recognized": "recognize",
  "recommending": "recommend",
  "recommends": "recommend",
  "recommended": "recommend",
  "reducing": "reduce",
  "reduces": "reduce",
  "reduced": "reduce",
  "referring": "refer",
  "refers": "refer",
  "refusing": "refuse",
  "refuses": "refuse",
  "refused": "refuse",
  "relating": "relate",
  "relates": "relate",
  "related": "relate",
  "releasing": "release",
  "releases": "release",
  "released": "release",
  "removing": "remove",
  "removes": "remove",
  "removed": "remove",
  "replacing": "replace",
  "replaces": "replace",
  "replaced": "replace",
  "replying": "reply",
  "replies": "reply",
  "replied": "reply",
  "representing": "represent",
  "represents": "represent",
  "represented": "represent",
  "responding": "respond",
  "responds": "respond",
  "responded": "respond",
  "returning": "return",
  "returns": "return",
  "returned": "return",
  "revealing": "reveal",
  "reveals": "reveal",
  "revealed": "reveal",
  "reviewing": "review",
  "reviews": "review",
  "reviewed": "review",
  "ringing": "ring",
  "rings": "ring",
  "rang": "ring",
  "rung": "ring",
  "saving": "save",
  "saves": "save",
  "saved": "save",
  "searching": "search",
  "searches": "search",
  "searched": "search",
  "selecting": "select",
  "selects": "select",
  "selected": "select",
  "separating": "separate",
  "separates": "separate",
  "separated": "separate",
  "shaking": "shake",
  "shakes": "shake",
  "shook": "shake",
  "shaken": "shake",
  "sharing": "share",
  "shares": "share",
  "shared": "share",
  "shooting": "shoot",
  "shoots": "shoot",
  "shot": "shoot",
  "sliding": "slide",
  "slides": "slide",
  "slid": "slide",
  "smiling": "smile",
  "smiles": "smile",
  "smiled": "smile",
  "smoking": "smoke",
  "smokes": "smoke",
  "solved": "solve",
  "solving": "solve",
  "spreading": "spread",
  "staring": "stare",
  "stares": "stare",
  "stared": "stare",
  "stating": "state",
  "states": "state",
  "stated": "state",
  "sticking": "stick",
  "sticks": "stick",
  "stuck": "stick",
  "storing": "store",
  "stores": "store",
  "stored": "store",
  "struggling": "struggle",
  "struggles": "struggle",
  "struggled": "struggle",
  "submitting": "submit",
  "submits": "submit",
  "suffering": "suffer",
  "suffers": "suffer",
  "suffered": "suffer",
  "supplying": "supply",
  "supplies": "supply",
  "supplied": "supply",
  "supposing": "suppose",
  "supposes": "suppose",
  "supposed": "suppose",
  "surprising": "surprise",
  "surprises": "surprise",
  "surprised": "surprise",
  "swimming": "swim",
  "swims": "swim",
  "swam": "swim",
  "swum": "swim",
  "tasting": "taste",
  "tastes": "taste",
  "tasted": "taste",
  "testing": "test",
  "tests": "test",
  "tested": "test",
  "thanking": "thank",
  "thanks": "thank",
  "thanked": "thank",
  "touching": "touch",
  "touches": "touch",
  "touched": "touch",
  "trading": "trade",
  "trades": "trade",
  "traded": "trade",
  "transforming": "transform",
  "transforms": "transform",
  "transformed": "transform",
  "translating": "translate",
  "translates": "translate",
  "translated": "translate",
  "treating": "treat",
  "treats": "treat",
  "treated": "treat",
  "triggering": "trigger",
  "triggers": "trigger",
  "triggered": "trigger",
  "trusting": "trust",
  "trusts": "trust",
  "trusted": "trust",
  "turning": "turn",
  "turns": "turn",
  "turned": "turn",
  "typing": "type",
  "types": "type",
  "typed": "type",
  "updating": "update",
  "updates": "update",
  "updated": "update",
  "using": "use",
  "uses": "use",
  "used": "use",
  "utilizing": "utilize",
  "utilizes": "utilize",
  "viewing": "view",
  "views": "view",
  "viewed": "view",
  "visiting": "visit",
  "visits": "visit",
  "visited": "visit",
  "voting": "vote",
  "votes": "vote",
  "voted": "vote",
  "waking": "wake",
  "wakes": "wake",
  "woke": "wake",
  "woken": "wake",
  "wandering": "wander",
  "wanders": "wander",
  "wandered": "wander",
  "warning": "warn",
  "warns": "warn",
  "warned": "warn",
  "washing": "wash",
  "washes": "wash",
  "washed": "wash",
  "wasting": "waste",
  "wastes": "waste",
  "wasted": "waste",
  "waving": "wave",
  "waves": "wave",
  "waved": "wave",
  "weighing": "weigh",
  "weighs": "weigh",
  "welcoming": "welcome",
  "welcomes": "welcome",
  "welcomed": "welcome",
  "wishing": "wish",
  "wishes": "wish",
  "wished": "wish",
  "withdrawing": "withdraw",
  "withdraws": "withdraw",
  "withdrew": "withdraw",
  "withdrawn": "withdraw",
  "witnessing": "witness",
  "witnesses": "witness",
  "wondering": "wonder",
  "wonders": "wonder",
  "wondered": "wonder",
  "worrying": "worry",
  "worries": "worry",
  "worried": "worry",
  "wrapping": "wrap",
  "wraps": "wrap",
  "wrapped": "wrap",
  "improving": "improve",
  "improves": "improve",
  "improved": "improve",
  "increasing": "increase",
  "increases": "increase",
  "increased": "increase",
  "describing": "describe",
  "describes": "describe",
  "described": "describe",
  "discovering": "discover",
  "discovers": "discover",
  "discovered": "discover",
  "discussing": "discuss",
  "discusses": "discuss",
  "discussed": "discuss",
  "supporting": "support",
  "supports": "support",
  "supported": "support",
  "accepting": "accept",
  "accepts": "accept",
  "accepted": "accept",
  "enjoying": "enjoy",
  "enjoys": "enjoy",
  "enjoyed": "enjoy",
  "expressing": "express",
  "expresses": "express",
  "expressed": "express",
  "achieving": "achieve",
  "achieves": "achieve",
  "achieved": "achieve",
  "arguing": "argue",
  "argues": "argue",
  "argued": "argue",
  "comparing": "compare",
  "compares": "compare",
  "compared": "compare",
  "connecting": "connect",
  "connects": "connect",
  "connected": "connect",
  "containing": "contain",
  "contains": "contain",
  "depending": "depend",
  "depends": "depend",
  "protected": "protect",
  "protecting": "protect",
  "protects": "protect",
  "covering": "cover",
  "covers": "cover",
  "covered": "cover",
  "hurrying": "hurry",
  "hurries": "hurry",
  "hurried": "hurry",
  "injuring": "injure",
  "injures": "injure",
  "injured": "injure",
  "introducing": "introduce",
  "introduces": "introduce",
  "introduced": "introduce",
  "inviting": "invite",
  "invites": "invite",
  "invited": "invite",
  "jumping": "jump",
  "jumps": "jump",
  "jumped": "jump",
  "laughing": "laugh",
  "laughs": "laugh",
  "laughed": "laugh",
  "laying": "lay",
  "lays": "lay",
  "laid": "lay",
};

/**
 * 词形还原 - 将英文单词还原为其词根形式
 */
export function lemmatize(word: string): string {
  const lowerWord = word.toLowerCase();
  
  // 1. 首先检查不规则动词表
  if (irregularVerbs[lowerWord]) {
    return irregularVerbs[lowerWord];
  }
  
  // 2. 检查常见动词形式表
  if (verbForms[lowerWord]) {
    return verbForms[lowerWord];
  }
  
  // 3. 检查不规则名词
  if (irregularNouns[lowerWord]) {
    return irregularNouns[lowerWord];
  }
  
  // 4. 应用后缀规则
  for (const rule of suffixRules) {
    if (lowerWord.endsWith(rule.suffix)) {
      const base = lowerWord.slice(0, -rule.remove);
      const result = rule.add ? base + rule.add : base;
      // 确保还原后的单词至少有两个字母
      if (result.length >= 2) {
        return result;
      }
    }
  }
  
  // 5. 返回原单词（小写）
  return lowerWord;
}

/**
 * 获取单词的中文释义 - 使用智能后缀去除
 */
export function getWordMeaning(word: string): { meaning: string; pos: string } | null {
  return smartLookup(word);
}

/**
 * 查找同词根的所有单词形式
 */
export function findWordFamily(root: string, text: string): string[] {
  const lowerRoot = root.toLowerCase();
  const family: Set<string> = new Set();
  
  // 正则匹配单词
  const wordRegex = /[a-zA-Z]+/g;
  let match;
  
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0].toLowerCase();
    const wordRoot = lemmatize(word);
    if (wordRoot === lowerRoot) {
      family.add(match[0]);
    }
  }
  
  return Array.from(family);
}

/**
 * 智能去后缀 - 尝试多种可能的还原形式
 */
function getStemVariants(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	
	// 双写辅音字母列表（常见需要双写的辅音结尾）
	const doubleConsonants = ['b', 'd', 'g', 'm', 'n', 'p', 'r', 's', 't'];
	
	// 以e结尾的动词（去e加ing/ed）
	const vowelEnding = /[aeiou]$/;
	
	// 以辅音+y结尾（去y加ied）
	const consonantYEnding = /[bcdfghjklmnpqrstvwxyz]y$/i;
	
	// 去-ed时尝试的各种形式
	if (lower.endsWith('ed')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'e');
		variants.push(lower.slice(0, -1));
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
		if (consonantYEnding.test(base)) {
			variants.push(base.slice(0, -1) + 'ied');
		}
	}
	
	// 去-ing时尝试的各种形式
	if (lower.endsWith('ing')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		if (vowelEnding.test(base.slice(-2, -1))) {
			variants.push(base + 'e');
		}
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-s时尝试的各种形式
	if (lower.endsWith('s') && lower.length > 2) {
		const base = lower.slice(0, -1);
		if (lower.endsWith('es')) {
			const baseEs = lower.slice(0, -2);
			variants.push(baseEs);
			if (/[shxz]/.test(baseEs.slice(-1)) || baseEs.endsWith('ch') || baseEs.endsWith('o')) {
				variants.push(baseEs);
			}
			if (consonantYEnding.test(baseEs)) {
				variants.push(baseEs.slice(0, -1) + 'ied');
			}
		}
		variants.push(base);
		if (consonantYEnding.test(base)) {
			variants.push(base.slice(0, -1) + 'ies');
		}
	}
	
	// 去-er时尝试的各种形式
	if (lower.endsWith('er')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-est时尝试的各种形式
	if (lower.endsWith('est')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-ly时尝试的各种形式
	if (lower.endsWith('ly')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'le');
		variants.push(base + 'y');
		if (lower.endsWith('ally')) {
			variants.push(lower.slice(0, -4));
		}
	}
	
	// 去后缀后再去后缀
	if (variants.length > 0) {
		const uniqueVariants = [...new Set(variants)];
		for (const v of uniqueVariants) {
			if (v !== lower && v.length > 2) {
				const recursive = getStemVariants(v);
				for (const r of recursive) {
					if (!variants.includes(r)) {
						variants.push(r);
					}
				}
			}
		}
	}
	
	const unique = [...new Set(variants)];
	return unique.filter(v => v.length >= 2 && v !== lower);
}

/**
 * 智能词典查找 - 支持后缀智能去除
 */
export function smartLookup(word: string): { meaning: string; pos: string } | null {
	const lower = word.toLowerCase();
	
	// 1. 先查原始单词
	if (englishDictionary[lower]) {
		return englishDictionary[lower];
	}
	
	// 2. 获取所有可能的词根变体
	const variants = getStemVariants(lower);
	
	// 3. 按优先级尝试每个变体
	for (const variant of variants) {
		if (englishDictionary[variant]) {
			return englishDictionary[variant];
		}
	}
	
	// 4. 最后尝试lemmatize结果
	const lemma = lemmatize(lower);
	if (lemma !== lower && englishDictionary[lemma]) {
		return englishDictionary[lemma];
	}
	
	return null;
}

// ==================== English-English Dictionary ====================

// 英英词典 - 已移至 public/dict_builtin_en.json，动态加载
let englishDictionaryEn: Record<string, string> = {};
let builtinDictEnLoaded = false;

export async function loadBuiltinDictionaryEn(): Promise<void> {
  if (builtinDictEnLoaded) return;
  try {
    const resp = await fetch('/dict_builtin_en.json');
    if (resp.ok) {
      englishDictionaryEn = await resp.json();
      builtinDictEnLoaded = true;
      console.log('内置英英词典加载完成, 词条数:', Object.keys(englishDictionaryEn).length);
    }
  } catch (e) {
    console.warn('内置英英词典加载失败:', e);
  }
}

export function getWordMeaningEn(word: string): string | null {
  const lower = word.toLowerCase();
  
  // 1. 直接查找
  if (englishDictionaryEn[lower]) {
    return englishDictionaryEn[lower];
  }
  
  // 2. 获取词根变体
  const variants = getStemVariants(lower);
  for (const variant of variants) {
    if (englishDictionaryEn[variant]) {
      return englishDictionaryEn[variant];
    }
  }
  
  // 3. 最后尝试 lemmatize 结果
  const lemma = lemmatize(lower);
  if (lemma !== lower && englishDictionaryEn[lemma]) {
    return englishDictionaryEn[lemma];
  }
  
  return null;
}
