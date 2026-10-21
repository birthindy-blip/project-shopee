import unittest
from unittest.mock import Mock, patch

import shopee_poster as sp


SIZE = (720, 1280)


def nodes(xml):
    return sp.parse_nodes('<hierarchy>' + xml + '</hierarchy>')


PICKER = nodes('<node text="เพิ่มสินค้า" bounds="[80,72][640,116]"/>'
               '<node class="android.widget.ImageView" content-desc="link" bounds="[640,60][700,120]"/>')
LINK = nodes('<node text="กรอกลิงก์สินค้า" bounds="[10,200][600,260]"/>'
             '<node class="android.widget.EditText" bounds="[20,300][680,400]"/>'
             '<node text="นำเข้า" bounds="[400,450][650,520]"/>')
CAPTION = nodes('<node text="เพิ่มสินค้า" bounds="[24,501][138,539]"/>'
                '<node class="android.widget.EditText" resource-id="com.shopee.th.dfpluginshopee16:id/et_caption" bounds="[256,171][720,366]"/>'
                '<node class="android.widget.ImageView" bounds="[640,60][700,120]"/>')
COINS = nodes('<node text="Shopee Coins Rewards" bounds="[80,72][640,116]"/>'
              '<node class="android.widget.ImageView" bounds="[640,60][700,120]"/>'
              '<node class="android.widget.EditText" bounds="[20,300][680,400]"/>')


class ProductLinkNavigationTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.step = {'id': 'product_link', 'do': 'tap',
                     'find': [{'class': 'android.widget.ImageView', 'pos': [.931, .062]}]}

    def test_waits_for_picker_before_tapping_and_for_link_dialog_before_returning(self):
        screens = [CAPTION, [], PICKER, [], LINK]
        with patch.object(sp, 'screen', side_effect=[(SIZE, s) for s in screens]), \
             patch.object(sp, 'perform') as perform, patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.run_step(self.dev, self.step, {}, [], {}), 'ok')
        perform.assert_called_once()
        self.assertEqual(perform.call_args.args[2][0], 'point')

    def test_real_empty_link_form_is_ready_before_import_button_appears(self):
        empty = nodes('<node text="กรอกลิงก์สินค้า" bounds="[72,72][696,116]"/>'
                      '<node text="ลิงก์สินค้า" bounds="[48,186][515,241]"/>'
                      '<node class="android.widget.EditText" hint="รองรับเฉพาะลิงก์สินค้าใน Shopee" bounds="[48,242][672,548]"/>'
                      '<node text="วางลิงก์" bounds="[331,645][433,677]"/>'
                      '<node text="รายการสินค้า" bounds="[24,824][712,862]"/>')
        with patch.object(sp, 'screen', return_value=(SIZE, empty)), patch.object(sp, 'perform') as perform:
            self.assertEqual(sp.run_step(self.dev, self.step, {}, [], {}), 'ok')
        perform.assert_not_called()
        field = sp.product_link_field(empty, SIZE)
        self.assertTrue(field.is_input)

    def test_already_open_link_does_not_tap_again(self):
        with patch.object(sp, 'screen', return_value=(SIZE, LINK)), patch.object(sp, 'perform') as perform:
            self.assertEqual(sp.run_step(self.dev, self.step, {}, [], {}), 'ok')
        perform.assert_not_called()

    def test_wrong_page_and_caption_never_authorize_coordinate(self):
        for page in (COINS, CAPTION):
            with self.subTest(page=page), patch.object(sp, 'screen', return_value=(SIZE, page)), \
                 patch.object(sp.time, 'monotonic', side_effect=[0, 1, 16]), \
                 patch.object(sp.time, 'sleep'), patch.object(sp, 'perform') as perform:
                with self.assertRaises(sp.PhoneUiUnavailable):
                    sp.run_step(self.dev, self.step, {}, [], {'ui_timeout_seconds': 15})
            perform.assert_not_called()

    def test_ignored_link_tap_retries_only_twice_on_verified_picker(self):
        with patch.object(sp, 'screen', return_value=(SIZE, PICKER)), \
             patch.object(sp.time, 'monotonic', side_effect=[0, 1, 3, 10, 12, 19, 61]), \
             patch.object(sp.time, 'sleep'), patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.run_step(self.dev, self.step, {}, [], {})
        self.assertEqual(perform.call_count, 2)

    def test_search_cannot_type_in_unrelated_input(self):
        step = {'id': 'search_product', 'do': 'type', 'value': '{search}',
                'find': [{'class': 'android.widget.EditText'}]}
        with patch.object(sp, 'screen', return_value=(SIZE, COINS)), \
             patch.object(sp.time, 'time', side_effect=[0, 61]), \
             patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.PhoneUiUnavailable):
                sp.run_step(self.dev, step, {'search': 'https://s.shopee.co.th/test'}, [], {'auto_post': True})
        perform.assert_not_called()

    def test_search_waits_for_verified_form_then_replaces_the_entire_url(self):
        url = 'https://s.shopee.co.th/8pmRYzl5Xh'
        entered = nodes('<node text="กรอกลิงก์สินค้า" bounds="[72,72][696,116]"/>'
                        '<node class="android.widget.EditText" text="' + url + '" bounds="[48,242][672,548]"/>'
                        '<node text="นำเข้า" bounds="[331,645][433,677]"/>')
        step = {'id': 'search_product', 'do': 'type', 'value': '{search}', 'submit': False,
                'find': [{'class': 'android.widget.EditText'}]}
        self.dev.d.return_value.count = 1
        with patch.object(sp, 'screen', side_effect=[(SIZE, COINS), (SIZE, LINK), (SIZE, entered)]), \
             patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.run_step(self.dev, step, {'search': url}, [], {'auto_post': True}), 'ok')
        self.dev.d.return_value.set_text.assert_called_once_with(url)
        self.dev.click.assert_not_called()
        self.dev.press.assert_not_called()

    def test_multiple_inputs_or_unidentified_form_are_not_ready(self):
        self.assertIsNone(sp.product_link_field(LINK[:-1], SIZE))
        extra = nodes('<node class="android.widget.EditText" bounds="[20,500][680,600]"/>')
        self.assertIsNone(sp.product_link_field(LINK + extra, SIZE))


if __name__ == '__main__':
    unittest.main()
