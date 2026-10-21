import datetime
import unittest
from xml.sax.saxutils import escape
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp


class ConfirmationRechecksTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.clip = SimpleNamespace(key='clip',name='clip',info={'link':'url'},txt='text')
        self.pending = {'status':'posting','clip_key':'clip','serial':'phone','remote':'/owned.mp4'}
        self.settings = {'auto_post':True,'serial':'phone','confirmation_rechecks':3}

    def test_timeout_is_rechecked_by_same_worker_without_another_post(self):
        ready = iter([False,True])
        def recovered(*args):
            if not next(ready):
                raise sp.UploadUnconfirmed('not yet')
            self.settings['_post_confirmed'] = True
            return 'posted','/owned.mp4'
        with patch.object(sp,'confirm_post',side_effect=sp.UploadUnconfirmed('timeout')) as confirmation, \
             patch.object(sp,'read_json',return_value=self.pending), patch.object(sp,'prepare_profile_inspection'), \
             patch.object(sp,'recover_pending_upload',side_effect=recovered) as recover, \
             patch.object(sp.time,'sleep') as sleep:
            self.assertEqual(sp.confirm_clip_post(self.dev,self.clip,self.settings,'/owned.mp4',Mock(),True),('posted','/owned.mp4'))
        confirmation.assert_called_once()
        self.assertEqual(recover.call_count,2)
        self.assertTrue(self.settings['_post_confirmed'])
        sleep.assert_called_once_with(15)
        self.dev.click.assert_not_called()

    def test_exhausted_checks_keep_unknown_journal_and_do_not_publish(self):
        with patch.object(sp,'read_json',return_value=self.pending), patch.object(sp,'prepare_profile_inspection'), \
             patch.object(sp,'recover_pending_upload',side_effect=sp.UploadUnconfirmed('unknown')) as recover, \
             patch.object(sp,'write_json') as write, patch.object(sp.time,'sleep') as sleep:
            with self.assertRaises(sp.UploadUnconfirmed):
                sp.recheck_pending_upload(self.dev,self.clip,self.settings,self.pending)
        self.assertEqual(recover.call_count,3)
        self.assertEqual(sleep.call_count,2)
        self.assertEqual(self.pending['status'],'posting')
        self.assertFalse(self.settings['_post_confirmed'])
        write.assert_not_called()
        self.dev.click.assert_not_called()

    def test_changed_journal_is_rejected_before_navigation(self):
        with patch.object(sp,'read_json',return_value={**self.pending,'serial':'other'}), \
             patch.object(sp,'prepare_profile_inspection') as prepare:
            with self.assertRaises(sp.StepFailed):
                sp.recheck_pending_upload(self.dev,self.clip,self.settings,self.pending)
        prepare.assert_not_called()

    def test_file_mismatch_is_fatal_and_not_retried(self):
        with patch.object(sp,'read_json',return_value=self.pending), patch.object(sp,'prepare_profile_inspection'), \
             patch.object(sp,'recover_pending_upload',side_effect=sp.StepFailed('source changed')) as recover, \
             patch.object(sp.time,'sleep') as sleep:
            with self.assertRaises(sp.StepFailed):
                sp.recheck_pending_upload(self.dev,self.clip,self.settings,self.pending)
        recover.assert_called_once()
        sleep.assert_not_called()

    def test_identity_gate_remains_a_real_stop(self):
        with patch.object(sp,'read_json',return_value=self.pending), \
             patch.object(sp,'prepare_profile_inspection',side_effect=sp.AttentionRequired({'message':'identity'})), \
             patch.object(sp,'recover_pending_upload') as recover:
            with self.assertRaises(sp.AttentionRequired):
                sp.recheck_pending_upload(self.dev,self.clip,self.settings,self.pending)
        recover.assert_not_called()

    def test_queue_continues_after_read_only_confirmation_without_codex(self):
        second = SimpleNamespace(key='second',name='second',info={'link':'url2'},txt='text2')
        posted = {'items':{}}
        cfg = dict(self.settings,clips_folder='test',daily_limit=70,delete_after_post=False)
        def run(dev,clip,settings,flow,ask):
            if clip.key == 'clip':
                return sp.confirm_clip_post(dev,clip,settings,'/owned.mp4',ask,True)
            return 'posted','/second.mp4'
        def record(data,clip,status):
            data['items'][clip.key] = {'status':status}
        with patch.object(sp,'scan_clips',return_value=([self.clip,second],[])), \
             patch.object(sp,'load_posted',return_value=posted), patch.object(sp,'posted_today',return_value=0), \
             patch.object(sp,'connect',return_value=self.dev), patch.object(sp,'load_flow',return_value=[]), \
             patch.object(sp,'run_clip',side_effect=run), patch.object(sp,'record_posted',side_effect=record), \
             patch.object(sp,'confirm_post',side_effect=sp.UploadUnconfirmed('slow')), \
             patch.object(sp,'read_json',return_value=self.pending), patch.object(sp,'prepare_profile_inspection'), \
             patch.object(sp,'recover_pending_upload',return_value=('posted','/owned.mp4')), \
             patch.object(sp,'write_json'), patch.object(sp,'wait_between') as wait:
            sp.cmd_post(cfg,[],ask=lambda _: '')
        self.assertEqual({k:v['status'] for k,v in posted['items'].items()},{'clip':'posted','second':'posted'})
        wait.assert_called_once()


class PublishedPanelTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.panel,self.comment,self.caption = Mock(),Mock(),Mock()
        self.panel.exists = False
        self.comment.exists = True
        self.caption.exists = True
        self.dev.d.side_effect = lambda **kw: {'close the comment panels':self.panel,
            'click video comment_icon':self.comment,'video caption content':self.caption}[kw['description']]
        self.viewer = sp.parse_nodes('<hierarchy><node text="@Minaa.rev" bounds="[20,900][220,960]"/></hierarchy>')

    def test_comments_button_opens_full_caption_without_typing_a_comment(self):
        self.panel.wait.return_value = True
        with patch.object(sp,'screen',return_value=((720,1280),self.viewer)):
            self.assertTrue(sp.open_published_panel(self.dev,'Minaa.rev'))
        self.comment.click.assert_called_once()
        self.caption.click.assert_not_called()
        self.dev.type_text.assert_not_called()

    def test_ignored_panel_tap_retries_once_after_rechecking_owner(self):
        self.panel.wait.side_effect = [False,True]
        with patch.object(sp,'screen',return_value=((720,1280),self.viewer)):
            self.assertTrue(sp.open_published_panel(self.dev,'Minaa.rev'))
        self.assertEqual(self.comment.click.call_count,2)

    def test_other_owner_is_never_opened_or_accepted(self):
        with patch.object(sp,'screen',return_value=((720,1280),self.viewer)):
            self.assertFalse(sp.open_published_panel(self.dev,'other'))
        self.dev.d.assert_not_called()


class PublishedMetadataTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.ctx = {'caption_full':'complete creator caption with the exact final words',
                    '_verified_import':{'title':'Exact product'}}
        self.started = (datetime.datetime.now() - datetime.timedelta(seconds=60)).isoformat()

    def panel(self, caption=None, owner='Minaa.rev', product='Exact product', creator=True):
        caption = caption or self.ctx['caption_full'] + ' ซ่อน'
        return sp.parse_nodes('<hierarchy><node bounds="[0,0][720,1280]">'
            f'<node text="{escape(product)}" bounds="[100,380][500,420]"/>'
            '<node bounds="[0,560][720,900]">'
            f'<node text="{owner}" bounds="[116,580][300,620]"/>'
            f'<node text="{"ผู้สร้าง" if creator else "ผู้ชม"}" bounds="[310,580][390,620]"/>'
            f'<node text="{escape(caption)}" clickable="true" bounds="[116,636][688,754]"/>'
            '<node text="1 นาทีที่แล้ว" bounds="[116,800][300,840]"/>'
            '</node></node></hierarchy>')

    def test_waits_for_metadata_instead_of_accepting_skeleton(self):
        full = self.panel()
        with patch.object(sp,'screen',side_effect=[((720,1280),[]),((720,1280),full)]), \
             patch.object(sp.time,'monotonic',side_effect=[0,1,2]), patch.object(sp.time,'sleep'):
            observed = sp.read_published_panel(self.dev,self.ctx,'Minaa.rev',self.started)
        self.assertTrue(sp.published_panel_matches([n.text for n in observed],self.ctx,'Minaa.rev',self.started))
        self.dev.click.assert_not_called()
        self.dev.press.assert_not_called()

    def test_dismisses_real_composer_keyboard_then_expands_creator_caption(self):
        keyboard = sp.parse_nodes('<hierarchy><node content-desc="click to comment now" bounds="[0,600][600,700]"/></hierarchy>')
        collapsed = self.panel('complete creator caption with...ดูเพิ่มเติม')
        full = self.panel()
        with patch.object(sp,'screen',side_effect=[((720,1280),keyboard),((720,1280),collapsed),((720,1280),full)]), \
             patch.object(sp,'keyboard_visible',return_value=True), \
             patch.object(sp.time,'monotonic',side_effect=[0,1,2,3]), patch.object(sp.time,'sleep'):
            observed = sp.read_published_panel(self.dev,self.ctx,'Minaa.rev',self.started)
        self.dev.press.assert_called_once_with('back')
        self.dev.click.assert_called_once_with(573,738)
        self.dev.type_text.assert_not_called()
        self.assertTrue(sp.published_panel_matches([n.text for n in observed],self.ctx,'Minaa.rev',self.started))

    def test_ignored_expansion_is_not_repeated_or_accepted_as_full_caption(self):
        collapsed = self.panel('complete creator caption with...ดูเพิ่มเติม')
        with patch.object(sp,'screen',return_value=((720,1280),collapsed)), \
             patch.object(sp.time,'monotonic',side_effect=[0,1,2,3,61]), patch.object(sp.time,'sleep'):
            observed = sp.read_published_panel(self.dev,self.ctx,'Minaa.rev',self.started)
        self.dev.click.assert_called_once()
        self.assertFalse(sp.published_panel_matches([n.text for n in observed],self.ctx,'Minaa.rev',self.started))

    def test_empty_composer_modal_is_closed_even_without_visible_keyboard(self):
        modal = sp.parse_nodes('<hierarchy><node class="android.widget.EditText" text="เพิ่มคอมเมนต์..." content-desc="click to comment now" bounds="[50,1207][582,1245]"/><node content-desc="send comment now" bounds="[632,1195][696,1259]"/></hierarchy>')
        with patch.object(sp,'screen',side_effect=[((720,1280),modal),((720,1280),self.panel())]), patch.object(sp,'keyboard_visible',return_value=False), patch.object(sp.time,'monotonic',side_effect=[0,1,2]), patch.object(sp.time,'sleep'):
            observed = sp.read_published_panel(self.dev,self.ctx,'Minaa.rev',self.started)
        self.dev.press.assert_called_once_with('back')
        self.dev.click.assert_not_called()
        self.dev.type_text.assert_not_called()
        self.assertTrue(sp.published_panel_matches([n.text for n in observed],self.ctx,'Minaa.rev',self.started))

    def test_existing_comment_draft_is_never_dismissed_or_sent(self):
        modal = sp.parse_nodes('<hierarchy><node class="android.widget.EditText" text="my existing draft" content-desc="click to comment now" bounds="[50,1207][582,1245]"/><node content-desc="send comment now" bounds="[632,1195][696,1259]"/></hierarchy>')
        with patch.object(sp,'screen',return_value=((720,1280),modal)), patch.object(sp,'keyboard_visible',return_value=False), patch.object(sp.time,'monotonic',side_effect=[0,1,61]), patch.object(sp.time,'sleep'):
            observed = sp.read_published_panel(self.dev,self.ctx,'Minaa.rev',self.started)
        self.dev.press.assert_not_called()
        self.dev.click.assert_not_called()
        self.dev.type_text.assert_not_called()
        self.assertFalse(sp.published_panel_matches([n.text for n in observed],self.ctx,'Minaa.rev',self.started))

    def test_only_expected_creator_row_and_product_can_be_expanded(self):
        prefix = 'complete creator caption with...ดูเพิ่มเติม'
        for nodes in (self.panel(prefix,owner='another'),self.panel(prefix,creator=False),
                      self.panel(prefix,product='Other product'),self.panel('different creator caption here...ดูเพิ่มเติม')):
            with self.subTest(nodes=nodes):
                self.assertIsNone(sp.collapsed_creator_caption(nodes,(720,1280),self.ctx,'Minaa.rev'))


if __name__ == '__main__':
    unittest.main()
