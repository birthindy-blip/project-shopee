#!/usr/bin/env python3
"""Local Shopee Video dashboard and interactive CLI bridge."""
import json
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from urllib.request import ProxyHandler, build_opener
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shopee_poster as sp
import product_identity as products
import phone_inventory as phones

HERE = Path(__file__).resolve().parent
PORT = 8765
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.RLock()
JOB = {'running': False, 'kind': '', 'state': 'idle', 'prompt': None, 'logs': [], 'basket': None, 'prepared': None}
PROCESS = None
VERIFIED = {}

def worker(kind):
    wire = sys.stdout
    def emit(event):
        wire.write(json.dumps(event, ensure_ascii=False) + '\n')
        wire.flush()
    class LogStream:
        def __init__(self):
            self.pending = ''
        def write(self, text):
            self.pending += text.replace('\r', '\n')
            while '\n' in self.pending:
                line, self.pending = self.pending.split('\n', 1)
                if line.strip():
                    emit({'log': line})
            return len(text)
        def flush(self):
            if self.pending.strip():
                emit({'log': self.pending})
            self.pending = ''
    output = LogStream()
    sys.stdout = output
    sys.stderr = output
    def ask(prompt):
        # The dashboard's Start click already authorizes the initial queue start.
        if 'กด Enter เพื่อเริ่ม (q = ยกเลิก)' in prompt:
            return ''
        output.flush()
        emit({'prompt': prompt})
        answer = sys.stdin.readline()
        if not answer:
            raise sp.Quit()
        return answer.rstrip('\r\n')
    try:
        settings = json.loads(os.environ['SHOPEE_JOB_SETTINGS']) if os.environ.get('SHOPEE_JOB_SETTINGS') else sp.load_settings()
        settings['_product_callback'] = lambda result: emit({'basket': result})
        preparation = []
        def on_prepared(result):
            preparation.append(result)
            emit({'prepared': result})
        settings['_prepared_callback'] = on_prepared
        if kind == 'prepare':
            settings['_prepare_only'] = True
            settings['auto_post'] = False
            settings['_clip_key'] = os.environ.get('SHOPEE_CLIP_KEY', '')
        if kind == 'products':
            clips, _ = sp.scan_clips(settings['clips_folder'])
            posted = sp.load_posted()
            success = True
            for clip in clips:
                if clip.key in posted['items']:
                    continue
                result = products.remember(products.resolve_link(clip.info['link']))
                success = success and result['status'] == 'resolved'
                print(f'🔎 {clip.name}')
                print(f'✅ Item ID {result["item_id"]} · Shop ID {result["shop_id"]}' if result['status'] == 'resolved' else '⚠ ' + result['error'])
            output.flush()
            emit({'result': 'done' if success else 'failed'})
            return 0 if success else 1
        if kind in ('check', 'basket'):
            dev = sp.connect(settings)
            if not dev:
                emit({'result': 'failed'})
                return 1
            installed = sp.PKG in dev.shell('pm list packages ' + sp.PKG)
            size, nodes = sp.screen(dev)
            print('✅ เจอแอป Shopee' if installed else '❌ ยังไม่พบแอป Shopee')
            print(f'✅ อ่านหน้าจอได้ {len(nodes)} ชิ้น ({size[0]}×{size[1]})' if nodes else '❌ อ่านหน้าจอไม่ได้ — ปลดล็อกจอแล้วตรวจใหม่')
            output.flush()
            emit({'verified': {'serial': dev.d.serial, 'shopee': installed, 'screen': bool(nodes), 'checked_at': time.time()}})
            if kind == 'basket':
                if not installed or not nodes:
                    raise ValueError('ตรวจมือถือยังไม่ผ่าน')
                clips, _ = sp.scan_clips(settings['clips_folder'])
                clip = next((c for c in clips if c.key == os.environ.get('SHOPEE_CLIP_KEY')), None)
                if not clip:
                    raise ValueError('ไม่พบคลิปที่เลือกตรวจ')
                expected = products.remember(products.resolve_link(clip.info['link']))
                actual, method, error = sp.inspect_current_product(dev)
                result = sp.product_check(settings, expected, actual, method, error)
                result['clip_name'] = clip.name
                result['serial'] = dev.d.serial
                emit({'basket': result, 'result': 'done' if result['status'] == 'matched' else 'failed'})
                return 0 if result['status'] == 'matched' else 1
            emit({'result': 'done' if installed and nodes else 'failed'})
            return 0 if installed and nodes else 1
        sp.cmd_post(settings, sp.load_flow(settings), ask=ask)
        output.flush()
        emit({'result': ('prepared' if preparation else 'stopped') if kind == 'prepare' else 'done'})
        return 0
    except (sp.Quit, KeyboardInterrupt):
        print('⏹ หยุดแล้ว')
        output.flush()
        emit({'result': 'stopped'})
        return 0
    except Exception as exc:
        print(f'❌ {exc}')
        output.flush()
        emit({'result': 'failed'})
        return 1

