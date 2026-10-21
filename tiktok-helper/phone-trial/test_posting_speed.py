import unittest
from unittest.mock import Mock, patch
from xml.sax.saxutils import escape

import shopee_poster as sp

SIZE = (720, 1280)
POST = {'id': 'post', 'do': 'post', 'find': [{'idRegex': r':id/btn_post$'}]}
CONFIRM = {'id': 'confirm_product', 'do': 'tap', 'optional': True, 'timeout': 8,
           'find': [{'text': 'Confirm'}]}


def publish_page(caption='Full caption', title='Exact product', post=True, duplicate=False):
    xml = ('<node class="android.widget.EditText" resource-id="com.shopee.th:id/et_caption" '
           'text="' + escape(caption) + '" bounds="[0,100][700,200]"/>'
           '<node resource-id="com.shopee.th:id/tv_product_title" text="' + escape(title) + '" '
           'bounds="[0,300][700,400]"/>')
    if duplicate:
        xml += '<node resource-id="com.shopee.th:id/tv_product_title" text="Exact product" bounds="[0,410][700,450]"/>'
    if post:
        xml += '<node resource-id="com.shopee.th:id/btn_post" text="Post" bounds="[400,1100][700,1200]"/>'
    return sp.parse_nodes('<hierarchy>' + xml + '</hierarchy>')


