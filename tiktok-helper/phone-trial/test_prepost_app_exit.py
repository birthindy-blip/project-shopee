import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp

SIZE = (720,1280)
LAUNCHER = sp.parse_nodes('<hierarchy><node package="com.miui.home" resource-id="com.miui.home:id/workspace" bounds="[0,0][720,1280]"><node text="วิดีโอ" bounds="[20,50][160,150]"/></node></hierarchy>')


class PrepostAppExitTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.dev.d.app_current.return_value = {'package':'com.miui.home'}
        self.dev.shell.return_value = ''
        self.clip = SimpleNamespace(key='original.mp4|123')
        self.settings = {'auto_post':True}

    def test_native_launcher_and_missing_process_prove_app_exit(self):
        with self.assertRaises(sp.PhoneAppExited):
            sp.require_prepost_foreground(self.dev, LAUNCHER, SIZE)
        self.dev.shell.assert_called_once_with('pidof com.shopee.th')
        self.dev.click.assert_not_called()

    def test_live_cold_start_waits_without_restart_or_launcher_taps(self):
        self.dev.shell.return_value = '1234'
        self.assertFalse(sp.require_prepost_foreground(self.dev, LAUNCHER, SIZE))
        self.dev.app_start.assert_not_called()
        self.dev.click.assert_not_called()

    def test_transitional_launcher_frame_cannot_trigger_video_shortcut(self):
        self.dev.d.app_current.return_value = {'package':sp.PKG}
        with patch.object(sp,'screen',return_value=(SIZE,LAUNCHER)), \
             patch.object(sp.time,'time',side_effect=[0,61]), patch.object(sp,'perform') as perform:
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.run_step(self.dev,{'id':'video_tab','do':'tap','find':[{'text':'วิดีโอ'}]}, {}, [], self.settings)
        self.dev.shell.assert_not_called()
        perform.assert_not_called()

    def retry(self, results, pending=None, history=None):
        with patch.object(sp,'run_clip',side_effect=results) as run, \
             patch.object(sp,'read_json',return_value=pending or {}), \
             patch.object(sp,'load_posted',return_value={'items':history or {}}), \
             patch.object(sp,'screen',return_value=(SIZE,[])), patch.object(sp.time,'sleep') as sleep:
            result = sp.run_clip_with_retry(self.dev,self.clip,self.settings,[])
        return result,run,sleep

    def test_proven_exit_after_normal_retry_has_one_cooled_recovery_of_same_clip(self):
        result,run,sleep = self.retry([sp.PhoneUiUnavailable(),sp.PhoneAppExited(),('posted','same-remote')])
        self.assertEqual(result,('posted','same-remote'))
        self.assertEqual(run.call_count,3)
        self.assertTrue(all(c.args[1] is self.clip for c in run.call_args_list))
        sleep.assert_called_once_with(10)
        self.assertTrue(self.settings['_restart_app_once'])

    def test_repeated_app_exit_stops_after_one_recovery(self):
        with patch.object(sp,'run_clip',side_effect=sp.PhoneAppExited()) as run, \
             patch.object(sp,'read_json',return_value={}), \
             patch.object(sp,'load_posted',return_value={'items':{}}), \
             patch.object(sp,'screen',return_value=(SIZE,[])), patch.object(sp.time,'sleep') as sleep:
            with self.assertRaises(sp.PhoneAppExited):
                sp.run_clip_with_retry(self.dev,self.clip,self.settings,[])
        self.assertEqual(run.call_count,2)
        sleep.assert_called_once_with(10)

    def test_normal_ui_failure_still_only_retries_once(self):
        with patch.object(sp,'run_clip',side_effect=sp.PhoneUiUnavailable()) as run, \
             patch.object(sp,'read_json',return_value={}), \
             patch.object(sp,'load_posted',return_value={'items':{}}), \
             patch.object(sp,'screen',return_value=(SIZE,[])), patch.object(sp.time,'sleep'):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.run_clip_with_retry(self.dev,self.clip,self.settings,[])
        self.assertEqual(run.call_count,2)

    def test_unknown_posting_or_uncommitted_confirmation_never_restarts(self):
        for state in ('posting','posted'):
            with self.subTest(state=state), \
                 patch.object(sp,'run_clip',side_effect=sp.PhoneAppExited()) as run, \
                 patch.object(sp,'read_json',return_value={'status':state,'clip_key':self.clip.key}), \
                 patch.object(sp,'load_posted',return_value={'items':{}}), patch.object(sp.time,'sleep') as sleep:
                with self.assertRaises(sp.UploadUnconfirmed):
                    sp.run_clip_with_retry(self.dev,self.clip,self.settings,[])
            self.assertEqual(run.call_count,1)
            sleep.assert_not_called()
            self.assertNotIn('_restart_app_once',self.settings)

    def test_retry_accepts_actual_device_wrapper_without_treating_it_as_settings(self):
        dev = sp.Device(Mock())
        with patch.object(sp,'run_clip',return_value=('posted','same-remote')) as run:
            self.assertEqual(sp.run_clip_with_retry(dev,self.clip,self.settings,[]),('posted','same-remote'))
        self.assertIs(run.call_args.args[0],dev)
        self.assertIs(run.call_args.args[2],self.settings)

    @unittest.skipUnless(sp.os.name == 'nt', 'Windows power guard')
    def test_batch_keeps_computer_awake_and_releases_guard_when_done(self):
        with patch('ctypes.windll.kernel32.SetThreadExecutionState') as keeper, \
             patch.object(sp,'scan_clips',return_value=([],[])), \
             patch.object(sp,'load_posted',return_value={'items':{}}):
            sp.cmd_post({'auto_post':True,'clips_folder':'unused'},[])
        self.assertEqual([c.args[0] for c in keeper.call_args_list],[0x80000001,0x80000000])

    def test_previous_confirmed_clip_does_not_block_current_prepost_recovery(self):
        result,run,sleep = self.retry([sp.PhoneAppExited(),('posted','same-remote')],
                                    {'status':'posted','clip_key':'previous'}, {'previous':{'status':'posted'}})
        self.assertEqual(result,('posted','same-remote'))
        self.assertEqual(run.call_count,2)
        sleep.assert_called_once_with(10)


if __name__ == '__main__':
    unittest.main()
