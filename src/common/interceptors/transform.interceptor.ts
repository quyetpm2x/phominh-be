import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Envelope<T> {
  data: T;
}

// Bọc mọi response thành công vào { data: ... } — cùng cặp với HttpExceptionFilter (bọc lỗi vào
// { statusCode, message, ... }) để FE luôn phân biệt rõ 2 hình dạng response.
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
