# PowerShell脚本启动服务器
Write-Host "Starting Fitness Web Server..." -ForegroundColor Green
Write-Host ""

# 检查端口是否被占用
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 8080 is in use. Killing existing process..." -ForegroundColor Yellow
    $portInUse | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

# 在后台启动服务器
Write-Host "Starting Node.js server in background on http://localhost:8080..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock {
    cd $using:PWD
    node server.js 8080
}

Write-Host "Server started in background!" -ForegroundColor Green
Write-Host "To stop server, run: Stop-Job -Id $($job.Id)" -ForegroundColor Yellow
Write-Host "To view server output, run: Receive-Job -Id $($job.Id)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening browser to http://localhost:8080..." -ForegroundColor Cyan
Start-Process "http://localhost:8080"