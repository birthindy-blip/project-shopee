import unittest
from shopee_poster import fit_caption, caption_units


class CaptionLimitTests(unittest.TestCase):
    def test_utf16_limit_with_supplementary_emoji(self):
        out = fit_caption('🐒' * 100, '#ทดสอบ')
        self.assertLessEqual(caption_units(out), 150)
        self.assertNotIn('\ufffd', out)

    def test_full_body_is_kept_and_hashtags_are_whole(self):
        body = 'ก' * 135
        out = fit_caption(body, '#สั้น #ยาวมากมากมาก')
        self.assertTrue(out.startswith(body))
        self.assertIn('#สั้น', out)
        self.assertNotIn('#ยาว', out)
        self.assertLessEqual(caption_units(out), 150)

    def test_old_phone_plain_mode_preserves_thai_words(self):
        out = fit_caption('จัดโต๊ะ 🖤✨ ใช้ง่าย', '#จัดโต๊ะ', plain_emoji=True)
        self.assertEqual(out, 'จัดโต๊ะ ✨ ใช้ง่าย\n\n#จัดโต๊ะ')


if __name__ == '__main__':
    unittest.main()
