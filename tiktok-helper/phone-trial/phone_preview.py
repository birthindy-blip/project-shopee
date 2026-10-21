"""Read-only, bounded screen capture for the selected USB phone."""
import io
import threading
import time


class PreviewUnavailable(Exception):
    pass


class PhonePreview:
    def __init__(self, capture=None, interval=2.5):
        self._capture = capture or self._capture_adb
        self.interval = interval
        self._lock = threading.Lock()
        self._serial = ''
        self._frame = None
        self._at = 0

    @staticmethod
    def _capture_adb(serial):
        import adbutils
        from PIL import Image
        device = adbutils.AdbClient(socket_timeout=8).device(serial=serial)
        # Binary shell output with a finite timeout; never wake or tap the phone.
        raw = device.shell(['screencap', '-p'], timeout=8, encoding=None, rstrip=False)
        with Image.open(io.BytesIO(raw)) as source:
            return source.convert('RGB')

    def frame(self, serial):
        if not serial:
            raise PreviewUnavailable('เลือกมือถือที่เชื่อมต่อก่อนเปิดภาพสด')
        if not self._lock.acquire(blocking=False):
            raise PreviewUnavailable('กำลังดึงภาพมือถือ รอภาพถัดไปสักครู่')
        try:
            if self._serial == serial and self._frame and time.monotonic() - self._at < self.interval:
                return self._frame
            # Clear the previous phone's image before changing device or retrying.
            self._frame = None
            self._serial = serial
            try:
                started = time.monotonic()
                picture = self._capture(serial)
                original = picture.size
                picture.thumbnail((420, 840))
                output = io.BytesIO()
                picture.save(output, format='JPEG', quality=70)
                self._frame = (output.getvalue(), time.time(), original)
                self._at = started
                return self._frame
            except Exception as exc:
                raise PreviewUnavailable('อ่านจอมือถือไม่ได้ — ตรวจสาย USB และการอนุญาตบนมือถือ') from exc
        finally:
            self._lock.release()
