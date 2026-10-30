import { jest } from '@jest/globals';
import {
  ConflictException,
  ExecutionContext,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AdministratorGuard } from '../auth/administrator.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import {
  AssetModelsController,
  CostCentersController,
  DepartmentsController,
  EmployeesController,
  ManufacturersController,
} from './master.controller.js';
import { MasterService } from './master.service.js';

describe('Master data HTTP contract (no database)', () => {
  let app: INestApplication;
  const departmentId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
  const costCenterId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';
  const actor: {
    userId: string;
    organizationId: string;
    role: UserRole;
  } = {
    userId: 'authenticated-admin',
    organizationId: 'authenticated-organization',
    role: UserRole.ADMINISTRATOR,
  };
  const listDepartments = jest.fn();
  const createDepartment = jest.fn();
  const updateDepartment = jest.fn();
  const setDepartmentActive = jest.fn();
  const listCostCenters = jest.fn();
  const createCostCenter = jest.fn();
  const updateCostCenter = jest.fn();
  const setCostCenterActive = jest.fn();
  const listManufacturers = jest.fn();
  const createManufacturer = jest.fn();
  const updateManufacturer = jest.fn();
  const setManufacturerActive = jest.fn();
  const listAssetModels = jest.fn();
  const createAssetModel = jest.fn();
  const updateAssetModel = jest.fn();
  const setAssetModelActive = jest.fn();
  const listEmployees = jest.fn();
  const createEmployee = jest.fn();
  const updateEmployee = jest.fn();
  const setEmployeeActive = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        DepartmentsController,
        CostCentersController,
        ManufacturersController,
        AssetModelsController,
        EmployeesController,
      ],
      providers: [
        AdministratorGuard,
        {
          provide: MasterService,
          useValue: {
            listDepartments,
            getDepartment: jest.fn(),
            createDepartment,
            updateDepartment,
            setDepartmentActive,
            listCostCenters,
            getCostCenter: jest.fn(),
            createCostCenter,
            updateCostCenter,
            setCostCenterActive,
            listManufacturers,
            getManufacturer: jest.fn(),
            createManufacturer,
            updateManufacturer,
            setManufacturerActive,
            listAssetModels,
            getAssetModel: jest.fn(),
            createAssetModel,
            updateAssetModel,
            setAssetModelActive,
            listEmployees,
            getEmployee: jest.fn(),
            createEmployee,
            updateEmployee,
            setEmployeeActive,
          },
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    actor.role = UserRole.ADMINISTRATOR;
  });

  afterAll(async () => app.close());

  it('lists departments with validated pagination and search values', async () => {
    listDepartments.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/master/departments?page=2&pageSize=10&search=%20ops%20')
      .expect(200)
      .expect({ items: [], page: 2, pageSize: 10, total: 0 });

    expect(listDepartments).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 2, pageSize: 10, search: 'ops' }),
    );
  });

  it('normalizes department input and returns created status', async () => {
    createDepartment.mockResolvedValue({
      id: departmentId,
      code: 'IT-OPS',
      name: 'IT Operations',
      version: 1,
    });

    await request(app.getHttpServer())
      .post('/api/v1/master/departments')
      .send({ code: ' it-ops ', name: ' IT Operations ' })
      .expect(201)
      .expect({
        id: departmentId,
        code: 'IT-OPS',
        name: 'IT Operations',
        version: 1,
      });

    expect(createDepartment).toHaveBeenCalledWith(actor, {
      code: 'IT-OPS',
      name: 'IT Operations',
    });
  });

  it.each([
    undefined,
    '2',
    '0',
    '"0"',
    '"02"',
    'W/"2"',
    '*',
    '"2", "3"',
    '"2147483648"',
  ])(
    'requires one valid quoted version for department edits: %s',
    async (version) => {
      const call = request(app.getHttpServer()).put(
        `/api/v1/master/departments/${departmentId}`,
      );
      if (version !== undefined) call.set('If-Match', version);
      await call.send({ code: 'IT-OPS', name: 'IT Operations' }).expect(400);

      expect(updateDepartment).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed master record identifiers before service access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/master/cost-centers/not-a-uuid')
      .expect(400);

    expect(listCostCenters).not.toHaveBeenCalled();
  });

  it('passes the department version and normalized update body', async () => {
    updateDepartment.mockResolvedValue({
      id: departmentId,
      code: 'IT-OPS',
      name: 'IT Operations',
      version: 3,
    });

    await request(app.getHttpServer())
      .put(`/api/v1/master/departments/${departmentId}`)
      .set('If-Match', '"2"')
      .send({ code: ' it-ops ', name: ' IT Operations ' })
      .expect(200)
      .expect({
        id: departmentId,
        code: 'IT-OPS',
        name: 'IT Operations',
        version: 3,
      });

    expect(updateDepartment).toHaveBeenCalledWith(actor, departmentId, 2, {
      code: 'IT-OPS',
      name: 'IT Operations',
    });
  });

  it('rejects master-data access for non-Administrators', async () => {
    actor.role = UserRole.ASSET_MANAGER;

    await request(app.getHttpServer())
      .get('/api/v1/master/departments')
      .expect(403)
      .expect('Content-Type', /application\/problem\+json/);

    expect(listDepartments).not.toHaveBeenCalled();
  });

  it('routes cost center lifecycle commands with the resource version', async () => {
    setCostCenterActive.mockResolvedValue({
      id: costCenterId,
      isActive: false,
      version: 4,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/master/cost-centers/${costCenterId}/deactivate`)
      .set('If-Match', '"3"')
      .expect(200)
      .expect({ id: costCenterId, isActive: false, version: 4 });

    expect(setCostCenterActive).toHaveBeenCalledWith(
      actor,
      costCenterId,
      3,
      false,
    );
  });

  it('preserves stale-version conflicts as problem details', async () => {
    updateCostCenter.mockRejectedValue(
      new ConflictException('The cost center changed since it was loaded'),
    );

    await request(app.getHttpServer())
      .put(`/api/v1/master/cost-centers/${costCenterId}`)
      .set('If-Match', '"2"')
      .send({ code: '00418', name: 'IT Operations' })
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          status: 409,
          detail: 'The cost center changed since it was loaded',
        }),
      );
  });

  it('routes manufacturer create with trimmed name', async () => {
    createManufacturer.mockResolvedValue({
      id: departmentId,
      name: 'Northwind Devices',
      version: 1,
    });

    await request(app.getHttpServer())
      .post('/api/v1/master/manufacturers')
      .send({ name: ' Northwind Devices ' })
      .expect(201)
      .expect({
        id: departmentId,
        name: 'Northwind Devices',
        version: 1,
      });

    expect(createManufacturer).toHaveBeenCalledWith(actor, {
      name: 'Northwind Devices',
    });
  });

  it('routes model searches with their optional manufacturer filter', async () => {
    listAssetModels.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/master/asset-models?manufacturerId=${costCenterId}`)
      .expect(200)
      .expect({ items: [], page: 1, pageSize: 20, total: 0 });

    expect(listAssetModels).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ manufacturerId: costCenterId }),
    );
  });

  it('rejects invalid model manufacturer identifiers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/master/asset-models?manufacturerId=unknown')
      .expect(400);

    expect(listAssetModels).not.toHaveBeenCalled();
  });

  it('creates employee references without a login account field', async () => {
    createEmployee.mockResolvedValue({
      id: departmentId,
      employeeNumber: '000184',
      displayName: 'Tara Menon',
      version: 1,
    });

    await request(app.getHttpServer())
      .post('/api/v1/master/employees')
      .send({
        employeeNumber: ' 000184 ',
        displayName: ' Tara Menon ',
      })
      .expect(201)
      .expect({
        id: departmentId,
        employeeNumber: '000184',
        displayName: 'Tara Menon',
        version: 1,
      });

    expect(createEmployee).toHaveBeenCalledWith(actor, {
      employeeNumber: '000184',
      displayName: 'Tara Menon',
    });
  });

  it('lists employee references through the authenticated route', async () => {
    actor.role = UserRole.ASSET_MANAGER;
    listEmployees.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/master/employees?page=1&pageSize=20')
      .expect(200);

    expect(listEmployees).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });
});
