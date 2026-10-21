import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ApiErrorCode } from '@cubiora/shared';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });

    const mockRequest = {
      headers: {
        'x-correlation-id': 'test-correlation-123',
      },
      url: '/api/v1/test',
      method: 'GET',
    };

    const mockResponse = {
      status: mockStatus,
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('debe dar formato estándar a HttpException con código, mensaje y correlationId', () => {
    const exception = new HttpException('Recurso no encontrado', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith({
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      message: 'Recurso no encontrado',
      correlationId: 'test-correlation-123',
    });
  });

  it('no debe exponer stacktraces ni detalles internos en errores 500 no controlados', () => {
    const rawError = new Error('Database connection failed password=secret');

    filter.catch(rawError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const responseBody = mockJson.mock.calls[0][0];

    expect(responseBody.code).toBe(ApiErrorCode.INTERNAL_ERROR);
    expect(responseBody.message).toBe('Ha ocurrido un error interno. Por favor intente más tarde.');
    expect(responseBody.correlationId).toBe('test-correlation-123');
    expect(responseBody.stack).toBeUndefined();
    expect(JSON.stringify(responseBody)).not.toContain('secret');
  });

  it('debe estructurar errores de validación en el campo details', () => {
    const validationException = new HttpException(
      {
        message: ['El campo x es requerido', 'El campo y debe ser número'],
        error: 'Bad Request',
        statusCode: 400,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(validationException, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody = mockJson.mock.calls[0][0];

    expect(responseBody.code).toBe(ApiErrorCode.REQUEST_INVALID);
    expect(responseBody.message).toBe('La solicitud contiene datos inválidos');
    expect(responseBody.details).toEqual({
      validationErrors: ['El campo x es requerido', 'El campo y debe ser número'],
    });
  });
});
