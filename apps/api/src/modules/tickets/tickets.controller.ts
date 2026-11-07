import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  Res,
  HttpStatus,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketCommandDto } from './dto/ticket-command.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ParsePublicIdPipe } from '../../common/pipes/parse-public-id.pipe';
import { UserRole, QueueCategory } from '@cubiora/shared';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles(UserRole.RECEPTION, UserRole.ADMIN)
  @Get('recent')
  async getRecentTickets(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.ticketsService.getRecentTickets(user.id);
    return {
      success: true,
      data,
    };
  }

  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Get('history')
  async getTicketHistory(
    @Query('search') search?: string,
    @Query('slaFilter') slaFilter?: string,
    @Query('queueCategory') queueCategory?: QueueCategory,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));

    const data = await this.ticketsService.getTicketHistory({
      search,
      slaFilter,
      queueCategory,
      page: pageNum,
      limit: limitNum,
    });

    return {
      success: true,
      data,
    };
  }

  @Roles(UserRole.RECEPTION, UserRole.ADMIN)
  @Post()
  async createTicket(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';

    const { statusCode, data } = await this.ticketsService.createTicket(
      dto,
      user.id,
      correlationId,
      idempotencyKey,
      user.role,
    );

    return res.status(statusCode || HttpStatus.CREATED).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':publicId/call')
  async callTicket(
    @Param('publicId', ParsePublicIdPipe) publicId: string,
    @Body() dto: TicketCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('expected-version') expectedVersionHeader: string | undefined,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';
    const expectedVersion =
      dto.expectedVersion ??
      (expectedVersionHeader ? parseInt(expectedVersionHeader, 10) : undefined) ??
      (ifMatchHeader ? parseInt(ifMatchHeader.replace(/"/g, ''), 10) : undefined);

    const { statusCode, data } = await this.ticketsService.callTicket(
      publicId,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
      user.role,
      user.cubicleId,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':publicId/start-service')
  async startService(
    @Param('publicId', ParsePublicIdPipe) publicId: string,
    @Body() dto: TicketCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('expected-version') expectedVersionHeader: string | undefined,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';
    const expectedVersion =
      dto.expectedVersion ??
      (expectedVersionHeader ? parseInt(expectedVersionHeader, 10) : undefined) ??
      (ifMatchHeader ? parseInt(ifMatchHeader.replace(/"/g, ''), 10) : undefined);

    const { statusCode, data } = await this.ticketsService.startService(
      publicId,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
      user.role,
      user.cubicleId,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':publicId/close')
  async closeTicket(
    @Param('publicId', ParsePublicIdPipe) publicId: string,
    @Body() dto: TicketCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('expected-version') expectedVersionHeader: string | undefined,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';
    const expectedVersion =
      dto.expectedVersion ??
      (expectedVersionHeader ? parseInt(expectedVersionHeader, 10) : undefined) ??
      (ifMatchHeader ? parseInt(ifMatchHeader.replace(/"/g, ''), 10) : undefined);

    const { statusCode, data } = await this.ticketsService.closeTicket(
      publicId,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
      user.role,
      user.cubicleId,
      dto,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':publicId/no-show')
  async noShowTicket(
    @Param('publicId', ParsePublicIdPipe) publicId: string,
    @Body() dto: TicketCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('expected-version') expectedVersionHeader: string | undefined,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const correlationId = (req.headers['x-correlation-id'] as string) || '';
    const expectedVersion =
      dto.expectedVersion ??
      (expectedVersionHeader ? parseInt(expectedVersionHeader, 10) : undefined) ??
      (ifMatchHeader ? parseInt(ifMatchHeader.replace(/"/g, ''), 10) : undefined);

    const { statusCode, data } = await this.ticketsService.noShowTicket(
      publicId,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
      user.role,
      user.cubicleId,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }
}
