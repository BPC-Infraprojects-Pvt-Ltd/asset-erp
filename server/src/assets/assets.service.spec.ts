import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssetsService } from './assets.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const categoryId = '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2';
const assetId = '8e626601-b894-4f2e-acac-85104a978eea';

describe('AssetsService', () => {
  const assetManager = {
    userId: managerId,
    organizationId,
    sessionId: 'session-id',
    familyId: 'family-id',
    email: 'manager@example.com',
    displayName: 'Asset Manager',
    organizationName: 'Example Organization',
    role: UserRole.ASSET_MANAGER,
    mustChangePassword: false,
    version: 1,
  } satisfies AuthenticatedActor;

  const prisma = {
    assetCategory: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    asset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
  };
  const locations = {
    getAccessibleLocationIds: jest.fn(),
  };
  let service: AssetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    locations.getAccessibleLocationIds.mockResolvedValue([locationId]);
    service = new AssetsService(
      prisma as unknown as PrismaService,
      locations as unknown as LocationsService,
    );
  });

  it('scopes paginated searches to assigned locations and organization', async () => {
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.asset.count.mockResolvedValue(0);

    const result = await service.list(assetManager, {
      page: 2,
      pageSize: 10,
      search: 'serial',
      condition: 'GOOD',
    });

    expect(result).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          locationId: { in: [locationId] },
          condition: 'GOOD',
          OR: expect.arrayContaining([
            { serialNumber: { contains: 'serial', mode: 'insensitive' } },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('paginates organization-scoped category lookups', async () => {
    prisma.assetCategory.findMany.mockResolvedValue([]);
    prisma.assetCategory.count.mockResolvedValue(0);

    const result = await service.listCategories(assetManager, {
      page: 2,
      pageSize: 10,
      search: 'laptop',
    });

    expect(result).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(prisma.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          isActive: true,
          OR: expect.arrayContaining([
            { name: { contains: 'laptop', mode: 'insensitive' } },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('reserves asset category creation for Administrators', async () => {
    await expect(
      service.createCategory(assetManager, {
        code: 'LAPTOP',
        name: 'Laptop',
      }),
    ).rejects.toThrow('Administrator access is required');
    expect(prisma.assetCategory.create).not.toHaveBeenCalled();
  });

  it('does not disclose assets outside the assigned location scope', async () => {
    await expect(service.get(assetManager, assetId)).rejects.toThrow(
      'Asset not found',
    );
    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
      }),
    );
  });

  it('rejects a requested location outside the assigned scope', async () => {
    await expect(
      service.list(assetManager, {
        page: 1,
        pageSize: 20,
        locationId: 'f810bb6e-234b-4bb0-a695-3aeef7c031f6',
      }),
    ).rejects.toThrow('Location not found');
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
  });

  it('rejects registration in an unassigned location before checking references', async () => {
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId: 'f810bb6e-234b-4bb0-a695-3aeef7c031f6',
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('Location not found');
    expect(prisma.assetCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('creates only received assets and derives organization and actor server-side', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.location.findFirst.mockResolvedValue({ id: locationId });
    prisma.asset.create.mockResolvedValue({ id: assetId });

    await service.create(assetManager, {
      assetTag: 'LAP-001',
      categoryId,
      locationId,
      availability: 'AVAILABLE',
      condition: 'GOOD',
    });

    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          createdByUserId: managerId,
          lifecycle: 'RECEIVED',
          availability: 'AVAILABLE',
          condition: 'GOOD',
          verification: 'NOT_CHECKED',
        }),
      }),
    );
  });

  it('rejects invalid initial availability and nonfunctional state combinations', async () => {
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'ASSIGNED',
        condition: 'GOOD',
      }),
    ).rejects.toThrow(
      'New assets must be received as available, quarantined, or unavailable',
    );
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'NONFUNCTIONAL',
      }),
    ).rejects.toThrow(
      'A nonfunctional asset must be quarantined or unavailable when received',
    );
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('rejects categories outside the authenticated organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    prisma.location.findFirst.mockResolvedValue({ id: locationId });

    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('Asset category not found');
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('denies asset reads to roles without the approved capability', async () => {
    await expect(
      service.list(
        { ...assetManager, role: UserRole.ADMINISTRATOR },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toThrow('Asset Manager access is required');
    expect(locations.getAccessibleLocationIds).not.toHaveBeenCalled();
  });
});
