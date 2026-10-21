#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shopee Video โพสต์ช่วย (Android ต่อสาย USB)

เอาคลิปจาก Downloads/ShopeeVideo (ที่ extension meta-helper โหลดไว้ พร้อมไฟล์ .txt แคปชัน/แฮชแท็ก/ลิงก์)
ส่งเข้ามือถือ แล้วกดแอป Shopee ให้: เลือกคลิป → ใส่แคปชัน → ปักตะกร้าสินค้า → กดโพสต์ (หรือให้เรากดเอง)

- ขั้นตอนเก็บใน flow.json — หาปุ่มไม่เจอ โปรแกรมจะแสดงรายการปุ่มบนจอมือถือให้เลือก แล้วจำไว้ใช้ครั้งต่อไป (โหมดสอน)
- ค่าเริ่มต้น: เตรียมให้ครบ แล้วให้เรากดโพสต์เอง (auto_post = false ใน settings.json)
"""
import datetime
import hashlib
import http.client
import json
import os
import random
import re
import shutil
import shlex
import sys
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path
import product_identity as products
import post_cleanup

HERE = Path(__file__).resolve().parent
SETTINGS_FILE = HERE / 'settings.json'
FLOW_FILE = HERE / 'flow.json'
FLOW_DEFAULT = HERE / 'flow.default.json'
POSTED_FILE = HERE / 'posted.json'
UPLOADS_FILE = HERE / 'uploads.json'
PREPARED_FILE = HERE / 'prepared.json'
DUMP_DIR = HERE / 'dumps'
PKG = 'com.shopee.th'

DEFAULT_SETTINGS = {
    'clips_folder': str(Path.home() / 'Downloads' / 'ShopeeVideo'),
    'auto_post': False,            # true = โปรแกรมกดโพสต์เอง · false = เตรียมให้ครบ แล้วเรากดโพสต์เอง
    'daily_limit': 8,              # โพสต์ไม่เกินวันละกี่คลิป (กันโดนมองว่าเป็นบอท)
    'delay_minutes': [4, 9],       # พักแบบสุ่มระหว่างคลิป (นาที)
    'product_search': 'link',      # ค้นสินค้าตอนปักตะกร้าด้วย link (ลิงก์ affiliate) หรือ name (ชื่อสินค้า)
    'delete_after_post': True,     # ลบคลิปที่ส่งเข้ามือถือ (เฉพาะไฟล์ของโปรแกรมนี้) หลังโพสต์รอบถัดไป
    'phone_folder': '/sdcard/DCIM/ShopeeVideo',
    'popups': ['อนุญาต', 'Allow', 'ขณะใช้แอป', 'While using the app', 'อนุญาตทั้งหมด', 'Allow all',
               'ตกลง', 'OK', 'เข้าใจแล้ว', 'Got it', 'รับทราบ'],
    'serial': '',                  # ถ้าต่อมือถือหลายเครื่อง ใส่ serial ของเครื่องที่จะใช้
    'auto_unlock_swipe': False,    # เปิดจอและปัดเฉพาะหน้าล็อกธรรมดา; ไม่ใส่ PIN/รหัสผ่าน
    'thermal_cooldown_minutes': 60, # พักหน้าจอหนึ่งชั่วโมงเมื่อ Android แจ้งร้อน แล้วตรวจคิวเดิมต่อ
}

USB_HELP = """
วิธีเปิดให้คอมคุมมือถือได้ (ทำครั้งเดียว):
  1) ตั้งค่า → เกี่ยวกับโทรศัพท์ → แตะ "หมายเลขบิลด์" (Build number) 7 ครั้ง จนขึ้นว่าเป็นนักพัฒนาแล้ว
  2) ตั้งค่า → ตัวเลือกสำหรับนักพัฒนา → เปิด "การแก้ไขข้อบกพร่อง USB" (USB debugging)
     · Xiaomi/Redmi/POCO: เปิด "การแก้ไขข้อบกพร่อง USB (การตั้งค่าความปลอดภัย)" ด้วย
  3) เสียบสาย USB (ใช้สายที่ส่งข้อมูลได้ ไม่ใช่สายชาร์จอย่างเดียว) → บนมือถือกด "อนุญาต" + ติ๊ก "อนุญาตจากคอมนี้เสมอ"
"""


class Quit(Exception):
    pass


class StepFailed(Exception):
    pass


class ClipUnavailable(StepFailed):
    pass


class PhoneUiUnavailable(StepFailed):
    pass


class PhoneAppExited(PhoneUiUnavailable):
    """The observed launcher and absent Shopee process prove an early app exit."""
    pass


class UploadUnconfirmed(StepFailed):
    """An existing Post attempt needs read-only confirmation, never another Post."""
    pass


class AttentionRequired(StepFailed):
    def __init__(self, attention):
        self.attention = attention
        super().__init__(attention['message'])


def keyguard_credential_visible(nodes, size):
    for n in nodes:
        if not n.visible(size) or not (n.package == 'com.android.systemui'
                or n.rid.startswith('com.android.systemui:')):
            continue
        field = n.rid.rsplit('/', 1)[-1].lower()
        if (field in ('pinentry', 'passwordentry', 'lockpatternview')
                or n.cls.lower().endswith('lockpatternview')):
            return True
    return False


def attention_from_screen(nodes, size):
    visible = [n for n in nodes if n.visible(size)]
    hot_title = any(n.rid == 'miui:id/alertTitle' and n.text == 'ร้อนเกิน' for n in visible)
    hot_message = any(n.rid == 'miui:id/message' and 'อุปกรณ์ของคุณร้อนเกินไป' in n.text
                      and 'กล้อง' in n.text and 'จำกัด' in n.text for n in visible)
    if hot_title and hot_message:
        return {'code': 'phone_overheating', 'title': 'มือถือร้อนเกินไป — พักคิว',
                'message': 'Android แจ้งว่ามือถือร้อนเกินไปและจำกัดกล้อง/การเชื่อมต่อ '
                           '— รอให้เครื่องเย็นและคำเตือนหายก่อนตรวจผลคลิปเดิม โปรแกรมเก็บไฟล์ไว้และไม่โพสต์ซ้ำ'}
    keyguard_ids = {n.rid for n in visible}
    if ({'com.android.systemui:id/keyguard_carrier_text',
            'com.android.systemui:id/keyguard_indication_text'}.issubset(keyguard_ids)
            or keyguard_credential_visible(nodes, size)):
        return {'code': 'phone_locked', 'title': 'มือถืออยู่หน้าล็อก — พักคิว',
                'message': 'พบหน้าล็อกของ Android — ปลดล็อกบนมือถือแล้วตรวจอีกครั้ง '
                           'โปรแกรมเก็บคิวและไฟล์ไว้ ยังไม่เริ่มหรือกดโพสต์'}
    identity = any(n.rid.startswith(PKG + ':id/') and n.rid.endswith('/title_text')
                   and n.text in ('ยืนยันตัวตน', 'Identity verification', 'Security verification') for n in visible)
    if identity:
        expired = any('การยืนยันหมดเวลา' in n.text or 'verification timed out' in n.text.lower() for n in visible)
        return {'code': 'shopee_identity', 'title': 'Shopee ต้องยืนยันตัวตนบนมือถือ',
                'message': ('การยืนยันตัวตนหมดเวลา' if expired else 'Shopee ขอให้ยืนยันตัวตน')
                           + ' — ต้องผ่านการยืนยันในแอป Shopee ก่อน แล้วกดตรวจมือถืออีกครั้ง โปรแกรมเก็บคิวและไฟล์ไว้แล้ว'}
    return None


def power_screen_is_off(state):
    return isinstance(state, str) and bool(re.search(r'(?m)^\s*Display Power: state=OFF\s*$', state))


def pause_for_attention(dev, attention):
    attention = dict(attention)
    if attention.get('code') == 'phone_overheating':
        requested = False
        try:
            off = power_screen_is_off(dev.shell('dumpsys power'))
            if not off:
                # KEYCODE_SLEEP is idempotent: repeated heat detection cannot
                # toggle an already sleeping screen back on. Keep the app and
                # unknown upload journal intact while Android cools the phone.
                dev.shell('input keyevent 223')
                requested = True
                for attempt in range(3):
                    off = power_screen_is_off(dev.shell('dumpsys power'))
                    if off:
                        break
                    if attempt < 2:
                        time.sleep(.25)
            attention['screen_sleep'] = 'confirmed' if off else 'unconfirmed'
            attention['screen_sleep_requested'] = requested
            detail = 'พักหน้าจอแล้ว' if off else 'สั่งพักหน้าจอแล้ว แต่ยังยืนยันจอดับไม่ได้'
        except Exception as exc:
            attention.update(screen_sleep='failed', screen_sleep_requested=requested,
                             screen_sleep_error=str(exc))
            detail = 'พักคิวแล้ว แต่พักหน้าจออัตโนมัติไม่สำเร็จ'
        attention['message'] += ' · ' + detail
        print('  ⏸ ' + detail, flush=True)
    raise AttentionRequired(attention)


def require_accessible_screen(nodes, size, dev=None):
    attention = attention_from_screen(nodes, size)
    if attention:
        if dev is not None:
            pause_for_attention(dev, attention)
        raise AttentionRequired(attention)


def recover_swipe_lock(dev, settings, size, nodes):
    """Wake and swipe once; never enter a credential or change lock settings."""
    blocked = {'code': 'phone_locked', 'title': 'มือถืออยู่หน้าล็อก — พักคิว',
               'message': 'ปัดปลดล็อกแล้วยังยืนยันหน้าพร้อมไม่ได้ หรือมี PIN/รหัสผ่าน '
                          '— ปลดล็อกบนมือถือแล้วตรวจใหม่ โปรแกรมเก็บคิวและไฟล์ไว้'}
    if (not settings.get('auto_unlock_swipe') or settings.get('_unlock_swipe_attempted')
            or keyguard_credential_visible(nodes, size)):
        raise AttentionRequired(blocked)
    settings['_unlock_swipe_attempted'] = True
    dev.d.screen_on()
    time.sleep(.3)
    size, nodes = screen(dev)  # A sleeping phone can expose stale keyguard nodes.
    swiped = False
    for attempt in range(4):
        attention = attention_from_screen(nodes, size)
        if attention and attention['code'] == 'phone_overheating':
            pause_for_attention(dev, attention)
        if keyguard_credential_visible(nodes, size):
            raise AttentionRequired(blocked)
        if attention and attention['code'] == 'shopee_identity':
            return size, nodes  # The existing identity guard handles this gate.
        if attention and attention['code'] == 'phone_locked' and not swiped:
            if any(n.visible(size) and n.is_input for n in nodes):
                raise AttentionRequired(blocked)
            w, h = size
            dev.shell(f'input swipe {w // 2} {int(h * .84)} {w // 2} {int(h * .28)} 400')
            swiped = True
        elif not attention and any(n.visible(size) and (
                n.package in (PKG, 'com.miui.home')
                or n.rid.startswith(PKG + ':') or n.rid.startswith(PKG + '.')
                or n.rid.startswith('com.miui.home:')) for n in nodes):
            print('  ✅ เปิดจอและปัดปลดล็อกแล้ว ตรวจหน้าจอจริงก่อนทำงานต่อ')
            return size, nodes
        if attempt < 3:
            time.sleep(.5)
            size, nodes = screen(dev)
    raise AttentionRequired(blocked)


def recover_identity_screen(dev, settings, size, nodes):
    """Recover an authorized swipe lock or bounded app reopen, then check real UI."""
    attention = attention_from_screen(nodes, size)
    if attention and attention['code'] == 'phone_locked':
        if not settings.get('auto_unlock_swipe'):
            pause_for_attention(dev, attention)
        size, nodes = recover_swipe_lock(dev, settings, size, nodes)
        attention = attention_from_screen(nodes, size)
    if not attention:
        return size, nodes
    if attention['code'] != 'shopee_identity':
        pause_for_attention(dev, attention)
    if not settings.get('reopen_on_identity') or settings.get('_identity_reopened'):
        raise AttentionRequired(attention)
    settings['_identity_reopened'] = True
    print('  ↻ พบหน้ายืนยันตัวตน ออกหน้าโฮมแล้วเปิด Shopee ใหม่หนึ่งครั้ง')
    # A warm launch preserves an upload in progress and its posting journal.
    dev.press('home')
    dev.app_start(PKG, restart=False)
    time.sleep(2)
    deadline = time.monotonic() + max(15, min(90, float(settings.get('ui_timeout_seconds', 60))))
    while time.monotonic() < deadline:
        size, nodes = screen(dev)
        current_attention = attention_from_screen(nodes, size)
        if current_attention:
            if current_attention['code'] != 'shopee_identity':
                pause_for_attention(dev, current_attention)
            attention = current_attention
        elif nodes and dev.d.app_current().get('package') == PKG:
            print('  ✅ เปิด Shopee กลับมาแล้ว ตรวจขั้นตอนเดิมต่อ')
            return size, nodes
        time.sleep(1)
    raise AttentionRequired({**attention, 'message': 'เปิด Shopee ใหม่แล้ว ยังเข้าใช้งานต่อไม่ได้ — ' + attention['message']})


POST_SUCCESS = re.compile(r'(?:โพสต์สำเร็จ|อัปโหลดสำเร็จ|เผยแพร่สำเร็จ|Posted successfully|Uploaded successfully)[!！.\s]*', re.I)
POST_FAILURE = re.compile(r'(?:อัปโหลดไม่สำเร็จ|โพสต์ไม่สำเร็จ|เผยแพร่ไม่สำเร็จ|upload failed|post failed)', re.I)


class PostReceipt:
    """Capture a fresh upload toast while slow hierarchy reads are in progress."""
    def __init__(self, dev):
        self.dev = dev
        self.evidence = ''
        self.error = ''
        self.done = threading.Event()

    def observe(self, message):
        if not isinstance(message, str):
            return
        message = message.strip()
        if POST_SUCCESS.fullmatch(message):
            self.evidence = message
            self.done.set()
        elif POST_FAILURE.search(message):
            self.error = message
            self.done.set()

    def start(self):
        self.dev.d.clear_toast()
        def watch():
            while not self.done.is_set():
                try:
                    self.observe(self.dev.d.last_toast)
                except Exception:
                    pass
                self.done.wait(.35)
        threading.Thread(target=watch, daemon=True).start()

    def close(self):
        self.done.set()


def keep_phone_awake(function):
    def run(dev, clip, settings, *args, **kwargs):
        stop = threading.Event()
        if settings.get('auto_post'):
            def keep():
                while not stop.is_set():
                    try:
                        # Use the symbolic name: Android interprets the string "0"
                        # as KEYCODE_0, which inserts a digit in an active text field.
                        dev.shell('input keyevent KEYCODE_UNKNOWN')
                    except Exception:
                        pass
                    stop.wait(5)
            threading.Thread(target=keep, daemon=True).start()
        try:
            return function(dev, clip, settings, *args, **kwargs)
        finally:
            stop.set()
    return run


def source_product(clip, settings):
    if settings.get('auto_post'):
        link = clip.info.get('link', '')
        if not clip.txt or not products.allowed_url(link):
            raise ClipUnavailable('ไม่มีไฟล์ .txt หรือลิงก์สินค้า Shopee ที่ใช้ได้')
        # Shopee imports the original link. Do not invent product IDs or copy
        # a second link from the product page merely to repeat the request.
        return {'source_url': link, 'product_url': link, 'status': 'import_link',
                'item_id': '', 'shop_id': '', 'error': ''}
    return products.remember(products.resolve_link(clip.info['link']))


# ---------------------------------------------------------------- ไฟล์ตั้งค่า
def read_json(path, default):
    try:
        with open(path, encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except Exception as e:
        print(f'⚠ อ่าน {path.name} ไม่ได้ ({e}) — ใช้ค่าเริ่มต้นแทน')
        return default


def write_json(path, data):
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_settings():
    s = read_json(SETTINGS_FILE, {})
    merged = {**DEFAULT_SETTINGS, **s}
    if merged != s:
        write_json(SETTINGS_FILE, merged)
    return merged


def configure_flow(serial):
    global FLOW_FILE
    if serial:
        folder = HERE / 'flows'
        folder.mkdir(exist_ok=True)
        FLOW_FILE = folder / ('device_' + hashlib.sha256(serial.encode()).hexdigest()[:16] + '.json')
    else:
        FLOW_FILE = HERE / 'flow.json'


def load_flow(settings=None):
    configure_flow((settings or {}).get('serial', ''))
    if not FLOW_FILE.exists():
        shutil.copyfile(FLOW_DEFAULT, FLOW_FILE)
    flow = read_json(FLOW_FILE, None)
    if not isinstance(flow, list) or not flow:
        print('⚠ flow.json เสีย — ใช้ขั้นตอนเริ่มต้นแทน')
        flow = read_json(FLOW_DEFAULT, [])
    return flow


def save_flow(flow):
    write_json(FLOW_FILE, flow)


# ---------------------------------------------------------------- คลิปในคิว
PART_SUFFIX = re.compile(r'-(?:A|B|[12]|รวม)$')
UNIQ_SUFFIX = re.compile(r'\s*\(\d+\)$')  # Chrome ตั้งชื่อซ้ำเป็น "ชื่อ (1)"
LINK_RE = re.compile(r'https?://\S*shopee\S*', re.I)


def base_name(stem):
    s = UNIQ_SUFFIX.sub('', stem)
    while PART_SUFFIX.search(s):
        s = PART_SUFFIX.sub('', s)
    return s.strip()


def parse_post_text(path):
    """ไฟล์ .txt จาก extension: แคปชัน / แฮชแท็ก / 🛒 ลิงก์"""
    info = {'caption': '', 'tags': [], 'link': ''}
    if not path:
        return info
    try:
        text = Path(path).read_text(encoding='utf-8-sig')
    except Exception:
        return info
    caption_lines = []
    for line in text.splitlines():
        t = line.strip()
        if not t:
            continue
        m = LINK_RE.search(t)
        if m:
            info['link'] = info['link'] or m.group(0)
            continue
        if t.startswith('#'):
            info['tags'] += [w for w in t.split() if w.startswith('#')]
            continue
        caption_lines.append(t)
    info['caption'] = ' '.join(caption_lines).strip()
    return info


class Clip:
    def __init__(self, video, txt, name):
        self.video = Path(video)
        self.txt = Path(txt) if txt else None
        self.name = name
        self.info = parse_post_text(self.txt)

    @property
    def key(self):
        return f'{self.video.name}|{self.video.stat().st_size}'

    def context(self, settings):
        caption = self.info['caption'] or self.name
        tags = ' '.join(self.info['tags'])
        link = self.info['link']
        search = link if settings.get('product_search') == 'link' and link else self.name
        identity = products.cached_identity(link)
        if settings.get('product_search') == 'link' and identity.get('product_url'):
            search = identity['product_url']
        return {
            'caption': caption,
            'hashtags': tags,
            'caption_full': fit_caption(caption, tags, plain_emoji=settings.get('plain_caption', False)),
            'link': link,
            'name': self.name,
            'search': search,
            'product': identity,
        }


def caption_units(value):
    return len(value.encode('utf-16-le')) // 2


def fit_caption(caption, tags, limit=150, plain_emoji=False):
    if plain_emoji:
        caption = ''.join(c for c in caption if ord(c) <= 0xffff and c not in '\u200d\ufe0f')
    caption = ' '.join(caption.split())
    if caption_units(caption) > limit:
        short = ''
        for ch in caption:
            if caption_units(short + ch + '…') > limit:
                break
            short += ch
        if ' ' in short and short.rfind(' ') > len(short) // 2:
            short = short[:short.rfind(' ')]
        return short.rstrip() + '…'
    selected = []
    for tag in tags.split():
        candidate = caption + '\n\n' + ' '.join([*selected, tag])
        if caption_units(candidate) <= limit:
            selected.append(tag)
    return (caption + '\n\n' + ' '.join(selected)).strip()


def caption_matches(actual, expected):
    # Shopee/Android may expose line breaks as spaces. Keep all other characters exact.
    flatten = lambda value: re.sub(r'\r\n?|\n|\t', ' ', value)
    return flatten(actual) == flatten(expected)


def published_panel_matches(texts, ctx, owner, started_at, now=None):
    """Require the complete creator caption, exact product and a fresh post time."""
    expected = ctx.get('caption_full', '')
    title = ctx.get('_verified_import', {}).get('title', '')
    normalize = lambda value: ' '.join(value.split())
    captions = [re.sub(r'\s+ซ่อน$', '', text) for text in texts]
    if (not expected or not title or title not in texts or owner not in texts
            or 'ผู้สร้าง' not in texts or normalize(expected) not in [normalize(t) for t in captions]):
        return False
    try:
        elapsed = ((now or datetime.datetime.now()) - datetime.datetime.fromisoformat(started_at)).total_seconds()
    except (TypeError, ValueError):
        return False
    if elapsed < 0:
        return False
    for text in texts:
        age = re.fullmatch(r'(\d+)\s*(นาที|วินาที|ชั่วโมง)ที่แล้ว', text)
        seconds = int(age[1]) * {'นาที': 60, 'วินาที': 1, 'ชั่วโมง': 3600}[age[2]] if age else None
        # The native label rounds to the nearest hour: this attempt showed 7 h
        # at 09:33 and 8 h at 09:40. Keep the original attempt window and all
        # caption/product/owner checks, comparing the rounded age interval.
        minimum = max(0, seconds - 1800) if age and age[2] == 'ชั่วโมง' else seconds
        upper = seconds + 1799 if age and age[2] == 'ชั่วโมง' else seconds
        if seconds is None and text in ('เมื่อสักครู่', 'เมื่อครู่', 'ตอนนี้', 'ไม่กี่วินาทีที่แล้ว', 'เมื่อไม่กี่วินาทีที่ผ่านมา'):
            seconds = 0
            minimum = 0
            upper = 0
        if seconds is not None and upper >= max(0, elapsed - 600) and minimum <= elapsed + 120:
            return True
    return False


def open_published_panel(dev, owner):
    """Open a verified owner's metadata/comments panel without composing a comment."""
    size, nodes = screen(dev)
    require_accessible_screen(nodes, size, dev)
    if not any(n.visible(size) and n.text == '@' + owner for n in nodes):
        return False
    panel = dev.d(description='close the comment panels')
    if panel.exists:
        return True
    comment = dev.d(description='click video comment_icon')
    caption = dev.d(description='video caption content')
    if comment.exists:
        comment.click()
    elif caption.exists:
        caption.click()
    else:
        return False
    if panel.wait(timeout=30):
        return True
    # A slow viewer can ignore the first tap. Recheck the owner before one retry.
    size, nodes = screen(dev)
    require_accessible_screen(nodes, size, dev)
    if not any(n.visible(size) and n.text == '@' + owner for n in nodes):
        return False
    if not comment.exists:
        return False
    comment.click()
    return bool(panel.wait(timeout=30))


