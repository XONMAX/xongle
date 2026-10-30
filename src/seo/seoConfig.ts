import { SupportedApp, Comment, Post } from '../types';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { TopicHubDefinition } from './uzbekSearch';

export const DEFAULT_PRODUCTION_DOMAIN = 'https://xongle.xyz';

export const DEFAULT_GSC_VERIFICATION_TOKEN =
  '5r7XoEsfH21rJezmCM1EP_tD_02s5JCZlRjPkycD0jA';

export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: 'en_US',
  uz: 'uz_UZ',
  ru: 'ru_RU',
  ar: 'ar_AR',
  tr: 'tr_TR',
  es: 'es_ES',
  de: 'de_DE',
  fr: 'fr_FR',
  ja: 'ja_JP',
};

export interface PageLocalizedCopy {
  xongleTitle: string;
  xongleDesc: string;
  xongleH1: string;
  xongleIntro: string;
  xondditTitle: string;
  xondditDesc: string;
  xondditH1: string;
  xondditIntro: string;
}

export const SEO_LOCALIZED_COPY: Record<SupportedLanguage, PageLocalizedCopy> = {
  en: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi va raqamli loyihalar arxivi. Xongle (xongle.xyz) — ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimi.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir.',
    xondditTitle: 'Xonddit — O‘zbekcha Forum, Ochiq Jamoalar (c/) va Muhokamalar | Xongle',
    xondditDesc:
      'Join Xonddit on Xongle to explore public c/ communities, ask questions in Uzbek and English, vote on discussions, and participate in threaded conversations across technology, Linux, and programming.',
    xondditH1: 'Xonddit Public Communities & Discussions',
    xondditIntro:
      'Discover topic-driven c/ communities, vote on member posts, and contribute to open discussions.',
  },
  uz: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle — Raqamli loyihalar arxivi. Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi. Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir.',
    xondditTitle: 'Xonddit — O‘zbekcha Forum, Savol-Javob va Ochiq Jamoalar',
    xondditDesc:
      'Xonddit platformasida c/ jamiyatlariga qo‘shiling, o‘zbek tilida savol-javob qiling, kompyuter, telefon, Linux va dasturlash muammolariga yechim toping.',
    xondditH1: 'Xonddit Ochiq Jamiyatlari va Muhokamalari',
    xondditIntro:
      'Mavzuli c/ jamiyatlarini kashf eting, postlarga ovoz bering va jonli munozaralarda qatnashing.',
  },
  ru: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — Поисковая система сообществ и обсуждений. Ищите публичные сообщества, ветки обсуждений и комментарии в реальном времени с Xongle и фильтруйте темы по релевантности.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Поисковая система в реальном времени по публичным сообществам и обсуждениям Xonddit.',
    xondditTitle: 'Xonddit — Публичные сообщества, тематические форумы и дискуссии',
    xondditDesc:
      'Присоединяйтесь к Xonddit: открывайте сообщества c/, публикуйте посты, голосуйте и участвуйте в обсуждениях о технологиях, науке и творчестве.',
    xondditH1: 'Публичные сообщества и обсуждения Xonddit',
    xondditIntro:
      'Исследуйте тематические сообщества c/, голосуйте за публикации и участвуйте в дискуссиях.',
  },
  ar: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — محرك بحث المجتمعات والمناقشات الفوري. ابحث في المجتمعات العامة، المواضيع، والتعليقات في الوقت الفعلي عبر Xongle وصنف النتائج حسب الصلة أو الحداثة.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — محرك بحث فوري لمجتمعات Xonddit العامة وسلاسل النقاش.',
    xondditTitle: 'Xonddit — مجتمعات عامة، منتديات حوارية ومناقشات مباشرة',
    xondditDesc:
      'انضم إلى Xonddit لاستكشاف مجتمعات c/ العامة، مشاركة المنشورات، التصويت، والمشاركة في نقاشات التقنية والعلوم والفنون.',
    xondditH1: 'مجتمعات ومناقشات Xonddit العامة',
    xondditIntro:
      'اكتشف مجتمعات c/ المتخصصة، صوّت للمنشورات، وشارك في الحوارات المفتوحة.',
  },
  tr: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — Gerçek Zamanlı Topluluk ve Tartışma Arama Motoru. Xongle ile herkese açık toplulukları, tartışma konularını ve yorumları gerçek zamanlı arayın ve konuları filtreleyin.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Xonddit toplulukları ve tartışma dizileri için gerçek zamanlı arama motoru.',
    xondditTitle: 'Xonddit — Açık Topluluklar, Konu Forumları ve Canlı Tartışmalar',
    xondditDesc:
      'Herkese açık c/ topluluklarını keşfetmek, gönderi paylaşmak, oy vermek ve teknoloji, bilim ve sanat tartışmalarına katılmak için Xonddit’e katılın.',
    xondditH1: 'Xonddit Açık Toplulukları ve Tartışmaları',
    xondditIntro:
      'Konu odaklı c/ topluluklarını keşfedin, gönderilere oy verin ve tartışmalara katkıda bulunun.',
  },
  es: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — Buscador de Comunidades y Debates en Tiempo Real. Busca comunidades públicas, hilos de debate y comentarios en tiempo real con Xongle y filtra temas por relevancia.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Motor de búsqueda en tiempo real para comunidades públicas y discusiones de Xonddit.',
    xondditTitle: 'Xonddit — Comunidades Públicas, Foros Temáticos y Debates',
    xondditDesc:
      'Únete a Xonddit para explorar comunidades c/, compartir publicaciones, votar y participar en conversaciones sobre tecnología, ciencia y diseño.',
    xondditH1: 'Comunidades Públicas y Debates en Xonddit',
    xondditIntro:
      'Descubre comunidades c/ temáticas, vota publicaciones y participa en discusiones abiertas.',
  },
  de: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — Echtzeit-Suchmaschine für Communities & Diskussionen. Durchsuchen Sie öffentliche Communities, Diskussionsthreads und Kommentare in Echtzeit mit Xongle und filtern Sie Themen nach Relevanz.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Echtzeit-Suchmaschine für öffentliche Xonddit-Communities und Threads.',
    xondditTitle: 'Xonddit — Öffentliche Communities, Themenforen & Diskussionen',
    xondditDesc:
      'Entdecken Sie auf Xonddit öffentliche c/-Communities, teilen Sie Beiträge, stimmen Sie ab und diskutieren Sie über Technologie, Wissenschaft und Kultur.',
    xondditH1: 'Öffentliche Xonddit-Communities & Diskussionen',
    xondditIntro:
      'Entdecken Sie themenbezogene c/-Communities, bewerten Sie Beiträge und diskutieren Sie mit.',
  },
  fr: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — Moteur de Recherche de Communautés et Discussions. Recherchez des communautés publiques, fils de discussion et commentaires en temps réel avec Xongle et filtrez par pertinence.',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Moteur de recherche en temps réel pour les communautés publiques et discussions Xonddit.',
    xondditTitle: 'Xonddit — Communautés Publiques, Forums Thématiques et Débats',
    xondditDesc:
      'Rejoignez Xonddit pour explorer les communautés c/, partager des publications, voter et participer aux discussions sur la technologie, la science et l’art.',
    xondditH1: 'Communautés Publiques et Discussions Xonddit',
    xondditIntro:
      'Découvrez les communautés thématiques c/, votez sur les publications et participez aux échanges.',
  },
  ja: {
    xongleTitle: 'Xongle',
    xongleDesc:
      'Xongle (xongle.xyz) — コミュニティ・ディスカッションのリアルタイム検索エンジン。Xongleで公開コミュニティ、スレッド、コメントをリアルタイム検索。関連度や新着順で絞り込めます。',
    xongleH1: 'Xongle',
    xongleIntro:
      'Xongle (xongle.xyz) — Xondditの公開コミュニティとディスカッションを横断するリアルタイム検索エンジン。',
    xondditTitle: 'Xonddit — 公開コミュニティ・トピックフォーラム・ディスカッション',
    xondditDesc:
      'Xondditで公開 c/ コミュニティを探索し、投稿の共有、投票、テクノロジー・科学・アートに関するスレッド形式の議論に参加しましょう。',
    xondditH1: 'Xonddit 公開コミュニティ＆ディスカッション',
    xondditIntro:
      'トピック別の c/ コミュニティを見つけ、投稿に投票してオープンな議論に参加しましょう。',
  },
};

