import contextlib
import io
import json
import unittest
from unittest.mock import Mock, patch

import poster_app as app
import queue_runtime as runtime
import shopee_poster as sp

SIZE = (720, 1280)
LOCK = sp.parse_nodes('<hierarchy>'
    '<node resource-id="com.android.systemui:id/keyguard_carrier_text" text="โทรฉุกเฉินเท่านั้น" bounds="[0,0][350,70]"/>'
    '<node resource-id="com.android.systemui:id/keyguard_indication_text" text="กำลังชาร์จ 89%" bounds="[150,1150][550,1200]"/>'
    '</hierarchy>')


class LockedPhoneTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.dev.d.serial = 'phone'
        self.dev.shell.return_value = 'package:' + sp.PKG

    def test_actual_native_keyguard_is_attention(self):
        self.assertEqual(sp.attention_from_screen(LOCK, SIZE)['code'], 'phone_locked')
        self.assertIsNone(sp.attention_from_screen(LOCK[:1], SIZE))
        caption = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/et_caption" '
            'text="โทรฉุกเฉินเท่านั้น กำลังชาร์จ 89% หน้าล็อก" bounds="[0,100][700,300]"/></hierarchy>')
        self.assertIsNone(sp.attention_from_screen(caption, SIZE))

    def test_lock_blocks_flow_before_taps_typing_or_identity_reopen(self):
        step = {'id': 'video_tab', 'do': 'tap', 'find': [{'text': 'โทรฉุกเฉินเท่านั้น'}]}
        with patch.object(sp, 'screen', return_value=(SIZE, LOCK)), patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.AttentionRequired) as exc:
                sp.run_step(self.dev, step, {}, [], {'auto_post': True, 'reopen_on_identity': True})
        self.assertEqual(exc.exception.attention['code'], 'phone_locked')
        perform.assert_not_called()
        self.dev.app_start.assert_not_called()
        self.dev.press.assert_not_called()
        self.dev.click.assert_not_called()

    def test_phone_check_never_verifies_a_readable_lock_screen(self):
        output = io.StringIO()
        cfg = json.dumps({'serial': 'phone', 'auto_post': True, 'reopen_on_identity': True})
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': cfg}), \
             patch.object(sp, 'connect', return_value=self.dev), \
             patch.object(sp, 'screen', return_value=(SIZE, LOCK)), \
             patch.object(sp, 'write_json') as write, contextlib.redirect_stdout(output):
            self.assertEqual(app._worker('check'), 1)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertFalse(any('verified' in e for e in events))
        self.assertEqual(events[-1]['attention']['code'], 'phone_locked')
        write.assert_not_called()
        self.dev.click.assert_not_called()
        self.dev.press.assert_not_called()

    def test_original_queue_waits_for_user_unlock(self):
        status = {'settings': {'auto_post': True, 'serial': 'phone', 'clips_folder': 'folder'},
                  'job': {'running': False, 'kind': 'check', 'state': 'attention',
                          'attention': {'code': 'phone_locked'}}}
        session = {'active': True, 'serial': 'phone', 'clips_folder': 'folder', 'clip_keys': ['original']}
        self.assertEqual(runtime.next_action(status, session), '')


if __name__ == '__main__':
    unittest.main()
