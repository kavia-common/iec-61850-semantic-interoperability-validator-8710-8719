function median(values) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function mean(values) {
  let s = 0;
  let n = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    s += v;
    n += 1;
  }
  return n ? s / n : null;
}

function stdev(values, mu) {
  let s = 0;
  let n = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const d = v - mu;
    s += d * d;
    n += 1;
  }
  return n > 1 ? Math.sqrt(s / (n - 1)) : null;
}

function mad(values, med) {
  const devs = values
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.abs(v - med));
  return median(devs);
}

function quantile(sortedValues, q) {
  const arr = sortedValues.filter((v) => Number.isFinite(v));
  if (!arr.length) return null;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] === undefined) return arr[base];
  return arr[base] + rest * (arr[base + 1] - arr[base]);
}

function summarizeFeatureContribution({ columns, perFeatureScore }) {
  // Return top contributing features with absolute score.
  const entries = columns.map((c, i) => ({
    feature: c,
    contribution: Math.abs(perFeatureScore[i] ?? 0)
  }));
  entries.sort((a, b) => b.contribution - a.contribution);
  return entries.slice(0, 5);
}

// PUBLIC_INTERFACE
export function detectAnomalies(matrix, columns, options = {}) {
  /**
   * Client-side anomaly detection on a numeric matrix.
   *
   * Approach:
   * - Per-feature scaling using either:
   *    - robust z-score via median/MAD (default), or
   *    - standard z-score via mean/std
   * - Row anomaly score = mean(|z_i|) over selected features for that row
   * - Flag outliers by either:
   *    - topK, or
   *    - percentile threshold, or
   *    - score threshold
   */
  const {
    method = 'robust_zscore', // 'robust_zscore' | 'zscore'
    missing = 'skip', // 'skip' | 'impute_median'
    scoreAgg = 'mean_abs', // reserved for future
    outlierMode = 'percentile', // 'percentile' | 'topK' | 'threshold'
    percentile = 0.99,
    topK = 50,
    threshold = 3.5
  } = options;

  const nRows = matrix.length;
  const nFeat = columns.length;

  // Build per-feature arrays for statistics
  const featureValues = Array.from({ length: nFeat }, () => []);
  for (let r = 0; r < nRows; r += 1) {
    for (let c = 0; c < nFeat; c += 1) {
      const v = matrix[r][c];
      if (Number.isFinite(v)) featureValues[c].push(v);
    }
  }

  const centers = new Array(nFeat).fill(null);
  const scales = new Array(nFeat).fill(null);

  for (let c = 0; c < nFeat; c += 1) {
    const vals = featureValues[c];
    if (method === 'zscore') {
      const mu = mean(vals);
      const sd = mu === null ? null : stdev(vals, mu);
      centers[c] = mu;
      scales[c] = sd && sd > 0 ? sd : null;
    } else {
      const med = median(vals);
      const m = med === null ? null : mad(vals, med);
      // Consistent scale estimate for normal distribution: 1.4826 * MAD
      centers[c] = med;
      scales[c] = m && m > 0 ? 1.4826 * m : null;
    }
  }

  // Optional missing imputation value per feature
  const imputes = centers.slice();

  // Compute per-row scores and per-feature z values
  const scores = new Array(nRows).fill(0);
  const rowFeatureZ = Array.from({ length: nRows }, () => new Array(nFeat).fill(null));

  for (let r = 0; r < nRows; r += 1) {
    let sumAbs = 0;
    let count = 0;

    for (let c = 0; c < nFeat; c += 1) {
      const center = centers[c];
      const scale = scales[c];
      if (center === null || scale === null) continue; // unusable feature

      let v = matrix[r][c];
      if (!Number.isFinite(v)) {
        if (missing === 'impute_median') v = imputes[c];
        else continue;
      }

      const z = (v - center) / scale;
      rowFeatureZ[r][c] = z;

      sumAbs += Math.abs(z);
      count += 1;
    }

    scores[r] = count ? sumAbs / count : 0;
  }

  // Determine outliers
  const scorePairs = scores.map((s, i) => ({ index: i, score: s }));
  scorePairs.sort((a, b) => b.score - a.score);

  let outlierSet = new Set();
  let scoreCut = null;

  if (outlierMode === 'topK') {
    const k = Math.max(1, Math.min(topK, scorePairs.length));
    scoreCut = scorePairs[k - 1]?.score ?? null;
    outlierSet = new Set(scorePairs.slice(0, k).map((p) => p.index));
  } else if (outlierMode === 'threshold') {
    scoreCut = threshold;
    outlierSet = new Set(scorePairs.filter((p) => p.score >= threshold).map((p) => p.index));
  } else {
    // percentile
    const sortedAsc = scores.slice().sort((a, b) => a - b);
    scoreCut = quantile(sortedAsc, percentile);
    outlierSet = new Set(scorePairs.filter((p) => p.score >= (scoreCut ?? Infinity)).map((p) => p.index));
  }

  const outliers = scorePairs
    .filter((p) => outlierSet.has(p.index))
    .map((p) => ({
      rowIndex: p.index,
      score: p.score,
      topFeatures: summarizeFeatureContribution({
        columns,
        perFeatureScore: rowFeatureZ[p.index]
      })
    }));

  // Basic recommendations based on results
  const outlierRate = nRows ? outliers.length / nRows : 0;
  const recommendations = [];

  recommendations.push({
    title: 'Review high-scoring outliers first',
    detail:
      'Start with rows having the largest anomaly score, and inspect the top contributing features shown for each outlier.'
  });

  if (outlierRate > 0.05) {
    recommendations.push({
      title: 'Many outliers detected',
      detail:
        'If >5% of rows are flagged, consider raising the percentile (e.g., 0.995), switching to Top-K, or refining feature selection to reduce noise.'
    });
  } else if (outliers.length === 0) {
    recommendations.push({
      title: 'No outliers flagged',
      detail:
        'Consider lowering the percentile (e.g., 0.95–0.98), using missing-value imputation, or adding more numeric features.'
    });
  }

  if (missing === 'skip') {
    recommendations.push({
      title: 'Missing values were skipped',
      detail:
        'If important features are sparse, try "Impute median" to ensure each row gets a score based on a consistent set of features.'
    });
  }

  return {
    method,
    options: { method, missing, scoreAgg, outlierMode, percentile, topK, threshold },
    columns,
    summary: {
      rows: nRows,
      features: nFeat,
      outliers: outliers.length,
      outlierRate,
      scoreThresholdUsed: scoreCut
    },
    scores, // aligned with input rows
    outliers // sorted by score desc
  };
}
