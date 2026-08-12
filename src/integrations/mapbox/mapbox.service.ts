import { Injectable, NotImplementedException } from '@nestjs/common';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

// Stub — chưa nối Mapbox Geocoding API thật (cần MAPBOX_ACCESS_TOKEN). Dùng khi cần chuyển địa chỉ
// gõ tay (vd đăng ký merchant) sang toạ độ; luồng đăng bài của user thường luôn lấy toạ độ trực
// tiếp từ thiết bị (expo-location), không qua service này.
@Injectable()
export class MapboxService {
  geocodeAddress(_addressText: string): Promise<GeocodeResult> {
    throw new NotImplementedException('MapboxService.geocodeAddress chưa nối Mapbox API thật');
  }
}
