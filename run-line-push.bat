@echo off
cd /d "D:\Roy\Antigravity\etf-tracker"
echo [%date% %time%] Start LINE push script >> scripts\line-push.log
node --env-file=.env.local scripts\line-push.js >> scripts\line-push.log 2>&1
echo [%date% %time%] End LINE push script >> scripts\line-push.log
