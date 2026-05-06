const express = require('express');
const router = express.Router();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const BQ_PROJECT_ID = process.env.BILLING_BQ_PROJECT_ID || PROJECT_ID;
const BQ_DATASET = process.env.BILLING_BQ_DATASET; // e.g. 'billing_export'
const BQ_TABLE = process.env.BILLING_BQ_TABLE;     // e.g. 'gcp_billing_export_v1_XXXXXX'
const BQ_TABLE_COUNT = process.env.BILLING_BQ_TABLE_COUNT; // e.g. 'usage_count_table'
const CREDIT_LIMIT_USD = Number(process.env.BILLING_CREDIT_LIMIT_USD || 0);
const DEFAULT_RANGE_DAYS = 30;

function normalizeToUtcDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateInput(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return normalizeToUtcDate(input);
  }
  if (typeof input === 'object' && input !== null && Object.prototype.hasOwnProperty.call(input, 'value')) {
    return parseDateInput(input.value);
  }
  const str = String(input).trim();
  if (!str) return null;
  const isoCandidate = str.includes('T') ? str : `${str}T00:00:00Z`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return normalizeToUtcDate(parsed);
}

function toISODate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - Math.max(days, 0));
  return result;
}

function ensureConfigured() {
  return Boolean(BQ_DATASET && BQ_TABLE && (PROJECT_ID || BQ_PROJECT_ID));
}

function ensureCountConfigured() {
  return Boolean(BQ_DATASET && BQ_TABLE_COUNT && (PROJECT_ID || BQ_PROJECT_ID));
}

// Return empty data structure when no data is available
function getNoDataResponse(start, end) {
  let startDate = parseDateInput(start) || parseDateInput(new Date());
  let endDate = parseDateInput(end) || normalizeToUtcDate(new Date());

  if (!startDate) {
    startDate = normalizeToUtcDate(new Date());
  }
  if (!endDate) {
    endDate = normalizeToUtcDate(new Date());
  }
  if (startDate > endDate) {
    startDate = new Date(endDate);
  }
  
  return {
    configured: false,
    hasData: false,
    totalCost: 0,
    totalCredits: 0,
    totalDiscounts: 0,
    netCost: 0,
    byDay: [],
    start: toISODate(startDate),
    end: toISODate(endDate),
    availableStart: toISODate(startDate),
    availableEnd: toISODate(endDate)
  };
}

