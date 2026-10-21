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
import queue_runtime as runtime
import product_identity as products
import phone_inventory as phones
from phone_preview import PhonePreview, PreviewUnavailable

HERE = Path(__file__).resolve().parent
PORT = 8765
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.RLock()
ATTENTION_FILE = HERE / 'attention.json'
JOB = {'running': False, 'kind': '', 'state': 'idle', 'prompt': None, 'logs': [], 'basket': None, 'prepared': None, 'attention': None}
SAVED_PREPARED = sp.read_json(sp.PREPARED_FILE, {})
if SAVED_PREPARED.get('status') == 'prepared':
    JOB.update(state='prepared', prepared=SAVED_PREPARED,
               logs=['คลิปที่เตรียมไว้พร้อมต่อรอบโพสต์จริง'])
elif SAVED_PREPARED.get('status') == 'posted' and SAVED_PREPARED.get('result'):
    JOB.update(state='posted', published=SAVED_PREPARED['result'],
               logs=['คลิปล่าสุดยืนยันโพสต์สำเร็จแล้ว'])
SAVED_ATTENTION = sp.read_json(ATTENTION_FILE, {})
if SAVED_ATTENTION.get('serial') == sp.read_json(sp.SETTINGS_FILE, {}).get('serial') and SAVED_ATTENTION.get('code'):
    JOB.update(state='attention', attention=SAVED_ATTENTION, logs=[SAVED_ATTENTION['message']])
PROCESS = None
VERIFIED = {}
PREVIEW = PhonePreview()
WORKER_IDLE_SECONDS = 300


def pending_upload(prepared, posted):
    history = posted.get('items', {}).get(prepared.get('clip_key'), {})
    if prepared.get('status') in ('posting', 'posted') and history.get('status') != 'posted':
        return {k: prepared.get(k) for k in ('clip_key', 'clip_name', 'serial', 'started_at')}
    return None


def upload_attention(pending):
    return {'code': 'upload_unconfirmed', 'title': 'คิวพัก — รอตรวจผลคลิปค้าง',
            'message': 'คลิป ' + (pending.get('clip_name') or '')
                       + ' เคยกดโพสต์แล้วแต่ยังไม่ทราบผล กด “ตรวจผลคลิปค้าง” เพื่อดูในโปรไฟล์ หาก Shopee ขอยืนยัน ให้ผ่านบนมือถือก่อน โปรแกรมเก็บไฟล์ไว้และจะไม่โพสต์ซ้ำ'}

