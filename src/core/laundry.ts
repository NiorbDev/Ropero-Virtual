export type LaundryState = 'clean' | 'used' | 'dirty';

export interface LaundryStatus {
  state: LaundryState;
  wearCount: number;
  washThreshold: number;
}

export function needsLaundry(status: LaundryStatus): boolean {
  return status.state === 'dirty' || status.wearCount >= status.washThreshold;
}

export function markClean(status: LaundryStatus): LaundryStatus {
  return {
    ...status,
    state: 'clean',
    wearCount: 0,
  };
}

export function markUsed(status: LaundryStatus): LaundryStatus {
  return {
    ...status,
    state: 'used',
    wearCount: status.wearCount + 1,
  };
}

export function markDirty(status: LaundryStatus): LaundryStatus {
  return {
    ...status,
    state: 'dirty',
  };
}
