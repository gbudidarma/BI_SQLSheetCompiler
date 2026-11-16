/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableSchema, ColumnInfo, DataType } from '../types';

export interface McpConnectionConfig {
  id?: string;
  name?: string;
  endpointUrl: string; // e.g. "https://mcp.coros.com/mcp"
  authToken?: string; // Bearer token
  mode: 'direct' | 'demo';
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpDiscoveredResource {
  name: string;
  schema: string;
  rowCount: number;
  columnCount: number;
  description?: string;
  columns?: { name: string; type: string }[];
}

export interface McpTestResult {
  success: boolean;
  latencyMs: number;
  serverName?: string;
  protocolVersion?: string;
  toolsCount: number;
  tools?: McpTool[];
  error?: string;
}

// ============================================================================
// COROS WEARABLES & FITNESS DATA DEMO PROFILE
// ============================================================================

export const DEMO_COROS_PROFILE = {
  id: 'coros_training_hub',
  title: 'COROS Wearables: Training Hub & Telemetry',
  endpointUrl: 'https://mcp.coros.com/mcp',
  description: 'Athletic GPS Watch Telemetry: Running Activities, Daily Recovery HRV, and Acute:Chronic Training Load',
  tables: ['coros_running_activities', 'coros_daily_recovery_metrics', 'coros_training_load_status'],
};

export function getCorosDemoDataset(): Record<string, any[]> {
  return {
    coros_running_activities: [
      {
        activity_id: 'ACT-COROS-801',
        activity_name: 'Morning Aerobic Threshold Run',
        sport_type: 'Outdoor Run',
        start_time: '2024-04-10 06:15:22',
        duration_minutes: 52.4,
        distance_km: 10.25,
        avg_pace_min_km: '5:07',
        avg_heart_rate: 148,
        max_heart_rate: 164,
        cadence_spm: 178,
        elevation_gain_m: 85,
        aerobic_training_effect: 3.8,
        anaerobic_training_effect: 0.6,
        training_load: 142,
        calories: 720,
        running_power_watts: 245,
      },
      {
        activity_id: 'ACT-COROS-802',
        activity_name: 'Track 1000m Intervals (5x1km)',
        sport_type: 'Track Run',
        start_time: '2024-04-12 17:30:00',
        duration_minutes: 48.0,
        distance_km: 8.50,
        avg_pace_min_km: '4:15',
        avg_heart_rate: 168,
        max_heart_rate: 186,
        cadence_spm: 188,
        elevation_gain_m: 12,
        aerobic_training_effect: 4.2,
        anaerobic_training_effect: 3.1,
        training_load: 195,
        calories: 680,
        running_power_watts: 310,
      },
      {
        activity_id: 'ACT-COROS-803',
        activity_name: 'Easy Recovery Shakeout',
        sport_type: 'Outdoor Run',
        start_time: '2024-04-13 08:00:10',
        duration_minutes: 35.2,
        distance_km: 6.00,
        avg_pace_min_km: '5:52',
        avg_heart_rate: 132,
        max_heart_rate: 142,
        cadence_spm: 172,
        elevation_gain_m: 40,
        aerobic_training_effect: 2.3,
        anaerobic_training_effect: 0.0,
        training_load: 68,
        calories: 390,
        running_power_watts: 205,
      },
      {
        activity_id: 'ACT-COROS-804',
        activity_name: 'Sunday Mountain Trail Long Run',
        sport_type: 'Trail Run',
        start_time: '2024-04-14 07:00:00',
        duration_minutes: 135.5,
        distance_km: 22.40,
        avg_pace_min_km: '6:03',
        avg_heart_rate: 154,
        max_heart_rate: 175,
        cadence_spm: 174,
        elevation_gain_m: 640,
        aerobic_training_effect: 4.9,
        anaerobic_training_effect: 1.2,
        training_load: 340,
        calories: 1750,
        running_power_watts: 260,
      },
    ],
    coros_daily_recovery_metrics: [
      {
        date: '2024-04-10',
        resting_heart_rate: 46,
        hrv_index_ms: 68,
        sleep_score: 88,
        total_sleep_hours: 7.8,
        deep_sleep_hours: 2.1,
        rem_sleep_hours: 1.9,
        recovery_percentage: 85,
        daily_steps: 16420,
        active_calories: 840,
      },
      {
        date: '2024-04-11',
        resting_heart_rate: 47,
        hrv_index_ms: 64,
        sleep_score: 82,
        total_sleep_hours: 7.2,
        deep_sleep_hours: 1.8,
        rem_sleep_hours: 1.6,
        recovery_percentage: 78,
        daily_steps: 11200,
        active_calories: 420,
      },
      {
        date: '2024-04-12',
        resting_heart_rate: 49,
        hrv_index_ms: 58,
        sleep_score: 76,
        total_sleep_hours: 6.9,
        deep_sleep_hours: 1.4,
        rem_sleep_hours: 1.5,
        recovery_percentage: 65,
        daily_steps: 17800,
        active_calories: 910,
      },
      {
        date: '2024-04-13',
        resting_heart_rate: 48,
        hrv_index_ms: 62,
        sleep_score: 84,
        total_sleep_hours: 8.1,
        deep_sleep_hours: 2.0,
        rem_sleep_hours: 1.9,
        recovery_percentage: 75,
        daily_steps: 12500,
        active_calories: 510,
      },
      {
        date: '2024-04-14',
        resting_heart_rate: 51,
        hrv_index_ms: 52,
        sleep_score: 72,
        total_sleep_hours: 7.5,
        deep_sleep_hours: 1.5,
        rem_sleep_hours: 1.6,
        recovery_percentage: 55,
        daily_steps: 28400,
        active_calories: 1980,
      },
    ],
    coros_training_load_status: [
      {
        date: '2024-04-10',
        acute_load_7d: 840,
        chronic_load_28d: 780,
        acwr_ratio: 1.08,
        fatigue_score: 42,
        fitness_score: 78,
        status: 'Optimal',
        marathon_level: 74.2,
        predicted_10k_time: '00:39:45',
        predicted_marathon_time: '03:04:12',
      },
      {
        date: '2024-04-12',
        acute_load_7d: 960,
        chronic_load_28d: 810,
        acwr_ratio: 1.18,
        fatigue_score: 58,
        fitness_score: 80,
        status: 'Optimal',
        marathon_level: 74.5,
        predicted_10k_time: '00:39:30',
        predicted_marathon_time: '03:03:20',
      },
      {
        date: '2024-04-14',
        acute_load_7d: 1240,
        chronic_load_28d: 860,
        acwr_ratio: 1.44,
        fatigue_score: 78,
        fitness_score: 82,
        status: 'High Load',
        marathon_level: 74.8,
        predicted_10k_time: '00:39:15',
        predicted_marathon_time: '03:02:10',
      },
    ],
  };
}

// Column inference
function inferMcpColumns(rows: Record<string, any>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map((colName) => {
    let type: DataType = 'TEXT';
    let nullCount = 0;
    const values: any[] = [];

    for (const row of rows) {
      const val = row[colName];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        values.push(val);
      }
    }

    if (values.length > 0) {
      const allNumbers = values.every((v) => typeof v === 'number');
      const allInts = allNumbers && values.every((v) => Number.isInteger(v));
      const allBooleans = values.every((v) => typeof v === 'boolean');
      const allDates = values.every((v) => {
        if (typeof v !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
      });

      if (allBooleans) type = 'BOOLEAN';
      else if (allInts) type = 'INTEGER';
      else if (allNumbers) type = 'FLOAT';
      else if (allDates) type = 'DATE';
    }

    const distinct = new Set(values).size;

    return {
      name: colName,
      originalName: colName,
      type,
      nullCount,
      distinctCount: distinct,
      sampleValues: values.slice(0, 5),
    };
  });
}

// ============================================================================
// CORE JSON-RPC CLIENT OVER HTTP
// ============================================================================

export async function sendMcpJsonRpc(
  endpointUrl: string,
  method: string,
  params: Record<string, any> = {},
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        `401 Unauthorized: MCP server rejected credentials. Provide a valid Bearer token for ${endpointUrl}.`
      );
    }
    const errText = await response.text().catch(() => '');
    throw new Error(`MCP Error HTTP ${response.status}: ${errText || response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
  }

  return data.result;
}

// ============================================================================
// MCP CONNECTOR METHODS
// ============================================================================

/**
 * Test connection to MCP server (e.g. https://mcp.coros.com/mcp)
 */
export async function testMcpConnection(
  config: McpConnectionConfig
): Promise<McpTestResult> {
  const startTime = performance.now();

  // Mode 1: In-Browser Demo Profile (COROS Training Hub)
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const latency = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs: latency,
      serverName: 'COROS Wearables MCP Server (mcp_us_prod v2.11.15)',
      protocolVersion: '2024-11-05',
      toolsCount: 3,
      tools: [
        { name: 'coros_running_activities', description: 'Query GPS workouts, pace, cadence, running power & HR' },
        { name: 'coros_daily_recovery_metrics', description: 'Query resting heart rate, HRV index, and sleep stages' },
        { name: 'coros_training_load_status', description: 'Query acute/chronic load, ACWR ratio, and marathon predictions' },
      ],
    };
  }

  // Mode 2: Direct HTTP MCP Call
  try {
    const cleanUrl = config.endpointUrl.trim();
    if (!cleanUrl) {
      return {
        success: false,
        latencyMs: 0,
        toolsCount: 0,
        error: 'Please enter an MCP endpoint URL (e.g. https://mcp.coros.com/mcp)',
      };
    }

    // 1. Handshake: initialize
    let initResult: any = null;
    try {
      initResult = await sendMcpJsonRpc(
        cleanUrl,
        'initialize',
        {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'SheetSQL', version: '1.0.0' },
        },
        config.authToken
      );
    } catch {
      // Some serverless MCP gateways jump straight to tools/list
    }

    // 2. Discover available tools
    const toolsResult = await sendMcpJsonRpc(cleanUrl, 'tools/list', {}, config.authToken);
    const latency = Math.round(performance.now() - startTime);

    const tools: McpTool[] = toolsResult?.tools || [];
    const serverName = initResult?.serverInfo?.name || new URL(cleanUrl).hostname;

    return {
      success: true,
      latencyMs: latency,
      serverName,
      protocolVersion: initResult?.protocolVersion || '2024-11-05',
      toolsCount: tools.length,
      tools,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    return {
      success: false,
      latencyMs: latency,
      toolsCount: 0,
      error: err.message,
    };
  }
}

/**
 * Fetch available tables or tools from MCP server
 */
export async function fetchMcpResources(
  config: McpConnectionConfig
): Promise<McpDiscoveredResource[]> {
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const dataset = getCorosDemoDataset();
    return Object.keys(dataset).map((name) => ({
      name,
      schema: 'coros_hub',
      rowCount: dataset[name].length,
      columnCount: Object.keys(dataset[name][0] || {}).length,
      description: `COROS Fitness Telemetry (${dataset[name].length} rows)`,
    }));
  }

  const cleanUrl = config.endpointUrl.trim();
  const toolsResult = await sendMcpJsonRpc(cleanUrl, 'tools/list', {}, config.authToken);
  const tools: McpTool[] = toolsResult?.tools || [];

  return tools.map((t) => ({
    name: t.name,
    schema: 'mcp_tools',
    rowCount: 0,
    columnCount: 0,
    description: t.description || `MCP Tool: ${t.name}`,
  }));
}

/**
 * Import an MCP tool result or resource as TableSchema
 */
export async function importMcpResource(
  config: McpConnectionConfig,
  toolOrResourceName: string
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }> {
  let rows: Record<string, any>[] = [];

  if (config.mode === 'demo') {
    const dataset = getCorosDemoDataset();
    rows = dataset[toolOrResourceName] || [];
  } else {
    const cleanUrl = config.endpointUrl.trim();
    const result = await sendMcpJsonRpc(
      cleanUrl,
      'tools/call',
      {
        name: toolOrResourceName,
        arguments: {},
      },
      config.authToken
    );

    // Extract records from standard MCP tool response
    if (Array.isArray(result?.content)) {
      for (const item of result.content) {
        if (item.type === 'text' && typeof item.text === 'string') {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) {
              rows = parsed;
              break;
            } else if (typeof parsed === 'object') {
              // Extract array if wrapped (e.g. { activities: [...] } or { data: [...] })
              const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
              if (arrayKey) {
                rows = parsed[arrayKey];
                break;
              } else {
                rows = [parsed];
                break;
              }
            }
          } catch {
            // Not JSON
          }
        }
      }
    } else if (Array.isArray(result)) {
      rows = result;
    } else if (result && typeof result === 'object') {
      const arrayKey = Object.keys(result).find((k) => Array.isArray(result[k]));
      if (arrayKey) rows = result[arrayKey];
      else rows = [result];
    }
  }

  if (rows.length === 0) {
    throw new Error(`MCP tool "${toolOrResourceName}" did not return any tabular rows.`);
  }

  const columns = inferMcpColumns(rows);
  const hostLabel = config.mode === 'demo' ? 'COROS MCP' : new URL(config.endpointUrl).hostname;

  const schema: TableSchema = {
    id: `mcp_${toolOrResourceName}_${Date.now()}`,
    name: toolOrResourceName,
    sourceFileName: `MCP (${hostLabel})`,
    sheetName: `mcp.${toolOrResourceName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'mcp',
    connectionName: `MCP [${hostLabel}]`,
  };

  return { schema, rows };
}
