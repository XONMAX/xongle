export type SupportedLanguage = 'en' | 'uz' | 'ru' | 'ar' | 'tr' | 'es' | 'de' | 'fr' | 'ja';

export interface LanguageMetadata {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  region: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageMetadata[] = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'United States / International', dir: 'ltr' },
  { code: 'uz', name: 'Uzbek', nativeName: 'O‘zbekcha', region: 'O‘zbekiston', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', region: 'Россия / СНГ', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'الشرق الأوسط وشمال أفريقيا', dir: 'rtl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', region: 'Türkiye', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'España / Latinoamérica', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'Deutschland / DACH', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'France / International', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', region: '日本', dir: 'ltr' },
];

export type TranslationKeys = {
  // Navigation & Common
  'nav.xongle': string;
  'nav.xonddit': string;
  'nav.xonmini': string;
  'nav.profile': string;
  'nav.settings': string;
  'nav.owner': string;
  'nav.signIn': string;
  'nav.signOut': string;
  'nav.homeFeed': string;
  'nav.allCommunities': string;
  'nav.communities': string;
  'nav.search': string;
  'nav.clear': string;
  'nav.cancel': string;
  'nav.save': string;
  'nav.saved': string;
  'nav.close': string;
  'nav.backToFeed': string;
  'nav.loading': string;
  'nav.refresh': string;

  // Xonddit Feed & Posts
  'xonddit.tagline': string;
  'xonddit.filterPlaceholder': string;
  'xonddit.createPost': string;
  'xonddit.newCommunity': string;
  'xonddit.sort.hot': string;
  'xonddit.sort.new': string;
  'xonddit.sort.top': string;
  'xonddit.sort.best': string;
  'xonddit.topic': string;
  'xonddit.postedBy': string;
  'xonddit.comments': string;
  'xonddit.share': string;
  'xonddit.copied': string;
  'xonddit.delete': string;
  'xonddit.confirmDelete': string;
  'xonddit.noPostsTitle': string;
  'xonddit.noPostsDesc': string;
  'xonddit.commentPlaceholder': string;
  'xonddit.postComment': string;
  'xonddit.posting': string;
  'xonddit.reply': string;
  'xonddit.discussion': string;
  'xonddit.noComments': string;
  'xonddit.publishedPosts': string;
  'xonddit.creator': string;
  'xonddit.directory': string;
  'xonddit.indexedOnXongle': string;
  'xonddit.openXongle': string;
  'xonddit.showingCommunity': string;
  'xonddit.clearFilter': string;

  // Xonmini Studio
  'xonmini.subtitle': string;
  'xonmini.heroTitle': string;
  'xonmini.heroDesc': string;
  'xonmini.newQuery': string;
  'xonmini.recentQueries': string;
  'xonmini.noRecentQueries': string;
  'xonmini.corpusTitle': string;
  'xonmini.mode.summary': string;
  'xonmini.mode.detailed': string;
  'xonmini.mode.digest': string;
  'xonmini.inputPlaceholder': string;
  'xonmini.footerNote': string;
  'xonmini.searchingIndex': string;
  'xonmini.matchedOnXonddit': string;
  'xonmini.retry': string;
  'xonmini.copy': string;
  'xonmini.exploreCommunities': string;
  'xonmini.starter.greetingTitle': string;
  'xonmini.starter.greetingCategory': string;
  'xonmini.starter.topicsTitle': string;
  'xonmini.starter.topicsCategory': string;
  'xonmini.starter.communitiesTitle': string;
  'xonmini.starter.communitiesCategory': string;
  'xonmini.starter.trendingTitle': string;
  'xonmini.starter.trendingCategory': string;

  // Xongle Search
  'xongle.searchPlaceholder': string;
  'xongle.askXonmini': string;
  'xongle.openXonddit': string;
  'xongle.resultsIndexed': string;
  'xongle.saveSearch': string;
  'xongle.noResultsTitle': string;

  // Settings & Profile Modal
  'settings.title': string;
  'settings.searchPlaceholder': string;
  'settings.tab.overview': string;
  'settings.tab.account': string;
  'settings.tab.appearance': string;
  'settings.tab.language': string;
  'settings.tab.notifications': string;
  'settings.tab.accessibility': string;
  'settings.tab.privacy': string;
  'settings.account.title': string;
  'settings.account.desc': string;
  'settings.account.displayName': string;
  'settings.account.username': string;
  'settings.account.bio': string;
  'settings.account.avatar': string;
  'settings.account.uploadPhoto': string;
  'settings.account.saveProfile': string;
  'settings.account.profileSaved': string;
  'settings.appearance.title': string;
  'settings.appearance.desc': string;
  'settings.appearance.themeMode': string;
  'settings.appearance.themeDark': string;
  'settings.appearance.themeLight': string;
  'settings.appearance.themeSystem': string;
  'settings.appearance.paletteTitle': string;
  'settings.appearance.paletteDesc': string;
  'settings.appearance.xondditAccent': string;
  'settings.appearance.xonminiAccent': string;
  'settings.appearance.contrastVerified': string;
  'settings.appearance.contrastAdjusted': string;
  'settings.appearance.applyRecommended': string;
  'settings.appearance.density': string;
  'settings.appearance.comfortable': string;
  'settings.appearance.compact': string;
  'settings.language.title': string;
  'settings.language.desc': string;
  'settings.language.searchPlaceholder': string;
  'settings.language.rtlBadge': string;
  'settings.language.contentNotice': string;
  'settings.notifications.title': string;
  'settings.notifications.desc': string;
  'settings.notifications.replies': string;
  'settings.notifications.repliesDesc': string;
  'settings.notifications.community': string;
  'settings.notifications.communityDesc': string;
  'settings.notifications.sound': string;
  'settings.notifications.soundDesc': string;
  'settings.accessibility.title': string;
  'settings.accessibility.desc': string;
  'settings.accessibility.reduceMotion': string;
  'settings.accessibility.reduceMotionDesc': string;
  'settings.accessibility.highContrast': string;
  'settings.accessibility.highContrastDesc': string;
  'settings.accessibility.fontScale': string;
  'settings.privacy.title': string;
  'settings.privacy.desc': string;
  'settings.privacy.saveSearch': string;
  'settings.privacy.saveSearchDesc': string;
  'settings.privacy.saveChat': string;
  'settings.privacy.saveChatDesc': string;
  'settings.privacy.clearSearchBtn': string;
  'settings.privacy.clearChatBtn': string;
  'settings.privacy.confirmClear': string;
  'settings.privacy.clearedSuccess': string;
  'settings.resetDefaults': string;
};

