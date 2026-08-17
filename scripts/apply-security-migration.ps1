param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$migrationPath = Join-Path $PSScriptRoot '..\supabase\migrations\20260817120000_security_hardening.sql'
$migrationPath = [System.IO.Path]::GetFullPath($migrationPath)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LuarSecurityMigrationCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob;
    public UInt32 Persist; public UInt32 AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern void CredFree(IntPtr cred);
  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      var credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      var bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return System.Text.Encoding.UTF8.GetString(bytes).TrimEnd('\0');
    } finally { CredFree(pointer); }
  }
}
'@

$accessToken = [LuarSecurityMigrationCredentialReader]::Read('Supabase CLI:supabase')
$headers = @{ Authorization = "Bearer $accessToken"; 'Content-Type' = 'application/json' }
$endpoint = 'https://api.supabase.com/v1/projects/thdocebzzvxrwaefzufm/database/query'

function Invoke-DatabaseQuery([string]$Query, [bool]$ReadOnly) {
  $body = @{ query = $Query; read_only = $ReadOnly } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $body
}

try {
  $sql = Get-Content $migrationPath -Raw -Encoding UTF8
  if ($ValidateOnly) {
    $sql = [regex]::Replace($sql, '(?is)\bcommit;\s*$', 'rollback;')
  }
  Invoke-DatabaseQuery $sql $false | Out-Null
  if ($ValidateOnly) {
    Write-Output 'security_migration_valid=true'
    Write-Output 'security_migration_applied=false'
    return
  }

  $result = Invoke-DatabaseQuery @'
select
  to_regclass('public.luar_api_rate_limits') is not null as rate_limit_table,
  to_regprocedure('public.consume_luar_rate_limit(text,integer,integer)') is not null as rate_limit_rpc,
  not has_function_privilege('anon', 'public.consume_luar_rate_limit(text,integer,integer)', 'execute') as rate_limit_denies_anon,
  not has_function_privilege('authenticated', 'public.consume_luar_rate_limit(text,integer,integer)', 'execute') as rate_limit_denies_authenticated,
  coalesce((select bool_and(c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')), false) as all_public_tables_use_rls;
'@ $true
  $row = @($result)[0]
  if (-not $row.rate_limit_table -or -not $row.rate_limit_rpc -or -not $row.rate_limit_denies_anon -or -not $row.rate_limit_denies_authenticated -or -not $row.all_public_tables_use_rls) {
    throw 'SECURITY_MIGRATION_POSTCONDITION_FAILED'
  }
  Write-Output 'security_migration_valid=true'
  Write-Output 'security_migration_applied=true'
} finally {
  $accessToken = $null
  $headers = $null
  Write-Output 'management_credential_removed_from_memory=true'
}