export function resolveProductionBaseUrl(envAppUrl?: string): string {
  if (envAppUrl && typeof envAppUrl === 'string') {
    const trimmed = envAppUrl.trim().replace(/\/+$/, '');
    if (
      trimmed === 'https://xongle.xyz' ||
      trimmed === 'http://xongle.xyz' ||
      trimmed === 'http://www.xongle.xyz' ||
      trimmed === 'https://www.xongle.xyz'
    ) {
      return 'https://xongle.xyz';
    }
    if (
      trimmed.startsWith('https://') &&
      !trimmed.includes('your-app-domain.example.com') &&
      !trimmed.includes('localhost') &&
      !trimmed.includes('127.0.0.1') &&
      !trimmed.includes('ais-dev-') &&
      !trimmed.includes('ais-pre-') &&
      !trimmed.includes('.run.app') &&
      !trimmed.includes('.vercel.app')
    ) {
      return trimmed;
    }
  }
  return DEFAULT_PRODUCTION_DOMAIN;
}

export function normalizeSupportedLanguage(raw?: string | null): SupportedLanguage {
  if (!raw) return 'en';
  const clean = raw.toLowerCase().trim().split('-')[0] as SupportedLanguage;
  if (SUPPORTED_LANGUAGES.some((l) => l.code === clean)) {
    return clean;
  }
  return 'en';
}

