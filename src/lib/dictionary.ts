// 常用英语词典 - 已移至 public/dict_builtin.json，动态加载
let englishDictionary: Record<string, { meaning: string; pos: string }> = {};
let builtinDictLoaded = false;

export async function loadBuiltinDictionary(): Promise<void> {
  if (builtinDictLoaded) return;
  try {
    const [mainResp, extraResp] = await Promise.all([
      fetch('/dict_builtin.json'),
      fetch('/dict_builtin_extra.json'),
    ]);
    if (mainResp.ok) {
      englishDictionary = await mainResp.json();
      if (extraResp.ok) {
        const extra = await extraResp.json();
        englishDictionary = { ...englishDictionary, ...extra };
      }
      builtinDictLoaded = true;
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
  "shot": "shoot",
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

let _knownWords: Set<string> | null = null;

export function registerKnownWords(words: string[]) {
  if (!_knownWords) _knownWords = new Set();
  for (const w of words) _knownWords.add(w.toLowerCase());
}

function isKnownWord(w: string): boolean {
  if (englishDictionary[w]) return true;
  if (_knownWords?.has(w)) return true;
  return false;
}

const suffixRules: Array<{
  suffix: string; remove: number; add?: string; minBase: number;
  checkResult?: boolean;
  skipIfOrigKnown?: boolean;
}> = [
  { suffix: "ies", remove: 3, add: "y", minBase: 2, checkResult: true },
  { suffix: "es", remove: 2, minBase: 2, checkResult: true },
  { suffix: "s", remove: 1, minBase: 3, checkResult: true },
  { suffix: "ing", remove: 3, minBase: 3, checkResult: true },
  { suffix: "d", remove: 1, minBase: 3, checkResult: true },
  { suffix: "ed", remove: 2, minBase: 2, checkResult: true },
  { suffix: "er", remove: 2, minBase: 3, checkResult: true, skipIfOrigKnown: true },
  { suffix: "est", remove: 3, minBase: 3, checkResult: true, skipIfOrigKnown: true },
  { suffix: "ly", remove: 2, minBase: 3, checkResult: true, skipIfOrigKnown: true },
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
  
  // 4. 双写辅音 + ing/ed/er/est 还原 (running→run, stopped→stop, bigger→big)
  const DOUBLE_SUFFIXES = ["ing", "ed", "er", "est"];
  for (const sfx of DOUBLE_SUFFIXES) {
    if (lowerWord.endsWith(sfx) && lowerWord.length >= sfx.length + 3) {
      const base = lowerWord.slice(0, -sfx.length);
      if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
        const undoubled = base.slice(0, -1);
        if (undoubled.length >= 2 && /[aeiou]/.test(undoubled) && isKnownWord(undoubled)) {
          return undoubled;
        }
      }
    }
  }

  // 5. 一般后缀规则
  for (const rule of suffixRules) {
    if (lowerWord.endsWith(rule.suffix)) {
      const base = lowerWord.slice(0, -rule.remove);
      const result = rule.add ? base + rule.add : base;

      if (rule.suffix === "d" && !result.endsWith("e")) {
        continue;
      }

      if (result.length < rule.minBase || !/[aeiou]/.test(result)) {
        continue;
      }

      if (rule.checkResult && !isKnownWord(result)) {
        continue;
      }

      if (rule.skipIfOrigKnown && isKnownWord(lowerWord)) {
        continue;
      }

      return result;
    }
  }

  
  // 6. 返回原单词（小写）
  return lowerWord;
}

const DOUBLE_CONSONANTS = ['b', 'd', 'g', 'm', 'n', 'p', 'r', 't'];
function isVowel(ch: string): boolean {
  return 'aeiou'.includes(ch);
}

/**
 * 屈折还原（统计 / 标注分组用）：合并时态、复数、进行式等到词根。
 * 不做派生词缀 er/est/ly，避免 teacher→teach 类误匹配。
 * 不依赖词典是否收录词根。
 */
export function lemmatizeInflection(word: string): string {
  const lower = word.toLowerCase();

  if (irregularVerbs[lower]) return irregularVerbs[lower];
  if (verbForms[lower]) return verbForms[lower];
  if (irregularNouns[lower]) return irregularNouns[lower];

  for (const sfx of ['ing', 'ed'] as const) {
    if (!lower.endsWith(sfx) || lower.length < sfx.length + 3) continue;
    const base = lower.slice(0, -sfx.length);
    if (base.length >= 3) {
      const a = base[base.length - 1];
      const b = base[base.length - 2];
      const c = base[base.length - 3];
      if (
        a === b &&
        DOUBLE_CONSONANTS.includes(a) &&
        isVowel(c) &&
        (base.length < 4 || !isVowel(base[base.length - 4]))
      ) {
        return base.slice(0, -1);
      }
    }
  }

  if (lower.endsWith('ied') && lower.length > 4) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ies') && lower.length > 4) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ing') && lower.length > 4) {
    const base = lower.slice(0, -3);
    if (base.length >= 3) {
      return stemIngBase(base);
    }
  }
  if (lower.endsWith('ed') && lower.length > 3) {
    const baseEd = lower.slice(0, -2);
    if (baseEd.length >= 3 && !baseEd.endsWith('e')) return baseEd;
    const baseD = lower.slice(0, -1);
    if (baseD.endsWith('e') && baseD.length >= 3) return baseD;
  }
  if (lower.endsWith('es') && lower.length > 3) {
    const baseMinusEs = lower.slice(0, -2);
    if (baseMinusEs.length >= 2 && /[xz]$|ss$|[cs]h$/.test(baseMinusEs)) return baseMinusEs;
    if (baseMinusEs.length <= 3 && baseMinusEs.endsWith('s')) return baseMinusEs;
    const baseMinusS = lower.slice(0, -1);
    if (baseMinusS.endsWith('e') && baseMinusS.length >= 3) return baseMinusS;
  }
  if (
    lower.endsWith('s') &&
    lower.length > 3 &&
    !lower.endsWith('ss') &&
    !lower.endsWith('us')
  ) {
    return lower.slice(0, -1);
  }

  return lower;
}

