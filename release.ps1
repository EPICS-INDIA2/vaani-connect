param(
    [Parameter(Position = 0)]
    [ValidateSet("patch", "minor", "major")]
    [string]$BumpType,

    [Parameter(Position = 1)]
    [string]$CommitMessage
)

$ErrorActionPreference = "Stop"

if (-not $BumpType) {
    Write-Host 'Usage: .\release.ps1 [patch|minor|major] "commit message"'
    exit 1
}

$versionPath = Join-Path $PSScriptRoot "VERSION"
if (-not (Test-Path $versionPath)) {
    Set-Content -Path $versionPath -Value "0.0.0"
}

$currentVersion = (Get-Content $versionPath -Raw).Trim()
$parts = $currentVersion.Split(".")
if ($parts.Count -ne 3) {
    throw "VERSION must be in MAJOR.MINOR.PATCH format. Found: $currentVersion"
}

[int]$major = $parts[0]
[int]$minor = $parts[1]
[int]$patch = $parts[2]

switch ($BumpType) {
    "patch" {
        $patch += 1
    }
    "minor" {
        $minor += 1
        $patch = 0
    }
    "major" {
        $major += 1
        $minor = 0
        $patch = 0
    }
}

$newVersion = "$major.$minor.$patch"
$tag = "v$newVersion"

Set-Content -Path $versionPath -Value $newVersion

git add .
git add VERSION

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = "Release $tag"
}

git commit -m $CommitMessage
git tag -a $tag -m "Release $tag"
git push origin main
git push origin $tag

Write-Host "Released $tag successfully."
