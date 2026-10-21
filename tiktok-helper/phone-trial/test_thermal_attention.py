import io
import json
import unittest
from unittest.mock import Mock, patch
import shopee_poster as sp
import poster_app as app
import queue_runtime as runtime

SIZE = (720,1280)
THERMAL = sp.parse_nodes('<hierarchy><node resource-id="miui:id/alertTitle" text="ร้อนเกิน" bounds="[246,860][474,957]"/>'
                         '<node resource-id="miui:id/message" text="อุปกรณ์ของคุณร้อนเกินไป ข้อมูลมือถือ ฮอตสปอต Wi-Fi GPS และกล้อง จะถูกจำกัด" bounds="[0,1001][720,1080]"/>'
                         '<node resource-id="android:id/button2" text="ตกลง" bounds="[53,1140][667,1233]"/></hierarchy>')


class ThermalAttentionTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.dev.d.app_current.return_value = {'package':sp.PKG}
        self.dev.shell.return_value = 'Display Power: state=OFF'

    def test_exact_native_warning_is_detected_but_caption_words_are_not(self):
        self.assertEqual(sp.attention_from_screen(THERMAL,SIZE)['code'],'phone_overheating')
        caption = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/et_caption" text="ร้อนเกิน อุปกรณ์ของคุณร้อนเกินไป กล้อง จะถูกจำกัด" bounds="[0,100][720,300]"/></hierarchy>')
        self.assertIsNone(sp.attention_from_screen(caption,SIZE))
        self.assertIsNone(sp.attention_from_screen(THERMAL[:1],SIZE))

    def test_identity_reopen_setting_never_relaunches_through_thermal_warning(self):
        with self.assertRaises(sp.AttentionRequired) as result:
            sp.recover_identity_screen(self.dev,{'reopen_on_identity':True},SIZE,THERMAL)
        self.assertEqual(result.exception.attention['code'],'phone_overheating')
        self.dev.app_start.assert_not_called()
        self.dev.press.assert_not_called()
        self.dev.click.assert_not_called()

    def test_generic_ok_popup_handler_preserves_system_warning(self):
        with self.assertRaises(sp.AttentionRequired):
            sp.dismiss_popup(self.dev,THERMAL,SIZE,['ตกลง','OK'])
        self.dev.click.assert_not_called()

    def test_metadata_reader_stops_before_back_or_caption_expansion(self):
        with patch.object(sp,'screen',return_value=(SIZE,THERMAL)):
            with self.assertRaises(sp.AttentionRequired):
                sp.read_published_panel(self.dev,{},'owner','2026-10-16T09:02:41')
        self.dev.press.assert_not_called()
        self.dev.click.assert_not_called()

    def test_profile_finally_does_not_back_out_of_a_new_thermal_gate(self):
        own = sp.parse_nodes('<hierarchy><node content-desc="nick name of me" bounds="[0,0][200,100]"><node text="owner" bounds="[10,10][190,90]"/></node><node content-desc="user name of me" bounds="[0,100][200,200]"/></hierarchy>')
        viewer = sp.parse_nodes('<hierarchy><node text="@owner" bounds="[0,100][200,200]"/></hierarchy>')
        self.dev.d.return_value.exists = True
        self.dev.d.return_value.wait.return_value = True
        attention = sp.AttentionRequired(sp.attention_from_screen(THERMAL,SIZE))
        with patch.object(sp,'screen',side_effect=[(SIZE,own),(SIZE,viewer)]), \
             patch.object(sp,'open_published_panel',return_value=True), \
             patch.object(sp,'read_published_panel',side_effect=attention):
            with self.assertRaises(sp.AttentionRequired):
                sp.verify_published_profile(self.dev,{},'2026-10-16T09:02:41')
        self.dev.press.assert_not_called()

    def test_recover_worker_reports_heat_without_posting_or_changing_journal(self):
        pending = {'status':'posting','clip_key':'original','serial':'phone'}
        capture = io.StringIO()
        cfg = json.dumps({'serial':'phone','auto_post':True,'reopen_on_identity':True})
        with patch.dict(app.os.environ,{'SHOPEE_JOB_SETTINGS':cfg,'SHOPEE_CLIP_KEY':'original'}), \
             patch.object(sp,'read_json',return_value=pending), patch.object(sp,'write_json') as write, \
             patch.object(sp,'connect',return_value=self.dev), patch.object(sp,'load_flow',return_value=[]), \
             patch.object(sp,'screen',return_value=(SIZE,THERMAL)), patch.object(sp,'cmd_post') as post, \
             patch.object(app.sys,'stdout',capture):
            self.assertEqual(app._worker('recover'),1)
        events = [json.loads(line) for line in capture.getvalue().splitlines()]
        self.assertEqual(events[-1]['attention']['code'],'phone_overheating')
        self.assertEqual(pending['status'],'posting')
        post.assert_not_called()
        write.assert_not_called()
        self.dev.press.assert_not_called()
        self.dev.click.assert_not_called()

    def test_durable_controller_does_not_loop_recovery_while_overheating(self):
        status = {'settings':{'auto_post':True,'serial':'phone','clips_folder':'folder'},
                  'job':{'running':False,'kind':'recover','state':'attention',
                         'attention':{'code':'phone_overheating'},'unconfirmed':{'clip_key':'original'}}}
        session = {'active':True,'serial':'phone','clips_folder':'folder','clip_keys':['original']}
        self.assertEqual(runtime.next_action(status,session),'')


if __name__ == '__main__':
    unittest.main()