def _worker(kind):
    wire = sys.stdout
    error_wire = sys.stderr
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
        if settings.get('auto_post'):
            raise sp.StepFailed('ขั้นตอนอัตโนมัติพบคำถามที่ต้องตอบ จึงพักคิวและเก็บไฟล์ไว้')
        output.flush()
        emit({'prompt': prompt})
        answer = sys.stdin.readline()
        if not answer:
            raise sp.Quit()
        return answer.rstrip('\r\n')
    try:
        settings = json.loads(os.environ['SHOPEE_JOB_SETTINGS']) if os.environ.get('SHOPEE_JOB_SETTINGS') else sp.load_settings()
        settings['_product_callback'] = lambda result: emit({'basket': result})
        publications = []
        def on_published(result):
            result = {**result, 'serial': settings.get('serial', '')}
            publications.append(result)
            emit({'published': result})
        settings['_published_callback'] = on_published
        preparation = []
        def on_prepared(result):
            preparation.append(result)
            emit({'prepared': result})
        settings['_prepared_callback'] = on_prepared
        if kind == 'post_one':
            settings.update(auto_post=True, _prepare_only=False,
                            _clip_key=os.environ.get('SHOPEE_CLIP_KEY', ''))
        if kind in ('recover', 'retry_upload'):
            pending = sp.read_json(sp.PREPARED_FILE, {})
            if (pending.get('status') not in ('posting', 'posted') or pending.get('serial') != settings.get('serial')
                    or pending.get('clip_key') != os.environ.get('SHOPEE_CLIP_KEY')):
                raise ValueError('งานค้างเปลี่ยนไป จึงไม่ตรวจหรือเริ่มโพสต์')
            settings.update(auto_post=True, _prepare_only=False, _recover_only=True,
                            _clip_key=pending['clip_key'])
            dev = sp.connect(settings)
            if not dev:
                raise ValueError('มือถือของคลิปค้างยังไม่พร้อม')
            if kind == 'retry_upload':
                clips, _ = sp.scan_clips(settings['clips_folder'])
                clip = next((c for c in clips if c.key == pending['clip_key']), None)
                if not clip:
                    raise ValueError('ไม่พบไฟล์เดิมของงานค้าง')
                settings.update(_active_clip_key=clip.key, _cleanup_sources=sp.post_cleanup.source_snapshot(clip))
                receipt = sp.retry_failed_upload(dev, settings, pending.get('remote'), 'อัปโหลดไม่สำเร็จ')
                if not receipt:
                    raise ValueError('ไม่พบงานเดิมที่แสดงปุ่มลองอัปโหลดใหม่อย่างชัดเจน หรือเคยลองแล้ว จึงไม่กดซ้ำ')
                settings.update(_post_receipt=receipt, _toast_cleared=True)
                sp.confirm_post(dev, settings, pending['remote'], ask, True)
            print('🔎 ตรวจผลคลิปเดิมอย่างเดียว โดยไม่กดเผยแพร่')
            sp.prepare_profile_inspection(dev, settings, sp.load_flow(settings))
        if kind in ('prepare', 'resume'):
            settings['_prepare_only'] = True
            settings['auto_post'] = False
            settings['_clip_key'] = os.environ.get('SHOPEE_CLIP_KEY', '')
        if kind == 'publish':
            result = sp.cmd_publish_prepared(settings, sp.load_flow(settings), ask=ask)
            output.flush()
            emit({'published': result, 'result': result['status']})
            return 0
        if kind == 'products':
            clips, _ = sp.scan_clips(settings['clips_folder'])
            posted = sp.load_posted()
            success = True
            for clip in clips:
                if clip.key in posted['items']:
                    continue
                if os.environ.get('SHOPEE_CLIP_KEY') and clip.key != os.environ['SHOPEE_CLIP_KEY']:
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
            if settings.get('_cooldown_resume'):
                dev.d.screen_on()
                time.sleep(.3)
            size, nodes = sp.screen(dev)
            size, nodes = sp.recover_identity_screen(dev, settings, size, nodes)
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
        if kind in ('post_one', 'recover', 'retry_upload'):
            success = bool(publications and publications[-1].get('status') == 'posted')
            emit({'result': 'posted' if success else 'failed'})
            return 0 if success else 1
        emit({'result': ('prepared' if preparation else 'stopped') if kind in ('prepare', 'resume') else 'done'})
        return 0
    except sp.AttentionRequired as exc:
        print('⏸ ' + str(exc))
        output.flush()
        emit({'attention': {**exc.attention, 'serial': settings['serial'], 'seen_at': time.time()}, 'result': 'attention'})
        return 1
    except (sp.Quit, KeyboardInterrupt):
        print('⏹ หยุดแล้ว')
        output.flush()
        emit({'result': 'stopped'})
        return 0
    except Exception as exc:
        print(f'❌ {exc}')
        output.flush()
        if kind in ('recover', 'retry_upload'):
            pending = sp.read_json(sp.PREPARED_FILE, {})
            emit({'attention': {**upload_attention(pending), 'serial': settings['serial'], 'seen_at': time.time()}, 'result': 'attention'})
        else:
            emit({'result': 'failed'})
        return 1
    finally:
        sys.stdout = wire
        sys.stderr = error_wire

