import copy
import tempfile
import json
from types import SimpleNamespace
import unittest
from pathlib import Path
from unittest.mock import patch
import queue_runtime as rt
import poster_app as app

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.session={'active':True,'serial':'phone','clips_folder':'folder','clip_keys':['original']}
        self.state={'settings':{'auto_post':True,'serial':'phone','clips_folder':'folder','daily_limit':70},
                    'job':{'running':False,'kind':'','state':'idle'},'today':0,
                    'phone':{'state':'device'},'ready':False,'clips':[{'key':'original','state':'pending'}]}
    def test_restart_checks_phone_then_resumes_only_original_batch(self):
        self.assertEqual(rt.next_action(self.state,self.session),'check')
        self.state.update(ready=True)
        self.state['job'].update(kind='check',state='done')
        self.assertEqual(rt.next_action(self.state,self.session),'post')
    def test_unknown_attempt_is_recover_only_once_even_after_restart(self):
        self.state['job'].update(state='attention',unconfirmed={'clip_key':'original'},attention={'code':'upload_unconfirmed'})
        self.assertEqual(rt.next_action(self.state,self.session),'recover')
        self.session['recovery_key']='original'
        self.assertEqual(rt.next_action(self.state,copy.deepcopy(self.session)),'')
    def test_identity_and_failed_checks_never_loop(self):
        self.state['job'].update(state='attention',attention={'code':'identity_required'})
        self.assertEqual(rt.next_action(self.state,self.session),'')
        self.state['job'].update(kind='check',state='failed',attention=None)
        self.assertEqual(rt.next_action(self.state,self.session),'')
    def test_stop_and_changed_device_block_resume(self):
        self.session['active']=False
        self.assertEqual(rt.next_action(self.state,self.session),'')
        self.session.update(active=True,serial='other')
        self.assertEqual(rt.next_action(self.state,self.session),'')
    def test_no_new_batch_or_next_day_restart(self):
        self.state['clips']=[{'key':'new-file','state':'pending'}]
        self.assertEqual(rt.next_action(self.state,self.session),'complete')
        self.state['job'].update(kind='post',state='done')
        self.assertEqual(rt.next_action(self.state,self.session),'complete')
    def test_locked_phone_never_starts_another_worker(self):
        with patch.object(rt,'lease',side_effect=OSError('busy')), patch.object(app,'_worker') as worker, patch('builtins.print'):
            self.assertEqual(app.worker('post'),1)
        worker.assert_not_called()

    def test_lease_blocks_a_second_worker_and_releases_after_exit(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(rt,'HERE',Path(temp)):
            with rt.lease('test.lock'):
                with self.assertRaises(OSError):
                    with rt.lease('test.lock'):
                        self.fail('second worker acquired lock')
            with rt.lease('test.lock'):
                pass
    def test_completed_post_batch_is_disarmed_before_server_restart(self):
        job={'running':True,'kind':'post','state':'running','logs':[]}
        proc=SimpleNamespace(stdout=[json.dumps({'result':'done'})],wait=lambda:0)
        with patch.object(app,'JOB',job), patch.object(app,'PROCESS',proc), patch.object(app.sp,'write_json'), patch.object(rt,'stop') as stop:
            app.collect(proc)
        stop.assert_called_once_with('batch_complete_or_daily_limit')
        self.assertFalse(job['running'])

    def test_controller_persists_attempt_before_readonly_recover(self):
        self.state['job'].update(state='attention',unconfirmed={'clip_key':'original'},attention={'code':'upload_unconfirmed'})
        events=[]
        with patch.object(app,'JOB',self.state['job']), patch.object(app,'status',return_value=self.state), patch.object(rt,'load',return_value=self.session), patch.object(rt,'save',side_effect=lambda s:events.append(('save',s['recovery_key']))), patch.object(app,'start_job',side_effect=lambda kind,**kw:events.append(('start',kind))):
            self.state['job']['logs']=[]
            app.auto_queue_once()
        self.assertEqual(events,[('save','original'),('start','recover')])

if __name__=='__main__': unittest.main()
