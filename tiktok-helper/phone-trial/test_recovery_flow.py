import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp
import poster_app as app


class RecoveryFlowTests(unittest.TestCase):
    def test_pending_journal_blocks_until_recorded(self):
        pending = {'status': 'posting', 'clip_key': 'clip', 'serial': 'old-phone'}
        self.assertEqual(app.pending_upload(pending, {'items': {}})['serial'], 'old-phone')
        self.assertIsNone(app.pending_upload(pending, {'items': {'clip': {'status': 'posted'}}}))
        self.assertIsNone(app.pending_upload({**pending, 'status': 'prepared'}, {'items': {}}))

    def test_recovery_never_starts_a_new_clip_when_journal_changes(self):
        clip = SimpleNamespace(key='selected')
        with patch.object(sp.post_cleanup, 'source_snapshot', return_value={}), \
             patch.object(sp, 'read_json', return_value={'status': 'posting', 'clip_key': 'other', 'serial': 'phone'}), \
             patch.object(sp, 'push_clip') as push, patch.object(sp, 'run_step') as step:
            with self.assertRaises(sp.StepFailed):
                sp.run_clip(Mock(), clip, {'serial': 'phone', 'auto_post': True, '_recover_only': True}, [], Mock())
        push.assert_not_called()
        step.assert_not_called()

    def test_identity_after_post_is_actionable_and_not_confirmed(self):
        nodes = sp.parse_nodes('<hierarchy><node text="ยืนยันตัวตน" resource-id="com.shopee.th:id/title_text" bounds="[0,0][100,100]"/></hierarchy>')
        receipt = sp.PostReceipt(SimpleNamespace(d=SimpleNamespace(last_toast=None)))
        settings = {'auto_post': True, '_post_receipt': receipt, '_toast_cleared': True}
        with patch.object(sp.time, 'monotonic', side_effect=[0, 13, 13]), \
             patch.object(sp, 'screen', return_value=((720, 1280), nodes)):
            with self.assertRaises(sp.AttentionRequired):
                sp.confirm_post(receipt.dev, settings, '/owned', Mock(), True)
        self.assertFalse(settings['_post_confirmed'])
        self.assertTrue(receipt.done.is_set())

    def test_recovery_worker_requires_same_journal_before_any_navigation(self):
        output = io.StringIO()
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': json.dumps({'serial': 'phone'}), 'SHOPEE_CLIP_KEY': 'clip'}), \
             patch.object(sp, 'read_json', return_value={'status': 'prepared', 'clip_key': 'clip', 'serial': 'phone'}), \
             patch.object(sp, 'connect') as connect, patch.object(sp, 'cmd_post') as post, \
             patch.object(app.sys, 'stdout', output):
            code = app._worker('recover')
        self.assertEqual(code, 1)
        connect.assert_not_called()
        post.assert_not_called()

    def test_profile_navigation_checks_gate_before_clicking(self):
        dev = Mock()
        dev.d.app_current.return_value = {'package': sp.PKG}
        nodes = sp.parse_nodes('<hierarchy><node text="ยืนยันตัวตน" resource-id="com.shopee.th:id/title_text" bounds="[0,0][100,100]"/></hierarchy>')
        with patch.object(sp, 'screen', return_value=((720, 1280), nodes)):
            with self.assertRaises(sp.AttentionRequired):
                sp.prepare_profile_inspection(dev, {}, [])
        dev.click.assert_not_called()
        dev.app_start.assert_not_called()

    def test_recovery_returns_from_public_viewer_without_publishing(self):
        dev = Mock()
        dev.d.app_current.return_value = {'package': sp.PKG}
        viewer = sp.parse_nodes('<hierarchy><node content-desc="video caption content" bounds="[0,0][100,100]"/></hierarchy>')
        profile = sp.parse_nodes('<hierarchy><node content-desc="nick name of me" bounds="[0,0][100,100]"/></hierarchy>')
        with patch.object(sp, 'screen', side_effect=[((720,1280), viewer), ((720,1280), profile)]), patch.object(sp.time, 'sleep'):
            sp.prepare_profile_inspection(dev, {}, [])
        dev.press.assert_called_once_with('back')
        dev.click.assert_not_called()


if __name__ == '__main__':
    unittest.main()