def worker(kind):
    try:
        with runtime.lease('phone-worker.lock'):
            return _worker(kind)
    except OSError:
        print(json.dumps({'log': 'มีตัวทำงานเดิมยังควบคุมมือถืออยู่ จึงไม่เริ่มซ้ำ', 'result': 'failed'}, ensure_ascii=False), flush=True)
        return 1


def auto_queue_once():
    with LOCK:
        session = runtime.load()
        if not session.get('active') or JOB['running']:
            return
        current = status()
        previous_cooldown = dict(session.get('cooldown') or {})
        if runtime.reconcile_cooldown(current, session):
            runtime.save(session)
            cd = session.get('cooldown') or {}
            if (cd.get('phase') == 'waiting'
                    and cd.get('attention_seen_at') != previous_cooldown.get('attention_seen_at')):
                JOB['logs'] = (JOB['logs'] + ['⏸ พักหน้าจอ 1 ชั่วโมง · ครบเวลาแล้วตรวจและต่อคิวเดิมอัตโนมัติ'])[-500:]
            current = status()  # Re-read journals and readiness after persisting the timer.
        action = runtime.next_action(current, session)
        if action == 'complete':
            runtime.stop('batch_complete_or_daily_limit')
        elif action == 'cooldown_check':
            session['cooldown'].update(phase='checking', check_started_at=time.time())
            runtime.save(session)  # Consume this deadline before waking the phone.
            try:
                start_job('check', auto_resume=True)
            except Exception:
                session['cooldown'].update(phase='waiting', retry_after=time.time() + 60)
                runtime.save(session)
                raise
        elif action:
            if action == 'recover':
                session['recovery_key'] = current['job']['unconfirmed']['clip_key']
                runtime.save(session)
            JOB['logs'].append('🔄 โปรแกรมกู้คิวเดิมอัตโนมัติ: ' + action)
            start_job(action, auto_resume=True)


def keep_cooldown_computer_awake():
    if os.name == 'nt':
        import ctypes
        cfg = sp.read_json(sp.SETTINGS_FILE, {})
        cooling = runtime.cooldown_status(runtime.load(), cfg)
        # The one-hour timer must run even with no active upload worker. This
        # thread's temporary request leaves display and lock policies intact.
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000001 if cooling else 0x80000000)


def auto_queue_loop():
    while True:
        time.sleep(10)
        try:
            keep_cooldown_computer_awake()
            auto_queue_once()
        except Exception as exc:
            with LOCK:
                JOB['logs'] = (JOB['logs'] + ['กู้คิวอัตโนมัติยังไม่พร้อม: ' + str(exc)])[-500:]


def phone_state(refresh=False):
    settings = sp.read_json(sp.SETTINGS_FILE, {})
    return phones.selected_phone(phones.inventory(refresh), settings.get('serial', ''))

