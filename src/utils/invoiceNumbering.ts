import { Invoice } from '@/types';

// Regex for validating invoice numbers
// Regular: ###/YY (e.g., 001/25)
// Cash: CASH ###/YY (e.g., CASH 001/25)
export const regularInvoiceNumberRegex = /^[0-9]{3}\/[0-9]{2}$/;
export const cashInvoiceNumberRegex = /^CASH [0-9]{3}\/[0-9]{2}$/;

/**
 * Determines the numbering type ('regular' or 'cash') based on the invoice's functional type.
 * 'online-sale' is treated as 'regular' for numbering sequence purposes.
 */
export const getInvoiceNumberingType = (invoiceType: Invoice['invoiceType']): 'regular' | 'cash' => {
  return invoiceType === 'cash' ? 'cash' : 'regular'; // 'online-sale' will fall into 'regular'
};

/**
 * Parses an invoice number string into its sequential part, year, and prefix.
 * Returns isValid: false if the format is incorrect.
 */
export const parseInvoiceNumber = (number: string): { sequential: number; year: string; prefix: string; isValid: boolean } => {
  let match;
  let prefix = '';

  if (cashInvoiceNumberRegex.test(number)) {
    match = number.match(/^CASH ([0-9]{3})\/([0-9]{2})$/);
    prefix = 'CASH ';
  } else if (regularInvoiceNumberRegex.test(number)) {
    match = number.match(/^([0-9]{3})\/([0-9]{2})$/);
  }

  if (match) {
    const sequential = parseInt(match[1], 10);
    const year = match[2];
    return { sequential, year, prefix, isValid: true };
  }

  return { sequential: 0, year: '', prefix: '', isValid: false };
};

/**
 * Generates the next suggested invoice number based on the latest number, current year, and numbering type.
 */
export const generateNextSuggestedNumber = (
  latestNumber: string,
  currentYearShort: string,
  numberingType: 'regular' | 'cash'
): string => {
  const prefix = numberingType === 'cash' ? 'CASH ' : '';
  let nextSequential = 1;
  let yearSuffix = currentYearShort;

  if (latestNumber) {
    const parsed = parseInvoiceNumber(latestNumber);
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
  // For now, the stored invoiceNumber should already be in the correct format (e.g., "CASH 001/25" or "001/25")
  // so we just return it. This function can be extended if display logic becomes more complex.
  return invoiceNumber;
};