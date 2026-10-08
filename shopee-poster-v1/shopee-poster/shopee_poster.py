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
import time
import xml.etree.ElementTree as ET
from pathlib import Path
import product_identity as products

HERE = Path(__file__).resolve().parent
SETTINGS_FILE = HERE / 'settings.json'
FLOW_FILE = HERE / 'flow.json'
FLOW_DEFAULT = HERE / 'flow.default.json'
POSTED_FILE = HERE / 'posted.json'
UPLOADS_FILE = HERE / 'uploads.json'
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
            'caption_full': fit_caption(caption, tags),
            'link': link,
            'name': self.name,
            'search': search,
            'product': identity,
        }


def fit_caption(caption, tags, limit=150):
    full = f'{caption}\n\n{tags}'.strip()
    if len(full) <= limit:
        return full
    selected = []
    for tag in tags.split():
        if len(' '.join([*selected, tag])) > limit // 2:
            break
        selected.append(tag)
    tags = ' '.join(selected)
    room = limit - len(tags) - (2 if tags else 0)
    short = caption if len(caption) <= room else caption[:room - 1].rstrip() + '…'
    return f'{short}\n\n{tags}'.strip()


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
        return tuple(self.d.window_size())

    def click(self, x, y):
        self.d.click(x, y)

    def press(self, key):
        self.d.press(key)

    def type_text(self, text):
        try:
            self.d.send_keys(text, clear=True)  # ผ่านคลิปบอร์ด → พิมพ์ไทยได้
        except Exception:
            self.d(focused=True).set_text(text)

    def set_text_focused(self, text):
        self.d(focused=True).set_text(text)

    def set_clipboard(self, text):
        self.d.set_clipboard(text)

    def push(self, src, dst):
        self.d.push(str(src), dst)

    def shell(self, cmd):
        r = self.d.shell(cmd)
        return getattr(r, 'output', r) or ''

    def app_start(self, pkg):
        self.d.app_start(pkg, stop=True)

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
        ans = ask('  เลือกและปักสินค้าที่ถูกต้องบนมือถือ แล้วกด Enter · r = ตรวจผลค้นหาใหม่ · s = ข้าม · q = หยุด: ').strip().lower()
        if ans == 'q':
            raise Quit()
        if ans == 's':
            return 'skipped'
        if ans == '':
            return 'ok'  # Final basket verification still runs before posting.


def verify_basket(dev, ctx, settings, flow, ask):
    post_step = next((s for s in flow if s.get('do') == 'post'), None)
    if not post_step:
        raise StepFailed('ไม่มีขั้นตอนโพสต์ จึงยืนยันหน้าตะกร้าไม่ได้')
    actual, method, error = inspect_current_product(dev, copy_link=False)
    size, nodes = screen(dev)
    titles = [n for n in nodes if n.visible(size) and n.rid.endswith(':id/tv_product_title')]
    verified_import = ctx.get('_verified_import')
    if actual is None and verified_import and len(titles) == 1 and titles[0].text == verified_import['title']:
        actual, method, error = verified_import['identity'], 'verified_link_import', ''
    evidence = product_check(settings, ctx['product'], actual, method, error)
    size, nodes = screen(dev)
    if evidence['status'] == 'matched' and find_target(nodes, post_step.get('find'), size):
        return True
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


def perform(dev, step, target, size, ctx):
    kind, val = target
    x, y = val if kind == 'point' else tap_point(val, size)
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
        _, nodes = screen(dev)
        if not any(n.is_input and n.text == text for n in nodes):
            raise StepFailed('คำบรรยายในมือถือไม่ตรงกับคลิป จึงหยุดก่อนเผยแพร่')
        if 'mInputShown=true' in dev.shell('dumpsys input_method'):
            dev.press('back')


