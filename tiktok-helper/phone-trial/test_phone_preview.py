import io
import unittest
from unittest.mock import Mock, patch
from PIL import Image
from phone_preview import PhonePreview, PreviewUnavailable
import poster_app as app


class PhonePreviewTests(unittest.TestCase):
    def test_same_phone_requests_share_recent_capture(self):
        capture = Mock(return_value=Image.new('RGB', (720, 1280), 'blue'))
        preview = PhonePreview(capture)
        first = preview.frame('phone-a')
        second = preview.frame('phone-a')
        self.assertIs(first, second)
        self.assertEqual(first[2], (720, 1280))
        with Image.open(io.BytesIO(first[0])) as jpeg:
            self.assertEqual(jpeg.format, 'JPEG')
            self.assertLessEqual(jpeg.width, 420)
        capture.assert_called_once_with('phone-a')

    def test_changing_phone_never_returns_previous_frame_on_failure(self):
        capture = Mock(side_effect=[Image.new('RGB', (20, 40)), OSError('offline')])
        preview = PhonePreview(capture)
        preview.frame('phone-a')
        with self.assertRaises(PreviewUnavailable):
            preview.frame('phone-b')
        self.assertIsNone(preview._frame)

    def test_expired_frame_is_replaced_with_current_screen(self):
        capture = Mock(side_effect=[Image.new('RGB', (20, 40), 'blue'), Image.new('RGB', (20, 40), 'red')])
        preview = PhonePreview(capture)
        with patch('phone_preview.time.monotonic', return_value=10) as clock:
            first = preview.frame('phone')
            clock.return_value = 11
            self.assertIs(preview.frame('phone'), first)
            clock.return_value = 13
            self.assertNotEqual(preview.frame('phone')[0], first[0])
        self.assertEqual(capture.call_count, 2)

    def test_empty_selection_and_concurrent_requests_do_not_capture(self):
        capture = Mock()
        preview = PhonePreview(capture)
        with self.assertRaises(PreviewUnavailable):
            preview.frame('')
        preview._lock.acquire()
        try:
            with self.assertRaises(PreviewUnavailable):
                preview.frame('phone')
        finally:
            preview._lock.release()
        capture.assert_not_called()

    def test_frame_endpoint_requires_local_host_and_token(self):
        handler = app.Handler.__new__(app.Handler)
        handler.headers = {'Host': f'127.0.0.1:{app.PORT}', 'X-App-Token': 'wrong'}
        handler.path = '/api/phone-screen'
        handler.send = Mock()
        handler.send_screen = Mock()
        handler.do_POST()
        handler.send_screen.assert_not_called()
        self.assertEqual(handler.send.call_args.args[0], 403)

    def test_capture_uses_stored_phone_without_job_lock_or_ui_action(self):
        handler = app.Handler.__new__(app.Handler)
        handler.wfile = io.BytesIO()
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        with patch.object(app.sp, 'read_json', return_value={'serial': 'selected'}), \
             patch.object(app.PREVIEW, 'frame', return_value=(b'jpeg', 123, (720, 1280))) as frame, \
             patch.object(app, 'phone_state') as inventory:
            handler.send_screen()
        frame.assert_called_once_with('selected')
        inventory.assert_not_called()
        self.assertEqual(handler.wfile.getvalue(), b'jpeg')


if __name__ == '__main__':
    unittest.main()
