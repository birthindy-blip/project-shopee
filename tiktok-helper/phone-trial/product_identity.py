"""Resolve Shopee product identities; never infer an ID from a product name."""
import datetime
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

CACHE_FILE = Path(__file__).resolve().parent / 'products.json'
URL_RE = re.compile(r'(?:https?://|shopee://)[^\s<>"\']+', re.I)


def allowed_url(url):
    try:
        p = urlparse(url)
        return (p.scheme == 'https' and p.hostname in
                ('shopee.co.th', 'www.shopee.co.th', 's.shopee.co.th')
                and p.port in (None, 443) and not p.username and not p.password)
    except ValueError:
        return False


def parse_identity(url, depth=0):
    """Accept explicit product routes/query fields, including affiliate landing routes."""
    if depth > 3:
        return None
    url = str(url).strip().rstrip(').,]')
    try:
        p = urlparse(url)
    except ValueError:
        return None
    native = p.scheme == 'shopee' and p.netloc == 'product'
    if not native and not allowed_url(url):
        return None
    path = unquote(p.path)
    m = re.search(r'/(?:product|opaanlp)/(\d+)/(\d+)(?:/|$)', path)
    if native:
        m = re.match(r'/(\d+)/(\d+)(?:/|$)', path)
    if not m:
        m = re.search(r'-i\.(\d+)\.(\d+)(?:/|$)', path)
    q = {k.lower(): v for k, v in parse_qs(p.query).items()}
    if m:
        shop, item = m.groups()
    elif q.get('shopid') and q.get('itemid'):
        shop, item = q['shopid'][0], q['itemid'][0]
    elif q.get('shop_id') and q.get('item_id'):
        shop, item = q['shop_id'][0], q['item_id'][0]
    else:
        for key in ('url', 'redirect', 'redirect_url', 'af_dp', 'deep_and_deferred'):
            for value in q.get(key, []):
                found = parse_identity(value, depth + 1)
                if found:
                    return found
        return None
    if not shop.isdigit() or not item.isdigit() or int(shop) <= 0 or int(item) <= 0:
        return None
    return {'shop_id': shop, 'item_id': item,
            'product_url': f'https://shopee.co.th/product/{shop}/{item}'}


def resolve_link(link, fetch=None):
    """Follow only Shopee HTTPS redirects, with bounded requests and no page scraping."""
    result = {'source_url': link, 'status': 'unresolved', 'item_id': '', 'shop_id': '',
              'product_url': '', 'error': '', 'checked_at': datetime.datetime.now().isoformat(timespec='seconds')}
    if not link:
        return {**result, 'error': 'ไม่มีลิงก์สินค้า'}
    if not allowed_url(link):
        return {**result, 'error': 'ต้องใช้ลิงก์ HTTPS ของ Shopee ประเทศไทย'}
    # A recorded browser redirect is evidence for the exact short link, not a guessed product.
    cached = cached_identity(link)
    if cached.get('status') == 'resolved' and cached.get('method') == 'browser_redirect':
        try:
            checked = datetime.datetime.fromisoformat(cached['checked_at'])
            age = (datetime.datetime.now() - checked).total_seconds()
            if 0 <= age < 86400:
                return {**result, **cached}
        except (KeyError, ValueError):
            pass
    url = link
    try:
        if fetch is None:
            import requests
            fetch = requests.get
        for _ in range(5):
            found = parse_identity(url)
            if found:
                return {**result, **found, 'status': 'resolved'}
            if not allowed_url(url):
                return {**result, 'error': 'ลิงก์เปลี่ยนไปนอก Shopee จึงหยุดตรวจ'}
            response = fetch(url, allow_redirects=False, stream=True, timeout=(5, 10),
                             headers={'User-Agent': 'Mozilla/5.0'})
            try:
                if response.status_code not in (301, 302, 303, 307, 308):
                    return {**result, 'error': f'ลิงก์ไม่ส่งรหัสสินค้ากลับมา (HTTP {response.status_code})'}
                location = response.headers.get('Location', '')
                if not location:
                    return {**result, 'error': 'ลิงก์ไม่มีปลายทาง'}
                url = urljoin(url, location)
            finally:
                response.close()
        return {**result, 'error': 'ลิงก์เปลี่ยนปลายทางหลายครั้งเกินไป'}
    except Exception as exc:
        return {**result, 'error': 'เปิดลิงก์ไม่สำเร็จ: ' + str(exc)}


def load_cache():
    try:
        value = json.loads(CACHE_FILE.read_text(encoding='utf-8-sig'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def cached_identity(link):
    found = parse_identity(link)
    if found:
        return {**found, 'source_url': link, 'status': 'resolved', 'error': ''}
    result = load_cache().get(link, {'status': 'unchecked', 'item_id': '', 'shop_id': '',
                                    'source_url': link, 'product_url': '', 'error': ''})
    if not isinstance(result, dict):
        return {'status': 'unchecked', 'item_id': '', 'shop_id': '', 'source_url': link,
                'product_url': '', 'error': 'ข้อมูลรหัสเก่าไม่ถูกต้อง — ตรวจลิงก์ใหม่'}
    if result.get('status') == 'resolved':
        valid = parse_identity(result.get('product_url', ''))
        if not valid or valid['item_id'] != result.get('item_id') or valid['shop_id'] != result.get('shop_id'):
            return {'status': 'unchecked', 'item_id': '', 'shop_id': '', 'source_url': link,
                    'product_url': '', 'error': 'ข้อมูลรหัสเก่าไม่ถูกต้อง — ตรวจลิงก์ใหม่'}
        result = {**result, **valid}
    return result


def remember(result):
    cache = load_cache()
    cache[result['source_url']] = result
    temp = CACHE_FILE.with_suffix('.json.tmp')
    temp.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(CACHE_FILE)
    return result


def identities_in_text(text):
    identities = []
    for url in URL_RE.findall(text or ''):
        found = parse_identity(url)
        if found:
            identities.append(found)
    item = re.search(r'(?:\bitem[ _-]?id\b|รหัสสินค้า|หมายเลขสินค้า)\s*[:：#=]?\s*(\d{5,})\b', text or '', re.I)
    shop = re.search(r'(?:\bshop[ _-]?id\b|รหัสร้านค้า)\s*[:：#=]?\s*(\d{4,})\b', text or '', re.I)
    if item:
        identities.append({'item_id': item[1], 'shop_id': shop[1] if shop else ''})
    return unique_identities(identities)


def unique_identities(identities):
    result = []
    for identity in identities:
        item = identity['item_id']
        shop = identity.get('shop_id', '')
        same = next((i for i in result if i['item_id'] == item and
                     (not i.get('shop_id') or not shop or i['shop_id'] == shop)), None)
        if same is None:
            result.append(identity)
        elif shop:
            same.update(identity)
    return result


def compare(expected, actual, method='screen'):
    if not expected or not expected.get('item_id'):
        state, message = 'unavailable', 'ยังไม่ทราบ Item ID จากลิงก์ของคลิป'
    elif not actual or not actual.get('item_id'):
        state, message = 'unavailable', 'ยังอ่าน Item ID ของสินค้าบนมือถือไม่ได้'
    elif expected['item_id'] != actual['item_id'] or (actual.get('shop_id') and expected.get('shop_id') != actual['shop_id']):
        state, message = 'mismatch', 'รหัสสินค้าบนมือถือไม่ตรงกับลิงก์ของคลิป'
    else:
        state, message = 'matched', 'Item ID ตรงกับลิงก์ของคลิป'
    return {'status': state, 'message': message, 'expected': expected or {},
            'actual': actual or {}, 'method': method}
