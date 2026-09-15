param(
    [switch]$Apply,
    [switch]$DeleteLegacyJunctionWork
)

$ErrorActionPreference = 'Stop'

$Canonical = 'chatgpt/unity-csharp-migration'
$CurrentDefault = 'claude/massrpg-procedural-game-sossii'

# Audited 2026-09-16 against the canonical Unity migration branch. Every branch in
# this list was an ancestor of the canonical branch (or identical to it), so it has
# no unique commit that would be lost by deletion.
$SafeBranches = @(
    'DO_NOT_USE',
    'chatgpt/editor-storage-perf',
    'chatgpt/unity-csharp-migration-batch',
    'chatgpt/unity-csharp-migration-batch2',
    'chatgpt/unity-csharp-migration-foundations',
    'chatgpt/unity-csharp-migration-temp',
    'chatgpt/unity-csharp-migration-work',
    'chatgpt/unity-csharp-migration-work-2',
    'chatgpt/unity-csharp-migration-work-3',
    'claude/massrpg-character-assets-stage',
    'claude/massrpg-character-assets-stage2',
    'claude/massrpg-character-assets-stage3',
    'claude/massrpg-character-assets-stage4',
    'claude/massrpg-character-assets-stage5',
    'claude/massrpg-character-assets-stage6',
    'ignore-me',
    'junction-builder-20260912b',
    'junction-builder-20260912',
    'junction-builder-final',
    'junction-builder-run',
    'junction-builder-x',
    'temp-junction-work',
    'test-bad',
    'tmp',
    'ugh',
    'zzz'
)

# This branch is deliberately separate from the automatic safe list. It has four
# unique browser-renderer/editor commits at head 115bf2265a7b13cc7a349cbd9c6d74b49badc746.
# They are an abandoned pre-Unity wall/fence junction experiment and are not part
# of the canonical migration. Pass -DeleteLegacyJunctionWork to remove it too.
$LegacyDivergedBranch = 'junction-builder-work'
$LegacyDivergedHead = '115bf2265a7b13cc7a349cbd9c6d74b49badc746'

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    & git @Arguments
    $code = $LASTEXITCODE
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "git $($Arguments -join ' ') failed with exit code $code"
    }
    return $code
}

if (-not (Test-Path '.git')) {
    throw 'Run this script from the root of the MassRPG Git working tree.'
}

Invoke-Git -Arguments @('fetch', 'origin', '--prune') | Out-Null
Invoke-Git -Arguments @('rev-parse', '--verify', "origin/$Canonical") | Out-Null

Write-Host "Canonical branch: $Canonical"
if ($Apply) {
    Write-Host 'Mode: APPLY (remote branches will be deleted)'
}
else {
    Write-Host 'Mode: DRY RUN (nothing will be deleted)'
}
Write-Host ''

foreach ($branch in $SafeBranches) {
    & git show-ref --verify --quiet "refs/remotes/origin/$branch"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[already gone] $branch"
        continue
    }

    & git merge-base --is-ancestor "origin/$branch" "origin/$Canonical"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "SKIP $branch : it is no longer an ancestor of $Canonical. Review it manually."
        continue
    }

    if ($Apply) {
        Write-Host "[delete] $branch"
        Invoke-Git -Arguments @('push', 'origin', '--delete', $branch) | Out-Null
    }
    else {
        Write-Host "[would delete] $branch"
    }
}

if ($DeleteLegacyJunctionWork) {
    & git show-ref --verify --quiet "refs/remotes/origin/$LegacyDivergedBranch"
    if ($LASTEXITCODE -eq 0) {
        $actualHead = (& git rev-parse "origin/$LegacyDivergedBranch").Trim()
        if ($actualHead -ne $LegacyDivergedHead) {
            Write-Warning "SKIP $LegacyDivergedBranch : head changed from audited commit $LegacyDivergedHead to $actualHead."
        }
        elseif ($Apply) {
            Write-Host "[delete audited legacy experiment] $LegacyDivergedBranch"
            Invoke-Git -Arguments @('push', 'origin', '--delete', $LegacyDivergedBranch) | Out-Null
        }
        else {
            Write-Host "[would delete audited legacy experiment] $LegacyDivergedBranch"
        }
    }
}
else {
    Write-Host "[kept for explicit confirmation] $LegacyDivergedBranch ($LegacyDivergedHead)"
}

Write-Host ''
Write-Host "Kept: $Canonical"
Write-Host "Kept: $CurrentDefault (GitHub currently requires the default branch to exist)"
Write-Host 'After GitHub default-branch setting is changed to the canonical branch, the old default can also be deleted.'

if (-not $Apply) {
    Write-Host ''
    Write-Host 'Dry run complete. Re-run with -Apply after reviewing the list.'
    Write-Host 'Add -DeleteLegacyJunctionWork if you also want the audited abandoned junction experiment removed.'
}
