import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code =
      (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (error as { code?: string })?.code;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : code === '23505' || code === '23503'
          ? 409
          : 500;
    const response =
      error instanceof HttpException
        ? error.getResponse()
        : {
            message:
              status === 409
                ? 'Registro duplicado ou vinculado a outros dados'
                : 'Não foi possível concluir a operação',
          };
    if (status === 500)
      this.logger.error(`Falha interna na operação. Código: ${code ?? 'indisponível'}`);
    res.status(status).json({
      error: typeof response === 'string' ? { message: response } : response,
      statusCode: status,
    });
  }
}