def collapsed_creator_caption(nodes, size, ctx, owner):
    """Find only the pending caption in the owner's native creator row."""
    texts = [n.text for n in nodes if n.visible(size)]
    title = ctx.get('_verified_import', {}).get('title', '')
    if not title or title not in texts:
        return None
    expected = re.sub(r'\s+', '', ctx.get('caption_full', ''))
    candidates = []
    for node in nodes:
        if not (node.visible(size) and node.enabled and node.clickable
                and node.text.endswith('ดูเพิ่มเติม') and node.parent):
            continue
        row = [n.text for n in node.parent.descendants() if n.visible(size)]
        prefix = re.sub(r'(?:\.{3}|…)\s*ดูเพิ่มเติม$', '', node.text)
        prefix = re.sub(r'\s+', '', prefix)
        if owner in row and 'ผู้สร้าง' in row and len(prefix) >= 20 and expected.startswith(prefix):
            candidates.append(node)
    return candidates[0] if len(candidates) == 1 else None


def empty_comment_composer(nodes, size):
    """Native hint text denotes an empty field even when Shopee changes its CTA."""
    field = next((n for n in nodes if n.visible(size) and n.is_input
                  and n.desc == 'click to comment now'), None)
    return bool(field is not None
                and (field.text in ('', 'เพิ่มคอมเมนต์...') or (field.hint and field.text == field.hint))
                and any(n.visible(size) and n.desc == 'send comment now' for n in nodes))


