@echo off
echo Starting Fitness Web Server...
echo.

:: 检查端口是否被占用
netstat -ano | findstr :8080 > nul
if %errorlevel% equ 0 (
    echo Port 8080 is in use. Trying to kill existing process...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
        taskkill /F /PID %%i
        if errorlevel 1 (
            echo Failed to kill process on port 8080. Please close manually.
            pause
            exit /b 1
        )
    )
)

:: 启动服务器
echo Starting Node.js server on http://localhost:8080...
node server.js 8080

echo Server started. Press Ctrl+C to stop.
pause