class PostingSpeedTests(unittest.TestCase):
    def setUp(self):
        self.dev = Mock()
        self.dev.d.app_current.return_value = {'package': sp.PKG}
        self.ctx = {'caption_full': 'Full caption', 'product': {'source_url': 'source'},
                    '_verified_import': {'method': 'single_link_import', 'title': 'Exact product'}}

    def test_completed_import_skips_optional_wait_without_tapping(self):
        with patch.object(sp, 'screen', return_value=(SIZE, publish_page())) as screen, \
             patch.object(sp, 'perform') as perform, patch.object(sp.time, 'sleep') as sleep:
            self.assertEqual(sp.run_step(self.dev, CONFIRM, self.ctx, [POST], {}), 'skipped')
        screen.assert_called_once()
        perform.assert_not_called()
        sleep.assert_not_called()

    def test_incomplete_or_changed_publish_page_cannot_skip_the_wait(self):
        pages = [publish_page(caption='Changed'), publish_page(title='Other'),
                 publish_page(post=False), publish_page(duplicate=True)]
        for page in pages:
            with self.subTest(page=page), patch.object(sp, 'screen', return_value=(SIZE, page)), \
                 patch.object(sp.time, 'time', side_effect=[0, 9]) as clock, \
                 patch.object(sp, 'perform') as perform:
                self.assertEqual(sp.run_step(self.dev, CONFIRM, self.ctx, [POST], {}), 'skipped')
            self.assertEqual(clock.call_count, 2)  # Normal optional timeout, not the shortcut.
            perform.assert_not_called()

    def test_unverified_import_and_other_app_cannot_shortcut(self):
        for verified, package in [(False, sp.PKG), (True, 'other.app')]:
            ctx = dict(self.ctx)
            if not verified:
                ctx.pop('_verified_import')
            self.dev.d.app_current.return_value = {'package': package}
            with self.subTest(verified=verified, package=package), \
                 patch.object(sp, 'screen', return_value=(SIZE, publish_page())), \
                 patch.object(sp.time, 'time', side_effect=[0, 9]) as clock:
                sp.run_step(self.dev, CONFIRM, ctx, [POST], {})
            self.assertEqual(clock.call_count, 2)

    def test_required_confirmation_is_not_shortcut(self):
        with patch.object(sp, 'screen', return_value=(SIZE, publish_page())), \
             patch.object(sp.time, 'time', side_effect=[0, 61]):
            with self.assertRaises(sp.StepFailed):
                sp.run_step(self.dev, dict(CONFIRM, optional=False), self.ctx, [POST], {'auto_post': True})

    def test_thermal_warning_precedes_completed_import_shortcut(self):
        thermal = sp.parse_nodes('<hierarchy><node resource-id="miui:id/alertTitle" text="ร้อนเกิน" bounds="[0,800][700,900]"/>'
            '<node resource-id="miui:id/message" text="อุปกรณ์ของคุณร้อนเกินไป กล้อง จะถูกจำกัด" bounds="[0,900][700,1000]"/></hierarchy>')
        self.dev.shell.return_value = 'Display Power: state=OFF'
        with patch.object(sp, 'screen', return_value=(SIZE, publish_page() + thermal)):
            with self.assertRaises(sp.AttentionRequired):
                sp.run_step(self.dev, CONFIRM, self.ctx, [POST], {})
        self.dev.click.assert_not_called()

    def test_single_import_basket_uses_one_fresh_hierarchy_and_keeps_exact_checks(self):
        for page, valid in [(publish_page(), True), (publish_page(caption='Changed'), False),
                            (publish_page(title='Other'), False), (publish_page(duplicate=True), False),
                            (publish_page(post=False), False)]:
            with self.subTest(valid=valid, page=page), \
                 patch.object(sp, 'screen', return_value=(SIZE, page)) as screen, \
                 patch.object(sp, 'inspect_current_product') as inspect:
                if valid:
                    self.assertTrue(sp.verify_basket(self.dev, self.ctx, {}, [POST], Mock()))
                else:
                    with self.assertRaises(sp.StepFailed):
                        sp.verify_basket(self.dev, self.ctx, {}, [POST], Mock())
            screen.assert_called_once()
            inspect.assert_not_called()
        self.dev.click.assert_not_called()

    def test_single_import_basket_rejects_other_app_before_reading(self):
        self.dev.d.app_current.return_value = {'package': 'other.app'}
        with patch.object(sp, 'screen') as screen:
            with self.assertRaises(sp.StepFailed):
                sp.verify_basket(self.dev, self.ctx, {}, [POST], Mock())
        screen.assert_not_called()

    def test_native_caption_replacement_skips_only_redundant_tail_wait(self):
        page = publish_page()
        self.dev.d.return_value.count = 1
        step = {'id': 'caption', 'do': 'type', 'value': '{caption_full}',
                'find': [{'idRegex': r':id/et_caption$'}]}
        for extra, expected in [({}, [.8, 0]), ({'after': 2.5}, [.8, 2.5])]:
            with self.subTest(extra=extra), patch.object(sp, 'screen', return_value=(SIZE, page)), \
                 patch.object(sp, 'finish_caption'), patch.object(sp.time, 'sleep') as sleep:
                self.assertEqual(sp.run_step(self.dev, dict(step, **extra), self.ctx, [], {}), 'ok')
            self.assertEqual([c.args[0] for c in sleep.call_args_list], expected)
        self.dev.d.return_value.set_text.assert_called_with('Full caption')

    def test_wrong_text_still_stops_before_next_step(self):
        self.dev.d.return_value.count = 1
        step = {'id': 'caption', 'do': 'type', 'value': '{caption_full}',
                'find': [{'idRegex': r':id/et_caption$'}]}
        with patch.object(sp, 'screen', side_effect=[(SIZE, publish_page()), (SIZE, publish_page(caption='Changed'))]), \
             patch.object(sp, 'finish_caption') as finish, patch.object(sp.time, 'sleep'):
            with self.assertRaises(sp.StepFailed):
                sp.run_step(self.dev, step, self.ctx, [], {})
        finish.assert_not_called()

    def test_taps_keep_the_existing_settling_wait(self):
        step = {'id': 'add_product', 'do': 'tap', 'find': [{'idRegex': r':id/tv_product_title$'}]}
        with patch.object(sp, 'screen', return_value=(SIZE, publish_page())), patch.object(sp.time, 'sleep') as sleep:
            self.assertEqual(sp.run_step(self.dev, step, self.ctx, [], {}), 'ok')
        sleep.assert_called_once_with(1.8)
        self.dev.click.assert_called_once()


if __name__ == '__main__':
    unittest.main()
