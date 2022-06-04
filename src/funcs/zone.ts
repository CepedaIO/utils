/**
 * @description Future calls to a zoned function will always call it with zoned values
 * @param func 
 * @param zones 
 * @returns 
 */
export function zone(func: (...args: any[]) => any, ...zones: any[]) {
  return (...args: any[]) => {
    zones.forEach((zone, index) => {
      if (zone === null || zone === undefined) {
        return;
      }

      if (Array.isArray(zone)) {
        args[index] = [
          ...zone,
          ...args[index]
        ];
      } else if (typeof zone === 'object') {
        args[index] = {
          ...zone,
          ...args[index]
        };
      } else {
        args[index] = zone;
      }
    });

    return func(...args)
  }
}