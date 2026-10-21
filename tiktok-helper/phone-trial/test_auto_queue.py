import datetime
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp


class AutoQueueTests(unittest.TestCase):
    def test_resumed_queue_preserves_remaining_spacing(self):
        posted = {'items': {'clip': {'status': 'posted', 'at': '2026-10-15T09:30:00'}}}
        with patch.object(sp.random, 'uniform', return_value=4):
            delay = sp.resume_delay_seconds({'delay_minutes': [3, 6]}, posted, datetime.datetime(2026, 10, 15, 9, 31))
        self.assertEqual(delay, 181)
        with patch.object(sp.random, 'uniform') as draw:
            self.assertEqual(sp.resume_delay_seconds({'delay_minutes': [3, 6]}, posted, datetime.datetime(2026, 10, 15, 9, 40)), 0)
        draw.assert_not_called()

    def test_slow_gallery_waits_before_selecting_and_preserves_failed_clip(self):
        dev = Mock()
        dev.d.return_value.wait.return_value = False
        with patch.object(sp, 'screen', return_value=((720, 1280), [])):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.pick_uploaded_clip(dev, {'remote': '/sdcard/DCIM/SVexample/clip.mp4'}, {'gallery_timeout_seconds': 120})
        dev.d.return_value.wait.assert_called_once_with(timeout=120)
        dev.d.return_value.click.assert_not_called()
        dev.click.assert_not_called()

    def test_short_link_is_imported_without_external_lookup_or_invented_ids(self):
        clip = SimpleNamespace(txt='clip.txt', info={'link': 'https://s.shopee.co.th/example'})
        with patch.object(sp.products, 'resolve_link') as lookup:
            result = sp.source_product(clip, {'auto_post': True})
        lookup.assert_not_called()
        self.assertEqual(result['product_url'], clip.info['link'])
        self.assertEqual(result['status'], 'import_link')
        self.assertEqual(result['item_id'], '')

    def test_ignored_gallery_tap_retries_native_button_once_without_selecting_a_clip(self):
        nodes = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/ll_gallery_entrance" bounds="[523,1012][627,1176]" clickable="true"/></hierarchy>')
        dev, title, camera = Mock(), Mock(), Mock()
        title.wait.return_value = False
        dev.d.side_effect = lambda **kw: camera if kw.get('resourceId','').endswith('/ll_gallery_entrance') else title
        with patch.object(sp, 'screen', return_value=((720,1280), nodes)), patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.pick_uploaded_clip(dev, {'remote':'/sdcard/DCIM/SVexample/clip.mp4'}, {'gallery_timeout_seconds':120})
        camera.click.assert_called_once_with(timeout=2)
        title.wait.assert_called_once_with(timeout=120)
        title.click.assert_not_called()
        dev.click.assert_not_called()

    def test_invalid_source_is_rejected_before_phone_upload(self):
        for link in ['', 'https://example.com/product', 'https://user:password@shopee.co.th/product/1/2']:
            with self.subTest(link=link):
                clip = SimpleNamespace(txt='clip.txt', info={'link': link})
                with self.assertRaises(sp.ClipUnavailable):
                    sp.source_product(clip, {'auto_post': True})
        with self.assertRaises(sp.ClipUnavailable):
            sp.source_product(SimpleNamespace(txt=None, info={'link': 'https://s.shopee.co.th/example'}), {'auto_post': True})


if __name__ == '__main__':
    unittest.main()
