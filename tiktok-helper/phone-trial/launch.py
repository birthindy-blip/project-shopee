"""Launch only this standalone workspace copy."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

if __name__ == '__main__':
    if '--server' in sys.argv:
        import poster_app
        poster_app.PORT = 8770
        sys.argv = [str(HERE / 'poster_app.py'), '--no-browser']
        poster_app.main()
    else:
        python = Path(sys.executable)
        hidden = python.with_name('pythonw.exe') if sys.platform == 'win32' else python
        args = [str(hidden if hidden.exists() else python), '-B', str(HERE / 'supervisor.py')]
        if '--open-browser' in sys.argv:
            args.append('--open-browser')
        flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP) if sys.platform == 'win32' else 0
        subprocess.Popen(args, cwd=HERE, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, creationflags=flags,
                         start_new_session=sys.platform != 'win32', close_fds=True)
