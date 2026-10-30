import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MasterService } from './master.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const departmentId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const costCenterId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';
const manufacturerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const employeeId = '8e626601-b894-4f2e-acac-85104a978eea';
const administrator = {
  userId: 'c0985b17-75bb-4a80-9763-35d673ec05f2',
  organizationId,
  sessionId: 'session-id',
  familyId: 'family-id',
  email: 'admin@example.test',
  displayName: 'Example Administrator',
  organizationName: 'Example Organization',
  role: UserRole.ADMINISTRATOR,
  mustChangePassword: false,
  version: 1,
} satisfies AuthenticatedActor;
const assetManager = {
  ...administrator,
  role: UserRole.ASSET_MANAGER,
} satisfies AuthenticatedActor;
const technician = {
  ...administrator,
  role: UserRole.TECHNICIAN,
} satisfies AuthenticatedActor;

describe('MasterService departments and cost centers', () => {
  const prisma = {
    department: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    costCenter: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    manufacturer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetModel: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: MasterService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new MasterService(prisma as unknown as PrismaService);
  });

  it('lists departments by organization with active-only pagination and search', async () => {
    prisma.department.findMany.mockResolvedValue([]);
    prisma.department.count.mockResolvedValue(0);

    await expect(
      service.listDepartments(administrator, {
        page: 2,
        pageSize: 10,
        search: 'operations',
        includeInactive: false,
      }),
    ).resolves.toEqual({ items: [], page: 2, pageSize: 10, total: 0 });

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          isActive: true,
          OR: [
            { code: { contains: 'operations', mode: 'insensitive' } },
            { name: { contains: 'operations', mode: 'insensitive' } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('includes inactive cost centers only when requested', async () => {
    prisma.costCenter.findMany.mockResolvedValue([]);
    prisma.costCenter.count.mockResolvedValue(0);

    await service.listCostCenters(administrator, {
      page: 1,
      pageSize: 20,
      includeInactive: true,
    });

    expect(prisma.costCenter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } }),
    );
  });

  it('restricts organization master data to Administrators', async () => {
    await expect(
      service.listDepartments(assetManager, {
        page: 1,
        pageSize: 20,
        includeInactive: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createCostCenter(assetManager, {
        code: '00418',
        name: 'IT Operations',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.department.findMany).not.toHaveBeenCalled();
    expect(prisma.costCenter.create).not.toHaveBeenCalled();
  });

  it('normalizes department code and name on create', async () => {
    prisma.department.create.mockResolvedValue({
      id: departmentId,
      organizationId,
      code: 'IT-OPS',
      name: 'IT Operations',
      version: 1,
    });

    await expect(
      service.createDepartment(administrator, {
        code: ' it-ops ',
        name: ' IT Operations ',
      }),
    ).resolves.toMatchObject({ code: 'IT-OPS', name: 'IT Operations' });

    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { organizationId, code: 'IT-OPS', name: 'IT Operations' },
      }),
    );
  });

  it('preserves numeric-looking cost center codes as strings', async () => {
    prisma.costCenter.create.mockResolvedValue({
      id: costCenterId,
      organizationId,
      code: '00418',
      name: 'IT Operations',
      version: 1,
    });

    await service.createCostCenter(administrator, {
      code: '00418',
      name: ' IT Operations ',
    });

    expect(prisma.costCenter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { organizationId, code: '00418', name: 'IT Operations' },
      }),
    );
  });

  it('maps organization-scoped duplicate codes to a conflict', async () => {
    prisma.department.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );

    await expect(
      service.createDepartment(administrator, {
        code: 'IT-OPS',
        name: 'IT Operations',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not disclose records outside the authenticated organization', async () => {
    prisma.department.findFirst.mockResolvedValue(null);

    await expect(
      service.getDepartment(administrator, departmentId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.department.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: departmentId, organizationId },
      }),
    );
  });

  it('updates department data using an organization-scoped version check', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: departmentId });
    prisma.department.updateMany.mockResolvedValue({ count: 1 });
    prisma.department.findFirstOrThrow.mockResolvedValue({
      id: departmentId,
      code: 'IT-OPS',
      name: 'IT Operations',
      version: 2,
    });

    await service.updateDepartment(administrator, departmentId, 1, {
      code: 'it-ops',
      name: ' IT Operations ',
    });

    expect(prisma.department.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: departmentId, organizationId, version: 1 },
        data: {
          code: 'IT-OPS',
          name: 'IT Operations',
          version: { increment: 1 },
        },
      }),
    );
  });

  it('rejects stale cost center versions without returning a successful update', async () => {
    prisma.costCenter.findFirst.mockResolvedValue({ id: costCenterId });
    prisma.costCenter.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateCostCenter(administrator, costCenterId, 1, {
        code: '00418',
        name: 'IT Operations',
      }),
    ).rejects.toThrow('changed since it was loaded');
    expect(prisma.costCenter.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('deactivates without deleting and increments the version', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: departmentId });
    prisma.department.updateMany.mockResolvedValue({ count: 1 });
    prisma.department.findFirstOrThrow.mockResolvedValue({
      id: departmentId,
      isActive: false,
      version: 4,
    });

    await expect(
      service.setDepartmentActive(administrator, departmentId, 3, false),
    ).resolves.toMatchObject({ isActive: false, version: 4 });
    expect(prisma.department.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: departmentId, organizationId, version: 3 },
        data: { isActive: false, version: { increment: 1 } },
      }),
    );
  });

  it('lets Asset Managers read active manufacturers but not inactive records', async () => {
    prisma.manufacturer.findMany.mockResolvedValue([]);
    prisma.manufacturer.count.mockResolvedValue(0);

    await service.listManufacturers(assetManager, {
      page: 1,
      pageSize: 20,
      includeInactive: false,
    });

    expect(prisma.manufacturer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, isActive: true },
      }),
    );
    await expect(
      service.listManufacturers(assetManager, {
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not disclose inactive manufacturer detail to Asset Managers', async () => {
    prisma.manufacturer.findFirst.mockResolvedValue(null);

    await expect(
      service.getManufacturer(assetManager, manufacturerId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.manufacturer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: manufacturerId,
          organizationId,
          isActive: true,
        },
      }),
    );
  });

  it('normalizes manufacturer names and maps duplicate names to conflicts', async () => {
    prisma.manufacturer.create.mockResolvedValue({
      id: manufacturerId,
      organizationId,
      name: 'Northwind Devices',
      isActive: true,
      version: 1,
    });

    await service.createManufacturer(administrator, {
      name: ' Northwind Devices ',
    });

    expect(prisma.manufacturer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId,
          name: 'Northwind Devices',
          nameKey: 'northwind devices',
        },
      }),
    );
  });

  it('requires an active manufacturer in the same organization for model creation', async () => {
    prisma.manufacturer.findFirst.mockResolvedValue(null);

    await expect(
      service.createAssetModel(administrator, {
        manufacturerId,
        name: 'ThinkPad T14',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.assetModel.create).not.toHaveBeenCalled();
  });

  it('lists asset models by the authenticated organization and manufacturer', async () => {
    prisma.manufacturer.findFirst.mockResolvedValue({ id: manufacturerId });
    prisma.assetModel.findMany.mockResolvedValue([]);
    prisma.assetModel.count.mockResolvedValue(0);

    await service.listAssetModels(assetManager, {
      page: 1,
      pageSize: 20,
      manufacturerId,
      search: 'thinkpad',
      includeInactive: false,
    });

    expect(prisma.assetModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          isActive: true,
          manufacturerId,
          manufacturer: { isActive: true },
        }),
      }),
    );
  });

  it('preserves employee numbers as strings and returns only minimal identity fields', async () => {
    prisma.employee.create.mockResolvedValue({
      id: employeeId,
      organizationId,
      employeeNumber: '000184',
      displayName: 'Tara Menon',
      version: 1,
    });

    await service.createEmployee(administrator, {
      employeeNumber: ' 000184 ',
      displayName: ' Tara Menon ',
    });

    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId,
          employeeNumber: '000184',
          displayName: 'Tara Menon',
        },
        select: expect.objectContaining({
          employeeNumber: true,
          displayName: true,
        }),
      }),
    );
  });

  it('lets Asset Managers read active employee references but not manage them', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await service.listEmployees(assetManager, {
      page: 1,
      pageSize: 20,
      includeInactive: false,
    });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, isActive: true },
      }),
    );

    await expect(
      service.createEmployee(assetManager, {
        employeeNumber: '000184',
        displayName: 'Tara Menon',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not expose employee references to unrelated roles', async () => {
    await expect(
      service.listEmployees(technician, {
        page: 1,
        pageSize: 20,
        includeInactive: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('uses optimistic version checks for employee updates', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: employeeId });
    prisma.employee.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateEmployee(administrator, employeeId, 2, {
        employeeNumber: '000184',
        displayName: 'Tara Menon',
      }),
    ).rejects.toThrow('changed since it was loaded');
    expect(prisma.employee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: employeeId, organizationId, version: 2 },
      }),
    );
  });
});
