/**
 * Centralized Responsive Utilities for iOS Native Experience
 * 
 * This module provides reusable utilities for responsive design without
 * modifying any existing component design, layout, or logic.
 */

// iOS Device Screen Width Breakpoints (in CSS pixels)
export const BREAKPOINTS = {
  xs: 375,       // iPhone SE
  sm: 390,       // iPhone 12/13/14/15
  md: 428,       // iPhone Pro Max
  lg: 768,       // iPad
  xl: 1024,      // iPad Pro
  '2xl': 1400,   // Desktop
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

// Safe area CSS values
export const SAFE_AREA = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
} as const;

// Touch target minimum sizes (WCAG AA compliance)
export const TOUCH_TARGETS = {
  minimum: 44,      // iOS HIG minimum
  comfortable: 48,  // Recommended for accessibility
  large: 52,        // Large touch targets
} as const;

/**
 * Get responsive padding based on screen width
 */
export const getResponsivePadding = (screenWidth: number): { x: number; y: number } => {
  if (screenWidth <= BREAKPOINTS.xs) {
    return { x: 12, y: 8 };
  }
  if (screenWidth <= BREAKPOINTS.sm) {
    return { x: 14, y: 10 };
  }
  if (screenWidth <= BREAKPOINTS.md) {
    return { x: 16, y: 12 };
  }
  if (screenWidth <= BREAKPOINTS.lg) {
    return { x: 20, y: 16 };
  }
  return { x: 24, y: 20 };
};

/**
 * Get responsive margin based on screen width
 */
export const getResponsiveMargin = (screenWidth: number): { x: number; y: number } => {
  if (screenWidth <= BREAKPOINTS.xs) {
    return { x: 8, y: 8 };
  }
  if (screenWidth <= BREAKPOINTS.sm) {
    return { x: 12, y: 10 };
  }
  if (screenWidth <= BREAKPOINTS.md) {
    return { x: 16, y: 12 };
  }
  if (screenWidth <= BREAKPOINTS.lg) {
    return { x: 20, y: 16 };
  }
  return { x: 24, y: 20 };
};

/**
 * Get responsive font scale factor based on screen width
 */
export const getFontScale = (screenWidth: number): number => {
  if (screenWidth <= BREAKPOINTS.xs) return 0.875;
  if (screenWidth <= BREAKPOINTS.sm) return 0.9375;
  if (screenWidth <= BREAKPOINTS.md) return 1;
  if (screenWidth <= BREAKPOINTS.lg) return 1.0625;
  return 1;
};

/**
 * Get responsive icon size based on screen width
 */
export const getIconSize = (screenWidth: number, baseSize: number = 16): number => {
  const scale = getFontScale(screenWidth);
  return Math.round(baseSize * scale);
};

/**
 * Safe area style object generator
 */
export const getSafeAreaStyles = (options: {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}): React.CSSProperties => {
  const styles: React.CSSProperties = {};
  
  if (options.top) {
    styles.paddingTop = SAFE_AREA.top;
  }
  if (options.bottom) {
    styles.paddingBottom = SAFE_AREA.bottom;
  }
  if (options.left) {
    styles.paddingLeft = SAFE_AREA.left;
  }
  if (options.right) {
    styles.paddingRight = SAFE_AREA.right;
  }
  
  return styles;
};

/**
 * Get iOS-compatible min-height for full screen elements
 * Uses CSS custom property with dvh fallback
 */
export const getFullHeightStyle = (): React.CSSProperties => ({
  minHeight: 'calc(var(--vh, 1vh) * 100)',
});

/**
 * CSS class string builder for responsive classes
 */
export const responsiveClasses = (
  base: string,
  responsive: Partial<Record<BreakpointKey, string>>
): string => {
  const classes = [base];
  
  if (responsive.xs) classes.push(`xs:${responsive.xs}`);
  if (responsive.sm) classes.push(`sm:${responsive.sm}`);
  if (responsive.md) classes.push(`md:${responsive.md}`);
  if (responsive.lg) classes.push(`lg:${responsive.lg}`);
  if (responsive.xl) classes.push(`xl:${responsive.xl}`);
  if (responsive['2xl']) classes.push(`2xl:${responsive['2xl']}`);
  
  return classes.join(' ');
};

/**
 * Check if current viewport is within a breakpoint range
 */
export const isWithinBreakpoint = (
  screenWidth: number,
  min?: BreakpointKey,
  max?: BreakpointKey
): boolean => {
  const minWidth = min ? BREAKPOINTS[min] : 0;
  const maxWidth = max ? BREAKPOINTS[max] : Infinity;
  return screenWidth >= minWidth && screenWidth < maxWidth;
};

/**
 * Get current breakpoint name based on screen width
 */
export const getCurrentBreakpoint = (screenWidth: number): BreakpointKey => {
  if (screenWidth < BREAKPOINTS.xs) return 'xs';
  if (screenWidth < BREAKPOINTS.sm) return 'xs';
  if (screenWidth < BREAKPOINTS.md) return 'sm';
  if (screenWidth < BREAKPOINTS.lg) return 'md';
  if (screenWidth < BREAKPOINTS.xl) return 'lg';
  if (screenWidth < BREAKPOINTS['2xl']) return 'xl';
  return '2xl';
};

/**
 * Responsive value selector
 * Returns the appropriate value based on current screen width
 */
export const selectResponsiveValue = <T>(
  screenWidth: number,
  values: Partial<Record<BreakpointKey, T>> & { default: T }
): T => {
  const breakpoint = getCurrentBreakpoint(screenWidth);
  
  // Check for exact match first
  if (values[breakpoint] !== undefined) {
    return values[breakpoint] as T;
  }
  
  // Fallback chain: try larger breakpoints, then default
  const breakpointOrder: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);
  
  // Look for smaller breakpoint values
  for (let i = currentIndex - 1; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp] as T;
    }
  }
  
  return values.default;
};
