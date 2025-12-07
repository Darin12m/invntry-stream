import { Invoice } from '@/types';

// Regex for validating invoice numbers
// Regular: ###/YY (e.g., 001/25)
// Cash: CASH ###/YY (e.g., CASH 001/25)
export const regularInvoiceNumberRegex = /^[0-9]{3}\/[0-9]{2}$/;
export const cashInvoiceNumberRegex = /^CASH [0-9]{3}\/[0-9]{2}$/;

/**
 * Determines the numbering type ('regular', 'cash', or 'online-sale') based on the invoice's functional type.
 * This is used for type-specific validation and uniqueness checks.
 */
export const getInvoiceNumberingType = (invoiceType: Invoice['invoiceType']): 'regular' | 'cash' | 'online-sale' => {
  if (invoiceType === 'cash') return 'cash';
  if (invoiceType === 'online-sale') return 'online-sale';
  return 'regular'; // Covers 'sale', 'return', 'gifted-damaged'
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

// Removed generateNextSuggestedNumber as auto-incrementing is no longer desired.

/**
 * Formats an invoice number for display. (Currently, the stored number should already be formatted correctly).
 * This function is more for consistency or if display rules diverge from storage format.
 */
export const formatInvoiceNumberForDisplay = (invoiceNumber: string, invoiceType: Invoice['invoiceType']): string => {
  // For now, the stored invoiceNumber should already be in the correct format (e.g., "CASH 001/25" or "001/25")
  // so we just return it. This function can be extended if display logic becomes more complex.
  return invoiceNumber;
};