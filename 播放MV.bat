@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 八千里路明月照 · 纯代码水墨 MV
where python >nul 2>nul
if %errorlevel%==0 (
  echo 正在本地端口 8123 启动一个小型服务器...
  start "" /min cmd /c "python -m http.server 8123 --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:8123/index.html"
) else (
  echo 未找到 Python，直接用浏览器打开本地文件...
  start "" "index.html"
)
exit
