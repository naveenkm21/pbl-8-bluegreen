@echo off
REM Manual rollback script — flips the live Service selector back to BLUE.
REM Usage:  rollback.bat            (rollback to blue)
REM         rollback.bat green      (force traffic to green)

set TARGET=%1
if "%TARGET%"=="" set TARGET=blue

echo Switching myapp-service selector to version=%TARGET% ...
kubectl patch service myapp-service -p "{\"spec\":{\"selector\":{\"app\":\"myapp\",\"version\":\"%TARGET%\"}}}"
kubectl get service myapp-service -o wide
echo Done. Visit http://localhost:30008
