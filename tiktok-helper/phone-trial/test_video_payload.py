import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import video_payload as vp


class VideoPayloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'original.mp4'
        self.source.write_bytes(b'original')
        self.sha = vp.post_cleanup.digest(self.source)
        self.meta = dict(codec_name='mpeg4', audio_codec='aac', width=1080, height=1920, duration=20.096)
        self.converted = dict(self.meta, codec_name='h264')

    def test_h264_source_is_preserved_without_conversion(self):
        with patch.object(vp, 'probe', return_value=self.converted), patch.object(vp.subprocess, 'run') as run:
            self.assertEqual(vp.prepare(self.source,self.sha),(self.source,self.sha))
        run.assert_not_called()

    def test_conversion_preserves_original_and_verifies_copy(self):
        def convert(args, **kwargs):
            Path(args[-1]).write_bytes(b'encoded')
            return Mock(returncode=0)
        with patch.object(vp,'CACHE',self.root / 'cache'), patch.object(vp,'probe',side_effect=[self.meta,self.converted]), \
             patch.object(vp.shutil,'which',return_value='ffmpeg'), patch.object(vp.subprocess,'run',side_effect=convert):
            path,sha = vp.prepare(self.source,self.sha)
        self.assertEqual(path.read_bytes(),b'encoded')
        self.assertEqual(sha,vp.post_cleanup.digest(path))
        self.assertEqual(self.source.read_bytes(),b'original')

    def test_truncated_silent_or_wrong_size_copy_is_rejected(self):
        for change in ({'duration':10},{'audio_codec':'mp3'},{'audio_codec':None},{'width':720},{'codec_name':'mpeg4'}):
            self.assertFalse(vp.valid_copy(self.meta,dict(self.converted,**change)))

    def test_failed_encoder_never_produces_upload_path(self):
        with patch.object(vp,'CACHE',self.root / 'cache'), patch.object(vp,'probe',return_value=self.meta), \
             patch.object(vp.shutil,'which',return_value='ffmpeg'), patch.object(vp.subprocess,'run',return_value=Mock(returncode=1)):
            with self.assertRaises(RuntimeError):
                vp.prepare(self.source,self.sha)
        self.assertEqual(self.source.read_bytes(),b'original')


if __name__ == '__main__':
    unittest.main()
