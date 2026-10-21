import unittest
from unittest.mock import Mock, patch
import shopee_poster as sp


class IdentityReopenTests(unittest.TestCase):
    def setUp(self):
        self.size = (720, 1280)
        self.gate = sp.parse_nodes('<hierarchy><node text="ยืนยันตัวตน" resource-id="com.shopee.th:id/title_text" bounds="[0,0][100,100]"/></hierarchy>')
        self.feed = sp.parse_nodes('<hierarchy><node text="วิดีโอ" bounds="[0,0][100,100]"/></hierarchy>')
        self.dev = Mock()
        self.dev.d.app_current.return_value = {'package': sp.PKG}
        self.settings = {'reopen_on_identity': True, '_post_confirmed': False}

    def test_visible_gate_reopens_once_without_publishing_or_claiming_success(self):
        with patch.object(sp, 'screen', return_value=(self.size, self.feed)), patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.recover_identity_screen(self.dev, self.settings, self.size, self.gate), (self.size, self.feed))
        self.dev.press.assert_called_once_with('home')
        self.dev.app_start.assert_called_once_with(sp.PKG, restart=False)
        self.dev.click.assert_not_called()
        self.assertFalse(self.settings['_post_confirmed'])
        self.assertTrue(self.settings['_identity_reopened'])
        with self.assertRaises(sp.AttentionRequired):
            sp.recover_identity_screen(self.dev, self.settings, self.size, self.gate)
        self.assertEqual(self.dev.app_start.call_count, 1)

    def test_gate_that_returns_stays_paused_and_does_not_write_journal(self):
        with patch.object(sp, 'screen', return_value=(self.size, self.gate)), \
             patch.object(sp.time, 'monotonic', side_effect=[0, 1, 61]), patch.object(sp.time, 'sleep'), \
             patch.object(sp, 'write_json') as write:
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.settings, self.size, self.gate)
        write.assert_not_called()
        self.dev.click.assert_not_called()

    def test_launcher_is_not_treated_as_passing_verification(self):
        self.dev.d.app_current.return_value = {'package': 'launcher'}
        with patch.object(sp, 'screen', return_value=(self.size, self.feed)), \
             patch.object(sp.time, 'monotonic', side_effect=[0, 1, 61]), patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.settings, self.size, self.gate)

    def test_ready_screen_is_untouched_and_disabled_mode_pauses(self):
        self.assertEqual(sp.recover_identity_screen(self.dev, {}, self.size, self.feed), (self.size, self.feed))
        with self.assertRaises(sp.AttentionRequired):
            sp.recover_identity_screen(self.dev, {}, self.size, self.gate)
        self.dev.press.assert_not_called()
        self.dev.app_start.assert_not_called()

    def test_slow_phone_can_take_more_than_ten_seconds_to_reopen(self):
        with patch.object(sp, 'screen', side_effect=[(self.size, self.gate), (self.size, self.feed)]), \
             patch.object(sp.time, 'monotonic', side_effect=[0, 1, 25]), patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.recover_identity_screen(self.dev, self.settings, self.size, self.gate), (self.size, self.feed))
        self.dev.app_start.assert_called_once_with(sp.PKG, restart=False)


if __name__ == '__main__':
    unittest.main()
