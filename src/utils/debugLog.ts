export const debugLog = (...args: any[]) => {
  console.log(...args); // Keep console.log for browser dev tools
  
  if (typeof window !== 'undefined') {
    // Initialize global debug logs array if it doesn't exist
    (window as any).__debugLogs = (window as any).__debugLogs || [];
    
    // Convert arguments to string for display in the debug console
    const logEntry = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg); // Fallback for circular structures
        }
      }
      return String(arg);
    }).join(' ');

    (window as any).__debugLogs.push(`${new Date().toLocaleTimeString()} - ${logEntry}`);
    
    // Dispatch a custom event to notify the DebugConsole component
    const event = new CustomEvent("debug-log");
    window.dispatchEvent(event);
  }
};