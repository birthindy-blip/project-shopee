import contextlib
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import poster_app as app
import queue_runtime as rt
import shopee_poster as sp
from test_auto_unlock import APP, SIZE
from test_thermal_attention import THERMAL


class ThermalCooldownTests(unittest.TestCase):
    def setUp(self):
        self.q = {'active': True, 'serial': 'phone', 'clips_folder': 'folder', 'clip_keys': ['original']}
        self.s = {'settings': {'auto_post': True, 'serial': 'phone', 'clips_folder': 'folder',
                              'thermal_cooldown_minutes': 60, 'daily_limit': 74},
                  'job': {'running': False, 'kind': 'post', 'state': 'attention', 'logs': [],
                          'attention': {'code': 'phone_overheating', 'screen_sleep': 'confirmed',
                                        'seen_at': 100, 'serial': 'phone'}},
                  'phone': {'state': 'device', 'serial': 'phone', 'checked': False},
                  'today': 70, 'ready': False, 'clips': [{'key': 'original', 'state': 'pending'}]}

    def arm(self):
        self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=1000))
        self.assertEqual(self.q['cooldown']['resume_at'], 4600)

    def test_full_hour_before_one_readiness_check_and_never_direct_post(self):
        self.arm()
        for now in [1000, 2000, 4599.9]:
            self.assertEqual(rt.next_action(self.s, self.q, now=now), '')
        self.assertEqual(rt.next_action(self.s, self.q, now=4600), 'cooldown_check')
        self.assertEqual(rt.cooldown_status(self.q, self.s['settings'], now=4599.9)['seconds_remaining'], 1)

    def test_polling_and_disk_reload_preserve_original_deadline(self):
        self.arm()
        with tempfile.TemporaryDirectory() as d, patch.object(rt, 'SESSION', Path(d) / 'session.json'):
            rt.save(self.q)
            resumed = rt.load()
            for now in [1100, 3000, 4599]:
                self.assertFalse(rt.reconcile_cooldown(self.s, resumed, now=now))
            self.assertEqual(resumed['cooldown']['resume_at'], 4600)
            self.assertEqual(rt.next_action(self.s, resumed, now=4600), 'cooldown_check')

    def test_new_heat_after_expiry_starts_another_full_hour_once(self):
        self.arm()
        self.q['cooldown']['phase'] = 'checking'
        self.s['job']['kind'] = 'check'
        self.s['job']['attention']['seen_at'] = 200
        self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=4700))
        self.assertEqual(self.q['cooldown']['resume_at'], 8300)
        self.assertFalse(rt.reconcile_cooldown(self.s, self.q, now=4800))

    def test_disabled_failed_sleep_and_missing_event_do_not_schedule_wakes(self):
        for change in ['disabled', 'failed_sleep', 'missing_event']:
            with self.subTest(change=change):
                self.setUp()
                if change == 'disabled': self.s['settings']['thermal_cooldown_minutes'] = 0
                if change == 'failed_sleep': self.s['job']['attention']['screen_sleep'] = 'failed'
                if change == 'missing_event': self.s['job']['attention'].pop('seen_at')
                self.assertFalse(rt.reconcile_cooldown(self.s, self.q, now=1000))
                self.assertEqual(rt.next_action(self.s, self.q, now=9000), '')

    def test_stopped_or_changed_queue_cannot_schedule_or_resume(self):
        self.arm()
        for key, value in [('active', False), ('serial', 'other'), ('clips_folder', 'other')]:
            q = copy.deepcopy(self.q); q[key] = value
            self.assertFalse(rt.reconcile_cooldown(self.s, q, now=5000))
            self.assertIsNone(rt.cooldown_status(q, self.s['settings'], now=5000))
            self.assertEqual(rt.next_action(self.s, q, now=5000), '')

    def test_disconnected_phone_waits_without_consuming_expired_timer(self):
        self.arm(); self.s['phone']['state'] = 'offline'
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), '')
        self.assertEqual(self.q['cooldown']['phase'], 'waiting')
        self.s['phone']['state'] = 'device'
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), 'cooldown_check')

    def test_changed_selected_phone_is_not_woken(self):
        self.arm(); self.s['phone']['serial'] = 'other-phone'
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), '')

    def test_timer_cannot_transfer_to_another_manifest(self):
        self.arm(); self.q['clip_keys'] = ['different-batch']
        self.assertIsNone(rt.cooldown_status(self.q, self.s['settings'], now=5000))
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), '')

    def test_cap_or_no_original_files_completes_without_waking_or_new_batch(self):
        self.arm()
        self.s['today'] = 74
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), 'complete')
        self.s['today'] = 70; self.s['clips'] = [{'key': 'new-file', 'state': 'pending'}]
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), 'complete')

    def test_unknown_post_after_cooldown_is_readonly_recovery_only(self):
        self.s['job']['unconfirmed'] = {'clip_key': 'original'}
        self.q['recovery_key'] = 'original'
        self.arm(); self.q['cooldown']['phase'] = 'checking'
        self.s['job'].update(kind='check', state='attention', attention={'code': 'upload_unconfirmed'})
        self.s['phone'].update(checked=True, shopee=True, screen=True)
        self.s['ready'] = True; self.s['today'] = 74
        self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=5000))
        self.assertNotIn('recovery_key', self.q)
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), 'recover')

    def test_unknown_outside_original_manifest_is_never_scheduled(self):
        self.s['job']['unconfirmed'] = {'clip_key': 'different'}
        self.assertFalse(rt.reconcile_cooldown(self.s, self.q, now=1000))
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), '')

    def test_successful_check_returns_to_same_original_batch(self):
        self.arm(); self.q['cooldown']['phase'] = 'checking'
        self.s['job'].update(kind='check', state='done', attention=None)
        self.s['phone'].update(checked=True, shopee=True, screen=True)
        self.s['ready'] = True
        self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=5000))
        self.assertEqual(self.q['cooldown']['phase'], 'completed')
        self.assertEqual(self.q['clip_keys'], ['original'])
        self.assertEqual(rt.next_action(self.s, self.q, now=5000), 'post')

    def test_pin_identity_or_failed_check_is_not_retried_every_poll(self):
        for attention in [{'code': 'phone_locked'}, {'code': 'shopee_identity'}, None]:
            self.setUp(); self.arm(); self.q['cooldown']['phase'] = 'checking'
            self.s['job'].update(kind='check', state='failed' if attention is None else 'attention', attention=attention)
            self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=5000))
            self.assertEqual(self.q['cooldown']['phase'], 'blocked')
            self.assertEqual(rt.next_action(self.s, self.q, now=9000), '')

    def test_server_restart_during_check_retains_deadline_and_waits_for_lease(self):
        self.arm(); self.q['cooldown']['phase'] = 'checking'
        self.s['job'].update(kind='', state='attention')
        self.assertTrue(rt.reconcile_cooldown(self.s, self.q, now=5000))
        self.assertEqual(self.q['cooldown']['resume_at'], 4600)
        self.assertEqual(rt.next_action(self.s, self.q, now=5059), '')
        self.assertEqual(rt.next_action(self.s, self.q, now=5060), 'cooldown_check')

    def test_user_stop_cancels_persisted_timer(self):
        self.arm()
        with tempfile.TemporaryDirectory() as d, patch.object(rt, 'SESSION', Path(d) / 'session.json'):
            rt.save(self.q); rt.stop('user_stopped'); stopped = rt.load()
        self.assertFalse(stopped['active'])
        self.assertEqual(stopped['cooldown']['phase'], 'cancelled')
        self.assertEqual(rt.next_action(self.s, stopped, now=9000), '')

    def test_controller_persists_consumed_deadline_before_starting_check(self):
        self.arm(); events = []
        with patch.object(app, 'JOB', self.s['job']), patch.object(app, 'status', return_value=self.s), \
             patch.object(rt, 'load', return_value=self.q), patch.object(rt.time, 'time', return_value=4600), \
             patch.object(rt, 'save', side_effect=lambda q: events.append(('save', q['cooldown']['phase']))), \
             patch.object(app, 'start_job', side_effect=lambda kind, **kw: events.append(('start', kind, kw))):
            app.auto_queue_once()
        self.assertEqual(events, [('save', 'checking'), ('start', 'check', {'auto_resume': True})])

    def test_launch_failure_waits_a_minute_without_republishing(self):
        self.arm()
        with patch.object(app, 'JOB', self.s['job']), patch.object(app, 'status', return_value=self.s), \
             patch.object(rt, 'load', return_value=self.q), patch.object(rt.time, 'time', return_value=4600), \
             patch.object(rt, 'save'), patch.object(app, 'start_job', side_effect=ValueError('device changed')):
            with self.assertRaises(ValueError): app.auto_queue_once()
        self.assertEqual(self.q['cooldown']['phase'], 'waiting')
        self.assertEqual(rt.next_action(self.s, self.q, now=4659), '')
        self.assertEqual(rt.next_action(self.s, self.q, now=4660), 'cooldown_check')

    def test_manual_early_check_is_blocked_before_any_phone_operation(self):
        self.arm()
        with patch.object(app, 'JOB', self.s['job']), patch.object(rt, 'load', return_value=self.q), \
             patch.object(sp, 'read_json', return_value=self.s['settings']), \
             patch.object(rt.time, 'time', return_value=2000), patch.object(app, 'phone_state') as phone:
            with self.assertRaises(ValueError): app.start_job('check')
        phone.assert_not_called()

    def test_timer_keeps_computer_system_awake_without_requiring_display(self):
        import ctypes
        self.arm()
        with patch.object(app.os, 'name', 'nt'), patch.object(rt, 'load', return_value=self.q), \
             patch.object(sp, 'read_json', return_value=self.s['settings']), \
             patch.object(rt.time, 'time', return_value=2000), patch.object(ctypes.windll.kernel32, 'SetThreadExecutionState') as keeper:
            app.keep_cooldown_computer_awake()
        keeper.assert_called_once_with(0x80000001)

    def test_timer_stop_releases_only_the_controller_sleep_request(self):
        import ctypes
        self.arm(); self.q['active'] = False
        with patch.object(app.os, 'name', 'nt'), patch.object(rt, 'load', return_value=self.q), \
             patch.object(sp, 'read_json', return_value=self.s['settings']), \
             patch.object(rt.time, 'time', return_value=2000), patch.object(ctypes.windll.kernel32, 'SetThreadExecutionState') as keeper:
            app.keep_cooldown_computer_awake()
        keeper.assert_called_once_with(0x80000000)

    def test_preview_does_not_capture_during_rest(self):
        self.arm()
        with patch.object(rt, 'load', return_value=self.q), patch.object(sp, 'read_json', return_value=self.s['settings']), \
             patch.object(rt.time, 'time', return_value=2000), patch.object(app.PREVIEW, 'frame') as frame:
            with self.assertRaises(app.PreviewUnavailable):
                app.Handler.send_screen(Mock())
        frame.assert_not_called()

    def test_due_worker_wakes_once_and_verifies_native_screen_without_posting(self):
        dev = Mock(); dev.d.serial = 'phone'; dev.shell.return_value = 'package:' + sp.PKG
        cfg = json.dumps({'auto_post': True, 'serial': 'phone', '_cooldown_resume': True, 'auto_unlock_swipe': True})
        output = io.StringIO()
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': cfg}), patch.object(sp, 'connect', return_value=dev), \
             patch.object(sp, 'screen', return_value=(SIZE, APP)), patch.object(sp.time, 'sleep'), \
             patch.object(sp, 'cmd_post') as post, contextlib.redirect_stdout(output):
            self.assertEqual(app._worker('check'), 0)
        dev.d.screen_on.assert_called_once()
        post.assert_not_called()
        self.assertTrue(any('verified' in json.loads(line) for line in output.getvalue().splitlines()))

    def test_due_worker_with_heat_still_sleeps_and_never_claims_ready(self):
        dev = Mock(); dev.d.serial = 'phone'; dev.shell.return_value = 'Display Power: state=OFF'
        cfg = json.dumps({'auto_post': True, 'serial': 'phone', '_cooldown_resume': True, 'auto_unlock_swipe': True})
        output = io.StringIO()
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': cfg}), patch.object(sp, 'connect', return_value=dev), \
             patch.object(sp, 'screen', return_value=(SIZE, THERMAL)), patch.object(sp.time, 'sleep'), \
             patch.object(sp, 'cmd_post') as post, contextlib.redirect_stdout(output):
            self.assertEqual(app._worker('check'), 1)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertFalse(any('verified' in e for e in events))
        self.assertEqual(events[-1]['attention']['code'], 'phone_overheating')
        post.assert_not_called(); dev.click.assert_not_called()


if __name__ == '__main__':
    unittest.main()