const en: TranslationKeys = {
  'nav.xongle': 'Xongle',
  'nav.xonddit': 'Xonddit',
  'nav.xonmini': 'Xonmini',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.owner': 'Owner',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
  'nav.homeFeed': 'Home Feed',
  'nav.allCommunities': 'All Communities',
  'nav.communities': 'Communities',
  'nav.search': 'Search',
  'nav.clear': 'Clear',
  'nav.cancel': 'Cancel',
  'nav.save': 'Save Changes',
  'nav.saved': 'Saved',
  'nav.close': 'Close',
  'nav.backToFeed': 'Back to feed',
  'nav.loading': 'Loading...',
  'nav.refresh': 'Refresh',

  'xonddit.tagline': 'Community Broadsheet & Discussions',
  'xonddit.filterPlaceholder': 'Filter discussions or press Enter for Xongle...',
  'xonddit.createPost': 'New Post',
  'xonddit.newCommunity': 'New Community',
  'xonddit.sort.hot': 'Hot',
  'xonddit.sort.new': 'New',
  'xonddit.sort.top': 'Top',
  'xonddit.sort.best': 'Best',
  'xonddit.topic': 'Topic',
  'xonddit.postedBy': 'by',
  'xonddit.comments': 'comments',
  'xonddit.share': 'Share',
  'xonddit.copied': 'Copied',
  'xonddit.delete': 'Delete',
  'xonddit.confirmDelete': 'Confirm Delete?',
  'xonddit.noPostsTitle': 'No discussions published in this view',
  'xonddit.noPostsDesc': 'Start the first thread in this community or adjust your topic filter.',
  'xonddit.commentPlaceholder': 'Contribute a thoughtful reply to this discussion...',
  'xonddit.postComment': 'Post Reply',
  'xonddit.posting': 'Posting...',
  'xonddit.reply': 'Reply',
  'xonddit.discussion': 'Thread Discussion',
  'xonddit.noComments': 'No replies yet. Start the conversation above.',
  'xonddit.publishedPosts': 'Published Posts',
  'xonddit.creator': 'Curator',
  'xonddit.directory': 'Community Directory',
  'xonddit.indexedOnXongle': 'Synchronized with Xongle Index',
  'xonddit.openXongle': 'Open Xongle Search',
  'xonddit.showingCommunity': 'Viewing community',
  'xonddit.clearFilter': 'All Feed',

  'xonmini.subtitle': 'Synthesis & Inquiry Desk',
  'xonmini.heroTitle': 'Ask a question, explore a topic, or synthesize Xonddit threads.',
  'xonmini.heroDesc': 'Converse naturally, break down technical or creative subjects, or query live discussions across Xonddit communities.',
  'xonmini.newQuery': 'New Inquiry',
  'xonmini.recentQueries': 'Session Archive',
  'xonmini.noRecentQueries': 'No saved sessions yet.',
  'xonmini.corpusTitle': 'Live Xonddit Corpus',
  'xonmini.mode.summary': 'Concise',
  'xonmini.mode.detailed': 'In-Depth',
  'xonmini.mode.digest': 'Editorial Digest',
  'xonmini.inputPlaceholder': 'Say hello, ask about any topic, or query Xonddit...',
  'xonmini.footerNote': 'Xonmini responds to conversational prompts, general topics, and live Xonddit community data.',
  'xonmini.searchingIndex': 'Synthesizing response...',
  'xonmini.matchedOnXonddit': 'Cited Xonddit Sources',
  'xonmini.retry': 'Regenerate',
  'xonmini.copy': 'Copy',
  'xonmini.exploreCommunities': 'Jump to an indexed community:',
  'xonmini.starter.greetingTitle': 'Say hello to Xonmini',
  'xonmini.starter.greetingCategory': '01 · Conversation',
  'xonmini.starter.topicsTitle': 'Explore software, AI & science',
  'xonmini.starter.topicsCategory': '02 · Topic Synthesis',
  'xonmini.starter.communitiesTitle': 'Index of active c/ communities',
  'xonmini.starter.communitiesCategory': '03 · Community Directory',
  'xonmini.starter.trendingTitle': 'Digest of top-voted discussions',
  'xonmini.starter.trendingCategory': '04 · Live Threads',

  'xongle.searchPlaceholder': 'Search Xonddit, Xonmini, or any topic...',
  'xongle.askXonmini': 'Ask Xonmini',
  'xongle.openXonddit': 'Open Xonddit',
  'xongle.resultsIndexed': 'results indexed',
  'xongle.saveSearch': 'Save search',
  'xongle.noResultsTitle': 'No matching documents on Xonddit',

  'settings.title': 'Settings & Preferences',
  'settings.searchPlaceholder': 'Search settings (theme, language, contrast, privacy...)',
  'settings.tab.overview': 'Overview',
  'settings.tab.account': 'Account & Identity',
  'settings.tab.appearance': 'Appearance & Palette',
  'settings.tab.language': 'Language & Region',
  'settings.tab.notifications': 'Notifications',
  'settings.tab.accessibility': 'Accessibility',
  'settings.tab.privacy': 'Privacy & Security',
  'settings.account.title': 'Public Identity & Handle',
  'settings.account.desc': 'Manage your u/ handle, display name, and avatar across Xonddit and Xonmini.',
  'settings.account.displayName': 'Display Name',
  'settings.account.username': 'Username Handle (u/)',
  'settings.account.bio': 'Short Bio',
  'settings.account.avatar': 'Profile Avatar',
  'settings.account.uploadPhoto': 'Upload Image',
  'settings.account.saveProfile': 'Save Identity',
  'settings.account.profileSaved': 'Profile updated across all apps.',
  'settings.appearance.title': 'Theme, Curated Palettes & Contrast',
  'settings.appearance.desc': 'Customize surface themes and individual accent colors for Xonddit and Xonmini with automatic WCAG contrast protection.',
  'settings.appearance.themeMode': 'Color Mode',
  'settings.appearance.themeDark': 'Dark',
  'settings.appearance.themeLight': 'Light',
  'settings.appearance.themeSystem': 'System',
  'settings.appearance.paletteTitle': 'Curated Surface Palettes',
  'settings.appearance.paletteDesc': 'Each preset balances background, elevated surface, hairline border, and ink tones.',
  'settings.appearance.xondditAccent': 'Xonddit Community Accent',
  'settings.appearance.xonminiAccent': 'Xonmini Studio Accent',
  'settings.appearance.contrastVerified': 'WCAG Contrast Verified',
  'settings.appearance.contrastAdjusted': 'Auto-adjusted for readable contrast',
  'settings.appearance.applyRecommended': 'Use Recommended Shade',
  'settings.appearance.density': 'Layout Density',
  'settings.appearance.comfortable': 'Comfortable',
  'settings.appearance.compact': 'Compact',
  'settings.language.title': 'Interface Language',
  'settings.language.desc': 'Select your preferred language for navigation, menus, and controls. User posts and comments are never auto-translated.',
  'settings.language.searchPlaceholder': 'Filter languages (e.g. O‘zbekcha, English, Русский, العربية)...',
  'settings.language.rtlBadge': 'Right-to-Left (RTL)',
  'settings.language.contentNotice': 'User-generated posts, comments, and handles remain in their original language.',
  'settings.notifications.title': 'Notifications & Alerts',
  'settings.notifications.desc': 'Control how thread replies and community updates are surfaced.',
  'settings.notifications.replies': 'Thread Reply Alerts',
  'settings.notifications.repliesDesc': 'Highlight new replies on discussions you authored or commented on.',
  'settings.notifications.community': 'Community Activity',
  'settings.notifications.communityDesc': 'Show activity counters for communities in your directory.',
  'settings.notifications.sound': 'Subtle Interface Audio',
  'settings.notifications.soundDesc': 'Play subtle tactile audio feedback on key actions.',
  'settings.accessibility.title': 'Accessibility & Reading Comfort',
  'settings.accessibility.desc': 'Tune motion, keyboard focus visibility, and typographic scale.',
  'settings.accessibility.reduceMotion': 'Reduce Motion',
  'settings.accessibility.reduceMotionDesc': 'Minimize layout transitions and animated effects.',
  'settings.accessibility.highContrast': 'High-Contrast Focus Outlines',
  'settings.accessibility.highContrastDesc': 'Display prominent 3px focus rings for keyboard navigation.',
  'settings.accessibility.fontScale': 'Typography Scale',
  'settings.privacy.title': 'Privacy, Local Data & Security',
  'settings.privacy.desc': 'Control local search history, Xonmini session storage, and active authentication.',
  'settings.privacy.saveSearch': 'Save Xongle Search History',
  'settings.privacy.saveSearchDesc': 'Keep recent search queries locally for faster suggestions.',
  'settings.privacy.saveChat': 'Persist Xonmini Sessions',
  'settings.privacy.saveChatDesc': 'Store Xonmini conversation threads in browser storage across refreshes.',
  'settings.privacy.clearSearchBtn': 'Clear Search History',
  'settings.privacy.clearChatBtn': 'Clear Xonmini Sessions',
  'settings.privacy.confirmClear': 'Click again to confirm deletion',
  'settings.privacy.clearedSuccess': 'Local data cleared.',
  'settings.resetDefaults': 'Reset to Default Preferences',
};

