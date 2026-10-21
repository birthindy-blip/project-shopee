import io
import json
import unittest
from unittest.mock import Mock, patch
import shopee_poster as sp
import poster_app as app


class UploadRetryTests(unittest.TestCase):
    def setUp(self):
        self.pending = {'status':'posting', 'serial':'phone', 'clip_key':'clip', 'remote':'/owned.mp4',
                        'sources':{'video':'sha', 'txt':'text'}}
        self.settings = {'auto_post':True, 'serial':'phone', '_active_clip_key':'clip',
                         '_cleanup_sources':self.pending['sources']}
        self.owned = {'phone|clip':{'remote':'/owned.mp4', 'sha256':'sha'}}
        self.nodes = sp.parse_nodes('<hierarchy><node bounds="[0,0][720,1280]"><node bounds="[24,156][697,272]"><node text="อัปโหลดไม่สำเร็จ" bounds="[144,176][430,215]"/><node text="กรุณาลองอีกครั้ง" bounds="[144,215][430,250]"/><node text="ลองใหม่" clickable="true" bounds="[470,190][630,238]"/></node></node></hierarchy>')
        self.dev = Mock()
        self.dev.d.app_current.return_value = {'package':sp.PKG}

    def read(self, path, default):
        return self.pending if path == sp.PREPARED_FILE else self.owned

    def run_retry(self):
        return sp.retry_failed_upload(self.dev, self.settings, '/owned.mp4', 'อัปโหลดไม่สำเร็จ')

    def test_one_original_retry_is_journaled_before_tap_and_never_marks_posted(self):
        order = []
        self.dev.click.side_effect = lambda *args: order.append('tap')
        with patch.object(sp, 'read_json', side_effect=self.read), \
             patch.object(sp, 'screen', return_value=((720,1280),self.nodes)), \
             patch.object(sp, 'write_json', side_effect=lambda *args: order.append('save')), \
             patch.object(sp, 'PostReceipt') as receipts:
            self.assertIs(self.run_retry(), receipts.return_value)
        self.assertEqual(order, ['save','tap'])
        self.assertEqual(self.pending['status'], 'posting')
        self.assertEqual(self.pending['upload_retry_count'],1)
        receipts.return_value.start.assert_called_once()

    def test_retry_survives_process_restart_and_is_never_repeated(self):
        self.pending['upload_retry_count'] = 1
        with patch.object(sp, 'read_json', side_effect=self.read), patch.object(sp, 'screen') as screen:
            self.assertIsNone(self.run_retry())
        screen.assert_not_called()
        self.dev.click.assert_not_called()

    def test_changed_source_or_wrong_upload_is_never_retried(self):
        for change in ({'clip_key':'other'}, {'remote':'/other.mp4'}, {'sources':{'video':'changed'}}):
            original = dict(self.pending)
            self.pending.update(change)
            with patch.object(sp, 'read_json', side_effect=self.read), patch.object(sp, 'write_json') as write:
                self.assertIsNone(self.run_retry())
            write.assert_not_called()
            self.dev.click.assert_not_called()
            self.pending = original

    def test_generic_retry_elsewhere_on_page_is_not_an_upload_retry(self):
        nodes = sp.parse_nodes('<hierarchy><node bounds="[0,0][720,1280]"><node text="อัปโหลดไม่สำเร็จ" bounds="[24,156][400,272]"/><node text="ลองใหม่" clickable="true" bounds="[24,900][400,1000]"/></node></hierarchy>')
        with patch.object(sp, 'read_json', side_effect=self.read), \
             patch.object(sp, 'screen', return_value=((720,1280),nodes)), patch.object(sp, 'write_json') as write:
            self.assertIsNone(self.run_retry())
        write.assert_not_called()
        self.dev.click.assert_not_called()

    def test_confirmation_uses_fresh_receipt_after_retry_without_pressing_post(self):
        failed, fresh = Mock(), Mock()
        failed.evidence, failed.error = '', 'อัปโหลดไม่สำเร็จ'
        fresh.evidence, fresh.error = 'อัปโหลดสำเร็จ', ''
        settings = {'auto_post':True, '_post_receipt':failed}
        with patch.object(sp, 'retry_failed_upload', return_value=fresh) as retry:
            self.assertEqual(sp.confirm_post(self.dev, settings, '/owned.mp4', Mock(), True), ('posted','/owned.mp4'))
        retry.assert_called_once_with(self.dev, settings, '/owned.mp4', 'อัปโหลดไม่สำเร็จ')
        self.assertTrue(settings['_post_confirmed'])
        failed.close.assert_called_once()
        fresh.close.assert_called_once()
        self.dev.click.assert_not_called()

    def test_retry_worker_rejects_stale_journal_before_connecting(self):
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS':json.dumps({'serial':'phone'}), 'SHOPEE_CLIP_KEY':'clip'}), \
             patch.object(sp, 'read_json', return_value={'status':'prepared','serial':'phone','clip_key':'clip'}), \
             patch.object(sp, 'connect') as connect, patch.object(sp, 'retry_failed_upload') as retry, \
             patch.object(app.sys, 'stdout', io.StringIO()):
            self.assertEqual(app.worker('retry_upload'),1)
        connect.assert_not_called()
        retry.assert_not_called()


if __name__ == '__main__':
    unittest.main()
