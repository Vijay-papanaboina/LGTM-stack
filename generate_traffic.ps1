# ============================================================
# TRAFFIC GENERATOR - High Volume Edition
# ============================================================
# This script sends various requests to the sample-app
# to generate Traces, Logs, and Metrics for visualization.
#
# Usage:
#   .\generate_traffic.ps1           # Default: 500ms interval
#   .\generate_traffic.ps1 -Fast     # Fast: 100ms interval
#   .\generate_traffic.ps1 -Burst    # Burst: 10 parallel requests
# ============================================================

param(
    [switch]$Fast,
    [switch]$Burst
)

$BaseUrl = "http://142.93.222.124:30800"
$Interval = if ($Fast) { 0.1 } elseif ($Burst) { 0.5 } else { 0.5 }

Write-Host "🚀 Starting Traffic Generator (High Volume)..." -ForegroundColor Cyan
Write-Host "   Target: $BaseUrl"
Write-Host "   Interval: $($Interval * 1000)ms"
Write-Host "   Mode: $(if ($Burst) { 'BURST (10 parallel)' } elseif ($Fast) { 'FAST' } else { 'NORMAL' })"
Write-Host "   Press Ctrl+C to stop"
Write-Host ""

function Send-Request {
    param (
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = @{}
    )

    $Uri = "$BaseUrl$Endpoint"
    try {
        if ($Method -eq "POST") {
            $Response = Invoke-WebRequest -Uri $Uri -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop -TimeoutSec 10
            return $Response
        } else {
            $Response = Invoke-WebRequest -Uri $Uri -Method $Method -ErrorAction Stop -TimeoutSec 10
            return $Response
        }
    } catch {
        return $_.Exception.Response
    }
}

$Count = 0

while ($true) {
    $Count++

    if ($Burst) {
        # Burst mode: 10 parallel order requests
        Write-Host "[$Count] Sending BURST of 10 orders..." -ForegroundColor Magenta
        1..10 | ForEach-Object -Parallel {
            $BaseUrl = $using:BaseUrl
            try {
                Invoke-WebRequest -Uri "$BaseUrl/api/slow" -Method GET -ErrorAction SilentlyContinue -TimeoutSec 10 | Out-Null
            } catch {}
        } -ThrottleLimit 10
        Write-Host "   ✅ Burst complete" -ForegroundColor Green
    } else {
        # Normal/Fast mode: sequential requests
        Write-Host "[$Count] Sending requests..." -ForegroundColor Yellow -NoNewline

        # Order (chain: gateway -> order -> payment)
        $Order = Send-Request -Endpoint "/api/order" -Method "POST" -Body @{ total = Get-Random -Min 10 -Max 200 }
        
        # Fast endpoint
        Send-Request -Endpoint "/api/fast" | Out-Null
        
        # Additional fast requests for more volume
        Send-Request -Endpoint "/api/fast" | Out-Null
        Send-Request -Endpoint "/api/fast" | Out-Null

        # Slow endpoint every 5th iteration
        if ($Count % 5 -eq 0) {
            Send-Request -Endpoint "/api/slow" | Out-Null
        }

        # Error endpoint every 7th iteration
        if ($Count % 7 -eq 0) {
            Send-Request -Endpoint "/api/error" | Out-Null
        }

        $status = if ($Order.StatusCode -eq 200) { " ✓" } else { " ✗" }
        Write-Host $status -ForegroundColor $(if ($Order.StatusCode -eq 200) { "Green" } else { "Red" })
    }

    Start-Sleep -Seconds $Interval
}

