import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { SoftwarePolicyStatus, UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSoftwareEditionDto } from './dto/create-software-edition.dto.js';
import type { CreateSoftwareProductDto } from './dto/create-software-product.dto.js';
import type { ListSoftwareQueryDto } from './dto/list-software-query.dto.js';
import type { UpdateSoftwareEditionDto } from './dto/update-software-edition.dto.js';
import type { UpdateSoftwareProductDto } from './dto/update-software-product.dto.js';

const softwareProductSelect = {
  id: true,
  organizationId: true,
  publisher: true,
  name: true,
  commercialClassification: true,
  policyStatus: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SoftwareProductSelect;

const softwareEditionSelect = {
  id: true,
  organizationId: true,
  productId: true,
  name: true,
  versionLabel: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SoftwareEditionSelect;

@Injectable()
export class SoftwareService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(actor: AuthenticatedActor, query: ListSoftwareQueryDto) {
    this.requireSoftwareLicenseManager(actor);
    const where: Prisma.SoftwareProductWhereInput = {
      organizationId: actor.organizationId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.commercialClassification
        ? { commercialClassification: query.commercialClassification }
        : {}),
      ...(query.policyStatus ? { policyStatus: query.policyStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { publisher: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.softwareProduct.findMany({
        where,
        select: {
          ...softwareProductSelect,
          _count: { select: { editions: true } },
        },
        orderBy: [{ publisherKey: 'asc' }, { nameKey: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.softwareProduct.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getProduct(actor: AuthenticatedActor, productId: string) {
    this.requireSoftwareLicenseManager(actor);
    const product = await this.prisma.softwareProduct.findFirst({
      where: { id: productId, organizationId: actor.organizationId },
      select: softwareProductSelect,
    });
    if (!product) throw new NotFoundException('Software product not found');
    return product;
  }

  async createProduct(
    actor: AuthenticatedActor,
    dto: CreateSoftwareProductDto,
  ) {
    this.requireSoftwareLicenseManager(actor);
    const publisher = dto.publisher.trim();
    const name = dto.name.trim();
    try {
      return await this.prisma.softwareProduct.create({
        data: {
          organizationId: actor.organizationId,
          publisher,
          publisherKey: normalizeKey(publisher),
          name,
          nameKey: normalizeKey(name),
          commercialClassification: dto.commercialClassification,
          policyStatus:
            dto.policyStatus ?? SoftwarePolicyStatus.REVIEW_REQUIRED,
        },
        select: softwareProductSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A software product with this publisher and name already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateProduct(
    actor: AuthenticatedActor,
    productId: string,
    version: number,
    dto: UpdateSoftwareProductDto,
  ) {
    this.requireSoftwareLicenseManager(actor);
    const publisher = dto.publisher.trim();
    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.softwareProduct.findFirst({
        where: { id: productId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Software product not found');

      try {
        const updated = await tx.softwareProduct.updateMany({
          where: {
            id: productId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            publisher,
            publisherKey: normalizeKey(publisher),
            name,
            nameKey: normalizeKey(name),
            commercialClassification: dto.commercialClassification,
            policyStatus: dto.policyStatus,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The software product changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.softwareProduct.findFirstOrThrow({
          where: { id: productId, organizationId: actor.organizationId },
          select: softwareProductSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'A software product with this publisher and name already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async setProductActive(
    actor: AuthenticatedActor,
    productId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireSoftwareLicenseManager(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.softwareProduct.findFirst({
        where: { id: productId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Software product not found');
      const updated = await tx.softwareProduct.updateMany({
        where: {
          id: productId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The software product changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.softwareProduct.findFirstOrThrow({
        where: { id: productId, organizationId: actor.organizationId },
        select: softwareProductSelect,
      });
    });
  }

  async listEditions(
    actor: AuthenticatedActor,
    productId: string,
    query: ListSoftwareQueryDto,
  ) {
    this.requireSoftwareLicenseManager(actor);
    await this.requireProduct(actor, productId);
    const where: Prisma.SoftwareEditionWhereInput = {
      organizationId: actor.organizationId,
      productId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { versionLabel: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.softwareEdition.findMany({
        where,
        select: softwareEditionSelect,
        orderBy: [{ nameKey: 'asc' }, { versionKey: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.softwareEdition.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async createEdition(
    actor: AuthenticatedActor,
    productId: string,
    dto: CreateSoftwareEditionDto,
  ) {
    this.requireSoftwareLicenseManager(actor);
    await this.requireProduct(actor, productId);
    const name = dto.name.trim();
    const versionLabel = normalizeOptional(dto.versionLabel);
    try {
      return await this.prisma.softwareEdition.create({
        data: {
          organizationId: actor.organizationId,
          productId,
          name,
          nameKey: normalizeKey(name),
          versionLabel,
          versionKey: normalizeKey(versionLabel ?? ''),
        },
        select: softwareEditionSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This edition and version already exist for the software product',
        );
      }
      throw error;
    }
  }

  async updateEdition(
    actor: AuthenticatedActor,
    productId: string,
    editionId: string,
    version: number,
    dto: UpdateSoftwareEditionDto,
  ) {
    this.requireSoftwareLicenseManager(actor);
    await this.requireProduct(actor, productId);
    const name = dto.name.trim();
    const versionLabel = normalizeOptional(dto.versionLabel);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.softwareEdition.findFirst({
        where: {
          id: editionId,
          productId,
          organizationId: actor.organizationId,
        },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Software edition not found');

      try {
        const updated = await tx.softwareEdition.updateMany({
          where: {
            id: editionId,
            productId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            name,
            nameKey: normalizeKey(name),
            versionLabel,
            versionKey: normalizeKey(versionLabel ?? ''),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The software edition changed since it was loaded. Reload and review the latest record before saving again.',
          );
        }
        return tx.softwareEdition.findFirstOrThrow({
          where: {
            id: editionId,
            productId,
            organizationId: actor.organizationId,
          },
          select: softwareEditionSelect,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(
            'This edition and version already exist for the software product',
          );
        }
        throw error;
      }
    });
  }

  async setEditionActive(
    actor: AuthenticatedActor,
    productId: string,
    editionId: string,
    version: number,
    isActive: boolean,
  ) {
    this.requireSoftwareLicenseManager(actor);
    await this.requireProduct(actor, productId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.softwareEdition.findFirst({
        where: {
          id: editionId,
          productId,
          organizationId: actor.organizationId,
        },
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Software edition not found');
      const updated = await tx.softwareEdition.updateMany({
        where: {
          id: editionId,
          productId,
          organizationId: actor.organizationId,
          version,
        },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The software edition changed since it was loaded. Reload before changing its status.',
        );
      }
      return tx.softwareEdition.findFirstOrThrow({
        where: {
          id: editionId,
          productId,
          organizationId: actor.organizationId,
        },
        select: softwareEditionSelect,
      });
    });
  }

  private async requireProduct(actor: AuthenticatedActor, productId: string) {
    const product = await this.prisma.softwareProduct.findFirst({
      where: { id: productId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Software product not found');
    return product;
  }

  private requireSoftwareLicenseManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.SOFTWARE_LICENSE_MANAGER) {
      throw new ForbiddenException(
        'Software/License Manager access is required',
      );
    }
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOptional(value: string | undefined): string | null {
  return value?.trim() || null;
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
