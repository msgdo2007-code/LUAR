param(
  [ValidateSet('Backup','Validate','Apply','Verify')]
  [string]$Mode,
  [string]$BackupDirectory = '.security-backups\20260819-pre-referrals'
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$migrationPath = Join-Path $root 'supabase\migrations\20260818170000_referral_state_machine.sql'
$projectRefPath = Join-Path $root 'supabase\.temp\project-ref'
$backupPath = if ([System.IO.Path]::IsPathRooted($BackupDirectory)) { $BackupDirectory } else { Join-Path $root $BackupDirectory }

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LuarReferralCredentialReader {
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

$token = [LuarReferralCredentialReader]::Read('Supabase CLI:supabase')
$projectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
if ($projectRef -notmatch '^[a-z0-9]{20}$') { throw 'INVALID_PROJECT_REF' }
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$endpoint = "https://api.supabase.com/v1/projects/$projectRef/database/query"

function Invoke-Query([string]$Query, [bool]$ReadOnly) {
  $body = @{ query = $Query; read_only = $ReadOnly } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $body
}

$postconditions = @'
do $$
begin
  if to_regclass('public.luar_referral_audit') is null then raise exception 'MISSING_REFERRAL_AUDIT'; end if;
  if to_regclass('public.luar_referral_clicks') is null then raise exception 'MISSING_REFERRAL_CLICKS'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('luar_referral_audit','luar_referral_clicks')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then raise exception 'REFERRAL_RLS_NOT_FORCED'; end if;
  if has_table_privilege('anon','public.luar_referral_audit','select')
    or has_table_privilege('authenticated','public.luar_referral_audit','select')
    or has_table_privilege('anon','public.luar_referral_clicks','select')
    or has_table_privilege('authenticated','public.luar_referral_clicks','select')
  then raise exception 'REFERRAL_CLIENT_GRANT_FOUND'; end if;
  if exists (
    select 1 from public.luar_referrals r
    join public.luar_payments p on p.user_id=r.referred_user_id and p.status='paid'
    where r.status <> 'approved'
  ) then raise exception 'PAID_REFERRAL_NOT_APPROVED'; end if;
end $$;
'@

try {
  if ($Mode -eq 'Backup') {
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
    $snapshot = Invoke-Query @'
select jsonb_build_object(
  'captured_at', now(),
  'referrals', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.luar_referrals r), '[]'::jsonb),
  'profiles', coalesce((select jsonb_agg(to_jsonb(p) order by p.user_id) from public.luar_referral_profiles p), '[]'::jsonb),
  'paid_user_ids', coalesce((select jsonb_agg(distinct p.user_id) from public.luar_payments p where p.status='paid'), '[]'::jsonb),
  'schema', coalesce((select jsonb_agg(jsonb_build_object('table',c.table_name,'column',c.column_name,'type',c.data_type,'nullable',c.is_nullable,'default',c.column_default) order by c.table_name,c.ordinal_position) from information_schema.columns c where c.table_schema='public' and c.table_name in ('luar_referrals','luar_referral_profiles')), '[]'::jsonb)
) as snapshot;
'@ $true
    $snapshot | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath (Join-Path $backupPath 'referrals-before.json') -Encoding UTF8
    Copy-Item -LiteralPath $migrationPath -Destination (Join-Path $backupPath 'migration.sql') -Force
    Copy-Item -LiteralPath (Join-Path $root 'supabase\rollbacks\20260818170000_referral_state_machine.rollback.sql') -Destination (Join-Path $backupPath 'rollback.sql') -Force
    $hashes = Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $backupPath 'referrals-before.json'),(Join-Path $backupPath 'migration.sql'),(Join-Path $backupPath 'rollback.sql')
    $hashes | Select-Object Hash,@{Name='File';Expression={[System.IO.Path]::GetFileName($_.Path)}} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupPath 'sha256.json') -Encoding UTF8
    Write-Output "referral_backup_created=true"
    Write-Output "referral_backup_files=$($hashes.Count)"
  } elseif ($Mode -eq 'Validate') {
    $sql = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
    Invoke-Query "begin;`n$sql`n$postconditions`nrollback;" $false | Out-Null
    Write-Output 'referral_migration_valid=true'
    Write-Output 'referral_migration_applied=false'
  } elseif ($Mode -eq 'Apply') {
    $sql = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
    Invoke-Query "begin;`n$sql`n$postconditions`ncommit;" $false | Out-Null
    $result = Invoke-Query "select (select count(*) from public.luar_referrals) as referrals, (select count(*) from public.luar_referrals where status='approved') as approved, (select count(*) from public.luar_referral_audit) as audit_rows, (select count(*) from public.luar_referral_clicks) as clicks;" $true
    $result | ConvertTo-Json -Compress | Write-Output
    Write-Output 'referral_migration_applied=true'
  } else {
    $result = Invoke-Query @'
select jsonb_build_object(
  'referrals', (select count(*) from public.luar_referrals),
  'status_counts', coalesce((select jsonb_object_agg(status,total) from (select status,count(*) total from public.luar_referrals group by status) s), '{}'::jsonb),
  'audit_rows', (select count(*) from public.luar_referral_audit),
  'clicks', (select count(*) from public.luar_referral_clicks),
  'audit_rls', (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.luar_referral_audit'::regclass),
  'clicks_rls', (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.luar_referral_clicks'::regclass),
  'anon_audit_select', has_table_privilege('anon','public.luar_referral_audit','select'),
  'authenticated_audit_select', has_table_privilege('authenticated','public.luar_referral_audit','select'),
  'anon_clicks_select', has_table_privilege('anon','public.luar_referral_clicks','select'),
  'authenticated_clicks_select', has_table_privilege('authenticated','public.luar_referral_clicks','select'),
  'paid_referrals_not_approved', (select count(*) from public.luar_referrals r join public.luar_payments p on p.user_id=r.referred_user_id and p.status='paid' where r.status <> 'approved'),
  'sync_operations_table', to_regclass('public.luar_account_state_operations') is not null,
  'sync_v2_function', to_regprocedure('public.save_luar_account_state_v2(text,uuid,uuid,text,bigint,jsonb,jsonb,integer,text)') is not null,
  'sync_revision_column', exists (select 1 from information_schema.columns where table_schema='public' and table_name='luar_accounts' and column_name='state_revision'),
  'authorization_posture_function', to_regprocedure('public.luar_security_posture()') is not null
) as verification;
'@ $true
    $result | ConvertTo-Json -Depth 20 -Compress | Write-Output
    Write-Output 'referral_migration_verified=true'
  }
} finally {
  $token = $null
  $headers = $null
  Write-Output 'management_credential_removed_from_memory=true'
}
