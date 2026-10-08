"""Local preparation diagnostics. No publishing action."""
import sys
import time
from pathlib import Path
import uiautomator2 as u2
import shopee_poster as sp

d = u2.connect(sp.load_settings().get('serial') or None)
dev = sp.Device(d)
if sys.argv[1:] == ['push']:
    settings = sp.load_settings()
    clip = sp.scan_clips(settings['clips_folder'])[0][0]
    settings['phone_folder'] = '/sdcard/DCIM/ShopeeVideo/ShopeeTrial_CeraVe'
    remote = sp.push_clip(dev, clip, settings)
    print(remote)
    print(dev.shell("content query --uri content://media/external/video/media --projection _display_name:_data:duration --where \"_data LIKE '/storage/emulated/0/DCIM/ShopeeVideo/ShopeeTrial_CeraVe/%'\""))
elif sys.argv[1:] == ['album']:
    d.press('back')
    d.press('back')
    d(resourceId='com.shopee.th:id/ll_gallery_entrance').click()
    d(resourceId='com.shopee.th:id/lyt_pick_title').click()
    print('found', d(scrollable=True).scroll.to(text='ShopeeTrial_CeraVe'))
elif sys.argv[1:] == ['pick']:
    d(text='ShopeeTrial_CeraVe').click()
    time.sleep(1)
elif sys.argv[1:] == ['scan']:
    path = '/storage/emulated/0/DCIM/ShopeeVideo/ShopeeTrial_CeraVe/sv_20261008_160143_219.mp4'
    print(dev.shell(f'content call --uri content://media --method scan_file --arg {path}'))
    print(dev.shell("content query --uri content://media/external/video/media --projection _display_name:_data:duration:mime_type:is_pending:width:height --where \"_display_name='sv_20261008_160143_219.mp4'\""))
    c = sp.scan_clips(sp.load_settings()['clips_folder'])[0][0]
    print(c.video.read_bytes()[:48].hex())
elif sys.argv[1:] == ['link']:
    d.click(1005, 150)
    time.sleep(1)
    size, nodes = sp.screen(dev)
    sp.perform(dev, {'do': 'type', 'value': '{search}'},
               sp.find_target(nodes, [{'class': 'android.widget.EditText'}], size), size,
               {'search': 'https://shopee.co.th/product/121205602/1867293688'})
    time.sleep(2)
elif len(sys.argv) == 3 and sys.argv[1] == 'id':
    d(resourceId=sys.argv[2]).click()
    time.sleep(2)
elif len(sys.argv) == 3 and sys.argv[1] == 'text':
    assert sys.argv[2] not in ('โพสต์', 'Post', 'เผยแพร่', 'Publish', 'Upload', 'อัปโหลด')
    d(text=sys.argv[2]).click()
    time.sleep(2)
x = dev.dump()
Path('phone-live.xml').write_text(x, encoding='utf-8')
d.screenshot('phone-live.jpg')
size = dev.window_size()
print('current', d.app_current(), 'size', size)
print('\n'.join(f'{i} {n.cls} {n.bounds} click={n.clickable} id={n.rid} text={n.text} desc={n.desc}'
    for i, n in enumerate(sp.parse_nodes(x)) if n.visible(size) and n.bounds[1] >= size[1] * .025
    and not n.rid.startswith(('com.android.systemui:', 'com.samsung.android.app.cocktailbarservice:'))
    and (n.text or n.desc or n.clickable)))
