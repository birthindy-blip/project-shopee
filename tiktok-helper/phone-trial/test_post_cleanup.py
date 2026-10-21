import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import post_cleanup as cleanup


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.video = self.root / 'clip.mp4'
        self.txt = self.root / 'clip.txt'
        self.video.write_bytes(b'posted-clip')
        self.txt.write_text('caption', encoding='utf-8')
        self.clip = SimpleNamespace(video=self.video, txt=self.txt, key='clip.mp4|11')
        self.remote = '/sdcard/DCIM/Trial/SV0123456789/sv_20261014_123456_001.mp4'
        self.cfg = {'delete_after_post': True, '_post_confirmed': True,
                    'clips_folder': str(self.root), 'serial': 'phone',
                    'phone_folder': '/sdcard/DCIM/Trial',
                    '_cleanup_sources': cleanup.source_snapshot(self.clip)}
        self.posted = {'items': {self.clip.key: {'status': 'posted'}}}
        self.uploads = {'phone|' + self.clip.key: {'remote': self.remote,
                        'sha256': self.cfg['_cleanup_sources']['video']}}
        self.calls = []
        self.recycled = []
        self.dev = SimpleNamespace(shell=self.shell)

    def shell(self, cmd):
        self.calls.append(cmd)
        if cmd.startswith('sha256sum '):
            return self.cfg['_cleanup_sources']['video'] + '  file'
        if cmd.startswith('test '):
            return 'REMOVED'
        return ''

    def recycle(self, paths):
        self.recycled.extend(paths)
        for p in paths:
            p.rename(self.root / (p.name + '.recycled'))

    def run_cleanup(self, remaining=None):
        return cleanup.cleanup_posted(self.dev, self.clip, self.cfg, self.posted,
                    self.remote, self.uploads, remaining or [self.clip], recycle=self.recycle)

    def test_confirmed_post_removes_only_pair_and_exact_phone_file(self):
        other = self.root / 'other.mp4'
        other.write_bytes(b'keep')
        result = self.run_cleanup()
        self.assertEqual(set(self.recycled), {self.video, self.txt})
        self.assertTrue(other.exists())
        self.assertTrue(result['phone'])
        self.assertEqual([c for c in self.calls if c.startswith('rm ')], ['rm -f -- ' + self.remote])

    def test_unconfirmed_prepared_failed_and_skipped_never_delete(self):
        for status, prepared, confirmed in [('posted', True, True), ('failed', False, True),
                                           ('skipped', False, True), ('posted', False, False)]:
            with self.subTest(status=status, prepared=prepared, confirmed=confirmed):
                self.posted['items'][self.clip.key]['status'] = status
                self.cfg.update(_prepare_only=prepared, _post_confirmed=confirmed)
                self.run_cleanup()
                self.assertFalse(self.calls)
                self.assertTrue(self.video.exists())
                self.assertTrue(self.txt.exists())

    def test_shared_txt_remains_for_pending_second_clip(self):
        other = SimpleNamespace(video=self.root / 'clip-B.mp4', txt=self.txt, key='B')
        result = self.run_cleanup([self.clip, other])
        self.assertTrue(self.txt.exists())
        self.assertTrue(result['txt_kept_for_other_clip'])

    def test_changed_local_clip_is_preserved(self):
        self.video.write_bytes(b'new-content')
        with self.assertRaises(RuntimeError):
            self.run_cleanup()
        self.assertFalse(self.recycled)
        self.assertFalse(self.calls)

    def test_phone_file_outside_owned_folder_is_preserved(self):
        self.remote = '/sdcard/Download/unrelated.mp4'
        with self.assertRaises(RuntimeError):
            self.run_cleanup()
        self.assertFalse(self.recycled)
        self.assertFalse(self.calls)

    def test_recycle_failure_does_not_delete_phone(self):
        def fail(_):
            raise RuntimeError('Recycle Bin unavailable')
        self.recycle = fail
        with self.assertRaises(RuntimeError):
            self.run_cleanup()
        self.assertFalse(any(c.startswith('rm ') for c in self.calls))

    def test_encoded_upload_checks_source_and_both_owned_copies(self):
        record = self.uploads['phone|' + self.clip.key]
        cache = self.root / 'encoded'
        cache.mkdir()
        payload = cache / (record['sha256'] + '.mp4')
        payload.write_bytes(b'encoded')
        record.update(source_sha256=record['sha256'], sha256=cleanup.digest(payload), payload=str(payload))
        old_remote = self.remote.replace('001.mp4', '002.mp4')
        record['previous_uploads'] = [{'remote':old_remote, 'sha256':record['source_sha256']}]
        shell = self.shell
        def encoded_shell(cmd):
            if cmd == 'sha256sum ' + self.remote:
                self.calls.append(cmd)
                return record['sha256'] + '  file'
            return shell(cmd)
        self.dev.shell = encoded_shell
        with patch.object(cleanup, '__file__', str(self.root / 'post_cleanup.py')):
            result = self.run_cleanup()
        self.assertTrue(result['phone'])
        self.assertIn(payload, self.recycled)
        self.assertFalse(payload.exists())
        self.assertEqual(set(c for c in self.calls if c.startswith('rm ')),
                         {'rm -f -- ' + self.remote, 'rm -f -- ' + old_remote})

    def test_previous_upload_from_another_source_blocks_all_cleanup(self):
        self.uploads['phone|' + self.clip.key]['previous_uploads'] = [
            {'remote':self.remote.replace('001.mp4','002.mp4'), 'sha256':'different-source'}]
        with self.assertRaises(RuntimeError):
            self.run_cleanup()
        self.assertFalse(self.recycled)
        self.assertFalse(any(c.startswith('rm ') for c in self.calls))

    def test_payload_outside_program_cache_is_never_recycled(self):
        self.uploads['phone|' + self.clip.key]['payload'] = str(self.video)
        with self.assertRaises(RuntimeError):
            self.run_cleanup()
        self.assertFalse(self.recycled)
        self.assertTrue(self.video.exists())


if __name__ == '__main__':
    unittest.main()
