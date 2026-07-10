// Design tokens extracted from the "Delivery Manager.dc.html" prototype
// (claude.ai/design project 7f185fc3-a8c2-4082-9a39-cd7270cfd846).
// oklch() source values are kept in comments so tokens can be re-derived if the design updates.

export const colors = {
  bgPage: '#f9f0e7', // oklch(0.96 0.015 70)
  bgCard: '#fffdfb', // oklch(0.995 0.004 70)
  bgCardAlt: '#fcf8f3', // oklch(0.98 0.008 70)
  border: '#e5dcd4', // oklch(0.9 0.015 70)
  borderCard: '#e8e0d7', // oklch(0.91 0.015 70)
  borderDivider: '#ece7e1', // oklch(0.93 0.01 70)

  primary: '#d55c13', // oklch(0.62 0.17 45)
  primaryDark: '#bd4600', // oklch(0.55 0.17 45)
  primaryLabel: '#554438', // oklch(0.4 0.03 55)

  textPrimary: '#291f18', // oklch(0.25 0.02 60)
  textSecondary: '#6c6158', // oklch(0.5 0.02 60)
  textSecondaryLight: '#7b6f66', // oklch(0.55 0.02 60)
  textMuted: '#5e534a', // oklch(0.45 0.02 60)
  textMuted2: '#433830', // oklch(0.35 0.02 60)
  textMuted3: '#50453d', // oklch(0.4 0.02 60)

  neutralBg: '#f7f0eb', // oklch(0.96 0.01 60)
  neutralBorder: '#dfd5ce', // oklch(0.88 0.015 60)
  neutralBorder2: '#d5ccc4', // oklch(0.85 0.015 60)

  success: '#47944c', // oklch(0.6 0.13 145)

  warnBg: '#fff3df', // oklch(0.97 0.03 80)
  warnBorder: '#e3caa2', // oklch(0.85 0.06 80)
  warnText: '#815c0a', // oklch(0.5 0.1 80)

  dangerBg: '#ffe7e3', // oklch(0.96 0.045 25)
  dangerBgSoft: '#ffe2de', // oklch(0.95 0.05 25)
  dangerBorder: '#f3bfba', // oklch(0.85 0.06 25)
  dangerText: '#a83634', // oklch(0.5 0.15 25)
  dangerTextDark: '#972527', // oklch(0.45 0.15 25)

  toastBg: '#291f18', // oklch(0.25 0.02 60)
  white: '#ffffff',
};

export const fonts = {
  heading: 'Poppins_600SemiBold',
  headingBold: 'Poppins_700Bold',
  body: 'WorkSans_400Regular',
  bodyMedium: 'WorkSans_500Medium',
  bodySemiBold: 'WorkSans_600SemiBold',
  bodyBold: 'WorkSans_700Bold',
};

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};
