# Génère le sous-corpus audio (voix de synthèse Windows, fr-FR) puis le convertit
# en WebM/Opus 24 kb/s, le format qu'envoie Chrome depuis l'application.
# Prérequis : Windows avec les voix françaises Hortense / Julie / Paul, et ffmpeg.
#   pwsh -File ia/scripts/generer_audio.ps1   (PowerShell 7 : Windows PowerShell 5 ne voit pas toutes les voix)
# Les fichiers produits sont versionnés dans ia/data/audio : le notebook ne refait pas cette étape.

$ErrorActionPreference = "Stop"
$racine = Split-Path -Parent $PSScriptRoot
$sortie = Join-Path $racine "data\audio"
New-Item -ItemType Directory -Force $sortie | Out-Null
Add-Type -AssemblyName System.Speech

$voix = @("Microsoft Hortense Desktop", "Microsoft Julie", "Microsoft Paul")
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$manifeste = @()

$lignes = Get-Content (Join-Path $racine "data\vignettes.jsonl") -Encoding UTF8
for ($i = 0; $i -lt $lignes.Count; $i += 4) {
    $v = $lignes[$i] | ConvertFrom-Json
    $nomVoix = $voix[($i / 4) % $voix.Count]
    $wav = Join-Path $env:TEMP "$($v.id).wav"
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice($nomVoix)
    $synth.SetOutputToWaveFile($wav, $format)
    $synth.Speak($v.texte)
    $synth.Dispose()
    ffmpeg -loglevel error -y -i $wav -c:a libopus -b:a 24k (Join-Path $sortie "$($v.id).webm")
    Remove-Item $wav
    $manifeste += [pscustomobject]@{ id = $v.id; voix = $nomVoix }
}
$manifeste | ConvertTo-Json | Set-Content (Join-Path $sortie "manifeste.json") -Encoding UTF8
Write-Output "$($manifeste.Count) fichiers audio générés dans $sortie"
