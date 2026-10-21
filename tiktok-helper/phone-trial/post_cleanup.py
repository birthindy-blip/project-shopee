"""Clean only the confirmed posted clip; keep pending clips and shared captions."""
import hashlib
import json
import os
import re
import shlex
import subprocess
from pathlib import Path


def digest(path):
    with Path(path).open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def source_snapshot(clip):
    return {'video': digest(clip.video), 'txt': digest(clip.txt) if clip.txt else None}


def matches_source(record, source_sha):
    # Legacy uploads contain the unchanged source; encoded uploads store both hashes.
    return bool(source_sha and record.get('sha256')
                and record.get('source_sha256', record.get('sha256')) == source_sha)


def recycle_files(paths):
    if os.name != 'nt':
        raise RuntimeError('Automatic PC cleanup requires the Windows Recycle Bin.')
    # Paths travel as data on stdin, never as shell code; each operation is literal and non-recursive.
    script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; $ClipPaths=ConvertFrom-Json ([Console]::In.ReadToEnd()); foreach($ClipPath in $ClipPaths){[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile([string]$ClipPath,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)}"
    result = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script],
                            input=json.dumps([str(p) for p in paths]), text=True,
                            capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW,
                            timeout=60)
    if result.returncode:
        raise RuntimeError('ย้ายไฟล์เข้าถังขยะไม่สำเร็จ — เก็บไฟล์ที่เหลือไว้')


def cleanup_posted(dev, clip, settings, posted, remote, uploads, remaining,
                   recycle=recycle_files):
    result = {'pc': [], 'phone': False, 'txt_kept_for_other_clip': False, 'error': ''}
    if (not settings.get('delete_after_post') or settings.get('_prepare_only')
            or not settings.get('_post_confirmed')
            or posted.get('items', {}).get(clip.key, {}).get('status') != 'posted'):
        return result
    root = Path(settings['clips_folder']).resolve()
    source_hash = settings.get('_cleanup_sources', {})
    video = Path(clip.video)
    if (video.is_symlink() or video.resolve().parent != root or video.suffix.lower() != '.mp4'
            or not source_hash.get('video') or digest(video) != source_hash['video']):
        raise RuntimeError('คลิปในคอมเปลี่ยนไปหรืออยู่นอกโฟลเดอร์ที่เลือก จึงไม่ลบ')
    base = settings['phone_folder'].rstrip('/')
    record = uploads.get(settings['serial'] + '|' + clip.key, {})
    if (not re.fullmatch(re.escape(base) + r'/SV[0-9a-f]{10}/sv_\d{8}_\d{6}_\d{3}\.mp4', remote or '')
            or record.get('remote') != remote or not matches_source(record, source_hash['video'])):
        raise RuntimeError('ยังยืนยันไฟล์ของโปรแกรมบนมือถือไม่ได้ จึงไม่ลบ')
    records = [record] + record.get('previous_uploads', [])
    verified = {}
    cached = {}
    cache_root = Path(__file__).resolve().parent / 'encoded'
    for uploaded in records:
        owned = uploaded.get('remote', '')
        if (not matches_source(uploaded, source_hash['video'])
                or not re.fullmatch(re.escape(base) + r'/SV[0-9a-f]{10}/sv_\d{8}_\d{6}_\d{3}\.mp4', owned)):
            raise RuntimeError('ประวัติสำเนาบนมือถือไม่ตรงกับต้นฉบับ จึงเก็บไฟล์ไว้')
        remote_hash = dev.shell('sha256sum ' + shlex.quote(owned)).split()
        if not remote_hash or remote_hash[0] != uploaded['sha256']:
            raise RuntimeError('ไฟล์บนมือถือเปลี่ยนไป จึงไม่ลบ')
        verified[owned] = uploaded['sha256']
        if uploaded.get('payload'):
            copy = Path(uploaded['payload'])
            if (copy.is_symlink() or copy.resolve().parent != cache_root
                    or copy.name != source_hash['video'] + '.mp4' or digest(copy) != uploaded['sha256']):
                raise RuntimeError('สำเนาในคอมเปลี่ยนไป จึงเก็บไฟล์ไว้')
            cached[str(copy.resolve())] = copy.resolve()
    paths = [video.resolve()]
    if clip.txt and Path(clip.txt).exists():
        txt = Path(clip.txt)
        shared = any(c.key != clip.key and c.txt and Path(c.txt).resolve() == txt.resolve()
                     and posted['items'].get(c.key, {}).get('status') != 'posted' for c in remaining)
        if shared:
            result['txt_kept_for_other_clip'] = True
        elif (not txt.is_symlink() and txt.resolve().parent == root and txt.suffix.lower() == '.txt'
              and source_hash.get('txt') and digest(txt) == source_hash['txt']):
            paths.append(txt.resolve())
        else:
            raise RuntimeError('ไฟล์ .txt เปลี่ยนไปหรืออยู่นอกโฟลเดอร์ที่เลือก จึงไม่ลบ')
    paths.extend(cached.values())
    recycle(paths)
    result['pc'] = [str(p) for p in paths if not p.exists()]
    if len(result['pc']) != len(paths):
        raise RuntimeError('ยังย้ายไฟล์ในคอมเข้าถังขยะไม่ครบ จึงเก็บไฟล์บนมือถือไว้')
    # Delete only this upload's verified path, not an album or every video on the phone.
    result['phone'] = True
    for owned in verified:
        dev.shell('rm -f -- ' + shlex.quote(owned))
        state = dev.shell('test ! -e ' + shlex.quote(owned) + ' && echo REMOVED || echo PRESENT').strip()
        if state != 'REMOVED':
            result['phone'] = False
            result['error'] = 'ไฟล์บนมือถือยังลบไม่สำเร็จ'
        else:
            storage = owned.replace('/sdcard/', '/storage/emulated/0/', 1)
            dev.shell('content delete --uri content://media/external/video/media --where '
                      + shlex.quote("_data='" + storage + "'"))
    return result