const uz: TranslationKeys = {
  ...en,
  'nav.xongle': 'Xongle',
  'nav.xonddit': 'Xonddit',
  'nav.xonmini': 'Xonmini',
  'nav.profile': 'Profil',
  'nav.settings': 'Sozlamalar',
  'nav.owner': 'Boshqaruv',
  'nav.signIn': 'Kirish',
  'nav.signOut': 'Chiqish',
  'nav.homeFeed': 'Asosiy lenta',
  'nav.allCommunities': 'Barcha jamoalar',
  'nav.communities': 'Jamoalar',
  'nav.search': 'Qidiruv',
  'nav.clear': 'Tozalash',
  'nav.cancel': 'Bekor qilish',
  'nav.save': 'Saqlash',
  'nav.saved': 'Saqlandi',
  'nav.close': 'Yopish',
  'nav.backToFeed': 'Lentaga qaytish',
  'nav.loading': 'Yuklanmoqda...',
  'nav.refresh': 'Yangilash',

  'xonddit.tagline': 'Jamoalar va muhokamalar maydoni',
  'xonddit.filterPlaceholder': 'Lentani saralang yoki Xongle uchun Enter bosing...',
  'xonddit.createPost': 'Yangi post',
  'xonddit.newCommunity': 'Yangi jamoa',
  'xonddit.sort.hot': 'Qaynoq',
  'xonddit.sort.new': 'Yangi',
  'xonddit.sort.top': 'Top',
  'xonddit.sort.best': 'Eng yaxshi',
  'xonddit.topic': 'Mavzu',
  'xonddit.postedBy': 'muallif:',
  'xonddit.comments': 'izohlar',
  'xonddit.share': 'Ulashish',
  'xonddit.copied': 'Nusxalandi',
  'xonddit.delete': 'O‘chirish',
  'xonddit.confirmDelete': 'O‘chirilsinmi?',
  'xonddit.noPostsTitle': 'Hozircha muhokamalar yo‘q',
  'xonddit.noPostsDesc': 'Birinchi bo‘lib post yozing yoki mavzu filtrini o‘zgartiring.',
  'xonddit.commentPlaceholder': 'Muhokamaga o‘z fikringizni yozing...',
  'xonddit.postComment': 'Izoh qoldirish',
  'xonddit.posting': 'Yuborilmoqda...',
  'xonddit.reply': 'Javob berish',
  'xonddit.discussion': 'Muhokama izohlari',
  'xonddit.noComments': 'Hozircha izohlar yo‘q. Birinchi bo‘lib fikr bildiring.',
  'xonddit.publishedPosts': 'Postlar soni',
  'xonddit.creator': 'Asoschi',
  'xonddit.directory': 'Jamoalar katalogi',
  'xonddit.indexedOnXongle': 'Xongle qidiruv tizimiga ulangan',
  'xonddit.openXongle': 'Xongle qidiruvini ochish',
  'xonddit.showingCommunity': 'Jamoa:',
  'xonddit.clearFilter': 'Barcha postlar',

  'xonmini.subtitle': 'Tahlil va muloqot studiyasi',
  'xonmini.heroTitle': 'Savol bering, mavzularni o‘rganing yoki Xonddit muhokamalarini izlang.',
  'xonmini.heroDesc': 'Salomlashing, dasturlash, fan va texnologiya haqida so‘rang yoki Xonddit jamoalarini tahlil qiling.',
  'xonmini.newQuery': 'Yangi suhbat',
  'xonmini.recentQueries': 'Suhbatlar tarixi',
  'xonmini.noRecentQueries': 'Hozircha suhbatlar yo‘q.',
  'xonmini.corpusTitle': 'Xonddit indeksi',
  'xonmini.mode.summary': 'Qisqa',
  'xonmini.mode.detailed': 'Batafsil',
  'xonmini.mode.digest': 'Dayjest',
  'xonmini.inputPlaceholder': 'Salom deb yozing, mavzu so‘rang yoki Xondditdan izlang...',
  'xonmini.footerNote': 'Xonmini oddiy suhbat, turli mavzular va Xonddit jamoalari bo‘yicha javob beradi.',
  'xonmini.searchingIndex': 'Javob tayyorlanmoqda...',
  'xonmini.matchedOnXonddit': 'Xonddit manbalari',
  'xonmini.retry': 'Qayta urinish',
  'xonmini.copy': 'Nusxa olish',
  'xonmini.exploreCommunities': 'Faol jamoani tanlang:',
  'xonmini.starter.greetingTitle': 'Xonmini bilan salomlashing',
  'xonmini.starter.greetingCategory': '01 · Muloqot',
  'xonmini.starter.topicsTitle': 'Dasturlash, AI va ilm-fan',
  'xonmini.starter.topicsCategory': '02 · Mavzu tahlili',
  'xonmini.starter.communitiesTitle': 'Barcha c/ jamoalar ro‘yxati',
  'xonmini.starter.communitiesCategory': '03 · Jamoalar katalogi',
  'xonmini.starter.trendingTitle': 'Eng ko‘p ovoz olgan postlar',
  'xonmini.starter.trendingCategory': '04 · Trenddagi mavzular',

  'xongle.searchPlaceholder': 'Xonddit, Xonmini yoki mavzuni qidiring...',
  'xongle.askXonmini': 'Xonminidan so‘rash',
  'xongle.openXonddit': 'Xondditni ochish',
  'xongle.resultsIndexed': 'ta natija topildi',
  'xongle.saveSearch': 'Saqlash',
  'xongle.noResultsTitle': 'Xondditda mos natija topilmadi',

  'settings.title': 'Sozlamalar va moslashtirish',
  'settings.searchPlaceholder': 'Sozlamalarni qidirish (til, rang, mavzu, maxfiylik...)',
  'settings.tab.overview': 'Umumiy',
  'settings.tab.account': 'Hisob va profil',
  'settings.tab.appearance': 'Ko‘rinish va ranglar',
  'settings.tab.language': 'Til va mintaqa',
  'settings.tab.notifications': 'Bildirishnomalar',
  'settings.tab.accessibility': 'Qulayliklar',
  'settings.tab.privacy': 'Maxfiylik va xavfsizlik',
  'settings.account.title': 'Ochiq profil ma’lumotlari',
  'settings.account.desc': 'Xonddit va Xonmini uchun u/ taxallus, ism va rasmni boshqaring.',
  'settings.account.displayName': 'Ko‘rinadigan ism',
  'settings.account.username': 'Foydalanuvchi nomi (u/)',
  'settings.account.bio': 'Qisqacha ma’lumot',
  'settings.account.avatar': 'Profil rasmi',
  'settings.account.uploadPhoto': 'Rasm yuklash',
  'settings.account.saveProfile': 'Profilni saqlash',
  'settings.account.profileSaved': 'Profil muvaffaqiyatli saqlandi.',
  'settings.appearance.title': 'Mavzu, palitra va kontrast',
  'settings.appearance.desc': 'Yorug‘/qorong‘i rejim va avtomatik WCAG kontrast himoyasiga ega urg‘u ranglarini tanlang.',
  'settings.appearance.themeMode': 'Mavzu rejimi',
  'settings.appearance.themeDark': 'Qorong‘i',
  'settings.appearance.themeLight': 'Yorug‘',
  'settings.appearance.themeSystem': 'Tizim',
  'settings.appearance.paletteTitle': 'Maxsus rang palitralari',
  'settings.appearance.paletteDesc': 'Har bir palitra fon, chegara va matn ranglarini uyg‘unlashtiradi.',
  'settings.appearance.xondditAccent': 'Xonddit urg‘u rangi',
  'settings.appearance.xonminiAccent': 'Xonmini urg‘u rangi',
  'settings.appearance.contrastVerified': 'WCAG kontrasti tasdiqlangan',
  'settings.appearance.contrastAdjusted': 'O‘qishga qulay bo‘lishi uchun avtomatik moslashtirildi',
  'settings.appearance.applyRecommended': 'Tavsiya etilgan rangni qo‘llash',
  'settings.appearance.density': 'Interfeys zichligi',
  'settings.appearance.comfortable': 'Qulay',
  'settings.appearance.compact': 'Ixcham',
  'settings.language.title': 'Interfeys tili',
  'settings.language.desc': 'Menyu va tugmalar tilini tanlang. Foydalanuvchi postlari va izohlari avtomatik tarjima qilinmaydi.',
  'settings.language.searchPlaceholder': 'Tilni qidiring (O‘zbekcha, English, Русский, العربية)...',
  'settings.language.rtlBadge': 'O‘ngdan chapga (RTL)',
  'settings.language.contentNotice': 'Postlar, izohlar va foydalanuvchi nomlari asl holida qoladi.',
  'settings.notifications.title': 'Bildirishnomalar',
  'settings.notifications.desc': 'Izohlar va jamoa yangiliklari haqida xabarlarni boshqaring.',
  'settings.notifications.replies': 'Izoh javoblari',
  'settings.notifications.repliesDesc': 'Sizning postlaringizga yozilgan yangi javoblarni ko‘rsatish.',
  'settings.notifications.community': 'Jamoa faolligi',
  'settings.notifications.communityDesc': 'Katalogdagi jamoalar postlari sonini ko‘rsatish.',
  'settings.notifications.sound': 'Ovoz effektlari',
  'settings.notifications.soundDesc': 'Tugmalar bosilganda muloyim tovush chiqarish.',
  'settings.accessibility.title': 'Qulaylik va o‘qish',
  'settings.accessibility.desc': 'Animatsiyalar, klaviatura fokusi va matn o‘lchamini sozlang.',
  'settings.accessibility.reduceMotion': 'Harakatlarni kamaytirish',
  'settings.accessibility.reduceMotionDesc': 'Animatsiya va silliq o‘tishlarni o‘chirish.',
  'settings.accessibility.highContrast': 'Yuqori kontrastli fokus',
  'settings.accessibility.highContrastDesc': 'Klaviatura orqali boshqarishda aniq fokus chizig‘ini ko‘rsatish.',
  'settings.accessibility.fontScale': 'Shrift o‘lchami',
  'settings.privacy.title': 'Maxfiylik va xotira',
  'settings.privacy.desc': 'Qidiruv tarixi va Xonmini suhbatlarini boshqaring.',
  'settings.privacy.saveSearch': 'Qidiruv tarixini saqlash',
  'settings.privacy.saveSearchDesc': 'Xongle qidiruv so‘rovlarini brauzerda eslab qolish.',
  'settings.privacy.saveChat': 'Xonmini suhbatlarini saqlash',
  'settings.privacy.saveChatDesc': 'Sahifa yangilanganda suhbatlar tarixini saqlab qolish.',
  'settings.privacy.clearSearchBtn': 'Qidiruv tarixini tozalash',
  'settings.privacy.clearChatBtn': 'Xonmini tarixini tozalash',
  'settings.privacy.confirmClear': 'Tasdiqlash uchun yana bosing',
  'settings.privacy.clearedSuccess': 'Ma’lumotlar tozalandi.',
  'settings.resetDefaults': 'Standart holatga qaytarish',
};

