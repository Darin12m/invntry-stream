import { Invoice } from '@/types';

// Regex for validating invoice numbers
// Regular: ###/YY (e.g., 001/25)
export const regularInvoiceNumberRegex = /^[0-9]{3}\/[0-9]{2}$/;
// Cash: CASH ###/YY (e.g., CASH 001/25)
// New regex for extended cash invoice numbers: CASH ###/YY followed by optional space/dash and 4 digits
export const cashInvoiceNumberExtendedRegex = /^CASH [0-9]{3}\/[0-9]{2}([- ]?[0-9]{4})?$/;
// Return: RET-###/YY (e.g., RET-001/25)
export const returnInvoiceNumberRegex = /^RET-[0-9]{3}\/[0-9]{2}$/;
// Gifted/Damaged: GD-###/YY (e.g., GD-001/25)
export const giftedDamagedInvoiceNumberRegex = /^GD-[0-9]{3}\/[0-9]{2}$/;


/**
 * Returns the expected prefix for a given invoice type.
 */
export const getInvoicePrefix = (invoiceType: Invoice['invoiceType']): string => {
  switch (invoiceType) {
    case 'cash': return 'CASH ';
    case 'return': return 'RET-';
    case 'gifted-damaged': return 'GD-';
    case 'sale': return ''; // No prefix for regular sales
    case 'online-sale': return ''; // No prefix for online sales (manual)
    default: return '';
  }
};

/**
 * Parses an invoice number string into its sequential part, year, and prefix.
 * Returns isValid: false if the format is incorrect for the given type.
 */
export const parseInvoiceNumber = (number: string, invoiceType: Invoice['invoiceType']): { sequential: number; year: string; prefix: string; isValid: boolean; suffix?: string } => {
  let match;
  let prefix = getInvoicePrefix(invoiceType);
  let suffix = '';

  switch (invoiceType) {
    case 'cash':
      const extendedCashMatch = number.match(/^CASH ([0-9]{3})\/([0-9]{2})([- ]?([0-9]{4}))?$/);
      if (extendedCashMatch) {
        match = [number, extendedCashMatch[1], extendedCashMatch[2]];
        prefix = 'CASH ';
        suffix = extendedCashMatch[3] || '';
      }
      break;
    case 'return':
      match = number.match(/^RET-([0-9]{3})\/([0-9]{2})$/);
      prefix = 'RET-';
      break;
    case 'gifted-damaged':
      match = number.match(/^GD-([0-9]{3})\/([0-9]{2})$/);
      prefix = 'GD-';
      break;
    case 'sale': // Regular sale
      match = number.match(/^([0-9]{3})\/([0-9]{2})$/);
      prefix = '';
      break;
    case 'online-sale':
      // For 'online-sale', any non-empty string is considered valid format-wise for parsing purposes
      if (number.trim() !== '') {
        // We don't extract sequential/year in a structured way for freeform
        return { sequential: 0, year: '', prefix: '', isValid: true, suffix: '' };
      }
      break;
  }

  if (match) {
    const sequential = parseInt(match[1], 10);
    const year = match[2];
    return { sequential, year, prefix, isValid: true, suffix };
  }

  return { sequential: 0, year: '', prefix: '', isValid: false, suffix: '' };
};

/**
 * Generates the next suggested invoice number based on the latest number, current year, and invoice type.
 */
export const generateNextSuggestedNumber = (
  latestNumber: string,
  currentYearShort: string,
  invoiceType: Invoice['invoiceType']
): string => {
  const prefix = getInvoicePrefix(invoiceType);
  let nextSequential = 1;
  let yearSuffix = currentYearShort;

  if (latestNumber) {
    const parsed = parseInvoiceNumber(latestNumber, invoiceType);
    // Only consider numbers of the same type and valid format
    if (parsed.isValid && parsed.prefix === prefix) {
      if (parsed.year === currentYearShort) {
        nextSequential = parsed.sequential + 1;
      }
      // If year is different, nextSequential remains 1 for the new year
    }
  }
  
  // Ensure sequential part is at least 1
  if (nextSequential === 0) nextSequential = 1;

  return `${prefix}${String(nextSequential).padStart(3, '0')}/${yearSuffix}`;
};

/**
 * Formats an invoice number for display. (Currently, the stored number should already be formatted correctly).
 * This function is more for consistency or if display rules diverge from storage format.
 */
export const formatInvoiceNumberForDisplay = (invoiceNumber: string, invoiceType: Invoice['invoiceType']): string => {
  // For now, the stored invoiceNumber should already be in the correct format
  // so we just return it. This function can be extended if display logic becomes more complex.
  return invoiceNumber;
};