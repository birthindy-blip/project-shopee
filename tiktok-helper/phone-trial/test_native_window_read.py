import unittest
from unittest.mock import Mock,patch
import shopee_poster as sp

class NativeWindowReadTests(unittest.TestCase):
    def test_empty_adb_response_recovers_without_any_screen_action(self):
        native=Mock(); native.window_size.side_effect=[RuntimeError('wm size output unexpected',''),(720,1280)]
        with patch.object(sp.time,'sleep') as sleep:
            self.assertEqual(sp.Device(native).window_size(),(720,1280))
        self.assertEqual(native.window_size.call_count,2)
        sleep.assert_called_once_with(1)
        native.click.assert_not_called(); native.press.assert_not_called()
    def test_persistent_failure_is_bounded_and_never_guesses_dimensions(self):
        native=Mock(); native.window_size.side_effect=RuntimeError('offline')
        with patch.object(sp.time,'sleep') as sleep, patch.object(sp,'write_json') as write:
            with self.assertRaises(sp.PhoneUiUnavailable): sp.Device(native).window_size()
        self.assertEqual(native.window_size.call_count,3); self.assertEqual(sleep.call_count,2)
        native.click.assert_not_called(); write.assert_not_called()
    def test_invalid_dimensions_are_not_used_for_taps(self):
        native=Mock(); native.window_size.side_effect=[(0,1280),('720','1280'),(720,1280)]
        with patch.object(sp.time,'sleep'):
            self.assertEqual(sp.Device(native).window_size(),(720,1280))
        native.click.assert_not_called()
    def test_actual_landscape_dimensions_are_preserved(self):
        native=Mock(); native.window_size.return_value=(1280,720)
        self.assertEqual(sp.Device(native).window_size(),(1280,720))
        native.window_size.assert_called_once()

if __name__=='__main__': unittest.main()