const ru: TranslationKeys = {
  ...en,
  'nav.profile': 'Профиль',
  'nav.settings': 'Настройки',
  'nav.owner': 'Владелец',
  'nav.signIn': 'Войти',
  'nav.signOut': 'Выйти',
  'nav.homeFeed': 'Лента',
  'nav.allCommunities': 'Все сообщества',
  'nav.communities': 'Сообщества',
  'nav.search': 'Поиск',
  'nav.clear': 'Очистить',
  'nav.cancel': 'Отмена',
  'nav.save': 'Сохранить',
  'nav.saved': 'Сохранено',
  'nav.close': 'Закрыть',
  'nav.backToFeed': 'Назад к ленте',
  'nav.loading': 'Загрузка...',
  'nav.refresh': 'Обновить',

  'xonddit.tagline': 'Сообщества и редакционные дискуссии',
  'xonddit.filterPlaceholder': 'Фильтр постов или Enter для поиска в Xongle...',
  'xonddit.createPost': 'Создать пост',
  'xonddit.newCommunity': 'Новое сообщество',
  'xonddit.sort.hot': 'Горячее',
  'xonddit.sort.new': 'Новое',
  'xonddit.sort.top': 'Топ',
  'xonddit.sort.best': 'Лучшее',
  'xonddit.topic': 'Тема',
  'xonddit.postedBy': 'автор:',
  'xonddit.comments': 'комментариев',
  'xonddit.share': 'Поделиться',
  'xonddit.copied': 'Скопировано',
  'xonddit.delete': 'Удалить',
  'xonddit.confirmDelete': 'Удалить пост?',
  'xonddit.noPostsTitle': 'В этой ленте пока нет публикаций',
  'xonddit.noPostsDesc': 'Создайте первую тему или измените фильтр.',
  'xonddit.commentPlaceholder': 'Напишите содержательный комментарий...',
  'xonddit.postComment': 'Отправить',
  'xonddit.posting': 'Отправка...',
  'xonddit.reply': 'Ответить',
  'xonddit.discussion': 'Обсуждение',
  'xonddit.noComments': 'Комментариев пока нет. Начните обсуждение первым.',
  'xonddit.publishedPosts': 'Публикации',
  'xonddit.creator': 'Основатель',
  'xonddit.directory': 'Каталог сообществ',
  'xonddit.indexedOnXongle': 'Индексируется в поиске Xongle',
  'xonddit.openXongle': 'Открыть поиск Xongle',
  'xonddit.showingCommunity': 'Сообщество',
  'xonddit.clearFilter': 'Вся лента',

  'xonmini.subtitle': 'Студия синтеза и диалога',
  'xonmini.heroTitle': 'Задайте вопрос, изучите тему или найдите обсуждения на Xonddit.',
  'xonmini.heroDesc': 'Общайтесь свободно, разбирайте технические и научные темы или ищите по живой базе Xonddit.',
  'xonmini.newQuery': 'Новый диалог',
  'xonmini.recentQueries': 'История сессий',
  'xonmini.noRecentQueries': 'История запросов пуста.',
  'xonmini.corpusTitle': 'Индекс Xonddit',
  'xonmini.mode.summary': 'Кратко',
  'xonmini.mode.detailed': 'Подробно',
  'xonmini.mode.digest': 'Дайджест',
  'xonmini.inputPlaceholder': 'Напишите привет, задайте вопрос по теме или ищите в Xonddit...',
  'xonmini.footerNote': 'Xonmini отвечает на приветствия, общие темы и запросы по базе Xonddit.',
  'xonmini.searchingIndex': 'Синтез ответа...',
  'xonmini.matchedOnXonddit': 'Источники из Xonddit',
  'xonmini.retry': 'Повторить',
  'xonmini.copy': 'Копировать',
  'xonmini.exploreCommunities': 'Перейти к сообществу:',
  'xonmini.starter.greetingTitle': 'Поздороваться с Xonmini',
  'xonmini.starter.greetingCategory': '01 · Диалог',
  'xonmini.starter.topicsTitle': 'Разработка, ИИ и наука',
  'xonmini.starter.topicsCategory': '02 · Разбор темы',
  'xonmini.starter.communitiesTitle': 'Список активных c/ сообществ',
  'xonmini.starter.communitiesCategory': '03 · Сообщества',
  'xonmini.starter.trendingTitle': 'Дайджест популярных постов',
  'xonmini.starter.trendingCategory': '04 · Тренды',

  'xongle.searchPlaceholder': 'Поиск в Xonddit, Xonmini или по темам...',
  'xongle.askXonmini': 'Спросить Xonmini',
  'xongle.openXonddit': 'Открыть Xonddit',
  'xongle.resultsIndexed': 'результатов найдено',
  'xongle.saveSearch': 'Сохранить',
  'xongle.noResultsTitle': 'Ничего не найдено на Xonddit',

  'settings.title': 'Настройки и оформление',
  'settings.searchPlaceholder': 'Поиск настроек (язык, тема, палитра, приватность...)',
  'settings.tab.overview': 'Обзор',
  'settings.tab.account': 'Аккаунт',
  'settings.tab.appearance': 'Оформление и цвета',
  'settings.tab.language': 'Язык и регион',
  'settings.tab.notifications': 'Уведомления',
  'settings.tab.accessibility': 'Доступность',
  'settings.tab.privacy': 'Приватность и защита',
  'settings.account.title': 'Профиль и идентификация',
  'settings.account.desc': 'Управляйте своим именем, u/ никнеймом и аватаром для Xonddit и Xonmini.',
  'settings.account.displayName': 'Отображаемое имя',
  'settings.account.username': 'Имя пользователя (u/)',
  'settings.account.bio': 'О себе',
  'settings.account.avatar': 'Аватар профиля',
  'settings.account.uploadPhoto': 'Загрузить фото',
  'settings.account.saveProfile': 'Сохранить профиль',
  'settings.account.profileSaved': 'Профиль успешно обновлен.',
  'settings.appearance.title': 'Тема, палитры и контроль контраста',
  'settings.appearance.desc': 'Настройте тему и акцентные цвета с автоматической проверкой контрастности WCAG.',
  'settings.appearance.themeMode': 'Режим темы',
  'settings.appearance.themeDark': 'Тёмная',
  'settings.appearance.themeLight': 'Светлая',
  'settings.appearance.themeSystem': 'Системная',
  'settings.appearance.paletteTitle': 'Курируемые палитры',
  'settings.appearance.paletteDesc': 'Каждая палитра гармонично сочетает фон, поверхности, границы и текст.',
  'settings.appearance.xondditAccent': 'Акцент Xonddit',
  'settings.appearance.xonminiAccent': 'Акцент Xonmini',
  'settings.appearance.contrastVerified': 'Контраст WCAG подтвержден',
  'settings.appearance.contrastAdjusted': 'Автоматически скорректировано для читаемости',
  'settings.appearance.applyRecommended': 'Применить рекомендуемый тон',
  'settings.appearance.density': 'Плотность интерфейса',
  'settings.appearance.comfortable': 'Стандартная',
  'settings.appearance.compact': 'Компактная',
  'settings.language.title': 'Язык интерфейса',
  'settings.language.desc': 'Выберите язык меню и элементов управления. Посты и комментарии пользователей не переводятся автоматически.',
  'settings.language.searchPlaceholder': 'Поиск языка (Русский, O‘zbekcha, English, العربية)...',
  'settings.language.rtlBadge': 'Справа налево (RTL)',
  'settings.language.contentNotice': 'Пользовательские публикации, комментарии и никнеймы остаются на языке оригинала.',
  'settings.notifications.title': 'Уведомления',
  'settings.notifications.desc': 'Настройте оповещения об ответах и активности сообществ.',
  'settings.notifications.replies': 'Ответы в ветках',
  'settings.notifications.repliesDesc': 'Оповещать о новых комментариях к вашим публикациям.',
  'settings.notifications.community': 'Активность сообществ',
  'settings.notifications.communityDesc': 'Показывать счетчики публикаций в каталоге сообществ.',
  'settings.notifications.sound': 'Звуковой отклик',
  'settings.notifications.soundDesc': 'Воспроизводить мягкие звуки при действиях.',
  'settings.accessibility.title': 'Доступность и чтение',
  'settings.accessibility.desc': 'Настройте анимации, контуры фокуса и размер шрифта.',
  'settings.accessibility.reduceMotion': 'Уменьшить движение',
  'settings.accessibility.reduceMotionDesc': 'Отключить плавные переходы и анимации интерфейса.',
  'settings.accessibility.highContrast': 'Контрастный фокус клавиатуры',
  'settings.accessibility.highContrastDesc': 'Усиленная рамка фокуса при навигации с клавиатуры.',
  'settings.accessibility.fontScale': 'Размер текста',
  'settings.privacy.title': 'Приватность и данные',
  'settings.privacy.desc': 'Управление историей поиска Xongle и сессиями Xonmini.',
  'settings.privacy.saveSearch': 'Сохранять историю поиска',
  'settings.privacy.saveSearchDesc': 'Хранить недавние запросы локально для быстрых подсказок.',
  'settings.privacy.saveChat': 'Сохранять диалоги Xonmini',
  'settings.privacy.saveChatDesc': 'Сохранять историю сообщений между перезагрузками страницы.',
  'settings.privacy.clearSearchBtn': 'Очистить историю поиска',
  'settings.privacy.clearChatBtn': 'Очистить сессии Xonmini',
  'settings.privacy.confirmClear': 'Нажмите еще раз для подтверждения',
  'settings.privacy.clearedSuccess': 'Локальные данные очищены.',
  'settings.resetDefaults': 'Сбросить настройки по умолчанию',
};

