TansoEum Collector - Windows EXE Build & Deploy
================================================

Place the built EXE here:
  public/downloads/TansoEum-Collector.exe

Served as: /downloads/TansoEum-Collector.exe


BUILD INSTRUCTIONS
------------------

IMPORTANT: Do NOT use --onefile. It extracts to %TEMP% at runtime and
Windows Defender frequently blocks the extracted Python DLLs, causing
"Failed to start embedded python interpreter!" errors.

Recommended build (--onedir):
  cd collector
  pip install pyinstaller
  pyinstaller --onedir --windowed --name TansoEum-Collector src/main.py

  Output: dist/TansoEum-Collector/ (folder with EXE + DLLs)
  Zip the folder and distribute.

If you must use --onefile, set a stable temp dir:
  pyinstaller --onefile --windowed --runtime-tmpdir "C:\EmsCollector\tmp" ^
    --name TansoEum-Collector src/main.py

If using GUI framework (tkinter/wx), keep --windowed.
For a headless Windows service, use --console to see startup errors.


TROUBLESHOOTING "Failed to start embedded python interpreter!"
--------------------------------------------------------------
1. Install VC++ 2019 Redistributable (x64) on the target machine:
   https://aka.ms/vs/17/release/vc_redist.x64.exe

2. Check Windows Defender exclusion:
   Add C:\EmsCollector\ to antivirus exclusions before running EXE.

3. Run from CMD first (even if built --windowed) to see error output:
   C:\EmsCollector\TansoEum-Collector.exe

4. Switch to --onedir build (most reliable on Windows).
