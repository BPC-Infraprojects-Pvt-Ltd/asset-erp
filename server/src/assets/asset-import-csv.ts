export const MAX_ASSET_IMPORT_BYTES = 1_048_576;
export const MAX_ASSET_IMPORT_ROWS = 2_000;

const allowedHeaders = [
  'assetTag',
  'categoryCode',
  'locationCode',
  'availability',
  'condition',
  'criticality',
  'manufacturer',
  'model',
  'serialNumber',
  'sourceReference',
  'notes',
  'specifications',
  'purchaseDate',
  'warrantyExpiresOn',
  'warrantyReference',
] as const;

const requiredHeaders = [
  'assetTag',
  'categoryCode',
  'locationCode',
  'availability',
  'condition',
] as const;

export interface AssetImportCsvRow {
  rowNumber: number;
  assetTag: string;
  categoryCode: string;
  locationCode: string;
  availability: string;
  condition: string;
  criticality: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  sourceReference: string;
  notes: string;
  specifications: string;
  purchaseDate: string;
  warrantyExpiresOn: string;
  warrantyReference: string;
}

export interface AssetImportIssue {
  rowNumber: number;
  fieldName: string;
  code: string;
  message: string;
}

export interface ParsedAssetImportCsv {
  rows: AssetImportCsvRow[];
  issues: AssetImportIssue[];
  totalRows: number;
}

function parseRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  const finishField = () => {
    record.push(field);
    field = '';
    quoteClosed = false;
  };
  const finishRecord = () => {
    finishField();
    records.push(record);
    record = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed) {
      if (character === ',') {
        finishField();
      } else if (character === '\n' || character === '\r') {
        finishRecord();
        if (character === '\r' && content[index + 1] === '\n') index += 1;
      } else if (!/\s/.test(character)) {
        throw new Error('Invalid character after a quoted CSV field');
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0)
        throw new Error('Quote inside an unquoted CSV field');
      quoted = true;
    } else if (character === ',') {
      finishField();
    } else if (character === '\n' || character === '\r') {
      finishRecord();
      if (character === '\r' && content[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field.length > 0 || record.length > 0 || quoteClosed) finishRecord();
  return records.filter((row) => row.some((value) => value.trim().length > 0));
}

export function parseAssetImportCsv(buffer: Buffer): ParsedAssetImportCsv {
  if (buffer.length === 0 || buffer.length > MAX_ASSET_IMPORT_BYTES) {
    return {
      rows: [],
      totalRows: 0,
      issues: [
        {
          rowNumber: 1,
          fieldName: 'file',
          code: 'invalid_file_size',
          message: 'CSV must contain data and be no larger than 1 MiB.',
        },
      ],
    };
  }

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, '');
  } catch {
    return {
      rows: [],
      totalRows: 0,
      issues: [
        {
          rowNumber: 1,
          fieldName: 'file',
          code: 'invalid_encoding',
          message: 'CSV must use valid UTF-8 text encoding.',
        },
      ],
    };
  }
  if (content.includes('\0')) {
    return {
      rows: [],
      totalRows: 0,
      issues: [
        {
          rowNumber: 1,
          fieldName: 'file',
          code: 'invalid_content',
          message: 'Binary content is not supported; upload a CSV text file.',
        },
      ],
    };
  }

  let records: string[][];
  try {
    records = parseRecords(content);
  } catch {
    return {
      rows: [],
      totalRows: 0,
      issues: [
        {
          rowNumber: 1,
          fieldName: 'file',
          code: 'invalid_csv',
          message: 'CSV quoting or delimiters are invalid.',
        },
      ],
    };
  }
  if (!records.length) {
    return {
      rows: [],
      totalRows: 0,
      issues: [
        {
          rowNumber: 1,
          fieldName: 'header',
          code: 'missing_header',
          message: 'CSV must include the documented header row.',
        },
      ],
    };
  }

  const header = (records[0] ?? []).map((value) => value.trim());
  const issues: AssetImportIssue[] = [];
  if (header.length > allowedHeaders.length) {
    return {
      rows: [],
      totalRows: Math.max(records.length - 1, 0),
      issues: [
        {
          rowNumber: 1,
          fieldName: 'header',
          code: 'too_many_columns',
          message: `CSV may contain at most ${allowedHeaders.length} columns.`,
        },
      ],
    };
  }
  const duplicates = new Set<string>();
  const headers = new Set<string>();
  header.forEach((value, index) => {
    if (!allowedHeaders.includes(value as (typeof allowedHeaders)[number])) {
      issues.push({
        rowNumber: 1,
        fieldName: `column ${index + 1}`,
        code: 'unsupported_header',
        message: 'Header is not supported by the asset import template.',
      });
    }
    if (headers.has(value)) duplicates.add(value);
    headers.add(value);
  });
  if (duplicates.size > 0) {
    issues.push({
      rowNumber: 1,
      fieldName: 'header',
      code: 'duplicate_header',
      message: 'CSV headers must be unique.',
    });
  }
  for (const required of requiredHeaders) {
    if (!headers.has(required)) {
      issues.push({
        rowNumber: 1,
        fieldName: required,
        code: 'missing_header',
        message: 'Required column is missing from the asset import template.',
      });
    }
  }
  if (issues.length) {
    return { rows: [], totalRows: Math.max(records.length - 1, 0), issues };
  }

  const rows: AssetImportCsvRow[] = [];
  const indexes = new Map(header.map((value, index) => [value, index]));
  for (let index = 1; index < records.length; index += 1) {
    const values = records[index] ?? [];
    const rowNumber = index + 1;
    if (values.length !== header.length) {
      issues.push({
        rowNumber,
        fieldName: 'row',
        code: 'column_count',
        message: 'Row has a different number of values than the header.',
      });
      continue;
    }
    const cell = (name: (typeof allowedHeaders)[number]) =>
      (values[indexes.get(name) ?? -1] ?? '').trim();
    rows.push({
      rowNumber,
      assetTag: cell('assetTag'),
      categoryCode: cell('categoryCode').toUpperCase(),
      locationCode: cell('locationCode').toUpperCase(),
      availability: cell('availability').toUpperCase(),
      condition: cell('condition').toUpperCase(),
      criticality: cell('criticality').toUpperCase(),
      manufacturer: cell('manufacturer'),
      model: cell('model'),
      serialNumber: cell('serialNumber'),
      sourceReference: cell('sourceReference'),
      notes: cell('notes'),
      specifications: cell('specifications'),
      purchaseDate: cell('purchaseDate'),
      warrantyExpiresOn: cell('warrantyExpiresOn'),
      warrantyReference: cell('warrantyReference'),
    });
  }
  const totalRows = records.length - 1;
  if (totalRows > MAX_ASSET_IMPORT_ROWS) {
    issues.push({
      rowNumber: MAX_ASSET_IMPORT_ROWS + 2,
      fieldName: 'file',
      code: 'too_many_rows',
      message: `CSV may contain at most ${MAX_ASSET_IMPORT_ROWS} data rows.`,
    });
  }
  if (totalRows === 0) {
    issues.push({
      rowNumber: 2,
      fieldName: 'row',
      code: 'empty_import',
      message: 'CSV must contain at least one asset row.',
    });
  }
  return { rows, totalRows, issues };
}
