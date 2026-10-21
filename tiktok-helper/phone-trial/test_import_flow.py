import unittest
from unittest.mock import Mock, patch

import shopee_poster as sp


class ImportFlowTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.product = {'status': 'resolved', 'item_id': '43528306303', 'shop_id': '1370621972',
                        'product_url': 'https://shopee.co.th/product/1370621972/43528306303'}
        self.ctx = {'product': self.product, 'search': self.product['product_url'],
                    '_requested_import': self.product}
        self.title = Mock(text='Imported pegboard product title')
        self.heading = Mock(text='กรอกลิงก์สินค้า', is_input=False)

    def test_single_import_selects_all_and_adds_without_opening_detail(self):
        with patch.object(sp, 'screen', return_value=((720, 1280), [self.heading])), \
             patch.object(sp, 'import_product_rows', return_value=[self.title]), \
             patch.object(sp, 'find_target', side_effect=['select-all', 'add-one']), \
             patch.object(sp, 'perform') as perform, \
             patch.object(sp, 'inspect_current_product') as inspect, \
             patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.choose_imported_product(self.dev, self.ctx, {}), 'ok')
        inspect.assert_not_called()
        self.dev.press.assert_not_called()
        self.assertEqual([c.args[2] for c in perform.call_args_list], ['select-all', 'add-one'])
        self.assertEqual(self.ctx['_verified_import']['method'], 'single_link_import')

    def test_existing_row_without_import_request_is_not_selected(self):
        self.ctx.pop('_requested_import')
        with patch.object(sp, 'screen', return_value=((720, 1280), [self.heading])), \
             patch.object(sp, 'import_product_rows', return_value=[self.title]), \
             patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.StepFailed):
                sp.choose_imported_product(self.dev, self.ctx, {})
        perform.assert_not_called()

    def test_multiple_products_are_not_added_together(self):
        with patch.object(sp, 'screen', return_value=((720, 1280), [self.heading])), \
             patch.object(sp, 'import_product_rows', return_value=[self.title, Mock()]), \
             patch.object(sp, 'perform') as perform:
            with self.assertRaises(sp.StepFailed):
                sp.choose_imported_product(self.dev, self.ctx, {})
        perform.assert_not_called()

    def test_caption_replacement_uses_native_set_text(self):
        phone = Mock()
        sp.Device(phone).type_text('ข้อความใหม่')
        phone.return_value.set_text.assert_called_once_with('ข้อความใหม่')
        phone.send_keys.assert_not_called()

    def test_link_field_without_id_is_replaced_without_opening_keyboard(self):
        field = Mock(is_input=True, rid='')
        field.cls = 'android.widget.EditText'
        actual = Mock(is_input=True, rid='', text=self.product['product_url'])
        self.dev.shell.return_value = 'mInputShown=false'
        self.dev.d.return_value.count = 1
        with patch.object(sp, 'screen', return_value=((720, 1280), [actual])), \
             patch.object(sp.time, 'sleep'):
            sp.perform(self.dev, {'id': 'search_product', 'do': 'type', 'value': '{search}'},
                       ('node', field), (720, 1280), self.ctx)
        self.dev.click.assert_not_called()
        self.dev.d.assert_called_once_with(className='android.widget.EditText')
        self.dev.d.return_value.set_text.assert_called_once_with(self.product['product_url'])

    def test_native_caption_closes_keyboard_and_keeps_exact_text(self):
        field = Mock(is_input=True, rid='com.shopee.th:id/et_caption', text='ข้อความจากไฟล์')
        field.cls = 'android.widget.EditText'
        field.visible.return_value = True
        self.dev.d.return_value.count = 1
        self.dev.shell.return_value = 'mCurMethodId=com.google.android.inputmethod.latin/.LatinIME mInputShown=true'
        keyboard = sp.parse_nodes('<hierarchy><node package="com.google.android.inputmethod.latin" resource-id="com.google.android.inputmethod.latin:id/keyboard_holder" bounds="[0,720][720,1280]"/></hierarchy>')
        with patch.object(sp, 'screen', side_effect=[((720,1280),[field]),((720,1280),[field]+keyboard),((720,1280),[field])]), patch.object(sp.time, 'sleep'):
            sp.perform(self.dev, {'id': 'caption', 'do': 'type', 'value': '{caption_full}'},
                       ('node', field), (720, 1280), {'caption_full': 'ข้อความจากไฟล์'})
        self.dev.press.assert_called_once_with('back')
        self.dev.d.return_value.set_text.assert_called_once_with('ข้อความจากไฟล์')

    def test_link_replacement_never_goes_back_on_stale_keyboard_state(self):
        field = Mock(is_input=True,rid='')
        field.cls = 'android.widget.EditText'
        actual = Mock(is_input=True,rid='',text=self.product['product_url'])
        self.dev.shell.return_value = 'mCurMethodId=com.google.android.inputmethod.latin/.LatinIME mInputShown=true'
        self.dev.d.return_value.count = 1
        with patch.object(sp,'screen',return_value=((720,1280),[actual])), patch.object(sp.time,'sleep'):
            sp.perform(self.dev,{'id':'search_product','do':'type','value':'{search}'},
                       ('node',field),(720,1280),self.ctx)
        self.dev.press.assert_not_called()
        self.dev.d.return_value.set_text.assert_called_once_with(self.product['product_url'])

    def test_import_taps_visible_button_without_closing_link_dialog(self):
        nodes = sp.parse_nodes('<hierarchy><node text="กรอกลิงก์สินค้า" bounds="[10,200][600,260]"/><node class="android.widget.EditText" text="https://shopee.co.th/product/1370621972/43528306303" bounds="[20,300][680,400]"/><node text="นำเข้า" clickable="true" bounds="[400,450][650,520]"/></hierarchy>')
        self.dev.shell.return_value = 'mCurMethodId=com.google.android.inputmethod.latin/.LatinIME mInputShown=true'
        self.dev.d.last_toast = ''
        step = {'id':'import_product','do':'tap','find':[{'text':'นำเข้า'}]}
        with patch.object(sp,'screen',return_value=((720,1280),nodes)), patch.object(sp,'perform') as perform, patch.object(sp.time,'sleep'):
            self.assertEqual(sp.run_step(self.dev,step,self.ctx,[],{'auto_post':True}), 'ok')
        self.dev.press.assert_not_called()
        perform.assert_called_once()
        self.assertEqual(self.ctx['_requested_import'],self.product)

    def test_changed_caption_stops_before_basket_can_authorize_post(self):
        caption = Mock(rid='com.shopee.th:id/et_caption', text='ข้อความจากไฟล์000')
        caption.visible.return_value = True
        title = Mock(rid='com.shopee.th:id/tv_product_title', text='correct product')
        title.visible.return_value = True
        with patch.object(sp, 'screen', return_value=((720, 1280), [caption, title])), \
             patch.object(sp, 'inspect_current_product', return_value=(None, '', '')):
            with self.assertRaises(sp.StepFailed):
                sp.verify_basket(self.dev, {'caption_full': 'ข้อความจากไฟล์'}, {}, [{'do': 'post'}], Mock())

    def test_stale_keyboard_state_cancels_exact_discard_dialog_and_keeps_caption(self):
        dialog = sp.parse_nodes('<hierarchy><node text="หากคุณกดย้อนกลับ การแก้ไขทั้งหมดจะถูกละทิ้ง" resource-id="com.shopee.th:id/content" bounds="[90,573][646,651]"/><node text="ยกเลิก" resource-id="com.shopee.th:id/buttonDefaultNegative" bounds="[50,701][359,797]"/><node text="Discard" resource-id="com.shopee.th:id/buttonDefaultPositive" bounds="[361,701][670,797]"/></hierarchy>')
        caption = sp.parse_nodes('<hierarchy><node class="android.widget.EditText" text="ข้อความจากไฟล์" resource-id="com.shopee.th.dfpluginshopee16:id/et_caption" bounds="[20,200][680,350]"/></hierarchy>')
        self.dev.shell.return_value = 'mInputShown=true'
        with patch.object(sp,'screen',side_effect=[((720,1280),dialog),((720,1280),caption)]), patch.object(sp.time,'sleep'):
            sp.finish_caption(self.dev,'ข้อความจากไฟล์')
        self.dev.press.assert_not_called()
        self.dev.click.assert_called_once()
        self.assertLess(self.dev.click.call_args.args[0],360)

    def test_import_hides_only_observed_keyboard_before_tapping(self):
        nodes = sp.parse_nodes('<hierarchy><node text="กรอกลิงก์สินค้า" bounds="[10,200][600,260]"/><node class="android.widget.EditText" text="https://shopee.co.th/product/1370621972/43528306303" bounds="[20,300][680,400]"/><node text="นำเข้า" clickable="true" bounds="[400,450][650,520]"/></hierarchy>')
        keyboard = sp.parse_nodes('<hierarchy><node package="com.google.android.inputmethod.latin" bounds="[0,720][720,1280]"/></hierarchy>')
        self.dev.shell.return_value = 'mCurMethodId=com.google.android.inputmethod.latin/.LatinIME mInputShown=true'
        self.dev.d.last_toast = ''
        with patch.object(sp,'screen',side_effect=[((720,1280),nodes+keyboard),((720,1280),nodes)]), patch.object(sp,'perform') as perform, patch.object(sp.time,'sleep'):
            self.assertEqual(sp.run_step(self.dev,{'id':'import_product','do':'tap','find':[{'text':'นำเข้า'}]},self.ctx,[],{'auto_post':True}),'ok')
        self.dev.press.assert_called_once_with('back')
        perform.assert_called_once()

    def test_import_reopens_link_once_if_shopee_back_closes_it_with_keyboard(self):
        link = sp.parse_nodes('<hierarchy><node text="กรอกลิงก์สินค้า" bounds="[10,200][600,260]"/><node class="android.widget.EditText" text="https://shopee.co.th/product/1370621972/43528306303" bounds="[20,300][680,400]"/><node text="นำเข้า" bounds="[400,450][650,520]"/></hierarchy>')
        keyboard = sp.parse_nodes('<hierarchy><node package="com.google.android.inputmethod.latin" bounds="[0,720][720,1280]"/></hierarchy>')
        picker = sp.parse_nodes('<hierarchy><node text="เพิ่มสินค้า" bounds="[80,72][640,116]"/><node content-desc="link" bounds="[640,60][700,120]"/></hierarchy>')
        self.dev.shell.return_value = 'mCurMethodId=com.google.android.inputmethod.latin/.LatinIME mInputShown=true'
        self.dev.d.last_toast = ''
        step = {'id':'import_product','do':'tap','find':[{'text':'นำเข้า'}]}
        flow = [{'id':'product_link','do':'tap','find':[{'desc':'link'}]},step]
        with patch.object(sp,'screen',side_effect=[((720,1280),link+keyboard),((720,1280),picker),((720,1280),picker),((720,1280),link),((720,1280),link)]), patch.object(sp,'perform') as perform, patch.object(sp.time,'sleep'):
            self.assertEqual(sp.run_step(self.dev,step,self.ctx,flow,{'auto_post':True}),'ok')
        self.dev.press.assert_called_once_with('back')
        self.assertEqual([call.args[1]['id'] for call in perform.call_args_list],['product_link','import_product'])
        self.assertEqual(self.ctx['_requested_import'],self.product)

    def test_discard_dialog_recovery_still_rejects_changed_caption(self):
        dialog = sp.parse_nodes('<hierarchy><node text="หากคุณกดย้อนกลับ การแก้ไขทั้งหมดจะถูกละทิ้ง" resource-id="com.shopee.th:id/content" bounds="[90,573][646,651]"/><node text="ยกเลิก" resource-id="com.shopee.th:id/buttonDefaultNegative" bounds="[50,701][359,797]"/><node text="Discard" resource-id="com.shopee.th:id/buttonDefaultPositive" bounds="[361,701][670,797]"/></hierarchy>')
        changed = sp.parse_nodes('<hierarchy><node class="android.widget.EditText" text="ข้อความอื่น" bounds="[20,200][680,350]"/></hierarchy>')
        self.dev.shell.return_value = 'mInputShown=true'
        with patch.object(sp,'screen',side_effect=[((720,1280),dialog),((720,1280),changed)]), patch.object(sp.time,'sleep'):
            with self.assertRaises(sp.StepFailed):
                sp.finish_caption(self.dev,'ข้อความจากไฟล์')
        self.dev.click.assert_called_once()


if __name__ == '__main__':
    unittest.main()