router.get('/summary', async (req, res) => {
  try {
    let requestedRangeDays = null;
    if (typeof req.query.range === 'string') {
      const parsedRange = parseInt(req.query.range, 10);
      if (!Number.isNaN(parsedRange) && parsedRange > 0) {
        requestedRangeDays = parsedRange;
      }
    }

    const explicitStart = parseDateInput(req.query.start);
    const explicitEnd = parseDateInput(req.query.end);
    const normalizedNow = parseDateInput(new Date());
    const fallbackRangeDays = Math.max(requestedRangeDays || DEFAULT_RANGE_DAYS, 1);
    const fallbackEnd = explicitEnd || normalizedNow;
    const fallbackStart = explicitStart || subtractDays(fallbackEnd, fallbackRangeDays - 1);

    if (!ensureConfigured()) {
      return res.json(getNoDataResponse(fallbackStart, fallbackEnd));
    }

    const bq = new BigQuery({ projectId: BQ_PROJECT_ID });

    const [rangeRows] = await bq.query({
      query: `
        SELECT
          MIN(DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR))) AS min_day,
          MAX(DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR))) AS max_day
        FROM
          \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\`
      `
    });

    const availableStartDate = parseDateInput(rangeRows?.[0]?.min_day);
    const availableEndDate = parseDateInput(rangeRows?.[0]?.max_day);

    // Check if table has any data
    if (!availableStartDate || !availableEndDate) {
      return res.json(getNoDataResponse(fallbackStart, fallbackEnd));
    }

    let effectiveStart = explicitStart ? new Date(explicitStart) : null;
    let effectiveEnd = explicitEnd ? new Date(explicitEnd) : null;

    if (requestedRangeDays && availableEndDate) {
      effectiveEnd = new Date(availableEndDate);
      effectiveStart = subtractDays(effectiveEnd, requestedRangeDays - 1);
    }

    if (!effectiveEnd) {
      effectiveEnd = availableEndDate ? new Date(availableEndDate) : new Date(fallbackEnd);
    }

    if (!effectiveStart) {
      effectiveStart = subtractDays(effectiveEnd, fallbackRangeDays - 1);
    }

    if (availableStartDate && effectiveStart < availableStartDate) {
      effectiveStart = new Date(availableStartDate);
    }
    if (availableEndDate && effectiveEnd > availableEndDate) {
      effectiveEnd = new Date(availableEndDate);
    }
    if (effectiveStart > effectiveEnd) {
      effectiveStart = new Date(effectiveEnd);
    }

    const startIso = toISODate(effectiveStart);
    const endIso = toISODate(effectiveEnd);

    const query = `
      SELECT
        DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR)) AS operation_day,
        ROUND(SUM(cost), 2) AS sum_cost,
        ROUND(SUM(IFNULL(credits[SAFE_OFFSET(0)].amount, 0)), 2) AS sum_credit,
        ROUND(SUM(cost) + SUM(IFNULL(credits[SAFE_OFFSET(0)].amount, 0)), 2) AS net
      FROM
        \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\`
      WHERE
        DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR)) >= DATE(@start_date)
        AND DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR)) <= DATE(@end_date)
      GROUP BY
        operation_day
      ORDER BY
        operation_day
    `;
    const params = { 
      start_date: startIso, 
      end_date: endIso 
    };
    
    const [rows] = await bq.query({ query, params });

    // Check if query returned any data
    if (!rows || rows.length === 0) {
      return res.json({
        configured: true,
        hasData: false,
        totalCost: 0,
        totalCredits: 0,
        totalDiscounts: 0,
        netCost: 0,
        byDay: [],
        start: startIso,
        end: endIso,
        availableStart: toISODate(availableStartDate),
        availableEnd: toISODate(availableEndDate),
        range: requestedRangeDays ? `${requestedRangeDays}d` : null
      });
    }

    const byDay = rows.map((r) => {
      const date = (r.operation_day && (r.operation_day.value || r.operation_day)) || null;
      const grossCost = Number(r.sum_cost || 0);
      const creditsApplied = Number(r.sum_credit || 0); // credits amount (already negative in BigQuery)
      const netCost = Number(r.net || 0); // net cost from query
      return {
        date,
        cost: grossCost,                                   // gross charges before credits/discounts
        credits: creditsApplied,                           // credits amount (negative)
        discounts: 0,                                      // not available in new query
        net: netCost                                       // net after credits and discounts
      };
    });

    const totalCost = byDay.reduce((s, r) => s + (r.cost || 0), 0);
    const totalCredits = byDay.reduce((s, r) => s + (r.credits || 0), 0);
    const totalDiscounts = byDay.reduce((s, r) => s + (r.discounts || 0), 0);
    const netCost = byDay.reduce((s, r) => s + (r.net || 0), 0);

    res.json({
      configured: true,
      hasData: true,
      totalCost, totalCredits, totalDiscounts, netCost,
      byDay,
      start: startIso,
      end: endIso,
      availableStart: toISODate(availableStartDate),
      availableEnd: toISODate(availableEndDate),
      range: requestedRangeDays ? `${requestedRangeDays}d` : null
    });
  } catch (e) {
    console.error('Billing summary error:', e.message);
    // Return no data on error instead of mock data
    const fallbackEnd = parseDateInput(req.query.end) || parseDateInput(new Date());
    const fallbackStart = parseDateInput(req.query.start) || subtractDays(fallbackEnd, DEFAULT_RANGE_DAYS - 1);
    res.json(getNoDataResponse(fallbackStart, fallbackEnd));
  }
});

