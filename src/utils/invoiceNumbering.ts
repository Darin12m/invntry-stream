import { db } from '@/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

/**
 * Parses an invoice number string (e.g., "001/25") into its sequential part and year suffix.
 * @param invoiceNumber The invoice number string.
 * @returns An object with `seq` (sequential number) and `yearSuffix` (last two digits of the year).
 */
const parseInvoiceNumber = (invoiceNumber: string | null) => {
  if (!invoiceNumber) {
    return { seq: 0, yearSuffix: 0 };
  }
  const parts = invoiceNumber.split('/');
  if (parts.length === 2) {
    const seq = parseInt(parts[0], 10);
    const yearSuffix = parseInt(parts[1], 10);
    if (!isNaN(seq) && !isNaN(yearSuffix)) {
      return { seq, yearSuffix };
    }
  }
  return { seq: 0, yearSuffix: 0 };
};

/**
 * Formats a sequential number and year suffix into an invoice number string (e.g., { seq: 1, yearSuffix: 25 } -> "001/25").
 * @param seq The sequential number.
 * @param yearSuffix The last two digits of the year.
 * @returns The formatted invoice number string.
 */
const formatInvoiceNumber = (seq: number, yearSuffix: number) => {
  return `${String(seq).padStart(3, '0')}/${String(yearSuffix).padStart(2, '0')}`;
};

/**
 * Generates the next sequential invoice number based on the last one and the current year.
 * Resets the sequence to 1 if a new year has started.
 * @param lastInvoiceNumber The last invoice number string from the database (e.g., "004/25").
 * @returns The next suggested invoice number string (e.g., "005/25" or "001/26").
 */
export const generateNextInvoiceNumber = (lastInvoiceNumber: string | null): string => {
  const currentYearSuffix = new Date().getFullYear() % 100; // Last two digits of current year
  const { seq: lastSeq, yearSuffix: lastYearSuffix } = parseInvoiceNumber(lastInvoiceNumber);

  let nextSeq = 1;
  let nextYearSuffix = currentYearSuffix;

  if (lastYearSuffix === currentYearSuffix) {
    nextSeq = lastSeq + 1;
  } else { // New year has started or no previous invoice
    nextSeq = 1;
    nextYearSuffix = currentYearSuffix;
  }

  return formatInvoiceNumber(nextSeq, nextYearSuffix);
};

/**
 * Fetches the latest invoice number from the database.
 * This function is used to get the *highest overall* invoice number,
 * which `generateNextInvoiceNumber` then uses to determine the next sequential number,
 * correctly handling year resets.
 * @returns The latest invoice number string or null if no invoices exist.
 */
export const getLatestInvoiceNumberFromDB = async (): Promise<string | null> => {
  const invoicesRef = collection(db, 'invoices');
  // Order by 'number' in descending order to get the highest number string.
  // This works because the format "000/YY" ensures lexicographical sorting matches numerical order.
  const q = query(
    invoicesRef,
    orderBy('number', 'desc'),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data().number as string;
  }
  return null;
};