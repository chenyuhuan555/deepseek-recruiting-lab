import unittest
from datetime import date

from core import Criterion, Job, Memory, apply_change, select_memories


class JobRevisionTests(unittest.TestCase):
    def setUp(self):
        self.job = Job('job-a', 1, (
            Criterion('b2b', '3年以上B端产品经验', 'required', '3年以上B端产品经验'),
            Criterion('rag', '参与过RAG项目', 'required', '参与过RAG项目'),
        ))

    def change(self, **overrides):
        args = dict(expected_version=1, source_text='必须主导过产品上线',
                    updates=(Criterion('launch', '主导过产品上线', 'required', '必须主导过产品上线'),),
                    remove_ids=(), confirmed_by='reviewer-a')
        args.update(overrides)
        return apply_change(self.job, **args)

    def test_addition_preserves_previous_requirements_and_original_version(self):
        changed = self.change()
        self.assertEqual([c.id for c in changed.criteria], ['b2b', 'rag', 'launch'])
        self.assertEqual(changed.version, 2)
        self.assertEqual(self.job.version, 1)
        self.assertEqual(len(self.job.criteria), 2)
        self.assertEqual(changed.history[-1].source_text, '必须主导过产品上线')

    def test_preference_stays_a_preference(self):
        changed = self.change(source_text='最好做过HR SaaS', updates=(
            Criterion('industry', 'HR SaaS经历', 'preferred', '最好做过HR SaaS'),))
        self.assertEqual(changed.criteria[-1].kind, 'preferred')

    def test_replacing_condition_keeps_other_conditions_and_records_reviewer(self):
        changed = self.change(source_text='B端产品经验调整为5年以上', updates=(
            Criterion('b2b', '5年以上B端产品经验', 'required', 'B端产品经验调整为5年以上'),))
        self.assertEqual(changed.criteria[0].text, '5年以上B端产品经验')
        self.assertEqual(changed.criteria[1], self.job.criteria[1])
        self.assertEqual(changed.history[-1].confirmed_by, 'reviewer-a')

    def test_stale_revision_cannot_overwrite_newer_work(self):
        with self.assertRaises(ValueError):
            self.change(expected_version=0)

    def test_missing_confirmation_or_quote_is_rejected(self):
        for changes in [dict(confirmed_by=' '), dict(source_text='客户只说先了解情况')]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.change(**changes)

    def test_duplicate_or_unsupported_conditions_are_rejected(self):
        item = Criterion('launch', '上线', 'required', '必须主导过产品上线')
        for updates in [(item, item), (Criterion('x', '未知条件', 'unknown', '必须'),)]:
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                self.change(updates=updates)

    def test_explicit_removal_preserves_other_conditions(self):
        changed = self.change(source_text='取消RAG要求', updates=(), remove_ids=('rag',))
        self.assertEqual([c.id for c in changed.criteria], ['b2b'])
        self.assertEqual(changed.history[-1].removed_ids, ('rag',))

    def test_unknown_removal_is_rejected(self):
        with self.assertRaises(ValueError):
            self.change(updates=(), remove_ids=('missing',))


class ScopedMemoryTests(unittest.TestCase):
    def test_only_confirmed_current_and_matching_scope_is_returned(self):
        memories = (
            Memory('j', '本岗位条件', 'job', 'job-a', 'reviewer-a', None),
            Memory('c', '本客户偏好', 'client', 'client-a', 'reviewer-a', None),
            Memory('r', '摘要用三句话', 'recruiter', 'recruiter-a', 'reviewer-a', None),
            Memory('other', '其他客户偏好', 'client', 'client-b', 'reviewer-a', None),
            Memory('expired', '过期条件', 'job', 'job-a', 'reviewer-a', date(2026, 11, 2)),
            Memory('draft', '未经确认的推测', 'job', 'job-a', '', None),
            Memory('unknown', '未知范围', 'global', 'all', 'reviewer-a', None),
        )
        result = select_memories(memories, job_id='job-a', client_id='client-a',
                                 recruiter_id='recruiter-a', today=date(2026, 11, 3))
        self.assertEqual([m.id for m in result], ['j', 'c', 'r'])

    def test_expiration_day_is_inclusive(self):
        memory = Memory('m', '当天仍有效', 'job', 'job-a', 'reviewer-a', date(2026, 11, 3))
        result = select_memories((memory,), job_id='job-a', client_id='client-a',
                                 recruiter_id='recruiter-a', today=date(2026, 11, 3))
        self.assertEqual(result, (memory,))


if __name__ == '__main__':
    unittest.main()
