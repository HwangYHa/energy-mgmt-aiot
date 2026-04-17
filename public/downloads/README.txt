탄소이음 Collector — Windows EXE 배포 위치
==========================================

이 폴더에 빌드된 EXE 파일을 배치하세요:
  TansoEum-Collector.exe

빌드 방법:
  cd collector
  pip install pyinstaller
  pyinstaller --onefile --windowed --name TansoEum-Collector src/main.py

배치 후 /downloads/TansoEum-Collector.exe 로 정적 파일 서빙됩니다.
