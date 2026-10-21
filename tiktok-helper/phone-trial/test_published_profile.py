import datetime
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp


class PublishedProfileTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 14, 23, 48)
        self.started = '2026-10-14T23:46:00'
        self.ctx = {'caption_full': 'แคปชันครบ #ทดสอบ', '_verified_import': {'title': 'Exact product'}}
        self.texts = ['Minaa.rev', 'ผู้สร้าง', 'แคปชันครบ #ทดสอบ ซ่อน', 'Exact product', '1 นาทีที่แล้ว']

    def matches(self, texts=None, owner='Minaa.rev', started=None):
        return sp.published_panel_matches(self.texts if texts is None else texts, self.ctx, owner,
                                          self.started if started is None else started, self.now)

    def test_recent_creator_caption_product_all_match(self):
        self.assertTrue(self.matches())

    def test_added_digit_wrong_caption_or_wrong_product_is_rejected(self):
        for old, new in [('แคปชันครบ #ทดสอบ ซ่อน', 'แคปชันครบ #ทดสอบ000 ซ่อน'),
                         ('Exact product', 'Different product')]:
            with self.subTest(new=new):
                self.assertFalse(self.matches([new if t == old else t for t in self.texts]))

    def test_other_account_or_non_creator_comment_is_rejected(self):
        self.assertFalse(self.matches(owner='another-account'))
        self.assertFalse(self.matches([t for t in self.texts if t != 'ผู้สร้าง']))

    def test_old_post_and_invalid_attempt_time_are_rejected(self):
        self.assertFalse(self.matches([t.replace('1 นาทีที่แล้ว', '20 นาทีที่แล้ว') for t in self.texts]))
        self.assertFalse(self.matches(started='invalid'))
        self.assertFalse(self.matches(started='2026-10-14T23:00:00'))

    def test_layout_whitespace_does_not_change_caption_contents(self):
        self.ctx['caption_full'] = 'แคปชันครบ\n\n#ทดสอบ'
        self.assertTrue(self.matches())

    def test_delayed_recovery_requires_post_time_to_match_original_attempt(self):
        texts = [t.replace('1 นาทีที่แล้ว', '48 นาทีที่แล้ว') for t in self.texts]
        self.assertTrue(self.matches(texts, started='2026-10-14T23:00:00'))
        self.assertFalse(self.matches(started='2026-10-14T23:00:00'))

    def test_uncertain_recovery_keeps_journal_and_never_taps_post(self):
        cfg = {'serial': 'phone', 'clips_folder': str(Path.cwd()),
               '_cleanup_sources': {'video': 'sha', 'txt': 'txt'}}
        clip = SimpleNamespace(key='key', info={'link': 'https://s.shopee.co.th/example'})
        pending = {'status': 'posting', 'clips_folder': str(Path.cwd()),
                   'sources': cfg['_cleanup_sources'], 'remote': '/owned.mp4',
                   'started_at': self.started,
                   'context': {'product': {'source_url': clip.info['link']}}}
        dev = Mock()
        with patch.object(sp, 'read_json', return_value={'phone|key': {'remote': '/owned.mp4', 'sha256': 'sha'}}), \
             patch.object(sp, 'verify_published_profile', return_value=''), \
             patch.object(sp, 'write_json') as write, patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.StepFailed):
                sp.recover_pending_upload(dev, clip, cfg, pending)
        self.assertEqual(pending['status'], 'posting')
        write.assert_not_called()
        perform.assert_not_called()
        dev.click.assert_not_called()

    def test_hour_age_can_verify_original_pending_attempt(self):
        now = datetime.datetime(2026, 10, 15, 9, 33)
        started = '2026-10-15T02:05:31'
        texts = [t.replace('1 นาทีที่แล้ว', '7 ชั่วโมงที่แล้ว') for t in self.texts]
        self.assertTrue(sp.published_panel_matches(texts, self.ctx, 'Minaa.rev', started, now))
        for wrong_age in ('6 ชั่วโมงที่แล้ว', '9 ชั่วโมงที่แล้ว', '1 นาทีที่แล้ว'):
            wrong = [t.replace('7 ชั่วโมงที่แล้ว', wrong_age) for t in texts]
            self.assertFalse(sp.published_panel_matches(wrong, self.ctx, 'Minaa.rev', started, now))
        rounded = [t.replace('7 ชั่วโมงที่แล้ว', '8 ชั่วโมงที่แล้ว') for t in texts]
        self.assertTrue(sp.published_panel_matches(rounded, self.ctx, 'Minaa.rev', started, datetime.datetime(2026, 10, 15, 9, 40)))
        wrong_product = [t.replace('Exact product', 'Other product') for t in texts]
        self.assertFalse(sp.published_panel_matches(wrong_product, self.ctx, 'Minaa.rev', started, now))