def run_step(dev, step, ctx, flow, settings, ask=input, teach_on=True):
    do = step.get('do')
    if do == 'start_app':
        dev.app_start(PKG)
        time.sleep(step.get('after', 7))
        return 'ok'
    if do == 'post' and (settings.get('_prepare_only') or not settings.get('auto_post')):
        return 'handoff'
    deadline = time.time() + float(step.get('timeout', 15))
    size, nodes = screen(dev)
    while True:
        # หน้าต่างเด้งบังอยู่ → ปิดก่อน (ปุ่มข้างหลังกดไม่ได้จริง)
        closed = dismiss_popup(dev, nodes, size, settings.get('popups', []), step)
        if closed:
            print(f'    ↪ ปิดหน้าต่าง “{closed}”')
            time.sleep(1.2)
            size, nodes = screen(dev)
            continue
        target = find_target(nodes, step.get('find'), size)
        if target:
            perform(dev, step, target, size, ctx)
            time.sleep(step.get('after', 1.8))
            return 'ok'
        if time.time() > deadline:
            break
        time.sleep(1)
        size, nodes = screen(dev)
    if step.get('optional'):
        return 'skipped'
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
    base = settings.get('phone_folder', DEFAULT_SETTINGS['phone_folder']).rstrip('/')
    with clip.video.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    upload_key = settings.get('serial', '') + '|' + clip.key
    uploads = read_json(UPLOADS_FILE, {})
    previous = uploads.get(upload_key, {})
    old_remote = previous.get('remote', '')
    owned_path = re.fullmatch(re.escape(base) + r'/SV[0-9a-f]{10}/sv_\d{8}_\d{6}_\d{3}\.mp4', old_remote)
    if owned_path and previous.get('sha256') == digest:
        remote_digest = dev.shell('sha256sum ' + shlex.quote(old_remote)).split()
        if remote_digest and remote_digest[0] == digest:
            print('  ↪ ใช้คลิปที่ส่งเข้าเครื่องนี้ไว้แล้ว (ตรวจไฟล์ตรงกับในคอม)')
            return old_remote
    album = f'SV{random.getrandbits(40):010x}'
    folder = f'{base}/{album}'
    dev.shell(f'mkdir -p {shlex.quote(folder)}')
    remote = f'{folder}/sv_{datetime.datetime.now():%Y%m%d_%H%M%S}_{random.randint(0, 999):03d}.mp4'
    dev.push(clip.video, remote)
    dev.shell(f'touch {shlex.quote(remote)}')
    # A broadcast alone can leave duration NULL; modern Shopee then hides the video.
    storage_path = remote.replace('/sdcard/', '/storage/emulated/0/', 1)
    dev.shell(f'content call --uri content://media --method scan_file --arg {shlex.quote(storage_path)}')
    dev.shell(f'am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d {shlex.quote("file://" + remote)}')
    time.sleep(2)
    uploads[upload_key] = {'remote': remote, 'sha256': digest}
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
    deadline = time.time() + 20
    while True:
        size, nodes = screen(dev)
        rows = import_product_rows(nodes, size)
        if rows or time.time() > deadline:
            break
        time.sleep(.6)
    if len(rows) != 1 or not any(n.text == 'กรอกลิงก์สินค้า' for n in nodes):
        raise StepFailed('ต้องนำเข้าจากลิงก์นี้ได้สินค้าเพียงตัวเดียว จึงจะปักอัตโนมัติ')
    title = rows[0].text
    perform(dev, {'do': 'tap'}, ('node', rows[0]), size, {})
    time.sleep(2)
    actual = None
    for _ in range(3):
        actual, method, error = inspect_current_product(dev)
        if actual:
            break
        time.sleep(.8)
    result = product_check(settings, ctx['product'], actual, method, error)
    if result['status'] != 'matched':
        raise StepFailed('รหัสสินค้าที่นำเข้ายังตรวจไม่ผ่าน จึงหยุดก่อนปัก')
    size, nodes = screen(dev)
    for _ in range(2):
        if any(n.text == 'กรอกลิงก์สินค้า' for n in nodes):
            break
        dev.press('back')
        time.sleep(.8)
        size, nodes = screen(dev)
    rows = import_product_rows(nodes, size)
    if len(rows) != 1 or rows[0].text != title or not any(n.text == 'กรอกลิงก์สินค้า' for n in nodes):
        raise StepFailed('หน้ารายการสินค้าเปลี่ยน จึงไม่เลือกอัตโนมัติ')
    select = find_target(nodes, [{'text': 'เลือกทั้งหมด'}], size)
    if not select:
        raise StepFailed('ไม่พบปุ่มเลือกสินค้าที่ตรวจแล้ว')
    perform(dev, {'do': 'tap'}, select, size, {})
    time.sleep(.6)
    size, nodes = screen(dev)
    add = find_target(nodes, [{'textRegex': r'^เพิ่ม\s*\(1\)$'}], size)
    if not add:
        raise StepFailed('ต้องเลือกสินค้าได้หนึ่งตัวเท่านั้น')
    perform(dev, {'do': 'tap'}, add, size, {})
    time.sleep(1)
    ctx['_verified_import'] = {'title': title, 'identity': actual}
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


def pick_uploaded_clip(dev, ctx):
    """Use a single-file album, rather than choosing from the user's entire gallery."""
    album = Path(ctx['remote']).parent.name
    title = dev.d(resourceId=PKG + ':id/lyt_pick_title')
    if not title.exists:
        raise StepFailed('ไม่พบตัวเลือกอัลบั้ม จึงหยุดเพื่อป้องกันเลือกคลิปผิด')
    title.click()
    time.sleep(0.8)
    target = dev.d(text=album)
    if not target.exists and not dev.d(scrollable=True).scroll.to(text=album, max_swipes=40):
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


