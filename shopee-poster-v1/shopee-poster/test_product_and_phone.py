import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from xml.sax.saxutils import escape

import phone_inventory as phones
import product_identity as products
import shopee_poster as sp

EXPECTED = {'status': 'resolved', 'shop_id': '121205602', 'item_id': '1867293688',
            'product_url': 'https://shopee.co.th/product/121205602/1867293688'}
WRONG = {'shop_id': '20886839', 'item_id': '25442078889'}


def node(text='', children='', cls='android.widget.TextView', bounds='[0,0][1000,1000]'):
    return f'<node text="{escape(text, {chr(34): "&quot;"})}" class="{cls}" bounds="{bounds}" clickable="true">{children}</node>'


def screen_nodes(content):
    return sp.parse_nodes('<hierarchy>' + content + '</hierarchy>')


class ProductTests(unittest.TestCase):
    def test_routes_are_parsed_as_strings(self):
        urls = [
            'https://shopee.co.th/product/121205602/1867293688',
            'https://shopee.co.th/opaanlp/121205602/1867293688?utm_source=affiliate',
            'https://shopee.co.th/some-name-i.121205602.1867293688',
            'https://shopee.co.th/?shopid=121205602&itemid=1867293688',
            'https://shopee.co.th/universal-link?af_dp=shopee%3A%2F%2Fproduct%2F121205602%2F1867293688',
            'shopee://product/121205602/1867293688',
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(products.parse_identity(url)['item_id'], EXPECTED['item_id'])

    def test_short_link_and_bare_numbers_are_not_inferred(self):
        self.assertIsNone(products.parse_identity('https://s.shopee.co.th/LnpvDuFdn'))
        self.assertEqual(products.identities_in_text('CeraVe ราคา 1867293688 รีวิว 121205602'), [])

    def test_untrusted_or_malformed_routes_rejected(self):
        for url in ['https://evil.test/product/121205602/1867293688',
                    'https://shopee.co.th.evil.test/product/121205602/1867293688',
                    'https://user@shopee.co.th/product/121205602/1867293688',
                    'https://shopee.co.th:8443/product/121205602/1867293688',
                    'https://[invalid/product/121205602/1867293688']:
            with self.subTest(url=url):
                self.assertIsNone(products.parse_identity(url))

    def test_redirect_resolves_observed_affiliate_route(self):
        response = Mock(status_code=301, headers={'Location': 'https://shopee.co.th/opaanlp/121205602/1867293688?utm=x'})
        fetch = Mock(return_value=response)
        result = products.resolve_link('https://s.shopee.co.th/LnpvDuFdn', fetch=fetch)
        self.assertEqual(result['status'], 'resolved')
        self.assertEqual(result['item_id'], EXPECTED['item_id'])
        fetch.assert_called_once()
        response.close.assert_called_once()

    def test_redirect_cannot_fetch_external_destination(self):
        fetch = Mock(return_value=Mock(status_code=302, headers={'Location': 'https://evil.test/product/1/2'}))
        self.assertEqual(products.resolve_link('https://s.shopee.co.th/LnpvDuFdn', fetch=fetch)['status'], 'unresolved')
        fetch.assert_called_once()

    def test_failed_source_link_stays_unresolved(self):
        fetch = Mock(return_value=Mock(status_code=403, headers={}))
        self.assertEqual(products.resolve_link('https://s.shopee.co.th/LnpvDuFdn', fetch=fetch)['status'], 'unresolved')

    def test_wrong_item_or_shop_does_not_match(self):
        self.assertEqual(products.compare(EXPECTED, WRONG)['status'], 'mismatch')
        self.assertEqual(products.compare(EXPECTED, {**EXPECTED, 'shop_id': '999'})['status'], 'mismatch')
        self.assertEqual(products.compare(EXPECTED, None)['status'], 'unavailable')
        self.assertEqual(products.compare(EXPECTED, EXPECTED)['status'], 'matched')

    def test_duplicate_item_label_is_merged_with_url(self):
        ids = products.identities_in_text(EXPECTED['product_url'] + ' Item ID: 1867293688')
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0]['shop_id'], EXPECTED['shop_id'])

    def test_search_input_echo_is_not_product_evidence(self):
        nodes = screen_nodes(node(EXPECTED['product_url'], cls='android.widget.EditText'))
        self.assertEqual(sp.screen_product_ids(nodes, (1080, 2400)), [])

    def test_child_of_input_is_not_product_evidence(self):
        nodes = screen_nodes(node('', node(EXPECTED['product_url']), cls='android.widget.EditText'))
        self.assertEqual(sp.screen_product_ids(nodes, (1080, 2400)), [])

    def test_offscreen_product_does_not_count(self):
        nodes = screen_nodes(node(EXPECTED['product_url'], bounds='[0,3000][1000,3200]'))
        self.assertEqual(sp.screen_product_ids(nodes, (1080, 2400)), [])

    def test_chooses_matching_second_result_not_first(self):
        wrong_row = node('Item ID: 25442078889', node('เพิ่ม', bounds='[700,100][900,200]'))
        right_row = node('Item ID: 1867293688', node('เพิ่ม', bounds='[700,400][900,500]'))
        nodes = screen_nodes(node('', wrong_row + right_row))
        dev = Mock()
        step = {'do': 'tap', 'find': [{'text': 'เพิ่ม'}]}
        with patch.object(sp, 'screen', return_value=((1080, 2400), nodes)), patch.object(sp.time, 'sleep'):
            self.assertEqual(sp.choose_correct_product(dev, step, {'product': EXPECTED}, [], {}, Mock()), 'ok')
        dev.click.assert_called_once_with(800, 450)

    def test_no_visible_id_requires_manual_selection(self):
        nodes = screen_nodes(node('CeraVe', node('เพิ่ม')))
        dev = Mock()
        with patch.object(sp, 'screen', return_value=((1080, 2400), nodes)):
            result = sp.choose_correct_product(dev, {'do': 'tap', 'find': [{'text': 'เพิ่ม'}]},
                                              {'product': EXPECTED}, [], {}, lambda _: 's')
        self.assertEqual(result, 'skipped')
        dev.click.assert_not_called()

    def test_clipboard_copy_uses_fresh_link_and_restores_old(self):
        dev = Mock()
        dev.d = SimpleNamespace(clipboard=EXPECTED['product_url'], app_current=lambda: {'package': sp.PKG})
        dev.set_clipboard.side_effect = lambda text: setattr(dev.d, 'clipboard', text)
        share_nodes = screen_nodes(node('แชร์'))
        copy_nodes = screen_nodes(node('คัดลอกลิงก์'))
        calls = []
        def click(x, y):
            calls.append((x, y))
            if len(calls) == 2:
                dev.d.clipboard = 'https://shopee.co.th/product/20886839/25442078889'
        dev.click.side_effect = click
        with patch.object(sp, 'screen', side_effect=[((1080, 2400), share_nodes),
                ((1080, 2400), copy_nodes), ((1080, 2400), copy_nodes)]), patch.object(sp.time, 'sleep'):
            actual, method, _ = sp.inspect_current_product(dev)
        self.assertEqual(actual['item_id'], WRONG['item_id'])
        self.assertEqual(method, 'phone_share_link')
        self.assertEqual(dev.d.clipboard, EXPECTED['product_url'])

    def test_mismatch_cannot_pass_basket_gate(self):
        dev = Mock()
        with patch.object(sp, 'inspect_current_product', return_value=(WRONG, 'screen', '')), \
                patch.object(sp, 'screen', return_value=((1080, 2400), screen_nodes(node('โพสต์')))):
            self.assertFalse(sp.verify_basket(dev, {'product': EXPECTED}, {},
                [{'do': 'post', 'find': [{'text': 'โพสต์'}]}], lambda _: 's'))
        dev.click.assert_not_called()

    def test_unresolved_link_stops_before_pushing_video(self):
        clip = SimpleNamespace(info={'link': 'https://s.shopee.co.th/bad'})
        with patch.object(products, 'resolve_link', return_value={'status': 'unresolved', 'item_id': '', 'error': 'failed'}), \
                patch.object(products, 'remember', side_effect=lambda r: r), patch.object(sp, 'push_clip') as push:
            with self.assertRaises(sp.StepFailed):
                sp.run_clip(Mock(), clip, {}, [], lambda _: 'q')
        push.assert_not_called()

    def test_missing_basket_steps_never_click_post(self):
        clip = SimpleNamespace(info={'link': EXPECTED['product_url']}, context=lambda _: {'product': EXPECTED})
        with patch.object(products, 'resolve_link', return_value=EXPECTED), \
                patch.object(products, 'remember', side_effect=lambda r: r), \
                patch.object(sp, 'push_clip', return_value='remote'), patch.object(sp, 'run_step') as run:
            with self.assertRaises(sp.StepFailed):
                sp.run_clip(Mock(), clip, {'auto_post': True}, [{'do': 'post'}], lambda _: 'q')
        run.assert_not_called()

    def test_failed_basket_verification_never_runs_post_step(self):
        clip = SimpleNamespace(info={'link': EXPECTED['product_url']}, context=lambda _: {'product': EXPECTED})
        flow = [{'id': 'add_product'}, {'id': 'search_product'}, {'id': 'choose_product'}, {'id': 'post', 'do': 'post'}]
        with patch.object(products, 'resolve_link', return_value=EXPECTED), \
                patch.object(products, 'remember', side_effect=lambda r: r), \
                patch.object(sp, 'push_clip', return_value='remote'), \
                patch.object(sp, 'run_step', return_value='ok') as run, \
                patch.object(sp, 'choose_correct_product', return_value='ok'), \
                patch.object(sp, 'apply_publish_options'), patch.object(sp, 'verify_basket', return_value=False):
            self.assertEqual(sp.run_clip(Mock(), clip, {'auto_post': True}, flow, lambda _: 'q')[0], 'skipped')
        self.assertFalse(any(c.args[1].get('do') == 'post' for c in run.call_args_list))


