export type DeliveryWindowMatchInput = {
  id: string;
  deliveryDate: string;
  slotId?: string;
  zoneId?: string;
  deliveryMethod?: string;
};

export type ShippingMethodMatchInput = {
  methodId: string;
  zoneId?: string;
  methodName?: string;
};

function normalize(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Pick the earliest delivery window whose `deliveryMethod` matches the selected
 * method id or name. Zone is used as a tie-breaker when both sides have one.
 */
export function matchDeliveryWindowForShippingMethod(
  windows: DeliveryWindowMatchInput[],
  method: ShippingMethodMatchInput,
): DeliveryWindowMatchInput | undefined {
  const methodId = normalize(method.methodId);
  const methodName = normalize(method.methodName);
  const zoneId = method.zoneId?.trim();

  const matches = windows.filter((window) => {
    const deliveryMethod = normalize(window.deliveryMethod);
    if (!deliveryMethod) {
      return false;
    }
    const methodOk = deliveryMethod === methodId || (methodName !== '' && deliveryMethod === methodName);
    if (!methodOk) {
      return false;
    }
    const windowZone = window.zoneId?.trim();
    if (zoneId && windowZone && windowZone !== zoneId) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) {
    return undefined;
  }
  return [...matches].sort((left, right) => left.deliveryDate.localeCompare(right.deliveryDate))[0];
}
