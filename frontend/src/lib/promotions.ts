export const percentToBasisPoints = (percent: number): number => Math.round(percent * 100);

export const basisPointsToPercent = (basisPoints: number): number => basisPoints / 100;

export const localDateBoundaryIso = (value: string, endOfDay = false): string => {
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    return new Date(`${value}T${time}`).toISOString();
};
