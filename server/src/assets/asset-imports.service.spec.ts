import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { AssetImportStatus, UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssetsService } from './assets.service.js';
import { AssetImportsService } from './asset-imports.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const categoryId = '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const jobId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
const actor = {
  userId: managerId,
  organizationId,
  sessionId: 'session-id',
  familyId: 'family-id',
  email: 'manager@example.test',
  displayName: 'Asset Manager',
  organizationName: 'Example Organization',
  role: UserRole.ASSET_MANAGER,
  mustChangePassword: false,
  version: 1,
} satisfies AuthenticatedActor;

const csv = [
  'assetTag,categoryCode,locationCode,availability,condition,manufacturer,model,serialNumber,sourceReference,notes',
  'LAP-100,LAPTOP,PUNE,AVAILABLE,GOOD,Acme,Model A,000010,PO-100,New laptop',
].join('\n');
const csvBuffer = Buffer.from(csv);
const checksum = createHash('sha256').update(csvBuffer).digest('hex');
const category = {
  id: categoryId,
  code: 'LAPTOP',
  specificationFields: [],
};
const location = { id: locationId, code: 'PUNE' };
const job = {
  id: jobId,
  organizationId,
  createdByUserId: managerId,
  status: AssetImportStatus.PREVIEW_READY,
  fileChecksum: checksum,
  totalRows: 1,
  validRows: 1,
  errorCount: 0,
  createdCount: 0,
  version: 1,
  createdAt: new Date('2026-10-29T00:00:00.000Z'),
  updatedAt: new Date('2026-10-29T00:00:00.000Z'),
  committedAt: null,
  previewIdempotencyKey: 'preview-key',
  previewPayloadHash: 'a'.repeat(64),
  commitIdempotencyKey: null,
  commitPayloadHash: null,
};

