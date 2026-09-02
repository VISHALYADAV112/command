export const MCP_PERMISSION = {
  typesRead: 'command:types:read',
  dataRead: 'command:data:read',
  proposalsWrite: 'command:proposals:write',
  peopleData: 'command:data:people',
} as const

export const MCP_PERMISSIONS = Object.values(MCP_PERMISSION)
export type McpPermission = typeof MCP_PERMISSIONS[number]

export const DEFAULT_MCP_PERMISSIONS: McpPermission[] = [
  MCP_PERMISSION.typesRead,
  MCP_PERMISSION.dataRead,
  MCP_PERMISSION.proposalsWrite,
]

export const MCP_PERMISSION_LABELS: Record<McpPermission, string> = {
  [MCP_PERMISSION.typesRead]: 'See type definitions',
  [MCP_PERMISSION.dataRead]: 'Read Command records and commitments',
  [MCP_PERMISSION.proposalsWrite]: 'Submit changes to the Agent inbox',
  [MCP_PERMISSION.peopleData]: 'Access person records',
}
