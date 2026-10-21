import contextlib
import io
import json
import unittest
from unittest.mock import Mock, patch

import poster_app as app
import shopee_poster as sp
from test_locked_phone import LOCK, SIZE
from test_thermal_attention import THERMAL

APP = sp.parse_nodes('<hierarchy><node package="com.shopee.th" resource-id="com.shopee.th:id/ll_gallery_entrance" '
                     'text="Gallery" bounds="[0,900][200,1100]"/></hierarchy>')
PIN = sp.parse_nodes('<hierarchy><node package="com.android.systemui" class="android.widget.EditText" '
                     'resource-id="com.android.systemui:id/pinEntry" bounds="[100,200][600,300]"/></hierarchy>')


class AutoUnlockTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.dev.d.serial = 'phone'
        self.dev.d.app_current.return_value = {'package': sp.PKG}
        self.dev.shell.return_value = 'Display Power: state=OFF'
        self.cfg = {'auto_unlock_swipe': True, '_post_confirmed': False}

    def test_authorized_swipe_requires_fresh_native_app_before_returning(self):
        with patch.object(sp, 'screen', side_effect=[(SIZE, LOCK), (SIZE, APP)]), \
             patch.object(sp.time, 'sleep'), patch.object(sp, 'write_json') as write:
            self.assertEqual(sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK), (SIZE, APP))
        self.dev.d.screen_on.assert_called_once()
        self.dev.shell.assert_called_once_with('input swipe 360 1075 360 358 400')
        self.dev.click.assert_not_called()
        self.dev.press.assert_not_called()
        self.dev.type_text.assert_not_called()
        self.dev.app_start.assert_not_called()
        self.assertFalse(self.cfg['_post_confirmed'])
        write.assert_not_called()

    def test_disabled_mode_keeps_the_lock_and_does_not_wake(self):
        with self.assertRaises(sp.AttentionRequired):
            sp.recover_identity_screen(self.dev, {}, SIZE, LOCK)
        self.dev.d.screen_on.assert_not_called()
        self.dev.shell.assert_not_called()

    def test_repeated_detection_in_same_job_does_not_swipe_again(self):
        self.cfg['_unlock_swipe_attempted'] = True
        with self.assertRaises(sp.AttentionRequired):
            sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.dev.d.screen_on.assert_not_called()
        self.dev.shell.assert_not_called()

    def test_ignored_swipe_is_bounded_and_does_not_publish(self):
        with patch.object(sp, 'screen', return_value=(SIZE, LOCK)) as screen, \
             patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.assertEqual(screen.call_count, 4)
        self.dev.shell.assert_called_once_with('input swipe 360 1075 360 358 400')
        self.dev.click.assert_not_called()
        self.assertFalse(self.cfg['_post_confirmed'])

    def test_empty_frame_does_not_use_foreground_package_as_unlock_proof(self):
        with patch.object(sp, 'screen', side_effect=[(SIZE, LOCK)] + [(SIZE, [])] * 3), \
             patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.dev.shell.assert_called_once()

    def test_credential_screen_is_locked_even_without_clock_and_never_touched(self):
        self.assertEqual(sp.attention_from_screen(PIN, SIZE)['code'], 'phone_locked')
        with self.assertRaises(sp.AttentionRequired):
            sp.recover_identity_screen(self.dev, self.cfg, SIZE, PIN)
        self.dev.d.screen_on.assert_not_called()
        self.dev.shell.assert_not_called()
        self.dev.type_text.assert_not_called()

    def test_pin_found_after_wake_is_not_swiped_or_typed(self):
        with patch.object(sp, 'screen', return_value=(SIZE, PIN)), patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.dev.shell.assert_not_called()
        self.dev.type_text.assert_not_called()

    def test_pin_after_one_swipe_stops_without_guessing(self):
        with patch.object(sp, 'screen', side_effect=[(SIZE, LOCK), (SIZE, PIN)]), patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired):
                sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.dev.shell.assert_called_once()
        self.dev.type_text.assert_not_called()
        self.dev.press.assert_not_called()

    def test_heat_revealed_after_unlock_still_pauses_without_dismissing_warning(self):
        with patch.object(sp, 'screen', side_effect=[(SIZE, LOCK), (SIZE, THERMAL)]), \
             patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.AttentionRequired) as exc:
                sp.recover_identity_screen(self.dev, self.cfg, SIZE, LOCK)
        self.assertEqual(exc.exception.attention['code'], 'phone_overheating')
        self.dev.click.assert_not_called()
        self.dev.press.assert_not_called()
        self.assertEqual([c.args[0] for c in self.dev.shell.call_args_list],
                         ['input swipe 360 1075 360 358 400', 'dumpsys power'])
        self.assertFalse(self.cfg['_post_confirmed'])

    def test_caption_mentioning_a_pin_is_not_a_device_credential_screen(self):
        nodes = sp.parse_nodes('<hierarchy><node package="com.shopee.th" class="android.widget.EditText" '
            'resource-id="com.shopee.th:id/et_caption" text="PIN password pattern" bounds="[0,100][700,300]"/></hierarchy>')
        self.assertIsNone(sp.attention_from_screen(nodes, SIZE))

    def test_real_check_worker_verifies_only_after_swipe_and_native_screen(self):
        cfg = json.dumps({'serial': 'phone', 'auto_post': True, 'auto_unlock_swipe': True})
        self.dev.shell.return_value = 'package:' + sp.PKG
        output = io.StringIO()
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': cfg}), \
             patch.object(sp, 'connect', return_value=self.dev), \
             patch.object(sp, 'screen', side_effect=[(SIZE, LOCK), (SIZE, LOCK), (SIZE, APP)]), \
             patch.object(sp.time, 'sleep'), contextlib.redirect_stdout(output):
            self.assertEqual(app._worker('check'), 0)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        verified = next(e['verified'] for e in events if 'verified' in e)
        self.assertTrue(verified['screen'])
        self.assertFalse(any('attention' in e for e in events))
        self.dev.click.assert_not_called()
        self.dev.type_text.assert_not_called()


if __name__ == '__main__':
    unittest.main()
