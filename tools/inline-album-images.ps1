[CmdletBinding()]
param(
    [string]$AlbumPath = "album.html",
    [string]$PhotosDir = "fotos",
    [string]$OptimizedDirName = "otimizadas"
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) {
        return (Resolve-Path -LiteralPath $path).Path
    }

    $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    return (Join-Path $repoRoot $path)
}

function Get-MimeType([string]$filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    switch ($ext) {
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".webp" { return "image/webp" }
        ".png" { return "image/png" }
        ".gif" { return "image/gif" }
        default { return "application/octet-stream" }
    }
}

$albumFullPath = Resolve-RepoPath $AlbumPath
$photosFullPath = Resolve-RepoPath $PhotosDir
$optimizedFullPath = Join-Path $photosFullPath $OptimizedDirName
$photosHtmlPrefix = ($PhotosDir -replace "\\\\", "/").TrimEnd("/")

if (-not (Test-Path -LiteralPath $albumFullPath)) {
    throw "Arquivo não encontrado: $albumFullPath"
}

if (-not (Test-Path -LiteralPath $photosFullPath)) {
    throw "Pasta de fotos não encontrada: $photosFullPath"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$htmlBytes = [System.IO.File]::ReadAllBytes($albumFullPath)
$html = $utf8NoBom.GetString($htmlBytes)

# Remove `srcset`/`sizes` para não depender de arquivos externos (ex.: fotos/otimizadas/).
$html = [regex]::Replace($html, '\s+srcset="[^"]*"', '')
$html = [regex]::Replace($html, '\s+sizes="[^"]*"', '')

$cache = @{}
$missing = New-Object System.Collections.Generic.List[string]

$pattern = 'src="' + [regex]::Escape($photosHtmlPrefix) + '/([^"]+)"'
$html = [regex]::Replace($html, $pattern, {
    param($match)

    $fileName = $match.Groups[1].Value

    if ($cache.ContainsKey($fileName)) {
        return "src=`"$($cache[$fileName])`""
    }

    $srcPath = Join-Path $photosFullPath $fileName
    $optimizedPath = Join-Path $optimizedFullPath $fileName

    # Se existir uma versão otimizada com o mesmo nome, use ela para reduzir o tamanho do HTML.
    $embedPath = if (Test-Path -LiteralPath $optimizedPath) { $optimizedPath } else { $srcPath }

    if (-not (Test-Path -LiteralPath $embedPath)) {
        $missing.Add($embedPath) | Out-Null
        return $match.Value
    }

    $mime = Get-MimeType $embedPath
    $bytes = [System.IO.File]::ReadAllBytes($embedPath)
    $b64 = [System.Convert]::ToBase64String($bytes)
    $dataUri = "data:$mime;base64,$b64"

    $cache[$fileName] = $dataUri
    return "src=`"$dataUri`""
})

if ($missing.Count -gt 0) {
    Write-Warning ("Algumas imagens não foram encontradas:`n" + ($missing -join "`n"))
}

[System.IO.File]::WriteAllText($albumFullPath, $html, $utf8NoBom)

Write-Host "OK: $($cache.Count) imagens embutidas em $albumFullPath"