class PhoneTests(unittest.TestCase):
    def inventory(self, devices):
        return {'devices': devices, 'usb_devices': [], 'dependencies': True, 'error': ''}

    def test_one_ready_phone_can_be_auto_selected(self):
        result = phones.selected_phone(self.inventory([{'serial': 'A', 'state': 'device', 'model': 'Phone A'}]))
        self.assertEqual(result['serial'], 'A')

    def test_multiple_phones_require_selection(self):
        result = phones.selected_phone(self.inventory([{'serial': 'A', 'state': 'device'}, {'serial': 'B', 'state': 'device'}]))
        self.assertEqual(result['state'], 'select_required')

    def test_explicit_selection_uses_second_device(self):
        result = phones.selected_phone(self.inventory([{'serial': 'A', 'state': 'device'}, {'serial': 'B', 'state': 'device'}]), 'B')
        self.assertEqual(result['serial'], 'B')

    def test_missing_selected_phone_does_not_switch(self):
        result = phones.selected_phone(self.inventory([{'serial': 'B', 'state': 'device'}]), 'A')
        self.assertEqual(result['state'], 'disconnected')
        self.assertEqual(result['serial'], 'A')

    def test_unauthorized_phone_is_distinguished(self):
        result = phones.selected_phone(self.inventory([{'serial': 'A', 'state': 'unauthorized'}]), 'A')
        self.assertEqual(result['state'], 'unauthorized')

    def test_device_flow_paths_are_distinct_and_stay_in_flows(self):
        with patch.object(sp, 'FLOW_FILE'), patch.object(Path, 'mkdir'):
            sp.configure_flow('phone-A')
            first = sp.FLOW_FILE
            sp.configure_flow('phone-B')
            second = sp.FLOW_FILE
            self.assertNotEqual(first, second)
            self.assertEqual(first.parent, sp.HERE / 'flows')


