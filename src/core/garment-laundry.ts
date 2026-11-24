import type { Garment } from './entities';
import type { LaundryStatus } from './laundry';

export function toLaundryStatus(garment: Pick<Garment, 'laundryState' | 'wearCount' | 'washThreshold'>): LaundryStatus {
  return {
    state: garment.laundryState,
    wearCount: garment.wearCount,
    washThreshold: garment.washThreshold,
  };
}