def run_clip(dev, clip, settings, flow, ask=input):
    expected = products.remember(products.resolve_link(clip.info['link']))
    if expected['status'] != 'resolved':
        product_check(settings, expected, None, 'source_link', expected.get('error', ''))
        raise StepFailed('ยังตรวจรหัสจากลิงก์ไม่ได้ จึงหยุดเตรียมคลิปนี้')
    remote = push_clip(dev, clip, settings)
    print(f'  📤 ส่งคลิปเข้ามือถือแล้ว ({remote})')
    ctx = clip.context(settings)
    ctx['remote'] = remote
    ctx['product'] = expected
    if settings.get('product_search') == 'link':
        ctx['search'] = expected['product_url']
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
        print(f'  ▶ {step.get("say", step.get("id"))}')
        if step.get('id') == 'pick_video':
            r = pick_uploaded_clip(dev, ctx)
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
        print('  ✅ เตรียมครบและตรวจสินค้าแล้ว — หยุดก่อนเผยแพร่ ไม่มีการบันทึกว่าโพสต์')
        return 'prepared', remote
    if settings.get('auto_post') and post_clicked:
        # รอให้หน้ากดโพสต์หายไป = โพสต์แล้ว
        post_step = next((s for s in flow if s.get('do') == 'post'), None)
        for _ in range(60):
            time.sleep(2)
            size, nodes = screen(dev)
            if nodes and post_step and not find_target(nodes, post_step.get('find'), size):
                return 'posted', remote
        print('  ⚠ ยังเห็นปุ่มโพสต์อยู่ — เช็กบนมือถือ')
        ans = ask('  โพสต์แล้วกด Enter · s = ข้ามคลิปนี้ · q = หยุด: ').strip().lower()
    else:
        if missed:
            print('\n  ✋ ปักตะกร้ายังไม่ครบ: ปักสินค้าเองบนมือถือ แล้วค่อยกด “โพสต์” (หรือกด s เพื่อไม่โพสต์คลิปนี้)')
        else:
            print('\n  ✋ เตรียมครบแล้ว: ตรวจบนมือถือ (คลิป / แคปชัน / สินค้าที่ปัก) แล้วกด “โพสต์” เอง')
        ans = ask('  โพสต์เสร็จแล้วกด Enter · s = ไม่โพสต์คลิปนี้ · q = หยุด: ').strip().lower()
    if ans == 'q':
        raise Quit()
    return ('skipped' if ans == 's' else 'posted'), remote


def wait_between(settings):
    lo, hi = (settings.get('delay_minutes') or [4, 9])[:2]
    secs = int(random.uniform(float(lo), float(hi)) * 60)
    print(f'\n⏸ พัก {secs // 60} นาที {secs % 60} วิ ก่อนคลิปถัดไป (กด Ctrl+C เพื่อหยุด)')
    end = time.time() + secs
    while time.time() < end:
        left = int(end - time.time())
        print(f'   เหลือ {left // 60:02d}:{left % 60:02d}', end='\r', flush=True)
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
    selected = settings.get('_clip_key')
    if selected:
        todo = [c for c in todo if c.key == selected]
        if not todo:
            raise StepFailed('ไม่พบคลิปที่เลือกในคิว')
    batch = todo[:1 if settings.get('_prepare_only') else left]
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
        return
    last_remote = None
    flow = load_flow(settings)
    for i, clip in enumerate(batch):
        print(f'\n━━━ [{i + 1}/{len(batch)}] {clip.name} ━━━')
        try:
            status, last_remote = run_clip(dev, clip, settings, flow, ask)
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
            if ask('ข้ามไปคลิปถัดไป? (Enter = ไปต่อ · q = หยุด): ').strip().lower() == 'q':
                break
            continue
        if status == 'prepared':
            callback = settings.get('_prepared_callback')
            if callback:
                callback({'clip_name': clip.name, 'clip_key': clip.key, 'remote': last_remote})
            break
        record_posted(posted, clip, status)
        print('  ✅ บันทึกว่าโพสต์แล้ว' if status == 'posted' else '  ↷ ข้ามคลิปนี้ (จะไม่เสนออีก)')
        if settings.get('delete_after_post') and last_remote:
            cleanup_phone(dev, settings, keep=last_remote)  # ลบคลิปเก่า (คลิปล่าสุดอาจยังอัปโหลดอยู่)
        if i < len(batch) - 1:
            try:
                wait_between(settings)
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
