import unittest
from unittest.mock import Mock, patch
import shopee_poster as sp

HUB = '<hierarchy><node text="วิดีโอ" bounds="[205,90][257,123]"/><node text="Live" bounds="[280,90][324,123]"/><node content-desc="click top right create icon" bounds="[644,83][692,131]"/></hierarchy>'
CAMERA = '<hierarchy><node resource-id="com.shopee.th:id/ll_gallery_entrance" bounds="[523,1012][627,1176]"/></hierarchy>'


class CameraNavigationTests(unittest.TestCase):
    def test_live_hub_is_switched_to_video_then_native_camera_is_required(self):
        hub, camera = sp.parse_nodes(HUB), sp.parse_nodes(CAMERA)
        dev = Mock()
        with patch.object(sp,'screen',side_effect=[((720,1280),hub),((720,1280),hub),((720,1280),[]),((720,1280),camera)]), patch.object(sp.time,'sleep'):
            self.assertEqual(sp.open_video_camera(dev,{}),'ok')
        self.assertEqual([c.args for c in dev.click.call_args_list],[(231,106),(668,107)])
        dev.press.assert_not_called()

    def test_ignored_creator_tap_is_retried_once_and_never_counts_as_camera_ready(self):
        hub = sp.parse_nodes(HUB)
        dev = Mock()
        with patch.object(sp,'screen',return_value=((720,1280),hub)), patch.object(sp.time,'sleep'), \
             patch.object(sp.time,'monotonic',side_effect=[0,0,1,10,20,122]):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.open_video_camera(dev,{'ui_timeout_seconds':60})
        self.assertEqual([c.args for c in dev.click.call_args_list],[(231,106),(668,107),(668,107)])

    def test_live_viewer_never_uses_creator_icon_until_video_opens(self):
        hub = sp.parse_nodes(HUB + '')
        live = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th.dfpluginshopee7:id/tv_audience_viewer_num" bounds="[100,197][176,222]"/></hierarchy>')
        dev = Mock()
        with patch.object(sp,'screen',return_value=((720,1280),hub+live)), patch.object(sp.time,'sleep'), \
             patch.object(sp.time,'monotonic',side_effect=[0,0,10,61]):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.open_video_camera(dev,{'ui_timeout_seconds':60})
        self.assertEqual([c.args for c in dev.click.call_args_list],[(231,106),(231,106)])

    def test_already_open_gallery_skips_missing_camera_button_without_selecting(self):
        picker = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/lyt_pick_title" bounds="[10,60][300,130]"/></hierarchy>')
        dev = Mock()
        with patch.object(sp,'screen',return_value=((720,1280),picker)):
            self.assertEqual(sp.run_step(dev,{'id':'gallery','do':'tap'},{},[],{'auto_post':True}),'ok')
        dev.click.assert_not_called()

    def test_native_camera_may_finish_loading_after_the_first_timeout(self):
        hub, camera = sp.parse_nodes(HUB), sp.parse_nodes(CAMERA)
        partial = sp.parse_nodes('<hierarchy><node resource-id="com.shopee.th:id/camera_button" bounds="[268,1002][452,1186]"/></hierarchy>')
        dev = Mock()
        dev.d.app_current.return_value = {'package':sp.PKG,'activity':'com.shopee.sz.mediasdk.ui.activity.SSZMediaActivity'}
        with patch.object(sp,'screen',side_effect=[((720,1280),hub),((720,1280),hub),((720,1280),partial),((720,1280),camera)]), patch.object(sp.time,'sleep'), \
             patch.object(sp.time,'monotonic',side_effect=[0,0,1,61]):
            self.assertEqual(sp.open_video_camera(dev,{'ui_timeout_seconds':60,'gallery_timeout_seconds':120}),'ok')
        self.assertEqual([c.args for c in dev.click.call_args_list],[(231,106),(668,107)])
        dev.app_start.assert_not_called()

    def test_slow_transition_gets_full_budget_after_observed_creator_tap(self):
        hub, camera = sp.parse_nodes(HUB), sp.parse_nodes(CAMERA)
        dev = Mock()
        # The creator becomes available near the end of hub navigation. The
        # old activity can remain visible while the native camera initializes.
        dev.d.app_current.return_value = {'package': sp.PKG, 'activity': 'com.shopee.app.react.ReactActivity_'}
        with patch.object(sp, 'screen', side_effect=[((720,1280),hub), ((720,1280),hub),
                                                    ((720,1280),[]), ((720,1280),[]), ((720,1280),camera)]), \
             patch.object(sp.time, 'sleep'), \
             patch.object(sp.time, 'monotonic', side_effect=[0,0,59,61,130]):
            self.assertEqual(sp.open_video_camera(dev, {'ui_timeout_seconds':60, 'gallery_timeout_seconds':120}), 'ok')
        self.assertEqual([c.args for c in dev.click.call_args_list], [(231,106),(668,107)])
        dev.d.app_current.assert_not_called()
        dev.app_start.assert_not_called()

    def test_no_creator_action_does_not_grant_grace_to_unrelated_activity(self):
        dev = Mock()
        dev.d.app_current.return_value = {'package': sp.PKG, 'activity': 'com.shopee.app.react.ReactActivity_'}
        with patch.object(sp, 'screen', return_value=((720,1280),[])), \
             patch.object(sp.time, 'sleep'), patch.object(sp.time, 'monotonic', side_effect=[0,61]):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.open_video_camera(dev, {'ui_timeout_seconds':60, 'gallery_timeout_seconds':120})
        dev.click.assert_not_called()

    def test_camera_grace_is_bounded_and_still_requires_gallery_controls(self):
        dev = Mock()
        dev.d.app_current.return_value = {'package':sp.PKG,'activity':'com.shopee.sz.mediasdk.ui.activity.SSZMediaActivity'}
        with patch.object(sp,'screen',return_value=((720,1280),[])), patch.object(sp.time,'sleep'), \
             patch.object(sp.time,'monotonic',side_effect=[0,61,121]):
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.open_video_camera(dev,{'ui_timeout_seconds':60,'gallery_timeout_seconds':120})
        dev.click.assert_not_called()


if __name__ == '__main__':
    unittest.main()