export interface SeoRouteInput {
  app?: SupportedApp;
  lang?: SupportedLanguage;
  query?: string;
  communitySlug?: string;
  communityName?: string;
  communityDescription?: string;
  postId?: string;
  postTitle?: string;
  postSnippet?: string;
  postBody?: string;
  postAuthor?: string;
  postCreatedAt?: string;
  postScore?: number;
  postCommentCount?: number;
  postComments?: Comment[];
  topicHub?: TopicHubDefinition;
  topicPosts?: Post[];
  cleanPath?: string;
  baseUrl?: string;
}

export interface ResolvedSeoMetadata {
  lang: SupportedLanguage;
  dir: 'ltr' | 'rtl';
  locale: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'article';
  ogSiteName: string;
  ogImageUrl: string;
  ogImageAlt: string;
  hreflangs: { hreflang: string; href: string }[];
  jsonLd: Record<string, any>;
}

export const OFFICIAL_FAQ_SCHEMA_ITEMS = [
  {
    question: 'Xongle nima? (Xongle haqida / xongle.xyz haqida / What is Xongle?)',
    answer:
      'Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir. Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi va raqamli loyihalar arxivi. Ushbu platformaning asosiy xususiyatlari: 1) Real vaqtda indekslash: Platforma Xonddit tizimidagi ommaviy postlar va sharhlarni real vaqt rejimida indekslab boradi. 2) Erkin qidiruv: Foydalanuvchilar tizimga kirmasdan (akkountsiz) mavzularni dolzarbligi, yangiligi yoki ommabopligi bo‘yicha qidirishlari mumkin. 3) Mavjud jamoalar: Saytda turli jamoalar (masalan, c/xonddit, c/xongle, c/dasturlash, c/linux, c/texnologiya, c/tor, c/nftscam) mavjud bo‘lib, ular doirasida qidiruv va muhokamalar olib boriladi.',
  },
  {
    question: 'Xongle platformasidagi qidiruv mexanizmlari va AI Javob Tizimi qanday ishlaydi?',
    answer:
      'Xongle qidiruv mexanizmi Xonddit tizimidagi barcha ommaviy jamoalar (c/), postlar va izohlarni o‘zbek (lotin va kirill), rus hamda ingliz tillarida real vaqt rejimida indekslaydi. Xongle AI Javob Tizimi (Community Answer Engine) esa foydalanuvchi savoliga javobni faqatgina Xonddit jamoalaridagi real muhokamalar va izohlarga asoslanib (havolalar bilan) shakllantiradi.',
  },
  {
    question: 'Xongle va Xonddit jamoalari o‘rtasidagi bog‘liqlik qanday? (How does Xongle relate to Xonddit communities?)',
    answer:
      'Xongle (https://xongle.xyz/) va Xonddit (https://xongle.xyz/?app=xonddit) yagona raqamli platformaning o‘zaro bog‘langan tizimlaridir: Xongle markaziy kashfiyot va real vaqtda qidiruv tizimi vazifasini bajaradi, Xonddit esa c/xonddit, c/xongle, c/dasturlash, c/linux, c/texnologiya, c/tor, c/nftscam kabi mavzuli jamoalar, muhokama tredlari, ovoz berish va sharhlar joylashadigan ommaviy forum platformasidir.',
  },
  {
    question: 'Xongle platformasining boshqa qidiruv tizimlaridan va Wikipedia maqolalaridan farqi nimada?',
    answer:
      'Xongle (https://xongle.xyz/) — bu mustaqil veb-ilova va real vaqtda ishlovchi jamoaviy qidiruv tizimidir (Wikipedia maqolasi yoki lug‘aviy atama emas). Boshqa umumiy qidiruv tizimlaridan farqli o‘laroq, Xongle maxsus ravishda Xonddit ommaviy jamoalari (c/), o‘zbekcha savol-javob mavzulari (tredlar) va foydalanuvchi sharhlarini bir zumda, reklamasiz va tizimga kirmasdan (erkin qidiruv) topishga ixtisoslashgan.',
  },
  {
    question: 'Do I need an account to use Xongle Search or browse Xonddit?',
    answer:
      'No login is required (Erkin qidiruv). Users can search public content on Xongle by relevance, recency, or popularity and read public Xonddit communities (such as c/xonddit, c/xongle, c/dasturlash, c/linux, c/texnologiya, c/tor, c/nftscam) without an account.',
  },
  {
    question: 'How does Xongle protect user privacy and private data?',
    answer:
      'Xongle indexes only public communities, posts, and comments explicitly published on Xonddit. Private credentials, authentication tokens, email addresses, administrative controls, and owner backups are protected by strict Cloud Firestore security rules and server-side cryptographic verification.',
  },
];