/** -ing 词干还原：making→make, backing→back, writing→write */
function stemIngBase(base: string): string {
  if (base.endsWith('x') || base.endsWith('ck') || base.endsWith('ng')) return base;
  if (base.length <= 3) return base + 'e';
  if (/[aeiou][b-df-hj-np-tv-z]$/.test(base) && !base.endsWith('w')) return base + 'e';
  return base;
}

/** 标注/词汇表统一使用的屈折词根 key */
export function getCanonicalLemma(word: string, lemma?: string): string {
  const raw = (lemma?.trim() || word).toLowerCase().trim();
  return lemmatizeInflection(raw);
}

/** 按词根查找标注（兼容旧数据中 surface form key） */
export function resolveAnnotation<
  T extends { root: string; meaning: string; pos: string; count?: number; cefrLevel?: string },
>(annotations: Record<string, T> | undefined, word: string, lemma?: string): T | undefined {
  if (!annotations) return undefined;
  const canonical = getCanonicalLemma(word, lemma);
  if (annotations[canonical]) return annotations[canonical];
  const lower = word.toLowerCase();
  if (annotations[lower]) return annotations[lower];
  for (const [key, ann] of Object.entries(annotations)) {
    if (lemmatizeInflection(key) === canonical) return ann;
    if (lemmatizeInflection(ann.root) === canonical) return ann;
  }
  return undefined;
}

/** 收集与某词根对应的全部 annotation key（用于删除） */
export function collectAnnotationKeysForLemma(
  annotations: Record<string, unknown>,
  word: string,
  lemma?: string,
): string[] {
  const canonical = getCanonicalLemma(word, lemma);
  const keys = new Set<string>();
  for (const key of Object.keys(annotations)) {
    if (lemmatizeInflection(key) === canonical) keys.add(key);
  }
  keys.add(canonical);
  return [...keys];
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
    const wordRoot = lemmatizeInflection(word);
    if (wordRoot === lowerRoot) {
      family.add(match[0]);
    }
  }
  
  return Array.from(family);
}

/**
 * 获取单词的中文释义 - 使用智能后缀去除
 */
export function getWordMeaning(word: string): { meaning: string; pos: string } | null {
  return smartLookup(word);
}

/**
 * 将标注表按屈折词根合并（合并 count，保留已有释义）
 */
export function normalizeAnnotationsToLemma<
  T extends { root: string; meaning: string; pos: string; count: number; cefrLevel?: string },
>(annotations: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, ann] of Object.entries(annotations)) {
    const root = lemmatizeInflection(ann.root || key);
    const merged: T = { ...ann, root };
    const existing = out[root];
    if (!existing) {
      out[root] = merged;
      continue;
    }
    out[root] = {
      ...existing,
      count: (existing.count ?? 0) + (merged.count ?? 0),
      meaning: existing.meaning || merged.meaning,
      cefrLevel: existing.cefrLevel || merged.cefrLevel,
    };
  }
  return out;
}

/**
 * 保守的屈折变体生成 - 只处理英语动词/名词的"变形"形式，
 * 不做派生形态学（er/est/ly/ness/ment/...）也不做前缀剥离，
 * 避免产生 pier→pie、unaging→age 这类错误匹配。
 */
function getStemVariants(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	const doubleConsonants = ['b', 'd', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't'];

	// -ies → y  (tries → try)
	if (lower.endsWith('ies') && lower.length > 4) {
		variants.push(lower.slice(0, -3) + 'y');
	}
	// -es → 去 es （boxes → box）或 去 s （places → place）
	if (lower.endsWith('es') && lower.length > 3) {
		variants.push(lower.slice(0, -2));
		variants.push(lower.slice(0, -1));
	}
	// -s → 去 s （dogs → dog）
	if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2) {
		variants.push(lower.slice(0, -1));
	}
	// -ied → y  (tried → try)
	if (lower.endsWith('ied') && lower.length > 4) {
		variants.push(lower.slice(0, -3) + 'y');
	}
	// -ed → 去 ed/d；双写辅音还原 (stopped→stop)
	if (lower.endsWith('ed') && lower.length > 3) {
		variants.push(lower.slice(0, -2));
		variants.push(lower.slice(0, -1));
		const tail = lower.slice(0, -2);
		if (tail.length >= 2) {
			const a = tail[tail.length - 1];
			const b = tail[tail.length - 2];
			if (a === b && doubleConsonants.includes(a)) {
				variants.push(tail.slice(0, -1));
			}
		}
	}
	// -ing → 去 ing/+e；双写辅音还原 (running→run)
	if (lower.endsWith('ing') && lower.length > 4) {
		const base = lower.slice(0, -3);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const a = base[base.length - 1];
			const b = base[base.length - 2];
			if (a === b && doubleConsonants.includes(a)) {
				variants.push(base.slice(0, -1));
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
    const [mainResp, extraResp] = await Promise.all([
      fetch('/dict_builtin_en.json'),
      fetch('/dict_builtin_en_extra.json'),
    ]);
    if (mainResp.ok) {
      englishDictionaryEn = await mainResp.json();
      if (extraResp.ok) {
        const extra = await extraResp.json();
        englishDictionaryEn = { ...englishDictionaryEn, ...extra };
      }
      builtinDictEnLoaded = true;
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
