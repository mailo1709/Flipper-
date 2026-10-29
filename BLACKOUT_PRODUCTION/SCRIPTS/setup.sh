#!/usr/bin/env bash
# Einrichtung der Produktionsumgebung (kostenlos, ohne Konto). Mehrfach ausführbar.
set -e
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null || { echo "FFmpeg fehlt: sudo apt-get install -y ffmpeg"; exit 1; }
python3 -m pip install -q -r requirements.txt
M=../VOICE/models
mkdir -p "$M"
for v in thorsten karlsson kerstin; do
  if [ ! -f "$M/$v/de-$v-low.onnx" ]; then
    mkdir -p "$M/$v"
    curl -sSL "https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-$v-low.tar.gz" | tar xz -C "$M/$v"
  fi
done
python3 -c "import voices; print('Stimmen-Engines:', voices.available())"
echo "Einrichtung fertig. Produktion: python3 extract_images.py && python3 produce.py 1 && python3 produce.py 2 && python3 drehbuch_export.py"
