import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocationsService } from './locations.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const rootLocationId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const childLocationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const unrelatedLocationId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';

describe('LocationsService', () => {
  const assetManager = {
    userId: 'session-user',
    organizationId,
    sessionId: 'session-id',
    familyId: 'family-id',
    email: 'person@example.com',
    displayName: 'Asset Manager',
    organizationName: 'Example Organization',
    role: UserRole.ASSET_MANAGER,
    mustChangePassword: false,
    version: 1,
  } satisfies AuthenticatedActor;

  const prisma = {
    location: {
      findMany: jest.fn(),
    },
    userLocationScope: {
      findMany: jest.fn(),
    },
    store: {
      findMany: jest.fn(),
    },
  };
  let service: LocationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LocationsService(prisma as unknown as PrismaService);
  });

  it('includes descendants of explicitly granted locations', async () => {
    const tree = [
      { id: rootLocationId, parentLocationId: null },
      { id: childLocationId, parentLocationId: rootLocationId },
      { id: unrelatedLocationId, parentLocationId: null },
    ];
    prisma.location.findMany
      .mockResolvedValueOnce(tree)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(tree);
    prisma.userLocationScope.findMany.mockResolvedValue([
      { locationId: rootLocationId },
    ]);

    await service.listLocations(assetManager);
    await service.listStores(assetManager);

    expect(prisma.location.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          id: { in: [rootLocationId, childLocationId] },
        }),
      }),
    );
    expect(prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          isActive: true,
          locationId: { in: [rootLocationId, childLocationId] },
        },
      }),
    );
  });

  it('denies location reads to roles without a master-data grant', async () => {
    await expect(
      service.listLocations({
        ...assetManager,
        role: UserRole.EMPLOYEE,
      }),
    ).rejects.toThrow('This role cannot read location and store records');
    expect(prisma.location.findMany).not.toHaveBeenCalled();
  });
});
