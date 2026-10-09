// Merge observations, never collection attempts, into measurement history.
export const metrics = ['audience', 'views', 'impressions', 'likes', 'reactions', 'comments', 'reposts', 'shares', 'saves', 'engagements'];
const rank = source => source === 'manual-override' ? 4 : source === 'browser-verified' ? 3 : source?.endsWith('-api') ? 2 : 0;
export function verifiedTime(record, metric) {
  if (record?.metricVerifiedAt && Object.hasOwn(record.metricVerifiedAt, metric)) return record.metricVerifiedAt[metric];
  return record?.[`${metric}VerifiedAt`] ?? record?.verifiedAt ?? record?.updatedAt ?? null;
}
function orderTime(record, metric) {
  const time = verifiedTime(record, metric);
  if (time && Number.isFinite(Date.parse(time))) return Date.parse(time);
  // Legacy daily observations have only day precision. Never assign a fabricated timestamp.
  return Date.parse(`${record?.observedOn || record?.date || ''}T00:00:00Z`) || 0;
}
export function mergeMeasurement(previous = {}, incoming) {
  const result = { ...previous, ...incoming,
    metricVerifiedAt: { ...previous.metricVerifiedAt },
    metricSources: { ...previous.metricSources },
  };
  // Preserve historical timestamps before accepting any partial observation.
  for (const metric of metrics) {
    if (Number.isFinite(previous[metric])) {
      result.metricVerifiedAt[metric] = verifiedTime(previous, metric);
      result.metricSources[metric] = previous.metricSources?.[metric] || previous.source;
    }
  }
  let accepted = false;
  for (const metric of metrics) {
    if (!(metric in previous) && !(metric in incoming)) continue;
    const usable = Number.isFinite(incoming[metric]) && incoming[metric] >= 0 && incoming.source !== 'carry-forward';
    const incomingTime = orderTime(incoming, metric);
    const oldTime = orderTime(previous, metric);
    const oldSource = previous.metricSources?.[metric] || previous.source;
    const newer = incomingTime > oldTime || (incomingTime === oldTime && rank(incoming.source) >= rank(oldSource));
    if (usable && (!Number.isFinite(previous[metric]) || newer)) {
      result[metric] = incoming[metric];
      result.metricVerifiedAt[metric] = verifiedTime(incoming, metric);
      result.metricSources[metric] = incoming.metricSources?.[metric] || incoming.source;
      accepted = true;
    } else if (metric in previous) {
      result[metric] = previous[metric];
      if (metric === 'audience') {
        result.source = previous.source;
        result.precision = previous.precision;
        result.verifiedAt = previous.verifiedAt;
        result.observedOn = previous.observedOn;
        result.sourceUrl = previous.sourceUrl;
      }
      for (const suffix of ['VerifiedAt', 'Precision']) {
        const key = `${metric}${suffix}`;
        if (key in previous) result[key] = previous[key]; else delete result[key];
      }
    } else {
      result[metric] = null;
      delete result.metricVerifiedAt[metric];
      delete result.metricSources[metric];
    }
  }
  if (!accepted) {
    result.updatedAt = previous.updatedAt;
    result.verifiedAt = previous.verifiedAt;
    result.source = previous.source || incoming.source;
  }
  return result;
}
export function carryForward(previous, date, attemptedAt) {
  const originalDate = previous.observedOn || (previous.source !== 'carry-forward' ? previous.date : null);
  return { ...previous, date, observedOn: originalDate, source: 'carry-forward', precision: 'stale', lastAttemptAt: attemptedAt, lastAttemptStatus: 'unavailable' };
}