const ar: TranslationKeys = {
  ...en,
  'nav.profile': 'الملف الشخصي',
  'nav.settings': 'الإعدادات',
  'nav.owner': 'المالك',
  'nav.signIn': 'تسجيل الدخول',
  'nav.signOut': 'تسجيل الخروج',
  'nav.homeFeed': 'الرئيسية',
  'nav.allCommunities': 'جميع المجتمعات',
  'nav.communities': 'المجتمعات',
  'nav.search': 'بحث',
  'nav.clear': 'مسح',
  'nav.cancel': 'إلغاء',
  'nav.save': 'حفظ التغييرات',
  'nav.saved': 'تم الحفظ',
  'nav.close': 'إغلاق',
  'nav.backToFeed': 'العودة إلى الخلاصة',
  'nav.loading': 'جاري التحميل...',
  'nav.refresh': 'تحديث',

  'xonddit.tagline': 'منصة المجتمعات والنقاشات التحريرية',
  'xonddit.filterPlaceholder': 'صفِّ النقاشات أو اضغط Enter للبحث في Xongle...',
  'xonddit.createPost': 'منشور جديد',
  'xonddit.newCommunity': 'مجتمع جديد',
  'xonddit.sort.hot': 'الرائج',
  'xonddit.sort.new': 'الأحدث',
  'xonddit.sort.top': 'الأعلى تقييماً',
  'xonddit.sort.best': 'الأفضل',
  'xonddit.topic': 'الموضوع',
  'xonddit.postedBy': 'بواسطة',
  'xonddit.comments': 'تعليقات',
  'xonddit.share': 'مشاركة',
  'xonddit.copied': 'تم النسخ',
  'xonddit.delete': 'حذف',
  'xonddit.confirmDelete': 'تأكيد الحذف؟',
  'xonddit.noPostsTitle': 'لا توجد نقاشات منشورة بعد',
  'xonddit.noPostsDesc': 'ابدأ أول نقاش في هذا المجتمع أو غيّر عامل التصفية.',
  'xonddit.commentPlaceholder': 'أضف مساهمتك أو ردك في هذا النقاش...',
  'xonddit.postComment': 'إرسال الرد',
  'xonddit.posting': 'جاري النشر...',
  'xonddit.reply': 'رد',
  'xonddit.discussion': 'النقاش والتعليقات',
  'xonddit.noComments': 'لا توجد تعليقات حتى الآن. كن أول من يشارك رأيه.',
  'xonddit.publishedPosts': 'المنشورات',
  'xonddit.creator': 'المؤسس',
  'xonddit.directory': 'دليل المجتمعات',
  'xonddit.indexedOnXongle': 'مفهرس في محرك بحث Xongle',
  'xonddit.openXongle': 'فتح بحث Xongle',
  'xonddit.showingCommunity': 'عرض مجتمع',
  'xonddit.clearFilter': 'كل المنشورات',

  'xonmini.subtitle': 'مكتب التحليل والحوار الذكي',
  'xonmini.heroTitle': 'اطرح سؤالاً، استكشف موضوعاً، أو ابحث في نقاشات Xonddit.',
  'xonmini.heroDesc': 'تحدث بحرية، استفسر عن البرمجة والعلوم والتقنية، أو استخرج ملخصات من مجتمعات Xonddit.',
  'xonmini.newQuery': 'حوار جديد',
  'xonmini.recentQueries': 'سجل الجلسات',
  'xonmini.noRecentQueries': 'لا توجد جلسات سابقة.',
  'xonmini.corpusTitle': 'فهرس Xonddit الحي',
  'xonmini.mode.summary': 'موجز',
  'xonmini.mode.detailed': 'مفصّل',
  'xonmini.mode.digest': 'خلاصة تحريرية',
  'xonmini.inputPlaceholder': 'ألقِ التحية، اسأل عن أي موضوع، أو ابحث في Xonddit...',
  'xonmini.footerNote': 'يجيب Xonmini عن المحادثات اليومية والمواضيع العامة ومحتوى مجتمعات Xonddit.',
  'xonmini.searchingIndex': 'جاري تحضير الإجابة...',
  'xonmini.matchedOnXonddit': 'المصادر المطابقة في Xonddit',
  'xonmini.retry': 'إعادة المحاولة',
  'xonmini.copy': 'نسخ',
  'xonmini.exploreCommunities': 'استكشف مجتمعاً مفهرساً:',
  'xonmini.starter.greetingTitle': 'ألقِ التحية على Xonmini',
  'xonmini.starter.greetingCategory': '01 · محادثة',
  'xonmini.starter.topicsTitle': 'استكشف البرمجة والذكاء الاصطناعي والعلوم',
  'xonmini.starter.topicsCategory': '02 · شرح المواضيع',
  'xonmini.starter.communitiesTitle': 'استعراض جميع مجتمعات c/',
  'xonmini.starter.communitiesCategory': '03 · دليل المجتمعات',
  'xonmini.starter.trendingTitle': 'ملخص أبرز المنشورات والنقاشات',
  'xonmini.starter.trendingCategory': '04 · النقاشات الرائجة',

  'xongle.searchPlaceholder': 'ابحث في Xonddit أو Xonmini أو أي موضوع...',
  'xongle.askXonmini': 'اسأل Xonmini',
  'xongle.openXonddit': 'افتح Xonddit',
  'xongle.resultsIndexed': 'نتيجة مفهرسة',
  'xongle.saveSearch': 'حفظ البحث',
  'xongle.noResultsTitle': 'لا توجد نتائج مطابقة في Xonddit',

  'settings.title': 'الإعدادات والتخصيص',
  'settings.searchPlaceholder': 'ابحث في الإعدادات (اللغة، المظهر، الألوان، الخصوصية...)',
  'settings.tab.overview': 'نظرة عامة',
  'settings.tab.account': 'الحساب والهوية',
  'settings.tab.appearance': 'المظهر والألوان',
  'settings.tab.language': 'اللغة والمنطقة',
  'settings.tab.notifications': 'الإشعارات',
  'settings.tab.accessibility': 'إمكانية الوصول',
  'settings.tab.privacy': 'الخصوصية والأمان',
  'settings.account.title': 'الهوية العامة واسم المستخدم',
  'settings.account.desc': 'إدارة اسم العرض ومعرف u/ والصورة الرمزية عبر Xonddit و Xonmini.',
  'settings.account.displayName': 'الاسم المعروض',
  'settings.account.username': 'اسم المستخدم (u/)',
  'settings.account.bio': 'نبذة مختصرة',
  'settings.account.avatar': 'الصورة الشخصية',
  'settings.account.uploadPhoto': 'رفع صورة',
  'settings.account.saveProfile': 'حفظ الهوية',
  'settings.account.profileSaved': 'تم تحديث الملف الشخصي بنجاح.',
  'settings.appearance.title': 'المظهر، لوحات الألوان والتباين الذكي',
  'settings.appearance.desc': 'خصص الوضع الفاتح أو الداكن وألوان التمييز مع ضمان تباين القراءة تلقائياً وفق معايير WCAG.',
  'settings.appearance.themeMode': 'وضع المظهر',
  'settings.appearance.themeDark': 'داكن',
  'settings.appearance.themeLight': 'فاتح',
  'settings.appearance.themeSystem': 'النظام',
  'settings.appearance.paletteTitle': 'لوحات الألوان المنتقاة',
  'settings.appearance.paletteDesc': 'توازن كل لوحة بين الخلفية والأسطح والحدود والنصوص بدقة.',
  'settings.appearance.xondditAccent': 'لون تمييز Xonddit',
  'settings.appearance.xonminiAccent': 'لون تمييز Xonmini',
  'settings.appearance.contrastVerified': 'تباين WCAG محقق',
  'settings.appearance.contrastAdjusted': 'تم ضبط السطوع تلقائياً لضمان وضوح القراءة',
  'settings.appearance.applyRecommended': 'تطبيق الدرجة الموصى بها',
  'settings.appearance.density': 'كثافة الواجهة',
  'settings.appearance.comfortable': 'مريحة',
  'settings.appearance.compact': 'مضغوطة',
  'settings.language.title': 'لغة الواجهة',
  'settings.language.desc': 'اختر لغة القوائم والأزرار مع دعم كامل لتخطيط اليمين إلى اليسار (RTL). لا تتم ترجمة منشورات المستخدمين تلقائياً.',
  'settings.language.searchPlaceholder': 'ابحث عن لغة (العربية، O‘zbekcha, English, Русский)...',
  'settings.language.rtlBadge': 'من اليمين إلى اليسار (RTL)',
  'settings.language.contentNotice': 'تبقى المنشورات والتعليقات وأسماء المستخدمين بلغتها الأصلية.',
  'settings.notifications.title': 'الإشعارات والتنبيهات',
  'settings.notifications.desc': 'تحكم في تنبيهات الردود ونشاط المجتمعات.',
  'settings.notifications.replies': 'تنبيهات الردود',
  'settings.notifications.repliesDesc': 'إظهار إشعار عند وجود ردود جديدة على منشوراتك.',
  'settings.notifications.community': 'نشاط المجتمعات',
  'settings.notifications.communityDesc': 'عرض عدادات المنشورات في دليل المجتمعات.',
  'settings.notifications.sound': 'المؤثرات الصوتية الخفيفة',
  'settings.notifications.soundDesc': 'تشغيل استجابة صوتية هادئة عند التفاعل.',
  'settings.accessibility.title': 'إمكانية الوصول وراحة القراءة',
  'settings.accessibility.desc': 'تحكم في الحركة، وحجم الخط، ووضوح مؤشر لوحة المفاتيح.',
  'settings.accessibility.reduceMotion': 'تقليل الحركة',
  'settings.accessibility.reduceMotionDesc': 'تقليل التأثيرات الحركية والانتقالات.',
  'settings.accessibility.highContrast': 'إطار تركيز عالي التباين',
  'settings.accessibility.highContrastDesc': 'إظهار إطار واضح عند التنقل عبر لوحة المفاتيح.',
  'settings.accessibility.fontScale': 'حجم الخط',
  'settings.privacy.title': 'الخصوصية والبيانات المحلية',
  'settings.privacy.desc': 'إدارة سجل بحث Xongle وجلسات Xonmini المحفوظة.',
  'settings.privacy.saveSearch': 'حفظ سجل البحث',
  'settings.privacy.saveSearchDesc': 'الاحتفاظ بعمليات البحث الأخيرة محلياً للاقتراحات السريعة.',
  'settings.privacy.saveChat': 'حفظ جلسات Xonmini',
  'settings.privacy.saveChatDesc': 'الاحتفاظ بمحادثات Xonmini في المتصفح.',
  'settings.privacy.clearSearchBtn': 'مسح سجل البحث',
  'settings.privacy.clearChatBtn': 'مسح جلسات Xonmini',
  'settings.privacy.confirmClear': 'اضغط مرة أخرى للتأكيد',
  'settings.privacy.clearedSuccess': 'تم مسح البيانات بنجاح.',
  'settings.resetDefaults': 'إعادة الضبط إلى الإعدادات الافتراضية',
};

