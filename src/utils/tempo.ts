export function tempoFromDate(
  sDate: Date | string | moment.Moment | null,
  eDate: Date | string | moment.Moment | null,
  position: number
): Date | null {
  if (!sDate || !eDate || position < 0 || position > 1) return null;

  // Convert any input to a Date
  const start =
    sDate instanceof Date
      ? sDate
      : (typeof sDate === 'string'
          ? new Date(sDate)
          : (sDate as any).toDate?.() ?? new Date());

  const end =
    eDate instanceof Date
      ? eDate
      : (typeof eDate === 'string'
          ? new Date(eDate)
          : (eDate as any).toDate?.() ?? new Date());

  const sTime = start.getTime();
  const eTime = end.getTime();

  const tTime = sTime + (eTime - sTime) * position;
  return new Date(tTime);
}

export function positionFromTempo(
  sDate: Date | string | moment.Moment | null,
  eDate: Date | string | moment.Moment | null,
  cDate: Date | string | moment.Moment | null
): number | null {
  if (!sDate || !eDate || !cDate) return null;

  const toDate = (d: any): Date =>
    d instanceof Date ? d
    : typeof d === 'string' ? new Date(d)
    : d?.toDate?.() ?? new Date(d);

  const start = toDate(sDate).getTime();
  const end   = toDate(eDate).getTime();
  const curr  = toDate(cDate).getTime();

  const duration = end - start;
  if (duration <= 0) return null; // invalid or reversed times

  // normalized position between 0–1
  const t = (curr - start) / duration;

  // clamp to [0,1]
  return Math.max(0, Math.min(1, t));
}