export function buildCanonicalUrl(
  baseUrl: string,
  options: {
    app?: SupportedApp;
    communitySlug?: string;
    postId?: string;
    topicSlug?: string;
    cleanPath?: string;
    lang?: SupportedLanguage;
  }
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const langQuery =
    options.lang && options.lang !== 'en'
      ? `?lang=${encodeURIComponent(options.lang)}`
      : '';

  if (options.topicSlug) {
    return `${cleanBase}/topics/${encodeURIComponent(options.topicSlug.trim().toLowerCase())}${langQuery}`;
  }

  if (options.cleanPath) {
    const cleanRel = options.cleanPath.startsWith('/')
      ? options.cleanPath
      : `/${options.cleanPath}`;
    return `${cleanBase}${cleanRel}${langQuery}`;
  }

  if (options.app === 'about') {
    return `${cleanBase}/about${langQuery}`;
  }

  const params = new URLSearchParams();
  if (options.app === 'xonddit') {
    params.set('app', 'xonddit');
    if (options.postId) {
      params.set('p', options.postId.trim());
    } else if (options.communitySlug) {
      params.set('c', options.communitySlug.trim().toLowerCase());
    }
  }

  if (options.lang && options.lang !== 'en') {
    params.set('lang', options.lang);
  }

  const qs = params.toString();
  return qs ? `${cleanBase}/?${qs}` : `${cleanBase}/`;
}

export function buildHreflangLinks(
  baseUrl: string,
  options: {
    app?: SupportedApp;
    communitySlug?: string;
    postId?: string;
    topicSlug?: string;
    cleanPath?: string;
  }
): { hreflang: string; href: string }[] {
  const links: { hreflang: string; href: string }[] = SUPPORTED_LANGUAGES.map((l) => ({
    hreflang: l.code,
    href: buildCanonicalUrl(baseUrl, { ...options, lang: l.code }),
  }));

  links.push({
    hreflang: 'x-default',
    href: buildCanonicalUrl(baseUrl, { ...options, lang: 'en' }),
  });

  return links;
}

