import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AssetsService } from '../assets/assets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RetirementRequestsService } from './retirement-requests.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const assetId = '8e626601-b894-4f2e-acac-85104a978eea';

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

const retirementRequest = {
  id: 'retirement-request-id',
  organizationId,
  assetId,
  requestedByUserId: managerId,
  reason: 'Equipment has reached end of support',
  impactReview: 'Recover the assigned dock and remove active software',
  status: 'PENDING_REVIEW',
  version: 1,
};

describe('RetirementRequestsService', () => {
  const prisma = {
    retirementRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const assets = {
    getManagedAssetLocationIds: jest.fn(),
    getRetirementTarget: jest.fn(),
    recordRetirementRequested: jest.fn(),
  };
  let service: RetirementRequestsService;

  beforeEach(() => {
    jest.resetAllMocks();
    assets.getManagedAssetLocationIds.mockResolvedValue([locationId]);
    assets.getRetirementTarget.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
    });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new RetirementRequestsService(
      prisma as unknown as PrismaService,
      assets as unknown as AssetsService,
    );
  });

  it('submits a scoped request and records history without changing the asset', async () => {
    prisma.retirementRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.retirementRequest.create.mockResolvedValue(retirementRequest);

    await expect(
      service.create(actor, assetId, 'retirement-key', {
        reason: retirementRequest.reason,
        impactReview: retirementRequest.impactReview,
      }),
    ).resolves.toEqual(retirementRequest);

    expect(assets.getRetirementTarget).toHaveBeenCalledWith(
      prisma,
      actor,
      assetId,
    );
    expect(prisma.retirementRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          assetId,
          requestedByUserId: managerId,
          reason: retirementRequest.reason,
          impactReview: retirementRequest.impactReview,
          idempotencyKey: 'retirement-key',
        }),
      }),
    );
    expect(assets.recordRetirementRequested).toHaveBeenCalledWith(
      prisma,
      actor,
      assetId,
      retirementRequest.id,
    );
  });

  it('replays a request only for the same key, actor, asset, and payload', async () => {
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: managerId,
          operation: 'retirement-request.create',
          assetId,
          reason: retirementRequest.reason,
          impactReview: retirementRequest.impactReview,
        }),
      )
      .digest('hex');
    prisma.retirementRequest.findFirst.mockResolvedValue({
      ...retirementRequest,
      payloadHash,
    });

    await expect(
      service.create(actor, assetId, 'retirement-key', {
        reason: retirementRequest.reason,
        impactReview: retirementRequest.impactReview,
      }),
    ).resolves.toMatchObject(retirementRequest);
    expect(prisma.retirementRequest.create).not.toHaveBeenCalled();
    expect(assets.recordRetirementRequested).not.toHaveBeenCalled();
  });

  it('rejects duplicate pending requests for an asset', async () => {
    prisma.retirementRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-request' });

    await expect(
      service.create(actor, assetId, 'another-key', {
        reason: retirementRequest.reason,
        impactReview: retirementRequest.impactReview,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.retirementRequest.create).not.toHaveBeenCalled();
    expect(assets.recordRetirementRequested).not.toHaveBeenCalled();
  });

  it('lists requests only from the Asset Manager location scope', async () => {
    prisma.retirementRequest.findMany.mockResolvedValue([]);
    prisma.retirementRequest.count.mockResolvedValue(0);

    await expect(
      service.list(actor, { page: 1, pageSize: 20 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    expect(prisma.retirementRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          asset: { locationId: { in: [locationId] } },
        },
      }),
    );
  });

  it('reserves the request workflow for Asset Managers', async () => {
    await expect(
      service.list(
        { ...actor, role: UserRole.ADMINISTRATOR },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.retirementRequest.findMany).not.toHaveBeenCalled();
  });
});
