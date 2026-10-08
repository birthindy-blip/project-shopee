"""Inventory each ADB phone and USB-only device without selecting another phone silently."""
import json
import os
import subprocess
import threading
import time

LOCK = threading.RLock()
CACHE = (0, {})
USB_CACHE = (0, [])


def usb_devices(refresh=False):
    global USB_CACHE
    now = time.monotonic()
    if os.name != 'nt':
        return []
    if not refresh and now - USB_CACHE[0] < 15:
        return USB_CACHE[1]
    cmd = r"""$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new(); $items = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.Class -eq 'WPD' -and $_.InstanceId -match '^USB' } | ForEach-Object { $parent = (Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_Parent' -ErrorAction SilentlyContinue).Data; [pscustomobject]@{ model = $_.FriendlyName; instance = $_.InstanceId; parent = $parent } }); ConvertTo-Json -InputObject $items -Compress"""
    try:
        result = subprocess.run(['powershell', '-NoProfile', '-Command', cmd], capture_output=True,
                                timeout=8, creationflags=subprocess.CREATE_NO_WINDOW)
        raw = json.loads(result.stdout.decode('utf-8-sig') or '[]')
        USB_CACHE = (now, raw if isinstance(raw, list) else [raw])
    except Exception:
        USB_CACHE = (now, [])
    return USB_CACHE[1]


def inventory(refresh=False):
    global CACHE
    with LOCK:
        now = time.monotonic()
        if not refresh and now - CACHE[0] < 3:
            return CACHE[1]
        value = {'devices': [], 'usb_devices': [], 'dependencies': True, 'error': ''}
        try:
            import adbutils
            import uiautomator2
            for info in adbutils.adb.list():
                device = {'serial': info.serial, 'state': info.state, 'model': ''}
                if info.state == 'device':
                    try:
                        device['model'] = adbutils.adb.device(info.serial).shell('getprop ro.product.model', timeout=3).strip()
                    except Exception:
                        device['model'] = 'Android'
                value['devices'].append(device)
        except ImportError:
            value.update(dependencies=False, error='ยังไม่ได้ติดตั้งตัวเชื่อมมือถือ')
        except Exception as exc:
            value['error'] = 'ตรวจการเชื่อมต่อไม่ได้: ' + str(exc)
        serials = {d['serial'] for d in value['devices']}
        for usb in usb_devices(refresh):
            parent_serial = (usb.get('parent') or '').split('\\')[-1]
            if parent_serial in serials:
                for d in value['devices']:
                    if d['serial'] == parent_serial:
                        d['model'] = usb['model'] + (' / ' + d['model'] if d['model'] else '')
            else:
                value['usb_devices'].append({'model': usb.get('model') or 'อุปกรณ์ USB',
                                             'state': 'usb_only', 'serial': '', 'key': usb['instance']})
        CACHE = (now, value)
        return value


def selected_phone(data, selected_serial=''):
    ready = [d for d in data['devices'] if d['state'] == 'device']
    result = {'state': 'disconnected', 'serial': selected_serial, 'model': '',
              'devices': data['devices'], 'usb_devices': data['usb_devices'],
              'dependencies': data['dependencies'], 'message': ''}
    if selected_serial:
        chosen = next((d for d in data['devices'] if d['serial'] == selected_serial), None)
    elif len(ready) > 1:
        return {**result, 'state': 'select_required', 'message': 'พบมือถือพร้อมหลายเครื่อง — เลือกเครื่องที่จะใช้ก่อนตรวจ'}
    else:
        chosen = ready[0] if ready else (data['devices'][0] if len(data['devices']) == 1 else None)
    if chosen:
        result.update(chosen)
        result['message'] = {'device': 'เชื่อมต่อแล้ว — ตรวจ Shopee และหน้าจอของเครื่องนี้',
                             'unauthorized': 'ปลดล็อกจอและกดอนุญาต USB debugging บนเครื่องที่เลือก',
                             'offline': 'เครื่องที่เลือกยังไม่พร้อม — ถอดสายแล้วเสียบใหม่'}.get(chosen['state'], 'เครื่องที่เลือกยังไม่พร้อม')
    elif selected_serial:
        result['message'] = 'เครื่องที่เลือกไม่ได้เชื่อมต่อ — เลือกมือถือเครื่องอื่นหรือเลือกอัตโนมัติ'
    elif data['usb_devices']:
        result.update(model=', '.join(d['model'] for d in data['usb_devices']),
                      message='พบมือถือผ่าน USB แต่ยังควบคุมไม่ได้ — เปิด USB debugging และกดอนุญาต')
    else:
        result['message'] = 'ยังไม่พบมือถือ — เสียบสาย เปิด USB debugging และกดอนุญาต'
    if data['error']:
        result.update(state='error' if data['dependencies'] else 'missing_dependencies', message=data['error'])
    return result
