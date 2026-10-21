import unittest
from unittest.mock import Mock,patch
import shopee_poster as sp

class CommentHintRecoveryTests(unittest.TestCase):
    def modal(self,text='ส่งอีโมจิเพื่อรับเซอร์ไพรซ์',hint='ส่งอีโมจิเพื่อรับเซอร์ไพรซ์'):
        return sp.parse_nodes(f'<hierarchy><node class="android.widget.EditText" package="com.shopee.th" text="{text}" hint="{hint}" content-desc="click to comment now" bounds="[50,647][582,685]"/><node content-desc="send comment now" bounds="[632,635][696,699]"/></hierarchy>')
    def test_changed_native_placeholder_is_empty(self):
        self.assertTrue(sp.empty_comment_composer(self.modal(),(720,1280)))
    def test_comment_draft_is_never_treated_as_empty(self):
        self.assertFalse(sp.empty_comment_composer(self.modal(text='existing draft'),(720,1280)))
    def test_matching_text_without_native_hint_is_not_assumed_empty(self):
        self.assertFalse(sp.empty_comment_composer(self.modal(hint=''),(720,1280)))
    def test_prepare_closes_only_empty_composer_and_returns_to_own_profile(self):
        dev=Mock(); dev.d.app_current.return_value={'package':sp.PKG}
        modal=self.modal(); panel=sp.parse_nodes('<hierarchy><node content-desc="close the comment panels" bounds="[636,358][720,442]"/></hierarchy>'); viewer=sp.parse_nodes('<hierarchy><node content-desc="video caption content" bounds="[0,800][600,900]"/></hierarchy>'); own=sp.parse_nodes('<hierarchy><node content-desc="nick name of me" bounds="[32,322][682,371]"/></hierarchy>')
        with patch.object(sp,'screen',side_effect=[((720,1280),x) for x in (modal,modal,panel,viewer,own)]), patch.object(sp,'recover_identity_screen',side_effect=lambda d,c,size,n:(size,n)), patch.object(sp,'keyboard_visible',side_effect=[True,False]), patch.object(sp.time,'sleep'):
            sp.prepare_profile_inspection(dev,{},[])
        self.assertEqual(dev.press.call_count,4)
        self.assertTrue(all(c.args==('back',) for c in dev.press.call_args_list))
        dev.click.assert_not_called(); dev.type_text.assert_not_called(); dev.app_start.assert_not_called()
    def test_prepare_preserves_existing_draft(self):
        dev=Mock(); dev.d.app_current.return_value={'package':sp.PKG}; modal=self.modal(text='existing draft')
        with patch.object(sp,'screen',return_value=((720,1280),modal)), patch.object(sp,'recover_identity_screen',side_effect=lambda d,c,size,n:(size,n)), patch.object(sp.time,'monotonic',side_effect=[0,1,61]), patch.object(sp.time,'sleep'):
            with self.assertRaises(sp.StepFailed): sp.prepare_profile_inspection(dev,{},[])
        dev.press.assert_not_called(); dev.click.assert_not_called(); dev.type_text.assert_not_called()

if __name__=='__main__': unittest.main()
