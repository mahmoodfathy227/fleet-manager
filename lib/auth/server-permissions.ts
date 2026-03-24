import { createClient } from '@/lib/supabase/server'

export async function getMyPermissionSet(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_permissions')

  if (error || !data) {
    return new Set<string>()
  }

  const permissions = (data as Array<{ permission_key?: string }>)
    .map((row) => row.permission_key)
    .filter((key): key is string => Boolean(key))

  return new Set(permissions)
}

export async function hasAnyServerPermission(required: string[]): Promise<boolean> {
  const permissionSet = await getMyPermissionSet()
  return required.some((permission) => permissionSet.has(permission))
}
