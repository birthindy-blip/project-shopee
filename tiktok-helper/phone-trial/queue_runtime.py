"""Durable batch intent and process leases; unknown publications stay read-only."""
import contextlib
import json
import os
import math
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SESSION = HERE / 'queue-session.json'

def load():
    try:
        return json.loads(SESSION.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {}

def save(session):
    temp = SESSION.with_suffix('.tmp')
    temp.write_text(json.dumps(session, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temp, SESSION)

def stop(reason):
    session = load()
    session.update(active=False, stop_reason=reason)
    if session.get('cooldown', {}).get('phase') in ('waiting', 'checking'):
        session['cooldown'].update(phase='cancelled', cancelled_at=time.time())
    save(session)

@contextlib.contextmanager
def lease(name):
    with (HERE / name).open('a+b') as file:
        file.seek(0)
        if not file.read(1):
            file.write(b'0')
            file.flush()
        file.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            file.seek(0)
            if os.name == 'nt':
                msvcrt.locking(file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(file, fcntl.LOCK_UN)

def same_queue_scope(cfg, session):
    return (session.get('active') and cfg.get('auto_post')
            and cfg.get('serial') == session.get('serial')
            and cfg.get('clips_folder') == session.get('clips_folder'))


def cooldown_status(session, cfg, now=None):
    cd = session.get('cooldown') or {}
    if (not same_queue_scope(cfg, session) or cd.get('phase') not in ('waiting', 'checking')
            or cd.get('serial') != session.get('serial')
            or cd.get('clips_folder') != session.get('clips_folder')
            or cd.get('clip_key') not in session.get('clip_keys', [])):
        return None
    now = time.time() if now is None else now
    deadline = max(cd['resume_at'], cd.get('retry_after', 0))
    return {**cd, 'seconds_remaining': max(0, math.ceil(deadline - now))}


def reconcile_cooldown(status, session, now=None):
    """Persist one full rest per native heat event; never extend it on polling."""
    cfg, job = status['settings'], status['job']
    if not same_queue_scope(cfg, session) or job['running']:
        return False
    now = time.time() if now is None else now
    cd = session.get('cooldown') or {}
    attention = job.get('attention') or {}
    minutes = cfg.get('thermal_cooldown_minutes', 0)
    valid_duration = (type(minutes) in (int, float) and math.isfinite(minutes)
                      and 0 < minutes <= 1440)
    unknown = job.get('unconfirmed')
    if unknown and unknown.get('clip_key') not in session.get('clip_keys', []):
        return False
    if (valid_duration and attention.get('code') == 'phone_overheating'
            and attention.get('screen_sleep') == 'confirmed'
            and isinstance(attention.get('seen_at'), (int, float))
            and (not cd or cd.get('attention_seen_at') != attention['seen_at'])):
        original = set(session.get('clip_keys', []))
        pending = [c['key'] for c in status.get('clips', [])
                   if c.get('state') == 'pending' and c['key'] in original]
        if not unknown and not pending:
            return False
        session['cooldown'] = {'phase': 'waiting', 'started_at': now,
            'resume_at': now + minutes * 60, 'duration_seconds': minutes * 60,
            'attention_seen_at': attention['seen_at'], 'serial': session['serial'],
            'clips_folder': session['clips_folder'],
            'clip_key': unknown['clip_key'] if unknown else pending[0]}
        return True
    if cd.get('phase') == 'checking':
        checked = status.get('phone', {})
        if (job.get('kind') == 'check' and checked.get('checked')
                and checked.get('shopee') and checked.get('screen')
                and attention.get('code') in (None, 'upload_unconfirmed')):
            cd.update(phase='completed', completed_at=now)
            if unknown:  # One read-only recovery may follow this fresh readiness check.
                session.pop('recovery_key', None)
            return True
        if job.get('kind') == 'check':
            cd.update(phase='blocked', blocked_at=now)
            return True
        # A dashboard restart interrupted only a readiness check. Retain the
        # deadline and wait a minute for any orphan check's phone lease to end.
        cd.update(phase='waiting', retry_after=now + 60)
        return True
    return False


def next_action(status, session, now=None):
    job, cfg = status['job'], status['settings']
    if (not session.get('active') or job['running'] or not cfg.get('auto_post')
            or cfg.get('serial') != session.get('serial')
            or cfg.get('clips_folder') != session.get('clips_folder')):
        return ''
    if job.get('kind') == 'post' and job.get('state') == 'done':
        return 'complete'
    cooldown = cooldown_status(session, cfg, now)
    if cooldown:
        if cooldown['phase'] != 'waiting' or cooldown['seconds_remaining'] > 0:
            return ''
        unknown = job.get('unconfirmed')
        if unknown and unknown.get('clip_key') not in session.get('clip_keys', []):
            return ''
        if not unknown:
            pending = {c['key'] for c in status.get('clips', []) if c.get('state') == 'pending'}
            if (status.get('today', 0) >= cfg.get('daily_limit', 0)
                    or not pending.intersection(session.get('clip_keys', []))):
                return 'complete'
        phone = status.get('phone', {})
        return 'cooldown_check' if (phone.get('state') == 'device'
            and phone.get('serial', session['serial']) == session['serial']) else ''
    if (job.get('attention') or {}).get('code') not in (None, 'upload_unconfirmed'):
        return ''
    unknown = job.get('unconfirmed')
    if unknown:
        key = unknown.get('clip_key')
        return 'recover' if key in session.get('clip_keys', []) and session.get('recovery_key') != key else ''
    if job.get('state') in ('failed', 'stopped', 'attention'):
        return ''
    if status.get('today', 0) >= cfg.get('daily_limit', 0):
        return 'complete'
    pending = {c['key'] for c in status.get('clips', []) if c.get('state') == 'pending'}
    if not pending.intersection(session.get('clip_keys', [])):
        return 'complete'
    if status.get('phone', {}).get('state') != 'device':
        return ''
    if status.get('ready'):
        return 'post'
    return '' if job.get('kind') == 'check' else 'check'
