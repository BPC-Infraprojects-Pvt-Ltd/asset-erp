import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAssetModelDto } from './dto/create-asset-model.dto.js';
import type { CreateCostCenterDto } from './dto/create-cost-center.dto.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { CreateManufacturerDto } from './dto/create-manufacturer.dto.js';
import type { ListAssetModelsQueryDto } from './dto/list-asset-models-query.dto.js';
import type { ListMasterRecordsQueryDto } from './dto/list-master-records-query.dto.js';
import type { UpdateAssetModelDto } from './dto/update-asset-model.dto.js';
import type { UpdateCostCenterDto } from './dto/update-cost-center.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { UpdateManufacturerDto } from './dto/update-manufacturer.dto.js';

const departmentSelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepartmentSelect;

const costCenterSelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CostCenterSelect;

const manufacturerSelect = {
  id: true,
  organizationId: true,
  name: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ManufacturerSelect;

const assetModelSelect = {
  id: true,
  organizationId: true,
  manufacturerId: true,
  name: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  manufacturer: { select: { id: true, name: true } },
} satisfies Prisma.AssetModelSelect;

const employeeSelect = {
  id: true,
  organizationId: true,
  employeeNumber: true,
  displayName: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class MasterService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(
    actor: AuthenticatedActor,
    query: ListMasterRecordsQueryDto,
  ) {
    this.requireAdministrator(actor);
    const where: Prisma.DepartmentWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        select: departmentSelect,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.department.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getDepartment(actor: AuthenticatedActor, departmentId: string) {
    this.requireAdministrator(actor);
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: actor.organizationId },
      select: departmentSelect,
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async createDepartment(actor: AuthenticatedActor, dto: CreateDepartmentDto) {
    this.requireAdministrator(actor);
    try {
      return await this.prisma.department.create({
        data: {
          organizationId: actor.organizationId,
          code: normalizeCode(dto.code),
          name: dto.name.trim(),
        },
        select: departmentSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A department with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateDepartment(
    actor: AuthenticatedActor,
    departmentId: string,
    version: number,
    dto: UpdateDepartmentDto,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.department.findFirst({
        where: { id: departmentId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Department not found');

      try {
        const updated = await tx.department.updateMany({
          where: {
            id: departmentId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            code: normalizeCode(dto.code),
            name: dto.name.trim(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The department changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.department.findFirstOrThrow({
          where: { id: departmentId, organizationId: actor.organizationId },
          select: departmentSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'A department with this code already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async setDepartmentActive(
    actor: AuthenticatedActor,
    departmentId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.department.findFirst({
        where: { id: departmentId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Department not found');
      const updated = await tx.department.updateMany({
        where: {
          id: departmentId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The department changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.department.findFirstOrThrow({
        where: { id: departmentId, organizationId: actor.organizationId },
        select: departmentSelect,
      });
    });
  }

  async listCostCenters(
    actor: AuthenticatedActor,
    query: ListMasterRecordsQueryDto,
  ) {
    this.requireAdministrator(actor);
    const where: Prisma.CostCenterWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.costCenter.findMany({
        where,
        select: costCenterSelect,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.costCenter.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getCostCenter(actor: AuthenticatedActor, costCenterId: string) {
    this.requireAdministrator(actor);
    const costCenter = await this.prisma.costCenter.findFirst({
      where: { id: costCenterId, organizationId: actor.organizationId },
      select: costCenterSelect,
    });
    if (!costCenter) throw new NotFoundException('Cost center not found');
    return costCenter;
  }

  async createCostCenter(actor: AuthenticatedActor, dto: CreateCostCenterDto) {
    this.requireAdministrator(actor);
    try {
      return await this.prisma.costCenter.create({
        data: {
          organizationId: actor.organizationId,
          code: normalizeCode(dto.code),
          name: dto.name.trim(),
        },
        select: costCenterSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A cost center with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateCostCenter(
    actor: AuthenticatedActor,
    costCenterId: string,
    version: number,
    dto: UpdateCostCenterDto,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.costCenter.findFirst({
        where: { id: costCenterId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Cost center not found');

      try {
        const updated = await tx.costCenter.updateMany({
          where: {
            id: costCenterId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            code: normalizeCode(dto.code),
            name: dto.name.trim(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The cost center changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.costCenter.findFirstOrThrow({
          where: { id: costCenterId, organizationId: actor.organizationId },
          select: costCenterSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'A cost center with this code already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async setCostCenterActive(
    actor: AuthenticatedActor,
    costCenterId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.costCenter.findFirst({
        where: { id: costCenterId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Cost center not found');
      const updated = await tx.costCenter.updateMany({
        where: {
          id: costCenterId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The cost center changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.costCenter.findFirstOrThrow({
        where: { id: costCenterId, organizationId: actor.organizationId },
        select: costCenterSelect,
      });
    });
  }

  async listManufacturers(
    actor: AuthenticatedActor,
    query: ListMasterRecordsQueryDto,
  ) {
    this.requireManufacturerReader(actor, query.includeInactive);
    const where: Prisma.ManufacturerWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where,
        select: manufacturerSelect,
        orderBy: [{ nameKey: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.manufacturer.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getManufacturer(actor: AuthenticatedActor, manufacturerId: string) {
    this.requireManufacturerReader(actor, false);
    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: {
        id: manufacturerId,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.ADMINISTRATOR ? {} : { isActive: true }),
      },
      select: manufacturerSelect,
    });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    return manufacturer;
  }

  async createManufacturer(
    actor: AuthenticatedActor,
    dto: CreateManufacturerDto,
  ) {
    this.requireAdministrator(actor);
    const name = dto.name.trim();
    try {
      return await this.prisma.manufacturer.create({
        data: {
          organizationId: actor.organizationId,
          name,
          nameKey: normalizeNameKey(name),
        },
        select: manufacturerSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A manufacturer with this name already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateManufacturer(
    actor: AuthenticatedActor,
    manufacturerId: string,
    version: number,
    dto: UpdateManufacturerDto,
  ) {
    this.requireAdministrator(actor);
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.manufacturer.findFirst({
        where: { id: manufacturerId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Manufacturer not found');
      try {
        const updated = await tx.manufacturer.updateMany({
          where: {
            id: manufacturerId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            name,
            nameKey: normalizeNameKey(name),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The manufacturer changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.manufacturer.findFirstOrThrow({
          where: { id: manufacturerId, organizationId: actor.organizationId },
          select: manufacturerSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'A manufacturer with this name already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async setManufacturerActive(
    actor: AuthenticatedActor,
    manufacturerId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.manufacturer.findFirst({
        where: { id: manufacturerId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Manufacturer not found');
      const updated = await tx.manufacturer.updateMany({
        where: {
          id: manufacturerId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The manufacturer changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.manufacturer.findFirstOrThrow({
        where: { id: manufacturerId, organizationId: actor.organizationId },
        select: manufacturerSelect,
      });
    });
  }

  async listAssetModels(
    actor: AuthenticatedActor,
    query: ListAssetModelsQueryDto,
  ) {
    this.requireManufacturerReader(actor, query.includeInactive);
    if (query.manufacturerId) {
      const manufacturer = await this.prisma.manufacturer.findFirst({
        where: {
          id: query.manufacturerId,
          organizationId: actor.organizationId,
          ...(actor.role === UserRole.ADMINISTRATOR || query.includeInactive
            ? {}
            : { isActive: true }),
        },
        select: { id: true },
      });
      if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    }

    const where: Prisma.AssetModelWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.manufacturerId ? { manufacturerId: query.manufacturerId } : {}),
      ...(actor.role === UserRole.ADMINISTRATOR && query.includeInactive
        ? {}
        : { manufacturer: { isActive: true } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                manufacturer: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetModel.findMany({
        where,
        select: assetModelSelect,
        orderBy: [
          { manufacturer: { nameKey: 'asc' } },
          { nameKey: 'asc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assetModel.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getAssetModel(actor: AuthenticatedActor, modelId: string) {
    this.requireManufacturerReader(actor, false);
    const model = await this.prisma.assetModel.findFirst({
      where: {
        id: modelId,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.ADMINISTRATOR
          ? {}
          : { isActive: true, manufacturer: { isActive: true } }),
      },
      select: assetModelSelect,
    });
    if (!model) throw new NotFoundException('Asset model not found');
    return model;
  }

  async createAssetModel(actor: AuthenticatedActor, dto: CreateAssetModelDto) {
    this.requireAdministrator(actor);
    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: {
        id: dto.manufacturerId,
        organizationId: actor.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');

    const name = dto.name.trim();
    try {
      return await this.prisma.assetModel.create({
        data: {
          organizationId: actor.organizationId,
          manufacturerId: manufacturer.id,
          name,
          nameKey: normalizeNameKey(name),
        },
        select: assetModelSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A model with this name already exists for the manufacturer',
        );
      }
      throw error;
    }
  }

  async updateAssetModel(
    actor: AuthenticatedActor,
    modelId: string,
    version: number,
    dto: UpdateAssetModelDto,
  ) {
    this.requireAdministrator(actor);
    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: {
        id: dto.manufacturerId,
        organizationId: actor.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!manufacturer) throw new NotFoundException('Manufacturer not found');
    const name = dto.name.trim();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.assetModel.findFirst({
        where: { id: modelId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Asset model not found');
      try {
        const updated = await tx.assetModel.updateMany({
          where: {
            id: modelId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            manufacturerId: manufacturer.id,
            name,
            nameKey: normalizeNameKey(name),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The asset model changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.assetModel.findFirstOrThrow({
          where: { id: modelId, organizationId: actor.organizationId },
          select: assetModelSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'A model with this name already exists for the manufacturer',
          );
        }
        throw error;
      }
    });
  }

  async setAssetModelActive(
    actor: AuthenticatedActor,
    modelId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.assetModel.findFirst({
        where: { id: modelId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Asset model not found');
      const updated = await tx.assetModel.updateMany({
        where: {
          id: modelId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The asset model changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.assetModel.findFirstOrThrow({
        where: { id: modelId, organizationId: actor.organizationId },
        select: assetModelSelect,
      });
    });
  }

  private requireManufacturerReader(
    actor: AuthenticatedActor,
    includeInactive: boolean,
  ): void {
    if (
      actor.role !== UserRole.ADMINISTRATOR &&
      actor.role !== UserRole.ASSET_MANAGER &&
      actor.role !== UserRole.TECHNICIAN
    ) {
      throw new ForbiddenException(
        'Manufacturer and model access is not available to this role',
      );
    }
    if (includeInactive && actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException(
        'Only Administrators can view inactive manufacturer and model records',
      );
    }
  }

  private requireEmployeeReader(
    actor: AuthenticatedActor,
    includeInactive: boolean,
  ): void {
    if (
      actor.role !== UserRole.ADMINISTRATOR &&
      actor.role !== UserRole.ASSET_MANAGER
    ) {
      throw new ForbiddenException(
        'Employee references are not available to this role',
      );
    }
    if (includeInactive && actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException(
        'Only Administrators can view inactive employee references',
      );
    }
  }

  async listEmployees(
    actor: AuthenticatedActor,
    query: ListMasterRecordsQueryDto,
  ) {
    this.requireEmployeeReader(actor, query.includeInactive);
    const where: Prisma.EmployeeWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              {
                employeeNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: employeeSelect,
        orderBy: [
          { displayName: 'asc' },
          { employeeNumber: 'asc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getEmployee(actor: AuthenticatedActor, employeeId: string) {
    this.requireEmployeeReader(actor, false);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.ADMINISTRATOR ? {} : { isActive: true }),
      },
      select: employeeSelect,
    });
    if (!employee) throw new NotFoundException('Employee reference not found');
    return employee;
  }

  async createEmployee(actor: AuthenticatedActor, dto: CreateEmployeeDto) {
    this.requireAdministrator(actor);
    try {
      return await this.prisma.employee.create({
        data: {
          organizationId: actor.organizationId,
          employeeNumber: dto.employeeNumber.trim(),
          displayName: dto.displayName.trim(),
        },
        select: employeeSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An employee reference with this number already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateEmployee(
    actor: AuthenticatedActor,
    employeeId: string,
    version: number,
    dto: UpdateEmployeeDto,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findFirst({
        where: { id: employeeId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Employee reference not found');
      try {
        const updated = await tx.employee.updateMany({
          where: {
            id: employeeId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            employeeNumber: dto.employeeNumber.trim(),
            displayName: dto.displayName.trim(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The employee reference changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.employee.findFirstOrThrow({
          where: { id: employeeId, organizationId: actor.organizationId },
          select: employeeSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'An employee reference with this number already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async setEmployeeActive(
    actor: AuthenticatedActor,
    employeeId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findFirst({
        where: { id: employeeId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Employee reference not found');
      const updated = await tx.employee.updateMany({
        where: {
          id: employeeId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The employee reference changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.employee.findFirstOrThrow({
        where: { id: employeeId, organizationId: actor.organizationId },
        select: employeeSelect,
      });
    });
  }

  private requireAdministrator(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException('Administrator access is required');
    }
  }
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