def read_published_panel(dev, ctx, owner, started_at, timeout=60):
    """Wait for metadata, dismiss a real IME and expand the creator caption once."""
    deadline = time.monotonic() + timeout
    dismissed_keyboard = closed_composer = expanded = False
    panel = []
    print('  🔎 รอข้อมูลโพสต์และอ่านแคปชันเต็มในบัญชี', flush=True)
    while time.monotonic() < deadline:
        size, panel = screen(dev)
        require_accessible_screen(panel, size, dev)
        # Opening comments can autofocus its composer and hide all metadata.
        # Only Back an actually visible selected IME; never type or send a comment.
        composer = any(n.visible(size) and n.desc in ('click to comment now', 'click to add a comment')
                       for n in panel)
        if not dismissed_keyboard and composer and keyboard_visible(dev, panel, size):
            dev.press('back')
            dismissed_keyboard = True
            time.sleep(.5)
            continue
        # Shopee's separate composer modal also hides metadata after its IME
        # closes. Close only the observed empty native composer, never a draft.
        if empty_comment_composer(panel, size) and not closed_composer:
            dev.press('back')
            closed_composer = True
            time.sleep(.5)
            continue
        stamps = [started_at] + ([ctx['_upload_retry_at']] if ctx.get('_upload_retry_at') else [])
        if any(published_panel_matches([n.text for n in panel], ctx, owner, stamp) for stamp in stamps):
            return panel
        caption = collapsed_creator_caption(panel, size, ctx, owner)
        if caption and not expanded:
            # Shopee exposes the paragraph and its trailing link as one node.
            # Its centre is inert. The native three-line caption's trailing
            # "ดูเพิ่มเติม" span is near the right of its last line (observed
            # on this Redmi); constrain the single tap to that creator text.
            x1, y1, x2, y2 = caption.bounds
            dev.click(x1 + int((x2 - x1) * .8), y2 - min(16, max(8, (y2 - y1) // 6)))
            expanded = True
        time.sleep(1)
    return panel


def verify_published_profile(dev, ctx, started_at):
    """Inspect the newest public post in the account's own profile; never tap Post."""
    if dev.d.app_current().get('package') != PKG:
        return ''
    backs = 0
    def unavailable(reason):
        print('  ↪ ตรวจโพสต์ยังไม่ผ่าน: ' + reason)
        return ''
    try:
        owner_field = dev.d(description='nick name of me')
        if not owner_field.exists:
            entrance = dev.d(description='click me page icon')
            if not entrance.exists:
                return unavailable('ยังไม่พบทางเข้าบัญชีของเรา')
            entrance.click()
            backs += 1
        if not owner_field.wait(timeout=25):
            return unavailable('ชื่อบัญชียังไม่พร้อม')
        size, nodes = screen(dev)
        require_accessible_screen(nodes, size, dev)
        own_nodes = [n for n in nodes if n.desc == 'nick name of me']
        owner = next((child.text for n in own_nodes for child in n.descendants() if child.text), '')
        if not owner or not any(n.desc == 'user name of me' for n in nodes):
            return unavailable('ยังยืนยันชื่อเจ้าของบัญชีไม่ได้')
        latest = dev.d(description='click video 0')
        if not latest.wait(timeout=30):
            return unavailable('คลิปล่าสุดยังไม่พร้อม')
        latest.click()
        backs += 1
        caption = dev.d(description='video caption content')
        if not caption.wait(timeout=25):
            return unavailable('แคปชันคลิปล่าสุดยังไม่พร้อม')
        if not dev.d(text='@' + owner).wait(timeout=15):
            return unavailable('ชื่อเจ้าของคลิปยังไม่ตรงกับบัญชี')
        viewer_size, viewer = screen(dev)
        require_accessible_screen(viewer, viewer_size, dev)
        if '@' + owner not in [n.text for n in viewer]:
            return unavailable('ยังไม่พบชื่อบัญชีบนคลิป')
        if not open_published_panel(dev, owner):
            return unavailable('หน้ารายละเอียดแคปชันยังไม่เปิด')
        backs += 1
        panel = read_published_panel(dev, ctx, owner, started_at)
        times = [started_at] + ([ctx['_upload_retry_at']] if ctx.get('_upload_retry_at') else [])
        if any(published_panel_matches([n.text for n in panel], ctx, owner, stamp) for stamp in times):
            try:
                DUMP_DIR.mkdir(exist_ok=True)
                (DUMP_DIR / 'last-published-proof.xml').write_text(dev.dump(), encoding='utf-8')
                dev.screenshot(DUMP_DIR / 'last-published-proof.jpg')
            except Exception as exc:
                print('  ⚠ ตรวจโพสต์ผ่านแล้ว แต่บันทึกภาพหลักฐานไม่ได้: ' + str(exc))
            return 'พบคลิปที่เผยแพร่ในโปรไฟล์บัญชีนี้: แคปชันเต็ม สินค้า และเวลาโพสต์ตรงกับงาน'
        try:
            DUMP_DIR.mkdir(exist_ok=True)
            write_json(DUMP_DIR / 'unmatched-public-panel.json', {
                'owner': owner, 'started_at': started_at, 'observed_texts': [n.text for n in panel if n.text],
                'expected_caption': ctx.get('caption_full'),
                'expected_product': ctx.get('_verified_import', {}).get('title')})
        except Exception:
            pass
        return unavailable('แคปชันเต็ม สินค้า หรือเวลาโพสต์ยังไม่ตรงกับงาน')
    except AttentionRequired:
        backs = 0  # Preserve the native warning; Back must not dismiss a thermal/identity gate.
        raise
    finally:
        for _ in range(backs):
            dev.press('back')


def pending_post_context(pending):
    ctx = dict(pending.get('context', {}))
    if pending.get('upload_retry_count') == 1 and POST_FAILURE.search(pending.get('upload_failure_evidence', '')):
        ctx['_upload_retry_at'] = pending.get('upload_retry_at')
    return ctx


def recover_pending_upload(dev, clip, settings, pending):
    if (pending.get('clips_folder') != str(Path(settings['clips_folder']).resolve())
            or pending.get('sources') != settings['_cleanup_sources']):
        raise StepFailed('ไฟล์คลิปค้างเปลี่ยนไป จึงไม่เริ่มซ้ำ')
    context = pending_post_context(pending)
    owned = read_json(UPLOADS_FILE, {}).get(settings['serial'] + '|' + clip.key, {})
    if (owned.get('remote') != pending.get('remote') or not post_cleanup.matches_source(owned, pending['sources']['video'])
            or context.get('product', {}).get('source_url') != clip.info['link']):
        raise StepFailed('ข้อมูลคลิปค้างไม่ตรงกับงาน จึงไม่เริ่มซ้ำ')
    evidence = verify_published_profile(dev, context, pending.get('started_at'))
    if not evidence:
        raise UploadUnconfirmed('ยังไม่พบคลิปค้างที่ยืนยันได้ในบัญชี จึงเก็บไฟล์และไม่กดโพสต์ซ้ำ')
    settings.update(_post_confirmed=True, _post_evidence=evidence)
    pending.update(status='posted', evidence=evidence)
    write_json(PREPARED_FILE, pending)
    print('  ✅ ' + evidence)
    return 'posted', pending['remote']


def recheck_pending_upload(dev, clip, settings, pending):
    """Bounded recovery performed by the posting worker itself, without another Post."""
    settings['_post_confirmed'] = False
    attempts = max(1, min(3, int(settings.get('confirmation_rechecks', 3))))
    delay = max(0, min(30, float(settings.get('confirmation_recheck_seconds', 15))))
    expected = (clip.key, settings['serial'], pending.get('remote'))
    for attempt in range(attempts):
        current = read_json(PREPARED_FILE, {})
        if (current.get('status') not in ('posting', 'posted')
                or (current.get('clip_key'), current.get('serial'), current.get('remote')) != expected):
            raise StepFailed('บันทึกโพสต์เดิมเปลี่ยนไป จึงไม่ตรวจหรือเผยแพร่ซ้ำ')
        print(f'  🔎 โปรแกรมตรวจผลโพสต์เดิมเอง ({attempt + 1}/{attempts}) — ไม่กดโพสต์ซ้ำ', flush=True)
        try:
            prepare_profile_inspection(dev, settings, [])
        except AttentionRequired:
            raise
        except StepFailed:
            pass  # A temporary navigation failure may be checked again read-only.
        else:
            try:
                return recover_pending_upload(dev, clip, settings, current)
            except UploadUnconfirmed:
                pass
        if attempt + 1 < attempts:
            print(f'  ⏳ รอ {delay:g} วินาทีแล้วตรวจผลเดิมอีกครั้ง', flush=True)
            time.sleep(delay)
    raise UploadUnconfirmed('ตรวจผลเดิมอัตโนมัติครบแล้ว ยังยืนยันไม่ได้ จึงเก็บไฟล์และไม่กดโพสต์ซ้ำ')


def confirm_clip_post(dev, clip, settings, remote, ask, post_clicked, missed=()):
    try:
        return confirm_post(dev, settings, remote, ask, post_clicked, missed)
    except UploadUnconfirmed:
        pending = read_json(PREPARED_FILE, {})
        if (pending.get('status') != 'posting' or pending.get('clip_key') != clip.key
                or pending.get('serial') != settings['serial'] or pending.get('remote') != remote):
            raise StepFailed('งานอัปโหลดเปลี่ยนไป จึงไม่เริ่มตรวจหรือโพสต์ใหม่')
        print('  ⏳ หมดช่วงรออัปโหลด เริ่มตรวจโพสต์เดิมอัตโนมัติก่อนพักคิว', flush=True)
        return recheck_pending_upload(dev, clip, settings, pending)


def prepare_profile_inspection(dev, settings, flow):
    """Reach the native video/profile navigation without any publishing action."""
    if dev.d.app_current().get('package') != PKG:
        dev.app_start(PKG, restart=False)
    deadline = time.monotonic() + float(settings.get('ui_timeout_seconds', 60))
    opened_video = False
    viewer_backs = 0
    dismissed_keyboard = closed_composer = False
    while time.monotonic() < deadline:
        size, nodes = screen(dev)
        size, nodes = recover_identity_screen(dev, settings, size, nodes)
        if empty_comment_composer(nodes, size):
            if not dismissed_keyboard and keyboard_visible(dev, nodes, size):
                dev.press('back')
                dismissed_keyboard = True
                time.sleep(.5)
                continue
            if not closed_composer:
                dev.press('back')
                closed_composer = True
                time.sleep(.5)
                continue
        if any(n.visible(size) and n.desc in ('nick name of me', 'click me page icon') for n in nodes):
            return
        if viewer_backs < 3 and any(n.visible(size) and n.desc in ('video caption content', 'close the comment panels') for n in nodes):
            dev.press('back')
            viewer_backs += 1
            time.sleep(1)
            continue
        tab = next((n for n in nodes if n.visible(size) and n.desc == 'tab_bar_button_video_and_live'), None)
        if tab and not opened_video:
            dev.click(*tap_point(tab, size))
            opened_video = True
        time.sleep(1)
    raise StepFailed('ยังเข้าหน้าโปรไฟล์เพื่อตรวจคลิปค้างไม่ได้ — เก็บไฟล์ไว้และไม่กดโพสต์ซ้ำ')


def scan_clips(folder):
    folder = Path(folder)
    if not folder.is_dir():
        return [], [f'ไม่เจอโฟลเดอร์คลิป: {folder} (แก้ clips_folder ใน settings.json)']
    notes = []
    txts = {base_name(t.stem): t for t in folder.glob('*.txt')}
    clips = []
    for v in sorted(folder.iterdir(), key=lambda p: p.stat().st_mtime):
        if not v.is_file():
            continue
        ext = v.suffix.lower()
        if ext == '.webm':
            notes.append(f'ข้าม {v.name}: Shopee ใช้ไฟล์ .mp4')
            continue
        if ext != '.mp4':
            continue
        stem = UNIQ_SUFFIX.sub('', v.stem)
        if re.search(r'-[12]$', stem):
            notes.append(f'ข้าม {v.name}: เป็นท่อนย่อยของคลิป (ใช้ไฟล์ที่รวมแล้ว)')
            continue
        name = base_name(v.stem)
        clips.append(Clip(v, txts.get(name), name))
    return clips, notes


def load_posted():
    data = read_json(POSTED_FILE, {})
    data.setdefault('items', {})
    return data


def record_posted(data, clip, status):
    data['items'][clip.key] = {'at': datetime.datetime.now().isoformat(timespec='seconds'), 'name': clip.name, 'status': status}
    write_json(POSTED_FILE, data)


def posted_today(data):
    today = datetime.date.today().isoformat()
    return sum(1 for v in data['items'].values() if v.get('status') == 'posted' and v.get('at', '').startswith(today))


# ---------------------------------------------------------------- หน้าจอมือถือ (โครง UI)
BOUNDS_RE = re.compile(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]')


class Node:
    def __init__(self, el, parent):
        g = el.get
        self.text = (g('text') or '').strip()
        self.hint = (g('hint') or '').strip()
        self.desc = (g('content-desc') or '').strip()
        self.rid = (g('resource-id') or '').strip()
        self.package = (g('package') or '').strip()
        self.cls = (g('class') or '').strip()
        self.clickable = g('clickable') == 'true'
        self.enabled = g('enabled') != 'false'
        self.focused = g('focused') == 'true'
        self.checkable = g('checkable') == 'true'
        self.checked = g('checked') == 'true'
        m = BOUNDS_RE.match(g('bounds') or '')
        self.bounds = tuple(int(x) for x in m.groups()) if m else (0, 0, 0, 0)
        self.parent = parent
        self.children = []

    @property
    def center(self):
        x1, y1, x2, y2 = self.bounds
        return (x1 + x2) // 2, (y1 + y2) // 2

    @property
    def area(self):
        x1, y1, x2, y2 = self.bounds
        return max(0, x2 - x1) * max(0, y2 - y1)

    def visible(self, size):
        w, h = size
        x1, y1, x2, y2 = self.bounds
        return x2 - x1 > 2 and y2 - y1 > 2 and x2 > 0 and y2 > 0 and x1 < w and y1 < h

    def descendants(self):
        for c in self.children:
            yield c
            yield from c.descendants()

    @property
    def is_input(self):
        return 'EditText' in self.cls

    def label(self):
        """ข้อความที่ใช้เรียกปุ่มนี้ (ของตัวเอง หรือลูกตัวแรกที่มีข้อความ)"""
        own = self.text or self.desc or self.hint
        if own:
            return own
        for d in self.descendants():
            t = d.text or d.desc
            if t:
                return t
        return ''


def parse_nodes(xml):
    root = ET.fromstring(xml)
    out = []

    def walk(el, parent):
        for ch in el:
            if ch.tag != 'node':
                walk(ch, parent)
                continue
            n = Node(ch, parent)
            if parent:
                parent.children.append(n)
            out.append(n)
            walk(ch, n)

    walk(root, None)
    return out


def _texts(n):
    return [t for t in (n.text, n.hint) if t]


def _norm(s):
    return re.sub(r'\s+', ' ', s or '').strip().lower()


def match(n, sel):
    for k, v in sel.items():
        if k in ('index', 'pos'):
            continue
        if k == 'text':
            if not any(_norm(t) == _norm(v) for t in _texts(n)):
                return False
        elif k == 'textContains':
            if not any(_norm(v) in _norm(t) for t in _texts(n)):
                return False
        elif k == 'textRegex':
            if not any(re.search(v, t) for t in _texts(n)):
                return False
        elif k == 'desc':
            if _norm(n.desc) != _norm(v):
                return False
        elif k == 'descContains':
            if _norm(v) not in _norm(n.desc):
                return False
        elif k == 'descRegex':
            if not re.search(v, n.desc):
                return False
        elif k == 'id':
            if n.rid != v:
                return False
        elif k == 'idContains':
            if v not in n.rid:
                return False
        elif k == 'idRegex':
            if not re.search(v, n.rid):
                return False
        elif k == 'class':
            if n.cls != v:
                return False
        elif k == 'clickable':
            if n.clickable != bool(v):
                return False
        else:
            return False  # คีย์ที่ไม่รู้จัก = ไม่ตรง (กันกดมั่ว)
    return True


def node_at(nodes, x, y, cls=None):
    best = None
    for n in nodes:
        x1, y1, x2, y2 = n.bounds
        if x1 <= x <= x2 and y1 <= y <= y2 and (not cls or n.cls == cls):
            if best is None or n.area <= best.area:
                best = n
    return best


def find_target(nodes, cands, size):
    """คืน ('node', node) หรือ ('point', (x, y)) ของตัวเลือกแรกที่เจอ"""
    vis = [n for n in nodes if n.visible(size)]
    w, h = size
    for sel in cands or []:
        try:
            if 'pos' in sel:  # ตำแหน่งที่สอนไว้ (ปุ่มไอคอนไม่มีชื่อ) — ต้องมี element ชนิดเดียวกันอยู่ตรงนั้น
                x, y = int(sel['pos'][0] * w), int(sel['pos'][1] * h)
                if node_at(vis, x, y, sel.get('class')):
                    return 'point', (x, y)
                continue
            ms = [n for n in vis if match(n, sel)]
        except re.error as e:
            print(f'    ⚠ รูปแบบค้นหาผิดใน flow.json ({e}) — ข้ามตัวเลือกนี้')
            continue
        idx = int(sel.get('index', 0))
        if 0 <= idx < len(ms):
            return 'node', ms[idx]
    return None


def tap_point(n, size):
    """กดที่ปุ่มที่กดได้จริง (บรรพบุรุษที่ clickable) ถ้าไม่ใหญ่เกินไป"""
    w, h = size
    p = n
    for _ in range(5):
        if p is None:
            break
        if p.clickable and p.visible(size):
            if p.area <= 0.4 * w * h:
                return p.center
            break
        p = p.parent
    return n.center


def position_word(n, size):
    w, h = size
    x, y = n.center
    v = 'บน' if y < h / 3 else ('กลาง' if y < 2 * h / 3 else 'ล่าง')
    hz = 'ซ้าย' if x < w / 3 else ('กลาง' if x < 2 * w / 3 else 'ขวา')
    return f'{v}{hz}' if v != hz else 'กลางจอ'


def describe(n, size):
    lab = n.label().replace('\n', ' ')
    if len(lab) > 40:
        lab = lab[:38] + '…'
    kind = 'ช่องพิมพ์' if n.is_input else ('ปุ่ม' if n.clickable else 'ข้อความ')
    rid = n.rid.split(':id/')[-1] if n.rid else ''
    parts = [f'“{lab}”' if lab else '[ไอคอนไม่มีชื่อ]', kind, position_word(n, size)]
    if rid:
        parts.append(f'id:{rid}')
    return ' · '.join(parts)


def teach_candidates(nodes, size, prefer_input=False):
    vis = [n for n in nodes if n.visible(size)]
    items, seen = [], set()
    for n in vis:
        if not (n.clickable or n.is_input or n.text or n.desc):
            continue
        if n.area > 0.5 * size[0] * size[1]:  # พื้นหลัง/ทั้งหน้า
            continue
        if n.bounds in seen:
            continue
        seen.add(n.bounds)
        items.append(n)
    items.sort(key=lambda n: (not (prefer_input and n.is_input), n.bounds[1] // 20, n.bounds[0]))
    return items[:60]


def selector_for(n, nodes, size):
    """สร้างตัวค้นหาจากปุ่มที่ผู้ใช้เลือก: id → ข้อความ → คำอธิบาย → ตำแหน่ง"""
    vis = [x for x in nodes if x.visible(size)]
    short = n.rid.split(':id/')[-1] if n.rid else ''
    rid_ok = len(short) > 1 and not short.isdigit()  # id ที่เป็นตัวเลขล้วน/ว่าง ใช้จำไม่ได้
    if rid_ok:
        sel = {'id': n.rid}
    elif n.text:
        sel = {'text': n.text}
    elif n.desc:
        sel = {'desc': n.desc}
    else:
        lab_node = next((d for d in n.descendants() if d.text or d.desc), None)
        if lab_node is not None:
            sel = {'text': lab_node.text} if lab_node.text else {'desc': lab_node.desc}
            n = lab_node
        else:
            x, y = n.center
            return {'class': n.cls, 'pos': [round(x / size[0], 3), round(y / size[1], 3)]}
    if n.is_input and 'class' not in sel:
        sel['class'] = n.cls
    ms = [x for x in vis if match(x, sel)]
    if len(ms) > 1 and n in ms:
        sel['index'] = ms.index(n)
    return sel


# ---------------------------------------------------------------- มือถือ
class Device:
    """ห่อ uiautomator2 (ใช้ตัวปลอมแทนได้ตอนทดสอบ)"""

    def __init__(self, d):
        self.d = d

    def dump(self):
        for attempt in range(3):
            try:
                return self.d.dump_hierarchy()
            except (OSError, http.client.HTTPException):
                if attempt == 2:
                    raise
                time.sleep(0.8)

    def window_size(self):
        # ADB occasionally returns an empty wm-size reply while Shopee opens
        # its camera. Retry this read only; never substitute guessed dimensions.
        for attempt in range(3):
            try:
                size = tuple(self.d.window_size())
                if len(size) != 2 or not all(isinstance(v, int) and not isinstance(v, bool) and v > 0 for v in size):
                    raise ValueError('invalid native window dimensions')
                return size
            except Exception as exc:
                if attempt == 2:
                    raise PhoneUiUnavailable('อ่านขนาดหน้าจอมือถือไม่สำเร็จหลังตรวจ 3 ครั้ง จึงเก็บไฟล์ไว้') from exc
                print(f'  ⏳ อ่านขนาดจอไม่ได้ชั่วคราว ตรวจใหม่ ({attempt + 2}/3)', flush=True)
                time.sleep(attempt + 1)

    def click(self, x, y):
        self.d.click(x, y)

    def press(self, key):
        self.d.press(key)

    def type_text(self, text):
        try:
            # Native setText replaces the entire value. Clipboard clear/paste
            # can leave a fragment of the old caption on this Redmi.
            self.d(focused=True).set_text(text)
        except Exception:
            self.d.send_keys(text, clear=True)

    def set_text_focused(self, text):
        self.d(focused=True).set_text(text)

    def set_clipboard(self, text):
        self.d.set_clipboard(text)

    def push(self, src, dst):
        self.d.push(str(src), dst)

    def shell(self, cmd):
        r = self.d.shell(cmd)
        return getattr(r, 'output', r) or ''

    def app_start(self, pkg, restart=True):
        self.d.app_start(pkg, stop=restart)

    def screenshot(self, path):
        self.d.screenshot(str(path))


def connect(settings):
    try:
        import adbutils
        import uiautomator2 as u2
    except ImportError:
        print('❌ ยังไม่ได้ลงโปรแกรมเสริม — ดับเบิลคลิก start.bat (จะลงให้เอง) หรือพิมพ์: py -m pip install -r requirements.txt')
        return None
    try:
        infos = adbutils.adb.list()
    except Exception as e:
        print(f'❌ เปิดตัวเชื่อมมือถือ (adb) ไม่ได้: {e}')
        return None
    ready = [i for i in infos if i.state == 'device']
    if not ready:
        if any(i.state == 'unauthorized' for i in infos):
            print('📱 เจอมือถือแล้ว แต่ยังไม่ได้อนุญาต → ปลดล็อกจอมือถือ แล้วกด "อนุญาต" (ติ๊ก อนุญาตจากคอมนี้เสมอ)')
        elif infos:
            print(f'📱 เจอมือถือแต่สถานะ {infos[0].state} — ถอดสายแล้วเสียบใหม่')
        else:
            print('📱 ยังไม่เจอมือถือ' + USB_HELP)
        return None
    serial = settings.get('serial')
    if serial and not any(i.serial == serial for i in ready):
        print(f'❌ มือถือที่เลือก ({serial}) ยังไม่พร้อม — เลือกเครื่องใหม่ในหน้า UI')
        return None
    if not serial and len(ready) > 1:
        print('❌ มีมือถือพร้อมหลายเครื่อง — เลือกเครื่องในหน้า UI หรือระบุ serial ใน settings.json ก่อน')
        return None
    serial = serial or ready[0].serial
    settings['serial'] = serial
    print('🔌 กำลังเชื่อมกับมือถือ (ครั้งแรกอาจนาน 1–2 นาที)...')
    try:
        d = u2.connect(serial)
        info = d.info
        print(f'✅ เชื่อมแล้ว: {serial} · จอ {info.get("displayWidth")}x{info.get("displayHeight")}')
    except Exception as e:
        print(f'❌ เชื่อมไม่สำเร็จ: {e}\n   ลอง: ถอดสาย–เสียบใหม่ · Xiaomi ให้เปิด "USB debugging (Security settings)"')
        return None
    return Device(d)


# ---------------------------------------------------------------- ทำทีละขั้น
class SafeDict(dict):
    def __missing__(self, k):
        return ''


def dismiss_popup(dev, nodes, size, popups, step=None):
    """ปิดหน้าต่างเด้ง (ขออนุญาต/แนะนำ) — ยกเว้นปุ่มนั้นคือปุ่มที่ขั้นนี้ต้องกดอยู่แล้ว"""
    require_accessible_screen(nodes, size, dev)
    names = {_norm(p) for p in popups}
    sels = (step or {}).get('find') or []
    for n in nodes:
        if n.visible(size) and n.text and _norm(n.text) in names:
            try:
                if any('pos' not in sel and match(n, sel) for sel in sels):
                    continue
            except re.error:
                pass
            x, y = tap_point(n, size)
            dev.click(x, y)
            return n.text
    return None


def screen(dev):
    size = dev.window_size()
    try:
        nodes = parse_nodes(dev.dump())
    except ET.ParseError:
        nodes = []
    return size, nodes


def screen_product_ids(nodes, size):
    identities = {}
    for n in nodes:
        parent = n
        while parent and not parent.is_input:
            parent = parent.parent
        if parent or not n.visible(size):
            continue
        for identity in products.identities_in_text(' '.join((n.text, n.desc, n.hint))):
            identities[(identity['item_id'], identity.get('shop_id', ''))] = identity
    return products.unique_identities(list(identities.values()))


def inspect_current_product(dev, copy_link=True):
    """Read the current Shopee product; copy a fresh share link when native UI hides IDs."""
    if dev.d.app_current().get('package') != PKG:
        return None, 'screen', 'เปิดแอป Shopee และหน้ารายละเอียดสินค้าที่ปักไว้ก่อน'
    size, nodes = screen(dev)
    ids = screen_product_ids(nodes, size)
    if len(ids) == 1:
        return ids[0], 'screen', ''
    if len(ids) > 1:
        return None, 'screen', 'พบหลายรหัสบนหน้าจอ — เปิดรายละเอียดสินค้าเพียงตัวเดียว'
    if not copy_link:
        return None, 'screen', 'หน้าจอนี้ไม่แสดง Item ID ของสินค้าที่ปักไว้'
    share = find_target(nodes, [
        {'textRegex': '(?i)^(แชร์|แชร์สินค้า|แชร์เพื่อสร้างรายได้|Share|Share product)$'},
        {'descRegex': '(?i)^(แชร์|แชร์สินค้า|Share|Share product)$'}], size)
    if not share:
        return None, 'screen', 'เปิดรายละเอียดสินค้าที่ปักไว้ หรือคัดลอกลิงก์สินค้านั้นมาให้ตรวจ'
    cleared = False
    try:
        old_clipboard = dev.d.clipboard or ''
    except Exception:
        return None, 'clipboard', 'อ่านคลิปบอร์ดมือถือไม่ได้ — คัดลอกลิงก์สินค้ามาวางในช่องคำตอบ'
    try:
        dev.set_clipboard('')
        cleared = True
    except Exception:
        pass  # Samsung permits reads but rejects shell clipboard writes.
    share_open = False
    try:
        perform(dev, {'do': 'tap'}, share, size, {})
        share_open = True
        time.sleep(0.6)
        size, nodes = screen(dev)
        copy = find_target(nodes, [
            {'textRegex': '(?i)^(คัดลอกลิงก์|คัดลอกลิงค์|Copy link|Copy Link)$'},
            {'descRegex': '(?i)^(คัดลอกลิงก์|คัดลอกลิงค์|Copy link)$'}], size)
        if not copy:
            return None, 'clipboard', 'ไม่พบปุ่มคัดลอกลิงก์ — คัดลอกลิงก์สินค้ามาวางในช่องคำตอบ'
        try:
            dev.d.clear_toast()
        except Exception:
            pass
        perform(dev, {'do': 'tap'}, copy, size, {})
        for _ in range(5):
            time.sleep(0.3)
            fresh = dev.d.clipboard or ''
            links = products.URL_RE.findall(fresh)
            toast = ''
            try:
                toast = dev.d.last_toast or ''
            except Exception:
                pass
            confirmed = isinstance(toast, str) and re.search(r'(?i)(คัดลอก|copied)', toast) and not re.search(r'(?i)(ไม่สำเร็จ|failed|error)', toast)
            if links and (cleared or fresh != old_clipboard or confirmed):
                result = products.resolve_link(links[0])
                return (result if result['status'] == 'resolved' else None), 'phone_share_link', result.get('error', '')
        return None, 'clipboard', 'คัดลอกแล้วแต่ยังอ่านลิงก์ไม่ได้'
    finally:
        try:
            if cleared:
                dev.set_clipboard(old_clipboard)
            if share_open:
                size, nodes = screen(dev)
                if find_target(nodes, [{'textRegex': '(?i)^(คัดลอกลิงก์|คัดลอกลิงค์|Copy link)$'}], size):
                    dev.press('back')
        except Exception:
            pass


def product_check(settings, expected, actual, method, error=''):
    result = products.compare(expected, actual, method)
    if error and result['status'] == 'unavailable':
        result['message'] = error
    print(f'  🔎 Item ID ที่ต้องปัก: {expected.get("item_id") or "ยังไม่ทราบ"} · บนมือถือ: {(actual or {}).get("item_id") or "ยังอ่านไม่ได้"}')
    print('  ' + ('✅ ' if result['status'] == 'matched' else '⚠ ') + result['message'])
    callback = settings.get('_product_callback')
    if callback:
        callback(result)
    return result


def choose_correct_product(dev, step, ctx, flow, settings, ask):
    """Click Add only inside a product row that exposes the expected identity."""
    while True:
        size, nodes = screen(dev)
        buttons = [n for n in nodes if n.visible(size) and n.enabled and any(
            'pos' not in sel and match(n, sel) for sel in step.get('find', []))]
        matched = []
        for button in buttons:
            row = button
            while row.parent:
                next_row = row.parent
                if sum(b is next_row or b in list(next_row.descendants()) for b in buttons) > 1:
                    break
                row = next_row
            ids = screen_product_ids([row, *row.descendants()], size)
            if len(ids) == 1 and products.compare(ctx['product'], ids[0])['status'] == 'matched':
                matched.append(button)
        if len(matched) == 1:
            perform(dev, step, ('node', matched[0]), size, ctx)
            time.sleep(step.get('after', 1.8))
            return 'ok'
        print(f'  ⚠ ยังยืนยันรหัสในผลค้นหาไม่ได้ — สินค้าที่ต้องเลือก Item ID {ctx["product"]["item_id"]}')
        if settings.get('auto_post'):
            raise StepFailed('ยังเลือกสินค้าไม่ได้ จึงหยุดคิวอัตโนมัติ')
        ans = ask('  เลือกและปักสินค้าที่ถูกต้องบนมือถือ แล้วกด Enter · r = ตรวจผลค้นหาใหม่ · s = ข้าม · q = หยุด: ').strip().lower()
        if ans == 'q':
            raise Quit()
        if ans == 's':
            return 'skipped'
        if ans == '':
            return 'ok'  # Final basket verification still runs before posting.


def single_import_publish_ready(nodes, size, ctx):
    """Recognize an already completed import without another confirmation tap."""
    imported = ctx.get('_verified_import') or {}
    if imported.get('method') != 'single_link_import' or not imported.get('title'):
        return False
    visible = [n for n in nodes if n.visible(size)]
    captions = [n for n in visible if n.rid.endswith(':id/et_caption')]
    titles = [n for n in visible if n.rid.endswith(':id/tv_product_title')]
    return (len(captions) == 1 and bool(ctx.get('caption_full'))
            and caption_matches(captions[0].text, ctx['caption_full'])
            and len(titles) == 1 and titles[0].text == imported['title']
            and any(n.rid.endswith(':id/btn_post') for n in visible))


def verify_basket(dev, ctx, settings, flow, ask):
    post_step = next((s for s in flow if s.get('do') == 'post'), None)
    if not post_step:
        raise StepFailed('ไม่มีขั้นตอนโพสต์ จึงยืนยันหน้าตะกร้าไม่ได้')
    verified_import = ctx.get('_verified_import') or {}
    single_import = verified_import.get('method') == 'single_link_import'
    if single_import:
        if dev.d.app_current().get('package') != PKG:
            raise StepFailed('ยังไม่ได้อยู่ใน Shopee จึงยืนยันตะกร้าไม่ได้')
        # This path uses the exact imported title, full caption and native Post
        # control below. Reading product IDs from a second hierarchy adds no proof.
        actual, method, error = None, 'single_link_import', ''
    else:
        actual, method, error = inspect_current_product(dev, copy_link=False)
    size, nodes = screen(dev)
    require_accessible_screen(nodes, size, dev)
    captions = [n for n in nodes if n.visible(size) and n.rid.endswith(':id/et_caption')]
    if len(captions) != 1 or not caption_matches(captions[0].text, ctx.get('caption_full', '')):
        raise StepFailed('แคปชันเปลี่ยนไปหลังเตรียม จึงหยุดก่อนเผยแพร่')
    titles = [n for n in nodes if n.visible(size) and n.rid.endswith(':id/tv_product_title')]
    if single_import:
        if single_import_publish_ready(nodes, size, ctx) and find_target(nodes, post_step.get('find'), size):
            result = {'status': 'matched', 'message': 'ตะกร้ามีสินค้า 1 รายการที่นำเข้าจากลิงก์ของคลิป',
                      'expected': ctx['product'], 'actual': None, 'method': 'single_link_import'}
            print('  ✅ ' + result['message'])
            callback = settings.get('_product_callback')
            if callback:
                callback(result)
            return True
        raise StepFailed('สินค้าที่เพิ่มไว้ไม่ตรงกับรายการนำเข้า จึงหยุดก่อนเผยแพร่')
    if actual is None and verified_import and len(titles) == 1 and titles[0].text == verified_import['title']:
        actual, method, error = verified_import['identity'], 'verified_link_import', ''
    evidence = product_check(settings, ctx['product'], actual, method, error)
    size, nodes = screen(dev)
    if evidence['status'] == 'matched' and find_target(nodes, post_step.get('find'), size):
        return True
    if settings.get('auto_post'):
        raise StepFailed('สินค้าที่ปักยังไม่ตรง จึงหยุดคิวอัตโนมัติ')
    while True:
        ans = ask('  เปิดรายละเอียดสินค้าที่ปักไว้บนมือถือ แล้วกด r เพื่อตรวจ Item ID (หรือวางลิงก์ของสินค้าที่ปักไว้) · เมื่อตรวจตรงแล้วกลับหน้าโพสต์และกด Enter · s = ข้าม · q = หยุด: ').strip()
        if ans.lower() == 'q':
            raise Quit()
        if ans.lower() == 's':
            return False
        if ans.lower() == 'r':
            actual, method, error = inspect_current_product(dev)
            evidence = product_check(settings, ctx['product'], actual, method, error)
        elif products.allowed_url(ans):
            actual = products.resolve_link(ans)
            evidence = product_check(settings, ctx['product'], actual if actual['status'] == 'resolved' else None,
                                     'pasted_pinned_link', actual.get('error', ''))
        elif ans == '':
            size, nodes = screen(dev)
            if evidence['status'] == 'matched' and dev.d.app_current().get('package') == PKG and find_target(nodes, post_step.get('find'), size):
                return True
            print('  ⚠ ต้องตรวจรหัสให้ตรง และกลับหน้าโพสต์ให้เห็นปุ่มโพสต์ก่อน')


def keyboard_visible(dev, nodes, size):
    # Android's IME flags can remain true after the keyboard closes. Require
    # actual visible nodes belonging to the selected keyboard before Back.
    current = re.search(r'\bmCurMethodId=([^\s/]+)/', dev.shell('dumpsys input_method'))
    if not current:
        return False
    package = current.group(1)
    return any(n.visible(size) and (getattr(n, 'package', '') == package
               or (isinstance(n.rid, str) and n.rid.startswith(package + ':'))) for n in nodes)


def finish_caption(dev, text):
    size, nodes = screen(dev)
    if keyboard_visible(dev, nodes, size):
        dev.press('back')
        time.sleep(.4)
        size, nodes = screen(dev)
    # On slow phones IME visibility can lag behind the actual keyboard. Back
    # then opens Shopee's discard dialog. Cancel only this exact dialog and
    # recheck the original caption; never discard edits or authorize a post.
    discard = any(n.visible(size) and n.rid.endswith(':id/content')
                  and n.text == 'หากคุณกดย้อนกลับ การแก้ไขทั้งหมดจะถูกละทิ้ง' for n in nodes)
    if discard:
        cancel = find_target(nodes, [{'idRegex': r':id/buttonDefaultNegative$', 'text': 'ยกเลิก'}], size)
        positive = any(n.visible(size) and n.rid.endswith(':id/buttonDefaultPositive')
                       and n.text == 'Discard' for n in nodes)
        if not cancel or not positive:
            raise StepFailed('หน้าต่างแก้ไขแคปชันยังไม่พร้อม จึงเก็บข้อความไว้และหยุดก่อนเผยแพร่')
        perform(dev, {'do': 'tap'}, cancel, size, {})
        time.sleep(.4)
        size, nodes = screen(dev)
        print('  ↪ คีย์บอร์ดปิดอยู่แล้ว ยกเลิกหน้าต่างทิ้งการแก้ไขและตรวจแคปชันเดิม')
    if not any(n.is_input and caption_matches(n.text, text) for n in nodes):
        raise StepFailed('คำบรรยายหลังปิดคีย์บอร์ดไม่ตรงกับคลิป จึงหยุดก่อนเผยแพร่')
    if any(n.rid.endswith(':id/btn_top_back') and n.text == 'เพิ่มแคปชั่น' for n in nodes):
        done = find_target(nodes, [{'idRegex': r':id/tv_right$', 'text': 'ตกลง'}], size)
        if not done and not any(n.rid.endswith(':id/btn_post') and n.visible(size) for n in nodes):
            raise StepFailed('ไม่พบปุ่มบันทึกแคปชัน จึงหยุดก่อนเผยแพร่')
        if done:
            perform(dev, {'do': 'tap'}, done, size, {})


def perform(dev, step, target, size, ctx):
    kind, val = target
    if step.get('do') == 'type' and kind == 'node' and val.is_input:
        text = step.get('value', '').format_map(SafeDict(ctx))
        # Native replacement does not require opening/closing the IME. A stale
        # mInputShown flag must not navigate away from the caption/link dialog.
        selector = {'resourceId': val.rid} if val.rid else {'className': val.cls}
        field = dev.d(**selector)
        if field.count != 1:
            raise StepFailed('พบช่องพิมพ์หลายช่อง จึงไม่ใส่ข้อความอัตโนมัติ')
        field.set_text(text)
        time.sleep(.8)
        _, nodes = screen(dev)
        if not any(n.is_input and n.rid == val.rid and caption_matches(n.text, text) for n in nodes):
            raise StepFailed('ข้อความในมือถือไม่ตรงกับคลิป จึงหยุดก่อนเผยแพร่')
        if step.get('submit'):
            dev.press('enter')
        if step.get('id') == 'caption':
            finish_caption(dev, text)
        return
    x, y = val if kind == 'point' else tap_point(val, size)
    if step['do'] == 'post':
        # Use the observed button's coordinates without UiAutomator's idle wait.
        # The receipt watcher must be active before this tap can finish uploading.
        dev.shell(f'input tap {x} {y}')
        return
    dev.click(x, y)
    if step['do'] != 'type':
        return
    text = step.get('value', '').format_map(SafeDict(ctx))
    time.sleep(0.8)
    dev.type_text(text)
    time.sleep(0.8)
    # ตรวจว่าข้อความเข้าช่องจริง (บางแอปต้องใช้ set_text)
    _, nodes = screen(dev)
    head = text.replace('\n', ' ')[:10]
    if head and not any(n.is_input and head in n.text.replace('\n', ' ') for n in nodes):
        try:
            dev.set_text_focused(text)
        except Exception:
            pass
    if step.get('submit'):
        time.sleep(0.4)
        dev.press('enter')
    if step.get('id') == 'caption':
        finish_caption(dev, text)


def require_prepost_foreground(dev, nodes, size):
    # A launcher can contain a Gallery/Video shortcut too. Never apply the
    # posting flow's text selectors there after an Android ANR closes Shopee.
    launcher = any(n.visible(size) and (n.package == 'com.miui.home'
                   or n.rid.startswith('com.miui.home:id/')) for n in nodes)
    if not launcher:
        return True
    current = dev.d.app_current()
    if current.get('package') != 'com.miui.home':
        return False  # Wait for a fresh frame; never click a launcher shortcut.
    if not dev.shell('pidof ' + PKG).strip():
        raise PhoneAppExited('แอป Shopee ปิดตัวเองก่อนเปิดกล้อง จึงยังไม่ได้เลือกคลิปหรือโพสต์')
    return False  # A live cold start may show the launcher until its first frame.


def open_video_camera(dev, settings):
    """Enter the Video creator and require its native camera/picker before advancing."""
    started = time.monotonic()
    timeout = max(15, float(settings.get('ui_timeout_seconds', 60)))
    deadline = started + timeout
    camera_wait = max(timeout, float(settings.get('gallery_timeout_seconds', 120)))
    camera_deadline = started + camera_wait
    camera_grace = False
    video_taps = create_taps = 0
    video_at = create_at = float('-inf')
    while True:
        size, nodes = screen(dev)
        size, nodes = recover_identity_screen(dev, settings, size, nodes)
        foreground_ready = not settings.get('auto_post') or require_prepost_foreground(dev, nodes, size)
        native = {n.rid for n in nodes if n.visible(size)}
        if native.intersection({PKG + ':id/ll_gallery_entrance', PKG + ':id/tv_gallery_entrance',
                                PKG + ':id/lyt_pick_title'}):
            print('  ✅ หน้าสร้างวิดีโอพร้อมแล้ว พบปุ่มคลังภาพหรือหน้าคลังจริง')
            return 'ok'
        now = time.monotonic()
        if now >= deadline:
            current = dev.d.app_current()
            if (not camera_grace and now < camera_deadline and current.get('package') == PKG
                    and current.get('activity', '').endswith('.SSZMediaActivity')):
                # The old Redmi can enter the camera before its gallery controls
                # become accessible. Keep that camera open for one bounded grace.
                camera_grace = True
                deadline = camera_deadline
                print('  ⏳ เปิดหน้ากล้องแล้ว รอปุ่มคลังภาพโหลดเพิ่มโดยไม่เริ่มแอปใหม่')
            else:
                raise PhoneUiUnavailable('ยังเข้าหน้าสร้างวิดีโอไม่สำเร็จ จึงยังไม่เปิดคลังหรือเลือกไฟล์')
        if not foreground_ready:
            time.sleep(.5)
            continue
        if dismiss_popup(dev, nodes, size, settings.get('popups', [])):
            time.sleep(.8)
            continue
        upper = [n for n in nodes if n.visible(size) and n.center[1] < size[1] * .25]
        video = next((n for n in upper if n.text in ('วิดีโอ', 'Video')
                      and any(m.text == 'Live' and abs(m.center[1] - n.center[1]) < 40 for m in upper)), None)
        live_player = any(n.visible(size) and n.rid.endswith(':id/tv_audience_viewer_num') for n in nodes)
        if video and (video_taps == 0 or (live_player and video_taps < 2 and now - video_at >= 8)):
            dev.click(*video.center)
            video_taps += 1
            video_at = now
            print('  ↪ เลือกแท็บวิดีโอก่อนเปิดหน้าสร้างคลิป')
            time.sleep(1)
            continue
        creator = next((n for n in upper if n.desc == 'click top right create icon'), None)
        if creator and video_taps and not live_player and create_taps < 2 and now - create_at >= 8:
            # The icon also exists over Live. Only the observed Video hub may
            # open this creator; a successful tap alone is not a camera proof.
            dev.click(*creator.center)
            if create_taps == 0:
                # Give the observed creator action its full camera-load budget.
                # Time spent finding the Video hub must not consume that budget;
                # app_current can still report the old activity during transition.
                # A second ignored tap never extends this deadline again.
                deadline = max(deadline, now + camera_wait)
                camera_grace = True
            create_taps += 1
            create_at = now
            print(f'  ▶ เปิดหน้าสร้างวิดีโอ ({create_taps}/2) แล้วรอปุ่มคลังภาพจริง')
            time.sleep(float(settings.get('camera_load_wait_seconds', 2)))
            continue
        time.sleep(.5)


def product_picker_ready(nodes, size):
    visible = [n for n in nodes if n.visible(size)]
    # The caption page also says เพิ่มสินค้า, below the caption field. Only
    # the picker's top heading authorizes its otherwise unnamed link icon.
    return (any(n.text == 'เพิ่มสินค้า' and n.center[1] < size[1] * .16 for n in visible)
            and not any(n.rid.endswith((':id/et_caption', ':id/btn_post')) for n in visible))


def product_link_field(nodes, size):
    visible = [n for n in nodes if n.visible(size)]
    fields = [n for n in visible if n.is_input and not n.rid.endswith(':id/et_caption')]
    # Before text is entered Shopee shows วางลิงก์, and only reveals
    # นำเข้า after native setText. Recognize the observed empty form too.
    link_form = (any(n.text == 'นำเข้า' for n in visible)
                 or (any(n.text == 'ลิงก์สินค้า' for n in visible)
                     and any(n.text == 'รายการสินค้า' for n in visible)))
    if (len(fields) == 1 and link_form
            and any(n.text == 'กรอกลิงก์สินค้า' for n in visible)):
        return fields[0]
    return None


def open_product_link(dev, step, ctx, settings):
    deadline = time.monotonic() + max(15, float(settings.get('ui_timeout_seconds', 60)))
    taps = 0
    last_tap = float('-inf')
    while True:
        size, nodes = screen(dev)
        size, nodes = recover_identity_screen(dev, settings, size, nodes)
        if product_link_field(nodes, size) is not None:
            return 'ok'
        now = time.monotonic()
        if now >= deadline:
            raise PhoneUiUnavailable('หน้าลิงก์สินค้ายังไม่พร้อม จึงหยุดก่อนกรอกลิงก์หรือโพสต์')
        # Never apply a saved coordinate to a loading screen, caption page,
        # or unrelated Shopee page. A tap is not proof that the dialog opened.
        if product_picker_ready(nodes, size) and taps < 2 and now - last_tap >= 8:
            target = find_target(nodes, step.get('find'), size)
            if target:
                perform(dev, step, target, size, ctx)
                taps += 1
                last_tap = now
                time.sleep(.8)
                continue
        time.sleep(.5)


def run_step(dev, step, ctx, flow, settings, ask=input, teach_on=True):
    do = step.get('do')
    if do == 'start_app':
        dev.d.screen_on()
        restart = settings.pop('_restart_app_once', False) or not settings.get('reuse_app_session', False)
        dev.app_start(PKG, restart=restart)
        # The next step already polls for its visible control. Give the app a
        # short settling interval instead of waiting even when it is ready.
        time.sleep(float(step.get('after', settings.get('startup_wait_seconds', 2))))
        return 'ok'
    if do == 'post' and (settings.get('_prepare_only') or not settings.get('auto_post')):
        return 'handoff'
    if step.get('id') == 'create' and settings.get('auto_post'):
        return open_video_camera(dev, settings)
    if step.get('id') == 'product_link':
        return open_product_link(dev, step, ctx, settings)
    timeout = float(step.get('timeout', 15))
    if step.get('id') == 'gallery':
        timeout = max(timeout, float(settings.get('gallery_timeout_seconds', 120)))
    if not step.get('optional'):
        timeout = max(timeout, float(settings.get('ui_timeout_seconds', 60)))
    deadline = time.time() + timeout
    size, nodes = screen(dev)
    if step.get('id') == 'gallery' and settings.get('auto_post'):
        size, nodes = recover_identity_screen(dev, settings, size, nodes)
        if any(n.visible(size) and n.rid == PKG + ':id/lyt_pick_title' for n in nodes):
            print('  ↪ คลังวิดีโอเปิดอยู่แล้ว ต่อด้วยอัลบั้มเฉพาะของงาน')
            return 'ok'
    if step.get('id') == 'import_product' and keyboard_visible(dev, nodes, size):
        inputs = [n for n in nodes if n.is_input and n.visible(size) and n.text.strip() == ctx.get('search')]
        if (len(inputs) != 1 or ctx.get('search') != ctx['product'].get('product_url')
                or not any(n.visible(size) and n.text == 'กรอกลิงก์สินค้า' for n in nodes)):
            raise StepFailed('ลิงก์สินค้าไม่ตรงกับงาน จึงไม่ปิดหรือเปลี่ยนหน้าจอ')
        dev.press('back')
        time.sleep(.4)
        size, nodes = screen(dev)
        if (not any(n.visible(size) and n.text == 'กรอกลิงก์สินค้า' for n in nodes)
                and any(n.visible(size) and n.text == 'เพิ่มสินค้า' for n in nodes)):
            # This Shopee view sometimes handles Back as navigation even while
            # Gboard is visible. Reopen once, without typing or clearing the URL.
            link_step = next((s for s in flow if s.get('id') == 'product_link'), None)
            if not link_step or run_step(dev, link_step, ctx, flow, settings, ask, teach_on=False) != 'ok':
                raise StepFailed('ยังกลับหน้าลิงก์เดิมไม่ได้ จึงหยุดก่อนเผยแพร่')
            size, nodes = screen(dev)
            print('  ↪ Shopee ปิดหน้าลิงก์พร้อมคีย์บอร์ด เปิดกลับหนึ่งครั้งและตรวจลิงก์เดิม')
    while True:
        size, nodes = recover_identity_screen(dev, settings, size, nodes)
        if (step.get('id') == 'confirm_product' and step.get('optional')
                and single_import_publish_ready(nodes, size, ctx)
                and dev.d.app_current().get('package') == PKG):
            # Add(1) already returned to the exact prepared publish page. The
            # mandatory basket check still runs before Post; do not wait 8s here.
            return 'skipped'
        if step.get('id') == 'video_tab' and settings.get('auto_post'):
            if not require_prepost_foreground(dev, nodes, size):
                if time.time() > deadline:
                    break
                time.sleep(1)
                size, nodes = screen(dev)
                continue
        # หน้าต่างเด้งบังอยู่ → ปิดก่อน (ปุ่มข้างหลังกดไม่ได้จริง)
        closed = dismiss_popup(dev, nodes, size, settings.get('popups', []), step)
        if closed:
            print(f'    ↪ ปิดหน้าต่าง “{closed}”')
            time.sleep(1.2)
            size, nodes = screen(dev)
            continue
        if step.get('id') == 'search_product' and settings.get('product_search', 'link') == 'link':
            field = product_link_field(nodes, size)
            target = ('node', field) if field is not None else None
        else:
            target = find_target(nodes, step.get('find'), size)
        if target:
            fresh_toast = False
            if do == 'post':
                receipt = PostReceipt(dev)
                receipt.start()
                settings['_post_receipt'] = receipt
                settings['_toast_cleared'] = True
            if step.get('id') == 'import_product':
                # Import one exact source URL, then require a single result. This avoids
                # opening a product page merely to copy the same link again.
                inputs = [n for n in nodes if n.is_input and n.visible(size) and n.text.strip() == ctx.get('search')]
                if (len(inputs) != 1 or ctx.get('search') != ctx['product'].get('product_url')
                        or not any(n.visible(size) and n.text == 'กรอกลิงก์สินค้า' for n in nodes)):
                    raise StepFailed('ต้องใส่ลิงก์ของคลิปนี้ให้ครบก่อนนำเข้า')
                ctx['_requested_import'] = ctx['product']
                try:
                    dev.d.clear_toast()
                    fresh_toast = True
                except Exception:
                    pass
            try:
                perform(dev, step, target, size, ctx)
            except Exception:
                if do == 'post':
                    receipt.close()
                raise
            verified_input = (do == 'type' and step.get('id') in ('caption', 'search_product')
                              and target[0] == 'node' and target[1].is_input and not step.get('submit'))
            # Native replacement already reread and matched every character.
            # The next step polls for its own control instead of sleeping again.
            default_delay = 0 if verified_input else 1.8
            delay = .2 if do == 'post' else float(step.get('after', default_delay))
            if step.get('id') == 'create':
                delay = float(settings.get('camera_load_wait_seconds', 2))
                print(f'    ⏳ รอหน้าถ่ายวิดีโอโหลด {delay:g} วินาที')
            elif step.get('id') == 'gallery':
                delay = float(settings.get('gallery_load_wait_seconds', 1))
                print(f'    ⏳ รอคลังวิดีโอโหลด {delay:g} วินาที')
            time.sleep(delay)
            if fresh_toast:
                try:
                    message = dev.d.last_toast or ''
                except Exception:
                    message = ''
                if isinstance(message, str) and 'นำเข้าไม่สำเร็จ' in message:
                    raise StepFailed('Shopee แจ้ง: ' + message)
            return 'ok'
        if time.time() > deadline:
            break
        time.sleep(1)
        size, nodes = screen(dev)
    if step.get('optional'):
        return 'skipped'
    if settings.get('auto_post'):
        if step.get('id') in ('video_tab', 'create', 'gallery', 'next1', 'next2', 'search_product'):
            raise PhoneUiUnavailable('หน้าจอยังไม่พร้อมที่ขั้น ' + step.get('say', step.get('id', '')))
        raise StepFailed('ไม่พบปุ่ม ' + step.get('say', step.get('id', '')) + ' จึงหยุดงานอัตโนมัติ')
    if not teach_on:
        raise StepFailed(step.get('id'))
    return teach(dev, step, ctx, flow, size, nodes, ask)


def teach(dev, step, ctx, flow, size, nodes, ask):
    print(f'\n🟡 หา “{step.get("say", step.get("id"))}” ไม่เจอบนหน้าจอ')
    if step['do'] == 'type':
        text = step.get('value', '').format_map(SafeDict(ctx))
        try:
            dev.set_clipboard(text)
            print('   (ข้อความที่ต้องใส่อยู่ในคลิปบอร์ดมือถือแล้ว — ถ้ากดเองให้กดค้างในช่องแล้ว "วาง")')
        except Exception:
            pass
    while True:
        items = teach_candidates(nodes, size, prefer_input=step['do'] == 'type')
        if items:
            print('   ปุ่ม/ช่องบนจอมือถือตอนนี้:')
            for i, n in enumerate(items, 1):
                print(f'   {i:>2}) {describe(n, size)}')
        else:
            print('   (อ่านปุ่มบนหน้านี้ไม่ได้ — ให้กดเองบนมือถือ)')
        ans = ask('   พิมพ์เลขที่ต้องกด (โปรแกรมจะจำไว้) · Enter = กดเองบนมือถือแล้วไปต่อ · r = ดูจอใหม่ · s = ข้ามขั้นนี้ · q = หยุด: ').strip().lower()
        if ans == '':
            return 'ok'
        if ans == 'q':
            raise Quit()
        if ans == 's':
            return 'skipped'
        if ans == 'r':
            size, nodes = screen(dev)
            continue
        if ans.isdigit() and 1 <= int(ans) <= len(items):
            n = items[int(ans) - 1]
            sel = selector_for(n, nodes, size)
            step.setdefault('find', []).insert(0, sel)
            save_flow(flow)
            print(f'   ✅ จำแล้ว: {json.dumps(sel, ensure_ascii=False)}')
            perform(dev, step, ('node', n), size, ctx)
            time.sleep(step.get('after', 1.8))
            return 'ok'
        print('   ไม่เข้าใจ ลองใหม่')


def push_clip(dev, clip, settings):
    import video_payload
    base = settings.get('phone_folder', DEFAULT_SETTINGS['phone_folder']).rstrip('/')
    with clip.video.open('rb') as source:
        source_digest = hashlib.file_digest(source, 'sha256').hexdigest()
    payload, digest = video_payload.prepare(clip.video, source_digest)
    upload_key = settings.get('serial', '') + '|' + clip.key
    uploads = read_json(UPLOADS_FILE, {})
    previous = uploads.get(upload_key, {})
    old_remote = previous.get('remote', '')
    owned_path = re.fullmatch(re.escape(base) + r'/SV[0-9a-f]{10}/sv_\d{8}_\d{6}_\d{3}\.mp4', old_remote)
    if owned_path and previous.get('sha256') == digest and post_cleanup.matches_source(previous, source_digest):
        remote_digest = dev.shell('sha256sum ' + shlex.quote(old_remote)).split()
        if remote_digest and remote_digest[0] == digest:
            print('  ↪ ใช้คลิปที่ส่งเข้าเครื่องนี้ไว้แล้ว (ตรวจไฟล์ตรงกับในคอม)')
            return old_remote
    album = f'SV{random.getrandbits(40):010x}'
    folder = f'{base}/{album}'
    dev.shell(f'mkdir -p {shlex.quote(folder)}')
    remote = f'{folder}/sv_{datetime.datetime.now():%Y%m%d_%H%M%S}_{random.randint(0, 999):03d}.mp4'
    dev.push(payload, remote)
    phone_digest = dev.shell('sha256sum ' + shlex.quote(remote)).split()
    if not phone_digest or phone_digest[0] != digest:
        raise StepFailed('สำเนาที่ส่งเข้ามือถือไม่ตรงกับไฟล์ในคอม จึงหยุดก่อนเผยแพร่')
    dev.shell(f'touch {shlex.quote(remote)}')
    # A broadcast alone can leave duration NULL; modern Shopee then hides the video.
    storage_path = remote.replace('/sdcard/', '/storage/emulated/0/', 1)
    dev.shell(f'content call --uri content://media --method scan_file --arg {shlex.quote(storage_path)}')
    dev.shell(f'am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d {shlex.quote("file://" + remote)}')
    time.sleep(2)
    history = list(previous.get('previous_uploads', []))
    if previous.get('remote'):
        history.append({k: v for k, v in previous.items() if k != 'previous_uploads'})
    uploads[upload_key] = {'remote': remote, 'sha256': digest, 'source_sha256': source_digest,
                           'payload': str(payload.resolve()) if payload != clip.video else None,
                           'previous_uploads': history}
    write_json(UPLOADS_FILE, uploads)
    return remote


def import_product_rows(nodes, size):
    rows = {}
    for price in nodes:
        if not price.visible(size) or not re.match(r'^฿\d', price.text):
            continue
        row = price.parent
        while row and row.area < size[0] * size[1] * .4:
            texts = [n for n in row.descendants() if n.visible(size) and n.text]
            titles = [n for n in texts if len(n.text) > 20 and not n.is_input and 'ค่าคอม' not in n.text and 'ขายแล้ว' not in n.text]
            if titles:
                title = titles[0]
                rows[title.text] = title
                break
            row = row.parent
    return list(rows.values())


def choose_imported_product(dev, ctx, settings):
    deadline = time.time() + max(20, float(settings.get('ui_timeout_seconds', 60)))
    while True:
        size, nodes = screen(dev)
        rows = import_product_rows(nodes, size)
        if rows or time.time() > deadline:
            break
        time.sleep(.6)
    if len(rows) != 1 or not any(n.text == 'กรอกลิงก์สินค้า' for n in nodes):
        raise StepFailed('ต้องนำเข้าจากลิงก์นี้ได้สินค้าเพียงตัวเดียว จึงจะปักอัตโนมัติ')
    if ctx.get('_requested_import') != ctx['product'] or any(n.is_input and n.text.strip() == ctx.get('search') for n in nodes):
        raise StepFailed('ยังยืนยันว่ารายการนี้นำเข้าจากลิงก์ของคลิปไม่ได้')
    title = rows[0].text
    select = find_target(nodes, [{'text': 'เลือกทั้งหมด'}], size)
    if not select:
        raise StepFailed('ไม่พบปุ่มเลือกสินค้าที่ตรวจแล้ว')
    perform(dev, {'do': 'tap'}, select, size, {})
    time.sleep(.6)
    select_deadline = time.time() + max(10, float(settings.get('ui_timeout_seconds', 60)))
    while True:
        size, nodes = screen(dev)
        add = find_target(nodes, [{'textRegex': r'^เพิ่ม\s*\(1\)$'}], size)
        if add or time.time() >= select_deadline:
            break
        time.sleep(.6)
    if not add:
        raise StepFailed('ต้องเลือกสินค้าได้หนึ่งตัวเท่านั้น')
    perform(dev, {'do': 'tap'}, add, size, {})
    time.sleep(1)
    ctx['_verified_import'] = {'title': title, 'identity': ctx['product'], 'method': 'single_link_import'}
    print('  ✅ เลือกและเพิ่มสินค้า 1 รายการจากลิงก์ของคลิปแล้ว')
    return 'ok'


def toggle_state(picture, node):
    if node.checkable:
        return node.checked
    crop = picture.crop(node.bounds).convert('RGB')
    w, h = crop.size
    if w < 20 or h < 10 or not 1.3 < w / h < 3:
        return None
    pixels = list(crop.getdata())
    green = sum(g > 100 and g > r * 1.35 and g > b * 1.2 for r, g, b in pixels)
    # Custom Shopee switches omit checked from accessibility. Confirm knob position too.
    bright = [(i % w, i // w) for i, (r, g, b) in enumerate(pixels)
              if min(r, g, b) >= 244 and w * .1 < i % w < w * .9 and h * .18 < i // w < h * .82]
    if not bright:
        return None
    center = sum(x for x, _ in bright) / len(bright) / w
    if green > len(pixels) * .15 and center > .58:
        return True
    if green < len(pixels) * .02 and center < .42:
        return False
    return None


def apply_publish_options(dev, settings):
    required = [('ai_generated_toggle', True, 'ป้ายกำกับ AI'),
                ('allow_reuse_toggle', False, 'อนุญาตให้นำเนื้อหาไปใช้ซ้ำ')]
    for suffix, desired, label in required:
        size, nodes = screen(dev)
        matches = [n for n in nodes if n.rid.endswith(':id/' + suffix) and n.visible(size)]
        if len(matches) != 1 or not any(n.rid.endswith(':id/btn_post') and n.visible(size) for n in nodes):
            raise StepFailed('ไม่พบตัวเลือก ' + label + ' ในหน้าเตรียมโพสต์')
        n = matches[0]
        state = toggle_state(dev.d.screenshot(), n)
        if state is None:
            raise StepFailed('ยังอ่านสถานะ ' + label + ' ไม่ได้ จึงหยุดก่อนเผยแพร่')
        if state != desired:
            dev.click(*n.center)
            time.sleep(.6)
        size, nodes = screen(dev)
        fresh = next((n for n in nodes if n.rid.endswith(':id/' + suffix) and n.visible(size)), None)
        if not fresh or toggle_state(dev.d.screenshot(), fresh) is not desired:
            raise StepFailed('ตั้งค่า ' + label + ' ยังไม่สำเร็จ จึงหยุดก่อนเผยแพร่')
        print('  ✅ ' + label + ': ' + ('เปิด' if desired else 'ปิด'))
    settings['_options_checked'] = True


def pick_uploaded_clip(dev, ctx, settings=None):
    """Use a single-file album, rather than choosing from the user's entire gallery."""
    album = Path(ctx['remote']).parent.name
    title = dev.d(resourceId=PKG + ':id/lyt_pick_title')
    timeout = float((settings or {}).get('gallery_timeout_seconds', (settings or {}).get('ui_timeout_seconds', 120)))
    size, nodes = screen(dev)
    size, nodes = recover_identity_screen(dev, settings or {}, size, nodes)
    camera_gallery = next((n for n in nodes if n.rid == PKG + ':id/ll_gallery_entrance' and n.visible(size)), None)
    if camera_gallery:
        # A tap during this Redmi's camera startup can be ignored. Retry only
        # the still-visible native gallery control, never a photo coordinate.
        print('  ↻ ยังอยู่หน้ากล้อง กดปุ่มคลังภาพที่เห็นอีกครั้งก่อนเลือกไฟล์')
        time.sleep(2)
        try:
            dev.d(resourceId=camera_gallery.rid).click(timeout=2)
        except Exception:
            if not title.exists:
                raise PhoneUiUnavailable('ปุ่มคลังภาพเปลี่ยนไปก่อนเปิด ยังไม่ได้เลือกคลิปหรือกดโพสต์')
    if not title.wait(timeout=timeout):
        size, nodes = screen(dev)
        size, nodes = recover_identity_screen(dev, settings or {}, size, nodes)
        raise PhoneUiUnavailable('หน้าคลังวิดีโอยังโหลดไม่เสร็จหรือแอปหลุด ยังไม่ได้เลือกคลิปหรือกดโพสต์')
    title.click()
    target = dev.d(text=album)
    if not target.wait(timeout=10) and not dev.d(scrollable=True).scroll.to(text=album, max_swipes=40):
        raise StepFailed('คลิปถูกส่งแล้ว แต่ยังไม่พบอัลบั้ม ' + album)
    target.click()
    time.sleep(1)
    size, nodes = screen(dev)
    if not any(n.text == album and n.visible(size) for n in nodes):
        raise StepFailed('ยังยืนยันอัลบั้มคลิปไม่ได้')
    checks = [n for n in nodes if n.rid == PKG + ':id/ll_check' and n.visible(size)]
    if len(checks) != 1:
        raise StepFailed('อัลบั้มงานนี้ต้องมีคลิปเดียว จึงหยุดเพื่อป้องกันเลือกผิด')
    dev.click(*checks[0].center)
    time.sleep(1)
    return 'ok'


OUR_FILE = re.compile(r'^sv_\d{8}_\d{6}(_\d{3})?\.mp4$')


def cleanup_phone(dev, settings, keep=None):
    """ลบเฉพาะไฟล์ที่โปรแกรมนี้ส่งเข้าไป (sv_วันที่_เวลา.mp4) ยกเว้นไฟล์ล่าสุด"""
    folder = settings.get('phone_folder', DEFAULT_SETTINGS['phone_folder']).rstrip('/')
    out = dev.shell(f'ls "{folder}"')
    for name in out.split():
        path = f'{folder}/{name}'
        if OUR_FILE.match(name) and path != keep:
            dev.shell(f'rm "{path}"')


@keep_phone_awake
def run_clip(dev, clip, settings, flow, ask=input):
    settings['_active_clip_key'] = clip.key
    settings['_post_confirmed'] = False
    settings.pop('_post_evidence', None)
    settings['_cleanup_sources'] = post_cleanup.source_snapshot(clip)
    previous = read_json(PREPARED_FILE, {})
    if settings.get('_recover_only') and not (
            previous.get('status') in ('posting', 'posted') and previous.get('clip_key') == clip.key
            and previous.get('serial') == settings['serial']):
        raise StepFailed('บันทึกงานค้างไม่ตรงกับคลิปและมือถือ — ตรวจผลอย่างเดียว ไม่เริ่มเผยแพร่')
    if previous.get('clip_key') == clip.key and previous.get('serial') == settings['serial']:
        if previous.get('status') in ('posting', 'posted') and settings.get('auto_post'):
            print('  🔎 ตรวจผลคลิปค้างในบัญชี โดยไม่กดเผยแพร่ซ้ำ')
            return recheck_pending_upload(dev, clip, settings, previous)
        if previous.get('status') in ('posting', 'posted'):
            raise StepFailed('คลิปนี้เคยเริ่มโพสต์แล้ว ต้องตรวจผลเดิมก่อนเริ่มซ้ำ')
    expected = source_product(clip, settings)
    if expected['status'] not in ('resolved', 'import_link'):
        product_check(settings, expected, None, 'source_link', expected.get('error', ''))
        raise StepFailed('ยังตรวจรหัสจากลิงก์ไม่ได้ จึงหยุดเตรียมคลิปนี้')
    remote = push_clip(dev, clip, settings)
    print(f'  📤 ส่งคลิปเข้ามือถือแล้ว ({remote})')
    ctx = clip.context(settings)
    ctx['remote'] = remote
    ctx['product'] = expected
    if settings.get('product_search') == 'link':
        ctx['search'] = expected['product_url']
    if settings.get('auto_post') and settings.get('reuse_app_session') and not settings.get('_resume_from_step'):
        if dev.d.app_current().get('package') == PKG:
            size, current = screen(dev)
            size, current = recover_identity_screen(dev, settings, size, current)
            # Only a native camera control permits continuing at gallery. The
            # exact transferred file is still selected and verified afterwards.
            camera_ready = any(n.visible(size) and n.rid in (PKG + ':id/ll_gallery_entrance', PKG + ':id/tv_gallery_entrance') for n in current)
            gallery_index = next((i for i, item in enumerate(flow) if item.get('id') == 'gallery'), None)
            if camera_ready and gallery_index is not None:
                flow = flow[gallery_index:]
                print('  ↪ หน้าถ่ายวิดีโอพร้อมแล้ว ต่อจากคลังด้วยไฟล์งานนี้')
    if settings.get('_resume_from_step'):
        if settings['_resume_from_step'] != 'caption':
            raise StepFailed('รองรับการต่อจากหน้าแคปชันเท่านั้น')
        size, current = screen(dev)
        if not any(n.is_input and n.rid.endswith(':id/et_caption') and n.visible(size) for n in current):
            raise StepFailed('ยังไม่ได้อยู่หน้าเพิ่มแคปชัน จึงไม่ต่อจากหน้านี้')
        index = next((i for i, step in enumerate(flow) if step.get('id') == 'caption'), None)
        if index is None:
            raise StepFailed('ไม่พบขั้นแคปชันในขั้นตอนของเครื่องนี้')
        flow = flow[index:]
        print('  ↪ ต่อจากหน้าแคปชันของคลิปที่เลือก')
    must = {'add_product', 'search_product', 'choose_product'}  # ขั้นปักตะกร้า — ข้ามแล้วห้ามโพสต์อัตโนมัติ
    missed = []
    completed = set()
    post_clicked = False
    basket_checked = False
    for step in flow:
        if step.get('do') == 'post':
            missing = sorted(must - completed)
            if missing:
                raise StepFailed(f'ขั้นปักตะกร้าไม่ครบ ({", ".join(missing)}) จึงหยุดก่อนโพสต์')
            apply_publish_options(dev, settings)
            if not verify_basket(dev, ctx, settings, flow, ask):
                return 'skipped', remote
            basket_checked = True
            if settings.get('_prepare_only') or not settings.get('auto_post'):
                break
            attempt = make_prepared_record(clip, settings, ctx)
            attempt.update(status='posting', started_at=datetime.datetime.now().isoformat(timespec='seconds'))
            write_json(PREPARED_FILE, attempt)
            try:
                dev.d.clear_toast()
                settings['_toast_cleared'] = True
            except Exception:
                settings['_toast_cleared'] = False
        print(f'  ▶ {step.get("say", step.get("id"))}')
        if step.get('id') == 'pick_video':
            r = pick_uploaded_clip(dev, ctx, settings)
        elif step.get('id') == 'choose_product':
            r = choose_imported_product(dev, ctx, settings) if ctx.get('_link_import') else choose_correct_product(dev, step, ctx, flow, settings, ask)
        else:
            r = run_step(dev, step, ctx, flow, settings, ask)
        if step.get('do') == 'post':
            post_clicked = r == 'ok'
            if settings.get('auto_post') and not post_clicked:
                raise StepFailed('ยังไม่ได้กดโพสต์ จึงไม่บันทึกว่าโพสต์แล้ว')
        if r == 'ok':
            completed.add(step.get('id'))
            if step.get('id') == 'import_product':
                ctx['_link_import'] = True
        if r == 'skipped':
            print('    (ข้าม)')
            if step.get('id') in must:
                missed.append(step.get('id'))
    if not basket_checked:
        raise StepFailed('ยังไม่ได้ตรวจรหัสสินค้าที่ปักไว้ จึงไม่บันทึกว่าโพสต์แล้ว')
    if settings.get('_prepare_only'):
        prepared = make_prepared_record(clip, settings, ctx)
        write_json(PREPARED_FILE, prepared)
        settings['_prepared_record'] = prepared
        print('  ✅ เตรียมครบและตรวจสินค้าแล้ว — หยุดก่อนเผยแพร่ ไม่มีการบันทึกว่าโพสต์')
        return 'prepared', remote
    result = confirm_clip_post(dev, clip, settings, remote, ask, post_clicked, missed)
    attempt = read_json(PREPARED_FILE, {})
    if attempt.get('clip_key') == clip.key:
        attempt['status'] = result[0]
        write_json(PREPARED_FILE, attempt)
    return result


def retry_failed_upload(dev, settings, remote, message):
    """Retry one visibly failed native upload, without pressing Post again."""
    active_key = settings.get('_active_clip_key')
    if not settings.get('auto_post') or not active_key or not POST_FAILURE.search(message or ''):
        return None
    pending = read_json(PREPARED_FILE, {})
    if (pending.get('status') != 'posting' or pending.get('clip_key') != active_key
            or pending.get('serial') != settings.get('serial') or pending.get('remote') != remote
            or not settings.get('_cleanup_sources') or pending.get('sources') != settings['_cleanup_sources']
            or pending.get('upload_retry_count', 0) >= 1):
        return None
    owned = read_json(UPLOADS_FILE, {}).get(settings['serial'] + '|' + active_key, {})
    if owned.get('remote') != remote or not post_cleanup.matches_source(owned, pending['sources'].get('video')):
        return None
    size, nodes = screen(dev)
    require_accessible_screen(nodes, size, dev)
    if dev.d.app_current().get('package') != PKG:
        return None
    candidates = []
    for failure in nodes:
        if not failure.visible(size) or not POST_FAILURE.fullmatch(failure.text):
            continue
        parent = failure.parent
        for _ in range(5):
            if parent is None:
                break
            buttons = [n for n in parent.descendants() if n.visible(size) and n.text in ('ลองใหม่', 'Retry')]
            if len(buttons) == 1 and parent.visible(size) and parent.area <= size[0] * size[1] * .4:
                candidates.append(buttons[0])
                break
            parent = parent.parent
    if len(candidates) != 1:
        return None
    pending.update(upload_retry_count=1, upload_retry_at=datetime.datetime.now().isoformat(timespec='seconds'),
                   upload_failure_evidence=message)
    write_json(PREPARED_FILE, pending)  # Persist before the native retry, including across worker restarts.
    receipt = PostReceipt(dev)
    receipt.start()
    try:
        dev.click(*tap_point(candidates[0], size))
    except Exception:
        receipt.close()
        raise
    print('  ↻ Shopee แจ้งอัปโหลดไม่สำเร็จ ลองอัปโหลดงานเดิมอีกหนึ่งครั้ง')
    return receipt


def confirm_post(dev, settings, remote, ask, post_clicked, missed=()):
    if settings.get('auto_post'):
        settings['_post_confirmed'] = False
        receipt = settings.pop('_post_receipt', None) or PostReceipt(dev)
        try:
            if not post_clicked:
                raise StepFailed('ยังไม่ได้กดเผยแพร่ จึงไม่บันทึกว่าโพสต์แล้ว')
            timeout = float(settings.get('post_timeout_seconds', 180))
            started = time.monotonic()
            deadline = started + timeout
            next_screen = started + 12
            next_log = started + 30
            next_profile = started + 35
            while time.monotonic() < deadline:
                # Check the cached receipt before requesting a potentially slow UI dump.
                if settings.get('_toast_cleared') and not receipt.evidence:
                    try:
                        receipt.observe(dev.d.last_toast)
                    except Exception:
                        pass
                if receipt.evidence:
                    settings['_post_confirmed'] = True
                    settings['_post_evidence'] = receipt.evidence
                    print('  ✅ Shopee ยืนยัน: ' + receipt.evidence)
                    return 'posted', remote
                if receipt.error:
                    replacement = retry_failed_upload(dev, settings, remote, receipt.error)
                    if not replacement:
                        raise StepFailed('Shopee แจ้ง: ' + receipt.error)
                    receipt.close()
                    receipt = replacement
                    started = time.monotonic()
                    deadline = started + timeout
                    next_screen, next_log, next_profile = started + 12, started + 30, started + 35
                    continue
                now = time.monotonic()
                if now >= next_screen:
                    size, nodes = screen(dev)
                    for node in nodes:
                        receipt.observe(node.text)
                    size, nodes = recover_identity_screen(dev, settings, size, nodes)
                    next_screen = time.monotonic() + 10
                if now >= next_log:
                    print('  ⏳ รอ Shopee ยืนยันการอัปโหลดอยู่')
                    next_log = now + 30
                if now >= next_profile:
                    pending = read_json(PREPARED_FILE, {})
                    print('  🔎 ตรวจคลิปที่เผยแพร่ในโปรไฟล์อัตโนมัติ')
                    evidence = verify_published_profile(dev, pending_post_context(pending), pending.get('started_at'))
                    if evidence:
                        settings.update(_post_confirmed=True, _post_evidence=evidence)
                        print('  ✅ ' + evidence)
                        return 'posted', remote
                    next_profile = time.monotonic() + 30
                receipt.done.wait(.5)
            raise UploadUnconfirmed('ยังยืนยันผลอัปโหลดไม่ได้ — ต้องตรวจผลโพสต์เดิมต่อ')
        finally:
            receipt.close()
    else:
        if missed:
            print('\n  ✋ ปักตะกร้ายังไม่ครบ: ปักสินค้าเองบนมือถือ แล้วค่อยกด “โพสต์” (หรือกด s เพื่อไม่โพสต์คลิปนี้)')
        else:
            print('\n  ✋ เตรียมครบแล้ว: ตรวจบนมือถือ (คลิป / แคปชัน / สินค้าที่ปัก) แล้วกด “โพสต์” เอง')
        ans = ask('  โพสต์เสร็จแล้วกด Enter · s = ไม่โพสต์คลิปนี้ · q = หยุด: ').strip().lower()
    if ans == 'q':
        raise Quit()
    while ans not in ('', 's', 'q'):
        ans = ask('  ยืนยันว่าโพสต์สำเร็จแล้วกด Enter · s = ข้าม · q = หยุด: ').strip().lower()
    if ans == 'q':
        raise Quit()
    settings['_post_confirmed'] = ans == ''
    return ('skipped' if ans == 's' else 'posted'), remote


def make_prepared_record(clip, settings, ctx):
    return {'status': 'prepared', 'clip_key': clip.key, 'clip_name': clip.name,
            'serial': settings['serial'], 'remote': ctx['remote'],
            'clips_folder': str(Path(settings['clips_folder']).resolve()),
            'sources': settings.get('_cleanup_sources') or post_cleanup.source_snapshot(clip),
            'context': {k: ctx[k] for k in ('caption_full', 'product', '_verified_import') if k in ctx},
            'prepared_at': datetime.datetime.now().isoformat(timespec='seconds')}


def validate_prepared(dev, clip, settings, prepared):
    if prepared.get('status') != 'prepared' or prepared.get('clip_key') != clip.key:
        raise StepFailed('คลิปนี้ไม่ได้อยู่ในสถานะพร้อมโพสต์ หรือเคยเริ่มโพสต์แล้ว')
    if prepared.get('serial') != settings['serial'] or prepared.get('clips_folder') != str(Path(settings['clips_folder']).resolve()):
        raise StepFailed('มือถือหรือโฟลเดอร์เปลี่ยนไป จึงไม่โพสต์คลิปเดิม')
    if post_cleanup.source_snapshot(clip) != prepared.get('sources'):
        raise StepFailed('คลิปหรือไฟล์แคปชันเปลี่ยนไป จึงไม่โพสต์คลิปเดิม')
    uploads = read_json(UPLOADS_FILE, {})
    owned = uploads.get(settings['serial'] + '|' + clip.key, {})
    if owned.get('remote') != prepared.get('remote') or not post_cleanup.matches_source(owned, prepared['sources']['video']):
        raise StepFailed('ไฟล์ที่ส่งเข้าเครื่องไม่ตรงกับคลิปที่เตรียมไว้')
    remote = prepared['remote']
    base = settings['phone_folder'].rstrip('/')
    if not re.fullmatch(re.escape(base) + r'/SV[0-9a-f]{10}/sv_\d{8}_\d{6}_\d{3}\.mp4', remote):
        raise StepFailed('ไฟล์บนมือถืออยู่นอกอัลบั้มของโปรแกรม')
    phone_hash = dev.shell('sha256sum ' + shlex.quote(remote)).split()
    if not phone_hash or phone_hash[0] != owned.get('sha256'):
        raise StepFailed('คลิปบนมือถือเปลี่ยนไป จึงไม่โพสต์')
    if dev.d.app_current().get('package') != PKG:
        raise StepFailed('เปิดหน้าคลิปที่เตรียมไว้ใน Shopee และปลดล็อกมือถือก่อน')
    ctx = prepared.get('context', {})
    imported = ctx.get('_verified_import', {})
    size, nodes = screen(dev)
    captions = [n for n in nodes if n.rid.endswith(':id/et_caption') and n.visible(size)]
    titles = [n for n in nodes if n.rid.endswith(':id/tv_product_title') and n.visible(size)]
    if len(captions) != 1 or not caption_matches(captions[0].text, ctx.get('caption_full', '')):
        raise StepFailed('หน้าแคปชันไม่ตรงกับคลิปที่เตรียมไว้ จึงไม่โพสต์')
    if len(titles) != 1 or titles[0].text != imported.get('title'):
        raise StepFailed('สินค้าที่ปักไม่ตรงกับคลิปที่เตรียมไว้ จึงไม่โพสต์')
    return ctx


def cmd_publish_prepared(settings, flow, ask=input):
    prepared = read_json(PREPARED_FILE, {})
    clips, _ = scan_clips(settings['clips_folder'])
    clip = next((c for c in clips if c.key == prepared.get('clip_key')), None)
    if clip is None:
        raise StepFailed('ไม่พบคลิปที่เตรียมไว้ในโฟลเดอร์นี้')
    clip_key = clip.key  # Keep the identity after cleanup removes the source file.
    posted = load_posted()
    if clip_key in posted['items'] or posted_today(posted) >= settings['daily_limit']:
        raise StepFailed('คลิปนี้บันทึกผลแล้ว หรือครบจำนวนโพสต์วันนี้แล้ว')
    dev = connect(settings)
    if not dev:
        raise StepFailed('มือถือยังไม่พร้อม')
    ctx = validate_prepared(dev, clip, settings, prepared)
    print('  ▶ โพสต์คลิปที่เตรียมไว้: ' + clip.name)
    settings.update(auto_post=True, _prepare_only=False, _post_confirmed=False,
                    _cleanup_sources=prepared['sources'], _active_clip_key=clip.key)
    apply_publish_options(dev, settings)
    if not verify_basket(dev, ctx, settings, flow, ask):
        raise StepFailed('ยังไม่พร้อมโพสต์คลิปนี้')
    post_step = next((s for s in flow if s.get('do') == 'post'), None)
    if not post_step:
        raise StepFailed('ไม่พบขั้นตอนโพสต์')
    try:
        dev.d.clear_toast()
        settings['_toast_cleared'] = True
    except Exception:
        settings['_toast_cleared'] = False
    # Persist before the click: another run must not duplicate an uncertain upload.
    prepared.update(status='posting', started_at=datetime.datetime.now().isoformat(timespec='seconds'))
    write_json(PREPARED_FILE, prepared)
    print('  ▶ กดโพสต์ แล้วรอ Shopee ยืนยันผล')
    clicked = run_step(dev, post_step, ctx, flow, settings, ask, teach_on=False) == 'ok'
    status, remote = confirm_clip_post(dev, clip, settings, prepared['remote'], ask, clicked)
    if status != 'posted' or not settings.get('_post_confirmed'):
        prepared['status'] = status
        write_json(PREPARED_FILE, prepared)
        return {'status': status, 'clip_name': clip.name}
    record_posted(posted, clip, 'posted')
    cleanup = {'pc': [], 'phone': False, 'error': '', 'txt_kept_for_other_clip': False}
    if settings.get('delete_after_post'):
        try:
            cleanup = post_cleanup.cleanup_posted(dev, clip, settings, posted, remote,
                      read_json(UPLOADS_FILE, {}), clips)
        except Exception as exc:
            cleanup['error'] = str(exc)
    result = {'status': 'posted', 'clip_name': clip.name, 'clip_key': clip_key,
              'evidence': settings.get('_post_evidence', 'ผู้ใช้ยืนยันว่าโพสต์สำเร็จ'), 'cleanup': cleanup}
    posted['items'][clip_key].update(cleanup=cleanup, evidence=result['evidence'])
    write_json(POSTED_FILE, posted)
    prepared.update(status='posted', result=result)
    write_json(PREPARED_FILE, prepared)
    print('  ✅ โพสต์สำเร็จและบันทึกประวัติแล้ว')
    print('  🗑 คอมเข้าถังขยะ ' + str(len(cleanup['pc'])) + ' ไฟล์ · มือถือ: ' + ('ลบแล้ว' if cleanup['phone'] else 'ยังไม่ได้ลบ'))
    if cleanup['error']:
        print('  ⚠ ' + cleanup['error'])
    return result


def resume_delay_seconds(settings, posted, now=None):
    """Retain spacing after restarting a queue or confirming a pending upload."""
    times = []
    for record in posted.get('items', {}).values():
        if record.get('status') == 'posted':
            try:
                times.append(datetime.datetime.fromisoformat(record.get('at', '')))
            except (TypeError, ValueError):
                pass
    if not times:
        return 0
    elapsed = max(0, ((now or datetime.datetime.now()) - max(times)).total_seconds())
    lo, hi = (settings.get('delay_minutes') or [4, 9])[:2]
    if elapsed >= float(hi) * 60:
        return 0
    return max(0, int(random.uniform(float(lo), float(hi)) * 60 - elapsed) + 1)


def wait_between(settings, dev=None, seconds=None):
    lo, hi = (settings.get('delay_minutes') or [4, 9])[:2]
    secs = int(random.uniform(float(lo), float(hi)) * 60) if seconds is None else seconds
    print(f'\n⏸ พัก {secs // 60} นาที {secs % 60} วิ ก่อนคลิปถัดไป (กด Ctrl+C เพื่อหยุด)')
    end = time.time() + secs
    while time.time() < end:
        left = int(end - time.time())
        print(f'   เหลือ {left // 60:02d}:{left % 60:02d}', end='\r', flush=True)
        if dev is not None:
            # Neutral input keeps an active automation session from timing out;
            # it changes no screen-lock settings and cannot unlock a locked phone.
            dev.shell('input keyevent KEYCODE_UNKNOWN')
        time.sleep(min(5, max(0, left)))
    print(' ' * 30, end='\r')


# ---------------------------------------------------------------- คำสั่ง
def cmd_check(settings):
    dev = connect(settings)
    if not dev:
        return
    pk = dev.shell(f'pm list packages {PKG}')
    print('✅ เจอแอป Shopee' if PKG in pk else f'⚠ ไม่เจอแอป Shopee ({PKG}) ในมือถือเครื่องนี้')
    size, nodes = screen(dev)
    print(f'✅ อ่านหน้าจอได้ ({len(nodes)} ชิ้น) — พร้อมใช้งาน')
    clips, notes = scan_clips(settings['clips_folder'])
    print(f'📁 คลิปในโฟลเดอร์ {settings["clips_folder"]}: {len(clips)} คลิป')
    for n in notes[:5]:
        print('   · ' + n)


def cmd_dump(settings):
    dev = connect(settings)
    if not dev:
        return
    DUMP_DIR.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    xml = dev.dump()
    size = dev.window_size()
    nodes = parse_nodes(xml)
    lines = [f'จอ {size[0]}x{size[1]}'] + [describe(n, size) for n in teach_candidates(nodes, size)]
    txt = DUMP_DIR / f'screen_{stamp}.txt'
    txt.write_text('\n'.join(lines), encoding='utf-8')
    (DUMP_DIR / f'screen_{stamp}.xml').write_text(xml, encoding='utf-8')
    try:
        dev.screenshot(DUMP_DIR / f'screen_{stamp}.png')
    except Exception:
        pass
    print('\n'.join(f'  {l}' for l in lines))
    print(f'\n💾 บันทึกแล้ว: {txt}  (ส่งไฟล์ .txt นี้ให้ผู้พัฒนาได้ · รูป .png อาจมีข้อมูลส่วนตัว ส่งเฉพาะถ้าจำเป็น)')


def keep_computer_awake(function):
    def run(settings, *args, **kwargs):
        keeper = None
        if os.name == 'nt' and settings.get('auto_post'):
            import ctypes
            keeper = ctypes.windll.kernel32.SetThreadExecutionState
            keeper(0x80000001)  # System required for this worker; display/lock settings stay intact.
        try:
            return function(settings, *args, **kwargs)
        finally:
            if keeper is not None:
                keeper(0x80000000)
    return run


def run_clip_with_retry(dev, clip, settings, flow, ask=input):
    ui_retry = app_exit_retry = False
    for attempt in range(3):
        try:
            return run_clip(dev, clip, settings, flow, ask)
        except PhoneUiUnavailable as exc:
            if not settings.get('auto_post'):
                raise
            # Re-read both journals before every restart. A UI exception during
            # confirmation must never turn an unknown publication into a replay.
            pending = read_json(PREPARED_FILE, {})
            history = load_posted()['items']
            if (pending.get('status') in ('posting', 'posted')
                    and history.get(pending.get('clip_key'), {}).get('status') != 'posted'):
                raise UploadUnconfirmed('งานเดิมยังไม่ทราบผล จึงเก็บไฟล์และไม่เริ่มโพสต์ซ้ำ') from exc
            if attempt >= 2:
                raise
            if isinstance(exc, PhoneAppExited):
                if app_exit_retry:
                    raise
                app_exit_retry = True
                print('  ↻ Shopee ปิดตัวเองก่อนโพสต์ พัก 10 วินาทีแล้วกู้คลิปเดิมหนึ่งครั้ง')
                time.sleep(10)
            else:
                if ui_retry:
                    raise
                ui_retry = True
                print('  ↻ หน้าจอยังไม่พร้อม เริ่มคลิปนี้ใหม่หนึ่งครั้งก่อนกดโพสต์')
            size, current = screen(dev)
            recover_identity_screen(dev, settings, size, current)
            settings['_restart_app_once'] = True


@keep_computer_awake
def cmd_post(settings, flow, ask=input):
    clips, notes = scan_clips(settings['clips_folder'])
    for n in notes:
        print('  · ' + n)
    posted = load_posted()
    todo = [c for c in clips if c.key not in posted['items']]
    left = int(settings.get('daily_limit', 8)) - posted_today(posted)
    if not todo:
        print('✅ ไม่มีคลิปใหม่ที่ยังไม่โพสต์')
        return
    if left <= 0:
        print(f'⏹ วันนี้โพสต์ครบ {settings.get("daily_limit")} คลิปแล้ว (ปรับ daily_limit ใน settings.json) — พรุ่งนี้ค่อยต่อ')
        return
    if '_queue_keys' in settings:
        todo = [c for c in todo if c.key in settings['_queue_keys']]
        if not todo:
            return
    selected = settings.get('_clip_key')
    if selected:
        todo = [c for c in todo if c.key == selected]
        if not todo:
            raise StepFailed('ไม่พบคลิปที่เลือกในคิว')
    # Invalid source files consume no publishing quota. Stop by confirmed
    # publications, rather than slicing the input list by the remaining limit.
    batch = todo[:1] if settings.get('_prepare_only') else todo
    mode = 'กดโพสต์ให้เอง' if settings.get('auto_post') else 'เตรียมให้ครบ แล้วเรากดโพสต์เอง'
    print(f'\n📋 คลิปที่จะทำรอบนี้ ({len(batch)}/{len(todo)} · โหมด: {mode}):')
    for c in batch:
        miss = [] if c.info['link'] else ['ไม่มีลิงก์']
        if not c.txt:
            miss.append('ไม่มีไฟล์ .txt')
        print(f'   · {c.name}{"  ⚠ " + ", ".join(miss) if miss else ""}')
    if ask('\nกด Enter เพื่อเริ่ม (q = ยกเลิก): ').strip().lower() == 'q':
        return
    dev = connect(settings)
    if not dev:
        raise StepFailed('เชื่อมต่อมือถือไม่สำเร็จ จึงเก็บคิวไว้')
    if settings.get('auto_post') and not selected and not settings.get('_prepare_only'):
        delay = resume_delay_seconds(settings, posted)
        if delay:
            wait_between(settings, dev, seconds=delay)
    last_remote = None
    flow = load_flow(settings)
    for i, clip in enumerate(batch):
        if left <= 0:
            print(f'⏹ วันนี้โพสต์ครบ {settings.get("daily_limit")} คลิปแล้ว')
            break
        print(f'\n━━━ [{i + 1}/{len(batch)}] {clip.name} ━━━')
        try:
            status, last_remote = run_clip_with_retry(dev, clip, settings, flow, ask)
        except Quit:
            print('⏹ หยุดแล้ว')
            break
        except KeyboardInterrupt:
            print('\n⏹ หยุดแล้ว')
            break
        except Exception as e:
            print(f'❌ ผิดพลาด: {e or repr(e)}')
            if settings.get('_prepare_only'):
                raise
            if settings.get('auto_post') and isinstance(e, ClipUnavailable):
                print('  ↷ ข้ามคลิปนี้ไว้ก่อน และเก็บไฟล์ไว้')
                continue
            if settings.get('auto_post'):
                raise  # Stop on a phone/UI problem rather than posting from an uncertain screen.
            if ask('ข้ามไปคลิปถัดไป? (Enter = ไปต่อ · q = หยุด): ').strip().lower() == 'q':
                break
            continue
        if status == 'prepared':
            callback = settings.get('_prepared_callback')
            if callback:
                callback(settings['_prepared_record'])
            break
        record_posted(posted, clip, status)
        print('  ✅ บันทึกว่าโพสต์แล้ว' if status == 'posted' else '  ↷ ข้ามคลิปนี้ (จะไม่เสนออีก)')
        clip_key = clip.key
        cleanup = {'pc': [], 'phone': False, 'txt_kept_for_other_clip': False, 'error': ''}
        if status == 'posted' and settings.get('delete_after_post') and last_remote:
            try:
                cleanup = post_cleanup.cleanup_posted(dev, clip, settings, posted, last_remote,
                    read_json(UPLOADS_FILE, {}), scan_clips(settings['clips_folder'])[0])
                posted['items'][clip_key]['cleanup'] = cleanup
                write_json(POSTED_FILE, posted)
                print('  🗑 ย้ายไฟล์ในคอมเข้าถังขยะ ' + str(len(cleanup['pc'])) + ' ไฟล์ · มือถือ: ' + ('ลบแล้ว' if cleanup['phone'] else 'ยังไม่ได้ลบ'))
                if cleanup['txt_kept_for_other_clip']:
                    print('  ↪ เก็บ .txt ไว้ก่อน เพราะยังมีคลิปอื่นใช้คำบรรยายเดียวกัน')
                if cleanup['error']:
                    print('  ⚠ ' + cleanup['error'])
            except Exception as exc:
                cleanup['error'] = str(exc)
                print('  ⚠ โพสต์แล้ว แต่ล้างไฟล์ยังไม่ครบ: ' + str(exc))
        if status == 'posted':
            left -= 1
            settings.pop('_identity_reopened', None)
            settings.pop('_unlock_swipe_attempted', None)
            evidence = settings.get('_post_evidence', 'ผู้ใช้ยืนยันว่าโพสต์สำเร็จ')
            posted['items'][clip_key].update(cleanup=cleanup, evidence=evidence)
            write_json(POSTED_FILE, posted)
            callback = settings.get('_published_callback')
            if callback:
                callback({'status': 'posted', 'clip_name': clip.name, 'clip_key': clip_key,
                          'cleanup': cleanup, 'evidence': evidence})
        if i < len(batch) - 1 and left > 0:
            try:
                wait_between(settings, dev)
            except KeyboardInterrupt:
                print('\n⏹ หยุดแล้ว')
                break
    print(f'\n📊 วันนี้โพสต์ไปแล้ว {posted_today(posted)} คลิป')


def cmd_reset_flow(ask=input):
    if ask('ล้างขั้นตอนที่สอนไว้ทั้งหมด กลับเป็นค่าเริ่มต้น? (พิมพ์ y เพื่อยืนยัน): ').strip().lower() == 'y':
        shutil.copyfile(FLOW_DEFAULT, FLOW_FILE)
        print('✅ รีเซ็ตแล้ว')


def open_file(path):
    try:
        if os.name == 'nt':
            os.startfile(str(path))  # noqa
        else:
            print(f'เปิดไฟล์นี้แก้เอง: {path}')
    except Exception:
        print(f'เปิดไฟล์นี้แก้เอง: {path}')


MENU = """
================ Shopee Video โพสต์ช่วย ================
 1) เช็กการเชื่อมต่อมือถือ
 2) เริ่มโพสต์คลิปในคิว
 3) ดูปุ่มบนหน้าจอมือถือตอนนี้ (บันทึกไว้ส่งให้ผู้พัฒนา)
 4) แก้ตั้งค่า (settings.json)
 5) รีเซ็ตขั้นตอนที่สอนไว้
 0) ออก
========================================================"""


def main(argv):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    settings = load_settings()
    flow = load_flow(settings)
    cmd = argv[1] if len(argv) > 1 else ''
    if cmd == 'check':
        return cmd_check(settings)
    if cmd == 'post':
        return cmd_post(settings, flow)
    if cmd == 'dump':
        return cmd_dump(settings)
    while True:
        print(MENU)
        try:
            c = input('เลือก: ').strip()
        except (EOFError, KeyboardInterrupt):
            return
        try:
            if c == '1':
                cmd_check(settings)
            elif c == '2':
                cmd_post(settings, flow)
            elif c == '3':
                cmd_dump(settings)
            elif c == '4':
                open_file(SETTINGS_FILE)
                input('แก้เสร็จแล้ว บันทึกไฟล์ แล้วกด Enter...')
                settings = load_settings()
                flow = load_flow(settings)
            elif c == '5':
                cmd_reset_flow()
                flow = load_flow(settings)
            elif c == '0':
                return
        except KeyboardInterrupt:
            print('\n⏹ หยุดแล้ว')


if __name__ == '__main__':
    main(sys.argv)