router.get('/credits', async (req, res) => {
  try {
    if (!ensureConfigured()) {
      return res.json({ 
        configured: false,
        hasData: false,
        charges: 0,
        creditsApplied: 0,
        discountsApplied: 0,
        net: 0,
        totalGrant: null,
        remaining: null,
        creditsByProgram: []
      });
    }

    // Query ALL time data (no date filters) since credits are one-time grants
    const bq = new BigQuery({ projectId: BQ_PROJECT_ID });

    // 1) Totals: charges (all-time net) and applied credits
    const [totals] = await bq.query({
      query: `
        SELECT
          ROUND(SUM(cost), 2) AS charges,
          ROUND(SUM(IFNULL(credits[SAFE_OFFSET(0)].amount, 0)), 2) AS credits_applied,
          ROUND(SUM(cost) + SUM(IFNULL(credits[SAFE_OFFSET(0)].amount, 0)), 2) AS net
        FROM
          \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\`
      `,
      params: {}
    });

    // 2) Per-grant breakdown using the credits array (simplified for new query structure)
    const [byGrant] = await bq.query({
      query: `
        SELECT
          'credit_grant' AS credit_id,
          'Applied Credits' AS name,
          'PROMOTION' AS type,
          ROUND(SUM(IFNULL(credits[SAFE_OFFSET(0)].amount, 0)), 2) AS applied,
          MIN(DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR))) AS first_date,
          MAX(DATE(TIMESTAMP_SUB(_PARTITIONTIME, INTERVAL 16 HOUR))) AS last_date
        FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\`
        WHERE credits[SAFE_OFFSET(0)].amount IS NOT NULL
        HAVING applied != 0
        ORDER BY applied DESC
      `,
      params: {}
    });

    const charges = Number(totals?.[0]?.charges || 0);
    const creditsApplied = Number(totals?.[0]?.credits_applied || 0); // positive dollars of credits applied
    const discountsApplied = 0; // not available in new query structure
    const net = Number(totals?.[0]?.net || 0); // net from query

    // Check if there's any data
    const hasData = charges !== 0 || creditsApplied !== 0 || net !== 0 || (byGrant && byGrant.length > 0);

    const totalGrant = null;      // unknown from BigQuery export alone
    const remaining = null;

    res.json({
      configured: true,
      hasData,
      charges,
      creditsApplied,
      discountsApplied,
      net,
      totalGrant,
      remaining,
      creditsByProgram: (byGrant || []).map(r => ({
        id: r.credit_id,
        name: r.name,
        type: r.type,
        applied: Number(r.applied || 0),
        firstDate: r.first_date,
        lastDate: r.last_date
      }))
    });
  } catch (e) {
    console.error('Credits error:', e.message);
    // Return no data on error instead of mock data
    res.json({ 
      configured: false,
      hasData: false,
      charges: 0,
      creditsApplied: 0,
      discountsApplied: 0,
      net: 0,
      totalGrant: null,
      remaining: null,
      creditsByProgram: []
    });
  }
});

router.get('/remaining', async (req, res) => {
  try {
    if (!ensureCountConfigured()) {
      return res.json({ 
        configured: false,
        hasData: false,
        imageRemaining: null,
        videoRemaining: null
      });
    }

    const bq = new BigQuery({ projectId: BQ_PROJECT_ID });
    const query = `
      SELECT
        FLOOR((300 - (COALESCE(SUM(image), 0) * 0.04 * 1.1 + COALESCE(SUM(video), 0) * 3.2 * 1.1)) / 0.044) AS image_remaining,
        FLOOR((300 - (COALESCE(SUM(image), 0) * 0.04 * 1.1 + COALESCE(SUM(video), 0) * 3.2 * 1.1)) / 3.52) AS video_remaining
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE_COUNT}\`
    `;
    
    const [rows] = await bq.query({ query });
    const result = rows[0] || {};

    // Check if table has data
    const hasData = rows && rows.length > 0;

    res.json({
      configured: true,
      hasData,
      imageRemaining: hasData ? Math.max(0, Number(result.image_remaining || 0)) : null,
      videoRemaining: hasData ? Math.max(0, Number(result.video_remaining || 0)) : null
    });
  } catch (e) {
    console.error('Remaining counts error:', e.message);
    // Return no data on error
    res.json({ 
      configured: false,
      hasData: false,
      imageRemaining: null,
      videoRemaining: null
    });
  }
});

module.exports = router;
