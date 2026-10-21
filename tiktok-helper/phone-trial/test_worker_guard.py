import io
import json
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import poster_app as app
import shopee_poster as sp


class WorkerGuardTests(unittest.TestCase):
    def setUp(self):
        self.proc = Mock()
        self.proc.poll.return_value = None
        self.job = {'running': True, 'state': 'running', 'logs': [], 'last_progress_at': 0}

    def guard(self, pending=None, now=301):
        def read(path, default):
            return (pending or {}) if path == sp.PREPARED_FILE else {'serial': 'phone'}
        with patch.object(app, 'PROCESS', self.proc), patch.object(app, 'JOB', self.job), \
             patch.object(sp, 'read_json', side_effect=read), patch.object(sp, 'load_posted', return_value={'items': {}}), \
             patch.object(sp, 'write_json'):
            return app.guard_worker_once(self.proc, now)

    def test_normal_slow_step_and_countdown_are_not_interrupted(self):
        self.assertFalse(self.guard(now=299))
        self.job['last_progress_at'] = 250
        self.assertFalse(self.guard(now=400))
        self.proc.terminate.assert_not_called()

    def test_silence_stops_only_owned_process_and_keeps_files(self):
        self.assertTrue(self.guard())
        self.proc.terminate.assert_called_once()
        self.assertEqual(self.job['attention']['code'], 'worker_stalled')
        self.assertEqual(self.job['state'], 'attention')

    def test_unknown_upload_blocks_republication_after_timeout(self):
        pending = {'status': 'posting', 'clip_key': 'clip', 'clip_name': 'original', 'serial': 'phone'}
        self.assertTrue(self.guard(pending))
        self.assertEqual(self.job['attention']['code'], 'upload_unconfirmed')
        self.assertEqual(pending['status'], 'posting')

    def test_unresponsive_termination_is_bounded(self):
        self.proc.wait.side_effect = subprocess.TimeoutExpired('owned-worker', 5)
        self.assertTrue(self.guard())
        self.proc.wait.assert_called_once_with(timeout=5)
        self.proc.kill.assert_called_once()

    def test_old_guard_cannot_stop_a_new_worker(self):
        with patch.object(app, 'PROCESS', Mock()), patch.object(app, 'JOB', self.job):
            self.assertFalse(app.guard_worker_once(self.proc, 999))
        self.proc.terminate.assert_not_called()

    def test_collector_keeps_timeout_attention_when_worker_exits(self):
        proc = SimpleNamespace(stdout=[], wait=lambda: 1)
        self.job.update(state='attention', attention={'code': 'worker_stalled'})
        with patch.object(app, 'PROCESS', proc), patch.object(app, 'JOB', self.job):
            app.collect(proc)
        self.assertEqual(self.job['state'], 'attention')
        self.assertFalse(self.job['running'])

    def test_confirmed_journal_without_history_still_blocks_start(self):
        pending = {'status': 'posted', 'clip_key': 'clip'}
        self.assertIsNotNone(app.pending_upload(pending, {'items': {}}))
        self.assertIsNotNone(app.pending_upload(pending, {'items': {'clip': {'status': 'skipped'}}}))
        self.assertIsNone(app.pending_upload(pending, {'items': {'clip': {'status': 'posted'}}}))

    def test_automatic_worker_never_waits_for_manual_prompt(self):
        output = io.StringIO()
        def unexpected_prompt(settings, flow, ask):
            ask('โพสต์แล้วกด Enter · s = ข้ามคลิปนี้ · q = หยุด:')
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': json.dumps({'auto_post': True})}), \
             patch.object(sp, 'cmd_post', side_effect=unexpected_prompt), patch.object(sp, 'load_flow', return_value=[]), \
             patch.object(app.sys, 'stdout', output), patch.object(app.sys, 'stdin') as stdin:
            self.assertEqual(app._worker('post'), 1)
        stdin.readline.assert_not_called()
        self.assertEqual(json.loads(output.getvalue().splitlines()[-1])['result'], 'failed')


if __name__ == '__main__':
    unittest.main()
