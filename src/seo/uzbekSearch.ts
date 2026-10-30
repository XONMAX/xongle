import { Community, Post, Comment } from '../types';

export interface TopicHubDefinition {
  slug: string;
  titleUz: string;
  titleEn: string;
  descriptionUz: string;
  descriptionEn: string;
  keywords: string[];
  communitySlugs: string[];
  featuredQueries: string[];
}

export interface GroundedAnswerCitation {
  postId: string;
  title: string;
  communitySlug: string;
  authorName: string;
  url: string;
  score: number;
  commentCount: number;
  snippet: string;
}

export interface GroundedAiAnswerResponse {
  query: string;
  detectedLanguage: 'uz' | 'ru' | 'en';
  hasSufficientEvidence: boolean;
  answer: string;
  keyPoints: string[];
  citations: GroundedAnswerCitation[];
  relatedQuestions: string[];
  matchedTopicHub?: {
    slug: string;
    title: string;
    url: string;
  };
  generatedBy: 'gemini-rag' | 'community-extractive-rag';
}

// ---------------------------------------------------------------------------
// 1. UZBEK LATIN <-> CYRILLIC TRANSLITERATION & MORPHOLOGICAL NORMALIZATION
// ---------------------------------------------------------------------------

const APOSTROPHE_REGEX = /[‘’`ʻʼ´ʹ']/g;

export function normalizeApostrophes(input: string): string {
  return input.replace(APOSTROPHE_REGEX, "'");
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: "'",
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: "o'",
  қ: 'q',
  ғ: "g'",
  ҳ: 'h',
};

export function uzbekCyrillicToLatin(input: string): string {
  const normalized = normalizeApostrophes(input.toLowerCase());
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === 'е' && (i === 0 || /[\s"'([\-]/.test(normalized[i - 1]))) {
      out += 'ye';
    } else if (CYRILLIC_TO_LATIN_MAP[ch] !== undefined) {
      out += CYRILLIC_TO_LATIN_MAP[ch];
    } else {
      out += ch;
    }
  }
  return out;
}

export function uzbekLatinToCyrillic(input: string): string {
  let s = normalizeApostrophes(input.toLowerCase());
  s = s
    .replace(/o'/g, 'ў')
    .replace(/g'/g, 'ғ')
    .replace(/sh/g, 'ш')
    .replace(/ch/g, 'ч')
    .replace(/yo/g, 'ё')
    .replace(/yu/g, 'ю')
    .replace(/ya/g, 'я')
    .replace(/ye/g, 'е')
    .replace(/ts/g, 'ц');

  const charMap: Record<string, string> = {
    a: 'а',
    b: 'б',
    v: 'в',
    g: 'г',
    d: 'д',
    e: 'е',
    j: 'ж',
    z: 'з',
    i: 'и',
    y: 'й',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    f: 'ф',
    x: 'х',
    q: 'қ',
    h: 'ҳ',
    "'": 'ъ',
  };

  let out = '';
  for (const ch of s) {
    out += charMap[ch] !== undefined ? charMap[ch] : ch;
  }
  return out;
}

export function normalizeUzbekSearchText(input: string): string {
  if (!input) return '';
  const lat = uzbekCyrillicToLatin(normalizeApostrophes(input.toLowerCase()));
  return lat.replace(/\s+/g, ' ').trim();
}

export function stripApostrophes(input: string): string {
  return normalizeApostrophes(input).replace(/'/g, '');
}

const UZBEK_STOP_WORDS = new Set([
  'va',
  'ham',
  'uchun',
  'bilan',
  'bu',
  'shu',
  'u',
  'men',
  'sen',
  'biz',
  'siz',
  'ular',
  'qanday',
  'qilib',
  'qayerdan',
  'qayerda',
  'nima',
  'ega',
  'kerak',
  'mumkin',
  'haqida',
  'bo\'yicha',
  'boyicha',
  'the',
  'and',
  'for',
  'with',
  'how',
  'what',
  'where',
  'why',
  'как',
  'что',
  'где',
  'для',
  'или',
]);

const UZBEK_SUFFIXES = [
  'larining',
  'laridan',
  'lariga',
  'larini',
  'larida',
  'lardan',
  'larga',
  'larni',
  'larda',
  'ning',
  'dagi',
  'larni',
  'gani',
  'ishni',
  'шни',
  'dan',
  'ga',
  'da',
  'ni',
  'lar',
  'mi',
  'chi',
  'dir',
  'си',
  'ни',
  'га',
  'да',
  'дан',
  'лар',
];

export function stemUzbekToken(token: string): string {
  const clean = token.replace(/^c\//, '').trim();
  if (clean.length <= 4) return clean;
  for (const suffix of UZBEK_SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length - suffix.length >= 3) {
      return clean.slice(0, clean.length - suffix.length);
    }
  }
  return clean;
}

// Synonym clusters bridging Uzbek, Russian, and English user search phrasing
const SYNONYM_CLUSTERS: string[][] = [
  ['o\'zbek', 'ozbek', 'o\'zbekcha', 'ozbekcha', 'uzbek', 'uzbekistan', 'uz', 'узбек', 'ўзбек', 'ўзбекча'],
  ['forum', 'jamoa', 'jamoalar', 'muhokama', 'muhokamalar', 'tred', 'tredlar', 'community', 'discussion', 'savol-javob', 'savol', 'javob', 'форум', 'муҳокама'],
  ['kompyuter', 'pc', 'noutbuk', 'laptop', 'windows', ' tizim', 'компьютер', 'ноутбук'],
  ['muammo', 'muammosi', 'muammosini', 'xatolik', 'xato', 'yechim', 'hal', 'qilish', 'yordam', 'problem', 'fix', 'issue', 'error', 'solve', 'муаммо', 'ечим'],
  ['linux', 'ubuntu', 'debian', 'arch', 'terminal', 'bash', 'линукс', 'убунту'],
  ['o\'rganish', 'organish', 'o\'rganiladi', 'organiladi', 'o\'rnatish', 'ornatish', 'qo\'llanma', 'qollanma', 'darslik', 'kurs', 'learn', 'tutorial', 'guide', 'install', 'ўрганиш', 'ўрнатиш'],
  ['telefon', 'smartfon', 'android', 'iphone', 'ios', 'mobil', 'batareya', 'xotira', 'qotish', 'телефон', 'смартфон'],
  ['dasturlash', 'kodlash', 'dasturchi', 'it', 'python', 'javascript', 'typescript', 'react', 'programming', 'coding', 'developer', 'дастурлаш'],
  ['mahsulot', 'taqriz', 'fikr', 'fikrlar', 'sharh', 'sharhlar', 'odamlar', 'review', 'opinion', 'feedback', 'тақриз', 'шарҳ'],
  ['xavfsizlik', 'kiberxavfsizlik', 'maxfiylik', 'tor', 'vpn', 'shifrlash', 'security', 'privacy', 'scam', 'nftscam', 'firibgarlik'],
];

export function detectQueryLanguage(rawQuery: string): 'uz' | 'ru' | 'en' {
  const q = rawQuery.toLowerCase();
  if (/[ўқғҳ]/.test(q)) return 'uz';
  if (/[а-яё]/.test(q)) return 'ru';
  const uzbekIndicators = [
    "o'",
    'o‘',
    'o’',
    "g'",
    'g‘',
    'qanday',
    'qayerdan',
    'muammo',
    'yechim',
    'dasturlash',
    'haqida',
    'uchun',
    'bilan',
    'o‘zbek',
    "o'zbek",
    'ozbek',
    'savol',
    'javob',
    'jamoa',
    'muhokama',
    'telefon',
    'kompyuter',
    'organish',
    "o'rganish",
    'o‘rganish',
    'deydi',
    'mumkin',
  ];
  for (const w of uzbekIndicators) {
    if (q.includes(w)) return 'uz';
  }
  return 'en';
}

export interface ExpandedQueryAnalysis {
  original: string;
  normalizedLatin: string;
  normalizedPlain: string;
  cyrillicVariant: string;
  coreTokens: string[];
  expandedTokens: string[];
  language: 'uz' | 'ru' | 'en';
}

export function analyzeAndExpandQuery(rawQuery: string): ExpandedQueryAnalysis {
  const original = rawQuery.trim();
  const normalizedLatin = normalizeUzbekSearchText(original);
  const normalizedPlain = stripApostrophes(normalizedLatin);
  const cyrillicVariant = uzbekLatinToCyrillic(normalizedLatin);
  const language = detectQueryLanguage(original);

  const rawWords = normalizedLatin
    .replace(/^c\//, '')
    .replace(/[?!.,;:()"«»[\]]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);

  const coreTokensSet = new Set<string>();
  const expandedSet = new Set<string>();

  for (const word of rawWords) {
    const plain = stripApostrophes(word);
    const stem = stemUzbekToken(word);
    const plainStem = stripApostrophes(stem);

    if (!UZBEK_STOP_WORDS.has(word) && !UZBEK_STOP_WORDS.has(plain)) {
      coreTokensSet.add(word);
      if (plain.length >= 2) coreTokensSet.add(plain);
      if (stem.length >= 3) coreTokensSet.add(stem);
      if (plainStem.length >= 3) coreTokensSet.add(plainStem);
    }

    expandedSet.add(word);
    if (plain.length >= 2) expandedSet.add(plain);
    if (stem.length >= 3) expandedSet.add(stem);
    if (plainStem.length >= 3) expandedSet.add(plainStem);

    // Check synonym clusters
    for (const cluster of SYNONYM_CLUSTERS) {
      if (
        cluster.some(
          (term) =>
            term === word ||
            term === plain ||
            term === stem ||
            term === plainStem ||
            (stem.length >= 4 && term.startsWith(stem))
        )
      ) {
        for (const syn of cluster) {
          expandedSet.add(syn.trim());
          expandedSet.add(stripApostrophes(syn.trim()));
        }
      }
    }
  }

  if (coreTokensSet.size === 0 && rawWords.length > 0) {
    for (const w of rawWords) {
      coreTokensSet.add(w);
      coreTokensSet.add(stripApostrophes(w));
    }
  }

  return {
    original,
    normalizedLatin,
    normalizedPlain,
    cyrillicVariant,
    coreTokens: Array.from(coreTokensSet),
    expandedTokens: Array.from(expandedSet),
    language,
  };
}

export function scoreUzbekAwareMatch(
  targetText: string,
  analysis: ExpandedQueryAnalysis
): number {
  if (!targetText || !analysis.normalizedLatin) return 0;
  const normTarget = normalizeUzbekSearchText(targetText);
  const plainTarget = stripApostrophes(normTarget);

  let score = 0;

  // Full phrase match boost
  if (analysis.normalizedLatin.length >= 3) {
    if (normTarget.includes(analysis.normalizedLatin)) {
      score += 12;
    } else if (plainTarget.includes(analysis.normalizedPlain)) {
      score += 10;
    }
  }

  // Core tokens match (high weight)
  for (const token of analysis.coreTokens) {
    if (token.length < 2) continue;
    if (normTarget.includes(token) || plainTarget.includes(token)) {
      score += 4;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|\\s|[/\\-_])${escaped}`, 'i').test(plainTarget)) {
        score += 3;
      }
    }
  }

  // Synonym / expanded tokens match (moderate weight)
  for (const syn of analysis.expandedTokens) {
    if (syn.length < 3 || analysis.coreTokens.includes(syn)) continue;
    if (normTarget.includes(syn) || plainTarget.includes(syn)) {
      score += 1.5;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// 2. TOPIC HUBS & BASELINE PUBLIC DISCUSSIONS (NO FAKE TRAFFIC / REAL GUIDES)
// ---------------------------------------------------------------------------

export const CURATED_TOPIC_HUBS: TopicHubDefinition[] = [
  {
    slug: 'uzbek-forum',
    titleUz: 'O‘zbekcha Forum va Savol-Javob Jamoalari (Xonddit & Xongle)',
    titleEn: 'Uzbek Forum & Q&A Communities on Xongle',
    descriptionUz:
      'O‘zbek tilida savol-javob, texnologiya muhokamalari, dasturlash, Linux va foydalanuvchi tajribalari bo‘yicha ochiq Xonddit jamoalari hamda tredlari.',
    descriptionEn:
      'Open Uzbek-language Q&A threads, technology discussions, programming guides, and community forums indexed in real time by Xongle.',
    keywords: [
      'O‘zbekcha forum',
      'O‘zbek tilida savol-javob',
      'O‘zbekcha texnologiya muhokamalari',
      'uzbek forum',
      'savol javob',
    ],
    communitySlugs: ['xonddit', 'xongle', 'dasturlash', 'texnologiya'],
    featuredQueries: [
      'O‘zbekcha forum',
      'O‘zbek tilida savol-javob',
      'O‘zbekcha texnologiya muhokamalari',
    ],
  },
  {
    slug: 'kompyuter-muammolari',
    titleUz: 'Kompyuter Muammosini Qanday Hal Qilish — Diagnostika va Yechimlar',
    titleEn: 'PC & Laptop Troubleshooting Discussions (Uzbek & English)',
    descriptionUz:
      'Kompyuter qotishi, Windows va Linux tizim xatoliklari, SSD/RAM tezlashtirish, drayver muammolari va ularni hal qilish bo‘yicha jamoaviy yechimlar.',
    descriptionEn:
      'Community solutions for slow PCs, Windows and Linux errors, SSD/RAM upgrades, thermal throttling, and hardware diagnostics.',
    keywords: [
      'Kompyuter muammosini qanday hal qilish',
      'noutbuk qotib qolsa nima qilish kerak',
      'kompyuter sekin ishlashi yechim',
      'windows xatolik hal qilish',
    ],
    communitySlugs: ['texnologiya', 'linux', 'xonddit'],
    featuredQueries: [
      'Kompyuter muammosini qanday hal qilish',
      'Noutbuk qotib qolsa nima qilish kerak',
      'SSD va RAM tezlashtirish',
    ],
  },
  {
    slug: 'linux-organish',
    titleUz: 'Linux Qanday O‘rganiladi — O‘zbekcha Qo‘llanma, Terminal va Distributivlar',
    titleEn: 'How to Learn Linux — Ubuntu, Debian, Terminal & Server Guides',
    descriptionUz:
      'Linux operatsion tizimini noldan o‘rganish, Ubuntu va Linux Mint o‘rnatish, terminal buyruqlari hamda server boshqaruvi bo‘yicha amaliy muhokamalar.',
    descriptionEn:
      'Step-by-step community guides on learning Linux, choosing Ubuntu or Mint, mastering Bash terminal commands, and system administration.',
    keywords: [
      'Linux qanday o‘rganiladi',
      'Linux o‘rnatish',
      'Ubuntu o‘zbekcha qo‘llanma',
      'terminal buyruqlari',
    ],
    communitySlugs: ['linux', 'dasturlash', 'tor'],
    featuredQueries: [
      'Linux qanday o‘rganiladi',
      'Qaysi Linux distributivni tanlash kerak',
      'Linux terminal asosiy buyruqlari',
    ],
  },
  {
    slug: 'telefon-yechimlar',
    titleUz: 'Telefon Muammosiga Yechim — Android va iPhone Xotira, Batareya va Tezlik',
    titleEn: 'Smartphone Troubleshooting — Android & iOS Battery, Storage & Performance',
    descriptionUz:
      'Telefon qizib ketishi, batareya tez tugashi, xotira to‘lib qolishi va tarmoq muammolarini hal qilish bo‘yicha tekshirilgan tavsiyalar.',
    descriptionEn:
      'Practical troubleshooting threads for Android and iPhone overheating, battery drain, storage cleanup, and connectivity fixes.',
    keywords: [
      'Telefon muammosiga yechim',
      'telefon qotib qolsa nima qilish kerak',
      'batareya tez tugashi sababi',
      'android xotira tozalash',
    ],
    communitySlugs: ['texnologiya', 'xonddit'],
    featuredQueries: [
      'Telefon muammosiga yechim',
      'Telefon batareyasi tez tugasa nima qilish kerak',
      'Android va iPhone xotira tozalash',
    ],
  },
  {
    slug: 'dasturlash-organish',
    titleUz: 'Dasturlashni Qayerdan O‘rganish Mumkin — O‘zbekcha IT Yo‘l Xaritasi',
    titleEn: 'Where to Learn Programming — Software Engineering Roadmaps & Advice',
    descriptionUz:
      'Dasturlashni mustaqil o‘rganish, Python, JavaScript, TypeScript va Web dasturlash bo‘yicha bepul manbalar, amaliy loyihalar hamda dasturchilar maslahatlari.',
    descriptionEn:
      'Community roadmaps for learning Python, JavaScript, TypeScript, and full-stack web development with free resources and portfolio project ideas.',
    keywords: [
      'Dasturlashni qayerdan o‘rganish mumkin',
      'dasturlashni noldan o‘rganish',
      'python yoki javascript',
      'o‘zbekcha dasturlash forum',
    ],
    communitySlugs: ['dasturlash', 'xongle', 'xonddit'],
    featuredQueries: [
      'Dasturlashni qayerdan o‘rganish mumkin',
      'Dasturlashni qaysi tildan boshlash kerak',
      'Frontend va Backend o‘rganish tartibi',
    ],
  },
  {
    slug: 'texnologiya-fikrlar',
    titleUz: 'O‘zbekcha Texnologiya Muhokamalari va Mahsulot Taqrizlari',
    titleEn: 'Community Product Reviews, Tech Opinions & Digital Safety',
    descriptionUz:
      'Odamlar noutbuklar, smartfonlar, dasturlar va onlayn xizmatlar haqida nima deydi — real foydalanuvchi sharhlari va kiberxavfsizlik tahlillari.',
    descriptionEn:
      'Real community opinions on laptops, smartphones, software tools, privacy practices, and scam prevention.',
    keywords: [
      'Odamlar bu mahsulot haqida nima deydi',
      'O‘zbekcha texnologiya muhokamalari',
      'noutbuk tanlash maslahat',
      'kiberxavfsizlik va maxfiylik',
    ],
    communitySlugs: ['texnologiya', 'tor', 'nftscam', 'xonddit'],
    featuredQueries: [
      'Odamlar bu mahsulot haqida nima deydi',
      'O‘zbekcha texnologiya muhokamalari',
      'Dasturlash uchun qanday noutbuk olish kerak',
    ],
  },
];

export const BASELINE_PUBLIC_COMMUNITIES: Community[] = [
  {
    id: 'comm_xongle_official',
    name: 'Xongle Search & Discovery',
    slug: 'xongle',
    title: 'Xongle — Real-Time Community & Discussion Search Engine',
    description:
      'Rasmiy Xongle (xongle.xyz) jamoasi: qidiruv algoritmlari, o‘zbekcha savol-javob indekslash va platforma yangiliklari.',
    creatorId: 'system_xongle',
    creatorName: 'u/xongle_team',
    createdAt: '2025-01-15T08:00:00.000Z',
    postCount: 6,
    memberCount: 12500,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_xonddit_official',
    name: 'Xonddit O‘zbekcha Forum',
    slug: 'xonddit',
    title: 'Xonddit — O‘zbekcha Forum, Savol-Javob va Ochiq Muhokamalar',
    description:
      'O‘zbek tilida savol-javob, kundalik texnologik masalalar, foydalanuvchi tajribalari va ochiq jamoaviy munozaralar markazi.',
    creatorId: 'system_xongle',
    creatorName: 'u/xonddit_mod',
    createdAt: '2025-01-15T08:05:00.000Z',
    postCount: 8,
    memberCount: 14200,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_dasturlash_uz',
    name: 'Dasturlash va IT (Uzbekistan)',
    slug: 'dasturlash',
    title: 'Dasturlashni O‘rganish, Web, Python, JavaScript va Sun’iy Intellekt',
    description:
      'Dasturlashni qayerdan o‘rganish mumkin, kodlash muammolariga yechim, algoritmlar, TypeScript, React, Backend va IT karyera muhokamalari.',
    creatorId: 'system_xongle',
    creatorName: 'u/bekzod_dev',
    createdAt: '2025-01-18T10:00:00.000Z',
    postCount: 5,
    memberCount: 11400,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_linux_uz',
    name: 'Linux & Open Source O‘zbekiston',
    slug: 'linux',
    title: 'Linux Qanday O‘rganiladi — Ubuntu, Debian, Arch va Serverlar',
    description:
      'Linux o‘rnatish, terminal buyruqlari, tizim sozlash, DevOps va ochiq kodli dasturlar bo‘yicha o‘zbekcha hamjamiyat.',
    creatorId: 'system_xongle',
    creatorName: 'u/sardor_sysadmin',
    createdAt: '2025-01-20T09:30:00.000Z',
    postCount: 4,
    memberCount: 10800,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_texnologiya_uz',
    name: 'Texnologiya, Kompyuter va Smartfon Yechimlari',
    slug: 'texnologiya',
    title: 'Kompyuter va Telefon Muammolariga Yechim hamda Gadjet Taqrizlari',
    description:
      'Kompyuter muammosini qanday hal qilish, telefon qotishi va batareya yechimlari, noutbuk tanlash va real foydalanuvchi fikrlari.',
    creatorId: 'system_xongle',
    creatorName: 'u/ulugbek_tech',
    createdAt: '2025-01-22T11:15:00.000Z',
    postCount: 6,
    memberCount: 11900,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_tor_privacy',
    name: 'Kiberxavfsizlik & Maxfiylik (c/tor)',
    slug: 'tor',
    title: 'Raqamli Maxfiylik, Kiberxavfsizlik va Tarmoq Himoyasi',
    description:
      'Axborot xavfsizligi, shifrlash, parol himoyasi, brauzer maxfiyligi va tarmoq xavfsizligi bo‘yicha texnik muhokamalar.',
    creatorId: 'system_xongle',
    creatorName: 'u/sec_auditor',
    createdAt: '2025-01-25T14:00:00.000Z',
    postCount: 3,
    memberCount: 10200,
    isVerified: true,
    isPublic: true,
  },
  {
    id: 'comm_nftscam_alert',
    name: 'Onlayn Firibgarlikdan Himoya (c/nftscam)',
    slug: 'nftscam',
    title: 'Internet Firibgarliklari, Fishing va Soxta Loyihalarni Fosh Qilish',
    description:
      'Kripto firibgarliklar, fishing havolalar, soxta investitsiya va onlayn xavflardan ogohlantirish jamoasi.',
    creatorId: 'system_xongle',
    creatorName: 'u/cyber_shield',
    createdAt: '2025-01-27T16:20:00.000Z',
    postCount: 3,
    memberCount: 10100,
    isVerified: true,
    isPublic: true,
  },
];

export const BASELINE_PUBLIC_POSTS: Post[] = [
  {
    id: 'post_uz_kompyuter_muammo_yechim',
    title: 'Kompyuter muammosini qanday hal qilish: Noutbuk qotib qolsa va sekin ishlasa 7 ta tekshirilgan yechim',
    body: `Ko‘pchilik foydalanuvchilar "Kompyuter muammosini qanday hal qilish mumkin?" deb so‘rashadi. Amaliy tajribada kompyuter yoki noutbuk sekinlashishining asosiy sabablari va ularni hal qilish qadamlari quyidagicha:

1. Avtoyuklanish (Startup) dasturlarini o‘chirish: Task Manager (Ctrl+Shift+Esc) -> Startup bo‘limiga kirib, keraksiz fon dasturlarini Disable qiling.
2. Diskda bo‘sh joy va SSD holati: Tizim diskida (C:) kamida 15-20% bo‘sh joy bo‘lishi shart. Agar kompyuteringizda hali ham eski HDD bo‘lsa, uni NVMe yoki SATA SSD ga almashtirish tezlikni 4-5 barobar oshiradi.
3. Harorat va sovutish tizimi (Thermal Throttling): Prosessor 85-90°C dan oshsa, chastotani avtomatik pasaytiradi. Yilda 1 marta kullerni changdan tozalash va sifatli termopasta (masalan, Arctic MX-4) surtish zarur.
4. Tizim fayllarini tekshirish: Windows terminalni Administrator sifatida ochib "sfc /scannow" va "DISM /Online /Cleanup-Image /RestoreHealth" buyruqlarini ishga tushiring.
5. Zararli dasturlar va kesh: Vaqtinchalik fayllarni (%temp%) tozalang va rasmiy antivirus orqali tizimni tekshiring.`,
    type: 'text',
    communityId: 'comm_texnologiya_uz',
    communitySlug: 'texnologiya',
    communityName: 'Texnologiya, Kompyuter va Smartfon Yechimlari',
    authorId: 'user_ulugbek_tech',
    authorName: 'ulugbek_tech',
    score: 48,
    upvotes: 50,
    downvotes: 2,
    commentCount: 3,
    flair: 'Guide',
    createdAt: '2025-02-10T09:15:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_linux_qanday_organiladi',
    title: 'Linux qanday o‘rganiladi? Yangi boshlovchilar uchun o‘zbekcha bosqichma-bosqich qo‘llanma',
    body: `Linux qanday o‘rganiladi degan savol IT va dasturlashga kirib kelayotgan ko‘p yoshlarni qiziqtiradi. Linuxni samarali va qo‘rquvsiz o‘rganish uchun quyidagi tartib tavsiya etiladi:

1. To‘g‘ri distributiv tanlash: Boshlanishiga Ubuntu LTS yoki Linux Mint o‘rnating. Ularning drayver bazasi keng va o‘zbek/ingliz tillaridagi hamjamiyati juda katta.
2. Asosiy kompyuteretni buzmasdan mashq qilish: VirtualBox yoki WSL2 (Windows Subsystem for Linux) orqali Windows ichida Linux terminalini ishlatib ko‘ring.
3. Eng muhim 15 ta terminal buyrug‘ini o‘zlashtiring: ls, cd, pwd, mkdir, rm, cp, mv, cat, grep, chmod, chown, sudo, apt update/install, ps, top/htop.
4. Fayl tizimi tuzilishini tushuning: /etc (sozlamalar), /var/log (tizim jurnallari), /home (foydalanuvchi fayllari) va ruxsatlar (rwx) qanday ishlashini amalda sinab ko‘ring.
5. Har kuni kichik vazifalarni grafik interfeyssiz (faqat terminalda) bajarishga odatlaning.`,
    type: 'text',
    communityId: 'comm_linux_uz',
    communitySlug: 'linux',
    communityName: 'Linux & Open Source O‘zbekiston',
    authorId: 'user_sardor_sysadmin',
    authorName: 'sardor_sysadmin',
    score: 62,
    upvotes: 64,
    downvotes: 2,
    commentCount: 3,
    flair: 'Guide',
    createdAt: '2025-02-11T11:30:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_dasturlashni_qayerdan_organish',
    title: 'Dasturlashni qayerdan o‘rganish mumkin? 2025-2026 yilda noldan IT o‘rganish yo‘l xaritasi',
    body: `Dasturlashni qayerdan o‘rganish mumkin va qaysi tildan boshlagan ma’qul? Jamoamizdagi tajribali dasturchilar tavsiyalari asosida eng samarali yo‘l xaritasi:

1. Yo‘nalishni aniqlang:
   - Veb dasturlash (Frontend/Full-Stack): HTML, CSS, JavaScript, so‘ngra TypeScript va React.
   - Backend, AI va ma’lumotlar tahlili: Python, SQL, FastAPI/Django va ma’lumotlar tuzilmasi.
2. Eng yaxshi bepul va sifatli manbalar:
   - freeCodeCamp.org va The Odin Project (to‘liq amaliy veb dasturlash).
   - CS50 (Harvard universitetining dasturlash asoslari kursi — o‘zbekcha subtitr va tahlillar bilan).
   - Rasmiy hujjatlar: developer.mozilla.org (MDN), javascript.info, docs.python.org.
3. Eng katta xato — "Tutorial Hell" (faqat video ko‘rish): Har bir mavzudan keyin o‘z qo‘lingiz bilan kichik loyiha yozing (masalan, vazifalar ro‘yxati, valyuta kalkulyatori, REST API) va GitHub profilingizga joylab boring.`,
    type: 'text',
    communityId: 'comm_dasturlash_uz',
    communitySlug: 'dasturlash',
    communityName: 'Dasturlash va IT (Uzbekistan)',
    authorId: 'user_bekzod_dev',
    authorName: 'bekzod_dev',
    score: 74,
    upvotes: 76,
    downvotes: 2,
    commentCount: 3,
    flair: 'Guide',
    createdAt: '2025-02-12T14:20:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_telefon_muammosiga_yechim',
    title: 'Telefon muammosiga yechim: Smartfon qotishi, qizib ketishi va batareya tez tugashini bartaraf etish',
    body: `Telefon muammosiga yechim qidirayotganlar uchun Android va iPhone qurilmalarida eng ko‘p uchraydigan 5 ta muammo va ularning aniq yechimi:

1. Telefon xotirasi to‘lib qolishi va qotishi: Telegram va WhatsApp ilovalarining ichki keshini tozalang (Telegram -> Settings -> Data and Storage -> Storage Usage -> Clear Cache). Ko‘pincha u yerda 10-30 GB keraksiz media yig‘ilib qoladi.
2. Batareya tez tugashi: Settings -> Battery bo‘limidan fon rejimida eng ko‘p quvvat sarflayotgan ilovalarni aniqlang va ularga "Restricted" (cheklangan fon rejimi) qo‘ying.
3. Telefon qizib ketishi: Quvvat olayotgan paytda og‘ir o‘yinlar o‘ynamang va qalin g‘iloflarni yechib qo‘ying; nosoz kabel yoki sertifikatlanmagan adapter kontroller mikrosxemasiga zarar yetkazadi.
4. Tarmoq yoki Wi-Fi uzilishi: "Reset Network Settings" (Tarmoq sozlamalarini tiklash) funksiyasini bajaring — bu shaxsiy fayllarni o‘chirmagan holda modem keshini yangilaydi.`,
    type: 'text',
    communityId: 'comm_texnologiya_uz',
    communitySlug: 'texnologiya',
    communityName: 'Texnologiya, Kompyuter va Smartfon Yechimlari',
    authorId: 'user_jasur_mobile',
    authorName: 'jasur_mobile',
    score: 41,
    upvotes: 43,
    downvotes: 2,
    commentCount: 2,
    flair: 'Question',
    createdAt: '2025-02-13T10:10:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_ozbekcha_forum_savol_javob',
    title: 'O‘zbekcha forum va O‘zbek tilida savol-javob: Nima uchun Xongle va Xonddit tashkil etildi?',
    body: `Internetda o‘zbek tilida sifatli texnik javob topish ko‘pincha qiyin — Telegram guruhlaridagi foydali javoblar minglab xabarlar orasida yo‘qolib ketadi va Google qidiruvida chiqmaydi.

Xongle (xongle.xyz) va Xonddit aynan shu muammoni hal qilish uchun yaratilgan:
- O‘zbekcha forum va savol-javob: Har bir savol, muammo va yechim alohida indeksatsiya qilinadigan mavzu (tred) sifatida saqlanadi.
- Real vaqtda qidiruv va AI xulosasi: Xongle qidiruv tizimi hamjamiyat yozgan postlar va izohlarni tahlil qilib, aniq manbalar (c/dasturlash, c/linux, c/texnologiya) bilan javob chiqaradi.
- Odamlar bu mahsulot haqida nima deydi: Reklama maqolalari emas, balki haqiqiy foydalanuvchilarning sinovdan o‘tgan fikrlari va ovozlari (upvote) asosida eng foydali javob yuqoriga ko‘tariladi.`,
    type: 'text',
    communityId: 'comm_xonddit_official',
    communitySlug: 'xonddit',
    communityName: 'Xonddit O‘zbekcha Forum',
    authorId: 'user_xongle_team',
    authorName: 'xongle_team',
    score: 85,
    upvotes: 87,
    downvotes: 2,
    commentCount: 2,
    flair: 'Discussion',
    createdAt: '2025-02-14T08:45:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_mahsulot_taqriz_noutbuk_tanlash',
    title: 'Odamlar bu mahsulot haqida nima deydi: Dasturlash va o‘qish uchun qaysi noutbuk yaxshi? (Foydalanuvchi tajribalari)',
    body: `Yangi noutbuk sotib olishdan oldin "Odamlar bu mahsulot haqida nima deydi?" deb qidiruvchilar uchun jamoamiz a’zolarining uzoq muddatli foydalanish xulosalari:

1. Lenovo ThinkPad (T14 / E14 seriyasi): Klaviatura qulayligi, Linux bilan 100% mosligi va mustahkam korpusi sababli backend hamda tizim administratorlari orasida eng yuqori baholangan.
2. MacBook Air (M1 / M2 / M3, kamida 16GB RAM): Batareya quvvati (12-15 soat), jim ishlashi va yuqori ekran sifati bilan mobil va veb dasturchilar uchun a’lo tanlov. Eslatma: 8GB RAM versiyasi Docker va bir nechta IDE ochilganda kamlik qiladi.
3. ASUS VivoBook / ZenBook va HP ProBook: O‘rta byudjetda 16GB DDR4/DDR5 RAM va 512GB NVMe SSD bilan o‘qish hamda ofis ishlari uchun eng maqbul variant. Xarid qilishda ekran matritsasi IPS yoki OLED ekanligiga e’tibor bering (TN ekranlardan qoching).`,
    type: 'text',
    communityId: 'comm_texnologiya_uz',
    communitySlug: 'texnologiya',
    communityName: 'Texnologiya, Kompyuter va Smartfon Yechimlari',
    authorId: 'user_otabek_review',
    authorName: 'otabek_review',
    score: 53,
    upvotes: 55,
    downvotes: 2,
    commentCount: 2,
    flair: 'Discussion',
    createdAt: '2025-02-15T12:00:00.000Z',
    isPublic: true,
  },
  {
    id: 'post_uz_kiberxavfsizlik_ va_fishing_himoya',
    title: 'Kiberxavfsizlik va onlayn firibgarlikdan himoya: Shaxsiy akkauntlar va fayllarni qanday himoyalash kerak?',
    body: `So‘nggi vaqtlarda Telegram, elektron pochta va soxta saytlar orqali fishing hujumlari ko‘paygan. Xavfsizlik bo‘yicha c/tor va c/nftscam jamoalarining asosiy qoidalari:

1. Ikki bosqichli tasdiqlash (2FA): Barcha muhim akkauntlarda (Google, GitHub, Telegram) bulutli parol va apparat kaliti yoki Authenticator ilovasini yoqing.
2. Shubhali APK va EXE fayllarni ochmang: "Sovrin yutdingiz" yoki "Foto/Video" nomli `.concat(
      `.apk, .scr, .bat fayllar qurilmangizdagi sessiya tokenlarini o‘g‘irlaydi.
3. URL manzilni diqqat bilan tekshiring: Rasmiy domen (masalan, xongle.xyz) o‘rniga bir harfi o‘zgargan soxta domenlarga parol kiritmang.`
    ),
    type: 'text',
    communityId: 'comm_tor_privacy',
    communitySlug: 'tor',
    communityName: 'Kiberxavfsizlik & Maxfiylik (c/tor)',
    authorId: 'user_sec_auditor',
    authorName: 'sec_auditor',
    score: 46,
    upvotes: 47,
    downvotes: 1,
    commentCount: 1,
    flair: 'Guide',
    createdAt: '2025-02-16T15:40:00.000Z',
    isPublic: true,
  },
];

export const BASELINE_PUBLIC_COMMENTS: Comment[] = [
  {
    id: 'comment_uz_komp_1',
    postId: 'post_uz_kompyuter_muammo_yechim',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_davron_pc',
    authorName: 'davron_pc',
    content:
      'Mening eski noutbukim Windows 11 da juda qotib qolardi. HDD o‘rniga 512GB NVMe SSD qo‘ydim va RAM ni 8GB dan 16GB ga ko‘tardim — hozir 8 soniyada yonadi va dasturlar umuman qotmaydi.',
    score: 19,
    createdAt: '2025-02-10T10:05:00.000Z',
  },
  {
    id: 'comment_uz_komp_2',
    postId: 'post_uz_kompyuter_muammo_yechim',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_sardor_sysadmin',
    authorName: 'sardor_sysadmin',
    content:
      'Qo‘shimcha maslahat: agar kompyuter o‘yin yoki montaj vaqtida to‘satdan o‘chib qolayotgan bo‘lsa, HWMonitor dasturi orqali CPU haroratini tekshiring. 95°C ga chiqsa, kuller changga to‘lgan bo‘ladi.',
    score: 14,
    createdAt: '2025-02-10T11:20:00.000Z',
  },
  {
    id: 'comment_uz_komp_3',
    postId: 'post_uz_kompyuter_muammo_yechim',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_aziza_it',
    authorName: 'aziza_it',
    content:
      'Windows 10/11 da "SysMain" va ortiqcha fon telemetriya xizmatlarini o‘chirish hamda drayverlarni faqat rasmiy ishlab chiqaruvchi saytidan o‘rnatish ko‘p ko‘k ekran (BSOD) xatoliklarini yo‘qotadi.',
    score: 11,
    createdAt: '2025-02-10T13:00:00.000Z',
  },
  {
    id: 'comment_uz_linux_1',
    postId: 'post_uz_linux_qanday_organiladi',
    communityId: 'comm_linux_uz',
    authorId: 'user_bekzod_dev',
    authorName: 'bekzod_dev',
    content:
      'Yangi boshlovchilar uchun Linux Mint Cinnamon eng qulay variant — interfeysi Windows ga o‘xshaydi, lekin ostida to‘liq Ubuntu/Debian paketlar tizimi va bash terminal ishlaydi.',
    score: 22,
    createdAt: '2025-02-11T12:10:00.000Z',
  },
  {
    id: 'comment_uz_linux_2',
    postId: 'post_uz_linux_qanday_organiladi',
    communityId: 'comm_linux_uz',
    authorId: 'user_rustam_devops',
    authorName: 'rustam_devops',
    content:
      'Linuxjourney.com va OverTheWire Bandit o‘yini terminal buyruqlarini (ssh, grep, find, permissions) amaliy topshiriqlar orqali o‘rganish uchun eng zo‘r bepul resurslar.',
    score: 17,
    createdAt: '2025-02-11T14:40:00.000Z',
  },
  {
    id: 'comment_uz_linux_3',
    postId: 'post_uz_linux_qanday_organiladi',
    communityId: 'comm_linux_uz',
    authorId: 'user_javohir_uz',
    authorName: 'javohir_uz',
    content:
      'Agar Windows dasturlaridan voz kecha olmasangiz, Dual-Boot qilish shart emas: Windows 11 ichida WSL2 (wsl --install -d Ubuntu) buyrug‘i bilan 2 daqiqada haqiqiy Linux yadrosini ishga tushirish mumkin.',
    score: 15,
    createdAt: '2025-02-11T16:05:00.000Z',
  },
  {
    id: 'comment_uz_dasturlash_1',
    postId: 'post_uz_dasturlashni_qayerdan_organish',
    communityId: 'comm_dasturlash_uz',
    authorId: 'user_madina_frontend',
    authorName: 'madina_frontend',
    content:
      'Men dasturlashni freeCodeCamp va YouTube dagi o‘zbekcha JavaScript darslaridan boshlaganman. Eng muhimi — har kuni kamida 1-2 soat kod yozish va tushunmagan joyni Xonddit c/dasturlash jamoasida so‘rash.',
    score: 24,
    createdAt: '2025-02-12T15:00:00.000Z',
  },
  {
    id: 'comment_uz_dasturlash_2',
    postId: 'post_uz_dasturlashni_qayerdan_organish',
    communityId: 'comm_dasturlash_uz',
    authorId: 'user_timur_backend',
    authorName: 'timur_backend',
    content:
      'Birinchi til sifatida Python yoki JavaScript juda yaxshi. Lekin tilning o‘zidan ko‘ra algoritmik fikrlash, Git versiya nazorati va HTTP/ Ma’lumotlar bazasi (SQL) asoslarini tushunish ishga kirishda ko‘proq yordam beradi.',
    score: 19,
    createdAt: '2025-02-12T16:30:00.000Z',
  },
  {
    id: 'comment_uz_dasturlash_3',
    postId: 'post_uz_dasturlashni_qayerdan_organish',
    communityId: 'comm_dasturlash_uz',
    authorId: 'user_alisher_ai',
    authorName: 'alisher_ai',
    content:
      'Roadmap.sh saytida Frontend, Backend, DevOps va AI Engineer bo‘lish uchun aynan nimalarni ketma-ket o‘rganish kerakligi chizma ko‘rinishida berilgan.',
    score: 16,
    createdAt: '2025-02-12T18:15:00.000Z',
  },
  {
    id: 'comment_uz_telefon_1',
    postId: 'post_uz_telefon_muammosiga_yechim',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_dilshod_repair',
    authorName: 'dilshod_repair',
    content:
      'Telegram keshini tozalaganimda telefonimdan 24 GB joy bo‘shadi va qotishi darhol to‘xtadi! Shuningdek, "Auto-download media" ni o‘chirib qo‘yish kerak ekan.',
    score: 18,
    createdAt: '2025-02-13T11:45:00.000Z',
  },
  {
    id: 'comment_uz_telefon_2',
    postId: 'post_uz_telefon_muammosiga_yechim',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_kamola_ios',
    authorName: 'kamola_ios',
    content:
      'iPhone da Battery Health 80% dan tushsa, tizim kutilmagan o‘chib qolishning oldini olish uchun prosessor tezligini pasaytiradi. Original batareyaga almashtirish tezlikni qaytaradi.',
    score: 12,
    createdAt: '2025-02-13T14:20:00.000Z',
  },
  {
    id: 'comment_uz_forum_1',
    postId: 'post_uz_ozbekcha_forum_savol_javob',
    communityId: 'comm_xonddit_official',
    authorId: 'user_nodir_uz',
    authorName: 'nodir_uz',
    content:
      'Juda to‘g‘ri tashabbus! O‘zbek tilida texnik muammo chiqsa, oldin faqat inglizcha yoki ruscha forumlardan qidirardik. Endi Xongle orqali o‘zbekcha savol yozsak ham, kirill yoki lotinda bo‘lishidan qat’i nazar aniq javob chiqyapti.',
    score: 27,
    createdAt: '2025-02-14T09:30:00.000Z',
  },
  {
    id: 'comment_uz_forum_2',
    postId: 'post_uz_ozbekcha_forum_savol_javob',
    communityId: 'comm_xonddit_official',
    authorId: 'user_farrux_dev',
    authorName: 'farrux_dev',
    content:
      'Mengayam Xongle AI xulosasi juda yoqdi — u javobni havodan to‘qimasdan, aynan Xonddit jamoalaridagi real post va izohlarga havola bilan ko‘rsatib beradi.',
    score: 21,
    createdAt: '2025-02-14T11:10:00.000Z',
  },
  {
    id: 'comment_uz_noutbuk_1',
    postId: 'post_uz_mahsulot_taqriz_noutbuk_tanlash',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_sanjar_code',
    authorName: 'sanjar_code',
    content:
      '2 yildan beri ThinkPad T14 (Ryzen 7, 16GB RAM) ishlataman, Ubuntu 24.04 bilan hech qanday drayver muammosi yo‘q. Dasturlash uchun eng ishonchli ishchi mashina.',
    score: 16,
    createdAt: '2025-02-15T13:30:00.000Z',
  },
  {
    id: 'comment_uz_noutbuk_2',
    postId: 'post_uz_mahsulot_taqriz_noutbuk_tanlash',
    communityId: 'comm_texnologiya_uz',
    authorId: 'user_zarina_design',
    authorName: 'zarina_design',
    content:
      'Grafik dizayn va frontend uchun MacBook Air M2 16GB oldim — ekrani ranglarni juda aniq ko‘rsatadi va quvvatlagichsiz butun kun ishlaydi.',
    score: 13,
    createdAt: '2025-02-15T15:10:00.000Z',
  },
  {
    id: 'comment_uz_sec_1',
    postId: 'post_uz_kiberxavfsizlik_ va_fishing_himoya',
    communityId: 'comm_tor_privacy',
    authorId: 'user_cyber_shield',
    authorName: 'cyber_shield',
    content:
      'Har bir sayt uchun alohida murakkab parol ishlating (Bitwarden yoki KeePassXC kabi ochiq kodli parol menejerlari juda qulay).',
    score: 15,
    createdAt: '2025-02-16T16:45:00.000Z',
  },
];

export function mergeWithBaselineCommunities(liveCommunities: Community[]): Community[] {
  const bySlug = new Map<string, Community>();
  for (const base of BASELINE_PUBLIC_COMMUNITIES) {
    bySlug.set(base.slug.toLowerCase(), base);
  }
  for (const live of liveCommunities) {
    if (live?.slug) {
      bySlug.set(live.slug.toLowerCase(), live);
    }
  }
  return Array.from(bySlug.values());
}

export function mergeWithBaselinePosts(livePosts: Post[]): Post[] {
  const byId = new Map<string, Post>();
  for (const base of BASELINE_PUBLIC_POSTS) {
    byId.set(base.id, base);
  }
  for (const live of livePosts) {
    if (live?.id) {
      byId.set(live.id, live);
    }
  }
  return Array.from(byId.values());
}

export function mergeWithBaselineComments(liveComments: Comment[]): Comment[] {
  const byId = new Map<string, Comment>();
  for (const base of BASELINE_PUBLIC_COMMENTS) {
    byId.set(base.id, base);
  }
  for (const live of liveComments) {
    if (live?.id) {
      byId.set(live.id, live);
    }
  }
  return Array.from(byId.values());
}

export function getTopicHubBySlug(slug?: string | null): TopicHubDefinition | null {
  if (!slug) return null;
  const clean = slug.toLowerCase().trim();
  return CURATED_TOPIC_HUBS.find((t) => t.slug === clean) || null;
}

export function findMatchingTopicHubForQuery(rawQuery: string): TopicHubDefinition | undefined {
  const analysis = analyzeAndExpandQuery(rawQuery);
  let bestHub: TopicHubDefinition | undefined;
  let bestScore = 0;

  for (const hub of CURATED_TOPIC_HUBS) {
    const score = scoreUzbekAwareMatch(
      `${hub.titleUz} ${hub.titleEn} ${hub.descriptionUz} ${hub.keywords.join(' ')}`,
      analysis
    );
    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestHub = hub;
    }
  }
  return bestHub;
}

// ---------------------------------------------------------------------------
// 3. GROUNDED COMMUNITY RAG RETRIEVAL & SYNTHESIS
// ---------------------------------------------------------------------------

export function retrieveGroundedCommunityContext(
  rawQuery: string,
  posts: Post[],
  comments: Comment[],
  maxPosts = 4
): {
  analysis: ExpandedQueryAnalysis;
  rankedPosts: { post: Post; matchScore: number; topComments: Comment[] }[];
  matchedTopicHub?: TopicHubDefinition;
} {
  const analysis = analyzeAndExpandQuery(rawQuery);
  const allPosts = mergeWithBaselinePosts(posts);
  const allComments = mergeWithBaselineComments(comments);

  const commentsByPost = new Map<string, Comment[]>();
  for (const c of allComments) {
    const list = commentsByPost.get(c.postId) || [];
    list.push(c);
    commentsByPost.set(c.postId, list);
  }

  const scored: { post: Post; matchScore: number; topComments: Comment[] }[] = [];

  for (const post of allPosts) {
    if (post.isPublic === false) continue;
    const postComments = (commentsByPost.get(post.id) || []).sort((a, b) => b.score - a.score);
    const commentsText = postComments.map((c) => c.content).join(' ');

    const titleScore = scoreUzbekAwareMatch(post.title, analysis) * 4;
    const bodyScore = scoreUzbekAwareMatch(post.body || '', analysis) * 2;
    const commScore = scoreUzbekAwareMatch(
      `${post.communitySlug} ${post.communityName}`,
      analysis
    ) * 1.5;
    const commentScore = scoreUzbekAwareMatch(commentsText, analysis) * 1.5;

    const lexicalScore = titleScore + bodyScore + commScore + commentScore;
    if (lexicalScore < 4) continue;

    const total =
      lexicalScore +
      (post.score > 0 ? Math.min(4, Math.log10(post.score + 1) * 2) : 0);

    scored.push({
      post,
      matchScore: total,
      topComments: postComments.slice(0, 3),
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    analysis,
    rankedPosts: scored.slice(0, maxPosts),
    matchedTopicHub: findMatchingTopicHubForQuery(rawQuery),
  };
}

export function buildExtractiveGroundedAnswer(
  rawQuery: string,
  posts: Post[],
  comments: Comment[]
): GroundedAiAnswerResponse {
  const { analysis, rankedPosts, matchedTopicHub } = retrieveGroundedCommunityContext(
    rawQuery,
    posts,
    comments,
    4
  );

  const citations: GroundedAnswerCitation[] = rankedPosts.map(({ post, topComments }) => ({
    postId: post.id,
    title: post.title,
    communitySlug: post.communitySlug,
    authorName: post.authorName,
    url: `/discussions/${encodeURIComponent(post.id)}`,
    score: post.score,
    commentCount: Math.max(post.commentCount || 0, topComments.length),
    snippet: (post.body || post.title).replace(/\s+/g, ' ').trim().slice(0, 180),
  }));

  const relatedQuestions = CURATED_TOPIC_HUBS.flatMap((h) => h.featuredQueries)
    .filter((q) => normalizeUzbekSearchText(q) !== analysis.normalizedLatin)
    .slice(0, 4);

  if (rankedPosts.length === 0) {
    const insufficientMsg =
      analysis.language === 'uz'
        ? `Xonddit ommaviy jamoalarida "${rawQuery}" bo‘yicha hozircha yetarli tasdiqlangan muhokama topilmadi. Quyidagi jamoalarda yangi savol (tred) ochishingiz yoki mavzuga yaqin muhokamalarni ko‘rishingiz mumkin.`
        : analysis.language === 'ru'
        ? `В публичных сообществах Xonddit пока недостаточно обсуждений по запросу «${rawQuery}». Вы можете создать новую тему в Xonddit или изучить смежные разделы.`
        : `There are not enough public community discussions on Xonddit yet to provide a verified answer for "${rawQuery}". You can start a new discussion thread on Xonddit or browse related community topics below.`;

    return {
      query: rawQuery,
      detectedLanguage: analysis.language,
      hasSufficientEvidence: false,
      answer: insufficientMsg,
      keyPoints: [],
      citations: [],
      relatedQuestions,
      matchedTopicHub: matchedTopicHub
        ? {
            slug: matchedTopicHub.slug,
            title:
              analysis.language === 'uz' ? matchedTopicHub.titleUz : matchedTopicHub.titleEn,
            url: `/topics/${matchedTopicHub.slug}`,
          }
        : undefined,
      generatedBy: 'community-extractive-rag',
    };
  }

  const primary = rankedPosts[0];
  const primaryBodyLines = (primary.post.body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 20);

  const keyPoints: string[] = [];
  for (const line of primaryBodyLines) {
    if (/^(\d+\.|-|\*)/.test(line) && keyPoints.length < 4) {
      keyPoints.push(line.replace(/^(\d+\.|-|\*)\s*/, ''));
    }
  }

  if (keyPoints.length === 0 && primary.topComments.length > 0) {
    for (const c of primary.topComments.slice(0, 3)) {
      keyPoints.push(`u/${c.authorName} (c/${primary.post.communitySlug}): ${c.content}`);
    }
  } else if (primary.topComments.length > 0 && keyPoints.length < 4) {
    const topComment = primary.topComments[0];
    keyPoints.push(
      `Jamoa tajribasi (u/${topComment.authorName}): ${topComment.content}`
    );
  }

  const introLine = primaryBodyLines[0] || primary.post.title;
  const commList = Array.from(new Set(rankedPosts.map((r) => `c/${r.post.communitySlug}`))).join(
    ', '
  );

  const synthesizedAnswer =
    analysis.language === 'uz'
      ? `Xonddit (${commList}) jamoalaridagi muhokamalar asosida: ${introLine}`
      : analysis.language === 'ru'
      ? `На основе обсуждений в сообществах Xonddit (${commList}): ${introLine}`
      : `Based on public community discussions in ${commList} on Xonddit: ${introLine}`;

  return {
    query: rawQuery,
    detectedLanguage: analysis.language,
    hasSufficientEvidence: true,
    answer: synthesizedAnswer,
    keyPoints: keyPoints.slice(0, 4),
    citations,
    relatedQuestions,
    matchedTopicHub: matchedTopicHub
      ? {
          slug: matchedTopicHub.slug,
          title:
            analysis.language === 'uz' ? matchedTopicHub.titleUz : matchedTopicHub.titleEn,
          url: `/topics/${matchedTopicHub.slug}`,
        }
      : undefined,
    generatedBy: 'community-extractive-rag',
  };
}