describe('AssetImportsService', () => {
  const prisma = {
    assetCategory: { findMany: jest.fn() },
    location: { findMany: jest.fn() },
    asset: { findMany: jest.fn() },
    assetImportJob: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    assetImportRowError: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const locations = { getAccessibleLocationIds: jest.fn() };
  const assets = {
    createImportedAssets: jest.fn(),
    validateAssetSpecifications: jest.fn().mockReturnValue(null),
  };
  let service: AssetImportsService;

  beforeEach(() => {
    jest.resetAllMocks();
    locations.getAccessibleLocationIds.mockResolvedValue([locationId]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new AssetImportsService(
      prisma as unknown as PrismaService,
      locations as unknown as LocationsService,
      assets as unknown as AssetsService,
    );
  });

  function mockValidReferences() {
    prisma.assetCategory.findMany.mockResolvedValue([category]);
    prisma.location.findMany.mockResolvedValue([location]);
    prisma.asset.findMany.mockResolvedValue([]);
  }

  it('creates a preview job using only a checksum and safe row errors', async () => {
    mockValidReferences();
    prisma.assetImportJob.findFirst.mockResolvedValue(null);
    prisma.assetImportJob.create.mockResolvedValue({
      ...job,
      previewIdempotencyKey: undefined,
      previewPayloadHash: undefined,
      commitIdempotencyKey: undefined,
      commitPayloadHash: undefined,
    });

    const result = await service.preview(actor, 'preview-key', csvBuffer);

    expect(result.job).toMatchObject({
      status: AssetImportStatus.PREVIEW_READY,
      fileChecksum: checksum,
      totalRows: 1,
      validRows: 1,
      errorCount: 0,
    });
    expect(prisma.assetImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          createdByUserId: managerId,
          fileChecksum: checksum,
          status: AssetImportStatus.PREVIEW_READY,
        }),
      }),
    );
    const createData = prisma.assetImportJob.create.mock.calls[0]?.[0].data;
    expect(JSON.stringify(createData)).not.toContain('LAP-100');
    expect(prisma.assetImportRowError.createMany).not.toHaveBeenCalled();
  });

  it('marks duplicate tags in one file as failed without persisting row values', async () => {
    mockValidReferences();
    prisma.assetImportJob.findFirst.mockResolvedValue(null);
    prisma.assetImportJob.create.mockResolvedValue({
      ...job,
      status: AssetImportStatus.FAILED,
      errorCount: 1,
    });
    const duplicateCsv = Buffer.from(
      `${csv}\nLAP-100,LAPTOP,PUNE,AVAILABLE,GOOD,Acme,Model B,000011,PO-101,Duplicate`,
    );

    const result = await service.preview(actor, 'preview-key-2', duplicateCsv);

    expect(result.job.status).toBe(AssetImportStatus.FAILED);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          fieldName: 'assetTag',
          code: 'duplicate_in_file',
        }),
      ]),
    );
    const persistedError =
      prisma.assetImportRowError.createMany.mock.calls[0]?.[0].data[0];
    expect(JSON.stringify(persistedError)).not.toContain('LAP-100');
  });

  it('rejects import rows whose location is outside the manager scope', async () => {
    prisma.assetCategory.findMany.mockResolvedValue([category]);
    prisma.location.findMany.mockResolvedValue([]);
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.assetImportJob.findFirst.mockResolvedValue(null);
    prisma.assetImportJob.create.mockResolvedValue({
      ...job,
      status: AssetImportStatus.FAILED,
      validRows: 0,
      errorCount: 1,
    });

    const result = await service.preview(actor, 'scope-key', csvBuffer);

    expect(result.job.status).toBe(AssetImportStatus.FAILED);
    expect(result.errors).toEqual([
      expect.objectContaining({
        fieldName: 'locationCode',
        code: 'location_not_found',
      }),
    ]);
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          id: { in: [locationId] },
        }),
      }),
    );
  });

  it('rejects invalid date-only purchase and warranty values during preview', async () => {
    mockValidReferences();
    prisma.assetImportJob.findFirst.mockResolvedValue(null);
    prisma.assetImportJob.create.mockResolvedValue({
      ...job,
      status: AssetImportStatus.FAILED,
      validRows: 0,
      errorCount: 1,
    });
    const [header, row] = csv.split('\n');
    const invalidDateCsv = Buffer.from(
      `${header},purchaseDate,warrantyExpiresOn,warrantyReference\n${row},2026-02-30,,`,
    );

    const result = await service.preview(
      actor,
      'invalid-date-key',
      invalidDateCsv,
    );

    expect(result.job.status).toBe(AssetImportStatus.FAILED);
    expect(result.errors).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        fieldName: 'purchaseDate',
        code: 'invalid_date',
      }),
    ]);
  });

  it('rejects criticality values outside the supported classification', async () => {
    mockValidReferences();
    prisma.assetImportJob.findFirst.mockResolvedValue(null);
    prisma.assetImportJob.create.mockResolvedValue({
      ...job,
      status: AssetImportStatus.FAILED,
      validRows: 0,
      errorCount: 1,
    });
    const [header, row] = csv.split('\n');
    const invalidCriticalityCsv = Buffer.from(
      `${header},criticality\n${row},URGENT`,
    );

    const result = await service.preview(
      actor,
      'invalid-criticality-key',
      invalidCriticalityCsv,
    );

    expect(result.job.status).toBe(AssetImportStatus.FAILED);
    expect(result.errors).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        fieldName: 'criticality',
        code: 'invalid_criticality',
      }),
    ]);
  });

  it('commits only revalidated rows with asset and history writes in the same transaction', async () => {
    mockValidReferences();
    prisma.assetImportJob.findFirst
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(job);
    prisma.assetImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetImportJob.findFirstOrThrow.mockResolvedValue({
      ...job,
      status: AssetImportStatus.COMMITTED,
      createdCount: 1,
      version: 3,
      commitIdempotencyKey: undefined,
      commitPayloadHash: undefined,
    });
    assets.createImportedAssets.mockResolvedValue(1);

    const result = await service.commit(
      actor,
      jobId,
      1,
      'commit-key',
      csvBuffer,
    );

    expect(result.job).toMatchObject({
      status: AssetImportStatus.COMMITTED,
      createdCount: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: expect.anything(),
    });
    expect(assets.createImportedAssets).toHaveBeenCalledWith(
      prisma,
      actor,
      jobId,
      [locationId],
      [
        expect.objectContaining({
          rowNumber: 2,
          assetTag: 'LAP-100',
          categoryId,
          locationId,
          availability: 'AVAILABLE',
          condition: 'GOOD',
          serialNumber: '000010',
        }),
      ],
    );
  });

  it('rejects a changed file before beginning the commit transaction', async () => {
    prisma.assetImportJob.findFirst.mockResolvedValue(job);
    await expect(
      service.commit(
        actor,
        jobId,
        1,
        'commit-key',
        Buffer.from(`${csv}\nCHANGED`),
      ),
    ).rejects.toThrow(
      'The selected file does not match the file validated in this import job',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(assets.createImportedAssets).not.toHaveBeenCalled();
  });

  it('replays a committed import only for the same commit identity', async () => {
    const commitKey = 'commit-key';
    const commitPayloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: managerId,
          operation: 'asset-import.commit',
          importJobId: jobId,
          fileChecksum: checksum,
        }),
      )
      .digest('hex');
    prisma.assetImportJob.findFirst.mockResolvedValue({
      ...job,
      status: AssetImportStatus.COMMITTED,
      createdCount: 1,
      commitIdempotencyKey: commitKey,
      commitPayloadHash,
    });

    await expect(
      service.commit(actor, jobId, 3, commitKey, csvBuffer),
    ).resolves.toMatchObject({
      job: { id: jobId, status: AssetImportStatus.COMMITTED, createdCount: 1 },
      errors: [],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(assets.createImportedAssets).not.toHaveBeenCalled();
  });
});