def phone_state(refresh=False):
    settings = sp.read_json(sp.SETTINGS_FILE, {})
    return phones.selected_phone(phones.inventory(refresh), settings.get('serial', ''))

def status():
    settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
    clips, notes = sp.scan_clips(settings['clips_folder'])
    posted = sp.load_posted()
    phone = phone_state()
    with LOCK:
        ready_serials = {d['serial'] for d in phone['devices'] if d['state'] == 'device'}
        for serial in list(VERIFIED):
            if serial not in ready_serials:
                VERIFIED.pop(serial, None)
        verified = VERIFIED.get(phone['serial']) if phone['state'] == 'device' else None
        if verified and time.time() - verified.get('checked_at', 0) > 300:
            verified = None
        phone['checked'] = bool(verified)
        phone['shopee'] = bool(verified and verified['shopee'])
        phone['screen'] = bool(verified and verified['screen'])
        job = {**JOB, 'logs': list(JOB['logs'])}
    queue = []
    for clip in clips:
        history = posted['items'].get(clip.key, {})
        queue.append({'key': clip.key, 'name': clip.name, 'file': clip.video.name, 'size_mb': round(clip.video.stat().st_size / 1048576, 1),
                      'caption': clip.context(settings)['caption_full'], 'has_link': bool(clip.info['link']),
                      'has_text': bool(clip.txt), 'state': history.get('status', 'pending'),
                      'product': products.cached_identity(clip.info['link'])})
    pending = sum(c['state'] == 'pending' for c in queue)
    today = sp.posted_today(posted)
    products_ready = all(c['product']['status'] == 'resolved' for c in queue if c['state'] == 'pending')
    ready = phone['state'] == 'device' and phone['shopee'] and phone['screen'] and products_ready and pending > 0 and today < settings['daily_limit']
    return {'version': 'automatic-prepare-v3', 'instance_pid': os.getpid(),
            'settings': settings, 'phone': phone, 'clips': queue, 'pending': pending, 'today': today,
            'ready': ready, 'products_ready': products_ready, 'notes': notes, 'job': job,
            'folders': [str(Path.home() / 'Downloads' / 'ShopeeVideo'), str(HERE.parent.parent / 'ShopeeVideo')]}

def collect(proc):
    global PROCESS, VERIFIED
    result = None
    try:
        for line in proc.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                event = {'log': line.strip()}
            with LOCK:
                if PROCESS is not proc:
                    continue
                if 'log' in event:
                    JOB['logs'].append(event['log'])
                    JOB['logs'] = JOB['logs'][-500:]
                if 'prompt' in event:
                    JOB['prompt'] = event['prompt']
                    JOB['state'] = 'waiting'
                if 'verified' in event:
                    VERIFIED[event['verified']['serial']] = event['verified']
                if 'basket' in event:
                    JOB['basket'] = event['basket']
                if 'prepared' in event:
                    JOB['prepared'] = event['prepared']
                if 'result' in event:
                    result = event['result']
        code = proc.wait()
        with LOCK:
            if PROCESS is proc:
                JOB.update(running=False, state='stopped' if JOB['state'] == 'stopped' else result or ('done' if code == 0 else 'failed'), prompt=None)
                PROCESS = None
    except Exception as exc:
        with LOCK:
            if PROCESS is proc:
                JOB['logs'].append(str(exc))
                JOB.update(running=False, state='failed', prompt=None)
                PROCESS = None

