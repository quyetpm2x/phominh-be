import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
  error?: string;
}

// Chuẩn hoá format lỗi cho mọi exception (HttpException lẫn lỗi không lường trước) — FE dựa vào
// đúng 1 hình dạng response lỗi duy nhất (tai-lieu-cong-nghe-backend.md §9 "Chuẩn hoá lỗi").
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? this.fromHttpException(exception)
      : 'Đã có lỗi xảy ra, vui lòng thử lại sau';

    if (!isHttp) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    const payload: ErrorBody = {
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: body,
    };
    response.status(status).json(payload);
  }

  private fromHttpException(exception: HttpException): string | string[] {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null && 'message' in res) {
      return (res as { message: string | string[] }).message;
    }
    return exception.message;
  }
}
