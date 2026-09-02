import { commandError } from './errors.ts'
export {
  DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION, MCP_PERMISSION_LABELS, MCP_PERMISSIONS,
  type McpPermission,
} from '../_shared/mcp-permissions.ts'
import { MCP_PERMISSION, type McpPermission } from '../_shared/mcp-permissions.ts'

export interface McpPermissionRow {
  can_read_types: boolean
  can_read_data: boolean
  can_write_proposals: boolean
  can_access_people: boolean
}

export function permissionsFromRow(row: McpPermissionRow | null): McpPermission[] {
  if (!row) return []
  return [
    row.can_read_types ? MCP_PERMISSION.typesRead : null,
    row.can_read_data ? MCP_PERMISSION.dataRead : null,
    row.can_write_proposals ? MCP_PERMISSION.proposalsWrite : null,
    row.can_access_people ? MCP_PERMISSION.peopleData : null,
  ].filter((permission): permission is McpPermission => permission !== null)
}

export function requirePermission(permissions: readonly string[], permission: string): void {
  if (!permissions.includes(permission)) throw commandError('forbidden')
}

export function mayReadType(permissions: readonly string[], typeKey: string): boolean {
  return typeKey !== 'person' || permissions.includes(MCP_PERMISSION.peopleData)
}