def status():
    settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
    clips, notes = sp.scan_clips(settings['clips_folder'])
    posted = sp.load_posted()
    unconfirmed = pending_upload(sp.read_json(sp.PREPARED_FILE, {}), posted)
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
    job['unconfirmed'] = unconfirmed
    if unconfirmed and not job['running']:
        job['attention'] = job.get('attention') or upload_attention(unconfirmed)
        job['state'] = 'attention'
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
    job['cooldown'] = runtime.cooldown_status(runtime.load(), settings)
    base_ready = phone['state'] == 'device' and phone['shopee'] and phone['screen'] and not job.get('attention') and not job['cooldown'] and not unconfirmed and pending > 0 and today < settings['daily_limit']
    ready = base_ready and (settings.get('auto_post') or products_ready)
    job['idle_seconds'] = max(0, int(time.monotonic() - job.get('last_progress_at', time.monotonic()))) if job['running'] else 0
    job['idle_limit_seconds'] = WORKER_IDLE_SECONDS
    return {'version': 'autonomous-post-v11-thermal-cooldown', 'instance_pid': os.getpid(),
            'settings': settings, 'phone': phone, 'clips': queue, 'pending': pending, 'today': today,
            'ready': ready, 'base_ready': base_ready, 'products_ready': products_ready, 'notes': notes, 'job': job,
            'total_posted': sum(v.get('status') == 'posted' for v in posted['items'].values()),
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
                JOB['last_progress_at'] = time.monotonic()
                if 'log' in event:
                    JOB['logs'].append(event['log'])
                    JOB['logs'] = JOB['logs'][-500:]
                if 'prompt' in event:
                    JOB['prompt'] = event['prompt']
                    JOB['state'] = 'waiting'
                if 'verified' in event:
                    VERIFIED[event['verified']['serial']] = event['verified']
                    if event['verified'].get('screen'):
                        JOB['attention'] = None
                        sp.write_json(ATTENTION_FILE, {})
                if 'attention' in event:
                    JOB.update(attention=event['attention'], prompt=None, state='attention')
                    VERIFIED.pop(event['attention']['serial'], None)
                    sp.write_json(ATTENTION_FILE, event['attention'])
                if 'basket' in event:
                    JOB['basket'] = event['basket']
                if 'prepared' in event:
                    JOB['prepared'] = event['prepared']
                if 'published' in event:
                    published = event['published']
                    JOB.update(published=published, prepared=None)
                    serial = published.get('serial')
                    if published.get('status') == 'posted' and serial:
                        JOB['attention'] = None
                        sp.write_json(ATTENTION_FILE, {})
                        # A fresh verified post proves the device/app still works.
                        VERIFIED[serial] = {'serial': serial, 'shopee': True, 'screen': True, 'checked_at': time.time()}
                        pending = sp.read_json(sp.PREPARED_FILE, {})
                        if pending.get('serial') == serial and pending.get('clip_key') == published.get('clip_key'):
                            pending['result'] = published
                            sp.write_json(sp.PREPARED_FILE, pending)
                if 'result' in event:
                    result = event['result']
                try:
                    sp.write_json(HERE / 'last-job.json', {**JOB, 'logs': JOB['logs'][-100:]})
                except OSError:
                    pass
        code = proc.wait()
        with LOCK:
            if PROCESS is proc:
                state = 'stopped' if JOB['state'] == 'stopped' else 'attention' if JOB.get('attention') else result or ('done' if code == 0 else 'failed')
                if state == 'done' and JOB.get('kind') == 'post':
                    runtime.stop('batch_complete_or_daily_limit')
                JOB.update(running=False, state=state, prompt=None)
                PROCESS = None
    except Exception as exc:
        with LOCK:
            if PROCESS is proc:
                JOB['logs'].append(str(exc))
                JOB.update(running=False, state='failed', prompt=None)
                PROCESS = None

def guard_worker_once(proc, now=None):
    """Stop only our stalled worker; retain its journal and every source file."""
    now = time.monotonic() if now is None else now
    with LOCK:
        if PROCESS is not proc or not JOB['running'] or JOB['state'] == 'stopped':
            return False
        if now - JOB.get('last_progress_at', now) < WORKER_IDLE_SECONDS or proc.poll() is not None:
            return False
        pending = pending_upload(sp.read_json(sp.PREPARED_FILE, {}), sp.load_posted())
        attention = upload_attention(pending) if pending else {
            'code': 'worker_stalled', 'title': 'คิวพัก — มือถือไม่ตอบเกิน 5 นาที',
            'message': 'หยุดงานที่ไม่ตอบสนองแล้ว และเก็บไฟล์ไว้ ตรวจมือถือก่อนเริ่มต่อ'}
        attention.update(serial=sp.read_json(sp.SETTINGS_FILE, {}).get('serial', ''), seen_at=time.time())
        JOB.update(state='attention', attention=attention, prompt=None)
        JOB['logs'].append('⏸ งานไม่ตอบเกิน 5 นาที หยุดเฉพาะงานนี้และเก็บคิวไว้')
        sp.write_json(ATTENTION_FILE, attention)
        proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    return True


def guard_worker(proc):
    while True:
        time.sleep(5)
        with LOCK:
            if PROCESS is not proc:
                return
        if guard_worker_once(proc):
            return


def start_job(kind, clip_key='', auto_resume=False):
    global PROCESS, VERIFIED
    if kind not in ('check', 'post', 'post_one', 'prepare', 'resume', 'publish', 'products', 'basket', 'recover', 'retry_upload'):
        raise ValueError('คำสั่งไม่ถูกต้อง')
    with LOCK:
        if JOB['running']:
            raise ValueError('มีงานกำลังทำอยู่')
        settings = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
        session = runtime.load()
        cooldown = runtime.cooldown_status(session, settings)
        if kind != 'products' and cooldown and cooldown['phase'] == 'waiting' and cooldown['seconds_remaining'] > 0:
            raise ValueError('กำลังพักหน้าจอให้เครื่องเย็น เหลือ ' + str(cooldown['seconds_remaining']) + ' วินาที · กดหยุดคิวเพื่อยกเลิกตัวจับเวลา')
        if (kind == 'check' and auto_resume and cooldown
                and cooldown['phase'] == 'checking'):
            settings['_cooldown_resume'] = True
        phone = phone_state()
        if kind != 'products' and phone['state'] != 'device':
            raise ValueError(phone['message'])
        current = status() if kind in ('post', 'post_one', 'prepare', 'resume', 'publish', 'recover', 'retry_upload') else None
        if current and current['job'].get('attention') and kind not in ('recover', 'retry_upload'):
            raise ValueError(current['job']['attention']['message'])
        if kind in ('recover', 'retry_upload'):
            pending = sp.read_json(sp.PREPARED_FILE, {})
            clip_key = pending.get('clip_key', '')
            if not pending_upload(pending, sp.load_posted()) or pending.get('serial') != phone['serial']:
                raise ValueError('เลือกมือถือเดิมของคลิปค้างก่อนตรวจผล')
            if not any(c['key'] == clip_key for c in current['clips']):
                raise ValueError('ไม่พบไฟล์เดิมของงานค้าง จึงไม่เริ่มโพสต์ใหม่')
        if kind == 'post_one':
            selected = next((c for c in current['clips'] if c['key'] == clip_key and c['state'] == 'pending'), None)
            if not current['base_ready'] or not selected or not selected['has_text'] or not selected['has_link']:
                raise ValueError('ตรวจมือถือให้ผ่านและเลือกคลิปที่มีแคปชันกับลิงก์ ก่อนทดสอบโพสต์จริงหนึ่งคลิป')
        if kind == 'publish':
            prepared = sp.read_json(sp.PREPARED_FILE, {})
            selected = next((c for c in current['clips'] if c['key'] == prepared.get('clip_key') and c['state'] == 'pending'), None)
            if prepared.get('status') != 'prepared' or prepared.get('serial') != phone['serial'] or not selected:
                raise ValueError('ไม่มีคลิปที่เตรียมไว้สำหรับมือถือเครื่องนี้')
            if current['today'] >= settings['daily_limit']:
                raise ValueError('ครบจำนวนโพสต์วันนี้แล้ว')
        if kind == 'post' and not current['ready']:
            raise ValueError('ต้องตรวจมือถือและรหัสสินค้าให้ผ่าน และมีคลิปใหม่ในคิวก่อนเริ่ม')
        if kind in ('prepare', 'resume'):
            selected = next((c for c in current['clips'] if c['key'] == clip_key and c['state'] == 'pending'), None)
            if not current['base_ready'] or not selected or selected['product']['status'] != 'resolved':
                raise ValueError('ตรวจมือถือและลิงก์ของคลิปที่เลือกให้ผ่านก่อนทดลอง')
        if kind == 'resume':
            settings['_resume_from_step'] = 'caption'
            settings['plain_caption'] = True
        if kind == 'basket' and not clip_key:
            raise ValueError('เลือกคลิปที่ต้องการเทียบรหัสสินค้าก่อน')
        settings['serial'] = phone['serial'] if kind != 'products' else settings.get('serial', '')
        if kind == 'check':
            VERIFIED.pop(phone['serial'], None)
        if kind == 'post':
            session = runtime.load() if auto_resume else {
                'active': True, 'serial': settings['serial'],
                'clips_folder': settings['clips_folder'],
                'clip_keys': [c['key'] for c in current['clips'] if c['state'] == 'pending']}
            if not session.get('active'):
                raise ValueError('คิวเดิมถูกหยุดแล้ว')
            runtime.save(session)
            settings['_queue_keys'] = session['clip_keys']
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'PYTHONDONTWRITEBYTECODE': '1',
               'SHOPEE_JOB_SETTINGS': json.dumps(settings, ensure_ascii=False), 'SHOPEE_CLIP_KEY': clip_key}
        PROCESS = subprocess.Popen([sys.executable, '-B', '-u', str(HERE / 'poster_app.py'), '--worker', kind],
            cwd=HERE, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        JOB.update(running=True, kind=kind, state='running', prompt=None, logs=[], basket=None, prepared=None, published=None,
                   attention=JOB.get('attention') if kind == 'check' else None, last_progress_at=time.monotonic())
        threading.Thread(target=collect, args=(PROCESS,), daemon=True).start()
        threading.Thread(target=guard_worker, args=(PROCESS,), daemon=True).start()

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
        raw = body if isinstance(body, bytes) else body.encode('utf-8') if isinstance(body, str) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(raw)
    def send_screen(self):
        # Use the stored choice. An automatic choice is allowed only for one
        # authorized device, exactly as for posting. Capture has its own lock.
        cfg = sp.read_json(sp.SETTINGS_FILE, {})
        cooldown = runtime.cooldown_status(runtime.load(), cfg)
        if cooldown and cooldown['phase'] == 'waiting':
            raise PreviewUnavailable('กำลังพักหน้าจอให้เครื่องเย็น · ภาพสดจะกลับหลังครบเวลาพัก')
        serial = cfg.get('serial', '')
        if not serial:
            phone = phone_state()
            serial = phone['serial'] if phone['state'] == 'device' else ''
        raw, captured, size = PREVIEW.frame(serial)
        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Time', str(captured))
        self.send_header('X-Phone-Serial', serial)
        self.send_header('X-Frame-Size', f'{size[0]}x{size[1]}')
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
            if self.path in ('/ui.css', '/ui.js', '/ui-preview.js'):
                name = self.path[1:]
                mime = 'text/css; charset=utf-8' if name.endswith('.css') else 'application/javascript; charset=utf-8'
                return self.send(200, (HERE / name).read_text(encoding='utf-8'), mime)
            return self.send(404, {'error': 'Not found'})
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
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
            if self.path == '/api/phone-screen':
                return self.send_screen()
            if self.path == '/api/start':
                start_job(data.get('kind'), data.get('clip_key', ''))
            elif self.path == '/api/settings':
                save_settings(data)
            elif self.path == '/api/cleanup_settings':
                with LOCK:
                    if JOB['running'] or not isinstance(data.get('enabled'), bool):
                        raise ValueError('หยุดงานก่อนเปลี่ยนการลบไฟล์')
                    cfg = {**sp.DEFAULT_SETTINGS, **sp.read_json(sp.SETTINGS_FILE, {})}
                    cfg['delete_after_post'] = data['enabled']
                    sp.write_json(sp.SETTINGS_FILE, cfg)
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
                    runtime.stop('user_stopped')
                    if PROCESS:
                        PROCESS.terminate()
                        JOB.update(state='stopped', prompt=None)
            else:
                return self.send(404, {'error': 'Not found'})
            self.send(200, {'ok': True})
        except PreviewUnavailable as exc:
            self.send(503, {'error': str(exc)})
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
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
    threading.Thread(target=auto_queue_loop, daemon=True).start()
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