class PreparationTests(unittest.TestCase):
    def test_prepare_only_overrides_auto_publish_and_never_asks_post_confirmation(self):
        clip = SimpleNamespace(info={'link': EXPECTED['product_url']}, context=lambda _: {'product': EXPECTED})
        flow = [{'id': 'add_product'}, {'id': 'search_product'}, {'id': 'choose_product'},
                {'id': 'post', 'do': 'post'}]
        ask = Mock(side_effect=AssertionError('Preparation must not ask to publish'))
        with patch.object(products, 'resolve_link', return_value=EXPECTED), \
                patch.object(products, 'remember', side_effect=lambda r: r), \
                patch.object(sp, 'push_clip', return_value='remote'), \
                patch.object(sp, 'run_step', return_value='ok') as run, \
                patch.object(sp, 'choose_correct_product', return_value='ok'), \
                patch.object(sp, 'apply_publish_options'), patch.object(sp, 'verify_basket', return_value=True):
            self.assertEqual(sp.run_clip(Mock(), clip, {'auto_post': True, '_prepare_only': True}, flow, ask),
                             ('prepared', 'remote'))
        self.assertFalse(any(c.args[1].get('do') == 'post' for c in run.call_args_list))
        ask.assert_not_called()

    def test_post_step_is_blocked_in_prepare_mode_even_if_auto_enabled(self):
        dev = Mock()
        self.assertEqual(sp.run_step(dev, {'do': 'post'}, {}, [],
                                     {'_prepare_only': True, 'auto_post': True}), 'handoff')
        dev.click.assert_not_called()

    def test_prepared_clip_does_not_change_history_or_delete_files_or_start_next_clip(self):
        clips = [SimpleNamespace(key='A', name='A', txt=True, info={'link': 'url'}),
                 SimpleNamespace(key='B', name='B', txt=True, info={'link': 'url'})]
        callback = Mock()
        with patch.object(sp, 'scan_clips', return_value=(clips, [])), \
                patch.object(sp, 'load_posted', return_value={'items': {}}), \
                patch.object(sp, 'connect', return_value=Mock()), patch.object(sp, 'load_flow', return_value=[]), \
                patch.object(sp, 'run_clip', return_value=('prepared', 'remote')) as run, \
                patch.object(sp, 'record_posted') as record, patch.object(sp, 'cleanup_phone') as cleanup:
            sp.cmd_post({'clips_folder': 'folder', '_prepare_only': True, 'auto_post': True,
                         'delete_after_post': True, '_prepared_callback': callback}, [], lambda _: '')
        run.assert_called_once()
        record.assert_not_called()
        cleanup.assert_not_called()
        callback.assert_called_once()

    def test_multi_clip_album_stops_before_selecting_anything(self):
        dev = Mock()
        nodes = screen_nodes(node('sv_test') + node('', bounds='[0,400][100,500]') +
                             node('', bounds='[200,400][300,500]'))
        for n in nodes[1:]:
            n.rid = sp.PKG + ':id/ll_check'
        with patch.object(sp, 'screen', return_value=((1080, 2400), nodes)), patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.StepFailed):
                sp.pick_uploaded_clip(dev, {'remote': '/sdcard/DCIM/sv_test/sv_test.mp4'})
        dev.click.assert_not_called()


if __name__ == '__main__':
    unittest.main()