const tr: TranslationKeys = {
  ...en,
  'nav.profile': 'Profil',
  'nav.settings': 'Ayarlar',
  'nav.signIn': 'Giriş Yap',
  'nav.signOut': 'Çıkış Yap',
  'nav.homeFeed': 'Ana Akış',
  'nav.allCommunities': 'Tüm Topluluklar',
  'nav.communities': 'Topluluklar',
  'nav.search': 'Ara',
  'nav.cancel': 'İptal',
  'nav.save': 'Kaydet',
  'nav.close': 'Kapat',
  'xonddit.createPost': 'Yeni Gönderi',
  'xonddit.newCommunity': 'Yeni Topluluk',
  'settings.title': 'Ayarlar ve Tercihler',
  'settings.tab.account': 'Hesap',
  'settings.tab.appearance': 'Görünüm ve Renkler',
  'settings.tab.language': 'Dil ve Bölge',
  'settings.tab.notifications': 'Bildirimler',
  'settings.tab.accessibility': 'Erişilebilirlik',
  'settings.tab.privacy': 'Gizlilik ve Güvenlik',
};

const es: TranslationKeys = {
  ...en,
  'nav.profile': 'Perfil',
  'nav.settings': 'Ajustes',
  'nav.signIn': 'Iniciar sesión',
  'nav.signOut': 'Cerrar sesión',
  'nav.homeFeed': 'Inicio',
  'nav.allCommunities': 'Todas las comunidades',
  'nav.communities': 'Comunidades',
  'nav.search': 'Buscar',
  'nav.cancel': 'Cancelar',
  'nav.save': 'Guardar cambios',
  'nav.close': 'Cerrar',
  'xonddit.createPost': 'Nueva publicación',
  'xonddit.newCommunity': 'Nueva comunidad',
  'settings.title': 'Ajustes y Preferencias',
  'settings.tab.account': 'Cuenta e Identidad',
  'settings.tab.appearance': 'Apariencia y Paleta',
  'settings.tab.language': 'Idioma y Región',
  'settings.tab.notifications': 'Notificaciones',
  'settings.tab.accessibility': 'Accesibilidad',
  'settings.tab.privacy': 'Privacidad y Seguridad',
};

