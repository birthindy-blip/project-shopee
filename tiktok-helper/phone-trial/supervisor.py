"""Restart a terminated dashboard, without owning any phone/UI operations."""
import json
import os
import subprocess
import sys
import time
import webbrowser
from urllib.request import ProxyHandler, build_opener
import queue_runtime as runtime

def healthy():
    try:
        with build_opener(ProxyHandler({})).open('http://127.0.0.1:8770/api/status', timeout=10) as response:
            state = json.load(response)
        return all(key in state for key in ('settings', 'phone', 'clips', 'job'))
    except (OSError, ValueError):
        return False

def run():
    with runtime.lease('supervisor.lock'):
        delay = 5
        while True:
            if healthy():
                time.sleep(15)
                continue
            log = runtime.HERE / 'server.log'
            if log.exists() and log.stat().st_size > 5_000_000:
                log.replace(runtime.HERE / 'server.previous.log')
            with log.open('a', encoding='utf-8') as output:
                output.write('\nStarting dashboard ' + time.strftime('%Y-%m-%d %H:%M:%S') + '\n')
                output.flush()
                started = time.monotonic()
                proc = subprocess.Popen([sys.executable, '-B', '-u', str(runtime.HERE / 'launch.py'), '--server'],
                    cwd=runtime.HERE, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
                    env={**os.environ, 'PYTHONUTF8':'1', 'PYTHONIOENCODING':'utf-8'})
                proc.wait()
            delay = 5 if time.monotonic() - started > 300 else min(60, delay * 2)
            time.sleep(delay)

if __name__ == '__main__':
    if '--open-browser' in sys.argv:
        webbrowser.open('http://127.0.0.1:8770/')
    try:
        run()
    except BlockingIOError:
        pass
