import * as XLSX from 'xlsx';

interface ExcelRow {
  [key: string]: any;
}

export const readExcelFile = (file: File): Promise<{ headers: string[]; data: ExcelRow[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          resolve({ headers: [], data: [] });
          return;
        }

        const headers = Object.keys(json[0]);
        resolve({ headers, data: json });
      } catch (error) {
        reject(new Error('Failed to read Excel file. Please ensure it is a valid .xlsx file.'));
      }
    };

    reader.onerror = (error) => {
      reject(new Error('Error reading file: ' + error.type));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const generateErrorExcel = (errors: any[], fileName: string = 'import_errors.xlsx') => {
  const ws = XLSX.utils.json_to_sheet(errors);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  XLSX.writeFile(wb, fileName);
};