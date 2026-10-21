"""Start the supervised dashboard on this user's Windows sign-in."""
from pathlib import Path
import subprocess
import sys

ENTRY = 'ShopeeAutoPostPhoneTrial8770'
RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
HERE = Path(__file__).resolve().parent

def command():
    python = Path(sys.executable).with_name('pythonw.exe')
    if not python.exists():
        python = Path(sys.executable)
    return subprocess.list2cmdline([str(python), '-B', str(HERE / 'launch.py')])

def install():
    import winreg
    value = command()
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_QUERY_VALUE | winreg.KEY_SET_VALUE) as key:
        try:
            previous, _ = winreg.QueryValueEx(key, ENTRY)
        except FileNotFoundError:
            previous = ''
        if previous and str(HERE / 'launch.py').lower() not in previous.lower():
            raise RuntimeError('Startup entry belongs to another installation')
        winreg.SetValueEx(key, ENTRY, 0, winreg.REG_SZ, value)
        assert winreg.QueryValueEx(key, ENTRY)[0] == value
    print('Enabled supervised Shopee dashboard on Windows sign-in for the current user.')

if __name__ == '__main__':
    install()
