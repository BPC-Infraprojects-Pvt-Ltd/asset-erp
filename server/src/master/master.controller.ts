import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AdministratorGuard } from '../auth/administrator.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { CreateCostCenterDto } from './dto/create-cost-center.dto.js';
import { CreateAssetModelDto } from './dto/create-asset-model.dto.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto.js';
import { ListAssetModelsQueryDto } from './dto/list-asset-models-query.dto.js';
import { ListMasterRecordsQueryDto } from './dto/list-master-records-query.dto.js';
import { UpdateAssetModelDto } from './dto/update-asset-model.dto.js';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { UpdateManufacturerDto } from './dto/update-manufacturer.dto.js';
import { MasterService } from './master.service.js';
import { parseMasterRecordVersion } from './master-version.js';

@Controller('master/departments')
@UseGuards(AccessTokenGuard, AdministratorGuard)
export class DepartmentsController {
  constructor(private readonly master: MasterService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListMasterRecordsQueryDto,
  ) {
    return this.master.listDepartments(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.master.createDepartment(actor, dto);
  }

  @Get(':departmentId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
  ) {
    return this.master.getDepartment(actor, departmentId);
  }

  @Put(':departmentId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.master.updateDepartment(
      actor,
      departmentId,
      parseMasterRecordVersion(ifMatch),
      dto,
    );
  }

  @Post(':departmentId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setDepartmentActive(
      actor,
      departmentId,
      parseMasterRecordVersion(ifMatch),
      false,
    );
  }

  @Post(':departmentId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('departmentId', new ParseUUIDPipe()) departmentId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setDepartmentActive(
      actor,
      departmentId,
      parseMasterRecordVersion(ifMatch),
      true,
    );
  }
}

@Controller('master/cost-centers')
@UseGuards(AccessTokenGuard, AdministratorGuard)
export class CostCentersController {
  constructor(private readonly master: MasterService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListMasterRecordsQueryDto,
  ) {
    return this.master.listCostCenters(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateCostCenterDto,
  ) {
    return this.master.createCostCenter(actor, dto);
  }

  @Get(':costCenterId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('costCenterId', new ParseUUIDPipe()) costCenterId: string,
  ) {
    return this.master.getCostCenter(actor, costCenterId);
  }

  @Put(':costCenterId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('costCenterId', new ParseUUIDPipe()) costCenterId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateCostCenterDto,
  ) {
    return this.master.updateCostCenter(
      actor,
      costCenterId,
      parseMasterRecordVersion(ifMatch),
      dto,
    );
  }

  @Post(':costCenterId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('costCenterId', new ParseUUIDPipe()) costCenterId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setCostCenterActive(
      actor,
      costCenterId,
      parseMasterRecordVersion(ifMatch),
      false,
    );
  }

  @Post(':costCenterId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('costCenterId', new ParseUUIDPipe()) costCenterId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setCostCenterActive(
      actor,
      costCenterId,
      parseMasterRecordVersion(ifMatch),
      true,
    );
  }
}

@Controller('master/manufacturers')
@UseGuards(AccessTokenGuard)
export class ManufacturersController {
  constructor(private readonly master: MasterService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListMasterRecordsQueryDto,
  ) {
    return this.master.listManufacturers(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateManufacturerDto,
  ) {
    return this.master.createManufacturer(actor, dto);
  }

  @Get(':manufacturerId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('manufacturerId', new ParseUUIDPipe()) manufacturerId: string,
  ) {
    return this.master.getManufacturer(actor, manufacturerId);
  }

  @Put(':manufacturerId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('manufacturerId', new ParseUUIDPipe()) manufacturerId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateManufacturerDto,
  ) {
    return this.master.updateManufacturer(
      actor,
      manufacturerId,
      parseMasterRecordVersion(ifMatch),
      dto,
    );
  }

  @Post(':manufacturerId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('manufacturerId', new ParseUUIDPipe()) manufacturerId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setManufacturerActive(
      actor,
      manufacturerId,
      parseMasterRecordVersion(ifMatch),
      false,
    );
  }

  @Post(':manufacturerId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('manufacturerId', new ParseUUIDPipe()) manufacturerId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setManufacturerActive(
      actor,
      manufacturerId,
      parseMasterRecordVersion(ifMatch),
      true,
    );
  }
}

@Controller('master/asset-models')
@UseGuards(AccessTokenGuard)
export class AssetModelsController {
  constructor(private readonly master: MasterService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetModelsQueryDto,
  ) {
    return this.master.listAssetModels(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateAssetModelDto,
  ) {
    return this.master.createAssetModel(actor, dto);
  }

  @Get(':modelId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('modelId', new ParseUUIDPipe()) modelId: string,
  ) {
    return this.master.getAssetModel(actor, modelId);
  }

  @Put(':modelId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('modelId', new ParseUUIDPipe()) modelId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateAssetModelDto,
  ) {
    return this.master.updateAssetModel(
      actor,
      modelId,
      parseMasterRecordVersion(ifMatch),
      dto,
    );
  }

  @Post(':modelId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('modelId', new ParseUUIDPipe()) modelId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setAssetModelActive(
      actor,
      modelId,
      parseMasterRecordVersion(ifMatch),
      false,
    );
  }

  @Post(':modelId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('modelId', new ParseUUIDPipe()) modelId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setAssetModelActive(
      actor,
      modelId,
      parseMasterRecordVersion(ifMatch),
      true,
    );
  }
}

@Controller('master/employees')
@UseGuards(AccessTokenGuard)
export class EmployeesController {
  constructor(private readonly master: MasterService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListMasterRecordsQueryDto,
  ) {
    return this.master.listEmployees(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.master.createEmployee(actor, dto);
  }

  @Get(':employeeId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
  ) {
    return this.master.getEmployee(actor, employeeId);
  }

  @Put(':employeeId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.master.updateEmployee(
      actor,
      employeeId,
      parseMasterRecordVersion(ifMatch),
      dto,
    );
  }

  @Post(':employeeId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setEmployeeActive(
      actor,
      employeeId,
      parseMasterRecordVersion(ifMatch),
      false,
    );
  }

  @Post(':employeeId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.master.setEmployeeActive(
      actor,
      employeeId,
      parseMasterRecordVersion(ifMatch),
      true,
    );
  }
}
