import { jest } from '@jest/globals';
import {
  AssetCondition,
  AssetVerification,
  UserRole,
  VerificationCampaignStatus,
  VerificationObservationResolution,
  VerificationObservationResult,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AssetsService } from '../assets/assets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VerificationService } from './verification.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const campaignId = '1c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';
const expectedAssetId = '2c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';
const observationId = '3c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';
const assetId = '4c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';

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

const campaign = {
  id: campaignId,
  organizationId,
  locationId,
  name: 'Quarterly laptop verification',
  status: VerificationCampaignStatus.OPEN,
  version: 1,
  createdByUserId: managerId,
  createdAt: new Date('2026-10-29T00:00:00.000Z'),
  updatedAt: new Date('2026-10-29T00:00:00.000Z'),
  completedAt: null,
  completedByUserId: null,
  location: { id: locationId, code: 'PUNE', name: 'Pune Office' },
  _count: { expectedAssets: 1, observations: 0 },
};

describe('VerificationService', () => {
  const prisma = {
    verificationCampaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    verificationCampaignAsset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    verificationObservation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    location: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    asset: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const assets = {
    getManagedAssetLocationIds: jest.fn(),
    getVerificationSnapshot: jest.fn(),
    reconcileVerification: jest.fn(),
  };
  let service: VerificationService;

  beforeEach(() => {
    jest.resetAllMocks();
    assets.getManagedAssetLocationIds.mockResolvedValue([locationId]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new VerificationService(
      prisma as unknown as PrismaService,
      assets as unknown as AssetsService,
    );
  });

  it('creates a location-scoped campaign from an immutable asset snapshot', async () => {
    assets.getVerificationSnapshot.mockResolvedValue({
      location: { id: locationId, code: 'PUNE', name: 'Pune Office' },
      assets: [
        {
          id: assetId,
          assetTag: 'LAP-0001',
          lifecycle: 'ACTIVE',
          condition: AssetCondition.GOOD,
          version: 4,
          category: { code: 'LAPTOP', name: 'Laptop' },
        },
      ],
    });
    prisma.verificationCampaign.findFirst.mockResolvedValue(null);
    prisma.verificationCampaign.create.mockResolvedValue(campaign);

    await expect(
      service.createCampaign(actor, 'campaign-key', {
        locationId,
        name: 'Quarterly laptop verification',
      }),
    ).resolves.toEqual(campaign);

    expect(assets.getVerificationSnapshot).toHaveBeenCalledWith(
      prisma,
      actor,
      locationId,
    );
    expect(prisma.verificationCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          locationId,
          createdByUserId: managerId,
          createIdempotencyKey: 'campaign-key',
          expectedAssets: {
            createMany: {
              data: [
                expect.objectContaining({
                  assetId,
                  expectedAssetTag: 'LAP-0001',
                  expectedLocationId: locationId,
                  expectedCategoryCode: 'LAPTOP',
                  expectedAssetVersion: 4,
                }),
              ],
            },
          },
        }),
      }),
    );
  });

  it('records an explicit missing observation without changing the asset', async () => {
    const observation = {
      id: observationId,
      campaignId,
      expectedAssetId,
      result: VerificationObservationResult.MISSING,
    };
    prisma.verificationObservation.findFirst.mockResolvedValue(null);
    prisma.verificationCampaign.findFirst.mockResolvedValue(campaign);
    prisma.verificationCampaignAsset.findFirst.mockResolvedValue({
      id: expectedAssetId,
      assetId,
      expectedAssetTag: 'LAP-0001',
      expectedLocationId: locationId,
    });
    prisma.verificationObservation.create.mockResolvedValue(observation);

    await expect(
      service.recordObservation(
        actor,
        campaignId,
        expectedAssetId,
        'missing-key',
        {
          found: false,
          notes: 'Not present during room check',
        },
      ),
    ).resolves.toEqual(observation);

    expect(prisma.verificationObservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          campaignId,
          expectedAssetId,
          observedByUserId: managerId,
          result: VerificationObservationResult.MISSING,
          observedTag: null,
          observedLocationId: null,
        }),
      }),
    );
    expect(assets.reconcileVerification).not.toHaveBeenCalled();
  });

  it('reconciles only the verification dimension using the snapshot asset version', async () => {
    const observation = {
      id: observationId,
      campaignId,
      expectedAssetId,
      result: VerificationObservationResult.MISSING,
      resolution: VerificationObservationResolution.PENDING,
      version: 1,
      expectedAsset: { assetId, expectedAssetVersion: 4 },
    };
    prisma.verificationObservation.findFirst
      .mockResolvedValueOnce(observation)
      .mockResolvedValueOnce(null);
    prisma.verificationObservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.verificationObservation.findFirstOrThrow.mockResolvedValue({
      ...observation,
      resolution: VerificationObservationResolution.RECONCILED,
      version: 2,
    });

    await service.reconcileObservation(
      actor,
      campaignId,
      observationId,
      1,
      'reconcile-key',
      { applyFinding: true, note: 'Confirmed against physical location' },
    );

    expect(assets.reconcileVerification).toHaveBeenCalledWith(
      prisma,
      actor,
      assetId,
      4,
      AssetVerification.MISSING,
      campaignId,
      observationId,
    );
    expect(prisma.verificationObservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          campaignId,
          id: observationId,
          version: 1,
          resolution: VerificationObservationResolution.PENDING,
        }),
        data: expect.objectContaining({
          resolution: VerificationObservationResolution.RECONCILED,
          reconciledByUserId: managerId,
          resolutionNote: 'Confirmed against physical location',
        }),
      }),
    );
  });

  it('does not apply an unexpected observation to an authoritative asset', async () => {
    prisma.verificationObservation.findFirst
      .mockResolvedValueOnce({
        id: observationId,
        campaignId,
        expectedAssetId: null,
        result: VerificationObservationResult.UNEXPECTED,
        resolution: VerificationObservationResolution.PENDING,
        version: 1,
        expectedAsset: null,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.reconcileObservation(
        actor,
        campaignId,
        observationId,
        1,
        'unexpected-key',
        { applyFinding: true },
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(assets.reconcileVerification).not.toHaveBeenCalled();
    expect(prisma.verificationObservation.updateMany).not.toHaveBeenCalled();
  });

  it('blocks campaign completion while expected assets remain unresolved', async () => {
    prisma.verificationCampaign.findFirst
      .mockResolvedValueOnce(campaign)
      .mockResolvedValueOnce(null);
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ unresolved: true }]);

    await expect(
      service.completeCampaign(actor, campaignId, 1, 'complete-key'),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.verificationCampaign.updateMany).not.toHaveBeenCalled();
  });

  it('completes only a version-matched, fully reconciled campaign', async () => {
    const completed = {
      ...campaign,
      status: VerificationCampaignStatus.COMPLETED,
      version: 2,
      completedAt: new Date('2026-10-29T01:00:00.000Z'),
      completedByUserId: managerId,
    };
    prisma.verificationCampaign.findFirst
      .mockResolvedValueOnce(campaign)
      .mockResolvedValueOnce(null);
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ unresolved: false }]);
    prisma.verificationObservation.count.mockResolvedValue(0);
    prisma.verificationCampaign.updateMany.mockResolvedValue({ count: 1 });
    prisma.verificationCampaign.findFirstOrThrow.mockResolvedValue(completed);

    await expect(
      service.completeCampaign(actor, campaignId, 1, 'complete-key'),
    ).resolves.toEqual(completed);
    expect(prisma.verificationCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: campaignId,
          organizationId,
          status: VerificationCampaignStatus.OPEN,
          version: 1,
        }),
        data: expect.objectContaining({
          status: VerificationCampaignStatus.COMPLETED,
          completedByUserId: managerId,
          completionIdempotencyKey: 'complete-key',
          version: { increment: 1 },
        }),
      }),
    );
  });

  it('rejects campaign creation for roles without verification authority', async () => {
    await expect(
      service.createCampaign(
        { ...actor, role: UserRole.ADMINISTRATOR },
        'campaign-key',
        { locationId, name: 'Quarterly audit' },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
