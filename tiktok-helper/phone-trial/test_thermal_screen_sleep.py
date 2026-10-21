import unittest
from unittest.mock import Mock, call, patch
import shopee_poster as sp
from test_thermal_attention import THERMAL, SIZE

OFF = 'mWakefulness=Asleep\nDisplay Power: state=OFF\n'
ON = 'mWakefulness=Awake\nDisplay Power: state=ON\n'


class ThermalScreenSleepTests(unittest.TestCase):
    def attention(self):
        return sp.attention_from_screen(THERMAL,SIZE)

    def test_heat_sleeps_screen_and_waits_for_native_off_confirmation(self):
        dev = Mock()
        dev.shell.side_effect = [ON,'',ON,OFF]
        original = self.attention()
        with patch.object(sp.time,'sleep') as sleep:
            with self.assertRaises(sp.AttentionRequired) as stopped:
                sp.pause_for_attention(dev,original)
        self.assertEqual(stopped.exception.attention['screen_sleep'],'confirmed')
        self.assertTrue(stopped.exception.attention['screen_sleep_requested'])
        self.assertNotIn('screen_sleep',original)
        self.assertEqual(dev.shell.call_args_list,[call('dumpsys power'),call('input keyevent 223'),
                                                  call('dumpsys power'),call('dumpsys power')])
        sleep.assert_called_once_with(.25)
        dev.d.screen_on.assert_not_called()
        dev.app_start.assert_not_called()
        dev.press.assert_not_called()
        dev.click.assert_not_called()

    def test_already_asleep_sends_no_input_and_cannot_toggle_screen_on(self):
        dev = Mock()
        dev.shell.return_value = OFF
        with self.assertRaises(sp.AttentionRequired) as stopped:
            sp.pause_for_attention(dev,self.attention())
        self.assertEqual(stopped.exception.attention['screen_sleep'],'confirmed')
        self.assertFalse(stopped.exception.attention['screen_sleep_requested'])
        dev.shell.assert_called_once_with('dumpsys power')
        dev.d.screen_on.assert_not_called()

    def test_repeated_heat_detection_never_reawakens_a_sleeping_screen(self):
        dev = Mock()
        dev.shell.side_effect = [ON,'',OFF,OFF]
        for _ in range(2):
            with self.assertRaises(sp.AttentionRequired):
                sp.pause_for_attention(dev,self.attention())
        self.assertEqual(sum(c.args==('input keyevent 223',) for c in dev.shell.call_args_list),1)
        self.assertFalse(any('keyevent 26' in c.args[0] for c in dev.shell.call_args_list))
        dev.d.screen_on.assert_not_called()

    def test_failed_sleep_still_preserves_thermal_pause_and_posting_journal(self):
        dev = Mock()
        dev.shell.side_effect = [ON,OSError('USB unavailable')]
        with patch.object(sp,'write_json') as write:
            with self.assertRaises(sp.AttentionRequired) as stopped:
                sp.pause_for_attention(dev,self.attention())
        a = stopped.exception.attention
        self.assertEqual(a['code'],'phone_overheating')
        self.assertEqual(a['screen_sleep'],'failed')
        self.assertIn('USB unavailable',a['screen_sleep_error'])
        write.assert_not_called()
        dev.app_start.assert_not_called()
        dev.click.assert_not_called()

    def test_unconfirmed_power_state_is_bounded_and_never_claims_screen_off(self):
        dev = Mock()
        dev.shell.return_value = ON
        with patch.object(sp.time,'sleep') as sleep:
            with self.assertRaises(sp.AttentionRequired) as stopped:
                sp.pause_for_attention(dev,self.attention())
        self.assertEqual(stopped.exception.attention['screen_sleep'],'unconfirmed')
        self.assertIn('ยังยืนยันจอดับไม่ได้',stopped.exception.attention['message'])
        self.assertEqual(sum(c.args==('dumpsys power',) for c in dev.shell.call_args_list),4)
        self.assertEqual(sleep.call_count,2)

    def test_identity_attention_does_not_sleep_the_screen(self):
        dev = Mock()
        with self.assertRaises(sp.AttentionRequired):
            sp.pause_for_attention(dev,{'code':'shopee_identity','message':'ยืนยันตัวตน'})
        dev.shell.assert_not_called()

    def test_gallery_and_metadata_thermal_gates_both_use_sleep_handler(self):
        for route in ('gallery','metadata'):
            dev = Mock()
            dev.shell.side_effect = [ON,'',OFF]
            with self.subTest(route=route), patch.object(sp,'screen',return_value=(SIZE,THERMAL)), \
                 patch.object(sp,'perform') as perform:
                with self.assertRaises(sp.AttentionRequired) as stopped:
                    if route=='gallery':
                        sp.run_step(dev,{'id':'gallery','do':'tap'},{},[],{'auto_post':True})
                    else:
                        sp.read_published_panel(dev,{},'owner','2026-10-16T09:02:41')
                self.assertEqual(stopped.exception.attention['screen_sleep'],'confirmed')
                dev.shell.assert_any_call('input keyevent 223')
                perform.assert_not_called()
                dev.click.assert_not_called()
                dev.press.assert_not_called()

    def test_awake_or_partial_power_data_is_not_an_off_confirmation(self):
        self.assertFalse(sp.power_screen_is_off(ON))
        self.assertFalse(sp.power_screen_is_off('mWakefulness=Asleep'))
        self.assertFalse(sp.power_screen_is_off('Display Power: state=OFF_PENDING'))
        self.assertFalse(sp.power_screen_is_off(None))
        self.assertTrue(sp.power_screen_is_off(OFF))


if __name__ == '__main__':
    unittest.main()
