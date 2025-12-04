import { useState, useEffect, useCallback, useMemo } from 'react';

// iOS Device Screen Sizes (points)
// iPhone SE: 375x667
// iPhone 11: 414x896
// iPhone 12/13/14: 390x844
// iPhone 12/13/14 Pro Max: 428x926
// iPhone 15/16: 393x852
// iPhone 15/16 Pro Max: 430x932
// iPad: 768x1024+

type ScreenCategory = "small" | "medium" | "large" | "extraLarge" | "tablet" | "desktop";
type DeviceType = "ios" | "android" | "desktop";
type Orientation = "portrait" | "landscape";
type iOSDeviceModel = "iphone-se" | "iphone-standard" | "iphone-plus" | "iphone-max" | "ipad" | "ipad-pro" | "unknown";

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface ResponsiveScale {
  fontSize: number;
  spacing: number;
  iconSize: number;
  buttonHeight: number;
  inputHeight: number;
  borderRadius: number;
}

interface DeviceInfo {
  // Device detection
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isTablet: boolean;
  
  // Screen dimensions
  screenWidth: number;
  screenHeight: number;
  orientation: Orientation;
  screenCategory: ScreenCategory;
  deviceType: DeviceType;
  iOSModel: iOSDeviceModel;
  
  // iOS-specific
  safeAreaInsets: SafeAreaInsets;
  hasNotch: boolean;
  hasDynamicIsland: boolean;
  
  // Responsive scaling
  scale: ResponsiveScale;
  
  // Utility functions
  getResponsiveValue: <T>(values: { small?: T; medium?: T; large?: T; tablet?: T; desktop?: T }) => T | undefined;
}

const getDeviceType = (): DeviceType => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    return "ios";
  }
  if (/Android/.test(ua)) {
    return "android";
  }
  return "desktop";
};

const getIOSModel = (width: number, height: number): iOSDeviceModel => {
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  
  // iPad detection
  if (minDim >= 768) {
    return maxDim >= 1194 ? "ipad-pro" : "ipad";
  }
  
  // iPhone models based on width
  if (minDim <= 375) return "iphone-se";
  if (minDim <= 390) return "iphone-standard";
  if (minDim <= 414) return "iphone-plus";
  if (minDim <= 430) return "iphone-max";
  
  return "unknown";
};

const getScreenCategory = (width: number): ScreenCategory => {
  if (width <= 375) return "small";      // iPhone SE
  if (width <= 414) return "medium";     // iPhone 11, 12, 13, 14
  if (width <= 430) return "large";      // iPhone Pro Max
  if (width <= 768) return "extraLarge"; // Large phones
  if (width <= 1024) return "tablet";    // iPads
  return "desktop";
};

const getSafeAreaInsets = (): SafeAreaInsets => {
  // Get CSS env() values
  const computedStyle = getComputedStyle(document.documentElement);
  
  const parseEnvValue = (value: string): number => {
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };
  
  // Try to read from CSS custom properties set by env()
  return {
    top: parseEnvValue(computedStyle.getPropertyValue('--sat') || '0'),
    bottom: parseEnvValue(computedStyle.getPropertyValue('--sab') || '0'),
    left: parseEnvValue(computedStyle.getPropertyValue('--sal') || '0'),
    right: parseEnvValue(computedStyle.getPropertyValue('--sar') || '0'),
  };
};

const getResponsiveScale = (width: number, deviceType: DeviceType): ResponsiveScale => {
  const isIOS = deviceType === "ios";
  const isTablet = width >= 768;
  
  // Base scale factors for different screen sizes
  if (width <= 375) {
    // Small phones (iPhone SE)
    return {
      fontSize: isIOS ? 0.875 : 0.9,
      spacing: 0.85,
      iconSize: 0.85,
      buttonHeight: isIOS ? 40 : 44,
      inputHeight: isIOS ? 44 : 48,
      borderRadius: 0.9,
    };
  }
  
  if (width <= 414) {
    // Medium phones
    return {
      fontSize: isIOS ? 0.9375 : 1,
      spacing: 0.925,
      iconSize: 0.925,
      buttonHeight: isIOS ? 44 : 48,
      inputHeight: isIOS ? 48 : 52,
      borderRadius: 1,
    };
  }
  
  if (width <= 430) {
    // Large phones (Pro Max)
    return {
      fontSize: 1,
      spacing: 1,
      iconSize: 1,
      buttonHeight: 48,
      inputHeight: 52,
      borderRadius: 1,
    };
  }
  
  if (isTablet) {
    // Tablets
    return {
      fontSize: 1.0625,
      spacing: 1.15,
      iconSize: 1.1,
      buttonHeight: 52,
      inputHeight: 56,
      borderRadius: 1.1,
    };
  }
  
  // Desktop
  return {
    fontSize: 1,
    spacing: 1,
    iconSize: 1,
    buttonHeight: 44,
    inputHeight: 48,
    borderRadius: 1,
  };
};

