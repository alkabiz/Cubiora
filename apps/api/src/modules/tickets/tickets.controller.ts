import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketCommandDto } from './dto/ticket-command.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@cubiora/shared';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

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
    );

    return res.status(statusCode || HttpStatus.CREATED).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':id/call')
  async callTicket(
    @Param('id') id: string,
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
      id,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':id/start-service')
  async startService(
    @Param('id') id: string,
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
      id,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':id/close')
  async closeTicket(
    @Param('id') id: string,
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
      id,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Post(':id/no-show')
  async noShowTicket(
    @Param('id') id: string,
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
      id,
      user.id,
      correlationId,
      idempotencyKey,
      expectedVersion,
    );

    return res.status(statusCode || HttpStatus.OK).json({
      success: true,
      data,
    });
  }
}