const de: TranslationKeys = {
  ...en,
  'nav.profile': 'Profil',
  'nav.settings': 'Einstellungen',
  'nav.signIn': 'Anmelden',
  'nav.signOut': 'Abmelden',
  'nav.homeFeed': 'Startseite',
  'nav.allCommunities': 'Alle Communities',
  'nav.communities': 'Communities',
  'nav.search': 'Suche',
  'nav.cancel': 'Abbrechen',
  'nav.save': 'Speichern',
  'nav.close': 'Schließen',
  'xonddit.createPost': 'Neuer Beitrag',
  'xonddit.newCommunity': 'Neue Community',
  'settings.title': 'Einstellungen & Präferenzen',
  'settings.tab.account': 'Konto & Identität',
  'settings.tab.appearance': 'Darstellung & Farben',
  'settings.tab.language': 'Sprache & Region',
  'settings.tab.notifications': 'Benachrichtigungen',
  'settings.tab.accessibility': 'Barrierefreiheit',
  'settings.tab.privacy': 'Datenschutz & Sicherheit',
};

const fr: TranslationKeys = {
  ...en,
  'nav.profile': 'Profil',
  'nav.settings': 'Paramètres',
  'nav.signIn': 'Connexion',
  'nav.signOut': 'Déconnexion',
  'nav.homeFeed': 'Flux principal',
  'nav.allCommunities': 'Toutes les communautés',
  'nav.communities': 'Communautés',
  'nav.search': 'Rechercher',
  'nav.cancel': 'Annuler',
  'nav.save': 'Enregistrer',
  'nav.close': 'Fermer',
  'xonddit.createPost': 'Nouvelle publication',
  'xonddit.newCommunity': 'Nouvelle communauté',
  'settings.title': 'Paramètres et Préférences',
  'settings.tab.account': 'Compte et Identité',
  'settings.tab.appearance': 'Apparence et Palette',
  'settings.tab.language': 'Langue et Région',
  'settings.tab.notifications': 'Notifications',
  'settings.tab.accessibility': 'Accessibilité',
  'settings.tab.privacy': 'Confidentialité et Sécurité',
};

