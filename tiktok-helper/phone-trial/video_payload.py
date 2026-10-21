"""Prepare a compatible upload copy while preserving the original queue file."""
import json
import math
import shutil
import subprocess
from pathlib import Path

import post_cleanup

CACHE = Path(__file__).resolve().parent / 'encoded'


def probe(path):
    tool = shutil.which('ffprobe')
    if not tool:
        raise RuntimeError('ไม่พบ ffprobe สำหรับตรวจรูปแบบวิดีโอ')
    result = subprocess.run([tool, '-v', 'error', '-show_entries',
                             'format=duration:stream=codec_type,codec_name,width,height',
                             '-of', 'json', str(path)], capture_output=True, text=True,
                            timeout=30, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError('อ่านรูปแบบวิดีโอไม่สำเร็จ — เก็บต้นฉบับไว้')
    data = json.loads(result.stdout)
    video = next(s for s in data['streams'] if s.get('codec_type') == 'video')
    audio = next((s for s in data['streams'] if s.get('codec_type') == 'audio'), {})
    return dict(video, audio_codec=audio.get('codec_name'), duration=float(data['format']['duration']))


def valid_copy(original, copy):
    return (copy.get('codec_name') == 'h264'
            and copy.get('audio_codec') == ('aac' if original.get('audio_codec') else None)
            and copy.get('width') == original.get('width') and copy.get('height') == original.get('height')
            and math.isfinite(copy.get('duration', 0)) and copy['duration'] > 0
            and abs(copy['duration'] - original['duration']) <= .3)


def prepare(path, source_sha):
    path = Path(path)
    original = probe(path)
    if original['codec_name'] == 'h264' and original['audio_codec'] in (None, 'aac'):
        return path, source_sha
    tool = shutil.which('ffmpeg')
    if not tool:
        raise RuntimeError('คลิปนี้ต้องแปลงเป็น H.264 แต่ไม่พบ ffmpeg — เก็บต้นฉบับไว้')
    CACHE.mkdir(exist_ok=True)
    target = CACHE / (source_sha + '.mp4')
    if target.exists() and valid_copy(original, probe(target)):
        return target, post_cleanup.digest(target)
    temporary = target.with_suffix('.pending.mp4')
    print('  🎞 เตรียมสำเนา H.264 สำหรับอัปโหลด โดยเก็บคลิปต้นฉบับไว้', flush=True)
    result = subprocess.run([tool, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                             '-i', str(path), '-map', '0:v:0', '-map', '0:a:0?',
                             '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
                             '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(temporary)],
                            capture_output=True, timeout=600,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode or not valid_copy(original, probe(temporary)):
        raise RuntimeError('แปลงคลิปไม่ผ่านการตรวจความยาว/ภาพ/เสียง — เก็บต้นฉบับไว้')
    if post_cleanup.digest(path) != source_sha:
        raise RuntimeError('คลิปต้นฉบับเปลี่ยนระหว่างแปลง จึงหยุดอัปโหลด')
    temporary.replace(target)
    return target, post_cleanup.digest(target)