export function resolveSeoMetadata(input: SeoRouteInput): ResolvedSeoMetadata {
  const baseUrl = resolveProductionBaseUrl(input.baseUrl);
  const lang = normalizeSupportedLanguage(input.lang);
  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const copy = SEO_LOCALIZED_COPY[lang] || SEO_LOCALIZED_COPY.en;
  const app: SupportedApp = input.app || 'xongle';
  const cleanQuery = (input.query || '').trim();

  const ogImageUrl = `${baseUrl}/og-image.svg`;
  const ogImageAlt =
    'Xongle (xongle.xyz) — Official Real-Time Community Search Engine and Xonddit Communities';

  let title = copy.xongleTitle;
  let description = copy.xongleDesc;
  let h1 = copy.xongleH1;
  let intro = copy.xongleIntro;
  let ogType: 'website' | 'article' = 'website';
  let ogSiteName = 'Xongle';
  // Index public landing pages, topic hubs, communities, posts, and /about; noindex raw ad-hoc search query pages (?q=...)
  let robots = cleanQuery
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  if (input.topicHub) {
    ogSiteName = 'Xongle Topic Hub';
    title = `${input.topicHub.titleUz} | Xongle`;
    description = `${input.topicHub.descriptionUz} ${input.topicHub.descriptionEn}`.slice(0, 160);
    h1 = input.topicHub.titleUz;
    intro = input.topicHub.descriptionUz;
  } else if (app === 'about') {
    ogSiteName = 'Xongle';
    title = 'About Xongle (xongle.xyz) — Official Platform Overview, Features & FAQ';
    description =
      'Official documentation and FAQ for Xongle (https://xongle.xyz/), the real-time search engine for public Xonddit communities (c/), discussion threads, and comments.';
    h1 = 'About Xongle (xongle.xyz)';
    intro = description;
  } else if (app === 'xonddit') {
    ogSiteName = 'Xonddit on Xongle';
    if (input.postId && input.postTitle) {
      ogType = 'article';
      const commLabel = input.communitySlug ? `c/${input.communitySlug}` : 'Xonddit';
      title = `${input.postTitle.slice(0, 68)} — ${commLabel} | Xongle`;
      const rawSnippet = (input.postSnippet || input.postBody || input.postTitle)
        .replace(/\s+/g, ' ')
        .trim();
      const authorSuffix = input.postAuthor
        ? ` Posted by u/${input.postAuthor.replace(/^u\//, '')} in ${commLabel}.`
        : '';
      description = `${rawSnippet.slice(0, 120)}${rawSnippet.length > 120 ? '...' : ''}${authorSuffix}`.slice(
        0,
        160
      );
      h1 = input.postTitle;
      intro = description;
    } else if (input.communitySlug) {
      const slug = input.communitySlug.toLowerCase().trim();
      const cName = input.communityName || `c/${slug}`;
      title = `c/${slug} (${cName}) — O‘zbekcha Forum va Muhokamalar | Xonddit & Xongle`;
      const cDesc =
        input.communityDescription ||
        `Browse public posts, questions, and member discussions in c/${slug} on Xonddit.`;
      description = `Explore c/${slug} (${cName}) on Xonddit: ${cDesc}`
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      h1 = `c/${slug} — ${cName}`;
      intro = description;
    } else {
      title = copy.xondditTitle;
      description = copy.xondditDesc;
      h1 = copy.xondditH1;
      intro = copy.xondditIntro;
    }
  } else {
    // Xongle
    ogSiteName = 'Xongle';
    if (cleanQuery) {
      title = `${cleanQuery.slice(0, 52)} — Xongle Qidiruv va Jamoaviy Javoblar`;
      description = `"${cleanQuery.slice(
        0,
        60
      )}" bo‘yicha Xonddit ommaviy jamoalari, savol-javob postlari va izohlaridan real vaqtda qidiruv natijalari.`;
      h1 = `"${cleanQuery}" bo‘yicha qidiruv va muhokamalar`;
      intro = description;
    }
  }

  const canonicalUrl = buildCanonicalUrl(baseUrl, {
    app,
    communitySlug: input.communitySlug,
    postId: input.postId,
    topicSlug: input.topicHub?.slug,
    cleanPath: input.cleanPath,
    lang,
  });

  const hreflangs = buildHreflangLinks(baseUrl, {
    app,
    communitySlug: input.communitySlug,
    postId: input.postId,
    topicSlug: input.topicHub?.slug,
    cleanPath: input.cleanPath,
  });

  // Build BreadcrumbList items matching the actual route hierarchy
  const breadcrumbItems: Record<string, any>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Xongle',
      item: `${baseUrl}/`,
    },
  ];

  if (input.topicHub) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: input.topicHub.titleUz,
      item: `${baseUrl}/topics/${encodeURIComponent(input.topicHub.slug)}`,
    });
  } else if (app === 'about') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'About Xongle & FAQ',
      item: `${baseUrl}/about`,
    });
  } else if (app === 'xonddit') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Xonddit Communities',
      item: `${baseUrl}/?app=xonddit`,
    });
    if (input.communitySlug) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: `c/${input.communitySlug}`,
        item: `${baseUrl}/c/${encodeURIComponent(input.communitySlug)}`,
      });
    }
    if (input.postId && input.postTitle) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: input.postTitle.slice(0, 80),
        item: canonicalUrl,
      });
    }
  }

  const softwareAppName =
    app === 'xonddit' ? 'Xonddit Community Platform' : 'Xongle';

  const softwareCategory =
    app === 'xonddit' ? 'SocialNetworkingApplication' : 'BrowserApplication';

  const graphNodes: Record<string, any>[] = [
    {
      '@type': ['Organization', 'Brand'],
      '@id': `${baseUrl}/#organization`,
      name: 'Xongle',
      legalName: 'Xongle',
      alternateName: [
        'xongle',
        'Xongle.xyz',
        'www.xongle.xyz',
        'Xongle — Raqamli loyihalar arxivi',
        'Xongle haqida',
        'xongle.xyz haqida',
        'Xongle App',
        'Xongle Official',
        'Xongle Search',
        'Xongle Search Engine',
        'Xonddit',
      ],
      url: `${baseUrl}/`,
      mainEntityOfPage: `${baseUrl}/`,
      description:
        'Xongle (xongle.xyz) — bu ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimidir. Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi va raqamli loyihalar arxivi.',
      disambiguatingDescription:
        'Xongle (officially hosted at https://xongle.xyz/ and https://www.xongle.xyz/) is the official Xongle software application and real-time community search engine for Xonddit, distinct from unrelated Wikipedia articles, linguistic terms, or phonetic word matches.',
      sameAs: [
        `${baseUrl}/`,
        'https://www.xongle.xyz/',
        `${baseUrl}/about`,
        `${baseUrl}/?app=xonddit`,
      ],
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/favicon.png`,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      name: 'Xongle',
      alternateName: [
        'xongle',
        'Xongle.xyz',
        'www.xongle.xyz',
        'Xongle — Raqamli loyihalar arxivi',
        'Xongle App',
        'Xongle Search',
        'Xonddit',
      ],
      url: `${baseUrl}/`,
      inLanguage: lang,
      description:
        'Xongle — foydalanuvchilarga kerakli ommaviy materiallarni topishga yordam beruvchi markaziy kashfiyot platformasi. Xongle (xongle.xyz) — ommaviy Xonddit jamoalari (c/), muhokama mavzulari (tredlar) va sharhlarni real vaqt rejimida qidirish imkonini beruvchi rasmiy qidiruv tizimi.',
      disambiguatingDescription:
        'Official Xongle web application and real-time community search engine at https://xongle.xyz/.',
      publisher: {
        '@id': `${baseUrl}/#organization`,
      },
      about: {
        '@id': `${baseUrl}/#organization`,
      },
      mainEntity: {
        '@id': `${baseUrl}/#software`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${baseUrl}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': ['WebApplication', 'SoftwareApplication'],
      '@id': `${baseUrl}/#software`,
      name: softwareAppName,
      alternateName: [
        'xongle',
        'Xongle — Raqamli loyihalar arxivi',
        'Xongle App',
        'Xongle Search Engine',
        'Xongle.xyz',
      ],
      description,
      featureList: [
        'Real vaqtda indekslash: Platforma Xonddit tizimidagi ommaviy postlar va sharhlarni real vaqt rejimida indekslab boradi.',
        'Erkin qidiruv: Foydalanuvchilar tizimga kirmasdan (akkountsiz) mavzularni dolzarbligi, yangiligi yoki ommabopligi bo‘yicha qidirishlari mumkin.',
        'Mavjud jamoalar: Saytda turli jamoalar (masalan, c/xonddit, c/xongle, c/dasturlash, c/linux, c/texnologiya, c/tor, c/nftscam) mavjud bo‘lib, ular doirasida qidiruv va muhokamalar olib boriladi.',
      ],
      disambiguatingDescription:
        'Xongle is the official web application at https://xongle.xyz/ for searching public Xonddit communities and discussions in real time—an original software application, not a Wikipedia article or dictionary entry.',
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      applicationCategory: softwareCategory,
      operatingSystem: 'Web, All',
      inLanguage: lang,
      author: {
        '@id': `${baseUrl}/#organization`,
      },
      publisher: {
        '@id': `${baseUrl}/#organization`,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@type': input.topicHub || (app === 'xonddit' && input.communitySlug && !input.postId)
        ? 'CollectionPage'
        : 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: {
        '@id': `${baseUrl}/#website`,
      },
      about: {
        '@id': `${baseUrl}/#organization`,
      },
    },
    {
      '@type': 'ItemList',
      '@id': `${baseUrl}/#sitelinks`,
      name: 'Xongle Official Navigation',
      itemListElement: [
        {
          '@type': 'SiteNavigationElement',
          position: 1,
          name: 'Xongle',
          description: 'Official Xongle real-time community and discussion search engine',
          url: `${baseUrl}/`,
        },
        {
          '@type': 'SiteNavigationElement',
          position: 2,
          name: 'Xonddit Communities',
          description: 'Public c/ topic communities, posts, and threaded discussions on Xongle',
          url: `${baseUrl}/?app=xonddit`,
        },
        {
          '@type': 'SiteNavigationElement',
          position: 3,
          name: 'About Xongle & Official FAQ',
          description: 'Official documentation, brand disambiguation, and FAQ for Xongle (xongle.xyz)',
          url: `${baseUrl}/about`,
        },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    },
  ];

  // Add DiscussionForumPosting structured data for individual discussion / question pages
  if (app === 'xonddit' && input.postId && input.postTitle) {
    const cleanAuthor = (input.postAuthor || 'user').replace(/^u\//, '');
    const publishedIso = input.postCreatedAt || '2025-02-10T09:15:00.000Z';
    const postComments = input.postComments || [];

    graphNodes.push({
      '@type': 'DiscussionForumPosting',
      '@id': `${canonicalUrl}#discussion`,
      mainEntityOfPage: canonicalUrl,
      url: canonicalUrl,
      headline: input.postTitle,
      text: input.postBody || input.postSnippet || input.postTitle,
      articleBody: input.postBody || input.postSnippet || input.postTitle,
      articleSection: input.communitySlug ? `c/${input.communitySlug}` : 'Xonddit',
      datePublished: publishedIso,
      dateModified: publishedIso,
      author: {
        '@type': 'Person',
        name: `u/${cleanAuthor}`,
        url: `${baseUrl}/?app=xonddit`,
      },
      publisher: {
        '@id': `${baseUrl}/#organization`,
      },
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/LikeAction',
          userInteractionCount: input.postScore ?? 1,
        },
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/CommentAction',
          userInteractionCount: input.postCommentCount ?? postComments.length,
        },
      ],
      commentCount: input.postCommentCount ?? postComments.length,
      comment: postComments.slice(0, 20).map((cm) => ({
        '@type': 'Comment',
        '@id': `${canonicalUrl}#comment-${cm.id}`,
        text: cm.content,
        datePublished: cm.createdAt,
        upvoteCount: cm.score ?? 1,
        author: {
          '@type': 'Person',
          name: `u/${(cm.authorName || 'user').replace(/^u\//, '')}`,
        },
      })),
    });
  }

  // Add ItemList of discussions for Topic Hub pages
  if (input.topicHub && input.topicPosts && input.topicPosts.length > 0) {
    graphNodes.push({
      '@type': 'ItemList',
      '@id': `${canonicalUrl}#topic-discussions`,
      name: `${input.topicHub.titleUz} — Muhokamalar`,
      itemListElement: input.topicPosts.slice(0, 15).map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: p.title,
        url: `${baseUrl}/discussions/${encodeURIComponent(p.id)}`,
      })),
    });
  }

  if (app === 'about' || (app === 'xongle' && !cleanQuery && !input.topicHub)) {
    graphNodes.push({
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: OFFICIAL_FAQ_SCHEMA_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': graphNodes,
  };

  return {
    lang,
    dir: langMeta.dir,
    locale: LOCALE_MAP[lang] || 'en_US',
    title,
    description,
    h1,
    intro,
    canonicalUrl,
    robots,
    ogType,
    ogSiteName,
    ogImageUrl,
    ogImageAlt,
    hreflangs,
    jsonLd,
  };
}

export function safeSerializeJsonLd(data: Record<string, any>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(
    `meta[${attrName}="${attrValue}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function syncDocumentHead(input: SeoRouteInput): ResolvedSeoMetadata {
  const meta = resolveSeoMetadata(input);
  if (typeof document === 'undefined') return meta;

  document.documentElement.lang = meta.lang;
  document.documentElement.dir = meta.dir;
  document.title = meta.title;

  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('name', 'application-name', 'Xongle');
  upsertMetaTag('name', 'apple-mobile-web-app-title', 'Xongle');
  upsertMetaTag('name', 'author', 'Xongle');
  upsertMetaTag('name', 'publisher', 'Xongle (xongle.xyz)');
  upsertMetaTag(
    'name',
    'keywords',
    'Xongle, xongle, xongle haqida, xongle.xyz, xongle.xyz haqida, Xongle — Raqamli loyihalar arxivi, O‘zbekcha forum, O‘zbek tilida savol-javob, Kompyuter muammosini qanday hal qilish, Linux qanday o‘rganiladi, Dasturlashni qayerdan o‘rganish mumkin, Telefon muammosiga yechim, Xonddit'
  );
  upsertMetaTag('name', 'robots', meta.robots);

  // Canonical link
  let canonicalEl = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonicalUrl);

  // Open Graph tags
  upsertMetaTag('property', 'og:type', meta.ogType);
  upsertMetaTag('property', 'og:url', meta.canonicalUrl);
  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('property', 'og:site_name', meta.ogSiteName);
  upsertMetaTag('property', 'og:locale', meta.locale);
  upsertMetaTag('property', 'og:image', meta.ogImageUrl);
  upsertMetaTag('property', 'og:image:alt', meta.ogImageAlt);
  upsertMetaTag('property', 'og:image:width', '1200');
  upsertMetaTag('property', 'og:image:height', '630');

  // Twitter Card tags
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);
  upsertMetaTag('name', 'twitter:image', meta.ogImageUrl);
  upsertMetaTag('name', 'twitter:image:alt', meta.ogImageAlt);

  // Hreflang alternate links
  const existingHreflangs = document.head.querySelectorAll('link[rel="alternate"][hreflang]');
  existingHreflangs.forEach((node) => node.parentNode?.removeChild(node));
  for (const hl of meta.hreflangs) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', hl.hreflang);
    link.setAttribute('href', hl.href);
    document.head.appendChild(link);
  }

  // JSON-LD Structured Data
  const allJsonLdScripts = document.head.querySelectorAll('script[type="application/ld+json"]');
  if (allJsonLdScripts.length > 1) {
    allJsonLdScripts.forEach((node, idx) => {
      if (idx > 0) node.parentNode?.removeChild(node);
    });
  }
  let ldScript = document.head.querySelector(
    'script[type="application/ld+json"]'
  ) as HTMLScriptElement | null;
  if (!ldScript) {
    ldScript = document.createElement('script');
    ldScript.setAttribute('type', 'application/ld+json');
    ldScript.id = 'seo-json-ld';
    document.head.appendChild(ldScript);
  }
  ldScript.textContent = safeSerializeJsonLd(meta.jsonLd);

  return meta;
}
