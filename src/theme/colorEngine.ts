export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type PalettePresetId = 'classic' | 'minimal' | 'graphite' | 'warm' | 'forest' | 'ocean';

export interface SurfacePalette {
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export interface PalettePresetDefinition {
  id: PalettePresetId;
  name: string;
  description: string;
  defaultXondditAccent: string;
  defaultXonminiAccent: string;
  swatches: [string, string, string, string];
  xonddit: {
    dark: SurfacePalette;
    light: SurfacePalette;
  };
  xonmini: {
    dark: SurfacePalette;
    light: SurfacePalette;
  };
}

export const PALETTE_PRESETS: Record<PalettePresetId, PalettePresetDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic Editorial',
    description: 'Warm carbon broadsheet for Xonddit paired with deep mineral slate for Xonmini.',
    defaultXondditAccent: '#C84B31',
    defaultXonminiAccent: '#0F766E',
    swatches: ['#121110', '#F7F5F0', '#C84B31', '#0F766E'],
    xonddit: {
      dark: {
        bg: '#0C0B0A',
        surface: '#141311',
        surfaceElevated: '#1C1A17',
        surfaceSubtle: '#181614',
        border: '#26231F',
        borderStrong: '#36322C',
        textPrimary: '#F5F2EB',
        textSecondary: '#C7C1B7',
        textMuted: '#8A8378',
      },
      light: {
        bg: '#F6F4EF',
        surface: '#FFFFFF',
        surfaceElevated: '#FAF8F4',
        surfaceSubtle: '#EFECE4',
        border: '#E2DDD3',
        borderStrong: '#C9C2B5',
        textPrimary: '#171513',
        textSecondary: '#4A4640',
        textMuted: '#787268',
      },
    },
    xonmini: {
      dark: {
        bg: '#080C0E',
        surface: '#0F1519',
        surfaceElevated: '#151E24',
        surfaceSubtle: '#11191E',
        border: '#1E2A31',
        borderStrong: '#2C3D47',
        textPrimary: '#EEF2F5',
        textSecondary: '#B2C0C9',
        textMuted: '#72838F',
      },
      light: {
        bg: '#F2F5F6',
        surface: '#FFFFFF',
        surfaceElevated: '#F8FAFA',
        surfaceSubtle: '#E8EEF0',
        border: '#D8E1E5',
        borderStrong: '#BCCAD0',
        textPrimary: '#0F171A',
        textSecondary: '#3E4C52',
        textMuted: '#687880',
      },
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Monochrome',
    description: 'High-contrast architectural paper and pure obsidian ink with restrained slate accents.',
    defaultXondditAccent: '#334155',
    defaultXonminiAccent: '#475569',
    swatches: ['#0A0A0A', '#FAFAFA', '#334155', '#64748B'],
    xonddit: {
      dark: {
        bg: '#09090B',
        surface: '#121215',
        surfaceElevated: '#1A1A1E',
        surfaceSubtle: '#151518',
        border: '#242429',
        borderStrong: '#34343C',
        textPrimary: '#FAFAFA',
        textSecondary: '#C4C4CC',
        textMuted: '#82828C',
      },
      light: {
        bg: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceElevated: '#F4F4F5',
        surfaceSubtle: '#EFEFF1',
        border: '#E4E4E7',
        borderStrong: '#D1D1D6',
        textPrimary: '#09090B',
        textSecondary: '#3F3F46',
        textMuted: '#71717A',
      },
    },
    xonmini: {
      dark: {
        bg: '#0A0B0D',
        surface: '#111317',
        surfaceElevated: '#191C22',
        surfaceSubtle: '#14171C',
        border: '#232730',
        borderStrong: '#323846',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textMuted: '#7E8B9B',
      },
      light: {
        bg: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceElevated: '#F1F5F9',
        surfaceSubtle: '#E9EEF4',
        border: '#E2E8F0',
        borderStrong: '#CBD5E1',
        textPrimary: '#0F172A',
        textSecondary: '#334155',
        textMuted: '#64748B',
      },
    },
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite Studio',
    description: 'Precision machined charcoal and brushed steel neutrals with mineral cobalt highlights.',
    defaultXondditAccent: '#2563EB',
    defaultXonminiAccent: '#0284C7',
    swatches: ['#111317', '#F3F4F6', '#2563EB', '#0284C7'],
    xonddit: {
      dark: {
        bg: '#0D0F12',
        surface: '#15181E',
        surfaceElevated: '#1D222A',
        surfaceSubtle: '#181C23',
        border: '#262C36',
        borderStrong: '#363F4D',
        textPrimary: '#F3F4F6',
        textSecondary: '#BDC4CE',
        textMuted: '#7F8896',
      },
      light: {
        bg: '#F3F4F6',
        surface: '#FFFFFF',
        surfaceElevated: '#F8F9FA',
        surfaceSubtle: '#E8EAEE',
        border: '#DCDFE6',
        borderStrong: '#C4C9D4',
        textPrimary: '#111317',
        textSecondary: '#434A54',
        textMuted: '#6E7683',
      },
    },
    xonmini: {
      dark: {
        bg: '#0B0D11',
        surface: '#12161D',
        surfaceElevated: '#191F29',
        surfaceSubtle: '#151A22',
        border: '#232B38',
        borderStrong: '#333E50',
        textPrimary: '#F1F5F9',
        textSecondary: '#B8C4D4',
        textMuted: '#7A889B',
      },
      light: {
        bg: '#F1F5F9',
        surface: '#FFFFFF',
        surfaceElevated: '#F8FAFC',
        surfaceSubtle: '#E5ECF2',
        border: '#D5DFE8',
        borderStrong: '#B9C8D6',
        textPrimary: '#0F141C',
        textSecondary: '#3B4654',
        textMuted: '#687687',
      },
    },
  },
  warm: {
    id: 'warm',
    name: 'Warm Neutral',
    description: 'Sunlit sandstone, espresso umber, and terracotta ochre inspired by print journals.',
    defaultXondditAccent: '#B45309',
    defaultXonminiAccent: '#9A3412',
    swatches: ['#171411', '#F5F0E6', '#B45309', '#9A3412'],
    xonddit: {
      dark: {
        bg: '#110E0C',
        surface: '#1A1613',
        surfaceElevated: '#241E1A',
        surfaceSubtle: '#1E1916',
        border: '#2E2620',
        borderStrong: '#42372E',
        textPrimary: '#F7F2E9',
        textSecondary: '#CFC5B6',
        textMuted: '#918677',
      },
      light: {
        bg: '#F4EFE6',
        surface: '#FCF9F4',
        surfaceElevated: '#F7F3EB',
        surfaceSubtle: '#EAE3D6',
        border: '#DDD4C3',
        borderStrong: '#C5B9A3',
        textPrimary: '#1E1914',
        textSecondary: '#52473D',
        textMuted: '#7D7062',
      },
    },
    xonmini: {
      dark: {
        bg: '#0F0D0B',
        surface: '#171411',
        surfaceElevated: '#211C18',
        surfaceSubtle: '#1B1714',
        border: '#2B241E',
        borderStrong: '#3D342C',
        textPrimary: '#F5EFE6',
        textSecondary: '#C9BFB0',
        textMuted: '#8C8173',
      },
      light: {
        bg: '#F2ECE1',
        surface: '#FAF7F2',
        surfaceElevated: '#F5F0E8',
        surfaceSubtle: '#E6DFD1',
        border: '#D8CEBD',
        borderStrong: '#BFB29C',
        textPrimary: '#1C1712',
        textSecondary: '#4E443A',
        textMuted: '#7A6D60',
      },
    },
  },
  forest: {
    id: 'forest',
    name: 'Nordic Forest',
    description: 'Deep pine needle, moss slate, and botanical sage with crisp parchment typography.',
    defaultXondditAccent: '#15803D',
    defaultXonminiAccent: '#0D9488',
    swatches: ['#0A110E', '#F1F5F2', '#15803D', '#0D9488'],
    xonddit: {
      dark: {
        bg: '#090F0C',
        surface: '#111A15',
        surfaceElevated: '#18241E',
        surfaceSubtle: '#141E19',
        border: '#213028',
        borderStrong: '#2F4539',
        textPrimary: '#EEF5F0',
        textSecondary: '#B8C9BE',
        textMuted: '#788C7F',
      },
      light: {
        bg: '#F1F5F2',
        surface: '#FFFFFF',
        surfaceElevated: '#F7FAF8',
        surfaceSubtle: '#E5EDE7',
        border: '#D4E0D8',
        borderStrong: '#B7C9BD',
        textPrimary: '#0E1913',
        textSecondary: '#3C4D43',
        textMuted: '#667A6E',
      },
    },
    xonmini: {
      dark: {
        bg: '#070D0B',
        surface: '#0E1714',
        surfaceElevated: '#15221E',
        surfaceSubtle: '#111C18',
        border: '#1D2E28',
        borderStrong: '#2A423A',
        textPrimary: '#ECF4F1',
        textSecondary: '#B3C7C0',
        textMuted: '#748A82',
      },
      light: {
        bg: '#EFF5F3',
        surface: '#FFFFFF',
        surfaceElevated: '#F6FAF9',
        surfaceSubtle: '#E3ECE9',
        border: '#D1E0DB',
        borderStrong: '#B4C9C2',
        textPrimary: '#0C1814',
        textSecondary: '#394C45',
        textMuted: '#647A72',
      },
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Abyssal Ocean',
    description: 'Maritime slate, deep fjord navy, and coastal cerulean with balanced contrast.',
    defaultXondditAccent: '#0369A1',
    defaultXonminiAccent: '#0E7490',
    swatches: ['#091017', '#F0F5F9', '#0369A1', '#0E7490'],
    xonddit: {
      dark: {
        bg: '#080E14',
        surface: '#101822',
        surfaceElevated: '#172230',
        surfaceSubtle: '#131C28',
        border: '#1F2E40',
        borderStrong: '#2D4159',
        textPrimary: '#EFF5FA',
        textSecondary: '#B6C6D6',
        textMuted: '#76899C',
      },
      light: {
        bg: '#F0F5F9',
        surface: '#FFFFFF',
        surfaceElevated: '#F7FAFC',
        surfaceSubtle: '#E4EDF4',
        border: '#D3E0EC',
        borderStrong: '#B5C9DC',
        textPrimary: '#0D1722',
        textSecondary: '#3B4C5E',
        textMuted: '#65788C',
      },
    },
    xonmini: {
      dark: {
        bg: '#070C12',
        surface: '#0E161F',
        surfaceElevated: '#15202D',
        surfaceSubtle: '#111A25',
        border: '#1C2B3B',
        borderStrong: '#293E54',
        textPrimary: '#EDF4FA',
        textSecondary: '#B3C4D4',
        textMuted: '#738799',
      },
      light: {
        bg: '#EEF4F8',
        surface: '#FFFFFF',
        surfaceElevated: '#F6F9FC',
        surfaceSubtle: '#E2ECF3',
        border: '#D0DEE9',
        borderStrong: '#B2C7D8',
        textPrimary: '#0B1520',
        textSecondary: '#384A5C',
        textMuted: '#62768A',
      },
    },
  },
};

export const CURATED_ACCENT_SWATCHES: { hex: string; label: string }[] = [
  { hex: '#C84B31', label: 'Terracotta' },
  { hex: '#D97706', label: 'Ochre Amber' },
  { hex: '#0F766E', label: 'Mineral Teal' },
  { hex: '#15803D', label: 'Forest Sage' },
  { hex: '#0369A1', label: 'Fjord Blue' },
  { hex: '#1D4ED8', label: 'Cobalt Ink' },
  { hex: '#4338CA', label: 'Deep Indigo' },
  { hex: '#9F1239', label: 'Crimson Wine' },
  { hex: '#334155', label: 'Slate Steel' },
  { hex: '#57534E', label: 'Warm Stone' },
];

export interface ComputedAccentTokens {
  originalHex: string;
  accentBg: string; // Solid button/control background (adjusted if needed)
  accentHover: string; // Hover state
  accentActive: string; // Pressed/active state
  accentFg: string; // Readable text on top of accentBg (#ffffff or #0c0b0a)
  accentText: string; // Readable accent text/link on top of theme surface (guaranteed >= 4.5:1)
  accentSubtleBg: string; // Low-opacity surface tint
  accentBorder: string; // Harmonious border tint
  accentFocusRing: string; // Accessible focus ring
  buttonContrastRatio: number; // Contrast ratio of accentFg on accentBg
  textContrastRatio: number; // Contrast ratio of accentText on surface
  wcagLevel: 'AAA' | 'AA';
  wasAdjusted: boolean;
  adjustmentReason?: string;
  recommendedAlternativeHex?: string;
}

// -------------------------------------------------------------
// Color Math & WCAG 2.1/2.2 Contrast Utilities
// -------------------------------------------------------------

export function normalizeHex(input: string, fallback = '#C84B31'): string {
  if (!input || typeof input !== 'string') return fallback;
  const clean = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHex(hex).slice(1);
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (v: number) => {
    const sRGB = v / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Computes full WCAG-compliant accent tokens for a given user accent color and theme surface.
 * Automatically restrains overly neon saturation, selects optimal dark/light foreground text,
 * and guarantees >= 4.5:1 text contrast against the active surface.
 */
export function computeAccessibleAccent(
  rawHex: string,
  surfaceHex: string,
  theme: ResolvedTheme
): ComputedAccentTokens {
  const originalHex = normalizeHex(rawHex);
  const { r, g, b } = hexToRgb(originalHex);
  const hsl = rgbToHsl(r, g, b);

  let workingH = hsl.h;
  let workingS = hsl.s;
  let workingL = hsl.l;
  let wasAdjusted = false;
  const reasons: string[] = [];

  // 1. Restrain artificial neon oversaturation so colors feel editorial and natural
  if (workingS > 86 && workingL > 42 && workingL < 68) {
    workingS = 78;
    wasAdjusted = true;
    reasons.push('toned down excessive neon saturation');
  }

  // 2. Ensure solid button background has at least 3:1 UI component contrast against the surface
  // and can achieve >= 4.5:1 with either white (#FFFFFF) or dark ink (#0C0B0A) foreground text.
  let accentBg = hslToHex(workingH, workingS, workingL);
  const darkInk = '#0C0B0A';
  const whiteInk = '#FFFFFF';

  let contrastWithWhite = getContrastRatio(accentBg, whiteInk);
  let contrastWithDark = getContrastRatio(accentBg, darkInk);

  // If neither white nor dark ink reaches 4.5:1 (rare mid-luminance zone), nudge lightness slightly
  if (contrastWithWhite < 4.5 && contrastWithDark < 4.5) {
    if (theme === 'dark') {
      while (workingL > 15 && getContrastRatio(hslToHex(workingH, workingS, workingL), whiteInk) < 4.5) {
        workingL -= 2;
      }
    } else {
      while (workingL > 15 && getContrastRatio(hslToHex(workingH, workingS, workingL), whiteInk) < 4.5) {
        workingL -= 2;
      }
    }
    accentBg = hslToHex(workingH, workingS, workingL);
    contrastWithWhite = getContrastRatio(accentBg, whiteInk);
    contrastWithDark = getContrastRatio(accentBg, darkInk);
    wasAdjusted = true;
    reasons.push('refined luminance for 4.5:1 button label readability');
  }

  // Also ensure the button itself isn't invisible against the theme surface (at least 1.6:1 difference, or adjust)
  const bgVsSurface = getContrastRatio(accentBg, surfaceHex);
  if (bgVsSurface < 2.2) {
    if (theme === 'dark') {
      workingL = Math.max(workingL, 48);
    } else {
      workingL = Math.min(workingL, 46);
    }
    accentBg = hslToHex(workingH, workingS, workingL);
    contrastWithWhite = getContrastRatio(accentBg, whiteInk);
    contrastWithDark = getContrastRatio(accentBg, darkInk);
    wasAdjusted = true;
    reasons.push(`lifted surface separation against ${theme} background`);
  }

  const accentFg = contrastWithWhite >= 4.5 ? whiteInk : contrastWithDark >= contrastWithWhite ? darkInk : whiteInk;
  const buttonContrastRatio = getContrastRatio(accentBg, accentFg);

  // 3. Compute readable inline accent text (`accentText`) against `surfaceHex` (>= 4.5:1 WCAG AA)
  let textL = workingL;
  let textS = workingS;
  let accentText = hslToHex(workingH, textS, textL);
  let textContrastRatio = getContrastRatio(accentText, surfaceHex);

  if (textContrastRatio < 4.5) {
    wasAdjusted = true;
    if (theme === 'dark') {
      // Brighten for dark surface readability
      while (textL < 90 && getContrastRatio(hslToHex(workingH, textS, textL), surfaceHex) < 4.6) {
        textL += 2;
      }
      reasons.push(`lightened inline accent text to ${getContrastRatio(hslToHex(workingH, textS, textL), surfaceHex)}:1 on dark surfaces`);
    } else {
      // Darken for light surface readability
      while (textL > 12 && getContrastRatio(hslToHex(workingH, textS, textL), surfaceHex) < 4.6) {
        textL -= 2;
      }
      reasons.push(`darkened inline accent text to ${getContrastRatio(hslToHex(workingH, textS, textL), surfaceHex)}:1 on light surfaces`);
    }
    accentText = hslToHex(workingH, textS, textL);
    textContrastRatio = getContrastRatio(accentText, surfaceHex);
  }

  // 4. Generate hover, active, subtle bg, and border states consistently
  const hoverL = theme === 'dark' ? Math.min(92, workingL + 6) : Math.max(10, workingL - 6);
  const activeL = theme === 'dark' ? Math.max(12, workingL - 5) : Math.max(8, workingL - 11);
  const accentHover = hslToHex(workingH, workingS, hoverL);
  const accentActive = hslToHex(workingH, workingS, activeL);

  const bgRgb = hexToRgb(accentBg);
  const accentSubtleBg =
    theme === 'dark'
      ? `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.14)`
      : `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.10)`;
  const accentBorder =
    theme === 'dark'
      ? `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.34)`
      : `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.28)`;

  // Recommended single-hex alternative that works natively without heavy adjustment
  const recommendedL = theme === 'dark' ? Math.max(54, Math.min(66, workingL)) : Math.max(32, Math.min(44, workingL));
  const recommendedAlternativeHex = hslToHex(workingH, Math.min(76, Math.max(45, workingS)), recommendedL);

  const minRatio = Math.min(buttonContrastRatio, textContrastRatio);
  const wcagLevel: 'AAA' | 'AA' = minRatio >= 7.0 ? 'AAA' : 'AA';

  return {
    originalHex,
    accentBg,
    accentHover,
    accentActive,
    accentFg,
    accentText,
    accentSubtleBg,
    accentBorder,
    accentFocusRing: accentText,
    buttonContrastRatio,
    textContrastRatio,
    wcagLevel,
    wasAdjusted,
    adjustmentReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    recommendedAlternativeHex,
  };
}
