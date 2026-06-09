$source = "C:\Users\10466\lora-tag-inspector\dist\lora-tag-inspector"
$dest = "C:\Users\10466\lora-tag-inspector-v1.5-standalone.zip"
Write-Host "Source: $source"
Write-Host "Dest: $dest"
if (Test-Path $source) {
    Compress-Archive -LiteralPath $source -DestinationPath $dest -CompressionLevel Optimal -Force
    if (Test-Path $dest) {
        $size = (Get-Item $dest).Length / 1MB
        Write-Host "SUCCESS: $dest ($([math]::Round($size, 1)) MB)"
    } else {
        Write-Host "FAILED: zip not created"
    }
} else {
    Write-Host "FAILED: source not found at $source"
}
