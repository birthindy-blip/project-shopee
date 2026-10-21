import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp


class PostReceiptTests(unittest.TestCase):
    def test_cached_success_survives_disappearing_toast_without_prompt(self):
        dev = SimpleNamespace(d=SimpleNamespace(last_toast=None))
        receipt = sp.PostReceipt(dev)
        receipt.observe('อัปโหลดสำเร็จ')
        settings = {'auto_post': True, '_post_receipt': receipt, '_toast_cleared': True}
        ask = Mock(side_effect=AssertionError('automatic mode must not ask'))
        with patch.object(sp, 'screen', side_effect=AssertionError('no slow dump needed')):
            self.assertEqual(sp.confirm_post(dev, settings, '/owned.mp4', ask, True), ('posted', '/owned.mp4'))
        self.assertTrue(settings['_post_confirmed'])
        self.assertEqual(settings['_post_evidence'], 'อัปโหลดสำเร็จ')
        ask.assert_not_called()

    def test_missing_receipt_never_prompts_or_claims_success(self):
        settings = {'auto_post': True, 'post_timeout_seconds': 0}
        ask = Mock(side_effect=AssertionError('automatic mode must not ask'))
        with self.assertRaises(sp.StepFailed):
            sp.confirm_post(SimpleNamespace(), settings, '/owned.mp4', ask, True)
        self.assertFalse(settings['_post_confirmed'])
        ask.assert_not_called()

    def test_not_clicked_never_falls_through_to_manual_confirmation(self):
        settings = {'auto_post': True}
        ask = Mock(side_effect=AssertionError('automatic mode must not ask'))
        with self.assertRaises(sp.StepFailed):
            sp.confirm_post(SimpleNamespace(), settings, '/owned.mp4', ask, False)
        ask.assert_not_called()

    def test_fresh_failure_stops_without_prompt(self):
        dev = SimpleNamespace(d=SimpleNamespace(last_toast=None))
        receipt = sp.PostReceipt(dev)
        receipt.observe('อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง')
        settings = {'auto_post': True, '_post_receipt': receipt, '_toast_cleared': True}
        ask = Mock(side_effect=AssertionError('automatic mode must not ask'))
        with self.assertRaises(sp.StepFailed):
            sp.confirm_post(dev, settings, '/owned.mp4', ask, True)
        self.assertFalse(settings['_post_confirmed'])
        ask.assert_not_called()

    def test_other_messages_are_not_upload_evidence(self):
        receipt = sp.PostReceipt(None)
        for message in ['นำเข้าสำเร็จ', 'อัปโหลด', 'โพสต์', None, 'ไม่อัปโหลดสำเร็จ']:
            receipt.observe(message)
        self.assertEqual(receipt.evidence, '')
        self.assertFalse(receipt.done.is_set())


if __name__ == '__main__':
    unittest.main()
