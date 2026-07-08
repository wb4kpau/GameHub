# Skrip PowerShell Web Server untuk GameHub
# Menjalankan server lokal di http://localhost:8080/

$port = 8080
$rootDir = $PSScriptRoot

if ([string]::IsNullOrEmpty($rootDir)) {
    $rootDir = Get-Location
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

Write-Host "Memulai server di http://localhost:$port/ ..."
try {
    $listener.Start()
    Write-Host "Server berhasil dijalankan! Buka http://localhost:$port/ di browser Anda."
    Write-Host "Tekan Ctrl+C untuk menghentikan server di terminal."
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }
        
        $relativePath = $urlPath.Replace("/", "\").TrimStart('\')
        $filePath = [System.IO.Path]::Combine($rootDir, $relativePath)

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".webp" { "image/webp" }
                ".svg"  { "image/svg+xml" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".json" { "application/json; charset=utf-8" }
                default { "application/octet-stream" }
            }
            
            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
                $errMsg = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: $_")
                $response.OutputStream.Write($errMsg, 0, $errMsg.Length)
            }
        } else {
            $response.StatusCode = 404
            $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: Halaman/berkas tidak ditemukan.")
            $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
        }
        $response.Close()
    }
} catch {
    Write-Error "Terjadi kesalahan pada server: $_"
} finally {
    if ($listener -ne $null) {
        $listener.Stop()
        Write-Host "Server dihentikan."
    }
}