def start_job(kind, clip_key=''):
    global PROCESS, VERIFIED
    if kind not in ('check', 'post', 'prepare', 'products', 'basket'):
        raise ValueError('คำสั่งไม่ถูกต้อง')
    with LOCK:
        if JOB['running']:
            raise ValueError('มีงานกำลังทำอยู่')
        settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
        phone = phone_state(refresh=True)
        if kind != 'products' and phone['state'] != 'device':
            raise ValueError(phone['message'])
        if kind in ('post', 'prepare') and not status()['ready']:
            raise ValueError('ต้องตรวจมือถือและรหัสสินค้าให้ผ่าน และมีคลิปใหม่ในคิวก่อนเริ่ม')
        if kind == 'basket' and not clip_key:
            raise ValueError('เลือกคลิปที่ต้องการเทียบรหัสสินค้าก่อน')
        settings['serial'] = phone['serial'] if kind != 'products' else settings.get('serial', '')
        if kind == 'check':
            VERIFIED.pop(phone['serial'], None)
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'PYTHONDONTWRITEBYTECODE': '1',
               'SHOPEE_JOB_SETTINGS': json.dumps(settings, ensure_ascii=False), 'SHOPEE_CLIP_KEY': clip_key}
        PROCESS = subprocess.Popen([sys.executable, '-B', '-u', str(HERE / 'poster_app.py'), '--worker', kind],
            cwd=HERE, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        JOB.update(running=True, kind=kind, state='running', prompt=None, logs=[], basket=None, prepared=None)
        threading.Thread(target=collect, args=(PROCESS,), daemon=True).start()

def save_settings(data):
    with LOCK:
        if JOB['running']:
            raise ValueError('หยุดงานก่อนเปลี่ยนการตั้งค่า')
        settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
        folder = Path(str(data.get('clips_folder', settings['clips_folder']))).expanduser().resolve()
        if not folder.is_dir():
            raise ValueError('ไม่พบโฟลเดอร์คลิป')
        limit = data.get('daily_limit', settings['daily_limit'])
        delay = data.get('delay_minutes', settings['delay_minutes'])
        mode = data.get('auto_post', settings['auto_post'])
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('จำนวนคลิปต่อวันต้องเป็น 1–100')
        if type(mode) is not bool:
            raise ValueError('โหมดโพสต์ไม่ถูกต้อง')
        if not isinstance(delay, list) or len(delay) != 2 or any(type(x) not in (int, float) for x in delay) or not 0 <= delay[0] <= delay[1] <= 1440:
            raise ValueError('ช่วงพักต้องเป็นตัวเลข 0–1440 นาที และค่าน้อยต้องมาก่อน')
        settings.update(clips_folder=str(folder), daily_limit=limit, auto_post=mode, delay_minutes=delay)
        sp.write_json(sp.SETTINGS_FILE, settings)


def select_device(serial):
    with LOCK:
        if JOB['running']:
            raise ValueError('หยุดงานก่อนเปลี่ยนมือถือ')
        if not isinstance(serial, str) or len(serial) > 200:
            raise ValueError('หมายเลขเครื่องไม่ถูกต้อง')
        data = phones.inventory(refresh=True)
        if serial and not any(d['serial'] == serial for d in data['devices']):
            raise ValueError('เครื่องนี้ไม่ได้เชื่อมต่อ — อัปเดตรายชื่อแล้วเลือกใหม่')
        settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
        settings['serial'] = serial
        sp.write_json(sp.SETTINGS_FILE, settings)
        VERIFIED.pop(serial, None)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def trusted_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')
    def send(self, code, body, mime='application/json; charset=utf-8'):
        raw = body.encode('utf-8') if isinstance(body, str) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if not self.trusted_host():
            return self.send(403, {'error': 'Host denied'})
        try:
            if self.path == '/':
                return self.send(200, (HERE / 'ui.html').read_text(encoding='utf-8-sig').replace('__APP_TOKEN__', TOKEN), 'text/html; charset=utf-8')
            if self.path == '/api/status':
                return self.send(200, status())
            return self.send(404, {'error': 'Not found'})
        except Exception as exc:
            self.send(500, {'error': str(exc)})
    def do_POST(self):
        if not self.trusted_host() or not secrets.compare_digest(self.headers.get('X-App-Token', ''), TOKEN):
            return self.send(403, {'error': 'Access denied'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size > 16384:
                raise ValueError('คำขอใหญ่เกินไป')
            data = json.loads(self.rfile.read(size) or b'{}')
            if self.path == '/api/start':
                start_job(data.get('kind'), data.get('clip_key', ''))
            elif self.path == '/api/settings':
                save_settings(data)
            elif self.path == '/api/device':
                select_device(data.get('serial', ''))
            elif self.path == '/api/refresh':
                phones.inventory(refresh=True)
            elif self.path == '/api/answer':
                with LOCK:
                    if not PROCESS or not JOB['prompt']:
                        raise ValueError('ไม่มีคำถามที่รอตอบ')
                    answer = str(data.get('answer', ''))
                    if '\n' in answer or '\r' in answer:
                        raise ValueError('คำตอบต้องเป็นบรรทัดเดียว')
                    PROCESS.stdin.write(answer + '\n')
                    PROCESS.stdin.flush()
                    JOB.update(prompt=None, state='running')
            elif self.path == '/api/stop':
                with LOCK:
                    if PROCESS:
                        PROCESS.terminate()
                        JOB.update(state='stopped', prompt=None)
            else:
                return self.send(404, {'error': 'Not found'})
            self.send(200, {'ok': True})
        except ValueError as exc:
            self.send(400, {'error': str(exc)})
        except Exception as exc:
            self.send(500, {'error': str(exc)})

def main():
    sp.load_settings()
    try:
        with socket.create_connection(('127.0.0.1', PORT), timeout=0.5):
            occupied = True
    except OSError:
        occupied = False
    if occupied:
        try:
            with build_opener(ProxyHandler({})).open(f'http://127.0.0.1:{PORT}/api/status', timeout=3) as response:
                existing = json.load(response)
            if not all(key in existing for key in ('settings', 'phone', 'clips', 'job')):
                raise ValueError('พอร์ตนี้มีโปรแกรมอื่นใช้อยู่')
        except Exception:
            raise RuntimeError(f'เปิด UI ไม่ได้ — พอร์ต {PORT} มีโปรแกรมอื่นใช้อยู่') from None
        print(f'Shopee Video is already running: http://127.0.0.1:{PORT}', flush=True)
        if '--no-browser' not in sys.argv:
            webbrowser.open(f'http://127.0.0.1:{PORT}')
        return
    class LocalServer(ThreadingHTTPServer):
        allow_reuse_address = False
        allow_reuse_port = False
    server = LocalServer(('127.0.0.1', PORT), Handler, bind_and_activate=False)
    try:
        if os.name == 'nt':
            server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        server.server_bind()
        server.server_activate()
    except OSError:
        server.server_close()
        raise RuntimeError('โปรแกรมถูกเปิดอีกหน้าต่างแล้ว — ใช้หน้าที่เปิดอยู่') from None
    print(f'Shopee Video UI: http://127.0.0.1:{PORT}', flush=True)
    if '--no-browser' not in sys.argv:
        webbrowser.open(f'http://127.0.0.1:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if PROCESS:
            PROCESS.terminate()
        server.server_close()

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--worker':
        sys.exit(worker(sys.argv[2]))
    main()