const hasNotchOrDynamicIsland = (width: number, height: number): { hasNotch: boolean; hasDynamicIsland: boolean } => {
  const screenRatio = height / width;
  
  // Dynamic Island devices (iPhone 14 Pro+, 15, 16) have ~2.16-2.18 ratio
  // Notch devices (iPhone X - 13) have ~2.16 ratio
  // Non-notch devices have ~1.78 ratio (16:9)
  
  if (screenRatio >= 2.1) {
    // Check for Dynamic Island (iPhone 14 Pro+, 15, 16 series)
    if (width >= 393) {
      return { hasNotch: true, hasDynamicIsland: true };
    }
    return { hasNotch: true, hasDynamicIsland: false };
  }
  
  return { hasNotch: false, hasDynamicIsland: false };
};

export const useDeviceType = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<Omit<DeviceInfo, 'getResponsiveValue'>>(() => {
    const deviceType = getDeviceType();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const orientation: Orientation = screenWidth < screenHeight ? "portrait" : "landscape";
    const screenCategory = getScreenCategory(screenWidth);
    const iOSModel = getIOSModel(screenWidth, screenHeight);
    const { hasNotch, hasDynamicIsland } = hasNotchOrDynamicIsland(screenWidth, screenHeight);
    const isTablet = screenWidth >= 768 && screenWidth <= 1024;

    return {
      isIOS: deviceType === "ios",
      isAndroid: deviceType === "android",
      isDesktop: deviceType === "desktop",
      isMobile: deviceType === "ios" || deviceType === "android",
      isTablet,
      screenWidth,
      screenHeight,
      orientation,
      screenCategory,
      deviceType,
      iOSModel,
      safeAreaInsets: getSafeAreaInsets(),
      hasNotch,
      hasDynamicIsland,
      scale: getResponsiveScale(screenWidth, deviceType),
    };
  });

  const updateDeviceInfo = useCallback(() => {
    const deviceType = getDeviceType();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const orientation: Orientation = screenWidth < screenHeight ? "portrait" : "landscape";
    const screenCategory = getScreenCategory(screenWidth);
    const iOSModel = getIOSModel(screenWidth, screenHeight);
    const { hasNotch, hasDynamicIsland } = hasNotchOrDynamicIsland(screenWidth, screenHeight);
    const isTablet = screenWidth >= 768 && screenWidth <= 1024;

    setDeviceInfo({
      isIOS: deviceType === "ios",
      isAndroid: deviceType === "android",
      isDesktop: deviceType === "desktop",
      isMobile: deviceType === "ios" || deviceType === "android",
      isTablet,
      screenWidth,
      screenHeight,
      orientation,
      screenCategory,
      deviceType,
      iOSModel,
      safeAreaInsets: getSafeAreaInsets(),
      hasNotch,
      hasDynamicIsland,
      scale: getResponsiveScale(screenWidth, deviceType),
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);
    
    // Also update on load to catch safe area values
    updateDeviceInfo();
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, [updateDeviceInfo]);

  // Memoized responsive value getter
  const getResponsiveValue = useCallback(<T,>(values: { 
    small?: T; 
    medium?: T; 
    large?: T; 
    tablet?: T; 
    desktop?: T 
  }): T | undefined => {
    const category = deviceInfo.screenCategory;
    
    // Fallback chain: specific -> larger -> desktop
    switch (category) {
      case 'small':
        return values.small ?? values.medium ?? values.large ?? values.tablet ?? values.desktop;
      case 'medium':
        return values.medium ?? values.large ?? values.tablet ?? values.desktop;
      case 'large':
      case 'extraLarge':
        return values.large ?? values.tablet ?? values.desktop;
      case 'tablet':
        return values.tablet ?? values.desktop;
      case 'desktop':
      default:
        return values.desktop;
    }
  }, [deviceInfo.screenCategory]);

  return useMemo(() => ({
    ...deviceInfo,
    getResponsiveValue,
  }), [deviceInfo, getResponsiveValue]);
};