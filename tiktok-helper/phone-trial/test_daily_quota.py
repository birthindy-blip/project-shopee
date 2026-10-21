import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import shopee_poster as sp


def clip(key):
    return SimpleNamespace(key=key,name=key,info={'link':'https://s.shopee.co.th/example'},txt='caption.txt')


class DailyQuotaTests(unittest.TestCase):
    def run_queue(self, clips, outcomes, initial=1, limit=3, queue_keys=None):
        posted = {'items':{'earlier'+str(i):{'status':'posted'} for i in range(initial)}}
        cfg = {'auto_post':True,'clips_folder':'unused','daily_limit':limit,'delete_after_post':False}
        if queue_keys is not None:
            cfg['_queue_keys'] = queue_keys
        def run(dev,current,settings,flow,ask):
            result = outcomes[current.key]
            if isinstance(result,Exception):
                raise result
            return result,None
        def record(data,current,status):
            data['items'][current.key] = {'status':status}
        with patch.object(sp,'scan_clips',return_value=(clips,[])), \
             patch.object(sp,'load_posted',return_value=posted), \
             patch.object(sp,'posted_today',side_effect=lambda data:sum(r['status']=='posted' for r in data['items'].values())), \
             patch.object(sp,'connect',return_value=Mock()), patch.object(sp,'load_flow',return_value=[]), \
             patch.object(sp,'resume_delay_seconds',return_value=0), \
             patch.object(sp,'run_clip_with_retry',side_effect=run) as run_mock, \
             patch.object(sp,'record_posted',side_effect=record), patch.object(sp,'write_json'), \
             patch.object(sp,'wait_between') as wait:
            sp.cmd_post(cfg,[],ask=lambda prompt:'')
        return posted,run_mock,wait

    def test_invalid_sources_do_not_reduce_success_quota_and_limit_still_holds(self):
        clips = [clip(k) for k in ('missing1','valid1','missing2','valid2','over_limit')]
        outcomes = {'missing1':sp.ClipUnavailable('no link'),'valid1':'posted',
                    'missing2':sp.ClipUnavailable('no txt'),'valid2':'posted','over_limit':'posted'}
        posted,run,wait = self.run_queue(clips,outcomes)
        self.assertEqual([c.args[1].key for c in run.call_args_list],['missing1','valid1','missing2','valid2'])
        self.assertEqual(sum(r['status']=='posted' for r in posted['items'].values()),3)
        self.assertNotIn('missing1',posted['items'])
        self.assertNotIn('missing2',posted['items'])
        self.assertNotIn('over_limit',posted['items'])
        self.assertEqual(wait.call_count,1)  # No extra rest after reaching the cap.

    def test_skipped_clip_does_not_consume_a_confirmed_publication_slot(self):
        clips = [clip(k) for k in ('skipped','valid1','valid2','over_limit')]
        posted,run,wait = self.run_queue(clips,{'skipped':'skipped','valid1':'posted','valid2':'posted','over_limit':'posted'})
        self.assertEqual(posted['items']['skipped']['status'],'skipped')
        self.assertEqual(sum(r['status']=='posted' for r in posted['items'].values()),3)
        self.assertNotIn('over_limit',posted['items'])

    def test_original_batch_boundary_still_excludes_new_files(self):
        clips = [clip(k) for k in ('new_file','missing','original')]
        posted,run,wait = self.run_queue(clips,{'new_file':'posted','missing':sp.ClipUnavailable(),'original':'posted'},
                                        queue_keys=['missing','original'])
        self.assertEqual([c.args[1].key for c in run.call_args_list],['missing','original'])
        self.assertNotIn('new_file',posted['items'])
        self.assertEqual(posted['items']['original']['status'],'posted')


if __name__ == '__main__':
    unittest.main()