const ja: TranslationKeys = {
  ...en,
  'nav.profile': 'プロフィール',
  'nav.settings': '設定',
  'nav.signIn': 'ログイン',
  'nav.signOut': 'ログアウト',
  'nav.homeFeed': 'ホームフィード',
  'nav.allCommunities': 'すべてのコミュニティ',
  'nav.communities': 'コミュニティ',
  'nav.search': '検索',
  'nav.cancel': 'キャンセル',
  'nav.save': '変更を保存',
  'nav.close': '閉じる',
  'xonddit.createPost': '新規投稿',
  'xonddit.newCommunity': '新しいコミュニティ',
  'settings.title': '設定と環境設定',
  'settings.tab.account': 'アカウントとID',
  'settings.tab.appearance': '外観とカラーパレット',
  'settings.tab.language': '言語と地域',
  'settings.tab.notifications': '通知',
  'settings.tab.accessibility': 'アクセシビリティ',
  'settings.tab.privacy': 'プライバシーとセキュリティ',
};

export const TRANSLATIONS: Record<SupportedLanguage, TranslationKeys> = {
  en,
  uz,
  ru,
  ar,
  tr,
  es,
  de,
  fr,
  ja,
};

export function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const navLangs = navigator.languages || [navigator.language || 'en'];
    for (const raw of navLangs) {
      const prefix = raw.toLowerCase().split('-')[0] as SupportedLanguage;
      if (prefix && prefix in TRANSLATIONS) {
        return prefix;
      }
    }
  } catch {
    // Fallback
  }
  return 'en';
}
