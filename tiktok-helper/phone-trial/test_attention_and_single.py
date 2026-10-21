import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp
import poster_app as app


IDENTITY_XML = '''<hierarchy><node text="ยืนยันตัวตน" resource-id="com.shopee.th:id/title_text" bounds="[112,79][676,133]"/><node text="การยืนยันหมดเวลา โปรดลองอีกครั้งในภายหลัง" bounds="[100,610][620,644]"/></hierarchy>'''


class AttentionAndSingleTests(unittest.TestCase):
    def setUp(self):
        self.nodes = sp.parse_nodes(IDENTITY_XML)
        self.dev = Mock()

    def test_identity_gate_stops_before_any_tap_or_prompt(self):
        ask = Mock(side_effect=AssertionError('must not request Enter'))
        with patch.object(sp, 'screen', return_value=((720, 1280), self.nodes)), \
             patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.AttentionRequired) as blocked:
                sp.run_step(self.dev, {'id': 'gallery', 'do': 'tap'}, {}, [], {'auto_post': True}, ask)
        self.assertEqual(blocked.exception.attention['code'], 'shopee_identity')
        perform.assert_not_called()
        ask.assert_not_called()
        self.dev.click.assert_not_called()

    def test_caption_containing_identity_words_is_not_a_gate(self):
        nodes = sp.parse_nodes(IDENTITY_XML.replace('com.shopee.th:id/title_text', 'com.shopee.th:id/et_caption'))
        self.assertIsNone(sp.attention_from_screen(nodes, (720, 1280)))

    def test_check_never_marks_identity_gate_as_ready(self):
        capture = io.StringIO()
        self.dev.shell.return_value = sp.PKG
        cfg = json.dumps({'serial': 'phone'})
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': cfg}), \
             patch.object(sp, 'connect', return_value=self.dev), \
             patch.object(sp, 'screen', return_value=((720, 1280), self.nodes)), \
             patch.object(app.sys, 'stdout', capture):
            result = app._worker('check')
        events = [json.loads(line) for line in capture.getvalue().splitlines()]
        self.assertEqual(result, 1)
        self.assertTrue(any(e.get('result') == 'attention' for e in events))
        self.assertFalse(any('verified' in e for e in events))
        self.assertFalse(any('prompt' in e for e in events))

    def test_single_post_worker_selects_one_and_reports_actual_publication(self):
        capture = io.StringIO()
        seen = []
        def post(settings, flow, ask):
            seen.append(settings)
            settings['_published_callback']({'status': 'posted', 'clip_key': 'selected'})
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': json.dumps({'auto_post': False}), 'SHOPEE_CLIP_KEY': 'selected'}), \
             patch.object(sp, 'load_flow', return_value=[]), patch.object(sp, 'cmd_post', side_effect=post), \
             patch.object(app.sys, 'stdout', capture):
            result = app._worker('post_one')
        self.assertEqual(result, 0)
        self.assertTrue(seen[0]['auto_post'])
        self.assertFalse(seen[0]['_prepare_only'])
        self.assertEqual(seen[0]['_clip_key'], 'selected')
        events = [json.loads(line) for line in capture.getvalue().splitlines()]
        self.assertEqual(events[-1]['result'], 'posted')

    def test_no_publication_is_not_a_successful_single_test(self):
        capture = io.StringIO()
        with patch.dict(app.os.environ, {'SHOPEE_JOB_SETTINGS': '{}', 'SHOPEE_CLIP_KEY': 'selected'}), \
             patch.object(sp, 'load_flow', return_value=[]), patch.object(sp, 'cmd_post'), \
             patch.object(app.sys, 'stdout', capture):
            result = app._worker('post_one')
        self.assertEqual(result, 1)
        self.assertEqual(json.loads(capture.getvalue().splitlines()[-1])['result'], 'failed')

    def test_selected_queue_never_posts_a_second_clip(self):
        chosen = SimpleNamespace(key='chosen', name='chosen', info={'link': 'url'}, txt='caption')
        other = SimpleNamespace(key='other', name='other', info={'link': 'url'}, txt='caption')
        posted = {'items': {}}
        def record(data, clip, status):
            data['items'][clip.key] = {'status': status}
        cfg = {'clips_folder': 'test', 'auto_post': True, 'daily_limit': 70, '_clip_key': 'chosen', 'delete_after_post': False}
        with patch.object(sp, 'scan_clips', return_value=([chosen, other], [])), \
             patch.object(sp, 'load_posted', return_value=posted), patch.object(sp, 'posted_today', return_value=0), \
             patch.object(sp, 'connect', return_value=self.dev), patch.object(sp, 'load_flow', return_value=[]), \
             patch.object(sp, 'run_clip', return_value=('posted', '/owned.mp4')) as run, \
             patch.object(sp, 'record_posted', side_effect=record), patch.object(sp, 'write_json'), \
             patch.object(sp, 'wait_between') as wait:
            sp.cmd_post(cfg, [], ask=lambda prompt: '')
        self.assertEqual(run.call_count, 1)
        self.assertIs(run.call_args.args[1], chosen)
        wait.assert_not_called()

    def test_create_uses_camera_state_before_advancing(self):
        camera = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/ll_gallery_entrance" bounds="[523,1012][627,1176]"/></hierarchy>')
        with patch.object(sp,'screen',return_value=((720,1280),camera)):
            self.assertEqual(sp.run_step(self.dev,{'id':'create','do':'tap'},{},[],{'auto_post':True}),'ok')
        self.dev.click.assert_not_called()

    def test_continuous_launch_keeps_session_and_retry_can_restart_once(self):
        cfg = {'reuse_app_session': True, 'startup_wait_seconds': 2}
        with patch.object(sp.time, 'sleep'):
            sp.run_step(self.dev, {'do': 'start_app'}, {}, [], cfg)
            self.dev.app_start.assert_called_with(sp.PKG, restart=False)
            cfg['_restart_app_once'] = True
            sp.run_step(self.dev, {'do': 'start_app'}, {}, [], cfg)
            self.dev.app_start.assert_called_with(sp.PKG, restart=True)
            self.assertNotIn('_restart_app_once', cfg)

    def test_gallery_waits_past_old_sixty_second_limit(self):
        cfg = {'auto_post': True, 'ui_timeout_seconds': 60, 'gallery_timeout_seconds': 120, 'gallery_load_wait_seconds': 5}
        with patch.object(sp, 'screen', return_value=((720, 1280), [])), \
             patch.object(sp, 'dismiss_popup', return_value=None), \
             patch.object(sp, 'find_target', side_effect=[None, ('point', (10, 20))]), \
             patch.object(sp, 'perform') as perform, patch.object(sp.time, 'time', side_effect=[100, 165]), \
             patch.object(sp.time, 'sleep') as sleep:
            result = sp.run_step(self.dev, {'id': 'gallery', 'do': 'tap'}, {}, [], cfg)
        self.assertEqual(result, 'ok')
        perform.assert_called_once()
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1, 5])

    def test_success_renews_device_readiness_and_persists_result(self):
        published = {'status': 'posted', 'serial': 'phone', 'clip_key': 'chosen', 'cleanup': {}}
        proc = SimpleNamespace(stdout=[json.dumps({'published': published}), json.dumps({'result': 'posted'})], wait=lambda: 0)
        pending = {'status': 'posted', 'serial': 'phone', 'clip_key': 'chosen'}
        job = {'running': True, 'state': 'running', 'prompt': None, 'logs': []}
        verified = {}
        with patch.object(app, 'PROCESS', proc), patch.object(app, 'JOB', job), patch.object(app, 'VERIFIED', verified), \
             patch.object(sp, 'read_json', return_value=pending), patch.object(sp, 'write_json') as write:
            app.collect(proc)
        self.assertTrue(verified['phone']['screen'])
        self.assertTrue(verified['phone']['shopee'])
        self.assertEqual(job['state'], 'posted')
        self.assertFalse(job['running'])
        self.assertEqual(pending['result'], published)
        write.assert_any_call(sp.PREPARED_FILE, pending)
        write.assert_any_call(app.ATTENTION_FILE, {})


if __name__ == '__main__':
    unittest.main()
