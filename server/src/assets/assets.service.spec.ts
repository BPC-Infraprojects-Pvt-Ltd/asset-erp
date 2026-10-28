import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssetsService } from './assets.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const categoryId = '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2';
const assetId = '8e626601-b894-4f2e-acac-85104a978eea';
const administrator = {
  userId: managerId,
  organizationId,
  sessionId: 'session-id',
  familyId: 'family-id',
  email: 'admin@example.com',
  displayName: 'Administrator',
  organizationName: 'Example Organization',
  role: UserRole.ADMINISTRATOR,
  mustChangePassword: false,
  version: 1,
} satisfies AuthenticatedActor;

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
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    asset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const locations = {
    getAccessibleLocationIds: jest.fn(),
  };
  let service: AssetsService;

  beforeEach(() => {
    jest.resetAllMocks();
    locations.getAccessibleLocationIds.mockResolvedValue([locationId]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
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
      serialNumberExact: '000123',
      condition: 'GOOD',
      verification: 'MISSING',
    });

    expect(result).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          locationId: { in: [locationId] },
          condition: 'GOOD',
          verification: 'MISSING',
          serialNumber: '000123',
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

  it('lets only Administrators include inactive categories', async () => {
    await expect(
      service.listCategories(assetManager, {
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).rejects.toThrow('Administrator access is required');
    expect(prisma.assetCategory.findMany).not.toHaveBeenCalled();
  });

  it('reads active or inactive category detail within the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: false,
      version: 4,
    });

    await expect(
      service.getCategory(administrator, categoryId),
    ).resolves.toMatchObject({ isActive: false, version: 4 });
    expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      select: expect.objectContaining({ version: true, isActive: true }),
    });
  });

  it('does not disclose category detail outside the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.getCategory(administrator, categoryId),
    ).rejects.toThrow('Asset category not found');
  });

  it('lists inactive categories only within the Administrator organization', async () => {
    prisma.assetCategory.findMany.mockResolvedValue([]);
    prisma.assetCategory.count.mockResolvedValue(0);

    await service.listCategories(administrator, {
      page: 1,
      pageSize: 20,
      includeInactive: true,
    });

    expect(prisma.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
      }),
    );
  });

  it('deactivates a category without deleting historical references', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      isActive: false,
    });

    await expect(
      service.setCategoryActive(administrator, categoryId, false),
    ).resolves.toMatchObject({ id: categoryId, isActive: false });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      data: { isActive: false, version: { increment: 1 } },
    });
  });

  it('reactivates an existing category in the authenticated organization', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });

    await expect(
      service.setCategoryActive(administrator, categoryId, true),
    ).resolves.toMatchObject({ id: categoryId, isActive: true });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      data: { isActive: true, version: { increment: 1 } },
    });
  });

  it('does not disclose or update categories outside the organization', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.setCategoryActive(administrator, categoryId, false),
    ).rejects.toThrow('Asset category not found');
    expect(prisma.assetCategory.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('updates categories with an organization-scoped optimistic version check', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      code: 'LAPTOP',
      name: 'Portable computer',
      version: 3,
    });

    await expect(
      service.updateCategory(administrator, categoryId, 2, {
        code: 'LAPTOP',
        name: 'Portable computer',
      }),
    ).resolves.toMatchObject({ version: 3 });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId, version: 2 },
      data: {
        code: 'LAPTOP',
        name: 'Portable computer',
        version: { increment: 1 },
      },
    });
  });

  it('rejects stale category versions without returning a successful update', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateCategory(administrator, categoryId, 1, {
        code: 'LAPTOP',
        name: 'Portable computer',
      }),
    ).rejects.toThrow('changed since it was loaded');
    expect(prisma.assetCategory.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('rejects category code conflicts in the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
      },
    );
    prisma.assetCategory.updateMany.mockRejectedValue(uniqueError);

    await expect(
      service.updateCategory(administrator, categoryId, 1, {
        code: 'LAPTOP',
        name: 'Laptop',
      }),
    ).rejects.toThrow(
      'An asset category with this code already exists in the organization',
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

  const profile = {
    manufacturer: 'Manufacturer',
    model: 'Model',
    serialNumber: '000123',
    sourceReference: '',
    notes: 'Revised description',
  };

  it('conditionally updates only descriptive fields within organization and location scope', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: assetId, ...profile, version: 3 };
    prisma.asset.findFirstOrThrow.mockResolvedValue(updated);

    await expect(
      service.updateProfile(assetManager, assetId, 2, profile),
    ).resolves.toEqual(updated);
    expect(prisma.asset.updateMany).toHaveBeenCalledWith({
      where: {
        id: assetId,
        organizationId,
        locationId: { in: [locationId] },
        version: 2,
      },
      data: { ...profile, sourceReference: null, version: { increment: 1 } },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.asset.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
      }),
    );
  });

  it('returns 409 for a conditional write lost to a competing version without reading a success result', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateProfile(assetManager, assetId, 2, profile),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.asset.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.asset.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    ['another organization', [locationId]],
    ['an unassigned location', []],
  ])(
    'does not disclose or update an asset in %s',
    async (_label, accessibleLocationIds) => {
      locations.getAccessibleLocationIds.mockResolvedValue(
        accessibleLocationIds,
      );
      prisma.asset.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile(assetManager, assetId, 1, profile),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.asset.findFirst).toHaveBeenCalledWith({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: accessibleLocationIds },
        },
        select: { id: true },
      });
      expect(prisma.asset.updateMany).not.toHaveBeenCalled();
    },
  );

  it('denies profile edits before scope lookup to roles without asset management access', async () => {
    await expect(
      service.updateProfile(
        { ...assetManager, role: UserRole.ADMINISTRATOR },
        assetId,
        1,
        profile,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(locations.getAccessibleLocationIds).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates a transaction failure instead of returning a successful update', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.asset.findFirstOrThrow.mockRejectedValue(new Error('Read failed'));

    await expect(
      service.updateProfile(assetManager, assetId, 1, profile),
    ).rejects.toThrow('Read failed');
  });
});
