import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  SoftwareCommercialClassification,
  SoftwarePolicyStatus,
  UserRole,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftwareService } from './software.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const productId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const editionId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';
const softwareManager = {
  userId: 'software-manager',
  organizationId,
  sessionId: 'session-id',
  familyId: 'family-id',
  email: 'software@example.test',
  displayName: 'Software Manager',
  organizationName: 'Example Organization',
  role: UserRole.SOFTWARE_LICENSE_MANAGER,
  mustChangePassword: false,
  version: 1,
} satisfies AuthenticatedActor;
const assetManager = {
  ...softwareManager,
  role: UserRole.ASSET_MANAGER,
} satisfies AuthenticatedActor;

describe('SoftwareService catalog', () => {
  const prisma = {
    softwareProduct: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    softwareEdition: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: SoftwareService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new SoftwareService(prisma as unknown as PrismaService);
  });

  it('lists products within the authenticated organization with paging and filters', async () => {
    prisma.softwareProduct.findMany.mockResolvedValue([]);
    prisma.softwareProduct.count.mockResolvedValue(0);

    await expect(
      service.listProducts(softwareManager, {
        page: 2,
        pageSize: 10,
        search: 'office',
        commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
        policyStatus: SoftwarePolicyStatus.APPROVED,
        includeInactive: false,
      }),
    ).resolves.toEqual({ items: [], page: 2, pageSize: 10, total: 0 });

    expect(prisma.softwareProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          isActive: true,
          commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
          policyStatus: SoftwarePolicyStatus.APPROVED,
          OR: [
            { publisher: { contains: 'office', mode: 'insensitive' } },
            { name: { contains: 'office', mode: 'insensitive' } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('restricts software catalog operations to Software/License Managers', async () => {
    await expect(
      service.listProducts(assetManager, {
        page: 1,
        pageSize: 20,
        includeInactive: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createProduct(assetManager, {
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.softwareProduct.findMany).not.toHaveBeenCalled();
    expect(prisma.softwareProduct.create).not.toHaveBeenCalled();
  });

  it('does not expose software masters to Administrator by default', async () => {
    await expect(
      service.getProduct(
        {
          ...softwareManager,
          role: UserRole.ADMINISTRATOR,
        },
        productId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.softwareProduct.findFirst).not.toHaveBeenCalled();
  });

  it('normalizes publisher/name keys and defaults new products to review required', async () => {
    prisma.softwareProduct.create.mockResolvedValue({
      id: productId,
      organizationId,
      publisher: 'Northwind Software',
      name: 'Office Suite',
      policyStatus: SoftwarePolicyStatus.REVIEW_REQUIRED,
      version: 1,
    });

    await service.createProduct(softwareManager, {
      publisher: ' Northwind Software ',
      name: ' Office Suite ',
      commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
    });

    expect(prisma.softwareProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          publisher: 'Northwind Software',
          publisherKey: 'northwind software',
          name: 'Office Suite',
          nameKey: 'office suite',
          policyStatus: SoftwarePolicyStatus.REVIEW_REQUIRED,
        }),
      }),
    );
  });

  it('maps duplicate canonical products to a conflict', async () => {
    prisma.softwareProduct.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );

    await expect(
      service.createProduct(softwareManager, {
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates product policy with an organization-scoped version check', async () => {
    prisma.softwareProduct.findFirst.mockResolvedValue({ id: productId });
    prisma.softwareProduct.updateMany.mockResolvedValue({ count: 1 });
    prisma.softwareProduct.findFirstOrThrow.mockResolvedValue({
      id: productId,
      policyStatus: SoftwarePolicyStatus.PROHIBITED,
      version: 2,
    });

    await service.updateProduct(softwareManager, productId, 1, {
      publisher: 'Northwind Software',
      name: 'Office Suite',
      commercialClassification: SoftwareCommercialClassification.COMMERCIAL,
      policyStatus: SoftwarePolicyStatus.PROHIBITED,
    });

    expect(prisma.softwareProduct.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId, organizationId, version: 1 },
        data: expect.objectContaining({
          policyStatus: SoftwarePolicyStatus.PROHIBITED,
          version: { increment: 1 },
        }),
      }),
    );
  });

  it('does not disclose products outside the authenticated organization', async () => {
    prisma.softwareProduct.findFirst.mockResolvedValue(null);

    await expect(
      service.getProduct(softwareManager, productId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.softwareProduct.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId, organizationId },
      }),
    );
  });

  it('requires an organization-scoped product before listing editions', async () => {
    prisma.softwareProduct.findFirst.mockResolvedValue(null);

    await expect(
      service.listEditions(softwareManager, productId, {
        page: 1,
        pageSize: 20,
        includeInactive: false,
      }),
    ).rejects.toThrow('Software product not found');
    expect(prisma.softwareEdition.findMany).not.toHaveBeenCalled();
  });

  it('creates an edition without coercing version identifiers', async () => {
    prisma.softwareProduct.findFirst.mockResolvedValue({ id: productId });
    prisma.softwareEdition.create.mockResolvedValue({
      id: editionId,
      productId,
      name: 'Business',
      versionLabel: '01.02.003',
    });

    await service.createEdition(softwareManager, productId, {
      name: ' Business ',
      versionLabel: ' 01.02.003 ',
    });

    expect(prisma.softwareEdition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          productId,
          name: 'Business',
          nameKey: 'business',
          versionLabel: '01.02.003',
          versionKey: '01.02.003',
        }),
      }),
    );
  });

  it('rejects stale edition updates without returning a successful update', async () => {
    prisma.softwareProduct.findFirst.mockResolvedValue({ id: productId });
    prisma.softwareEdition.findFirst.mockResolvedValue({ id: editionId });
    prisma.softwareEdition.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateEdition(softwareManager, productId, editionId, 1, {
        name: 'Business',
        versionLabel: '1.0',
      }),
    ).rejects.toThrow('changed since it was loaded');
    expect(prisma.softwareEdition.findFirstOrThrow).not.toHaveBeenCalled();
  });
});
