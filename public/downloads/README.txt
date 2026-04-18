TansoEum Collector - Windows EXE Build & Deploy
================================================

Place the built EXE here:
  public/downloads/TansoEum-Collector.exe

Served as: /downloads/TansoEum-Collector.exe


BUILD INSTRUCTIONS
------------------

Use the spec file (--onefile with stable runtime_tmpdir):

  cd collector
  pip install pyinstaller
  pyinstaller TansoEum-Collector.spec

  Output: dist\TansoEum-Collector.exe  (single file)
  Copy to: public/downloads/TansoEum-Collector.exe

The spec sets runtime_tmpdir to C:\TansoEum\runtime to avoid
Windows Defender blocking extraction from %TEMP%.


USER INSTALLATION GUIDE
------------------------

1. Download TansoEum-Collector.exe and config.yaml
2. Place BOTH files in C:\TansoEum\ folder
3. Add C:\TansoEum\ to antivirus exclusion list
   (Windows Security → Virus & threat protection →
    Exclusions → Add an exclusion → Folder → C:\TansoEum\)
4. Run TansoEum-Collector.exe


TROUBLESHOOTING
---------------

"Failed to load Python DLL ... python313.dll"
  → The EXE was built with --onedir but _internal folder is missing.
  → Rebuild using TansoEum-Collector.spec (--onefile).

"Failed to start embedded python interpreter!"
  → Windows Defender blocked extraction.
  → Add C:\TansoEum\ to antivirus exclusions and retry.

VC++ Runtime error:
  → Install: https://aka.ms/vs/17/release/vc_redist.x64.exe
