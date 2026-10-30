import {
  MAX_ASSET_IMPORT_ROWS,
  parseAssetImportCsv,
} from './asset-import-csv.js';

const header =
  'assetTag,categoryCode,locationCode,availability,condition,manufacturer,model,serialNumber,sourceReference,notes';

describe('parseAssetImportCsv', () => {
  it('parses a supported asset row without converting string identifiers', () => {
    const result = parseAssetImportCsv(
      Buffer.from(
        `${header}\nLAP-0001,LAPTOP,PUNE,AVAILABLE,GOOD,Acme,Model A,000001,PO-0001,New laptop\n`,
      ),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        assetTag: 'LAP-0001',
        categoryCode: 'LAPTOP',
        locationCode: 'PUNE',
        availability: 'AVAILABLE',
        condition: 'GOOD',
        criticality: '',
        manufacturer: 'Acme',
        model: 'Model A',
        serialNumber: '000001',
        sourceReference: 'PO-0001',
        notes: 'New laptop',
        specifications: '',
        purchaseDate: '',
        warrantyExpiresOn: '',
        warrantyReference: '',
      },
    ]);
  });

  it('parses optional purchase and warranty columns as date-only strings', () => {
    const result = parseAssetImportCsv(
      Buffer.from(
        `${header},specifications,purchaseDate,warrantyExpiresOn,warrantyReference\nLAP-0003,LAPTOP,PUNE,AVAILABLE,GOOD,Acme,Model A,000003,PO-0003,New laptop,"{""RAM"":""16 GB""}",2026-02-28,2029-02-28,WARRANTY-0003`,
      ),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      purchaseDate: '2026-02-28',
      warrantyExpiresOn: '2029-02-28',
      warrantyReference: 'WARRANTY-0003',
    });
  });

  it('parses an optional asset criticality value without changing other strings', () => {
    const result = parseAssetImportCsv(
    Buffer.from(
      `${header.replace('condition,', 'condition,criticality,')}\nLAP-0004,LAPTOP,PUNE,AVAILABLE,GOOD,HIGH,Acme,Model A,000004,PO-0004,New laptop`,
    ),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
    criticality: 'HIGH',
    serialNumber: '000004',
    });
  });

  it('handles escaped quotes, commas, and newlines in quoted text cells', () => {
    const result = parseAssetImportCsv(
      Buffer.from(
        `${header}\nLAP-0002,LAPTOP,PUNE,AVAILABLE,GOOD,Acme,Model,"000002",PO-0002,"Dock, ""rev B""\nchecked"\n`,
      ),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      serialNumber: '000002',
      notes: 'Dock, "rev B"\nchecked',
    });
  });

  it('rejects unsupported, duplicate, or malformed headers without echoing file values', () => {
    const result = parseAssetImportCsv(
      Buffer.from(
        'assetTag,assetTag,categoryCode,locationCode,availability,condition,secret\n',
      ),
    );

    expect(result.rows).toEqual([]);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unsupported_header', 'duplicate_header']),
    );
    expect(JSON.stringify(result.issues)).not.toContain('secret');
  });

  it('rejects malformed quoting and non-UTF-8 or binary content', () => {
    expect(
      parseAssetImportCsv(Buffer.from(`${header}\nLAP-1,LAPTOP,"PUNE`))
        .issues[0]?.code,
    ).toBe('invalid_csv');
    expect(parseAssetImportCsv(Buffer.from([0xff, 0xfe])).issues[0]?.code).toBe(
      'invalid_encoding',
    );
    expect(
      parseAssetImportCsv(Buffer.from(`${header}\nLAP-1\0`)).issues[0]?.code,
    ).toBe('invalid_content');
  });

  it('enforces the documented data row limit', () => {
    const rows = Array.from(
      { length: MAX_ASSET_IMPORT_ROWS + 1 },
      (_, index) => `TAG-${index},LAPTOP,PUNE,AVAILABLE,GOOD,,,,,`,
    );
    const result = parseAssetImportCsv(
      Buffer.from(`${header}\n${rows.join('\n')}`),
    );

    expect(result.totalRows).toBe(MAX_ASSET_IMPORT_ROWS + 1);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'too_many_rows',
        rowNumber: MAX_ASSET_IMPORT_ROWS + 2,
      }),
    );
  });
});
