Set-Location d:\Offlinely
npx localtunnel --port 8080 *>&1 | Tee-Object -FilePath d:\Offlinely\lt.log
